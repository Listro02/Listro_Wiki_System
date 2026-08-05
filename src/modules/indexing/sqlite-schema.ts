export const INDEX_SCHEMA_VERSION = 5;

export const CREATE_INDEX_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS index_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS index_builds (
  build_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  object_count INTEGER NOT NULL DEFAULT 0,
  edge_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  schema_version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS objects (
  id TEXT PRIMARY KEY,
  object_kind TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  visibility TEXT NOT NULL,
  detail_mode TEXT NOT NULL,
  summary TEXT,
  rev INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  search_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation_type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS object_tags (
  object_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (object_id, tag_id)
);

CREATE TABLE IF NOT EXISTS graph_edges (
  edge_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  status TEXT NOT NULL,
  visibility TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timeline_items (
  object_id TEXT PRIMARY KEY,
  object_kind TEXT NOT NULL,
  occurred_at TEXT,
  valid_from TEXT,
  valid_to TEXT,
  occurred_at_key INTEGER,
  valid_from_key INTEGER,
  valid_to_key INTEGER,
  occurred_at_precision TEXT,
  valid_from_precision TEXT,
  valid_to_precision TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_at_key INTEGER,
  updated_at_key INTEGER,
  created_at_precision TEXT,
  updated_at_precision TEXT
);

CREATE TABLE IF NOT EXISTS timeline_property_values (
  object_id TEXT NOT NULL,
  property_path TEXT NOT NULL,
  time_kind TEXT NOT NULL,
  at_value TEXT,
  start_value TEXT,
  end_value TEXT,
  at_key INTEGER,
  start_key INTEGER,
  end_key INTEGER,
  at_precision TEXT,
  start_precision TEXT,
  end_precision TEXT,
  projection_status TEXT NOT NULL,
  PRIMARY KEY (object_id, property_path)
);

CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  object_id TEXT NOT NULL,
  object_kind TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  base_rev INTEGER NOT NULL,
  next_rev INTEGER NOT NULL,
  account_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  object_history_path TEXT NOT NULL,
  patch_path TEXT NOT NULL,
  before_hash TEXT,
  after_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS object_history (
  event_id TEXT PRIMARY KEY,
  object_id TEXT NOT NULL,
  object_kind TEXT NOT NULL,
  event_ref TEXT NOT NULL,
  line INTEGER NOT NULL,
  byte_offset INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  base_rev INTEGER NOT NULL,
  next_rev INTEGER NOT NULL,
  occurred_at TEXT NOT NULL,
  summary TEXT NOT NULL,
  patch_path TEXT NOT NULL,
  after_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS validation_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id TEXT,
  object_kind TEXT,
  code TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  target TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  account_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_groups (
  account_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  source_edge_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS object_owners (
  object_kind TEXT NOT NULL,
  object_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  source_edge_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS object_scope_memberships (
  object_id TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  source_edge_id TEXT NOT NULL,
  depth INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (object_id, scope_id, source_edge_id)
);

CREATE TABLE IF NOT EXISTS account_permissions (
  account_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  scope_kind TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  source_edge_id TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_objects_visibility_status ON objects (visibility, status);
CREATE INDEX IF NOT EXISTS idx_objects_type ON objects (type);
CREATE INDEX IF NOT EXISTS idx_object_tags_tag ON object_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges (source_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges (target_id);
CREATE INDEX IF NOT EXISTS idx_timeline_occurred_key ON timeline_items (occurred_at_key);
CREATE INDEX IF NOT EXISTS idx_timeline_valid_from_key ON timeline_items (valid_from_key);
CREATE INDEX IF NOT EXISTS idx_timeline_valid_to_key ON timeline_items (valid_to_key);
CREATE INDEX IF NOT EXISTS idx_timeline_kind_occurred_key ON timeline_items (object_kind, occurred_at_key);
CREATE INDEX IF NOT EXISTS idx_timeline_kind_valid_range ON timeline_items (object_kind, valid_from_key, valid_to_key);
CREATE INDEX IF NOT EXISTS idx_timeline_created_key ON timeline_items (created_at_key, object_id);
CREATE INDEX IF NOT EXISTS idx_timeline_updated_key ON timeline_items (updated_at_key, object_id);
CREATE INDEX IF NOT EXISTS idx_timeline_property_point ON timeline_property_values (property_path, at_key, object_id);
CREATE INDEX IF NOT EXISTS idx_timeline_property_interval ON timeline_property_values (property_path, start_key, end_key, object_id);
CREATE INDEX IF NOT EXISTS idx_events_object ON events (object_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_object_history_object ON object_history (object_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_object_scope_memberships_object ON object_scope_memberships (object_id, scope_id);
CREATE INDEX IF NOT EXISTS idx_account_permissions_account_scope ON account_permissions (account_id, capability, scope_id);
`;

export const CLEAR_PROJECTION_SQL = `
DELETE FROM objects;
DELETE FROM nodes;
DELETE FROM edges;
DELETE FROM object_tags;
DELETE FROM graph_edges;
DELETE FROM timeline_items;
DELETE FROM timeline_property_values;
DELETE FROM events;
DELETE FROM object_history;
DELETE FROM validation_issues;
DELETE FROM accounts;
DELETE FROM account_groups;
DELETE FROM object_owners;
DELETE FROM object_scope_memberships;
DELETE FROM account_permissions;
`;
