import { LwsError } from "../shared/errors.ts";
import type { AuthSource, RequestContext } from "../shared/request-context.ts";
import type { LwsObject, ViewerPermissions } from "../shared/object-model.ts";
import type { IndexStore } from "../modules/indexing/index-store.ts";

export type ResolveContextInput = {
  accountId?: string | null;
  authSource?: AuthSource;
  requestId?: string;
};

export type SqlPredicate = {
  sql: string;
  params: Array<string | number | null>;
};

export class PermissionService {
  private readonly options: { adminBootstrapAccount?: string; indexStore?: IndexStore };

  constructor(options: { adminBootstrapAccount?: string; indexStore?: IndexStore } = {}) {
    this.options = options;
  }

  resolveContext(input: ResolveContextInput = {}): RequestContext {
    const accountId = input.accountId ?? null;
    const authSource = input.authSource ?? (accountId ? "session" : "anonymous");

    return {
      accountId,
      isAnonymous: accountId === null,
      requestId: input.requestId ?? crypto.randomUUID(),
      authSource
    };
  }

  assertCanRead(context: RequestContext, object: Pick<LwsObject, "id" | "visibility">): void {
    if (this.canRead(context, object)) {
      return;
    }

    throw new LwsError("PERMISSION_DENIED", "Private read requires effective permission.");
  }

  assertCanCreateIn(context: RequestContext, scopeOrCollectionId = "scope.wiki"): void {
    if (this.canCreateIn(context, scopeOrCollectionId)) {
      return;
    }
    throw new LwsError("PERMISSION_DENIED", "Create requires effective permission.");
  }

  assertCanUpdate(context: RequestContext, object?: Pick<LwsObject, "id" | "visibility">): void {
    if (object && this.canUpdate(context, object)) {
      return;
    }
    throw new LwsError("PERMISSION_DENIED", "Update requires effective permission.");
  }

  assertCanManageIn(context: RequestContext, scopeId = "scope.system"): void {
    if (this.canManageIn(context, scopeId)) {
      return;
    }
    throw new LwsError("PERMISSION_DENIED", "Admin operations fail closed until permission enforcement exists.");
  }

  getViewerPermissions(context: RequestContext, object: Pick<LwsObject, "id" | "visibility" | "status">): ViewerPermissions {
    const canRead = this.canRead(context, object);
    const canWrite = this.canUpdate(context, object);
    const canManageAccess = this.canManageAccess(context, object.id);

    return {
      can_read: canRead,
      can_update: canWrite,
      can_delete: canWrite && object.status !== "deleted",
      can_restore: canWrite && object.status === "deleted",
      can_manage_access: canManageAccess
    };
  }

  getVisibleObjectPredicate(context: RequestContext, objectAlias = "o"): SqlPredicate {
    if (this.isBaselinePrivileged(context)) {
      return { sql: "1 = 1", params: [] };
    }

    if (!context.accountId) {
      return { sql: `${objectAlias}.visibility = ?`, params: ["public"] };
    }

    return {
      sql: `(${objectAlias}.visibility = ? OR (
        EXISTS (SELECT 1 FROM accounts visible_account
                WHERE visible_account.account_id = ? AND visible_account.status = 'active')
        AND (
          EXISTS (SELECT 1 FROM object_owners visible_owner
                  WHERE visible_owner.account_id = ? AND visible_owner.object_id = ${objectAlias}.id)
          OR EXISTS (SELECT 1 FROM account_permissions visible_direct
                     WHERE visible_direct.account_id = ?
                       AND visible_direct.capability = 'rel.can_read'
                       AND visible_direct.scope_id = ${objectAlias}.id)
          OR EXISTS (SELECT 1 FROM account_permissions visible_scoped
                     WHERE visible_scoped.account_id = ?
                       AND visible_scoped.capability = 'rel.can_read_in'
                       AND (
                         visible_scoped.scope_id = 'scope.wiki'
                         OR visible_scoped.scope_id = ${objectAlias}.id
                         OR EXISTS (SELECT 1 FROM object_scope_memberships visible_membership
                                    WHERE visible_membership.object_id = ${objectAlias}.id
                                      AND visible_membership.scope_id = visible_scoped.scope_id)
                       ))
        )
      ))`,
      params: ["public", context.accountId, context.accountId, context.accountId, context.accountId]
    };
  }

  getAccountDisplayName(context: RequestContext): string {
    const accountId = context.accountId;
    if (!accountId) {
      return "Anonymous";
    }

    const displayName = this.withReadyIndex((db) => {
      const row = db.prepare("SELECT display_name FROM accounts WHERE account_id = ?").get(accountId) as
        | { display_name: string }
        | undefined;
      return row?.display_name ?? null;
    });
    return displayName || accountId;
  }

  getUiCapabilities(context: RequestContext): string[] {
    const capabilities = new Set<string>();
    if (context.isAnonymous) {
      return [];
    }

    capabilities.add("object.read.public");
    if (this.canCreateIn(context, "scope.wiki")) {
      capabilities.add("object.create");
    }
    if (context.accountId && this.hasScopedPermission(context.accountId, ["rel.can_read_in"], "scope.wiki")) {
      capabilities.add("object.read.private");
    }
    if (this.canManageIn(context, "scope.system")) {
      capabilities.add("object.manage.access");
      capabilities.add("system.manage");
    }

    return Array.from(capabilities);
  }

