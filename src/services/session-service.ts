import type { PublicConfig } from "../modules/config/runtime-config.ts";
import type { RequestContext } from "../shared/request-context.ts";
import type { PermissionService } from "./permission-service.ts";

export type SessionResponse = {
  account_id: string | null;
  is_anonymous: boolean;
  display_name: string;
  auth_source: RequestContext["authSource"];
  ui_capabilities: string[];
  default_scope: string | null;
  public_config: PublicConfig;
};

export class SessionService {
  private readonly permissionService?: PermissionService;

  constructor(permissionService?: PermissionService) {
    this.permissionService = permissionService;
  }

  getSession(context: RequestContext, publicConfig: PublicConfig): SessionResponse {
    return {
      account_id: context.accountId,
      is_anonymous: context.isAnonymous,
      display_name: this.permissionService?.getAccountDisplayName(context) ?? context.accountId ?? "Anonymous",
      auth_source: context.authSource,
      ui_capabilities: this.permissionService?.getUiCapabilities(context) ?? [],
      default_scope: this.permissionService?.getDefaultScope(context) ?? null,
      public_config: publicConfig
    };
  }
}
