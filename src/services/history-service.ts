import type { EventStore } from "../modules/events/event-store.ts";
import { assertSafeEventId } from "../modules/events/event-id.ts";
import type { ObjectHistoryLink } from "../modules/events/event-types.ts";
import type { IndexStore } from "../modules/indexing/index-store.ts";
import type { ObjectStore } from "../modules/storage/object-store.ts";
import { LwsError } from "../shared/errors.ts";
import type { RequestContext } from "../shared/request-context.ts";
import type { PermissionService } from "./permission-service.ts";

export class HistoryService {
  private readonly objectStore: ObjectStore;
  private readonly eventStore: EventStore;
  private readonly permissionService: PermissionService;
  private readonly indexStore?: IndexStore;

  constructor(objectStore: ObjectStore, eventStore: EventStore, permissionService: PermissionService, indexStore?: IndexStore) {
    this.objectStore = objectStore;
    this.eventStore = eventStore;
    this.permissionService = permissionService;
    this.indexStore = indexStore;
  }

  listHistory(objectId: string, context: RequestContext): ObjectHistoryLink[] {
    const object = this.objectStore.readObject(objectId);
    this.permissionService.assertCanRead(context, object);
    if (this.indexStore?.getStatus().state === "ready") {
      return this.indexStore.listObjectHistoryProjection(object.id);
    }
    return this.eventStore.listObjectHistory(object.object_kind, object.id);
  }

  getHistoryEvent(objectId: string, eventId: string, context: RequestContext) {
    assertSafeEventId(eventId);
    const history = this.findHistoryLink(objectId, eventId, context);
    return this.eventStore.readGlobalEvent(history);
  }

  getHistoryDiff(objectId: string, eventId: string, context: RequestContext) {
    assertSafeEventId(eventId);
    const object = this.objectStore.readObject(objectId);
    this.permissionService.assertCanRead(context, object);
    return this.eventStore.readPatchRecord(object.object_kind, object.id, eventId);
  }

  private findHistoryLink(objectId: string, eventId: string, context: RequestContext): ObjectHistoryLink {
    assertSafeEventId(eventId);
    const history = this.listHistory(objectId, context).find((item) => item.event_id === eventId);
    if (!history) {
      throw new LwsError("OBJECT_NOT_FOUND", "History event was not found.", { event_id: eventId });
    }
    return history;
  }
}
