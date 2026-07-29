import type { LwsEdge, LwsNode } from "../../shared/object-model.ts";
import { createSystemContext } from "../../shared/request-context.ts";
import type { MutationService } from "../../services/mutation-service.ts";
import type { ObjectStore } from "../storage/object-store.ts";
import {
  BUILTIN_RELATION_IDS,
  BUILTIN_SCOPE_IDS,
  BUILTIN_TYPE_IDS
} from "./builtin-ontology.ts";

export type CoreOntologyMaterializeResult = {
  created_nodes: string[];
  skipped_nodes: string[];
  created_edges: string[];
  skipped_edges: string[];
};

export class CoreOntologyMaterializer {
  private readonly objectStore: ObjectStore;
  private readonly mutationService: MutationService;

  constructor(objectStore: ObjectStore, mutationService: MutationService) {
    this.objectStore = objectStore;
    this.mutationService = mutationService;
  }

  run(requestId?: string): CoreOntologyMaterializeResult {
    const context = createSystemContext("account.system", requestId);
    const result: CoreOntologyMaterializeResult = {
      created_nodes: [],
      skipped_nodes: [],
      created_edges: [],
      skipped_edges: []
    };

    for (const node of this.coreNodes()) {
      if (this.objectStore.nodeExists(node.id)) {
        result.skipped_nodes.push(node.id);
        continue;
      }
      this.mutationService.createObject("node", { object: node, target_scope: "scope.ontology" }, context);
      result.created_nodes.push(node.id);
    }

    for (const edge of this.coreEdges()) {
      if (this.objectStore.edgeExists(edge.id)) {
        result.skipped_edges.push(edge.id);
        continue;
      }
      this.mutationService.createObject("edge", { object: edge, target_scope: "scope.system" }, context);
      result.created_edges.push(edge.id);
    }

    return result;
  }

  private coreNodes(): LwsNode[] {
    const typeNodes = BUILTIN_TYPE_IDS.map((id) => {
      const nodeType = id === "type.node-type" ? "type.node-type" : "type.node-type";
      return nodeFixture(id, titleFromId(id), slugFromId(id), nodeType);
    });
    const relationNodes = BUILTIN_RELATION_IDS.map((id) =>
      nodeFixture(id, titleFromId(id), slugFromId(id), "type.relation-type")
    );
    const scopeNodes = BUILTIN_SCOPE_IDS.map((id) => nodeFixture(id, titleFromId(id), slugFromId(id), "type.scope"));
    const accountNodes = [
      nodeFixture("account.system", "System Account", "account-system", "type.account"),
      nodeFixture("account.admin", "Bootstrap Admin", "account-admin", "type.account"),
      nodeFixture("group.admin", "Admin Group", "group-admin", "type.group")
    ];

    return [...typeNodes, ...relationNodes, ...scopeNodes, ...accountNodes];
  }

  private coreEdges(): LwsEdge[] {
    return [
      edgeFixture("edge.core.account-admin.member-of.group-admin", "account.admin", "group.admin", "rel.member_of"),
      edgeFixture("edge.core.group-admin.can-manage-system", "group.admin", "scope.system", "rel.can_manage_in"),
      edgeFixture("edge.core.group-admin.can-create-wiki", "group.admin", "scope.wiki", "rel.can_create_in"),
      edgeFixture("edge.core.group-admin.can-update-wiki", "group.admin", "scope.wiki", "rel.can_update_in"),
      edgeFixture("edge.core.group-admin.can-read-wiki", "group.admin", "scope.wiki", "rel.can_read_in")
    ];
  }
}

function nodeFixture(id: string, title: string, slug: string, type: string): LwsNode {
  return {
    schema_version: 1,
    object_kind: "node",
    id,
    rev: 1,
    title,
    slug,
    type,
    detail_mode: "system",
    visibility: "private",
    status: "active",
    tags: [],
    props: {},
    temporal: {
      occurred_at: null,
      valid_from: null,
      valid_to: null
    },
    audit: {
      created_at: "1970-01-01T00:00:00.000Z",
      updated_at: "1970-01-01T00:00:00.000Z",
      created_by: "account.system",
      updated_by: "account.system"
    }
  };
}

function edgeFixture(id: string, source: string, target: string, type: string): LwsEdge {
  return {
    schema_version: 1,
    object_kind: "edge",
    id,
    rev: 1,
    source,
    target,
    type,
    title: `${titleFromId(source)} ${titleFromId(type)} ${titleFromId(target)}`,
    detail_mode: "note",
    visibility: "private",
    status: "active",
    tags: [],
    props: {},
    temporal: {
      occurred_at: null,
      valid_from: null,
      valid_to: null
    },
    audit: {
      created_at: "1970-01-01T00:00:00.000Z",
      updated_at: "1970-01-01T00:00:00.000Z",
      created_by: "account.system",
      updated_by: "account.system"
    }
  };
}

function titleFromId(id: string): string {
  return id
    .split(".")
    .slice(1)
    .join(" ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugFromId(id: string): string {
  return id.replaceAll(".", "-").replaceAll("_", "-");
}
