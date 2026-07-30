import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveHttpRequestContext } from "../src/modules/auth/request-context-adapter.ts";
import { loadRuntimeConfig } from "../src/modules/config/runtime-config.ts";
import { EventStore } from "../src/modules/events/event-store.ts";
import { IndexStore } from "../src/modules/indexing/index-store.ts";
import { ReindexCommand } from "../src/modules/indexing/reindex-command.ts";
import { ObjectStore } from "../src/modules/storage/object-store.ts";
import { PathResolver } from "../src/modules/storage/path-resolver.ts";
import { getStorageBootstrapPlan } from "../src/modules/storage/storage-doctor.ts";
import { ValidationService } from "../src/modules/validation/validation-service.ts";
import { LwsError } from "../src/shared/errors.ts";
import type { LwsEdge, LwsNode } from "../src/shared/object-model.ts";
import { EdgeService } from "../src/services/edge-service.ts";
import { GraphService } from "../src/services/graph-service.ts";
import { MutationService } from "../src/services/mutation-service.ts";
import { NodeService } from "../src/services/node-service.ts";
import { ObjectQueryService } from "../src/services/object-query-service.ts";
import { ObjectService } from "../src/services/object-service.ts";
import { OntologyService } from "../src/services/ontology-service.ts";
import { PermissionService } from "../src/services/permission-service.ts";
import { SessionService } from "../src/services/session-service.ts";
import { TimelineService } from "../src/services/timeline-service.ts";

const fixture = createFixture("permission-enforcement");
const bootstrap = fixture.bootstrap;

fixture.nodeService.createNode({ object: nodeFixture({ id: "account.a", title: "Account A", slug: "account-a", type: "type.account" }) }, bootstrap);
fixture.nodeService.createNode({ object: nodeFixture({ id: "account.b", title: "Account B", slug: "account-b", type: "type.account" }) }, bootstrap);
fixture.nodeService.createNode({ object: nodeFixture({ id: "group.team", title: "Team", slug: "team", type: "type.group" }) }, bootstrap);
fixture.nodeService.createNode({ object: nodeFixture({ id: "collection.team", title: "Team Collection", slug: "team-collection", type: "type.collection" }) }, bootstrap);
fixture.nodeService.createNode({ object: nodeFixture({ id: "type.secret", title: "Secret Type", slug: "secret-type", type: "type.node-type" }) }, bootstrap);
fixture.nodeService.createNode({
  object: nodeFixture({
    id: "note.a-private",
    title: "A Private Alpha",
    slug: "a-private-alpha",
    type: "type.note",
    summary: "alpha private search phrase"
  })
}, bootstrap);
fixture.nodeService.createNode({
  object: nodeFixture({
    id: "note.group-private",
    title: "Group Private Beta",
    slug: "group-private-beta",
    type: "type.note",
    summary: "beta group search phrase"
  })
}, bootstrap);
fixture.nodeService.createNode({
  object: nodeFixture({
    id: "note.collection-private",
    title: "Collection Private Gamma",
    slug: "collection-private-gamma",
    type: "type.note",
    summary: "gamma collection search phrase"
  })
}, bootstrap);
fixture.nodeService.createNode({
  object: nodeFixture({
    id: "note.public-m4",
    title: "Public M4",
    slug: "public-m4",
    type: "type.note",
    visibility: "public",
    summary: "public m4 search phrase"
  })
}, bootstrap);
fixture.nodeService.createNode({
  object: nodeFixture({
    id: "note.owned-private",
    title: "Owned Private Delta",
    slug: "owned-private-delta",
    type: "type.note",
    summary: "delta owner search phrase"
  })
}, bootstrap);
fixture.edgeService.createEdge({
  object: edgeFixture({
    id: "edge.m4.a-can-read-note",
    source: "account.a",
    target: "note.a-private",
    type: "rel.can_read",
    title: "A can read private note"
  })
}, bootstrap);
fixture.edgeService.createEdge({
  object: edgeFixture({
    id: "edge.m4.team-can-read-note",
    source: "group.team",
    target: "note.group-private",
    type: "rel.can_read",
    title: "Team can read group private note"
  })
}, bootstrap);
fixture.edgeService.createEdge({
  object: edgeFixture({
    id: "edge.m4.team-contains-note",
    source: "collection.team",
    target: "note.collection-private",
    type: "rel.contains",
    title: "Team collection contains private note"
  })
}, bootstrap);
fixture.edgeService.createEdge({
  object: edgeFixture({
    id: "edge.m4.team-can-read-collection",
    source: "group.team",
    target: "collection.team",
    type: "rel.can_read_in",
    title: "Team can read collection"
  })
}, bootstrap);
fixture.edgeService.createEdge({
  object: edgeFixture({
    id: "edge.m4.a-can-update-collection",
    source: "account.a",
    target: "collection.team",
    type: "rel.can_update_in",
    title: "A can update collection"
  })
}, bootstrap);
fixture.edgeService.createEdge({
  object: edgeFixture({
    id: "edge.m4.a-can-create-collection",
    source: "account.a",
    target: "collection.team",
    type: "rel.can_create_in",
    title: "A can create in collection"
  })
}, bootstrap);
fixture.edgeService.createEdge({
  object: edgeFixture({
    id: "edge.m4.a-can-read-type",
    source: "account.a",
    target: "type.secret",
    type: "rel.can_read",
    title: "A can read secret type"
  })
}, bootstrap);
fixture.edgeService.createEdge({
  object: edgeFixture({
    id: "edge.m4.a-owns-note",
    source: "account.a",
    target: "note.owned-private",
    type: "rel.owns",
    title: "A owns private note"
  })
}, bootstrap);

