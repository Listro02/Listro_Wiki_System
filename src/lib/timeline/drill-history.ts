import type { TimelineGranularity } from "./granularity";

export type TimelineDrillParent = {
  from: string | null;
  to: string | null;
  granularity: TimelineGranularity;
};

const MAX_DEPTH = 6;

export function parseTimelineDrillHistory(value: string | null): TimelineDrillParent[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is TimelineDrillParent => isParent(entry))
      .slice(-MAX_DEPTH);
  } catch {
    return [];
  }
}

export function serializeTimelineDrillHistory(stack: TimelineDrillParent[]): string | undefined {
  if (!stack.length) return undefined;
  return JSON.stringify(stack.slice(-MAX_DEPTH));
}

function isParent(value: unknown): value is TimelineDrillParent {
  if (!value || typeof value !== "object") return false;
  const parent = value as Record<string, unknown>;
  return (typeof parent.from === "string" || parent.from === null)
    && (typeof parent.to === "string" || parent.to === null)
    && ["auto", "year", "month", "day", "hour", "minute", "second"].includes(parent.granularity as string);
}
