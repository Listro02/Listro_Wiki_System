import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { RuntimeConfig } from "../config/runtime-config.ts";
import type { GlobalMutationEvent, ObjectHistoryLink } from "../events/event-types.ts";
import type { LwsEdge, LwsNode, LwsObject } from "../../shared/object-model.ts";
import { LwsError } from "../../shared/errors.ts";
import { CLEAR_PROJECTION_SQL, CREATE_INDEX_SCHEMA_SQL, INDEX_SCHEMA_VERSION } from "./sqlite-schema.ts";
import { normalizeTemporal } from "./temporal-normalization.ts";
import { extractPropertyTemporalValues } from "./property-temporal.ts";

export type IndexState = "ready" | "INDEX_STALE" | "INDEX_REBUILD_REQUIRED" | "INDEX_CORRUPT" | "INDEX_SCHEMA_MISMATCH";

export type IndexStoreStatus = {
  state: IndexState;
  sqlitePath: string;
  schemaVersion: number | null;
};

export class IndexStore {
  private readonly config: RuntimeConfig;

  constructor(config: RuntimeConfig) {
    this.config = config;
  }

  getStatus(): IndexStoreStatus {
    if (!fs.existsSync(this.config.index.sqlitePath)) {
      return {
        state: "INDEX_REBUILD_REQUIRED",
        sqlitePath: this.config.index.sqlitePath,
        schemaVersion: null
      };
    }

    let db: DatabaseSync | null = null;
    try {
      db = this.open();
      const row = db.prepare("SELECT value FROM index_meta WHERE key = ?").get("schema_version") as
        | { value: string }
        | undefined;
      const stateRow = db.prepare("SELECT value FROM index_meta WHERE key = ?").get("index_state") as
        | { value: string }
        | undefined;
      const schemaVersion = row ? Number(row.value) : null;
      const indexState = stateRow?.value === "INDEX_STALE" ? "INDEX_STALE" : "ready";
      return {
        state: schemaVersion === INDEX_SCHEMA_VERSION ? indexState : "INDEX_SCHEMA_MISMATCH",
        sqlitePath: this.config.index.sqlitePath,
        schemaVersion
      };
    } catch {
      return {
        state: "INDEX_CORRUPT",
        sqlitePath: this.config.index.sqlitePath,
        schemaVersion: null
      };
    } finally {
      db?.close();
    }
  }

  open(): DatabaseSync {
    fs.mkdirSync(path.dirname(this.config.index.sqlitePath), { recursive: true });
    return new DatabaseSync(this.config.index.sqlitePath);
  }

  openReady(): DatabaseSync {
    const status = this.getStatus();
    if (status.state !== "ready") {
      throw new LwsError(status.state, "SQLite projection is not ready for query.", {
        sqlite_path: status.sqlitePath,
        schema_version: status.schemaVersion
      });
    }

    return this.open();
  }

  initialize(db: DatabaseSync): void {
    const existingSchemaVersion = getExistingSchemaVersion(db);
    if (existingSchemaVersion !== null && existingSchemaVersion !== INDEX_SCHEMA_VERSION) {
      db.exec(DROP_INDEX_SCHEMA_SQL);
    }

    db.exec(CREATE_INDEX_SCHEMA_SQL);
    db.prepare("INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)").run(
      "schema_version",
      String(INDEX_SCHEMA_VERSION)
    );
    db.prepare("INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)").run("index_state", "ready");
  }

  getDataRoot(): string {
    return this.config.roots.data;
  }

  clearProjection(db: DatabaseSync): void {
    db.exec(CLEAR_PROJECTION_SQL);
  }

