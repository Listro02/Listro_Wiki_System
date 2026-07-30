import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PublicBoundaryChecker } from "../src/modules/admin/public-boundary-checker.ts";
import { StorageValidationJob } from "../src/modules/admin/storage-validation-job.ts";
import { resolveHttpRequestContext } from "../src/modules/auth/request-context-adapter.ts";
import { BackupWriter } from "../src/modules/backup/backup-writer.ts";
import { loadRuntimeConfig } from "../src/modules/config/runtime-config.ts";
import { EventStore } from "../src/modules/events/event-store.ts";
import { IndexStore } from "../src/modules/indexing/index-store.ts";
import { ReindexCommand } from "../src/modules/indexing/reindex-command.ts";
import { JobStore } from "../src/modules/jobs/job-store.ts";
import { ObjectStore } from "../src/modules/storage/object-store.ts";
import { PathResolver } from "../src/modules/storage/path-resolver.ts";
import { getStorageBootstrapPlan } from "../src/modules/storage/storage-doctor.ts";
import { ValidationService } from "../src/modules/validation/validation-service.ts";
import { LwsError } from "../src/shared/errors.ts";
import type { LwsEdge, LwsNode } from "../src/shared/object-model.ts";
import { AdminService } from "../src/services/admin-service.ts";
import { JobService } from "../src/services/job-service.ts";
import { MutationService } from "../src/services/mutation-service.ts";
import { NodeService } from "../src/services/node-service.ts";
import { PermissionService } from "../src/services/permission-service.ts";

const fixture = createFixture("admin-jobs");
fixture.objectStore.writeObjectPrimitive(nodeFixture({ id: "note.public", title: "Public", slug: "public", visibility: "public" }));
fixture.objectStore.writeObjectPrimitive(nodeFixture({ id: "note.private", title: "Private", slug: "private" }));
fixture.objectStore.writeObjectPrimitive(
  edgeFixture({
    id: "edge.m5.public-leak",
    source: "note.public",
    target: "note.private",
    type: "rel.references",
    visibility: "public",
    title: "Public edge leaks private target"
  })
);

const firstReindex = fixture.adminService.reindex(fixture.bootstrap, { client_job_id: "m5.reindex.once" });
const secondReindex = fixture.adminService.reindex(fixture.bootstrap, { client_job_id: "m5.reindex.once" });
assert.equal(firstReindex.job_id, secondReindex.job_id);
assert.equal(firstReindex.status, "succeeded");
const reindexAuditActions = firstReindex.audit.map((event) => event.action);
assert.equal(reindexAuditActions[0], "created");
assert.equal(reindexAuditActions[1], "running");
assert.equal(reindexAuditActions.includes("progress"), true);
assert.equal(reindexAuditActions.at(-1), "succeeded");
const persistedReindex = fixture.jobService.getJob(firstReindex.job_id);
assert.equal(persistedReindex.progress.message, "Succeeded");
assert.equal(persistedReindex.progress.phase, "permissions");
assert.equal(fixture.jobService.listAuditEvents().some((event) => event.job_id === firstReindex.job_id && event.action === "succeeded"), true);
const sameClientDifferentType = fixture.adminService.backup(fixture.bootstrap, { client_job_id: "m5.reindex.once" });
assert.notEqual(sameClientDifferentType.job_id, firstReindex.job_id);
assert.equal(sameClientDifferentType.type, "backup");

const failed = fixture.jobService.runSync(
  "fail-fixture",
  () => {
    throw new LwsError("CONFIG_INVALID", "M5 deterministic failed job.");
  },
  {
    clientJobId: "m5.fail.once",
    actor: {
      account_id: fixture.bootstrap.accountId,
      auth_source: fixture.bootstrap.authSource,
      request_id: fixture.bootstrap.requestId
    }
  }
);
assert.equal(failed.status, "failed");
assert.equal(failed.error?.code, "CONFIG_INVALID");
assert.equal(failed.audit.some((event) => event.action === "failed"), true);

const canceled = fixture.jobService.runSync(
  "cancel-fixture",
  (job, run) => {
    fixture.jobService.cancelJob(job.job_id);
    run.checkCanceled();
    return { unreachable: true };
  },
  {
    clientJobId: "m5.cancel.once",
    actor: {
      account_id: fixture.bootstrap.accountId,
      auth_source: fixture.bootstrap.authSource,
      request_id: fixture.bootstrap.requestId
    }
  }
);
assert.equal(canceled.status, "canceled");
assert.equal(fixture.jobService.getJob(canceled.job_id).status, "canceled");
assert.equal(canceled.audit.some((event) => event.action === "canceled"), true);

const failingEventStore = new EventStore(new PathResolver(fixture.config), { simulateCommitFailure: true });
const failingMutationService = new MutationService(
  fixture.objectStore,
  fixture.validationService,
  fixture.permissionService,
  failingEventStore,
  fixture.indexStore
);
const failingNodeService = new NodeService(failingMutationService);
assert.throws(() =>
  failingNodeService.createNode(
    {
      object: nodeFixture({
        id: "note.failed-mutation",
        title: "Failed Mutation",
        slug: "failed-mutation",
        visibility: "public"
      })
    },
    fixture.bootstrap
  )
);

