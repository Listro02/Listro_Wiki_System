import { LwsError } from "../../shared/errors.ts";
import type { LwsIssue } from "../../shared/api.ts";
import type {
  AuditFields,
  EdgeDetailMode,
  LwsEdge,
  LwsNode,
  LwsObject,
  NodeDetailMode,
  ObjectStatus,
  TemporalFields,
  Visibility
} from "../../shared/object-model.ts";
import { assertSafeObjectId } from "../storage/path-resolver.ts";
import { isAccountId } from "../ontology/builtin-ontology.ts";
import { validateTemporalFields } from "../indexing/temporal-normalization.ts";
import { extractPropertyTemporalValues } from "../indexing/property-temporal.ts";

export type ValidationResult<T = LwsObject> = {
  ok: boolean;
  object?: T;
  issues: LwsIssue[];
};

const NODE_DETAIL_MODES: NodeDetailMode[] = ["stub", "note", "page", "view", "system"];
const EDGE_DETAIL_MODES: EdgeDetailMode[] = ["stub", "note", "page"];
const VISIBILITIES: Visibility[] = ["private", "public"];
const STATUSES: ObjectStatus[] = ["active", "draft", "stub", "archived", "deleted"];
const SLUG_PATTERN = /^[A-Za-z0-9._-]+$/;

export function assertValidObjectShape(value: unknown, expectedKind?: "node" | "edge"): LwsObject {
  const result = validateObjectShape(value, expectedKind);
  if (!result.ok || !result.object) {
    throw new LwsError("SCHEMA_INVALID", "Object schema validation failed.", result.issues);
  }

  return result.object;
}

export function validateObjectShape(value: unknown, expectedKind?: "node" | "edge"): ValidationResult {
  const issues: LwsIssue[] = [];
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [issue("SCHEMA_INVALID", "Object must be a JSON object.", "$")]
    };
  }

  if ("access" in value) {
    issues.push(issue("SCHEMA_INVALID", "Object must not embed access; use permission edges instead.", "access"));
  }

  if (value.object_kind !== "node" && value.object_kind !== "edge") {
    issues.push(issue("SCHEMA_INVALID", "object_kind must be node or edge.", "object_kind"));
    return { ok: false, issues };
  }

  if (expectedKind && value.object_kind !== expectedKind) {
    issues.push(issue("SCHEMA_INVALID", `Expected ${expectedKind} object.`, "object_kind"));
  }

  if (value.object_kind === "node") {
    const node = validateNodeShape(value, issues);
    return { ok: issues.length === 0, object: issues.length === 0 ? node : undefined, issues };
  }

  const edge = validateEdgeShape(value, issues);
  return { ok: issues.length === 0, object: issues.length === 0 ? edge : undefined, issues };
}

export function validateNodeShape(value: Record<string, unknown>, issues: LwsIssue[]): LwsNode {
  validateCommonFields(value, issues, "node", NODE_DETAIL_MODES);
  requireString(value.slug, "slug", issues);
  if (typeof value.slug === "string" && !SLUG_PATTERN.test(value.slug)) {
    issues.push(issue("SCHEMA_INVALID", "slug must be URL-safe.", "slug"));
  }
  requireString(value.type, "type", issues);

  return value as LwsNode;
}

export function validateEdgeShape(value: Record<string, unknown>, issues: LwsIssue[]): LwsEdge {
  validateCommonFields(value, issues, "edge", EDGE_DETAIL_MODES);
  requireString(value.source, "source", issues);
  requireString(value.target, "target", issues);
  requireString(value.type, "type", issues);

  return value as LwsEdge;
}

