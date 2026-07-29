export type ObjectKind = "node" | "edge";
export type Visibility = "private" | "public";
export type ObjectStatus = "active" | "draft" | "stub" | "archived" | "deleted";
export type NodeDetailMode = "stub" | "note" | "page" | "view" | "system";
export type EdgeDetailMode = "stub" | "note" | "page";

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

export type ViewerPermissions = {
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_restore: boolean;
  can_manage_access: boolean;
};

export type ObjectReadResponse = {
  object: LwsObject;
  viewer_permissions: ViewerPermissions;
};