const reindex = new ReindexCommand(fixture.objectStore, fixture.validationService, fixture.indexStore).run();
assert.equal(reindex.status, "succeeded");

const accountA = fixture.permissionService.resolveContext({ accountId: "account.a", authSource: "session" });
const accountB = fixture.permissionService.resolveContext({ accountId: "account.b", authSource: "session" });
const anonymous = fixture.permissionService.resolveContext();
const objectService = new ObjectService(fixture.objectStore, fixture.permissionService);
const queryService = new ObjectQueryService(fixture.indexStore, fixture.permissionService);
const graphService = new GraphService(fixture.indexStore, fixture.permissionService);
const timelineService = new TimelineService(fixture.indexStore, fixture.permissionService);
const ontologyService = new OntologyService(fixture.indexStore, fixture.permissionService);
const sessionService = new SessionService(fixture.permissionService);

assert.equal(objectService.readObject("note.a-private", accountA).object.id, "note.a-private");
assertPermissionDenied(() => objectService.readObject("note.a-private", accountB));
assertPermissionDenied(() => objectService.readObject("note.a-private", anonymous));
assert.equal(queryService.search({ q: "alpha", limit: 10 }, accountA).items.some((item: any) => item.id === "note.a-private"), true);
assert.equal(queryService.search({ q: "alpha", limit: 10 }, accountB).items.length, 0);
assert.equal(queryService.search({ q: "alpha", limit: 10 }, anonymous).items.length, 0);
const listForA = queryService.listObjects({ limit: 100 }, accountA).items.map((item: any) => item.id);
const listForB = queryService.listObjects({ limit: 100 }, accountB).items.map((item: any) => item.id);
assert.equal(listForA.includes("note.a-private"), true);
assert.equal(listForA.includes("note.owned-private"), true);
assert.equal(listForA.includes("note.public-m4"), true);
assert.equal(listForA.includes("note.group-private"), false);
assert.equal(listForA.includes("note.collection-private"), false);
assert.equal(listForB.includes("note.a-private"), false);
assert.equal(listForB.includes("note.owned-private"), false);
assert.equal(listForB.includes("note.public-m4"), true);
assert.equal(queryService.search({ q: "delta", limit: 10 }, accountA).items.some((item: any) => item.id === "note.owned-private"), true);
assert.equal(queryService.search({ q: "delta", limit: 10 }, accountB).items.length, 0);

assert.equal(objectService.readObject("note.owned-private", accountA).object.id, "note.owned-private");
assertPermissionDenied(() => objectService.readObject("note.owned-private", accountB));
const ownerUpdate = fixture.nodeService.patchNode({
  id: "note.owned-private",
  base_rev: 1,
  patch: [{ op: "replace", path: "/summary", value: "delta owner updated by owner" }]
}, accountA);
assert.equal(ownerUpdate.object.summary, "delta owner updated by owner");
assertPermissionDenied(() =>
  fixture.nodeService.patchNode({
    id: "note.owned-private",
    base_rev: ownerUpdate.next_rev,
    patch: [{ op: "replace", path: "/summary", value: "b should not update owned note" }]
  }, accountB)
);

