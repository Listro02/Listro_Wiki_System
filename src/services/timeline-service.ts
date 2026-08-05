import { createHash } from "node:crypto";

import type { IndexStore } from "../modules/indexing/index-store.ts";
import { normalizeTemporal, type TemporalPrecision } from "../modules/indexing/temporal-normalization.ts";
import { LwsError } from "../shared/errors.ts";
import type { RequestContext } from "../shared/request-context.ts";
import type { PermissionService } from "./permission-service.ts";

export type TimelineQuery = {
  kind?: "node" | "edge";
  basis?: "created" | "updated" | "occurred" | "valid" | "custom";
  time_path?: string;
  temporal_state?: "dated" | "undated";
  from?: string;
  to?: string;
  type?: string;
  tag?: string;
  scope?: string;
  collection?: string;
  status?: string;
  visibility?: "public" | "private";
  group_by?: "none" | "type" | "tag" | "scope" | "collection";
  center?: string;
  depth?: number;
  limit?: number;
  cursor?: string;
  /** Compatibility-only default for pre-ad-hoc internal consumers. */
  legacy_all?: boolean;
};

export type TemporalCoverageState = "undated" | "missing" | "invalid";

export type TemporalCoverageQuery = Omit<TimelineQuery, "temporal_state" | "group_by" | "from" | "to"> & {
  state?: TemporalCoverageState;
};

type NormalizedTimelineQuery = Required<Pick<TimelineQuery, "basis" | "temporal_state" | "status" | "group_by">> &
  Omit<TimelineQuery, "basis" | "temporal_state" | "status" | "group_by" | "limit" | "cursor"> & { limit: number };

type TimelineRow = {
  object_id: string;
  object_kind: "node" | "edge";
  title: string;
  type: string;
  status: string;
  visibility: "public" | "private";
  occurred_at: string | null;
  valid_from: string | null;
  valid_to: string | null;
  occurred_at_key: number | null;
  valid_from_key: number | null;
  valid_to_key: number | null;
  occurred_at_precision: TemporalPrecision | null;
  valid_from_precision: TemporalPrecision | null;
  valid_to_precision: TemporalPrecision | null;
  created_at: string;
  updated_at: string;
  created_at_key: number | null;
  updated_at_key: number | null;
  created_at_precision: TemporalPrecision | null;
  updated_at_precision: TemporalPrecision | null;
  source_id: string | null;
  target_id: string | null;
  property_path: string | null;
  property_time_kind: "point" | "interval" | null;
  property_at_value: string | null;
  property_start_value: string | null;
  property_end_value: string | null;
  property_at_key: number | null;
  property_start_key: number | null;
  property_end_key: number | null;
  property_at_precision: TemporalPrecision | null;
  property_start_precision: TemporalPrecision | null;
  property_end_precision: TemporalPrecision | null;
  property_projection_status: "dated" | "undated" | "invalid" | null;
};

type Cursor = { mode: "dated"; sort_key: number; object_id: string; query_hash: string; revision: string } | { mode: "undated"; title: string; object_id: string; query_hash: string; revision: string };
type CoverageCursor = { title: string; object_id: string; query_hash: string; revision: string };

export class TimelineService {
  private readonly indexStore: IndexStore;
  private readonly permissionService?: PermissionService;

  constructor(indexStore: IndexStore, permissionService?: PermissionService) {
    this.indexStore = indexStore;
    this.permissionService = permissionService;
  }

