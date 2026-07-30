import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadRuntimeConfig, type RuntimeConfig } from "../src/modules/config/runtime-config.ts";
import { EventStore, type EventStoreOptions } from "../src/modules/events/event-store.ts";
import { objectIdToSafeFilename, objectIdToSafeSegment } from "../src/modules/storage/path-resolver.ts";
import { ObjectStore } from "../src/modules/storage/object-store.ts";
import { PathResolver } from "../src/modules/storage/path-resolver.ts";
import { checkStorage, getStorageBootstrapPlan } from "../src/modules/storage/storage-doctor.ts";
import { ValidationService } from "../src/modules/validation/validation-service.ts";
import { LwsError, type LwsErrorCode } from "../src/shared/errors.ts";
import type { LwsNode } from "../src/shared/object-model.ts";
import { HistoryService } from "../src/services/history-service.ts";
import { AdminService } from "../src/services/admin-service.ts";
import { MutationService } from "../src/services/mutation-service.ts";
import { MutationRecoveryService } from "../src/services/mutation-recovery-service.ts";
import { NodeService } from "../src/services/node-service.ts";
import { PermissionService } from "../src/services/permission-service.ts";

const failureSteps: Array<NonNullable<EventStoreOptions["failCommitStep"]>> = [
  "patch_write",
  "global_event_append",
  "history_append",
  "head_write"
];

for (const step of failureSteps) {
  const fixture = createMutationFixture(`fail-${step}`);
  assertLwsError(
    () =>
      fixture.failingNodeService.createNode(
        {
          object: nodeFixture({
            id: `note.${step.replaceAll("_", "-")}`,
            title: `Failure ${step}`,
            slug: `failure-${step.replaceAll("_", "-")}`,
            type: "type.note",
            visibility: "public"
          })
        },
        fixture.bootstrap
      ),
    "EVENT_APPEND_FAILED"
  );

  const failedJournal = fixture.failingEventStore.listIncompleteMutations()[0];
  assert.equal(failedJournal.status, "failed");
  assert.equal(failedJournal.steps?.object_written?.status, "completed");
  assert.equal(failedJournal.steps?.[stepToJournalStep(step)]?.status, "failed");
}

for (const step of failureSteps) {
  const fixture = createMutationFixture(`repair-${step}`);
  const objectId = `note.repair-${step.replaceAll("_", "-")}`;
  assertLwsError(
    () =>
      fixture.failingNodeService.createNode(
        {
          object: nodeFixture({
            id: objectId,
            title: `Repair ${step}`,
            slug: `repair-${step.replaceAll("_", "-")}`,
            type: "type.note",
            visibility: "public"
          })
        },
        fixture.bootstrap
      ),
    "EVENT_APPEND_FAILED"
  );

  const eventId = fixture.failingEventStore.listIncompleteMutations()[0].event_id;
  const report = fixture.adminService.getRecoveryReport(fixture.bootstrap);
  assert.equal(report.recovery_items[0].repairable, true);
  assert.equal(report.mutation_consistency_issues.some((issue) => issue.code === "EVENT_APPEND_FAILED"), true);

  const repair = fixture.adminService.repairFailedMutations(fixture.bootstrap);
  assert.deepEqual(repair.manual_repair_required, []);
  assert.deepEqual(repair.repaired, [eventId]);

  const countsAfterFirstRepair = countMutationRecords(fixture.config, objectId, eventId);
  assert.equal(countsAfterFirstRepair.globalEvents, 1);
  assert.equal(countsAfterFirstRepair.objectHistory, 1);
  assert.equal(countsAfterFirstRepair.patchExists, true);
  assert.equal(fixture.eventStore.listIncompleteMutations().length, 0);

  const secondRepair = fixture.adminService.repairFailedMutations(fixture.bootstrap);
  assert.deepEqual(secondRepair.repaired, []);
  assert.deepEqual(secondRepair.manual_repair_required, []);
  assert.deepEqual(countMutationRecords(fixture.config, objectId, eventId), countsAfterFirstRepair);
}

const objectHashMismatchFixture = createMutationFixture("repair-head_write");
assertLwsError(
  () =>
    objectHashMismatchFixture.failingNodeService.createNode(
      {
        object: nodeFixture({
          id: "note.repair-hash-mismatch",
          title: "Repair Hash Mismatch",
          slug: "repair-hash-mismatch",
          type: "type.note",
          visibility: "public"
        })
      },
      objectHashMismatchFixture.bootstrap
    ),
  "EVENT_APPEND_FAILED"
);
const mismatchObjectPath = path.join(
  objectHashMismatchFixture.config.roots.knowledge,
  "nodes",
  objectIdToSafeFilename("note.repair-hash-mismatch")
);
const mismatchObject = JSON.parse(fs.readFileSync(mismatchObjectPath, "utf8"));
fs.writeFileSync(mismatchObjectPath, `${JSON.stringify({ ...mismatchObject, title: "Changed Outside Recovery" }, null, 2)}\n`, "utf8");
const hashMismatchReport = objectHashMismatchFixture.recoveryService.getRecoveryReport();
assert.equal(hashMismatchReport.recovery_items[0].repairable, false);
assert.equal(hashMismatchReport.recovery_items[0].manual_repair_reason, "OBJECT_HASH_MISMATCH");
assert.deepEqual(objectHashMismatchFixture.recoveryService.repairAllMutations().repaired, []);