const scopedCreate = fixture.nodeService.createNode({
  object: nodeFixture({
    id: "note.created-in-collection",
    title: "Created In Collection",
    slug: "created-in-collection",
    type: "type.note"
  }),
  target_scope: "collection.team"
}, accountA);
assert.equal(scopedCreate.object.id, "note.created-in-collection");
assertPermissionDenied(() =>
  fixture.nodeService.createNode({
    object: nodeFixture({
      id: "note.b-create-denied",
      title: "B Create Denied",
      slug: "b-create-denied",
      type: "type.note"
    }),
    target_scope: "collection.team"
  }, accountB)
);

assertPermissionDenied(() => objectService.readObject("note.group-private", accountA));
const membership = fixture.edgeService.createEdge({
  object: edgeFixture({
    id: "edge.m4.a-member-of-team",
    source: "account.a",
    target: "group.team",
    type: "rel.member_of",
    title: "A is team member"
  })
}, bootstrap);
assert.equal(membership.warnings.length, 0);
assert.equal(objectService.readObject("note.group-private", accountA).object.id, "note.group-private");
assert.equal(objectService.readObject("note.collection-private", accountA).object.id, "note.collection-private");
assert.equal(
  queryService.search({ q: "gamma", limit: 10, collection: "collection.team", include_permissions: true }, accountA).items
    .some((item: any) => item.id === "note.collection-private" && item.viewer_permissions.can_update === true),
  true
);
assert.equal(queryService.search({ q: "gamma", limit: 10 }, accountB).items.length, 0);

const graphForB = graphService.getGraph({}, accountB);
assert.equal(graphForB.nodes.some((node: any) => node.id === "note.collection-private"), false);
assert.equal(graphForB.edges.some((edge: any) => edge.edge_id === "edge.m4.team-contains-note"), false);
const timelineForA = timelineService.getTimeline(accountA);
const timelineForB = timelineService.getTimeline(accountB);
assert.equal(timelineForA.items.some((item: any) => item.object_id === "note.collection-private"), true);
assert.equal(timelineForB.items.some((item: any) => item.object_id === "note.collection-private"), false);
assert.equal(ontologyService.getOntology(accountA).types.some((item: any) => item.id === "type.secret"), true);
assert.equal(ontologyService.getOntology(accountB).types.some((item: any) => item.id === "type.secret"), false);

fixture.edgeService.deleteEdge({ id: "edge.m4.a-member-of-team", base_rev: membership.next_rev }, bootstrap);
assertPermissionDenied(() => objectService.readObject("note.group-private", accountA));
assertPermissionDenied(() => objectService.readObject("note.collection-private", accountA));

fixture.edgeService.patchEdge({
  id: "edge.m4.a-can-read-note",
  base_rev: 1,
  patch: [{ op: "replace", path: "/type", value: "rel.references" }]
}, bootstrap);
assertPermissionDenied(() => objectService.readObject("note.a-private", accountA));
assert.equal(queryService.search({ q: "alpha", limit: 10 }, accountA).items.length, 0);

const updateResult = fixture.nodeService.patchNode({
  id: "note.collection-private",
  base_rev: 1,
  patch: [{ op: "add", path: "/summary", value: "gamma collection updated by scoped permission" }]
}, accountA);
assert.equal(updateResult.object.summary, "gamma collection updated by scoped permission");
assertPermissionDenied(() =>
  fixture.nodeService.patchNode({
    id: "note.collection-private",
    base_rev: updateResult.next_rev,
    patch: [{ op: "replace", path: "/summary", value: "b should not update" }]
  }, accountB)
);

assertPermissionDenied(() =>
  fixture.edgeService.createEdge({
    object: edgeFixture({
      id: "edge.m4.a-tries-permission-edge",
      source: "account.a",
      target: "note.public-m4",
      type: "rel.can_read",
      title: "A tries to grant read"
    })
  }, accountA)
);