  getTimeline(queryOrContext: TimelineQuery | RequestContext, suppliedContext?: RequestContext) {
    // Retain the pre-ad-hoc service call shape for internal callers. HTTP always
    // supplies query plus context; direct consumers may still request defaults.
    const context = suppliedContext ?? (queryOrContext as RequestContext);
    const query = suppliedContext ? (queryOrContext as TimelineQuery) : { legacy_all: true };
    const normalized = normalizeQuery(query);
    const db = this.indexStore.openReady();
    try {
      const revision = this.indexRevision(db);
      const queryHash = hashQuery(normalized);
      const cursor = query.cursor ? decodeCursor(query.cursor, queryHash, revision, normalized.temporal_state) : null;
      const base = this.findRows(db, normalized, context, false);
      const { rows, context: centerContext } = this.findRows(db, normalized, context, true);
      const coverage = timeCoverage(base.rows, normalized);
      const grouped = rows.map((row) => ({ row, group_keys: this.groupKeys(db, row, normalized.group_by) }));
      const groups = countGroups(grouped);
      const sorted = grouped.sort((left, right) => compareRows(left.row, right.row, normalized));
      const afterCursor = cursor ? sorted.filter((entry) => isAfterCursor(entry.row, cursor, normalized)) : sorted;
      const page = afterCursor.slice(0, normalized.limit);
      const next = afterCursor.length > normalized.limit ? encodeCursor(page.at(-1)!.row, normalized, queryHash, revision) : null;
      const undatedCount = coverage.undated_count;
      const items = page.map(({ row, group_keys }) => this.toItem(db, row, group_keys, context, normalized));
      const nodeIds = page.filter(({ row }) => row.object_kind === "node").map(({ row }) => row.object_id);

      return {
        items,
        relations: this.findPageRelations(db, nodeIds, context, normalized),
        domain: timelineDomain(rows, normalized),
        groups,
        query: normalized,
        time_coverage: coverage,
        undated_count: undatedCount,
        next_cursor: next,
        limit: normalized.limit,
        index_revision: revision,
        ...(centerContext ? { context: centerContext } : {})
      };
    } finally {
      db.close();
    }
  }

  getTemporalCoverage(query: TemporalCoverageQuery, context: RequestContext) {
    const normalized = normalizeCoverageQuery(query);
    const db = this.indexStore.openReady();
    try {
      const revision = this.indexRevision(db);
      const queryHash = hashQuery({ ...normalized.query, state: normalized.state });
      const cursor = query.cursor ? decodeCoverageCursor(query.cursor, queryHash, revision) : null;
      const base = this.findRows(db, normalized.query, context, false);
      const coverage = timeCoverage(base.rows, normalized.query);
      const matching = base.rows
        .filter((row) => temporalCoverageState(row, normalized.query) === normalized.state)
        .sort((left, right) => left.title.localeCompare(right.title) || left.object_id.localeCompare(right.object_id));
      const afterCursor = cursor
        ? matching.filter((row) => row.title.localeCompare(cursor.title) > 0 || (row.title === cursor.title && row.object_id > cursor.object_id))
        : matching;
      const page = afterCursor.slice(0, normalized.query.limit);
      const next = afterCursor.length > normalized.query.limit
        ? encodeCoverageCursor(page.at(-1)!, queryHash, revision)
        : null;
      return {
        items: page.map((row) => this.toCoverageItem(row, normalized.query, normalized.state)),
        time_coverage: coverage,
        query: { ...normalized.query, state: normalized.state },
        next_cursor: next,
        limit: normalized.query.limit,
        index_revision: revision
      };
    } finally {
      db.close();
    }
  }

