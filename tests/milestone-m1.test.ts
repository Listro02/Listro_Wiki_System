import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadRuntimeConfig, type RuntimeConfig } from "../src/modules/config/runtime-config.ts";
import { assertSafeEventId } from "../src/modules/events/event-id.ts";
import { EventStore } from "../src/modules/events/event-store.ts";
import type { ObjectHistoryLink } from "../src/modules/events/event-types.ts";
import { IndexStore } from "../src/modules/indexing/index-store.ts";
import { ObjectStore } from "../src/modules/storage/object-store.ts";
import { PathResolver } from "../src/modules/storage/path-resolver.ts";
import { getStorageBootstrapPlan } from "../src/modules/storage/storage-doctor.ts";
import { ValidationService } from "../src/modules/validation/validation-service.ts";
import { LwsError, type LwsErrorCode } from "../src/shared/errors.ts";
import type { LwsNode } from "../src/shared/object-model.ts";
import { createLwsBackend } from "../src/server/lws-backend.ts";
import { GraphService } from "../src/services/graph-service.ts";
import { HistoryService } from "../src/services/history-service.ts";
import { MutationService } from "../src/services/mutation-service.ts";
import { NodeService } from "../src/services/node-service.ts";
import { ObjectService } from "../src/services/object-service.ts";
import { ObjectQueryService } from "../src/services/object-query-service.ts";
import { OntologyService } from "../src/services/ontology-service.ts";
import { PermissionService } from "../src/services/permission-service.ts";
import { TimelineService } from "../src/services/timeline-service.ts";

const mainHarness = createHarness("main");
setProcessEnv(mainHarness.env);

const objectStore = new ObjectStore(new PathResolver(mainHarness.config));
const validationService = new ValidationService(objectStore);
const permissionService = new PermissionService({
  adminBootstrapAccount: mainHarness.config.auth.adminBootstrapAccount
});
const eventStore = new EventStore(new PathResolver(mainHarness.config));
const mutationService = new MutationService(objectStore, validationService, permissionService, eventStore);
const nodeService = new NodeService(mutationService);
const objectService = new ObjectService(objectStore, permissionService, validationService, new IndexStore(mainHarness.config));
const historyService = new HistoryService(objectStore, eventStore, permissionService);
const bootstrap = permissionService.resolveContext({
  accountId: "account.admin",
  authSource: "local-script"
});
const anonymous = permissionService.resolveContext();

const createResult = nodeService.createNode(
  {
    object: nodeFixture({
      id: "note.private-m1",
      title: "Private M1 Note",
      slug: "private-m1-note",
      type: "type.note",
      visibility: "private"
    })
  },
  bootstrap
);

for (const unsafeEventId of [
  "event.20260703.BAD/PATH",
  "event.20260703.BAD\\PATH",
  "../../event.20260703.BADPATH",
  "C:\\event.20260703.BADPATH",
  "\\\\server\\share\\event.20260703.BADPATH",
  "event.20260703.lowercasebad",
  "event.20260703.SHORT"
]) {
  assertLwsError(() => assertSafeEventId(unsafeEventId), "PATH_OUTSIDE_ROOT");
}

assertLwsError(() => eventStore.preparePendingMutation(commitInput({ event_id: "../event.20260703.BADPATH" })), "PATH_OUTSIDE_ROOT");
assertLwsError(() => eventStore.commitMutation(commitInput({ occurred_at: "not-a-date" })), "PATH_OUTSIDE_ROOT");

assertLwsError(() => objectService.validateObject("note.private-m1", anonymous), "PERMISSION_DENIED");
assertRouteUsesServiceAdapter("objects/[id]/validation/route.ts", "backend.objectService.validateObject");
assertRouteBackendSurfaceIsServiceOnly();

assertLwsError(
  () =>
    mutationService.restoreObject(
      {
        id: "note.private-m1",
        base_rev: 1,
        source_event_id: "../../outside",
        mode: "inverse_patch"
      },
      bootstrap
    ),
  "PATH_OUTSIDE_ROOT"
);

assertLwsError(() => historyService.getHistoryDiff("note.private-m1", "..\\outside", bootstrap), "PATH_OUTSIDE_ROOT");
assertLwsError(() => historyService.getHistoryEvent("note.private-m1", "event.20260703.BAD/PATH", bootstrap), "PATH_OUTSIDE_ROOT");