const objectMissingFixture = createMutationFixture("repair-head_write");
assertLwsError(
  () =>
    objectMissingFixture.failingNodeService.createNode(
      {
        object: nodeFixture({
          id: "note.repair-object-missing",
          title: "Repair Object Missing",
          slug: "repair-object-missing",
          type: "type.note",
          visibility: "public"
        })
      },
      objectMissingFixture.bootstrap
    ),
  "EVENT_APPEND_FAILED"
);
fs.unlinkSync(path.join(objectMissingFixture.config.roots.knowledge, "nodes", objectIdToSafeFilename("note.repair-object-missing")));
const objectMissingReport = objectMissingFixture.recoveryService.getRecoveryReport();
assert.equal(objectMissingReport.recovery_items[0].repairable, false);
assert.equal(objectMissingReport.recovery_items[0].manual_repair_reason, "OBJECT_MISSING");

const conflictFixture = createMutationFixture("repair-head_write");
assertLwsError(
  () =>
    conflictFixture.failingNodeService.createNode(
      {
        object: nodeFixture({
          id: "note.repair-conflict",
          title: "Repair Conflict",
          slug: "repair-conflict",
          type: "type.note",
          visibility: "public"
        })
      },
      conflictFixture.bootstrap
    ),
  "EVENT_APPEND_FAILED"
);
const conflictEventId = conflictFixture.failingEventStore.listIncompleteMutations()[0].event_id;
const conflictPatchPath = patchRecordPath(conflictFixture.config, "node", "note.repair-conflict", conflictEventId);
const conflictPatchRecord = JSON.parse(fs.readFileSync(conflictPatchPath, "utf8"));
fs.writeFileSync(conflictPatchPath, `${JSON.stringify({ ...conflictPatchRecord, object_id: "note.other" }, null, 2)}\n`, "utf8");
const conflictRepair = conflictFixture.recoveryService.repairAllMutations();
assert.deepEqual(conflictRepair.repaired, []);
assert.deepEqual(conflictRepair.manual_repair_required, [conflictEventId]);
assert.equal(conflictRepair.recovery_items[0].manual_repair_reason, "COMMIT_STEP_CONFLICT");

const missingHeadFixture = createMutationFixture("missing-head");
const missingHeadResult = missingHeadFixture.nodeService.createNode(
  {
    object: nodeFixture({
      id: "note.missing-head",
      title: "Missing Head",
      slug: "missing-head",
      type: "type.note"
    })
  },
  missingHeadFixture.bootstrap
);
fs.unlinkSync(headPath(missingHeadFixture.config, "node", "note.missing-head"));
assert.equal(
  checkStorage(missingHeadFixture.config).issues.some((issue) => issue.code === "MUTATION_HEAD_MISSING"),
  true
);

const hashMismatchFixture = createMutationFixture("hash-mismatch");
hashMismatchFixture.nodeService.createNode(
  {
    object: nodeFixture({
      id: "note.hash-mismatch",
      title: "Hash Mismatch",
      slug: "hash-mismatch",
      type: "type.note"
    })
  },
  hashMismatchFixture.bootstrap
);
const hashHeadPath = headPath(hashMismatchFixture.config, "node", "note.hash-mismatch");
const hashHead = JSON.parse(fs.readFileSync(hashHeadPath, "utf8"));
fs.writeFileSync(hashHeadPath, `${JSON.stringify({ ...hashHead, latest_hash: "sha256.not-current" }, null, 2)}\n`, "utf8");
assert.equal(
  checkStorage(hashMismatchFixture.config).issues.some((issue) => issue.code === "MUTATION_HASH_MISMATCH"),
  true
);

const revMismatchFixture = createMutationFixture("rev-mismatch");
revMismatchFixture.nodeService.createNode(
  {
    object: nodeFixture({
      id: "note.rev-mismatch",
      title: "Rev Mismatch",
      slug: "rev-mismatch",
      type: "type.note"
    })
  },
  revMismatchFixture.bootstrap
);
const revHeadPath = headPath(revMismatchFixture.config, "node", "note.rev-mismatch");
const revHead = JSON.parse(fs.readFileSync(revHeadPath, "utf8"));
fs.writeFileSync(revHeadPath, `${JSON.stringify({ ...revHead, current_rev: 99 }, null, 2)}\n`, "utf8");
assert.equal(
  checkStorage(revMismatchFixture.config).issues.some((issue) => issue.code === "MUTATION_REV_MISMATCH"),
  true
);

