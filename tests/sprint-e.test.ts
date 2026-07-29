import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EventStore } from "../src/modules/events/event-store.ts";
import { IndexStore } from "../src/modules/indexing/index-store.ts";
import { ReindexCommand } from "../src/modules/indexing/reindex-command.ts";
import { loadRuntimeConfig } from "../src/modules/config/runtime-config.ts";
import { ObjectStore } from "../src/modules/storage/object-store.ts";
import { PathResolver } from "../src/modules/storage/path-resolver.ts";
import { getStorageBootstrapPlan } from "../src/modules/storage/storage-doctor.ts";
import { ValidationService } from "../src/modules/validation/validation-service.ts";
import { LwsError } from "../src/shared/errors.ts";
import type { LwsEdge, LwsNode } from "../src/shared/object-model.ts";
import { EdgeService } from "../src/services/edge-service.ts";
import { MutationService } from "../src/services/mutation-service.ts";
import { NodeService } from "../src/services/node-service.ts";
import { ObjectService } from "../src/services/object-service.ts";
import { PermissionService } from "../src/services/permission-service.ts";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lws-sprint-e-"));
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
const setupPermissionService = new PermissionService({ adminBootstrapAccount: config.auth.adminBootstrapAccount });
const eventStore = new EventStore(config);
const setupMutationService = new MutationService(objectStore, validationService, setupPermissionService, eventStore);
const setupNodeService = new NodeService(setupMutationService);
const setupEdgeService = new EdgeService(setupMutationService);
const bootstrap = setupPermissionService.resolveContext({
  accountId: "account.admin",
  authSource: "local-script"
});

setupNodeService.createNode({ object: nodeFixture({ id: "account.taewo", title: "taewo", slug: "taewo", type: "type.account" }) }, bootstrap);
setupNodeService.createNode({ object: nodeFixture({ id: "note.private", title: "Private Note", slug: "private-note", type: "type.note" }) }, bootstrap);
setupEdgeService.createEdge(
  {
    object: edgeFixture({
      id: "edge.01JREAD",
      source: "account.taewo",
      target: "note.private",
      type: "rel.can_read",
      title: "taewo can read private note"
    })
  },
  bootstrap
);
setupEdgeService.createEdge(
  {
    object: edgeFixture({
      id: "edge.01JOWNS",
      source: "account.taewo",
      target: "note.private",
      type: "rel.owns",
      title: "taewo owns private note"
    })
  },
  bootstrap
);
setupEdgeService.createEdge(
  {
    object: edgeFixture({
      id: "edge.01JCREATE",
      source: "account.taewo",
      target: "scope.wiki",
      type: "rel.can_create_in",
      title: "taewo can create in wiki"
    })
  },
  bootstrap
);

const indexStore = new IndexStore(config);
new ReindexCommand(objectStore, validationService, indexStore).run();
const realPermissionService = new PermissionService({
  adminBootstrapAccount: config.auth.adminBootstrapAccount,
  indexStore
});
const objectService = new ObjectService(objectStore, realPermissionService);
const realMutationService = new MutationService(objectStore, validationService, realPermissionService, eventStore);
const realNodeService = new NodeService(realMutationService);
const taewo = realPermissionService.resolveContext({
  accountId: "account.taewo",
  authSource: "session"
});
const anonymous = realPermissionService.resolveContext();

assert.equal(objectService.readObject("note.private", taewo).object.id, "note.private");
assert.throws(() => objectService.readObject("note.private", anonymous), (error) => {
  assert.equal(error instanceof LwsError, true);
  assert.equal((error as LwsError).code, "PERMISSION_DENIED");
  return true;
});

const updateResult = realNodeService.patchNode(
  {
    id: "note.private",
    base_rev: 1,
    patch: [{ op: "add", path: "/summary", value: "owner update" }]
  },
  taewo
);
assert.equal(updateResult.object.summary, "owner update");

const createResult = realNodeService.createNode(
  {
    target_scope: "scope.wiki",
    object: nodeFixture({
      id: "note.created-by-taewo",
      title: "Created By Taewo",
      slug: "created-by-taewo",
      type: "type.note"
    })
  },
  taewo
);
assert.equal(createResult.object.id, "note.created-by-taewo");

const noPermission = realPermissionService.resolveContext({
  accountId: "account.nope",
  authSource: "session"
});
assert.throws(
  () =>
    realNodeService.createNode(
      {
        target_scope: "scope.wiki",
        object: nodeFixture({
          id: "note.denied",
          title: "Denied",
          slug: "denied",
          type: "type.note"
        })
      },
      noPermission
    ),
  (error) => {
    assert.equal(error instanceof LwsError, true);
    assert.equal((error as LwsError).code, "PERMISSION_DENIED");
    return true;
  }
);

console.log("Sprint E permission projection/enforcement checks passed.");

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
      created_at: "2026-07-01T00:00:00+09:00",
      updated_at: "2026-07-01T00:00:00+09:00",
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
    id: "edge.01JPLACEHOLDER",
    rev: 1,
    source: "account.taewo",
    target: "note.private",
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
      created_at: "2026-07-01T00:00:00+09:00",
      updated_at: "2026-07-01T00:00:00+09:00",
      created_by: "account.admin",
      updated_by: "account.admin"
    },
    ...overrides
  };
}
