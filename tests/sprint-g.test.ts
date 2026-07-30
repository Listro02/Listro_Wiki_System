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
import { CoreOntologyMaterializer } from "../src/modules/ontology/core-ontology-materializer.ts";
import { ObjectStore } from "../src/modules/storage/object-store.ts";
import { PathResolver } from "../src/modules/storage/path-resolver.ts";
import { getStorageBootstrapPlan } from "../src/modules/storage/storage-doctor.ts";
import { ValidationService } from "../src/modules/validation/validation-service.ts";
import { LwsError } from "../src/shared/errors.ts";
import type { LwsEdge, LwsNode } from "../src/shared/object-model.ts";
import { AdminService } from "../src/services/admin-service.ts";
import { EdgeService } from "../src/services/edge-service.ts";
import { JobService } from "../src/services/job-service.ts";
import { MutationService } from "../src/services/mutation-service.ts";
import { NodeService } from "../src/services/node-service.ts";
import { ObjectService } from "../src/services/object-service.ts";
import { PermissionService } from "../src/services/permission-service.ts";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lws-sprint-g-"));
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
const objectService = new ObjectService(objectStore, permissionService);
const jobService = new JobService(new JobStore(config));
const reindexCommand = new ReindexCommand(objectStore, validationService, indexStore);
const adminService = new AdminService({
  permissionService,
  jobService,
  reindexCommand,
  eventStore,
  validationJob: new StorageValidationJob(objectStore, validationService, indexStore),
  publicBoundaryChecker: new PublicBoundaryChecker(objectStore, validationService),
  coreOntologyMaterializer: new CoreOntologyMaterializer(objectStore, mutationService),
  backupWriter: new BackupWriter(config)
});

const adminRequest = new Request("http://lws.local/api/lws/admin/reindex", {
  headers: {
    "x-lws-auth-source": "local-script",
    "x-lws-local-admin-secret": config.auth.sessionSecret,
    "x-lws-request-id": "test.sprint-g"
  }
});
const adminResolution = resolveHttpRequestContext(adminRequest, config, permissionService);
assert.equal(adminResolution.reason, "local-admin");
assert.equal(adminResolution.context.accountId, "account.admin");
assert.equal(adminResolution.context.authSource, "local-script");

const badResolution = resolveHttpRequestContext(
  new Request("http://lws.local/api/lws/admin/reindex", {
    headers: {
      "x-lws-auth-source": "local-script",
      "x-lws-local-admin-secret": "wrong"
    }
  }),
  config,
  permissionService
);
assert.equal(badResolution.context.isAnonymous, true);
assert.throws(() => adminService.backup(badResolution.context), (error) => {
  assert.equal(error instanceof LwsError, true);
  assert.equal((error as LwsError).code, "PERMISSION_DENIED");
  return true;
});

const untrustedSession = resolveHttpRequestContext(
  new Request("http://lws.local/api/lws/session", {
    headers: {
      "x-lws-auth-source": "session",
      "x-lws-account-id": "account.taewo"
    }
  }),
  config,
  permissionService
);
assert.equal(untrustedSession.reason, "untrusted-session");
assert.equal(untrustedSession.context.isAnonymous, true);

const bootstrap = adminResolution.context;
const ontologyJob = adminService.materializeCoreOntology(bootstrap);
assert.equal(ontologyJob.status, "succeeded");
assert.ok((ontologyJob.result?.created_nodes.length ?? 0) > 0);
assert.equal(objectStore.nodeExists("type.relation-type"), true);

const reindexJob = adminService.reindex(bootstrap);
assert.equal(reindexJob.status, "succeeded");
assert.equal(indexStore.getStatus().state, "ready");

nodeService.createNode(
  {
    object: nodeFixture({
      id: "account.taewo",
      title: "taewo",
      slug: "taewo",
      type: "type.account"
    }),
    target_scope: "scope.system"
  },
  bootstrap
);
nodeService.createNode(
  {
    object: nodeFixture({
      id: "note.incremental-permission",
      title: "Incremental Permission",
      slug: "incremental-permission",
      type: "type.note",
      summary: "private until permission edge exists"
    })
  },
  bootstrap
);
edgeService.createEdge(
  {
    object: edgeFixture({
      id: "edge.01JINCREMENTALREAD",
      source: "account.taewo",
      target: "note.incremental-permission",
      type: "rel.can_read",
      title: "taewo can read incremental permission note"
    })
  },
  bootstrap
);

const taewo = permissionService.resolveContext({
  accountId: "account.taewo",
  authSource: "session"
});
assert.equal(objectService.readObject("note.incremental-permission", taewo).object.id, "note.incremental-permission");

const validationJob = adminService.validate(bootstrap);
assert.equal(validationJob.status, "succeeded");
assert.equal(validationJob.result?.issue_count, 0);
assert.equal(validationJob.result?.projection_status, "updated");

const publicBoundaryJob = adminService.checkPublicBoundary(bootstrap);
assert.equal(publicBoundaryJob.status, "succeeded");
assert.equal(publicBoundaryJob.result?.ok, true);

const backupJob = adminService.backup(bootstrap);
assert.equal(backupJob.status, "succeeded");
assert.ok(backupJob.result?.backup_path);
assert.equal(fs.existsSync(backupJob.result?.manifest_path ?? ""), true);

console.log("Sprint G auth/admin jobs/backup/incremental permission projection checks passed.");

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
    target: "note.incremental-permission",
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
