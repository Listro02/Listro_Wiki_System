export type TemporalPrecision = "date" | "datetime";

export type NormalizedTemporal = {
  key: number;
  precision: TemporalPrecision;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const OFFSET_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Converts LWS's accepted temporal source forms into a comparison key.  The
 * source text is deliberately never changed: this is only a SQLite projection.
 */
export function normalizeTemporal(value: string, boundary: "start" | "end" = "start"): NormalizedTemporal | null {
  if (DATE_ONLY.test(value)) {
    const suffix = boundary === "end" ? "T23:59:59.999Z" : "T00:00:00.000Z";
    const key = Date.parse(`${value}${suffix}`);
    return Number.isNaN(key) ? null : { key, precision: "date" };
  }

  if (!OFFSET_DATETIME.test(value)) {
    return null;
  }

  const key = Date.parse(value);
  return Number.isNaN(key) ? null : { key, precision: "datetime" };
}

export function validateTemporalFields(temporal: {
  occurred_at: string | null;
  valid_from: string | null;
  valid_to: string | null;
}): Array<{ field: "occurred_at" | "valid_from" | "valid_to"; message: string }> {
  const issues: Array<{ field: "occurred_at" | "valid_from" | "valid_to"; message: string }> = [];
  const occurred = temporal.occurred_at ? normalizeTemporal(temporal.occurred_at, "start") : null;
  const from = temporal.valid_from ? normalizeTemporal(temporal.valid_from, "start") : null;
  const to = temporal.valid_to ? normalizeTemporal(temporal.valid_to, "end") : null;

  if (temporal.occurred_at && !occurred) issues.push({ field: "occurred_at", message: "must be an ISO full-date or offset datetime." });
  if (temporal.valid_from && !from) issues.push({ field: "valid_from", message: "must be an ISO full-date or offset datetime." });
  if (temporal.valid_to && !to) issues.push({ field: "valid_to", message: "must be an ISO full-date or offset datetime." });
  if (from && to && from.key > to.key) issues.push({ field: "valid_to", message: "must not be earlier than temporal.valid_from." });
  return issues;
}
