import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadRuntimeConfig, type RuntimeConfig } from "../src/modules/config/runtime-config.ts";
import { EventStore } from "../src/modules/events/event-store.ts";
import { IndexStore } from "../src/modules/indexing/index-store.ts";
import { ReindexCommand } from "../src/modules/indexing/reindex-command.ts";
import { objectIdToSafeSegment, PathResolver } from "../src/modules/storage/path-resolver.ts";
import { ObjectStore } from "../src/modules/storage/object-store.ts";
import { getStorageBootstrapPlan } from "../src/modules/storage/storage-doctor.ts";
import { ValidationService } from "../src/modules/validation/validation-service.ts";
import type { LwsNode } from "../src/shared/object-model.ts";
import { HistoryService } from "../src/services/history-service.ts";
import { MutationService } from "../src/services/mutation-service.ts";
import { NodeService } from "../src/services/node-service.ts";
import { ObjectQueryService } from "../src/services/object-query-service.ts";
import { PermissionService } from "../src/services/permission-service.ts";

const full = createFixture("full-reindex");
const publicCreate = full.nodeService.createNode(
  {
    object: nodeFixture({
      id: "note.public-m3",
      title: "Public M3",
      slug: "public-m3",
      type: "type.note",
      visibility: "public",
      summary: "visible fallback search target",
      aliases: ["m3-public-alias"],
      content: {
        format: "markdown",
        body: "public content body"
      }
    })
  },
  full.bootstrap
);
const privateCreate = full.nodeService.createNode(
  {
    object: nodeFixture({
      id: "note.private-m3",
      title: "Private M3 Secret",
      slug: "private-m3",
      type: "type.note",
      visibility: "private",
      summary: "private secret phrase",
      content: {
        format: "markdown",
        body: "private body should never leak to anonymous search"
      }
    })
  },
  full.bootstrap
);

if (fs.existsSync(full.config.index.sqlitePath)) {
  fs.unlinkSync(full.config.index.sqlitePath);
}
const fullReindex = new ReindexCommand(full.objectStore, full.validationService, full.indexStore).run();
assert.equal(fullReindex.status, "succeeded");
assert.equal(fullReindex.object_count, 2);
assert.equal(countRows(full.indexStore, "objects"), 2);
assert.equal(countRows(full.indexStore, "events"), 2);
assert.equal(countRows(full.indexStore, "object_history"), 2);

const anonymous = full.permissionService.resolveContext();
const queryService = new ObjectQueryService(full.indexStore, full.permissionService);
const publicSearch = queryService.search({ q: "fallback", limit: 10, include_permissions: true }, anonymous);
assert.equal(publicSearch.items.some((item: any) => item.id === "note.public-m3"), true);
assert.equal(publicSearch.items.every((item: any) => item.viewer_permissions?.can_read === true), true);
const privateSearch = queryService.search({ q: "secret", limit: 10, include_permissions: true }, anonymous);
assert.equal(privateSearch.items.some((item: any) => item.id === "note.private-m3"), false);

const historyService = new HistoryService(full.objectStore, full.eventStore, full.permissionService, full.indexStore);
const projectedHistory = historyService.listHistory("note.public-m3", full.bootstrap);
assert.equal(projectedHistory.length, 1);
fs.renameSync(historyFilePath(full.config, "node", "note.public-m3"), `${historyFilePath(full.config, "node", "note.public-m3")}.bak`);
assert.equal(historyService.listHistory("note.public-m3", full.bootstrap).length, 1);

const incremental = createFixture("incremental");
new ReindexCommand(incremental.objectStore, incremental.validationService, incremental.indexStore).run();
const incrementalResult = incremental.nodeService.createNode(
  {
    object: nodeFixture({
      id: "note.incremental-m3",
      title: "Incremental M3",
      slug: "incremental-m3",
      type: "type.note",
      visibility: "public"
    })
  },
  incremental.bootstrap
);
assert.equal(incrementalResult.warnings.length, 0);
assert.equal(countRows(incremental.indexStore, "objects"), 1);
assert.equal(countRows(incremental.indexStore, "events"), 1);
assert.equal(countRows(incremental.indexStore, "object_history"), 1);

