import type { IndexStore } from "../modules/indexing/index-store.ts";
import type { RequestContext } from "../shared/request-context.ts";
import type { PermissionService } from "./permission-service.ts";

export class OntologyService {
  private readonly indexStore: IndexStore;
  private readonly permissionService?: PermissionService;

  constructor(indexStore: IndexStore, permissionService?: PermissionService) {
    this.indexStore = indexStore;
    this.permissionService = permissionService;
  }

  getOntology(context: RequestContext) {
    const db = this.indexStore.openReady();
    const visible = this.visiblePredicate(context, "o");
    const types = this.listOntologyObjects(db, "type.%", visible);
    const tags = this.listOntologyObjects(db, "tag.%", visible);
    const relations = this.listOntologyObjects(db, "rel.%", visible);
    db.close();
    return { types, tags, relations };
  }

  private listOntologyObjects(db: ReturnType<IndexStore["openReady"]>, idPattern: string, visible: { sql: string; params: any[] }) {
    return db.prepare(`SELECT * FROM objects o WHERE o.id LIKE ? AND ${visible.sql}`).all(idPattern, ...visible.params);
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
