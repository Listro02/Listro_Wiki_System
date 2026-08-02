import type { IndexStore } from "../modules/indexing/index-store.ts";
import type { RequestContext } from "../shared/request-context.ts";
import type { PermissionService } from "./permission-service.ts";

export class GraphService {
  private readonly indexStore: IndexStore;
  private readonly permissionService?: PermissionService;

  constructor(indexStore: IndexStore, permissionService?: PermissionService) {
    this.indexStore = indexStore;
    this.permissionService = permissionService;
  }

  getGraph(query: { center?: string; depth?: number }, context: RequestContext) {
    const db = this.indexStore.openReady();
    const center = query.center ?? null;
    const centerFilter = center ? "AND (e.source_id = ? OR e.target_id = ? OR e.edge_id = ?)" : "";
    const edgeVisible = this.visiblePredicate(context, "eo");
    const sourceVisible = this.visiblePredicate(context, "so");
    const targetVisible = this.visiblePredicate(context, "tobj");
    const params = [
      ...edgeVisible.params,
      ...sourceVisible.params,
      ...targetVisible.params,
      ...(center ? [center, center, center] : [])
    ];
    const edges = db
      .prepare(
        `SELECT e.edge_id, e.source_id, e.target_id, e.relation_type, e.status, e.visibility
         FROM graph_edges e
         JOIN objects eo ON eo.id = e.edge_id
         JOIN objects so ON so.id = e.source_id
         JOIN objects tobj ON tobj.id = e.target_id
         WHERE e.status = 'active'
           AND ${edgeVisible.sql}
           AND ${sourceVisible.sql}
           AND ${targetVisible.sql}
           ${centerFilter}
         LIMIT 200`
      )
      .all(...params);
    const ids = Array.from(new Set(edges.flatMap((edge: any) => [edge.source_id, edge.target_id, edge.edge_id])));
    const nodes = ids.length
      ? db.prepare(`SELECT * FROM objects WHERE id IN (${ids.map(() => "?").join(",")})`).all(...ids)
      : [];
    db.close();

    return {
      nodes,
      edges,
      depth: query.depth ?? 1
    };
  }

  getBacklinks(objectId: string, context: RequestContext) {
    const db = this.indexStore.openReady();
    const edgeVisible = this.visiblePredicate(context, "eo");
    const sourceVisible = this.visiblePredicate(context, "so");
    const targetVisible = this.visiblePredicate(context, "tobj");
    const items = db
      .prepare(
        `SELECT e.edge_id, e.source_id, e.target_id, e.relation_type, so.title AS source_title
         FROM graph_edges e
         JOIN objects eo ON eo.id = e.edge_id
         JOIN objects so ON so.id = e.source_id
         JOIN objects tobj ON tobj.id = e.target_id
         WHERE e.target_id = ?
           AND e.status = 'active'
           AND ${edgeVisible.sql}
           AND ${sourceVisible.sql}
           AND ${targetVisible.sql}
         ORDER BY so.title ASC`
      )
      .all(objectId, ...edgeVisible.params, ...sourceVisible.params, ...targetVisible.params);
    db.close();
    return { items };
  }

  private visiblePredicate(context: RequestContext, objectAlias: string) {
    if (this.permissionService) {
      return this.permissionService.getVisibleObjectPredicate(context, objectAlias);
    }
    if (context.isAnonymous) {
      return { sql: `${objectAlias}.visibility = ?`, params: ["public"] };
    }
    return { sql: "1 = 1", params: [] };
  }
}