  insertObject(db: DatabaseSync, object: LwsObject): void {
    const objectType = object.object_kind === "node" ? object.type : object.type;
    this.deleteObjectProjectionRows(db, object.id);
    db.prepare(
      `INSERT OR REPLACE INTO objects
        (id, object_kind, title, type, status, visibility, detail_mode, summary, rev, created_at, updated_at, search_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      object.id,
      object.object_kind,
      object.title,
      objectType,
      object.status,
      object.visibility,
      object.detail_mode,
      object.summary ?? null,
      object.rev,
      object.audit.created_at,
      object.audit.updated_at,
      buildSearchText(object)
    );

    for (const tag of object.tags) {
      db.prepare("INSERT OR REPLACE INTO object_tags (object_id, tag_id) VALUES (?, ?)").run(object.id, tag);
    }

    const occurred = object.temporal.occurred_at ? normalizeTemporal(object.temporal.occurred_at, "start") : null;
    const validFrom = object.temporal.valid_from ? normalizeTemporal(object.temporal.valid_from, "start") : null;
    const validTo = object.temporal.valid_to ? normalizeTemporal(object.temporal.valid_to, "end") : null;
    const created = normalizeTemporal(object.audit.created_at, "start");
    const updated = normalizeTemporal(object.audit.updated_at, "start");
    const reversedValidity = Boolean(validFrom && validTo && validFrom.key > validTo.key);

    db.prepare(
      `INSERT OR REPLACE INTO timeline_items
        (object_id, object_kind, occurred_at, valid_from, valid_to,
         occurred_at_key, valid_from_key, valid_to_key,
         occurred_at_precision, valid_from_precision, valid_to_precision, created_at, updated_at,
         created_at_key, updated_at_key, created_at_precision, updated_at_precision)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      object.id,
      object.object_kind,
      object.temporal.occurred_at,
      object.temporal.valid_from,
      object.temporal.valid_to,
      occurred?.key ?? null,
      reversedValidity ? null : validFrom?.key ?? null,
      reversedValidity ? null : validTo?.key ?? null,
      occurred?.precision ?? null,
      reversedValidity ? null : validFrom?.precision ?? null,
      reversedValidity ? null : validTo?.precision ?? null,
      object.audit.created_at,
      object.audit.updated_at,
      created?.key ?? null,
      updated?.key ?? null,
      created?.precision ?? null,
      updated?.precision ?? null
    );

    for (const value of extractPropertyTemporalValues(object.props).values) {
      db.prepare(
        `INSERT OR REPLACE INTO timeline_property_values
          (object_id, property_path, time_kind, at_value, start_value, end_value,
           at_key, start_key, end_key, at_precision, start_precision, end_precision, projection_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        object.id, value.property_path, value.time_kind,
        value.at_value, value.start_value, value.end_value,
        value.at_key, value.start_key, value.end_key,
        value.at_precision, value.start_precision, value.end_precision, value.projection_status
      );
    }

    if (object.object_kind === "node") {
      this.insertNode(db, object);
    } else {
      this.insertEdge(db, object);
    }
  }

  insertEventProjection(db: DatabaseSync, event: GlobalMutationEvent): void {
    db.prepare(
      `INSERT OR REPLACE INTO events
        (event_id, object_id, object_kind, event_type, occurred_at, base_rev, next_rev, account_id,
         summary, object_history_path, patch_path, before_hash, after_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      event.event_id,
      event.object_id,
      event.object_kind,
      event.event_type,
      event.occurred_at,
      event.base_rev,
      event.next_rev,
      event.account_id,
      event.summary,
      event.object_history_path,
      event.patch_path,
      event.before_hash,
      event.after_hash
    );
  }

  insertObjectHistoryProjection(
    db: DatabaseSync,
    objectKind: "node" | "edge",
    objectId: string,
    history: ObjectHistoryLink
  ): void {
    db.prepare(
      `INSERT OR REPLACE INTO object_history
        (event_id, object_id, object_kind, event_ref, line, byte_offset, event_type, base_rev,
         next_rev, occurred_at, summary, patch_path, after_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      history.event_id,
      objectId,
      objectKind,
      history.event_ref,
      history.line,
      history.byte_offset,
      history.event_type,
      history.base_rev,
      history.next_rev,
      history.occurred_at,
      history.summary,
      history.patch_path,
      history.after_hash
    );
  }

  listObjectHistoryProjection(objectId: string): ObjectHistoryLink[] {
    const db = this.openReady();
    try {
      return db
        .prepare(
          `SELECT event_id, event_ref, line, byte_offset, event_type, base_rev, next_rev, occurred_at,
                  summary, patch_path, after_hash
           FROM object_history
           WHERE object_id = ?
           ORDER BY occurred_at ASC, line ASC`
        )
        .all(objectId)
        .map((row: any) => ({
          schema_version: 1,
          event_id: row.event_id,
          event_ref: row.event_ref,
          line: row.line,
          byte_offset: row.byte_offset,
          event_type: row.event_type,
          base_rev: row.base_rev,
          next_rev: row.next_rev,
          occurred_at: row.occurred_at,
          summary: row.summary,
          patch_path: row.patch_path,
          after_hash: row.after_hash
        }));
    } finally {
      db.close();
    }
  }

  updateObjectProjection(object: LwsObject): "updated" | "missing" | "stale" {
    const status = this.getStatus();
    if (status.state === "INDEX_REBUILD_REQUIRED" || status.state === "INDEX_CORRUPT" || status.state === "INDEX_SCHEMA_MISMATCH") {
      return "missing";
    }

    const db = this.open();
    try {
      db.exec("BEGIN");
      const oldPermissionRelevant = this.isExistingPermissionProjectionRelevant(db, object.id);
      this.insertObject(db, object);
      if (oldPermissionRelevant || isPermissionProjectionRelevantObject(object)) {
        this.rebuildPermissionProjection(db);
      }
      db.prepare("INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)").run("index_state", "ready");
      db.exec("COMMIT");
      return status.state === "INDEX_STALE" ? "stale" : "updated";
    } catch {
      db.exec("ROLLBACK");
      this.markStale("incremental projection update failed");
      return "stale";
    } finally {
      db.close();
    }
  }

  updateMutationProjection(event: GlobalMutationEvent, history: ObjectHistoryLink): "updated" | "missing" | "stale" {
    const status = this.getStatus();
    if (status.state === "INDEX_REBUILD_REQUIRED" || status.state === "INDEX_CORRUPT" || status.state === "INDEX_SCHEMA_MISMATCH") {
      return "missing";
    }

    const db = this.open();
    try {
      db.exec("BEGIN");
      this.insertEventProjection(db, event);
      this.insertObjectHistoryProjection(db, event.object_kind, event.object_id, history);
      db.prepare("INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)").run("index_state", "ready");
      db.exec("COMMIT");
      return status.state === "INDEX_STALE" ? "stale" : "updated";
    } catch {
      db.exec("ROLLBACK");
      this.markStale("incremental event/history projection update failed");
      return "stale";
    } finally {
      db.close();
    }
  }

  replaceValidationIssues(
    issues: Array<{
      object_id: string | null;
      object_kind: string | null;
      code: string;
      severity: string;
      message: string;
      target?: string;
    }>
  ): "updated" | "missing" {
    const status = this.getStatus();
    if (status.state === "INDEX_REBUILD_REQUIRED" || status.state === "INDEX_CORRUPT" || status.state === "INDEX_SCHEMA_MISMATCH") {
      return "missing";
    }

    const db = this.open();
    try {
      db.exec("BEGIN");
      db.prepare("DELETE FROM validation_issues").run();
      for (const issue of issues) {
        this.insertValidationIssue(db, issue);
      }
      db.exec("COMMIT");
      return "updated";
    } catch {
      db.exec("ROLLBACK");
      this.markStale("validation issue projection update failed");
      return "missing";
    } finally {
      db.close();
    }
  }

  rebuildPermissionProjection(db: DatabaseSync): void {
    db.prepare("DELETE FROM accounts").run();
    db.prepare("DELETE FROM account_groups").run();
    db.prepare("DELETE FROM object_owners").run();
    db.prepare("DELETE FROM object_scope_memberships").run();
    db.prepare("DELETE FROM account_permissions").run();

    db.prepare(
      `INSERT OR REPLACE INTO accounts (account_id, status, display_name)
       SELECT id, status, title FROM objects WHERE id LIKE 'account.%'`
    ).run();

    db.prepare(
      `INSERT INTO account_groups (account_id, group_id, source_edge_id)
       SELECT source_id, target_id, edge_id FROM graph_edges
       WHERE relation_type = 'rel.member_of'
         AND status = 'active'
         AND source_id LIKE 'account.%'`
    ).run();

    db.prepare(
      `WITH RECURSIVE containment(scope_id, object_id, source_edge_id, depth, path) AS (
         SELECT source_id, target_id, edge_id, 1, source_id || '>' || target_id
         FROM graph_edges
         WHERE relation_type = 'rel.contains'
           AND status = 'active'
           AND (source_id LIKE 'scope.%' OR source_id LIKE 'collection.%')
         UNION ALL
         SELECT c.scope_id, ge.target_id, ge.edge_id, c.depth + 1, c.path || '>' || ge.target_id
         FROM containment c
         JOIN graph_edges ge ON ge.source_id = c.object_id
         WHERE ge.relation_type = 'rel.contains'
           AND ge.status = 'active'
           AND c.depth < 16
           AND instr(c.path, ge.target_id) = 0
       )
       INSERT OR IGNORE INTO object_scope_memberships (object_id, scope_id, source_edge_id, depth)
       SELECT c.object_id, c.scope_id, c.source_edge_id, c.depth
       FROM containment c
       JOIN objects o ON o.id = c.object_id`
    ).run();

    db.prepare(
      `INSERT INTO object_owners (object_kind, object_id, account_id, source_edge_id)
       SELECT o.object_kind, ge.target_id, ge.source_id, ge.edge_id
       FROM graph_edges ge
       JOIN objects o ON o.id = ge.target_id
       WHERE ge.relation_type = 'rel.owns'
         AND ge.status = 'active'
         AND ge.source_id LIKE 'account.%'`
    ).run();

    db.prepare(
      `INSERT INTO object_owners (object_kind, object_id, account_id, source_edge_id)
       SELECT o.object_kind, ge.target_id, ag.account_id, ge.edge_id
       FROM graph_edges ge
       JOIN account_groups ag ON ag.group_id = ge.source_id
       JOIN objects o ON o.id = ge.target_id
       WHERE ge.relation_type = 'rel.owns'
         AND ge.status = 'active'
         AND ge.source_id LIKE 'group.%'`
    ).run();

    for (const relation of CAPABILITY_RELATIONS) {
      db.prepare(
        `INSERT INTO account_permissions (account_id, capability, scope_kind, scope_id, source_edge_id, priority)
         SELECT source_id, ?, ${scopeKindSql("target_id")}, target_id, edge_id, 10
         FROM graph_edges
         WHERE relation_type = ?
           AND status = 'active'
           AND source_id LIKE 'account.%'`
      ).run(relation, relation);

      db.prepare(
        `INSERT INTO account_permissions (account_id, capability, scope_kind, scope_id, source_edge_id, priority)
         SELECT ag.account_id, ?, ${scopeKindSql("ge.target_id")}, ge.target_id, ge.edge_id, 5
         FROM graph_edges ge
         JOIN account_groups ag ON ag.group_id = ge.source_id
         WHERE ge.relation_type = ?
           AND ge.status = 'active'
           AND ge.source_id LIKE 'group.%'`
      ).run(relation, relation);
    }
  }

  markStale(reason: string): void {
    const db = this.open();
    try {
      this.initialize(db);
      db.prepare("INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)").run("index_state", "INDEX_STALE");
      db.prepare("INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)").run("index_stale_reason", reason);
    } finally {
      db.close();
    }
  }

  insertValidationIssue(
    db: DatabaseSync,
    issue: {
      object_id: string | null;
      object_kind: string | null;
      code: string;
      severity: string;
      message: string;
      target?: string;
    }
  ): void {
    db.prepare(
      `INSERT INTO validation_issues (object_id, object_kind, code, severity, message, target)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(issue.object_id, issue.object_kind, issue.code, issue.severity, issue.message, issue.target ?? null);
  }

  private insertNode(db: DatabaseSync, node: LwsNode): void {
    db.prepare("INSERT OR REPLACE INTO nodes (id, slug) VALUES (?, ?)").run(node.id, node.slug);
  }

  private deleteObjectProjectionRows(db: DatabaseSync, objectId: string): void {
    db.prepare("DELETE FROM object_tags WHERE object_id = ?").run(objectId);
    db.prepare("DELETE FROM nodes WHERE id = ?").run(objectId);
    db.prepare("DELETE FROM edges WHERE id = ?").run(objectId);
    db.prepare("DELETE FROM graph_edges WHERE edge_id = ?").run(objectId);
    db.prepare("DELETE FROM timeline_items WHERE object_id = ?").run(objectId);
    db.prepare("DELETE FROM timeline_property_values WHERE object_id = ?").run(objectId);
  }

  private insertEdge(db: DatabaseSync, edge: LwsEdge): void {
    db.prepare("INSERT OR REPLACE INTO edges (id, source_id, target_id, relation_type) VALUES (?, ?, ?, ?)").run(
      edge.id,
      edge.source,
      edge.target,
      edge.type
    );
    db.prepare(
      `INSERT OR REPLACE INTO graph_edges (edge_id, source_id, target_id, relation_type, status, visibility)
      VALUES (?, ?, ?, ?, ?, ?)`
    ).run(edge.id, edge.source, edge.target, edge.type, edge.status, edge.visibility);
  }

  private isExistingPermissionProjectionRelevant(db: DatabaseSync, objectId: string): boolean {
    const objectRow = db.prepare("SELECT id, type FROM objects WHERE id = ?").get(objectId) as
      | { id: string; type: string }
      | undefined;
    if (
      objectRow &&
      (isPermissionProjectionRelevantNodeId(objectRow.id) ||
        PERMISSION_RELEVANT_NODE_TYPES.includes(objectRow.type as (typeof PERMISSION_RELEVANT_NODE_TYPES)[number]))
    ) {
      return true;
    }

    const edgeRow = db.prepare("SELECT relation_type FROM graph_edges WHERE edge_id = ?").get(objectId) as
      | { relation_type: string }
      | undefined;
    return Boolean(
      edgeRow &&
        PERMISSION_PROJECTION_RELEVANT_RELATIONS.includes(
          edgeRow.relation_type as (typeof PERMISSION_PROJECTION_RELEVANT_RELATIONS)[number]
        )
    );
  }
}

const DROP_INDEX_SCHEMA_SQL = `
DROP TABLE IF EXISTS index_meta;
DROP TABLE IF EXISTS index_builds;
DROP TABLE IF EXISTS objects;
DROP TABLE IF EXISTS nodes;
DROP TABLE IF EXISTS edges;
DROP TABLE IF EXISTS object_tags;
DROP TABLE IF EXISTS graph_edges;
DROP TABLE IF EXISTS timeline_items;
DROP TABLE IF EXISTS timeline_property_values;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS object_history;
DROP TABLE IF EXISTS validation_issues;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS account_groups;
DROP TABLE IF EXISTS object_owners;
DROP TABLE IF EXISTS object_scope_memberships;
DROP TABLE IF EXISTS account_permissions;
`;

function getExistingSchemaVersion(db: DatabaseSync): number | null {
  try {
    const row = db.prepare("SELECT value FROM index_meta WHERE key = ?").get("schema_version") as
      | { value: string }
      | undefined;
    return row ? Number(row.value) : null;
  } catch {
    return null;
  }
}

const PERMISSION_PROJECTION_RELEVANT_RELATIONS = [
  "rel.owns",
  "rel.member_of",
  "rel.contains",
  "rel.can_read",
  "rel.can_read_in",
  "rel.can_create_in",
  "rel.can_update",
  "rel.can_update_in",
  "rel.can_manage_in"
] as const;

const CAPABILITY_RELATIONS = [
  "rel.can_read",
  "rel.can_read_in",
  "rel.can_create_in",
  "rel.can_update",
  "rel.can_update_in",
  "rel.can_manage_in"
] as const;

const PERMISSION_RELEVANT_NODE_TYPES = ["type.account", "type.group", "type.scope", "type.collection"] as const;

function isPermissionProjectionRelevantObject(object: LwsObject): boolean {
  if (object.object_kind === "node") {
    return isPermissionProjectionRelevantNodeId(object.id) || PERMISSION_RELEVANT_NODE_TYPES.includes(object.type as any);
  }

  return PERMISSION_PROJECTION_RELEVANT_RELATIONS.includes(
    object.type as (typeof PERMISSION_PROJECTION_RELEVANT_RELATIONS)[number]
  );
}

function isPermissionProjectionRelevantNodeId(id: string): boolean {
  return (
    id.startsWith("account.") ||
    id.startsWith("group.") ||
    id.startsWith("scope.") ||
    id.startsWith("collection.")
  );
}

function scopeKindSql(column: string): string {
  return `CASE WHEN ${column} LIKE 'scope.%' THEN 'scope' WHEN ${column} LIKE 'collection.%' THEN 'collection' ELSE 'object' END`;
}

function buildSearchText(object: LwsObject): string {
  const aliases = "aliases" in object && Array.isArray(object.aliases) ? object.aliases.join(" ") : "";
  const content = object.content?.body ?? "";
  return [object.id, object.title, object.summary ?? "", aliases, content].join(" ").toLowerCase();
}
