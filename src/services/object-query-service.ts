import type { IndexStore } from "../modules/indexing/index-store.ts";
import { decodeCursor, encodeCursor } from "../modules/query/cursor.ts";
import type { RequestContext } from "../shared/request-context.ts";
import type { PermissionService } from "./permission-service.ts";

export type ObjectListQuery = {
  kind?: "node" | "edge";
  type?: string;
  tag?: string;
  status?: string;
  visibility?: "public" | "private";
  scope?: string;
  collection?: string;
  q?: string;
  limit?: number;
  cursor?: string;
  include_permissions?: boolean;
};

export class ObjectQueryService {
  private readonly indexStore: IndexStore;
  private readonly permissionService?: PermissionService;

  constructor(indexStore: IndexStore, permissionService?: PermissionService) {
    this.indexStore = indexStore;
    this.permissionService = permissionService;
  }

  listObjects(query: ObjectListQuery, context: RequestContext) {
    const db = this.indexStore.openReady();
    const limit = normalizeLimit(query.limit);
    const offset = decodeCursor(query.cursor);
    const where: string[] = [];
    const params: Array<string | number | null> = [];
    const visible = this.permissionService?.getVisibleObjectPredicate(context, "o") ?? fallbackVisiblePredicate(context, "o");
    where.push(visible.sql);
    params.push(...visible.params);

    if (query.visibility) {
      where.push("o.visibility = ?");
      params.push(query.visibility);
    }

    where.push("o.status = ?");
    params.push(query.status ?? "active");

    if (query.kind) {
      where.push("o.object_kind = ?");
      params.push(query.kind);
    }

    if (query.type) {
      where.push("o.type = ?");
      params.push(query.type);
    }

    if (query.q) {
      where.push("o.search_text LIKE ?");
      params.push(`%${query.q.toLowerCase()}%`);
    }

    if (query.tag) {
      where.push("EXISTS (SELECT 1 FROM object_tags ot WHERE ot.object_id = o.id AND ot.tag_id = ?)");
      params.push(query.tag);
    }

    const scopeOrCollection = query.scope ?? query.collection;
    if (scopeOrCollection && scopeOrCollection !== "scope.wiki") {
      where.push("EXISTS (SELECT 1 FROM object_scope_memberships osm WHERE osm.object_id = o.id AND osm.scope_id = ?)");
      params.push(scopeOrCollection);
    }

    const sql = `SELECT o.* FROM objects o ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY o.updated_at DESC, o.id ASC LIMIT ? OFFSET ?`;
    const items = db.prepare(sql).all(...params, limit + 1, offset);
    db.close();

    const page = items.slice(0, limit).map((item: any) => {
      if (!query.include_permissions || !this.permissionService) {
        return item;
      }

      return {
        ...item,
        viewer_permissions: this.permissionService.getViewerPermissions(context, {
          id: item.id,
          visibility: item.visibility,
          status: item.status
        })
      };
    });
    return {
      items: page,
      next_cursor: items.length > limit ? encodeCursor(offset + limit) : null,
      limit
    };
  }

  search(query: ObjectListQuery, context: RequestContext) {
    return this.listObjects(query, context);
  }
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isInteger(limit) || !limit || limit < 1) {
    return 50;
  }

  return Math.min(limit, 100);
}

function fallbackVisiblePredicate(context: RequestContext, objectAlias: string) {
  if (context.isAnonymous) {
    return { sql: `${objectAlias}.visibility = ?`, params: ["public"] };
  }
  return { sql: "1 = 1", params: [] };
}
