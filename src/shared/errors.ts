export type LwsErrorCode =
  | "CONFIG_INVALID"
  | "STORAGE_ROOT_MISSING"
  | "PATH_OUTSIDE_ROOT"
  | "OBJECT_NOT_FOUND"
  | "OBJECT_ALREADY_EXISTS"
  | "SCHEMA_INVALID"
  | "SEMANTIC_INVALID"
  | "PUBLIC_BOUNDARY_VIOLATION"
  | "PERMISSION_DENIED"
  | "REV_CONFLICT"
  | "PATCH_INVALID"
  | "RESTORE_SOURCE_INVALID"
  | "CURSOR_INVALID"
  | "EVENT_APPEND_FAILED"
  | "INDEX_STALE"
  | "INDEX_REBUILD_REQUIRED"
  | "INDEX_CORRUPT"
  | "INDEX_SCHEMA_MISMATCH"
  | "SEARCH_UNAVAILABLE"
  | "JOB_NOT_FOUND"
  | "JOB_CONFLICT"
  | "INTERNAL_ERROR";

export type ErrorDetails = Record<string, unknown> | Array<Record<string, unknown>>;

const DEFAULT_STATUS_BY_CODE: Record<LwsErrorCode, number> = {
  CONFIG_INVALID: 500,
  STORAGE_ROOT_MISSING: 503,
  PATH_OUTSIDE_ROOT: 400,
  OBJECT_NOT_FOUND: 404,
  OBJECT_ALREADY_EXISTS: 409,
  SCHEMA_INVALID: 422,
  SEMANTIC_INVALID: 422,
  PUBLIC_BOUNDARY_VIOLATION: 422,
  PERMISSION_DENIED: 403,
  REV_CONFLICT: 409,
  PATCH_INVALID: 400,
  RESTORE_SOURCE_INVALID: 400,
  CURSOR_INVALID: 400,
  EVENT_APPEND_FAILED: 500,
  INDEX_STALE: 503,
  INDEX_REBUILD_REQUIRED: 503,
  INDEX_CORRUPT: 503,
  INDEX_SCHEMA_MISMATCH: 503,
  SEARCH_UNAVAILABLE: 503,
  JOB_NOT_FOUND: 404,
  JOB_CONFLICT: 409,
  INTERNAL_ERROR: 500
};

export class LwsError extends Error {
  readonly code: LwsErrorCode;
  readonly status: number;
  readonly details?: ErrorDetails;

  constructor(code: LwsErrorCode, message: string, details?: ErrorDetails, status?: number) {
    super(message);
    this.name = "LwsError";
    this.code = code;
    this.status = status ?? DEFAULT_STATUS_BY_CODE[code];
    this.details = details;
  }
}

export type LwsErrorResponse = {
  error: {
    code: LwsErrorCode;
    message: string;
    details?: ErrorDetails;
  };
};

export function toLwsError(error: unknown): LwsError {
  if (error instanceof LwsError) {
    return error;
  }

  if (error instanceof Error) {
    return new LwsError("INTERNAL_ERROR", error.message);
  }

  return new LwsError("INTERNAL_ERROR", "Unexpected internal error.");
}

export function toErrorResponse(error: unknown): { body: LwsErrorResponse; status: number } {
  const lwsError = toLwsError(error);
  return {
    status: lwsError.status,
    body: {
      error: {
        code: lwsError.code,
        message: lwsError.message,
        ...(lwsError.details === undefined ? {} : { details: lwsError.details })
      }
    }
  };
}
