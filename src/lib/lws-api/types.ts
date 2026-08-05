export type ObjectKind = "node" | "edge";
export type Visibility = "private" | "public";
export type ObjectStatus = "active" | "draft" | "stub" | "archived" | "deleted";
export type NodeDetailMode = "stub" | "note" | "page" | "view" | "system";
export type EdgeDetailMode = "stub" | "note" | "page";

export type LwsAuthContext = {
  adminMode: boolean;
  localAdminSecret: string;
  env?: string;
};

export type LwsApiError = {
  code: string;
  message: string;
  details?: unknown;
  status: number;
};

export type LwsIssue = {
  code: string;
  severity: "error" | "warning" | "info" | string;
  message: string;
  target?: string;
  details?: Record<string, unknown>;
};

export type StatusResponse = {
  app: {
    name: string;
    env: string;
  };
  request: {
    request_id: string;
    auth_source: string;
  };
  storage: {
    status: "ok" | "degraded" | "error";
    allowStorageInit: boolean;
    roots: Array<{
      key: "knowledge" | "data" | "runtime" | "log" | "backup";
      path: string;
      exists: boolean;
      readable: boolean;
      writable: boolean;
    }>;
    index: {
      mode: "sqlite";
      sqliteEnabled: boolean;
      sqlitePath: string;
      sqlitePathInsideDataRoot: boolean;
      sqliteExists: boolean;
      state: "disabled" | "ready" | "INDEX_REBUILD_REQUIRED" | "INDEX_CORRUPT";
    };
    issues: LwsIssue[];
    bootstrapPlan: string[];
  };
  public_config: {
    appName: string;
    env: string;
    defaultVisibility: Visibility;
    publicGraphEnabled: boolean;
    autosaveIntervalMs: number;
    indexMode: string;
    sqliteEnabled: boolean;
  };
};

export type SessionResponse = {
  account_id: string | null;
  is_anonymous: boolean;
  display_name: string;
  auth_source: string;
  ui_capabilities: string[];
  default_scope: string | null;
  public_config: StatusResponse["public_config"];
};

export type ViewerPermissions = {
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_restore: boolean;
  can_manage_access: boolean;
};

export type ObjectRow = {
  id: string;
  object_kind: ObjectKind;
  title: string;
  type: string;
  status: ObjectStatus | string;
  visibility: Visibility;
  detail_mode: string;
  summary: string | null;
  rev: number;
  updated_at: string;
  tags?: string[] | string;
  viewer_permissions?: ViewerPermissions;
};

export type ObjectListResponse = {
  items: ObjectRow[];
  next_cursor: string | null;
  limit: number;
};

export type TemporalFields = {
  occurred_at: string | null;
  valid_from: string | null;
  valid_to: string | null;
};

export type AuditFields = {
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
};

export type ContentField = {
  format: "markdown";
  body: string;
};

export type LwsObjectBase = {
  schema_version: 1;
  object_kind: ObjectKind;
  id: string;
  rev: number;
  title: string;
  detail_mode: string;
  visibility: Visibility;
  status: ObjectStatus;
  tags: string[];
  props: Record<string, unknown>;
  temporal: TemporalFields;
  audit: AuditFields;
  summary?: string;
  aliases?: string[];
  content?: ContentField;
};

export type LwsNode = LwsObjectBase & {
  object_kind: "node";
  slug: string;
  type: string;
  detail_mode: NodeDetailMode;
};

export type EvidenceReference = {
  type: "node" | "edge" | "url" | "file";
  target: string;
};

export type LwsEdge = LwsObjectBase & {
  object_kind: "edge";
  source: string;
  target: string;
  type: string;
  detail_mode: EdgeDetailMode;
  evidence?: EvidenceReference[];
};

export type LwsObject = LwsNode | LwsEdge;

export type ObjectReadResponse = {
  object: LwsObject;
  viewer_permissions: ViewerPermissions;
};

export type ValidationReport = {
  valid?: boolean;
  issues?: LwsIssue[];
};

export type GraphResponse = {
  nodes: ObjectRow[];
  edges: Array<{
    edge_id: string;
    source_id: string;
    target_id: string;
    relation_type: string;
    status: string;
    visibility: Visibility;
  }>;
  placeholders: Array<{
    id: string;
    kind: "unreadable_endpoint";
  }>;
  depth: number;
};

export type TimelinePosition =
  | { kind: "point"; at: string; normalized_at: number; precision: "date" | "datetime" }
  | { kind: "interval"; start: string | null; end: string | null; normalized_start: number | null; normalized_end: number | null; start_precision: "date" | "datetime" | null; end_precision: "date" | "datetime" | null }
  | { kind: "undated" };

export type TimelineItemBase = {
  object_id: string;
  object_kind: ObjectKind;
  title: string;
  tags: string[];
  status: string;
  visibility: Visibility;
  temporal: TemporalFields;
  audit: Pick<AuditFields, "created_at" | "updated_at">;
  position: TimelinePosition;
  group_keys: string[];
};

