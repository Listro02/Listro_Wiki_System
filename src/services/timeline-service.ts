import type { IndexStore } from "../modules/indexing/index-store.ts";
import type { RequestContext } from "../shared/request-context.ts";
import type { PermissionService } from "./permission-service.ts";

export class TimelineService {
  private readonly indexStore: IndexStore;
  private readonly permissionService?: PermissionService;

  constructor(indexStore: IndexStore, permissionService?: PermissionService) {
    this.indexStore = indexStore;
    this.permissionService = permissionService;
  }

  getTimeline(context: RequestContext) {
    const db = this.indexStore.openReady();
    const visible = this.visiblePredicate(context, "o");
    const items = db
      .prepare(
        `SELECT t.*, o.title, o.visibility, o.status
         FROM timeline_items t
         JOIN objects o ON o.id = t.object_id
         WHERE ${visible.sql}
         ORDER BY COALESCE(t.occurred_at, t.valid_from, t.updated_at) DESC
         LIMIT 200`
      )
      .all(...visible.params);
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
