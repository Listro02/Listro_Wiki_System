import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadRuntimeConfig } from "../src/modules/config/runtime-config.ts";
import { ObjectStore } from "../src/modules/storage/object-store.ts";
import { PathResolver } from "../src/modules/storage/path-resolver.ts";
import { getStorageBootstrapPlan } from "../src/modules/storage/storage-doctor.ts";
import { ValidationService } from "../src/modules/validation/validation-service.ts";
import { LwsError } from "../src/shared/errors.ts";
import type { LwsEdge, LwsNode } from "../src/shared/object-model.ts";
import { ObjectService } from "../src/services/object-service.ts";
import { PermissionService } from "../src/services/permission-service.ts";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lws-sprint-b-"));
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
const objectService = new ObjectService(objectStore, permissionService);

const publicNode = nodeFixture({
  id: "svc.caddy",
  title: "Caddy",
  slug: "caddy",
  type: "type.service",
  visibility: "public"
});
const privateNode = nodeFixture({
  id: "app.lws",
  title: "L.W.S.",
  slug: "lws",
  type: "type.project",
  visibility: "private"
});

objectStore.writeObjectPrimitive(publicNode);
objectStore.writeObjectPrimitive(privateNode);

assert.equal(validationService.validateUnknownObject(publicNode).ok, true);
assert.equal(validationService.validateUnknownObject(privateNode).ok, true);
assert.equal(objectStore.readObject("svc.caddy").title, "Caddy");
assert.equal(objectStore.listSourceFiles("node").length, 2);

const anonymous = permissionService.resolveContext();
const publicRead = objectService.readObject("svc.caddy", anonymous);
assert.equal(publicRead.object.id, "svc.caddy");
assert.equal(publicRead.viewer_permissions.can_read, true);
assert.equal(publicRead.viewer_permissions.can_update, false);

assert.throws(() => objectService.readObject("app.lws", anonymous), (error) => {
  assert.equal(error instanceof LwsError, true);
  assert.equal((error as LwsError).code, "PERMISSION_DENIED");
  return true;
});

const bootstrapContext = permissionService.resolveContext({
  accountId: "account.admin",
  authSource: "local-script"
});
const privateRead = objectService.readObject("app.lws", bootstrapContext);
assert.equal(privateRead.object.id, "app.lws");
assert.equal(privateRead.viewer_permissions.can_update, true);

const invalidAccessNode = {
  ...publicNode,
  id: "note.invalid-access",
  access: { read: "public" }
};
const invalidAccessReport = validationService.validateUnknownObject(invalidAccessNode);
assert.equal(invalidAccessReport.ok, false);
assert.equal(invalidAccessReport.issues.some((issue) => issue.message.includes("permission edges")), true);

const publicEdgeToPrivateTarget = edgeFixture({
  id: "edge.01JBOUNDARY",
  source: "svc.caddy",
  target: "app.lws",
  type: "rel.depends_on",
  visibility: "public"
});
const boundaryReport = validationService.validateUnknownObject(publicEdgeToPrivateTarget);
assert.equal(boundaryReport.ok, false);
assert.equal(boundaryReport.issues.some((issue) => issue.code === "PUBLIC_BOUNDARY_VIOLATION"), true);

const privateEdge = edgeFixture({
  id: "edge.01JPRIVATE",
  source: "app.lws",
  target: "svc.caddy",
  type: "rel.depends_on",
  visibility: "private"
});
assert.equal(validationService.validateUnknownObject(privateEdge).ok, true);
objectStore.writeObjectPrimitive(privateEdge);
assert.equal(objectStore.readObject("edge.01JPRIVATE").object_kind, "edge");

const missingTargetEdge = edgeFixture({
  id: "edge.01JMISSING",
  source: "svc.caddy",
  target: "svc.missing",
  type: "rel.depends_on",
  visibility: "private"
});
const missingReport = validationService.validateUnknownObject(missingTargetEdge);
assert.equal(missingReport.ok, false);
assert.equal(missingReport.issues.some((issue) => issue.target === "target"), true);

console.log("Sprint B object schema/store/permission boundary checks passed.");

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
    target: "app.lws",
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
