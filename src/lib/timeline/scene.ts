import type { CSSProperties } from "react";
import type { Edge, Node } from "@xyflow/react";

import type { TimelineItem, TimelineResponse } from "../lws-api/types";
import {
  bucketStart,
  formatTimelineBucket,
  nextBucket,
  nextTimelineGranularity,
  resolveTimelineGranularity,
  type TimelineGranularity
} from "./granularity.ts";

export type TimelineSceneNodeData = Record<string, unknown> & {
  kind: "point" | "interval" | "undated" | "tick" | "lane";
  item?: TimelineItem;
  objectId?: string;
  lane?: string;
  label: string;
  secondary?: string;
  color?: string;
  bucket?: number;
  nextGranularity?: Exclude<TimelineGranularity, "auto"> | null;
};

export type TimelineSceneEdgeData = Record<string, unknown> & {
  relationType: string;
  color: string;
  sourceObjectId: string;
  targetObjectId: string;
  emphasized?: boolean;
  selected?: boolean;
  onFocus?: (edgeId: string) => void;
};

export type TimelineScene = {
  nodes: Array<Node<TimelineSceneNodeData>>;
  edges: Array<Edge<TimelineSceneEdgeData>>;
  width: number;
  height: number;
  signature: string;
  temporalState: "dated" | "undated";
  granularity: Exclude<TimelineGranularity, "auto">;
};

type LayoutEntry = {
  sceneId: string;
  lane: string;
  item: TimelineItem;
  startX: number;
  endX: number;
  row: number;
  color: string;
};

const LEFT = 180;
const RIGHT = 160;
const TIME_WIDTH = 1900;
const NODE_HEIGHT = 58;
const ROW_GAP = 28;
const LANE_GAP = 34;
const POINT_WIDTH = 220;
const MIN_INTERVAL_WIDTH = 220;
const TIME_MARKER_GUTTER = 18;

export function buildTimelineScene(response: TimelineResponse, options: { granularity?: TimelineGranularity } = {}): TimelineScene {
  const temporalState = response.query.temporal_state;
  const granularity = resolveTimelineGranularity(options.granularity ?? "auto", response.domain.min_key, response.domain.max_key);
  const items = response.items.filter((item) => item.object_kind === "node");
  const domain = normalizeDomain(response.domain, temporalState, granularity);
  const laneEntries = new Map<string, LayoutEntry[]>();
  const primarySceneId = new Map<string, string>();

  for (const item of items) {
    const lanes = response.query.group_by === "none" ? ["Timeline"] : item.group_keys.length ? item.group_keys : ["_ungrouped"];
    lanes.forEach((lane, duplicateIndex) => {
      const sceneId = `${item.object_id}::${lane}::${duplicateIndex}`;
      if (!primarySceneId.has(item.object_id)) primarySceneId.set(item.object_id, sceneId);
      const [startX, endX] = itemExtent(item, domain, temporalState, items.indexOf(item), granularity);
      const entry: LayoutEntry = { sceneId, lane, item, startX, endX, row: 0, color: colorFor(item.type, item.tags[0]) };
      laneEntries.set(lane, [...(laneEntries.get(lane) ?? []), entry]);
    });
  }

  const nodes: Array<Node<TimelineSceneNodeData>> = [];
  const positionedByObject = new Map<string, Node<TimelineSceneNodeData>>();
  let laneTop = temporalState === "dated" ? 100 : 54;

  for (const [lane, entries] of laneEntries) {
    entries.sort((a, b) => a.startX - b.startX || a.item.title.localeCompare(b.item.title));
    const rowEnds: number[] = [];
    for (const entry of entries) {
      const available = rowEnds.findIndex((end) => end + 22 <= entry.startX);
      entry.row = available === -1 ? rowEnds.length : available;
      rowEnds[entry.row] = entry.endX;
    }
    nodes.push({ id: `lane::${lane}`, type: "timelineLane", position: { x: 16, y: laneTop }, data: { kind: "lane", label: lane }, draggable: false, selectable: false, focusable: false, zIndex: 2 });
    const contentTop = laneTop + 38;
    for (const entry of entries) {
      const kind = entry.item.position.kind;
      const width = Math.max(kind === "interval" ? entry.endX - entry.startX : POINT_WIDTH, kind === "interval" ? MIN_INTERVAL_WIDTH : POINT_WIDTH);
      const node: Node<TimelineSceneNodeData> = {
        id: entry.sceneId,
        type: kind === "point" ? "timelinePoint" : kind === "interval" ? "timelineInterval" : "timelineUndated",
        position: { x: entry.startX + TIME_MARKER_GUTTER, y: contentTop + entry.row * (NODE_HEIGHT + ROW_GAP) },
        data: { kind, item: entry.item, objectId: entry.item.object_id, lane: entry.lane, label: entry.item.title, secondary: entry.item.object_kind === "node" ? entry.item.type : entry.item.object_kind, color: entry.color },
        style: { width: Math.max(104, width - TIME_MARKER_GUTTER), height: NODE_HEIGHT, "--timeline-node-color": entry.color } as CSSProperties,
        draggable: false, selectable: true, zIndex: 3
      };
      nodes.push(node);
      if (primarySceneId.get(entry.item.object_id) === entry.sceneId) positionedByObject.set(entry.item.object_id, node);
    }
    laneTop = contentTop + Math.max(1, rowEnds.length) * (NODE_HEIGHT + ROW_GAP) + LANE_GAP;
  }

  const sceneHeight = Math.max(360, laneTop + 40);
  if (domain) nodes.unshift(...buildTickNodes(items, domain, sceneHeight, granularity));

  const edges = response.relations.flatMap((relation) => {
    const source = primarySceneId.get(relation.source_id);
    const target = primarySceneId.get(relation.target_id);
    if (!source || !target) return [];
    const color = positionedByObject.get(relation.source_id)?.data.color ?? colorFor(relation.relation_type);
    return [{ id: relation.edge_id, source, target, sourceHandle: "timeline-source", targetHandle: "timeline-target", type: "timelineLineage", label: relation.relation_type, data: { relationType: relation.relation_type, color, sourceObjectId: relation.source_id, targetObjectId: relation.target_id }, style: { stroke: color, strokeWidth: 2 }, zIndex: 1 } satisfies Edge<TimelineSceneEdgeData>];
  });

  return {
    nodes, edges, width: LEFT + TIME_WIDTH + RIGHT, height: sceneHeight, temporalState, granularity,
    signature: `${response.query.basis}:${response.query.temporal_state}:${response.query.group_by}:${granularity}:${response.domain.min_key}:${response.domain.max_key}:${items.map((item) => item.object_id).join("|")}:${response.relations.map((edge) => edge.edge_id).join("|")}`
  };
}