const session = sessionService.getSession(accountA, fixture.config.publicConfig);
assert.equal(session.display_name, "Account A");
assert.equal(session.ui_capabilities.includes("system.manage"), false);

fixture.edgeService.createEdge({
  object: edgeFixture({
    id: "edge.m4.a-can-read-collection-note",
    source: "account.a",
    target: "note.collection-private",
    type: "rel.can_read",
    title: "A can read collection note for fail-closed check"
  })
}, bootstrap);
assert.equal(objectService.readObject("note.collection-private", accountA).object.id, "note.collection-private");

fixture.indexStore.markStale("m4 fail-closed check");
assertPermissionDenied(() => objectService.readObject("note.collection-private", accountA));
assertPermissionDenied(() =>
  fixture.nodeService.patchNode({
    id: "note.collection-private",
    base_rev: updateResult.next_rev,
    patch: [{ op: "replace", path: "/summary", value: "stale should deny" }]
  }, accountA)
);

const corrupt = createFixture("corrupt-permission");
corrupt.nodeService.createNode({ object: nodeFixture({ id: "account.a", title: "Account A", slug: "account-a", type: "type.account" }) }, corrupt.bootstrap);
corrupt.nodeService.createNode({ object: nodeFixture({ id: "note.corrupt-private", title: "Corrupt Private", slug: "corrupt-private", type: "type.note" }) }, corrupt.bootstrap);
corrupt.edgeService.createEdge({
  object: edgeFixture({
    id: "edge.m4.corrupt-a-read",
    source: "account.a",
    target: "note.corrupt-private",
    type: "rel.can_read",
    title: "A can read before corruption"
  })
}, corrupt.bootstrap);
new ReindexCommand(corrupt.objectStore, corrupt.validationService, corrupt.indexStore).run();
const corruptAccountA = corrupt.permissionService.resolveContext({ accountId: "account.a", authSource: "session" });
assert.equal(new ObjectService(corrupt.objectStore, corrupt.permissionService).readObject("note.corrupt-private", corruptAccountA).object.id, "note.corrupt-private");
fs.writeFileSync(corrupt.config.index.sqlitePath, "not a sqlite database", "utf8");
assertPermissionDenied(() => new ObjectService(corrupt.objectStore, corrupt.permissionService).readObject("note.corrupt-private", corruptAccountA));

const missing = createFixture("missing-permission");
missing.nodeService.createNode({ object: nodeFixture({ id: "account.a", title: "Account A", slug: "account-a", type: "type.account" }) }, missing.bootstrap);
missing.nodeService.createNode({ object: nodeFixture({ id: "note.missing-private", title: "Missing Private", slug: "missing-private", type: "type.note" }) }, missing.bootstrap);
missing.edgeService.createEdge({
  object: edgeFixture({
    id: "edge.m4.missing-a-owns",
    source: "account.a",
    target: "note.missing-private",
    type: "rel.owns",
    title: "A owns before missing index"
  })
}, missing.bootstrap);
new ReindexCommand(missing.objectStore, missing.validationService, missing.indexStore).run();
const missingAccountA = missing.permissionService.resolveContext({ accountId: "account.a", authSource: "session" });
assert.equal(new ObjectService(missing.objectStore, missing.permissionService).readObject("note.missing-private", missingAccountA).object.id, "note.missing-private");
fs.unlinkSync(missing.config.index.sqlitePath);
assertPermissionDenied(() => new ObjectService(missing.objectStore, missing.permissionService).readObject("note.missing-private", missingAccountA));
assertPermissionDenied(() =>
  missing.nodeService.patchNode({
    id: "note.missing-private",
    base_rev: 1,
    patch: [{ op: "replace", path: "/summary", value: "missing projection should deny" }]
  }, missingAccountA)
);

const spoofed = resolveHttpRequestContext(
  new Request("http://lws.local/api/lws/objects", {
    headers: {
      "x-lws-auth-source": "session",
      "x-lws-account-id": "account.a",
      "x-lws-ui-capabilities": "system.manage"
    }
  }),
  corrupt.config,
  corrupt.permissionService
);
assert.equal(spoofed.reason, "untrusted-session");
assert.equal(spoofed.context.isAnonymous, true);

console.log("Milestone M4 permission enforcement completion checks passed.");