  private findRows(db: ReturnType<IndexStore["open"]>, query: NormalizedTimelineQuery, context: RequestContext, applyTemporal: boolean) {
    const where: string[] = [];
    const joinParams: Array<string | number | null> = [];
    const params: Array<string | number | null> = [];
    const visible = this.visiblePredicate(context, "o");
    where.push(visible.sql);
    params.push(...visible.params);
    where.push("o.status = ?");
    params.push(query.status);
    if (query.kind) { where.push("o.object_kind = ?"); params.push(query.kind); }
    if (query.type) { where.push("o.type = ?"); params.push(query.type); }
    if (query.visibility) { where.push("o.visibility = ?"); params.push(query.visibility); }
    if (query.tag) { where.push("EXISTS (SELECT 1 FROM object_tags ot WHERE ot.object_id = o.id AND ot.tag_id = ?)"); params.push(query.tag); }
    const membership = query.scope ?? query.collection;
    if (membership && membership !== "scope.wiki") { where.push("EXISTS (SELECT 1 FROM object_scope_memberships osm WHERE osm.object_id = o.id AND osm.scope_id = ?)"); params.push(membership); }

    if (applyTemporal) this.addTemporalWhere(where, params, query);
    const centerContext = query.center ? this.centerContext(db, query.center, context) : null;
    if (query.center) {
      if (!centerContext) return { rows: [] as TimelineRow[], context: null };
      const ids = centerContext.object_ids;
      if (!ids.length) return { rows: [] as TimelineRow[], context: centerContext.response };
      where.push(`o.id IN (${ids.map(() => "?").join(",")})`);
      params.push(...ids);
    }
    const propertyJoin = query.basis === "custom"
      ? "LEFT JOIN timeline_property_values tp ON tp.object_id = o.id AND tp.property_path = ?"
      : "LEFT JOIN timeline_property_values tp ON 1 = 0";
    if (query.basis === "custom") joinParams.push(query.time_path!);
    const rows = db.prepare(
      `SELECT t.*, o.title, o.type, o.status, o.visibility, e.source_id, e.target_id,
              tp.property_path, tp.time_kind AS property_time_kind,
              tp.at_value AS property_at_value, tp.start_value AS property_start_value, tp.end_value AS property_end_value,
              tp.at_key AS property_at_key, tp.start_key AS property_start_key, tp.end_key AS property_end_key,
              tp.at_precision AS property_at_precision, tp.start_precision AS property_start_precision,
              tp.end_precision AS property_end_precision, tp.projection_status AS property_projection_status
       FROM timeline_items t
       JOIN objects o ON o.id = t.object_id
       LEFT JOIN edges e ON e.id = o.id
       ${propertyJoin}
       WHERE ${where.join(" AND ")}`
    ).all(...joinParams, ...params) as TimelineRow[];
    return { rows, context: centerContext?.response ?? null };
  }

  private addTemporalWhere(where: string[], params: Array<string | number | null>, query: NormalizedTimelineQuery) {
    if (query.legacy_all) return;
    const from = query.from ? normalizeTemporal(query.from, "start") : null;
    const to = query.to ? normalizeTemporal(query.to, "end") : null;
    if (query.temporal_state === "undated") {
      if (query.basis === "custom") where.push("tp.projection_status = 'undated'");
      else if (query.basis === "occurred") where.push("t.occurred_at IS NULL");
      else if (query.basis === "valid") where.push("t.valid_from IS NULL AND t.valid_to IS NULL");
      else where.push(query.basis === "created" ? "t.created_at_key IS NULL" : "t.updated_at_key IS NULL");
      return;
    }
    if (query.basis === "custom") {
      where.push("tp.projection_status = 'dated'");
      const point: string[] = ["tp.time_kind = 'point'", "tp.at_key IS NOT NULL"];
      const interval: string[] = ["tp.time_kind = 'interval'", "(tp.start_key IS NOT NULL OR tp.end_key IS NOT NULL)"];
      const pointParams: number[] = [];
      const intervalParams: number[] = [];
      if (from) { point.push("tp.at_key >= ?"); interval.push("(tp.end_key IS NULL OR tp.end_key >= ?)"); pointParams.push(from.key); intervalParams.push(from.key); }
      if (to) { point.push("tp.at_key <= ?"); interval.push("(tp.start_key IS NULL OR tp.start_key <= ?)"); pointParams.push(to.key); intervalParams.push(to.key); }
      where.push(`((${point.join(" AND ")}) OR (${interval.join(" AND ")}))`);
      params.push(...pointParams, ...intervalParams);
      return;
    }
    if (query.basis === "occurred") {
      where.push("t.occurred_at_key IS NOT NULL");
      if (from) { where.push("t.occurred_at_key >= ?"); params.push(from.key); }
      if (to) { where.push("t.occurred_at_key <= ?"); params.push(to.key); }
      return;
    }
    if (query.basis === "created" || query.basis === "updated") {
      const column = query.basis === "created" ? "t.created_at_key" : "t.updated_at_key";
      where.push(`${column} IS NOT NULL`);
      if (from) { where.push(`${column} >= ?`); params.push(from.key); }
      if (to) { where.push(`${column} <= ?`); params.push(to.key); }
      return;
    }
    // Invalid legacy temporal values have a raw source value but no key. They
    // are recorded as validation issues and do not become false open intervals.
    where.push("(t.valid_from IS NULL OR t.valid_from_key IS NOT NULL)");
    where.push("(t.valid_to IS NULL OR t.valid_to_key IS NOT NULL)");
    where.push("(t.valid_from_key IS NOT NULL OR t.valid_to_key IS NOT NULL)");
    if (from) { where.push("(t.valid_to_key IS NULL OR t.valid_to_key >= ?)"); params.push(from.key); }
    if (to) { where.push("(t.valid_from_key IS NULL OR t.valid_from_key <= ?)"); params.push(to.key); }
  }

