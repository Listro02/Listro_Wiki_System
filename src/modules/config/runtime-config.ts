import path from "node:path";

import { LwsError } from "../../shared/errors.ts";

export type LwsEnv = "development" | "production" | "test";
export type AuthMode = "local";
export type IndexMode = "sqlite";
export type DefaultVisibility = "private" | "public";

export type RuntimeConfig = {
  appName: string;
  env: LwsEnv;
  appRoot: string;
  server: {
    host: string;
    port: number;
  };
  roots: {
    knowledge: string;
    data: string;
    runtime: string;
    log: string;
    backup: string;
  };
  auth: {
    mode: AuthMode;
    sessionSecret: string;
    adminBootstrapAccount: string;
  };
  features: {
    defaultVisibility: DefaultVisibility;
    publicGraphEnabled: boolean;
    allowStorageInit: boolean;
    allowSampleData: boolean;
  };
  index: {
    mode: IndexMode;
    sqliteEnabled: boolean;
    sqlitePath: string;
  };
  autosaveIntervalMs: number;
  publicConfig: PublicConfig;
};

export type PublicConfig = {
  appName: string;
  env: LwsEnv;
  defaultVisibility: DefaultVisibility;
  publicGraphEnabled: boolean;
  autosaveIntervalMs: number;
  indexMode: IndexMode;
  sqliteEnabled: boolean;
};

type EnvSource = Record<string, string | undefined>;

const REQUIRED_ENV_KEYS = [
  "LWS_APP_NAME",
  "LWS_ENV",
  "LWS_HOST",
  "LWS_PORT",
  "LWS_KNOWLEDGE_ROOT",
  "LWS_DATA_ROOT",
  "LWS_RUNTIME_ROOT",
  "LWS_LOG_ROOT",
  "LWS_BACKUP_ROOT",
  "LWS_AUTH_MODE",
  "LWS_SESSION_SECRET",
  "LWS_ADMIN_BOOTSTRAP_ACCOUNT",
  "LWS_DEFAULT_VISIBILITY",
  "LWS_PUBLIC_GRAPH_ENABLED",
  "LWS_ALLOW_STORAGE_INIT",
  "LWS_ALLOW_SAMPLE_DATA",
  "LWS_INDEX_MODE",
  "LWS_SQLITE_ENABLED",
  "LWS_SQLITE_PATH",
  "LWS_AUTOSAVE_INTERVAL_MS"
] as const;

export function loadRuntimeConfig(env: EnvSource = process.env, appRoot = /*turbopackIgnore: true*/ process.cwd()): RuntimeConfig {
  const normalizedAppRoot = normalizeAbsolutePath(appRoot);
  const missing = REQUIRED_ENV_KEYS.filter((key) => !nonEmpty(env[key]));

  if (missing.length > 0) {
    throw new LwsError("CONFIG_INVALID", "Required L.W.S. environment variables are missing.", {
      missing
    });
  }

  const lwsEnv = parseEnum<LwsEnv>(env.LWS_ENV, ["development", "production", "test"], "LWS_ENV");
  const authMode = parseEnum<AuthMode>(env.LWS_AUTH_MODE, ["local"], "LWS_AUTH_MODE");
  const defaultVisibility = parseEnum<DefaultVisibility>(
    env.LWS_DEFAULT_VISIBILITY,
    ["private", "public"],
    "LWS_DEFAULT_VISIBILITY"
  );
  const indexMode = parseEnum<IndexMode>(env.LWS_INDEX_MODE, ["sqlite"], "LWS_INDEX_MODE");
  const publicGraphEnabled = parseBoolean(env.LWS_PUBLIC_GRAPH_ENABLED, "LWS_PUBLIC_GRAPH_ENABLED");
  const sqliteEnabled = parseBoolean(env.LWS_SQLITE_ENABLED, "LWS_SQLITE_ENABLED");

  const roots = {
    knowledge: resolveConfiguredRoot(env.LWS_KNOWLEDGE_ROOT, normalizedAppRoot, "LWS_KNOWLEDGE_ROOT"),
    data: resolveConfiguredRoot(env.LWS_DATA_ROOT, normalizedAppRoot, "LWS_DATA_ROOT"),
    runtime: resolveConfiguredRoot(env.LWS_RUNTIME_ROOT, normalizedAppRoot, "LWS_RUNTIME_ROOT"),
    log: resolveConfiguredRoot(env.LWS_LOG_ROOT, normalizedAppRoot, "LWS_LOG_ROOT"),
    backup: resolveConfiguredRoot(env.LWS_BACKUP_ROOT, normalizedAppRoot, "LWS_BACKUP_ROOT")
  };

  for (const [name, root] of Object.entries(roots)) {
    assertNotInsideAppRoot(root, normalizedAppRoot, name, lwsEnv);
  }

  const sqlitePath = resolveConfiguredRoot(env.LWS_SQLITE_PATH, normalizedAppRoot, "LWS_SQLITE_PATH");
  if (sqliteEnabled) {
    assertPathInsideRoot(roots.data, sqlitePath, "LWS_SQLITE_PATH must be inside LWS_DATA_ROOT.");
  }

  if (lwsEnv === "production" && env.LWS_SESSION_SECRET === "change-me") {
    throw new LwsError("CONFIG_INVALID", "Production LWS_SESSION_SECRET must not use the development placeholder.");
  }

  if (publicGraphEnabled) {
    throw new LwsError(
      "CONFIG_INVALID",
      "LWS_PUBLIC_GRAPH_ENABLED cannot be true until public boundary validation is implemented."
    );
  }

  const port = parsePositiveInteger(env.LWS_PORT, "LWS_PORT");
  const autosaveIntervalMs = parsePositiveInteger(env.LWS_AUTOSAVE_INTERVAL_MS, "LWS_AUTOSAVE_INTERVAL_MS");

  const config: Omit<RuntimeConfig, "publicConfig"> = {
    appName: required(env.LWS_APP_NAME, "LWS_APP_NAME"),
    env: lwsEnv,
    appRoot: normalizedAppRoot,
    server: {
      host: required(env.LWS_HOST, "LWS_HOST"),
      port
    },
    roots,
    auth: {
      mode: authMode,
      sessionSecret: required(env.LWS_SESSION_SECRET, "LWS_SESSION_SECRET"),
      adminBootstrapAccount: required(env.LWS_ADMIN_BOOTSTRAP_ACCOUNT, "LWS_ADMIN_BOOTSTRAP_ACCOUNT")
    },
    features: {
      defaultVisibility,
      publicGraphEnabled,
      allowStorageInit: parseBoolean(env.LWS_ALLOW_STORAGE_INIT, "LWS_ALLOW_STORAGE_INIT"),
      allowSampleData: parseBoolean(env.LWS_ALLOW_SAMPLE_DATA, "LWS_ALLOW_SAMPLE_DATA")
    },
    index: {
      mode: indexMode,
      sqliteEnabled,
      sqlitePath
    },
    autosaveIntervalMs
  };

  return {
    ...config,
    publicConfig: toPublicConfig(config)
  };
}

