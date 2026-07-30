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
import type { LwsEdge, LwsNode } from "../src/shared/object-model.ts";
import { EdgeService } from "../src/services/edge-service.ts";
import { GraphService } from "../src/services/graph-service.ts";
import { MutationService } from "../src/services/mutation-service.ts";
import { NodeService } from "../src/services/node-service.ts";
import { ObjectQueryService } from "../src/services/object-query-service.ts";
import { PermissionService } from "../src/services/permission-service.ts";
import { TimelineService } from "../src/services/timeline-service.ts";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lws-sprint-d-"));
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
const permissionService = new PermissionService({ adminBootstrapAccount: config.auth.adminBootstrapAccount });
const eventStore = new EventStore(new PathResolver(config));
const mutationService = new MutationService(objectStore, validationService, permissionService, eventStore);
const nodeService = new NodeService(mutationService);
const edgeService = new EdgeService(mutationService);
const indexStore = new IndexStore(config);
const context = permissionService.resolveContext({
  accountId: "account.admin",
  authSource: "local-script"
});
const anonymous = permissionService.resolveContext();

nodeService.createNode(
  {
    object: nodeFixture({
      id: "svc.caddy",
      title: "Caddy",
      slug: "caddy",
      type: "type.service",
      visibility: "public",
      summary: "Reverse proxy service",
      tags: ["tag.server"]
    })
  },
  context
);
nodeService.createNode(
  {
    object: nodeFixture({
      id: "svc.web",
      title: "Public Web",
      slug: "public-web",
      type: "type.service",
      visibility: "public",
      summary: "Public application"
    })
  },
  context
);
nodeService.createNode(
  {
    object: nodeFixture({
      id: "app.secret",
      title: "Secret App",
      slug: "secret-app",
      type: "type.project",
      visibility: "private",
      summary: "secret internal deployment"
    })
  },
  context
);
edgeService.createEdge(
  {
    object: edgeFixture({
      id: "edge.01JPUBLIC",
      source: "svc.caddy",
      target: "svc.web",
      type: "rel.depends_on",
      visibility: "public",
      title: "Caddy fronts Public Web"
    })
  },
  context
);

const reindexResult = new ReindexCommand(objectStore, validationService, indexStore).run();
assert.equal(reindexResult.status, "succeeded");
assert.equal(reindexResult.object_count, 4);
assert.equal(indexStore.getStatus().state, "ready");

const objectQuery = new ObjectQueryService(indexStore);
const list = objectQuery.listObjects({ limit: 20 }, anonymous);
const listedIds = list.items.map((item: any) => item.id);
assert.equal(listedIds.includes("svc.caddy"), true);
assert.equal(listedIds.includes("svc.web"), true);
assert.equal(listedIds.includes("edge.01JPUBLIC"), true);
assert.equal(listedIds.includes("app.secret"), false);

const privateSearch = objectQuery.search({ q: "secret", limit: 20 }, anonymous);
assert.equal(privateSearch.items.length, 0);
const publicSearch = objectQuery.search({ q: "reverse", limit: 20 }, anonymous);
assert.equal(publicSearch.items.some((item: any) => item.id === "svc.caddy"), true);

const graph = new GraphService(indexStore).getGraph({ center: "svc.caddy", depth: 1 }, anonymous);
assert.equal(graph.edges.some((edge: any) => edge.edge_id === "edge.01JPUBLIC"), true);
assert.equal(graph.nodes.some((node: any) => node.id === "app.secret"), false);

const backlinks = new GraphService(indexStore).getBacklinks("svc.web", anonymous);
assert.equal(backlinks.items.some((item: any) => item.edge_id === "edge.01JPUBLIC"), true);

const timeline = new TimelineService(indexStore).getTimeline(anonymous);
assert.equal(timeline.items.some((item: any) => item.object_id === "svc.caddy"), true);
assert.equal(timeline.items.some((item: any) => item.object_id === "app.secret"), false);

console.log("Sprint D SQLite reindex/read-model checks passed.");

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
    source: "svc.caddy",
    target: "svc.web",
    type: "rel.depends_on",
    title: "Relation",
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
