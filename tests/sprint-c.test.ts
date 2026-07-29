import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EventStore } from "../src/modules/events/event-store.ts";
import { loadRuntimeConfig } from "../src/modules/config/runtime-config.ts";
import { ObjectStore } from "../src/modules/storage/object-store.ts";
import { PathResolver } from "../src/modules/storage/path-resolver.ts";
import { checkStorage, getStorageBootstrapPlan } from "../src/modules/storage/storage-doctor.ts";
import { ValidationService } from "../src/modules/validation/validation-service.ts";
import { LwsError } from "../src/shared/errors.ts";
import type { LwsNode } from "../src/shared/object-model.ts";
import { HistoryService } from "../src/services/history-service.ts";
import { MutationService } from "../src/services/mutation-service.ts";
import { NodeService } from "../src/services/node-service.ts";
import { PermissionService } from "../src/services/permission-service.ts";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lws-sprint-c-"));
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
const eventStore = new EventStore(config);
const mutationService = new MutationService(objectStore, validationService, permissionService, eventStore);
const nodeService = new NodeService(mutationService);
const historyService = new HistoryService(objectStore, eventStore, permissionService);
const context = permissionService.resolveContext({
  accountId: "account.admin",
  authSource: "local-script"
});

const createResult = nodeService.createNode(
  {
    object: nodeFixture({
      id: "svc.caddy",
      title: "Caddy",
      slug: "caddy",
      type: "type.service",
      visibility: "private"
    })
  },
  context
);

assert.equal(createResult.object.rev, 1);
assert.match(createResult.event_id, /^event\./);
assert.equal(objectStore.readNode("svc.caddy").rev, 1);
assert.equal(historyService.listHistory("svc.caddy", context).length, 1);

const updateResult = nodeService.patchNode(
  {
    id: "svc.caddy",
    base_rev: 1,
    patch: [
      {
        op: "add",
        path: "/summary",
        value: "Caddy reverse proxy service"
      },
      {
        op: "add",
        path: "/props/port",
        value: 3000
      }
    ]
  },
  context
);

assert.equal(updateResult.object.rev, 2);
assert.equal(updateResult.object.summary, "Caddy reverse proxy service");
assert.equal(objectStore.readNode("svc.caddy").rev, 2);
const updatePatchRecord = eventStore.readPatchRecord("node", "svc.caddy", updateResult.event_id);
assert.equal(updatePatchRecord.inverse_patch.some((operation) => operation.path === "/summary"), true);

assert.throws(
  () =>
    nodeService.patchNode(
      {
        id: "svc.caddy",
        base_rev: 1,
        patch: [{ op: "replace", path: "/summary", value: "stale write" }]
      },
      context
    ),
  (error) => {
    assert.equal(error instanceof LwsError, true);
    assert.equal((error as LwsError).code, "REV_CONFLICT");
    return true;
  }
);

const deleteResult = nodeService.deleteNode(
  {
    id: "svc.caddy",
    base_rev: 2
  },
  context
);
assert.equal(deleteResult.object.status, "deleted");
assert.equal(deleteResult.next_rev, 3);

const restoreResult = mutationService.restoreObject(
  {
    id: "svc.caddy",
    base_rev: 3,
    source_event_id: deleteResult.event_id,
    mode: "inverse_patch"
  },
  context
);
assert.equal(restoreResult.object.status, "active");
assert.equal(restoreResult.next_rev, 4);
assert.equal(historyService.listHistory("svc.caddy", context).length, 4);
assert.equal(historyService.getHistoryDiff("svc.caddy", updateResult.event_id, context).event_id, updateResult.event_id);

const failingEventStore = new EventStore(config, { simulateCommitFailure: true });
const failingMutationService = new MutationService(
  objectStore,
  validationService,
  permissionService,
  failingEventStore
);
const failingNodeService = new NodeService(failingMutationService);

assert.throws(
  () =>
    failingNodeService.createNode(
      {
        object: nodeFixture({
          id: "note.failed-event",
          title: "Failed Event",
          slug: "failed-event",
          type: "type.note"
        })
      },
      context
    ),
  (error) => {
    assert.equal(error instanceof LwsError, true);
    assert.equal((error as LwsError).code, "EVENT_APPEND_FAILED");
    return true;
  }
);

assert.equal(objectStore.readNode("note.failed-event").id, "note.failed-event");
assert.equal(failingEventStore.listIncompleteMutations().some((journal) => journal.status === "failed"), true);
assert.equal(checkStorage(config).issues.some((issue) => issue.code === "EVENT_APPEND_FAILED"), true);

console.log("Sprint C mutation/event/history consistency checks passed.");

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