  private groupKeys(db: ReturnType<IndexStore["open"]>, row: TimelineRow, groupBy: NonNullable<TimelineQuery["group_by"]>) {
    if (groupBy === "none") return [];
    if (groupBy === "type") return [row.type];
    if (groupBy === "tag") {
      const keys = db.prepare("SELECT tag_id FROM object_tags WHERE object_id = ? ORDER BY tag_id").all(row.object_id) as Array<{ tag_id: string }>;
      return keys.map((key) => key.tag_id).length ? keys.map((key) => key.tag_id) : ["_ungrouped"];
    }
    const prefix = groupBy === "scope" ? "scope.%" : "collection.%";
    const keys = db.prepare("SELECT DISTINCT scope_id FROM object_scope_memberships WHERE object_id = ? AND scope_id LIKE ? ORDER BY scope_id").all(row.object_id, prefix) as Array<{ scope_id: string }>;
    return keys.map((key) => key.scope_id).length ? keys.map((key) => key.scope_id) : ["_ungrouped"];
  }

  private toItem(
    db: ReturnType<IndexStore["open"]>,
    row: TimelineRow,
    group_keys: string[],
    context: RequestContext,
    query: NormalizedTimelineQuery
  ) {
    const tags = (db.prepare("SELECT tag_id FROM object_tags WHERE object_id = ? ORDER BY tag_id").all(row.object_id) as Array<{ tag_id: string }>).map((tag) => tag.tag_id);
    const base = {
      object_id: row.object_id,
      object_kind: row.object_kind,
      title: row.title,
      tags,
      status: row.status,
      visibility: row.visibility,
      temporal: { occurred_at: row.occurred_at, valid_from: row.valid_from, valid_to: row.valid_to },
      audit: { created_at: row.created_at, updated_at: row.updated_at },
      position: positionFor(row, query),
      group_keys
    };
    if (row.object_kind === "node") return { ...base, type: row.type };
    return {
      ...base,
      relation_type: row.type,
      source: this.endpointSummary(db, row.source_id, context),
      target: this.endpointSummary(db, row.target_id, context)
    };
  }

  private toCoverageItem(row: TimelineRow, query: NormalizedTimelineQuery, state: TemporalCoverageState) {
    return {
      object_id: row.object_id,
      object_kind: row.object_kind,
      title: row.title,
      type: row.type,
      status: row.status,
      visibility: row.visibility,
      state,
      reason: temporalCoverageReason(row, query, state)
    };
  }

  private endpointSummary(db: ReturnType<IndexStore["open"]>, id: string | null, context: RequestContext) {
    if (!id) return { kind: "unreadable_endpoint" as const };
    const visible = this.visiblePredicate(context, "o");
    const row = db.prepare(`SELECT o.id, o.title, o.object_kind, o.type FROM objects o WHERE o.id = ? AND ${visible.sql}`).get(id, ...visible.params) as { id: string; title: string; object_kind: string; type: string } | undefined;
    return row ? { object_id: row.id, title: row.title, object_kind: row.object_kind, type: row.type } : { kind: "unreadable_endpoint" as const };
  }

