import { normalizeEventId } from "../modules/events/event-id.ts";
import type { JsonPatchOperation } from "../modules/patch/patch-engine.ts";
import { LwsError } from "./errors.ts";
import type { LwsEdge, LwsNode, LwsObject, ObjectKind, Visibility } from "./object-model.ts";

type JsonBodyOptions = {
  allowEmpty?: boolean;
};

export async function readJsonBody(request: Request, options: JsonBodyOptions = {}): Promise<unknown> {
  const raw = await request.text();
  if (raw.trim().length === 0) {
    if (options.allowEmpty) {
      return {};
    }
    throw new LwsError("SCHEMA_INVALID", "Request body must be valid JSON.");
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new LwsError("SCHEMA_INVALID", "Request body must be valid JSON.");
  }
}

export function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new LwsError("SCHEMA_INVALID", `${label} must be an object.`);
  }
  return value;
}

export function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new LwsError("SCHEMA_INVALID", `${field} must be a string.`);
  }
  return value;
}

export function requiredPositiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new LwsError("SCHEMA_INVALID", `${field} must be a positive integer.`, { field });
  }
  return value as number;
}

export function requiredPatch(value: unknown): JsonPatchOperation[] {
  if (!Array.isArray(value)) {
    throw new LwsError("PATCH_INVALID", "patch must be an array.");
  }
  return value as JsonPatchOperation[];
}

export function requiredObject(value: unknown, expectedKind: ObjectKind): LwsObject {
  const object = assertRecord(value, "object") as Partial<LwsObject>;
  if (object.object_kind !== expectedKind) {
    throw new LwsError("SCHEMA_INVALID", `Expected ${expectedKind} object.`, {
      object_kind: object.object_kind
    });
  }
  return object as LwsObject;
}

export function parseRouteParam(value: string, name: string): string {
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.trim().length === 0) {
      throw new LwsError("SCHEMA_INVALID", `${name} route parameter must not be empty.`, { parameter: name });
    }
    return decoded;
  } catch (error) {
    if (error instanceof LwsError) {
      throw error;
    }
    throw new LwsError("SCHEMA_INVALID", `${name} route parameter is not valid percent-encoding.`, {
      parameter: name
    });
  }
}

export function parseEventIdParam(value: string): string {
  return normalizeEventId(parseRouteParam(value, "eventId"));
}

export function parseObjectKind(value: string | null): ObjectKind | undefined {
  if (value === null || value === "") {
    return undefined;
  }
  if (value === "node" || value === "edge") {
    return value;
  }
  throw new LwsError("SCHEMA_INVALID", "kind must be node or edge.", { field: "kind", value });
}

export function parseVisibility(value: string | null): Visibility | undefined {
  if (value === null || value === "") {
    return undefined;
  }
  if (value === "public" || value === "private") {
    return value;
  }
  throw new LwsError("SCHEMA_INVALID", "visibility must be public or private.", { field: "visibility", value });
}

export function parseIntegerQuery(value: string | null, field: string): number | undefined {
  if (value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new LwsError("SCHEMA_INVALID", `${field} must be a non-negative integer.`, { field, value });
  }
  return parsed;
}

export function parseBooleanQuery(value: string | null, field: string): boolean {
  if (value === null || value === "") {
    return false;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new LwsError("SCHEMA_INVALID", `${field} must be true or false.`, { field, value });
}

type CreateObjectBody<T extends LwsObject> = {
  object: T;
  target_scope?: string;
  summary?: string;
};

export function parseCreateObjectBody(body: unknown, expectedKind: "node"): CreateObjectBody<LwsNode>;
export function parseCreateObjectBody(body: unknown, expectedKind: "edge"): CreateObjectBody<LwsEdge>;
export function parseCreateObjectBody(body: unknown, expectedKind: ObjectKind): CreateObjectBody<LwsObject> {
  const record = assertRecord(body, "Request body");
  return {
    object: requiredObject(record.object, expectedKind),
    target_scope: optionalString(record.target_scope, "target_scope"),
    summary: optionalString(record.summary, "summary")
  };
}

export function parsePatchObjectBody(body: unknown) {
  const record = assertRecord(body, "Request body");
  return {
    base_rev: requiredPositiveInteger(record.base_rev, "base_rev"),
    patch: requiredPatch(record.patch),
    summary: optionalString(record.summary, "summary")
  };
}

export function parseDeleteObjectBody(body: unknown) {
  const record = assertRecord(body, "Request body");
  return {
    base_rev: requiredPositiveInteger(record.base_rev, "base_rev"),
    summary: optionalString(record.summary, "summary")
  };
}

export function parseRestoreObjectBody(body: unknown) {
  const record = assertRecord(body, "Request body");
  if (record.mode !== undefined && record.mode !== "inverse_patch") {
    throw new LwsError("SCHEMA_INVALID", "mode must be inverse_patch.", { field: "mode" });
  }
  return {
    base_rev: requiredPositiveInteger(record.base_rev, "base_rev"),
    source_event_id: normalizeEventId(record.source_event_id),
    mode: "inverse_patch" as const,
    summary: optionalString(record.summary, "summary")
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