const restoreFixture = createMutationFixture("restore-validation");
restoreFixture.nodeService.createNode(
  {
    object: nodeFixture({
      id: "note.restore-source",
      title: "Restore Source",
      slug: "restore-source",
      type: "type.note",
      visibility: "private"
    })
  },
  restoreFixture.bootstrap
);
const deleteResult = restoreFixture.nodeService.deleteNode(
  {
    id: "note.restore-source",
    base_rev: 1
  },
  restoreFixture.bootstrap
);
const patchPath = patchRecordPath(restoreFixture.config, "node", "note.restore-source", deleteResult.event_id);
const patchRecord = JSON.parse(fs.readFileSync(patchPath, "utf8"));
fs.writeFileSync(patchPath, `${JSON.stringify({ ...patchRecord, object_id: "note.other" }, null, 2)}\n`, "utf8");
assertLwsError(
  () =>
    restoreFixture.mutationService.restoreObject(
      {
        id: "note.restore-source",
        base_rev: 2,
        source_event_id: deleteResult.event_id,
        mode: "inverse_patch"
      },
      restoreFixture.bootstrap
    ),
  "RESTORE_SOURCE_INVALID"
);

fs.writeFileSync(
  patchPath,
  `${JSON.stringify(
    {
      ...patchRecord,
      inverse_patch: [{ op: "replace", path: "/audit/updated_at", value: "invalid" }]
    },
    null,
    2
  )}\n`,
  "utf8"
);
assertLwsError(
  () =>
    restoreFixture.mutationService.restoreObject(
      {
        id: "note.restore-source",
        base_rev: 2,
        source_event_id: deleteResult.event_id,
        mode: "inverse_patch"
      },
      restoreFixture.bootstrap
    ),
  "RESTORE_SOURCE_INVALID"
);

assert.equal(missingHeadResult.event_id.startsWith("event."), true);

console.log("Milestone M2 durable mutation/idempotent recovery checks passed.");

function createMutationFixture(label: string) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `lws-m2-${label}-`));
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
  const permissionService = new PermissionService({
    adminBootstrapAccount: config.auth.adminBootstrapAccount
  });
  const eventStore = new EventStore(new PathResolver(config));
  const recoveryService = new MutationRecoveryService(objectStore, eventStore, config);
  const adminService = new AdminService({
    permissionService,
    eventStore,
    mutationRecoveryService: recoveryService
  });
  const mutationService = new MutationService(objectStore, validationService, permissionService, eventStore);
  const nodeService = new NodeService(mutationService);
  const failingEventStore = new EventStore(new PathResolver(config), {
    failCommitStep: label.startsWith("fail-")
      ? (label.slice("fail-".length) as NonNullable<EventStoreOptions["failCommitStep"]>)
      : label.startsWith("repair-")
        ? (label.slice("repair-".length) as NonNullable<EventStoreOptions["failCommitStep"]>)
        : undefined
  });
  const failingMutationService = new MutationService(objectStore, validationService, permissionService, failingEventStore);
  const failingNodeService = new NodeService(failingMutationService);
  const historyService = new HistoryService(objectStore, eventStore, permissionService);
  const bootstrap = permissionService.resolveContext({
    accountId: "account.admin",
    authSource: "local-script"
  });

  return {
    config,
    eventStore,
    recoveryService,
    adminService,
    failingEventStore,
    mutationService,
    nodeService,
    failingNodeService,
    historyService,
    bootstrap
  };
}

function countMutationRecords(config: RuntimeConfig, objectId: string, eventId: string) {
  const eventStore = new EventStore(new PathResolver(config));
  return {
    globalEvents: countEventIdInDirectory(path.join(config.roots.data, "events"), eventId),
    objectHistory: eventStore.listObjectHistory("node", objectId).filter((item) => item.event_id === eventId).length,
    patchExists: fs.existsSync(patchRecordPath(config, "node", objectId, eventId))
  };
}

function countEventIdInDirectory(directory: string, eventId: string): number {
  if (!fs.existsSync(directory)) {
    return 0;
  }

  let count = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      count += countEventIdInDirectory(absolutePath, eventId);
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      count += fs
        .readFileSync(absolutePath, "utf8")
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as { event_id?: string })
        .filter((event) => event.event_id === eventId).length;
    }
  }

  return count;
}

function headPath(config: RuntimeConfig, kind: "node" | "edge", objectId: string): string {
  return path.join(config.roots.data, "history", `${kind}s`, objectIdToSafeSegment(objectId), "head.json");
}

function patchRecordPath(config: RuntimeConfig, kind: "node" | "edge", objectId: string, eventId: string): string {
  return path.join(config.roots.data, "history", `${kind}s`, objectIdToSafeSegment(objectId), "patches", `${eventId}.json`);
}

function stepToJournalStep(step: NonNullable<EventStoreOptions["failCommitStep"]>) {
  return (
    {
      patch_write: "patch_written",
      global_event_append: "global_event_appended",
      history_append: "history_appended",
      head_write: "head_written"
    } as const
  )[step];
}

function assertLwsError(fn: () => unknown, code: LwsErrorCode): void {
  assert.throws(fn, (error) => {
    assert.equal(error instanceof LwsError, true);
    assert.equal((error as LwsError).code, code);
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