  private findPageRelations(db: ReturnType<IndexStore["open"]>, nodeIds: string[], context: RequestContext, query: NormalizedTimelineQuery) {
    if (nodeIds.length < 2) return [];
    const placeholders = nodeIds.map(() => "?").join(",");
    const visible = this.visiblePredicate(context, "eo");
    const propertyJoin = query.basis === "custom"
      ? "LEFT JOIN timeline_property_values ep ON ep.object_id = ge.edge_id AND ep.property_path = ?"
      : "LEFT JOIN timeline_property_values ep ON 1 = 0";
    const joinParams = query.basis === "custom" ? [query.time_path!] : [];
    const rows = db.prepare(
      `SELECT ge.edge_id, ge.relation_type, ge.source_id, ge.target_id,
              et.*, ep.time_kind AS property_time_kind, ep.at_value AS property_at_value,
              ep.start_value AS property_start_value, ep.end_value AS property_end_value,
              ep.at_key AS property_at_key, ep.start_key AS property_start_key, ep.end_key AS property_end_key
       FROM graph_edges ge
       JOIN objects eo ON eo.id = ge.edge_id
       LEFT JOIN timeline_items et ON et.object_id = ge.edge_id
       ${propertyJoin}
       WHERE ge.status = 'active'
         AND ge.source_id IN (${placeholders})
         AND ge.target_id IN (${placeholders})
         AND ${visible.sql}
       ORDER BY ge.relation_type, ge.edge_id`
    ).all(...joinParams, ...nodeIds, ...nodeIds, ...visible.params) as Array<TimelineRow & {
      edge_id: string;
      relation_type: string;
      source_id: string;
      target_id: string;
    }>;
    return rows.map((row) => {
      const branch = relationBranch(row, query);
      return { edge_id: row.edge_id, relation_type: row.relation_type, source_id: row.source_id!, target_id: row.target_id!, ...branch };
    });
  }

  private centerContext(db: ReturnType<IndexStore["open"]>, center: string, context: RequestContext) {
    const centerVisible = this.endpointSummary(db, center, context);
    if ("kind" in centerVisible) return null;
    const edgeVisible = this.visiblePredicate(context, "eo");
    const relations = db.prepare(
      `SELECT ge.edge_id, ge.relation_type, ge.source_id, ge.target_id
       FROM graph_edges ge JOIN objects eo ON eo.id = ge.edge_id
       WHERE ge.status = 'active' AND ${edgeVisible.sql}
         AND (ge.edge_id = ? OR ge.source_id = ? OR ge.target_id = ?)`
    ).all(...edgeVisible.params, center, center, center) as Array<{ edge_id: string; relation_type: string; source_id: string; target_id: string }>;
    const object_ids = Array.from(new Set([center, ...relations.flatMap((relation) => [relation.edge_id, relation.source_id, relation.target_id])]));
    return {
      object_ids,
      response: {
        center: centerVisible,
        relations: relations.map((relation) => ({
          relation_type: relation.relation_type,
          source: this.endpointSummary(db, relation.source_id, context),
          target: this.endpointSummary(db, relation.target_id, context)
        }))
      }
    };
  }

  private indexRevision(db: ReturnType<IndexStore["open"]>) {
    const row = db.prepare("SELECT value FROM index_meta WHERE key = ?").get("last_successful_build_id") as { value: string } | undefined;
    return row?.value ?? "incremental";
  }

  private visiblePredicate(context: RequestContext, alias: string) {
    if (this.permissionService) return this.permissionService.getVisibleObjectPredicate(context, alias);
    return context.isAnonymous ? { sql: `${alias}.visibility = ?`, params: ["public"] } : { sql: "1 = 1", params: [] };
  }
}