const stale = createFixture("projection-stale");
new ReindexCommand(stale.objectStore, stale.validationService, stale.indexStore).run();
const staleDb = stale.indexStore.open();
staleDb.prepare("DROP TABLE events").run();
staleDb.close();
const staleResult = stale.nodeService.createNode(
  {
    object: nodeFixture({
      id: "note.stale-m3",
      title: "Stale M3",
      slug: "stale-m3",
      type: "type.note",
      visibility: "public"
    })
  },
  stale.bootstrap
);
assert.equal(staleResult.warnings.includes("INDEX_STALE"), true);
assert.equal(stale.indexStore.getStatus().state, "INDEX_STALE");

const corrupt = createFixture("corrupt-history");
const corruptA = corrupt.nodeService.createNode(
  {
    object: nodeFixture({
      id: "note.bad-event-ref",
      title: "Bad Event Ref",
      slug: "bad-event-ref",
      type: "type.note"
    })
  },
  corrupt.bootstrap
);
const corruptB = corrupt.nodeService.createNode(
  {
    object: nodeFixture({
      id: "note.missing-patch",
      title: "Missing Patch",
      slug: "missing-patch",
      type: "type.note"
    })
  },
  corrupt.bootstrap
);
const corruptHistoryPath = historyFilePath(corrupt.config, "node", "note.bad-event-ref");
const corruptHistoryRow = JSON.parse(fs.readFileSync(corruptHistoryPath, "utf8").trim());
fs.writeFileSync(corruptHistoryPath, `${JSON.stringify({ ...corruptHistoryRow, event_ref: "../../outside.jsonl" })}\n`, "utf8");
fs.unlinkSync(patchRecordPath(corrupt.config, "node", "note.missing-patch", corruptB.event_id));
fs.appendFileSync(historyFilePath(corrupt.config, "node", "note.missing-patch"), "{invalid-json\n", "utf8");

const corruptReindex = new ReindexCommand(corrupt.objectStore, corrupt.validationService, corrupt.indexStore).run();
assert.equal(corruptReindex.warning_count >= 3, true);
const issueCodes = validationIssueCodes(corrupt.indexStore);
assert.equal(issueCodes.includes("EVENT_REF_INVALID"), true);
assert.equal(issueCodes.includes("PATCH_PATH_MISSING"), true);
assert.equal(issueCodes.includes("OBJECT_HISTORY_INVALID"), true);
assert.equal(countRows(corrupt.indexStore, "events"), 2);
assert.equal(countRows(corrupt.indexStore, "object_history"), 0);
assert.equal(corruptA.event_id.startsWith("event."), true);
assert.equal(privateCreate.event_id.startsWith("event."), true);
assert.equal(publicCreate.event_id.startsWith("event."), true);

console.log("Milestone M3 SQLite projection completion checks passed.");

function createFixture(label: string) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `lws-m3-${label}-`));
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
  const eventStore = new EventStore(config);
  const mutationService = new MutationService(objectStore, validationService, permissionService, eventStore, indexStore);
  const nodeService = new NodeService(mutationService);
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
    eventStore,
    nodeService,
    bootstrap
  };
}

function countRows(indexStore: IndexStore, tableName: string): number {
  const db = indexStore.openReady();
  try {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as { count: number };
    return row.count;
  } finally {
    db.close();
  }
}

function validationIssueCodes(indexStore: IndexStore): string[] {
  const db = indexStore.openReady();
  try {
    return db.prepare("SELECT code FROM validation_issues ORDER BY code ASC").all().map((row: any) => row.code);
  } finally {
    db.close();
  }
}

function historyFilePath(config: RuntimeConfig, kind: "node" | "edge", objectId: string): string {
  return path.join(config.roots.data, "history", `${kind}s`, objectIdToSafeSegment(objectId), "events.jsonl");
}

function patchRecordPath(config: RuntimeConfig, kind: "node" | "edge", objectId: string, eventId: string): string {
  return path.join(config.roots.data, "history", `${kind}s`, objectIdToSafeSegment(objectId), "patches", `${eventId}.json`);
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