function toPublicConfig(config: Omit<RuntimeConfig, "publicConfig">): PublicConfig {
  return {
    appName: config.appName,
    env: config.env,
    defaultVisibility: config.features.defaultVisibility,
    publicGraphEnabled: config.features.publicGraphEnabled,
    autosaveIntervalMs: config.autosaveIntervalMs,
    indexMode: config.index.mode,
    sqliteEnabled: config.index.sqliteEnabled
  };
}

function required(value: string | undefined, key: string): string {
  if (!nonEmpty(value)) {
    throw new LwsError("CONFIG_INVALID", `${key} is required.`);
  }

  return value.trim();
}

function nonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseEnum<T extends string>(value: string | undefined, allowed: readonly T[], key: string): T {
  const trimmed = required(value, key);
  if (!allowed.includes(trimmed as T)) {
    throw new LwsError("CONFIG_INVALID", `${key} has an unsupported value.`, {
      key,
      allowed,
      value: trimmed
    });
  }

  return trimmed as T;
}

function parseBoolean(value: string | undefined, key: string): boolean {
  const trimmed = required(value, key);
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }

  throw new LwsError("CONFIG_INVALID", `${key} must be true or false.`, { key, value: trimmed });
}

function parsePositiveInteger(value: string | undefined, key: string): number {
  const trimmed = required(value, key);
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new LwsError("CONFIG_INVALID", `${key} must be a positive integer.`, { key, value: trimmed });
  }

  return parsed;
}

function resolveConfiguredRoot(value: string | undefined, appRoot: string, key: string): string {
  const raw = required(value, key);
  if (isUncPath(raw)) {
    throw new LwsError("CONFIG_INVALID", `${key} must not be a UNC/network path.`, { key, value: raw });
  }

  return normalizeAbsolutePath(path.isAbsolute(raw) ? raw : path.resolve(/*turbopackIgnore: true*/ appRoot, raw));
}

function normalizeAbsolutePath(candidate: string): string {
  return path.resolve(/*turbopackIgnore: true*/ candidate);
}

function assertNotInsideAppRoot(root: string, appRoot: string, rootName: string, env: LwsEnv): void {
  if (env === "test") {
    return;
  }

  const relative = path.relative(appRoot, root);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new LwsError("CONFIG_INVALID", "Live L.W.S. storage roots must not be inside the app repository.", {
      rootName,
      root,
      appRoot
    });
  }
}

function assertPathInsideRoot(root: string, candidate: string, message: string): void {
  const relative = path.relative(root, candidate);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new LwsError("CONFIG_INVALID", message, { root, candidate });
  }
}

function isUncPath(candidate: string): boolean {
  return candidate.startsWith("\\\\") || candidate.startsWith("//");
}