function normalizeQuery(query: TimelineQuery): NormalizedTimelineQuery {
  if (query.scope && query.collection) throw new LwsError("SCHEMA_INVALID", "scope and collection cannot be requested together.");
  const basis = query.basis ?? "created";
  const temporal_state = query.temporal_state ?? "dated";
  const group_by = query.group_by ?? "none";
  if (!["created", "updated", "occurred", "valid", "custom"].includes(basis)) throw new LwsError("SCHEMA_INVALID", "basis must be created, updated, occurred, valid, or custom.");
  if (basis === "custom") {
    if (!query.time_path || !isPropsPointer(query.time_path)) throw new LwsError("SCHEMA_INVALID", "custom basis requires time_path as a valid JSON Pointer below /props.");
  } else if (query.time_path) {
    throw new LwsError("SCHEMA_INVALID", "time_path is only allowed when basis=custom.");
  }
  if (!["dated", "undated"].includes(temporal_state)) throw new LwsError("SCHEMA_INVALID", "temporal_state must be dated or undated.");
  if (!["none", "type", "tag", "scope", "collection"].includes(group_by)) throw new LwsError("SCHEMA_INVALID", "group_by is not supported.");
  if (query.depth !== undefined && query.depth !== 1) throw new LwsError("SCHEMA_INVALID", "depth must be 1 for the ad-hoc Timeline.");
  if (query.from && !normalizeTemporal(query.from, "start")) throw new LwsError("SCHEMA_INVALID", "from must be an ISO full-date or offset datetime.");
  if (query.to && !normalizeTemporal(query.to, "end")) throw new LwsError("SCHEMA_INVALID", "to must be an ISO full-date or offset datetime.");
  const from = query.from ? normalizeTemporal(query.from, "start")! : null;
  const to = query.to ? normalizeTemporal(query.to, "end")! : null;
  if (from && to && from.key > to.key) throw new LwsError("SCHEMA_INVALID", "from must not be later than to.");
  const limit = query.limit === undefined ? 50 : query.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new LwsError("SCHEMA_INVALID", "limit must be an integer between 1 and 100.");
  const { cursor: _cursor, limit: _limit, ...filters } = query;
  return { ...filters, basis, temporal_state, status: query.status ?? "active", group_by, depth: query.depth ?? 1, limit };
}

function normalizeCoverageQuery(query: TemporalCoverageQuery): { query: NormalizedTimelineQuery; state: TemporalCoverageState } {
  const state = query.state;
  if (state !== "undated" && state !== "missing" && state !== "invalid") {
    throw new LwsError("SCHEMA_INVALID", "state must be undated, missing, or invalid.");
  }
  const { state: _state, cursor, ...filters } = query;
  const normalized = normalizeQuery({ ...filters, cursor, temporal_state: "dated", group_by: "none" });
  if (state === "missing" && normalized.basis !== "custom") {
    throw new LwsError("SCHEMA_INVALID", "missing coverage is only available for basis=custom.");
  }
  return { query: normalized, state };
}

function countGroups(entries: Array<{ group_keys: string[] }>) {
  const counts = new Map<string, number>();
  for (const entry of entries) for (const key of entry.group_keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => ({ key, count }));
}

function compareRows(a: TimelineRow, b: TimelineRow, query: NormalizedTimelineQuery) {
  if (query.temporal_state === "undated") return a.title.localeCompare(b.title) || a.object_id.localeCompare(b.object_id);
  const aKey = rowSortKey(a, query);
  const bKey = rowSortKey(b, query);
  return aKey - bKey || a.object_id.localeCompare(b.object_id);
}

