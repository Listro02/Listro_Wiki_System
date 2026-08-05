import type { TimelineParams } from "../lws-api/client";

export const TIMELINE_URL_DEFAULTS = {
  kind: "node",
  basis: "created",
  temporal_state: "dated",
  status: "active",
  group_by: "none"
} as const;

export function parseTimelineSearch(search: URLSearchParams): TimelineParams {
  return {
    kind: "node",
    basis: (search.get("basis") as TimelineParams["basis"]) ?? "created",
    time_path: search.get("time_path") ?? undefined,
    temporal_state: (search.get("temporal_state") as TimelineParams["temporal_state"]) ?? "dated",
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
    type: search.get("type") ?? undefined,
    tag: search.get("tag") ?? undefined,
    scope: search.get("scope") ?? undefined,
    collection: search.get("collection") ?? undefined,
    status: search.get("status") ?? "active",
    group_by: (search.get("group_by") as TimelineParams["group_by"]) ?? "none",
    center: search.get("center") ?? undefined,
    depth: 1,
    limit: 50,
    cursor: search.get("cursor") ?? undefined
  };
}

export function updateTimelineSearch(
  current: URLSearchParams,
  values: Record<string, string | undefined>
): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set("kind", "node");
  for (const [key, value] of Object.entries(values)) {
    if (!value || value === TIMELINE_URL_DEFAULTS[key as keyof typeof TIMELINE_URL_DEFAULTS]) next.delete(key);
    else next.set(key, value);
  }
  next.delete("cursor");
  return next;
}
