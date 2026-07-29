import type { IndexStore } from "../modules/indexing/index-store.ts";
import type { ObjectStore } from "../modules/storage/object-store.ts";
import type { ValidationService } from "../modules/validation/validation-service.ts";
import { LwsError } from "../shared/errors.ts";
import type { ObjectReadResponse } from "../shared/object-model.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { PermissionService } from "./permission-service.ts";

export class ObjectService {
  private readonly objectStore: ObjectStore;
  private readonly permissionService: PermissionService;
  private readonly validationService?: ValidationService;
  private readonly indexStore?: IndexStore;

  constructor(
    objectStore: ObjectStore,
    permissionService: PermissionService,
    validationService?: ValidationService,
    indexStore?: IndexStore
  ) {
    this.objectStore = objectStore;
    this.permissionService = permissionService;
    this.validationService = validationService;
    this.indexStore = indexStore;
  }

  readObject(id: string, context: RequestContext): ObjectReadResponse {
    const object = this.objectStore.readObject(id);
    this.permissionService.assertCanRead(context, object);

    return {
      object,
      viewer_permissions: this.permissionService.getViewerPermissions(context, object)
    };
  }

  validateObject(id: string, context: RequestContext) {
    if (!this.validationService) {
      throw new LwsError("INTERNAL_ERROR", "Validation service is not configured.");
    }

    const { object } = this.readObject(id, context);
    return this.validationService.validateUnknownObject(object);
  }

  getObjectPermissions(id: string, context: RequestContext) {
    const { object } = this.readObject(id, context);

    return {
      object_id: object.id,
      object_kind: object.object_kind,
      viewer_permissions: this.permissionService.getViewerPermissions(context, object),
      reason: [],
      projection_state: this.indexStore?.getStatus().state ?? "INDEX_REBUILD_REQUIRED"
    };
  }
}
