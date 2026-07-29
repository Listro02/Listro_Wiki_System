export const BUILTIN_TYPE_IDS = [
  "type.node",
  "type.page",
  "type.service",
  "type.project",
  "type.concept",
  "type.note",
  "type.document",
  "type.collection",
  "type.tag",
  "type.node-type",
  "type.relation-type",
  "type.scope",
  "type.account",
  "type.group",
  "type.graph-view",
  "type.timeline-view",
  "type.setting",
  "type.template",
  "type.system",
  "type.event",
  "type.source"
] as const;

export const BUILTIN_RELATION_IDS = [
  "rel.depends_on",
  "rel.contains",
  "rel.references",
  "rel.classifies",
  "rel.owns",
  "rel.member_of",
  "rel.can_read",
  "rel.can_read_in",
  "rel.can_create_in",
  "rel.can_update",
  "rel.can_update_in",
  "rel.can_manage_in"
] as const;

export const BUILTIN_SCOPE_IDS = ["scope.wiki", "scope.system", "scope.ontology", "scope.public"] as const;

const BUILTIN_TYPE_ID_SET = new Set(BUILTIN_TYPE_IDS);
const BUILTIN_RELATION_ID_SET = new Set(BUILTIN_RELATION_IDS);
const BUILTIN_SCOPE_ID_SET = new Set(BUILTIN_SCOPE_IDS);

export function isBuiltinTypeId(id: string): boolean {
  return BUILTIN_TYPE_ID_SET.has(id as (typeof BUILTIN_TYPE_IDS)[number]);
}

export function isBuiltinRelationId(id: string): boolean {
  return BUILTIN_RELATION_ID_SET.has(id as (typeof BUILTIN_RELATION_IDS)[number]);
}

export function isBuiltinScopeId(id: string): boolean {
  return BUILTIN_SCOPE_ID_SET.has(id as (typeof BUILTIN_SCOPE_IDS)[number]);
}

export function isAcceptedVirtualTagId(id: string): boolean {
  return id.startsWith("tag.");
}

export function isAccountId(id: string): boolean {
  return id.startsWith("account.");
}
