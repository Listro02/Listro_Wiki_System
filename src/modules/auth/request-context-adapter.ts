import type { RuntimeConfig } from "../config/runtime-config.ts";
import type { AuthSource, RequestContext } from "../../shared/request-context.ts";
import type { PermissionService } from "../../services/permission-service.ts";

export type RequestContextResolution = {
  context: RequestContext;
  reason: "anonymous" | "local-admin" | "untrusted-session" | "production-local-admin-disabled";
};

const REQUEST_ID_HEADER = "x-lws-request-id";
const ACCOUNT_ID_HEADER = "x-lws-account-id";
const AUTH_SOURCE_HEADER = "x-lws-auth-source";
const LOCAL_ADMIN_SECRET_HEADER = "x-lws-local-admin-secret";

export function resolveHttpRequestContext(
  request: Request,
  config: RuntimeConfig,
  permissionService: PermissionService
): RequestContextResolution {
  const requestId = normalizeRequestId(request.headers.get(REQUEST_ID_HEADER)) ?? crypto.randomUUID();
  const authSource = normalizeAuthSource(request.headers.get(AUTH_SOURCE_HEADER));

  if (authSource === "local-script") {
    return resolveLocalAdminContext(request, config, permissionService, requestId);
  }

  if (authSource === "session") {
    return {
      context: permissionService.resolveContext({ requestId }),
      reason: "untrusted-session"
    };
  }

  return {
    context: permissionService.resolveContext({ requestId }),
    reason: "anonymous"
  };
}

function resolveLocalAdminContext(
  request: Request,
  config: RuntimeConfig,
  permissionService: PermissionService,
  requestId: string
): RequestContextResolution {
  if (config.env === "production" || config.auth.mode !== "local") {
    return {
      context: permissionService.resolveContext({ requestId }),
      reason: "production-local-admin-disabled"
    };
  }

  const providedSecret = request.headers.get(LOCAL_ADMIN_SECRET_HEADER);
  if (!providedSecret || providedSecret !== config.auth.sessionSecret) {
    return {
      context: permissionService.resolveContext({ requestId }),
      reason: "anonymous"
    };
  }

  const requestedAccountId = request.headers.get(ACCOUNT_ID_HEADER)?.trim();
  const accountId = requestedAccountId || config.auth.adminBootstrapAccount;
  if (accountId !== config.auth.adminBootstrapAccount) {
    return {
      context: permissionService.resolveContext({ requestId }),
      reason: "anonymous"
    };
  }

  return {
    context: permissionService.resolveContext({
      accountId,
      authSource: "local-script",
      requestId
    }),
    reason: "local-admin"
  };
}

function normalizeAuthSource(value: string | null): AuthSource {
  if (value === "session" || value === "local-script" || value === "system") {
    return value;
  }
  return "anonymous";
}

function normalizeRequestId(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return /^[A-Za-z0-9._:-]{1,128}$/.test(trimmed) ? trimmed : null;
}