function positionFor(row: TimelineRow, query: NormalizedTimelineQuery) {
  if (query.temporal_state === "undated") return { kind: "undated" as const };
  if (query.legacy_all) {
    if (row.occurred_at_key !== null) return { kind: "point" as const, at: row.occurred_at!, normalized_at: row.occurred_at_key, precision: row.occurred_at_precision! };
    if (row.valid_from_key !== null || row.valid_to_key !== null) return intervalPosition(row.valid_from, row.valid_to, row.valid_from_key, row.valid_to_key, row.valid_from_precision, row.valid_to_precision);
  }
  if (query.basis === "created" || query.basis === "updated") {
    const created = query.basis === "created";
    return {
      kind: "point" as const,
      at: created ? row.created_at : row.updated_at,
      normalized_at: (created ? row.created_at_key : row.updated_at_key)!,
      precision: (created ? row.created_at_precision : row.updated_at_precision)!
    };
  }
  if (query.basis === "occurred") return { kind: "point" as const, at: row.occurred_at!, normalized_at: row.occurred_at_key!, precision: row.occurred_at_precision! };
  if (query.basis === "custom") {
    if (row.property_time_kind === "point") return { kind: "point" as const, at: row.property_at_value!, normalized_at: row.property_at_key!, precision: row.property_at_precision! };
    return intervalPosition(row.property_start_value, row.property_end_value, row.property_start_key, row.property_end_key, row.property_start_precision, row.property_end_precision);
  }
  return intervalPosition(row.valid_from, row.valid_to, row.valid_from_key, row.valid_to_key, row.valid_from_precision, row.valid_to_precision);
}

function timelineDomain(rows: TimelineRow[], query: NormalizedTimelineQuery) {
  if (query.temporal_state === "undated") return { min_key: null, max_key: null };
  const keys = rows.flatMap((row) => rowDomainKeys(row, query)).filter((key): key is number => key !== null);
  return {
    min_key: keys.length ? Math.min(...keys) : null,
    max_key: keys.length ? Math.max(...keys) : null
  };
}

function isAfterCursor(row: TimelineRow, cursor: Cursor, query: NormalizedTimelineQuery) {
  if (cursor.mode === "undated") return row.title.localeCompare(cursor.title) > 0 || (row.title === cursor.title && row.object_id > cursor.object_id);
  const key = rowSortKey(row, query);
  return key > cursor.sort_key || (key === cursor.sort_key && row.object_id > cursor.object_id);
}

function hashQuery(query: NormalizedTimelineQuery | Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(query)).digest("base64url").slice(0, 24);
}