function validateCommonFields(
  value: Record<string, unknown>,
  issues: LwsIssue[],
  expectedKind: "node" | "edge",
  detailModes: readonly string[]
): void {
  if (value.schema_version !== 1) {
    issues.push(issue("SCHEMA_INVALID", "schema_version must be 1.", "schema_version"));
  }

  if (value.object_kind !== expectedKind) {
    issues.push(issue("SCHEMA_INVALID", `object_kind must be ${expectedKind}.`, "object_kind"));
  }

  const id = requireString(value.id, "id", issues);
  if (id) {
    try {
      assertSafeObjectId(id);
    } catch {
      issues.push(issue("SCHEMA_INVALID", "id contains unsupported path-like characters.", "id"));
    }
  }

  if (!Number.isInteger(value.rev) || Number(value.rev) < 1) {
    issues.push(issue("SCHEMA_INVALID", "rev must be a positive integer.", "rev"));
  }

  requireString(value.title, "title", issues);

  if (typeof value.detail_mode !== "string" || !detailModes.includes(value.detail_mode)) {
    issues.push(issue("SCHEMA_INVALID", "detail_mode is not allowed.", "detail_mode"));
  }

  if (typeof value.visibility !== "string" || !VISIBILITIES.includes(value.visibility as Visibility)) {
    issues.push(issue("SCHEMA_INVALID", "visibility must be private or public.", "visibility"));
  }

  if (typeof value.status !== "string" || !STATUSES.includes(value.status as ObjectStatus)) {
    issues.push(issue("SCHEMA_INVALID", "status is not allowed.", "status"));
  }

  if (!Array.isArray(value.tags) || value.tags.some((tag) => typeof tag !== "string" || tag.length === 0)) {
    issues.push(issue("SCHEMA_INVALID", "tags must be an array of node ids.", "tags"));
  }

  if (!isRecord(value.props)) {
    issues.push(issue("SCHEMA_INVALID", "props must be an object.", "props"));
  } else {
    for (const temporalIssue of extractPropertyTemporalValues(value.props).issues) {
      issues.push(issue("SCHEMA_INVALID", temporalIssue.message, temporalIssue.target));
    }
  }

  validateTemporal(value.temporal, issues);
  validateAudit(value.audit, issues);

  if ("aliases" in value && (!Array.isArray(value.aliases) || value.aliases.some((alias) => typeof alias !== "string"))) {
    issues.push(issue("SCHEMA_INVALID", "aliases must be an array of strings.", "aliases"));
  }

  if ("summary" in value && typeof value.summary !== "string") {
    issues.push(issue("SCHEMA_INVALID", "summary must be a string.", "summary"));
  }
}

function validateTemporal(value: unknown, issues: LwsIssue[]): value is TemporalFields {
  if (!isRecord(value)) {
    issues.push(issue("SCHEMA_INVALID", "temporal must be an object.", "temporal"));
    return false;
  }

  for (const field of ["occurred_at", "valid_from", "valid_to"] as const) {
    if (value[field] !== null && typeof value[field] !== "string") {
      issues.push(issue("SCHEMA_INVALID", `temporal.${field} must be string or null.`, `temporal.${field}`));
    }
  }

  if (
    typeof value.occurred_at === "string" ||
    typeof value.valid_from === "string" ||
    typeof value.valid_to === "string"
  ) {
    const temporal = value as TemporalFields;
    for (const temporalIssue of validateTemporalFields(temporal)) {
      issues.push(issue("SCHEMA_INVALID", `temporal.${temporalIssue.field} ${temporalIssue.message}`, `temporal.${temporalIssue.field}`));
    }
  }

  return true;
}

function validateAudit(value: unknown, issues: LwsIssue[]): value is AuditFields {
  if (!isRecord(value)) {
    issues.push(issue("SCHEMA_INVALID", "audit must be an object.", "audit"));
    return false;
  }

  for (const field of ["created_at", "updated_at", "created_by", "updated_by"] as const) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      issues.push(issue("SCHEMA_INVALID", `audit.${field} must be a non-empty string.`, `audit.${field}`));
    }
  }

  for (const field of ["created_by", "updated_by"] as const) {
    if (typeof value[field] === "string" && !isAccountId(value[field])) {
      issues.push(issue("SCHEMA_INVALID", `audit.${field} must be an account.* node id.`, `audit.${field}`));
    }
  }

  return true;
}

function requireString(value: unknown, target: string, issues: LwsIssue[]): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(issue("SCHEMA_INVALID", `${target} must be a non-empty string.`, target));
    return null;
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(code: string, message: string, target: string): LwsIssue {
  return {
    code,
    severity: "error",
    message,
    target
  };
}