function normalizeDomain(domain: TimelineResponse["domain"], temporalState: "dated" | "undated", granularity: Exclude<TimelineGranularity, "auto">): [number, number] | null {
  if (temporalState === "undated" || domain.min_key === null || domain.max_key === null) return null;
  const start = bucketStart(domain.min_key, granularity);
  const end = nextBucket(domain.max_key, granularity);
  if (end !== nextBucket(start, granularity)) return [start, end];
  const unit = end - start;
  return [start - unit / 2, end + unit / 2];
}

function itemExtent(item: TimelineItem, domain: [number, number] | null, temporalState: "dated" | "undated", ordinal: number, granularity: Exclude<TimelineGranularity, "auto">): [number, number] {
  if (temporalState === "undated" || item.position.kind === "undated" || !domain) {
    const x = LEFT + ordinal * (POINT_WIDTH + 36);
    return [x, x + POINT_WIDTH];
  }
  if (item.position.kind === "point") {
    const x = timeToX(bucketStart(item.position.normalized_at, granularity), domain);
    return [x, x + POINT_WIDTH];
  }
  const start = item.position.normalized_start === null ? LEFT : timeToX(bucketStart(item.position.normalized_start, granularity), domain);
  const end = item.position.normalized_end === null ? LEFT + TIME_WIDTH : timeToX(nextBucket(item.position.normalized_end, granularity), domain);
  return [start, Math.max(start + MIN_INTERVAL_WIDTH, end)];
}

function timeToX(value: number, [start, end]: [number, number]) { return LEFT + ((value - start) / (end - start)) * TIME_WIDTH; }

function buildTickNodes(items: TimelineItem[], domain: [number, number], height: number, granularity: Exclude<TimelineGranularity, "auto">): Array<Node<TimelineSceneNodeData>> {
  const buckets = new Set<number>();
  for (const item of items) {
    if (item.position.kind === "point") buckets.add(bucketStart(item.position.normalized_at, granularity));
    if (item.position.kind === "interval") {
      if (item.position.normalized_start !== null) buckets.add(bucketStart(item.position.normalized_start, granularity));
      if (item.position.normalized_end !== null) buckets.add(bucketStart(item.position.normalized_end, granularity));
    }
  }
  return [...buckets].sort((a, b) => a - b).map((bucket) => ({
    id: `tick::${granularity}::${bucket}`,
    type: "timelineTick",
    position: { x: timeToX(bucket, domain), y: 0 },
    data: { kind: "tick", label: formatTimelineBucket(bucket, granularity), bucket, nextGranularity: nextTimelineGranularity(granularity) },
    style: { width: 1, height }, draggable: false, selectable: false, focusable: false, zIndex: 0
  }));
}

function colorFor(...values: Array<string | undefined>) {
  const value = values.filter(Boolean).join(":") || "timeline";
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return `hsl(${hash % 360} 68% 58%)`;
}
