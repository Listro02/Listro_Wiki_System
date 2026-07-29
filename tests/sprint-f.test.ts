import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EventStore } from "../src/modules/events/event-store.ts";
import { IndexStore } from "../src/modules/indexing/index-store.ts";
import { ReindexCommand } from "../src/modules/indexing/reindex-command.ts";
import { JobStore } from "../src/modules/jobs/job-store.ts";
import { loadRuntimeConfig } from "../src/modules/config/runtime-config.ts";
import { ObjectStore } from "../src/modules/storage/object-store.ts";
import { PathResolver } from "../src/modules/storage/path-resolver.ts";
import { getStorageBootstrapPlan } from "../src/modules/storage/storage-doctor.ts";
import { ValidationService } from "../src/modules/validation/validation-service.ts";
import type { LwsNode } from "../src/shared/object-model.ts";
import { AdminService } from "../src/services/admin-service.ts";
import { JobService } from "../src/services/job-service.ts";
import { MutationService } from "../src/services/mutation-service.ts";
import { NodeService } from "../src/services/node-service.ts";
import { ObjectQueryService } from "../src/services/object-query-service.ts";
import { PermissionService } from "../src/services/permission-service.ts";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lws-sprint-f-"));
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
const queryService = new ObjectQueryService(indexStore);
const jobService = new JobService(new JobStore(config));
const reindexCommand = new ReindexCommand(objectStore, validationService, indexStore);
const adminService = new AdminService({
  permissionService,
  jobService,
  reindexCommand,
  eventStore
});
const bootstrap = permissionService.resolveContext({
  accountId: "account.admin",
  authSource: "local-script"
});

nodeService.createNode(
  {
    object: nodeFixture({
      id: "note.indexed",
      title: "Indexed",
      slug: "indexed",
      type: "type.note",
      visibility: "public",
      summary: "before incremental update"
    })
  },
  bootstrap
);

const reindexJob = adminService.reindex(bootstrap);
assert.equal(reindexJob.status, "succeeded");
assert.equal(reindexJob.type, "reindex");
assert.equal(jobService.getJob(reindexJob.job_id).status, "succeeded");
assert.equal(queryService.search({ q: "before", limit: 10 }, permissionService.resolveContext()).items.length, 1);

const updateResult = nodeService.patchNode(
  {
    id: "note.indexed",
    base_rev: 1,
    patch: [{ op: "replace", path: "/summary", value: "after incremental update" }]
  },
  bootstrap
);
assert.equal(updateResult.warnings.length, 0);
assert.equal(queryService.search({ q: "after incremental", limit: 10 }, permissionService.resolveContext()).items.length, 1);
assert.equal(queryService.search({ q: "before incremental", limit: 10 }, permissionService.resolveContext()).items.length, 0);

const failingEventStore = new EventStore(config, { simulateCommitFailure: true });
const failingMutationService = new MutationService(objectStore, validationService, permissionService, failingEventStore, indexStore);
const failingNodeService = new NodeService(failingMutationService);
assert.throws(() =>
  failingNodeService.createNode(
    {
      object: nodeFixture({
        id: "note.repairable",
        title: "Repairable",
        slug: "repairable",
        type: "type.note",
        visibility: "public"
      })
    },
    bootstrap
  )
);

const report = adminService.getRecoveryReport(bootstrap);
assert.equal(report.failed.length, 1);
assert.equal(report.repairable_count, 1);

const repair = adminService.repairFailedMutations(bootstrap);
assert.equal(repair.repaired.length, 1);
assert.equal(adminService.getRecoveryReport(bootstrap).failed.length, 0);
assert.equal(eventStore.listObjectHistory("node", "note.repairable").length, 1);

console.log("Sprint F incremental index/admin job/recovery checks passed.");

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
