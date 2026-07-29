import type { LwsIssue } from "../../shared/api.ts";
import type { LwsEdge, LwsNode, LwsObject } from "../../shared/object-model.ts";
import {
  isAcceptedVirtualTagId,
  isBuiltinRelationId,
  isBuiltinScopeId,
  isBuiltinTypeId
} from "../ontology/builtin-ontology.ts";

export type SemanticLookup = {
  nodeExists(id: string): boolean;
  readNodeOrNull(id: string): LwsNode | null;
};

export function validateObjectSemantics(object: LwsObject, lookup: SemanticLookup): LwsIssue[] {
  return object.object_kind === "node" ? validateNodeSemantics(object, lookup) : validateEdgeSemantics(object, lookup);
}

export function validateNodeSemantics(node: LwsNode, lookup: SemanticLookup): LwsIssue[] {
  const issues: LwsIssue[] = [];

  if (!isBuiltinTypeId(node.type) && !lookup.nodeExists(node.type)) {
    issues.push(issue("SEMANTIC_INVALID", "node.type must reference a type node or built-in virtual type.", "type"));
  }

  validateTags(node.tags, lookup, issues);
  return issues;
}

export function validateEdgeSemantics(edge: LwsEdge, lookup: SemanticLookup): LwsIssue[] {
  const issues: LwsIssue[] = [];
  const source = lookup.readNodeOrNull(edge.source);
  const target = lookup.readNodeOrNull(edge.target);

  if (!source && !isBuiltinScopeId(edge.source)) {
    issues.push(issue("SEMANTIC_INVALID", "edge.source must reference an existing node.", "source"));
  }

  if (!target && !isBuiltinScopeId(edge.target)) {
    issues.push(issue("SEMANTIC_INVALID", "edge.target must reference an existing node.", "target"));
  }

  if (!isBuiltinRelationId(edge.type) && !lookup.nodeExists(edge.type)) {
    issues.push(issue("SEMANTIC_INVALID", "edge.type must reference a relation type node or built-in virtual relation.", "type"));
  }

  if (edge.visibility === "public" && (source?.visibility !== "public" || target?.visibility !== "public")) {
    issues.push(
      issue("PUBLIC_BOUNDARY_VIOLATION", "public edge requires public source and public target.", "visibility")
    );
  }

  validateTags(edge.tags, lookup, issues);
  return issues;
}

function validateTags(tags: string[], lookup: SemanticLookup, issues: LwsIssue[]): void {
  for (const tag of tags) {
    if (isAcceptedVirtualTagId(tag) || isBuiltinScopeId(tag) || lookup.nodeExists(tag)) {
      continue;
    }

    issues.push(issue("SEMANTIC_INVALID", "tags must be tag node ids or accepted virtual tags.", "tags"));
  }
}

function issue(code: string, message: string, target: string): LwsIssue {
  return {
    code,
    severity: "error",
    message,
    target
  };
}