function createFixture(label: string) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `lws-m4-${label}-`));
  const appRoot = path.join(tempRoot, "app");
  const storageRoot = path.join(tempRoot, "storage");
  fs.mkdirSync(appRoot, { recursive: true });

  const env = {
    LWS_APP_NAME: "Listro Wiki System",
    LWS_ENV: "development",
    LWS_HOST: "127.0.0.1",
    LWS_PORT: "3000",
    LWS_KNOWLEDGE_ROOT: path.join(storageRoot, "knowledge", "wiki"),
    LWS_DATA_ROOT: path.join(storageRoot, "data", "wiki"),
    LWS_RUNTIME_ROOT: path.join(storageRoot, "runtime", "wiki"),
    LWS_LOG_ROOT: path.join(storageRoot, "logs", "apps", "wiki"),
    LWS_BACKUP_ROOT: path.join(storageRoot, "backups", "wiki"),
    LWS_AUTH_MODE: "local",
    LWS_SESSION_SECRET: "change-me",
    LWS_ADMIN_BOOTSTRAP_ACCOUNT: "account.admin",
    LWS_DEFAULT_VISIBILITY: "private",
    LWS_PUBLIC_GRAPH_ENABLED: "false",
    LWS_ALLOW_STORAGE_INIT: "false",
    LWS_ALLOW_SAMPLE_DATA: "false",
    LWS_INDEX_MODE: "sqlite",
    LWS_SQLITE_ENABLED: "true",
    LWS_SQLITE_PATH: path.join(storageRoot, "data", "wiki", "db", "lws.sqlite"),
    LWS_AUTOSAVE_INTERVAL_MS: "1000"
  };

  const config = loadRuntimeConfig(env, appRoot);
  for (const directory of getStorageBootstrapPlan(config)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const objectStore = new ObjectStore(new PathResolver(config));
  const validationService = new ValidationService(objectStore);
  const indexStore = new IndexStore(config);
  const permissionService = new PermissionService({
    adminBootstrapAccount: config.auth.adminBootstrapAccount,
    indexStore
  });
  const eventStore = new EventStore(new PathResolver(config));
  const mutationService = new MutationService(objectStore, validationService, permissionService, eventStore, indexStore);
  const nodeService = new NodeService(mutationService);
  const edgeService = new EdgeService(mutationService);
  const bootstrap = permissionService.resolveContext({
    accountId: "account.admin",
    authSource: "local-script"
  });

  return {
    config,
    objectStore,
    validationService,
    indexStore,
    permissionService,
    nodeService,
    edgeService,
    bootstrap
  };
}

function assertPermissionDenied(action: () => unknown): void {
  assert.throws(action, (error) => {
    assert.equal(error instanceof LwsError, true);
    assert.equal((error as LwsError).code, "PERMISSION_DENIED");
    return true;
  });
}

function nodeFixture(overrides: Partial<LwsNode>): LwsNode {
  return {
    schema_version: 1,
    object_kind: "node",
    id: "node.placeholder",
    rev: 1,
    title: "Placeholder",
    slug: "placeholder",
    type: "type.note",
    detail_mode: "page",
    visibility: "private",
    status: "active",
    tags: [],
    props: {},
    temporal: {
      occurred_at: null,
      valid_from: null,
      valid_to: null
    },
    audit: {
      created_at: "2026-07-03T00:00:00+09:00",
      updated_at: "2026-07-03T00:00:00+09:00",
      created_by: "account.admin",
      updated_by: "account.admin"
    },
    ...overrides
  };
}

function edgeFixture(overrides: Partial<LwsEdge>): LwsEdge {
  return {
    schema_version: 1,
    object_kind: "edge",
    id: "edge.placeholder",
    rev: 1,
    source: "account.a",
    target: "note.a-private",
    type: "rel.can_read",
    title: "Permission",
    detail_mode: "note",
    visibility: "private",
    status: "active",
    tags: [],
    props: {},
    temporal: {
      occurred_at: null,
      valid_from: null,
      valid_to: null
    },
    audit: {
      created_at: "2026-07-03T00:00:00+09:00",
      updated_at: "2026-07-03T00:00:00+09:00",
      created_by: "account.admin",
      updated_by: "account.admin"
    },
    ...overrides
  };
}