const maliciousHistoryRef: ObjectHistoryLink = {
  schema_version: 1,
  event_id: createResult.event_id,
  event_ref: "../../outside.jsonl",
  line: 1,
  byte_offset: 0,
  event_type: "node.created",
  base_rev: 0,
  next_rev: 1,
  occurred_at: new Date().toISOString(),
  summary: "malicious history ref",
  patch_path: "patches/ignored.json",
  after_hash: "ignored"
};
assertLwsError(() => eventStore.readGlobalEvent(maliciousHistoryRef), "PATH_OUTSIDE_ROOT");
assertLwsError(() => eventStore.readGlobalEvent({ ...maliciousHistoryRef, event_ref: path.resolve("outside.jsonl") }), "PATH_OUTSIDE_ROOT");
assertLwsError(() => eventStore.readGlobalEvent({ ...maliciousHistoryRef, event_ref: "events/2026/07/03.jsonl/extra" }), "PATH_OUTSIDE_ROOT");

assertServiceIndexError(mainHarness.config, anonymous, "INDEX_REBUILD_REQUIRED");

const corruptHarness = createHarness("corrupt");
fs.writeFileSync(corruptHarness.config.index.sqlitePath, "not a sqlite database", "utf8");
assertServiceIndexError(corruptHarness.config, anonymous, "INDEX_CORRUPT");

const mismatchHarness = createHarness("schema-mismatch");
const mismatchStore = new IndexStore(mismatchHarness.config);
const mismatchDb = mismatchStore.open();
mismatchStore.initialize(mismatchDb);
mismatchDb.prepare("INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)").run("schema_version", "0");
mismatchDb.close();
assertServiceIndexError(mismatchHarness.config, anonymous, "INDEX_SCHEMA_MISMATCH");

const staleHarness = createHarness("stale");
const staleStore = new IndexStore(staleHarness.config);
const staleDb = staleStore.open();
staleStore.initialize(staleDb);
staleDb.close();
staleStore.markStale("milestone m1 stale projection fixture");
assertServiceIndexError(staleHarness.config, anonymous, "INDEX_STALE");

assertRouteAdaptersDoNotUseStoresDirectly();

console.log("Milestone M1 safety boundary closure checks passed.");

function assertServiceIndexError(config: RuntimeConfig, context: typeof anonymous, code: LwsErrorCode): void {
  const indexStore = new IndexStore(config);
  assertLwsError(() => new ObjectQueryService(indexStore).listObjects({ limit: 10 }, context), code);
  assertLwsError(() => new ObjectQueryService(indexStore).search({ q: "private", limit: 10 }, context), code);
  assertLwsError(() => new GraphService(indexStore).getGraph({}, context), code);
  assertLwsError(() => new TimelineService(indexStore).getTimeline(context), code);
  assertLwsError(() => new OntologyService(indexStore).getOntology(context), code);
}

function assertLwsError(fn: () => unknown, code: LwsErrorCode): void {
  assert.throws(fn, (error) => {
    assert.equal(error instanceof LwsError, true);
    assert.equal((error as LwsError).code, code);
    return true;
  });
}

function assertRouteAdaptersDoNotUseStoresDirectly(): void {
  const routeRoot = path.join(process.cwd(), "src", "app", "api", "lws");
  const forbidden = ["backend.objectStore", "backend.indexStore", "backend.eventStore"];
  for (const file of listFiles(routeRoot).filter((candidate) => candidate.endsWith("route.ts"))) {
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.equal(source.includes(pattern), false, `${path.relative(process.cwd(), file)} directly uses ${pattern}`);
    }
  }
}

function assertRouteUsesServiceAdapter(relativePath: string, expectedCall: string): void {
  const routePath = path.join(process.cwd(), "src", "app", "api", "lws", ...relativePath.split("/"));
  const source = fs.readFileSync(routePath, "utf8");
  assert.equal(source.includes(expectedCall), true, `${relativePath} must call ${expectedCall}`);
}

function assertRouteBackendSurfaceIsServiceOnly(): void {
  const backend = createLwsBackend() as Record<string, unknown>;
  for (const forbidden of ["objectStore", "eventStore", "indexStore", "jobService", "permissionService", "pathResolver"]) {
    assert.equal(Object.hasOwn(backend, forbidden), false, `route backend surface must not expose ${forbidden}`);
  }
}

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolutePath) : [absolutePath];
  });
}

function createHarness(label: string): {
  env: Record<string, string>;
  config: RuntimeConfig;
} {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `lws-m1-${label}-`));
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

  return { env, config };
}

function setProcessEnv(env: Record<string, string>): void {
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
}

function commitInput(overrides: Record<string, unknown> = {}) {
  return {
    event_id: eventStore.createEventId(),
    event_type: "node.updated",
    object_kind: "node",
    object_id: "note.private-m1",
    base_rev: 1,
    next_rev: 2,
    account_id: "account.admin",
    occurred_at: new Date().toISOString(),
    summary: "M1 path safety fixture",
    changed_fields: ["title"],
    patch: [{ op: "replace", path: "/title", value: "M1 Updated" }],
    inverse_patch: [{ op: "replace", path: "/title", value: "Private M1 Note" }],
    before_hash: null,
    after_hash: "hash.after",
    ...overrides
  } as any;
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
