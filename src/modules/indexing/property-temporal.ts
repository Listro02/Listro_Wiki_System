import { normalizeTemporal, type TemporalPrecision } from "./temporal-normalization.ts";

export type PropertyTemporalProjection = {
  property_path: string;
  time_kind: "point" | "interval";
  at_value: string | null;
  start_value: string | null;
  end_value: string | null;
  at_key: number | null;
  start_key: number | null;
  end_key: number | null;
  at_precision: TemporalPrecision | null;
  start_precision: TemporalPrecision | null;
  end_precision: TemporalPrecision | null;
  projection_status: "dated" | "undated" | "invalid";
};

export type PropertyTemporalIssue = { target: string; message: string };

export function extractPropertyTemporalValues(props: Record<string, unknown>) {
  const values: PropertyTemporalProjection[] = [];
  const issues: PropertyTemporalIssue[] = [];
  walkObject(props, "/props", values, issues);
  return { values, issues };
}

export function isPropertyTemporalIssueTarget(target?: string) {
  return Boolean(target?.startsWith("/props/") && target.includes("/$temporal"));
}

function walkObject(
  object: Record<string, unknown>,
  path: string,
  values: PropertyTemporalProjection[],
  issues: PropertyTemporalIssue[]
) {
  for (const [key, value] of Object.entries(object)) {
    const childPath = `${path}/${escapePointerSegment(key)}`;
    if (Array.isArray(value)) {
      if (containsTemporalMarker(value)) {
        issues.push({ target: `${childPath}/$temporal`, message: "temporal wrappers inside arrays are not supported." });
      }
      continue;
    }
    if (!isRecord(value)) continue;
    if (Object.prototype.hasOwnProperty.call(value, "$temporal")) {
      parseWrapper(value, childPath, values, issues);
      continue;
    }
    walkObject(value, childPath, values, issues);
  }
}

function parseWrapper(
  wrapper: Record<string, unknown>,
  propertyPath: string,
  values: PropertyTemporalProjection[],
  issues: PropertyTemporalIssue[]
) {
  const target = `${propertyPath}/$temporal`;
  const unexpected = Object.keys(wrapper).filter((key) => key !== "$value" && key !== "$temporal");
  if (unexpected.length) {
    issues.push({ target, message: `temporal wrapper only allows $value and $temporal; found ${unexpected.join(", ")}.` });
  }
  if (!isRecord(wrapper.$temporal)) {
    issues.push({ target, message: "$temporal must be an object." });
    values.push(invalidProjection(propertyPath, "point"));
    return;
  }

  const temporal = wrapper.$temporal;
  if (temporal.kind === "point") {
    const unexpectedTemporal = Object.keys(temporal).filter((key) => key !== "kind" && key !== "at");
    if (unexpectedTemporal.length) issues.push({ target, message: `point temporal only allows kind and at; found ${unexpectedTemporal.join(", ")}.` });
    if (!("at" in temporal) || (temporal.at !== null && typeof temporal.at !== "string")) {
      issues.push({ target, message: "point.at must be an ISO date/datetime string or null." });
      values.push(invalidProjection(propertyPath, "point"));
      return;
    }
    const normalized = typeof temporal.at === "string" ? normalizeTemporal(temporal.at, "start") : null;
    if (typeof temporal.at === "string" && !normalized) issues.push({ target, message: "point.at must be an ISO full-date or offset datetime." });
    values.push({
      property_path: propertyPath,
      time_kind: "point",
      at_value: temporal.at,
      start_value: null,
      end_value: null,
      at_key: normalized?.key ?? null,
      start_key: null,
      end_key: null,
      at_precision: normalized?.precision ?? null,
      start_precision: null,
      end_precision: null,
      projection_status: temporal.at === null ? "undated" : normalized ? "dated" : "invalid"
    });
    return;
  }

  if (temporal.kind === "interval") {
    const unexpectedTemporal = Object.keys(temporal).filter((key) => !["kind", "start", "end"].includes(key));
    if (unexpectedTemporal.length) issues.push({ target, message: `interval temporal only allows kind, start, and end; found ${unexpectedTemporal.join(", ")}.` });
    if (!("start" in temporal) || !("end" in temporal) || !isNullableString(temporal.start) || !isNullableString(temporal.end)) {
      issues.push({ target, message: "interval.start and interval.end must both be ISO date/datetime strings or null." });
      values.push(invalidProjection(propertyPath, "interval"));
      return;
    }
    const start = typeof temporal.start === "string" ? normalizeTemporal(temporal.start, "start") : null;
    const end = typeof temporal.end === "string" ? normalizeTemporal(temporal.end, "end") : null;
    let invalid = false;
    if (typeof temporal.start === "string" && !start) { issues.push({ target, message: "interval.start must be an ISO full-date or offset datetime." }); invalid = true; }
    if (typeof temporal.end === "string" && !end) { issues.push({ target, message: "interval.end must be an ISO full-date or offset datetime." }); invalid = true; }
    if (start && end && start.key > end.key) { issues.push({ target, message: "interval.end must not be earlier than interval.start." }); invalid = true; }
    values.push({
      property_path: propertyPath,
      time_kind: "interval",
      at_value: null,
      start_value: temporal.start,
      end_value: temporal.end,
      at_key: null,
      start_key: invalid ? null : start?.key ?? null,
      end_key: invalid ? null : end?.key ?? null,
      at_precision: null,
      start_precision: invalid ? null : start?.precision ?? null,
      end_precision: invalid ? null : end?.precision ?? null,
      projection_status: invalid ? "invalid" : temporal.start === null && temporal.end === null ? "undated" : "dated"
    });
    return;
  }

  issues.push({ target, message: "$temporal.kind must be point or interval." });
  values.push(invalidProjection(propertyPath, "point"));
}

function invalidProjection(propertyPath: string, timeKind: "point" | "interval"): PropertyTemporalProjection {
  return {
    property_path: propertyPath, time_kind: timeKind,
    at_value: null, start_value: null, end_value: null,
    at_key: null, start_key: null, end_key: null,
    at_precision: null, start_precision: null, end_precision: null,
    projection_status: "invalid"
  };
}

function containsTemporalMarker(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsTemporalMarker);
  if (!isRecord(value)) return false;
  if (Object.prototype.hasOwnProperty.call(value, "$temporal")) return true;
  return Object.values(value).some(containsTemporalMarker);
}

function escapePointerSegment(value: string) { return value.replaceAll("~", "~0").replaceAll("/", "~1"); }
function isNullableString(value: unknown): value is string | null { return value === null || typeof value === "string"; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
