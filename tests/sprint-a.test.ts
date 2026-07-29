import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadRuntimeConfig } from "../src/modules/config/runtime-config.ts";
import { PathResolver, objectIdToSafeFilename } from "../src/modules/storage/path-resolver.ts";
import { checkStorage, getStorageBootstrapPlan } from "../src/modules/storage/storage-doctor.ts";
import { LwsError } from "../src/shared/errors.ts";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lws-sprint-a-"));
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

assert.equal(config.publicConfig.appName, "Listro Wiki System");
assert.equal(Object.values(config.publicConfig).some((value) => String(value).includes(storageRoot)), false);
assert.equal(config.features.defaultVisibility, "private");

const resolver = new PathResolver(config);
const safeFilename = objectIdToSafeFilename("svc.caddy");
assert.notEqual(safeFilename, "svc.caddy.json");
assert.match(safeFilename, /^[A-Za-z0-9_-]+\.json$/);

const nodePath = resolver.resolveNodePath("svc.caddy");
assert.equal(nodePath.relativePath, path.join("nodes", safeFilename));
assert.equal(nodePath.absolutePath.startsWith(config.roots.knowledge), true);

for (const badId of ["../svc.caddy", "svc/caddy", "C:\\svc.caddy", "\\\\server\\share", "svc caddy"]) {
  assert.throws(() => resolver.resolveNodePath(badId), LwsError);
}

assert.throws(() => resolver.assertInsideRoot(config.roots.knowledge, path.join(tempRoot, "outside.json")), LwsError);

const missingReport = checkStorage(config);
assert.equal(missingReport.status, "error");
assert.equal(missingReport.issues.some((issue) => issue.code === "STORAGE_ROOT_MISSING"), true);

for (const directory of getStorageBootstrapPlan(config)) {
  fs.mkdirSync(directory, { recursive: true });
}

const readyReport = checkStorage(config);
assert.equal(readyReport.roots.every((root) => root.exists && root.readable && root.writable), true);
assert.equal(readyReport.index.state, "INDEX_REBUILD_REQUIRED");

assert.throws(
  () =>
    loadRuntimeConfig(
      {
        ...env,
        LWS_SQLITE_PATH: path.join(tempRoot, "outside.sqlite")
      },
      appRoot
    ),
  LwsError
);

assert.throws(
  () =>
    loadRuntimeConfig(
      {
        ...env,
        LWS_ENV: "production",
        LWS_SESSION_SECRET: "change-me"
      },
      appRoot
    ),
  LwsError
);

console.log("Sprint A runtime/config/path safety checks passed.");