function encodeCursor(row: TimelineRow, query: NormalizedTimelineQuery, queryHash: string, revision: string) {
  const cursor: Cursor = query.temporal_state === "undated"
    ? { mode: "undated", title: row.title, object_id: row.object_id, query_hash: queryHash, revision }
    : { mode: "dated", sort_key: rowSortKey(row, query), object_id: row.object_id, query_hash: queryHash, revision };
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function intervalPosition(
  start: string | null, end: string | null,
  normalized_start: number | null, normalized_end: number | null,
  start_precision: TemporalPrecision | null, end_precision: TemporalPrecision | null
) {
  return { kind: "interval" as const, start, end, normalized_start, normalized_end, start_precision, end_precision };
}

function rowSortKey(row: TimelineRow, query: NormalizedTimelineQuery) {
  if (query.basis === "created") return row.created_at_key!;
  if (query.basis === "updated") return row.updated_at_key!;
  if (query.basis === "occurred") return row.occurred_at_key!;
  if (query.basis === "valid") return row.valid_from_key ?? row.valid_to_key!;
  if (query.basis === "custom") return row.property_time_kind === "point" ? row.property_at_key! : row.property_start_key ?? row.property_end_key!;
  return row.occurred_at_key ?? row.valid_from_key ?? row.valid_to_key ?? row.created_at_key!;
}

function rowDomainKeys(row: TimelineRow, query: NormalizedTimelineQuery): Array<number | null> {
  if (query.basis === "created") return [row.created_at_key];
  if (query.basis === "updated") return [row.updated_at_key];
  if (query.basis === "occurred") return [row.occurred_at_key];
  if (query.basis === "valid") return [row.valid_from_key, row.valid_to_key];
  if (query.basis === "custom") return row.property_time_kind === "point" ? [row.property_at_key] : [row.property_start_key, row.property_end_key];
  return [row.occurred_at_key, row.valid_from_key, row.valid_to_key, row.created_at_key];
}

function timeCoverage(rows: TimelineRow[], query: NormalizedTimelineQuery) {
  let declared = 0; let dated = 0; let undated = 0; let invalid = 0;
  for (const row of rows) {
    const state = temporalCoverageState(row, query);
    if (state !== "missing") declared += 1;
    if (state === "dated") dated += 1;
    else if (state === "undated") undated += 1;
    else if (state === "invalid") invalid += 1;
  }
  return {
    matching_count: rows.length,
    declared_count: declared,
    dated_count: dated,
    undated_count: undated,
    missing_count: rows.length - declared,
    invalid_count: invalid
  };
}

function temporalCoverageState(row: TimelineRow, query: NormalizedTimelineQuery): "dated" | TemporalCoverageState {
  if (query.basis === "custom") {
    if (!row.property_path) return "missing";
    if (row.property_projection_status === "dated") return "dated";
    if (row.property_projection_status === "undated") return "undated";
    return "invalid";
  }
  if (query.basis === "occurred") {
    if (row.occurred_at === null) return "undated";
    return row.occurred_at_key === null ? "invalid" : "dated";
  }
  if (query.basis === "valid") {
    if (row.valid_from === null && row.valid_to === null) return "undated";
    if ((row.valid_from !== null && row.valid_from_key === null) || (row.valid_to !== null && row.valid_to_key === null)) return "invalid";
    return "dated";
  }
  const value = query.basis === "created" ? row.created_at_key : row.updated_at_key;
  return value === null ? "invalid" : "dated";
}

function temporalCoverageReason(row: TimelineRow, query: NormalizedTimelineQuery, state: TemporalCoverageState): string {
  if (state === "missing") return `No $temporal wrapper exists at ${query.time_path}.`;
  if (state === "undated") return query.basis === "custom" ? "The temporal wrapper explicitly declares no time value." : "No value is declared for the selected temporal basis.";
  if (query.basis === "custom") return "The temporal wrapper could not be projected because its value is invalid.";
  if (query.basis === "valid") return "The validity interval is malformed or ends before it starts.";
  return "The temporal value could not be normalized.";
}

function relationBranch(row: TimelineRow, query: NormalizedTimelineQuery) {
  if (query.basis === "created") return { branch_at: row.created_at, normalized_branch_at: row.created_at_key };
  if (query.basis === "updated") return { branch_at: row.updated_at, normalized_branch_at: row.updated_at_key };
  if (query.basis === "valid") return { branch_at: row.valid_from ?? row.valid_to, normalized_branch_at: row.valid_from_key ?? row.valid_to_key };
  if (query.basis === "custom") return row.property_time_kind === "point"
    ? { branch_at: row.property_at_value, normalized_branch_at: row.property_at_key }
    : { branch_at: row.property_start_value ?? row.property_end_value, normalized_branch_at: row.property_start_key ?? row.property_end_key };
  return { branch_at: row.occurred_at, normalized_branch_at: row.occurred_at_key };
}

function isPropsPointer(value: string) {
  if (!value.startsWith("/props/") || value.endsWith("/$temporal")) return false;
  return value.split("/").slice(1).every((segment) => !/~(?![01])/u.test(segment));
}

function decodeCursor(value: string, queryHash: string, revision: string, temporalState: "dated" | "undated"): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor;
    if (parsed.query_hash !== queryHash || parsed.revision !== revision || parsed.mode !== temporalState) throw new Error("mismatch");
    return parsed;
  } catch {
    throw new LwsError("CURSOR_INVALID", "Timeline cursor does not match the current query or index revision.");
  }
}

function decodeCoverageCursor(value: string, queryHash: string, revision: string): CoverageCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as CoverageCursor;
    if (parsed.query_hash !== queryHash || parsed.revision !== revision) throw new Error("mismatch");
    return parsed;
  } catch {
    throw new LwsError("CURSOR_INVALID", "Coverage cursor does not match the current query or index revision.");
  }
}

function encodeCoverageCursor(row: TimelineRow, queryHash: string, revision: string) {
  return Buffer.from(JSON.stringify({ title: row.title, object_id: row.object_id, query_hash: queryHash, revision } satisfies CoverageCursor)).toString("base64url");
}
