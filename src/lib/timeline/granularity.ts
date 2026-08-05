export const TIMELINE_GRANULARITIES = ["auto", "year", "month", "day", "hour", "minute", "second"] as const;
export type TimelineGranularity = (typeof TIMELINE_GRANULARITIES)[number];

export function parseTimelineGranularity(value: string | null): TimelineGranularity {
  return TIMELINE_GRANULARITIES.includes(value as TimelineGranularity) ? value as TimelineGranularity : "auto";
}

export function resolveTimelineGranularity(requested: TimelineGranularity, min: number | null, max: number | null): Exclude<TimelineGranularity, "auto"> {
  if (requested !== "auto") return requested;
  if (min === null || max === null) return "day";
  const span = Math.max(0, max - min);
  if (span >= 730 * 86_400_000) return "year";
  if (span >= 62 * 86_400_000) return "month";
  return "day";
}

export function bucketStart(value: number, granularity: Exclude<TimelineGranularity, "auto">): number {
  const date = new Date(value);
  if (granularity === "year") return Date.UTC(date.getUTCFullYear(), 0, 1);
  if (granularity === "month") return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  if (granularity === "day") return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  if (granularity === "hour") return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours());
  if (granularity === "minute") return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes());
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
}

export function nextBucket(value: number, granularity: Exclude<TimelineGranularity, "auto">): number {
  const date = new Date(bucketStart(value, granularity));
  if (granularity === "year") date.setUTCFullYear(date.getUTCFullYear() + 1);
  else if (granularity === "month") date.setUTCMonth(date.getUTCMonth() + 1);
  else if (granularity === "day") date.setUTCDate(date.getUTCDate() + 1);
  else if (granularity === "hour") date.setUTCHours(date.getUTCHours() + 1);
  else if (granularity === "minute") date.setUTCMinutes(date.getUTCMinutes() + 1);
  else date.setUTCSeconds(date.getUTCSeconds() + 1);
  return date.getTime();
}

export function nextTimelineGranularity(granularity: Exclude<TimelineGranularity, "auto">): Exclude<TimelineGranularity, "auto"> | null {
  const next: Record<Exclude<TimelineGranularity, "auto">, Exclude<TimelineGranularity, "auto"> | null> = {
    year: "month", month: "day", day: "hour", hour: "minute", minute: "second", second: null
  };
  return next[granularity];
}

export function formatTimelineBucket(value: number, granularity: Exclude<TimelineGranularity, "auto">): string {
  const date = new Date(value);
  const day = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  if (granularity === "year") return String(date.getUTCFullYear());
  if (granularity === "month") return day.slice(0, 7);
  if (granularity === "day") return day;
  const time = `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
  return granularity === "hour" ? `${day} ${time}:00` : granularity === "minute" ? `${day} ${time}` : `${day} ${time}:${String(date.getUTCSeconds()).padStart(2, "0")}`;
}

export function bucketQueryRange(value: number, granularity: Exclude<TimelineGranularity, "auto">) {
  const start = bucketStart(value, granularity);
  const end = nextBucket(start, granularity) - 1;
  if (granularity === "day") {
    const date = formatTimelineBucket(start, "day");
    return { from: date, to: date };
  }
  return { from: new Date(start).toISOString(), to: new Date(end).toISOString() };
}