  getDefaultScope(context: RequestContext): string | null {
    return this.canCreateIn(context, "scope.wiki") ? "scope.wiki" : null;
  }

  canRead(context: RequestContext, object: Pick<LwsObject, "id" | "visibility">): boolean {
    if (object.visibility === "public") {
      return true;
    }
    if (this.isBaselinePrivileged(context)) {
      return true;
    }
    if (!context.accountId || !this.isActiveAccount(context.accountId)) {
      return false;
    }
    return (
      this.isOwner(context.accountId, object.id) ||
      this.hasExactPermission(context.accountId, ["rel.can_read"], object.id) ||
      this.hasScopedPermission(context.accountId, ["rel.can_read_in"], object.id)
    );
  }

  canCreateIn(context: RequestContext, scopeOrCollectionId = "scope.wiki"): boolean {
    if (this.isBaselinePrivileged(context)) {
      return true;
    }
    if (!context.accountId || !this.isActiveAccount(context.accountId)) {
      return false;
    }
    return this.hasScopedPermission(context.accountId, ["rel.can_create_in"], scopeOrCollectionId);
  }

  canUpdate(context: RequestContext, object: Pick<LwsObject, "id" | "visibility">): boolean {
    if (this.isBaselinePrivileged(context)) {
      return true;
    }
    if (!context.accountId || !this.isActiveAccount(context.accountId)) {
      return false;
    }
    return (
      this.isOwner(context.accountId, object.id) ||
      this.hasExactPermission(context.accountId, ["rel.can_update"], object.id) ||
      this.hasScopedPermission(context.accountId, ["rel.can_update_in"], object.id)
    );
  }

  canManageIn(context: RequestContext, scopeId = "scope.system"): boolean {
    if (this.isBaselinePrivileged(context)) {
      return true;
    }
    if (!context.accountId || !this.isActiveAccount(context.accountId)) {
      return false;
    }
    return this.hasScopedPermission(context.accountId, ["rel.can_manage_in"], scopeId, {
      allowWikiGlobal: scopeId !== "scope.system"
    });
  }

  canManageAccess(context: RequestContext, objectId: string): boolean {
    if (this.isBaselinePrivileged(context)) {
      return true;
    }
    if (!context.accountId || !this.isActiveAccount(context.accountId)) {
      return false;
    }
    return this.hasScopedPermission(context.accountId, ["rel.can_manage_in"], objectId);
  }

  private isBaselinePrivileged(context: RequestContext): boolean {
    if (!context.accountId) {
      return false;
    }

    const adminBootstrapAccount = this.options.adminBootstrapAccount ?? "account.admin";
    if (context.authSource === "system" && context.accountId === "account.system") {
      return true;
    }

    return context.authSource === "local-script" && context.accountId === adminBootstrapAccount;
  }

  private isActiveAccount(accountId: string): boolean {
    return this.withReadyIndex((db) => {
      const row = db.prepare("SELECT status FROM accounts WHERE account_id = ?").get(accountId) as
        | { status: string }
        | undefined;
      return row?.status === "active";
    });
  }

  private isOwner(accountId: string, objectId: string): boolean {
    return this.withReadyIndex((db) => {
      const row = db
        .prepare("SELECT 1 AS ok FROM object_owners WHERE account_id = ? AND object_id = ? LIMIT 1")
        .get(accountId, objectId) as { ok: number } | undefined;
      return Boolean(row);
    });
  }

  private hasExactPermission(accountId: string, capabilities: string[], scopeId: string): boolean {
    return this.withReadyIndex((db) => {
      const placeholders = capabilities.map(() => "?").join(",");
      const row = db
        .prepare(
          `SELECT 1 AS ok FROM account_permissions
           WHERE account_id = ? AND capability IN (${placeholders}) AND scope_id = ?
           LIMIT 1`
        )
        .get(accountId, ...capabilities, scopeId) as { ok: number } | undefined;
      return Boolean(row);
    });
  }

  private hasScopedPermission(
    accountId: string,
    capabilities: string[],
    targetId: string,
    options: { allowWikiGlobal?: boolean } = {}
  ): boolean {
    return this.withReadyIndex((db) => {
      const placeholders = capabilities.map(() => "?").join(",");
      const wikiClause = options.allowWikiGlobal === false ? "" : "OR ap.scope_id = 'scope.wiki'";
      const row = db
        .prepare(
          `SELECT 1 AS ok FROM account_permissions ap
           WHERE ap.account_id = ? AND ap.capability IN (${placeholders})
             AND (
               ap.scope_id = ?
               ${wikiClause}
               OR EXISTS (SELECT 1 FROM object_scope_memberships osm
                          WHERE osm.object_id = ? AND osm.scope_id = ap.scope_id)
             )
           LIMIT 1`
        )
        .get(accountId, ...capabilities, targetId, targetId) as { ok: number } | undefined;
      return Boolean(row);
    });
  }

  private withReadyIndex<T>(read: (db: ReturnType<IndexStore["open"]>) => T): T | false {
    if (!this.options.indexStore || this.options.indexStore.getStatus().state !== "ready") {
      return false;
    }

    const db = this.options.indexStore.open();
    try {
      return read(db);
    } catch {
      return false;
    } finally {
      db.close();
    }
  }
}