export type NodeTimelineItem = TimelineItemBase & { object_kind: "node"; type: string };
export type TimelineEndpoint = { object_id: string; title: string; object_kind: string; type: string } | { kind: "unreadable_endpoint" };
export type EdgeTimelineItem = TimelineItemBase & { object_kind: "edge"; relation_type: string; source: TimelineEndpoint; target: TimelineEndpoint };
export type TimelineItem = NodeTimelineItem | EdgeTimelineItem;

export type TimelineQuery = {
  kind?: ObjectKind;
  basis: "created" | "updated" | "occurred" | "valid" | "custom";
  time_path?: string;
  temporal_state: "dated" | "undated";
  from?: string;
  to?: string;
  type?: string;
  tag?: string;
  scope?: string;
  collection?: string;
  status: string;
  visibility?: Visibility;
  group_by: "none" | "type" | "tag" | "scope" | "collection";
  center?: string;
  depth: number;
  limit: number;
};

export type TimelineResponse = {
  items: TimelineItem[];
  relations: Array<{
    edge_id: string;
    relation_type: string;
    source_id: string;
    target_id: string;
    branch_at: string | null;
    normalized_branch_at: number | null;
  }>;
  domain: {
    min_key: number | null;
    max_key: number | null;
  };
  groups: Array<{ key: string; count: number }>;
  query: TimelineQuery;
  time_coverage: {
    matching_count: number;
    declared_count: number;
    dated_count: number;
    undated_count: number;
    missing_count: number;
    invalid_count: number;
  };
  undated_count: number;
  next_cursor: string | null;
  limit: number;
  index_revision: string;
  context?: {
    center: TimelineEndpoint;
    relations: Array<{ relation_type: string; source: TimelineEndpoint; target: TimelineEndpoint }>;
  };
};

export type TemporalCoverageState = "undated" | "missing" | "invalid";
export type TemporalCoverageItem = {
  object_id: string;
  object_kind: ObjectKind;
  title: string;
  type: string;
  status: string;
  visibility: Visibility;
  state: TemporalCoverageState;
  reason: string;
};
export type TemporalCoverageResponse = {
  items: TemporalCoverageItem[];
  time_coverage: TimelineResponse["time_coverage"];
  query: Omit<TimelineQuery, "temporal_state" | "group_by" | "from" | "to"> & { state: TemporalCoverageState };
  next_cursor: string | null;
  limit: number;
  index_revision: string;
};

export type OntologyResponse = {
  types: ObjectRow[];
  tags: ObjectRow[];
  relations: ObjectRow[];
};

export type JsonPatchOperation =
  | { op: "add"; path: string; value: unknown }
  | { op: "replace"; path: string; value: unknown }
  | { op: "remove"; path: string }
  | { op: "test"; path: string; value: unknown };

export type MutationEventType =
  | "node.created"
  | "node.updated"
  | "node.deleted"
  | "node.restored"
  | "edge.created"
  | "edge.updated"
  | "edge.deleted"
  | "edge.restored";

export type ObjectHistoryLink = {
  schema_version: 1;
  event_id: string;
  event_ref: string;
  line: number;
  byte_offset: number;
  event_type: MutationEventType;
  base_rev: number;
  next_rev: number;
  occurred_at: string;
  summary: string;
  patch_path: string;
  after_hash: string;
};

export type ObjectHistoryResponse = {
  items: ObjectHistoryLink[];
  next_cursor: string | null;
};

export type GlobalMutationEvent = {
  schema_version: 1;
  event_id: string;
  event_kind: "event";
  event_type: MutationEventType;
  object_kind: ObjectKind;
  object_id: string;
  base_rev: number;
  next_rev: number;
  account_id: string;
  occurred_at: string;
  summary: string;
  changed_fields: string[];
  object_history_path: string;
  patch_path: string;
  before_hash: string | null;
  after_hash: string;
};

export type PatchRecord = {
  schema_version: 1;
  event_id: string;
  object_kind: ObjectKind;
  object_id: string;
  base_rev: number;
  next_rev: number;
  patch_format: "json-patch-like";
  patch: JsonPatchOperation[];
  inverse_patch: JsonPatchOperation[];
  before_hash: string | null;
  after_hash: string;
};

export type MutationResult<T extends LwsObject = LwsObject> = {
  object: T;
  event_id: string;
  next_rev: number;
  warnings: string[];
};

export type AdminJob = {
  id?: string;
  job_id?: string;
  type?: string;
  status: string;
  progress?: Record<string, unknown>;
  result?: unknown;
  warnings?: string[];
  error?: LwsApiError | Record<string, unknown>;
  audit?: Record<string, unknown>;
};

export type AdminJobResponse = {
  job: AdminJob;
};

export type EditorState =
  | "readonly"
  | "clean"
  | "dirty"
  | "saving"
  | "saved"
  | "save failed"
  | "validation failed"
  | "rev conflict"
  | "permission denied";

export type NodeDraft = Pick<
  LwsNode,
  "id" | "title" | "slug" | "type" | "detail_mode" | "visibility" | "status" | "tags" | "props" | "temporal" | "summary" | "content"
>;

export type EdgeDraft = Pick<
  LwsEdge,
  | "id"
  | "title"
  | "source"
  | "target"
  | "type"
  | "detail_mode"
  | "visibility"
  | "status"
  | "tags"
  | "props"
  | "temporal"
  | "summary"
  | "content"
>;