const validationJob = fixture.adminService.validate(fixture.bootstrap, { client_job_id: "m5.validate.once" });
assert.equal(validationJob.status, "succeeded");
assert.equal((validationJob.result?.public_boundary_violation_count ?? 0) > 0, true);
assert.equal(
  validationJob.result?.mutation_consistency_issues.some((issue) => issue.code === "EVENT_APPEND_FAILED"),
  true
);
assert.equal(validationJob.progress.scanned_count === validationJob.result?.scanned_count, true);
assert.equal(validationJob.progress.warning_count, validationJob.result?.issue_count);
assert.equal(validationJob.progress.phase, "projection");
assert.equal(validationJob.progress.message, "Succeeded");

assert.throws(
  () => new BackupWriter(fixture.config).writeSnapshot({ backupId: "../escape" }),
  (error) => {
    assert.equal(error instanceof LwsError, true);
    assert.equal((error as LwsError).code, "PATH_OUTSIDE_ROOT");
    return true;
  }
);

const backupJob = fixture.adminService.backup(fixture.bootstrap, { client_job_id: "m5.backup.once" });
assert.equal(backupJob.status, "succeeded");
assert.equal(backupJob.progress.phase, "manifest");
assert.equal(backupJob.progress.message, "Succeeded");
assert.equal(path.relative(fixture.config.roots.backup, backupJob.result?.backup_path ?? "").startsWith(".."), false);
assert.equal(path.isAbsolute(path.relative(fixture.config.roots.backup, backupJob.result?.backup_path ?? "")), false);
const manifest = JSON.parse(fs.readFileSync(backupJob.result?.manifest_path ?? "", "utf8"));
assert.equal(manifest.source_roots.knowledge, "<redacted>");
assert.equal(manifest.source_roots.data, "<redacted>");
assert.equal(fs.existsSync(path.join(backupJob.result?.backup_path ?? "", "knowledge")), true);
assert.equal(fs.existsSync(path.join(backupJob.result?.backup_path ?? "", "data")), true);

fs.mkdirSync(path.dirname(fixture.config.index.sqlitePath), { recursive: true });
fs.writeFileSync(fixture.config.index.sqlitePath, "not a sqlite database", "utf8");
assert.equal(fixture.indexStore.getStatus().state, "INDEX_CORRUPT");
const recoveredReindex = fixture.adminService.reindex(fixture.bootstrap, { client_job_id: "m5.reindex.corrupt" });
assert.equal(recoveredReindex.status, "succeeded");
assert.equal(fixture.indexStore.getStatus().state, "ready");
assert.equal(fixture.adminService.getRecoveryReport(fixture.bootstrap).index?.recovery_action, "none");

const spoofed = resolveHttpRequestContext(
  new Request("http://lws.local/api/lws/admin/reindex", {
    headers: {
      "x-lws-auth-source": "session",
      "x-lws-account-id": "account.admin"
    }
  }),
  fixture.config,
  fixture.permissionService
);
assert.equal(spoofed.reason, "untrusted-session");
assertPermissionDenied(() => fixture.adminService.reindex(spoofed.context));
assertPermissionDenied(() => fixture.adminService.listJobs(spoofed.context));
assertPermissionDenied(() => fixture.adminService.getJob(spoofed.context, firstReindex.job_id));
assertPermissionDenied(() => fixture.adminService.cancelJob(spoofed.context, firstReindex.job_id));
const anonymous = fixture.permissionService.resolveContext();
assertPermissionDenied(() => fixture.adminService.reindex(anonymous));
assertPermissionDenied(() => fixture.adminService.listJobs(anonymous));
assertPermissionDenied(() => fixture.adminService.getJob(anonymous, firstReindex.job_id));
assertPermissionDenied(() => fixture.adminService.cancelJob(anonymous, firstReindex.job_id));

console.log("Milestone M5 admin jobs and operational recovery checks passed.");

function createFixture(label: string) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `lws-m5-${label}-`));
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
  const jobService = new JobService(new JobStore(config));
  const reindexCommand = new ReindexCommand(objectStore, validationService, indexStore);
  const adminService = new AdminService({
    permissionService,
    jobService,
    reindexCommand,
    eventStore,
    validationJob: new StorageValidationJob(objectStore, validationService, indexStore, config),
    publicBoundaryChecker: new PublicBoundaryChecker(objectStore, validationService),
    backupWriter: new BackupWriter(config),
    indexStore
  });
  const bootstrap = permissionService.resolveContext({
    accountId: "account.admin",
    authSource: "local-script",
    requestId: `m5.${label}`
  });

  return {
    config,
    objectStore,
    validationService,
    indexStore,
    permissionService,
    eventStore,
    jobService,
    adminService,
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
    source: "note.public",
    target: "note.private",
    type: "rel.references",
    title: "Reference",
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
