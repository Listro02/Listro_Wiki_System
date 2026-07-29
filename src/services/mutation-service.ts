import type { EventStore } from "../modules/events/event-store.ts";
import { assertSafeEventId } from "../modules/events/event-id.ts";
import type { GlobalMutationEvent, MutationEventType, ObjectHistoryLink } from "../modules/events/event-types.ts";
import { sha256Object } from "../modules/hashing/object-hash.ts";
import type { IndexStore } from "../modules/indexing/index-store.ts";
import { applyPatch, type JsonPatchOperation } from "../modules/patch/patch-engine.ts";
import { assertBaseRev, nextRev } from "../modules/revision/revision-checker.ts";
import type { ObjectStore } from "../modules/storage/object-store.ts";
import type { ValidationService } from "../modules/validation/validation-service.ts";
import { LwsError } from "../shared/errors.ts";
import type { LwsEdge, LwsNode, LwsObject, ObjectKind } from "../shared/object-model.ts";
import type { RequestContext } from "../shared/request-context.ts";
import type { PermissionService } from "./permission-service.ts";

export type CreateObjectCommand<T extends LwsObject> = {
  object: T;
  target_scope?: string;
  summary?: string;
};

export type PatchObjectCommand = {
  id: string;
  base_rev: number;
  patch: JsonPatchOperation[];
  summary?: string;
  event_type?: MutationEventType;
};

export type DeleteObjectCommand = {
  id: string;
  base_rev: number;
  summary?: string;
};

export type RestoreObjectCommand = {
  id: string;
  base_rev: number;
  source_event_id: string;
  mode: "inverse_patch";
  summary?: string;
};

export type MutationResult<T extends LwsObject = LwsObject> = {
  object: T;
  event_id: string;
  next_rev: number;
  warnings: string[];
};

export class MutationService {
  private readonly objectStore: ObjectStore;
  private readonly validationService: ValidationService;
  private readonly permissionService: PermissionService;
  private readonly eventStore: EventStore;
  private readonly indexStore?: IndexStore;

  constructor(
    objectStore: ObjectStore,
    validationService: ValidationService,
    permissionService: PermissionService,
    eventStore: EventStore,
    indexStore?: IndexStore
  ) {
    this.objectStore = objectStore;
    this.validationService = validationService;
    this.permissionService = permissionService;
    this.eventStore = eventStore;
    this.indexStore = indexStore;
  }

  createObject<T extends LwsObject>(kind: ObjectKind, command: CreateObjectCommand<T>, context: RequestContext): MutationResult<T> {
    this.permissionService.assertCanCreateIn(context, command.target_scope ?? "scope.wiki");
    const accountId = requireMutationAccount(context);
    const object = this.normalizeCreateObject(kind, command.object, accountId);
    this.assertCanMutatePermissionGraph(null, object, context);

    if (this.exists(kind, object.id)) {
      throw new LwsError("OBJECT_ALREADY_EXISTS", "Object already exists.", { id: object.id });
    }

    const validObject = this.validationService.assertValidForSource(object) as T;
    const afterHash = sha256Object(validObject);
    const eventId = this.eventStore.createEventId();
    const eventType = `${kind}.created` as MutationEventType;
    const occurredAt = new Date().toISOString();
    const patch: JsonPatchOperation[] = [{ op: "add", path: "/", value: validObject }];
    const inversePatch: JsonPatchOperation[] = [{ op: "remove", path: "/" }];

    return this.commitObjectMutation({
      object: validObject,
      eventId,
      eventType,
      accountId,
      occurredAt,
      baseRev: 0,
      nextRev: validObject.rev,
      summary: command.summary ?? `Created ${kind} ${validObject.id}`,
      patch,
      inversePatch,
      changedFields: ["*"],
      beforeHash: null,
      afterHash
    }) as MutationResult<T>;
  }

  patchObject(kind: ObjectKind, command: PatchObjectCommand, context: RequestContext): MutationResult {
    const current = this.readExpectedKind(kind, command.id);
    this.permissionService.assertCanUpdate(context, current);
    const accountId = requireMutationAccount(context);
    assertBaseRev(current.rev, command.base_rev);

    const beforeHash = sha256Object(current);
    const application = applyPatch(current, command.patch);
    const patched = application.document as LwsObject;
    const updated = this.withBackendUpdateFields(patched, nextRev(current.rev), accountId);
    const validObject = this.validationService.assertValidForSource(updated);
    this.assertCanMutatePermissionGraph(current, validObject, context);
    const afterHash = sha256Object(validObject);
    const eventId = this.eventStore.createEventId();
    const occurredAt = new Date().toISOString();
    const eventType = command.event_type ?? (`${kind}.updated` as MutationEventType);

    return this.commitObjectMutation({
      object: validObject,
      eventId,
      eventType,
      accountId,
      occurredAt,
      baseRev: current.rev,
      nextRev: validObject.rev,
      summary: command.summary ?? `Updated ${kind} ${validObject.id}`,
      patch: command.patch,
      inversePatch: application.inversePatch,
      changedFields: application.changedFields,
      beforeHash,
      afterHash
    });
  }

  deleteObject(kind: ObjectKind, command: DeleteObjectCommand, context: RequestContext): MutationResult {
    return this.patchObject(
      kind,
      {
        id: command.id,
        base_rev: command.base_rev,
        patch: [{ op: "replace", path: "/status", value: "deleted" }],
        summary: command.summary ?? `Deleted ${kind} ${command.id}`,
        event_type: `${kind}.deleted` as MutationEventType
      },
      context
    );
  }

  restoreObject(command: RestoreObjectCommand, context: RequestContext): MutationResult {
    assertSafeEventId(command.source_event_id);
    const current = this.objectStore.readObject(command.id);
    this.permissionService.assertCanUpdate(context, current);
    const patchRecord = this.eventStore.readPatchRecord(current.object_kind, current.id, command.source_event_id);
    this.assertRestorablePatchRecord(current, patchRecord);

    return this.patchObject(
      current.object_kind,
      {
        id: current.id,
        base_rev: command.base_rev,
        patch: patchRecord.inverse_patch,
        summary: command.summary ?? `Restored ${current.object_kind} ${current.id} from ${command.source_event_id}`,
        event_type: `${current.object_kind}.restored` as MutationEventType
      },
      context
    );
  }

  private commitObjectMutation(input: {
    object: LwsObject;
    eventId: string;
    eventType: MutationEventType;
    accountId: string;
    occurredAt: string;
    baseRev: number;
    nextRev: number;
    summary: string;
    patch: JsonPatchOperation[];
    inversePatch: JsonPatchOperation[];
    changedFields: string[];
    beforeHash: string | null;
    afterHash: string;
  }): MutationResult {
    const commitInput = {
      event_id: input.eventId,
      event_type: input.eventType,
      object_kind: input.object.object_kind,
      object_id: input.object.id,
      base_rev: input.baseRev,
      next_rev: input.nextRev,
      account_id: input.accountId,
      occurred_at: input.occurredAt,
      summary: input.summary,
      changed_fields: input.changedFields,
      patch: input.patch,
      inverse_patch: input.inversePatch,
      before_hash: input.beforeHash,
      after_hash: input.afterHash
    };

    this.eventStore.preparePendingMutation(commitInput);

    try {
      this.objectStore.writeObjectPrimitive(input.object);
      this.eventStore.markObjectWritten(input.eventId);
      const commit = this.eventStore.commitMutation(commitInput);
      const warnings = this.updateProjectionAfterMutation(input.object, commit.event, commit.history);

      return {
        object: input.object,
        event_id: input.eventId,
        next_rev: input.nextRev,
        warnings
      };
    } catch (error) {
      this.eventStore.markPendingFailed(input.eventId, error);
      if (error instanceof LwsError && error.code === "EVENT_APPEND_FAILED") {
        throw error;
      }
      throw new LwsError("EVENT_APPEND_FAILED", "Mutation did not complete durable event/history recording.", {
        event_id: input.eventId,
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private updateProjectionAfterMutation(object: LwsObject, event: GlobalMutationEvent, history: ObjectHistoryLink): string[] {
    if (!this.indexStore) {
      return [];
    }

    const warnings = new Set<string>();
    try {
      const result = this.indexStore.updateObjectProjection(object);
      if (result === "missing") {
        warnings.add("INDEX_REBUILD_REQUIRED");
      }
      if (result === "stale") {
        warnings.add("INDEX_STALE");
      }
    } catch (error) {
      this.indexStore.markStale(error instanceof Error ? error.message : String(error));
      warnings.add("INDEX_STALE");
    }

    try {
      const result = this.indexStore.updateMutationProjection(event, history);
      if (result === "missing") {
        warnings.add("INDEX_REBUILD_REQUIRED");
      }
      if (result === "stale") {
        warnings.add("INDEX_STALE");
      }
    } catch (error) {
      this.indexStore.markStale(error instanceof Error ? error.message : String(error));
      warnings.add("INDEX_STALE");
    }

    return Array.from(warnings);
  }

  private normalizeCreateObject<T extends LwsObject>(kind: ObjectKind, object: T, accountId: string): T {
    if (object.object_kind !== kind) {
      throw new LwsError("SCHEMA_INVALID", `Expected ${kind} object.`, {
        object_kind: object.object_kind
      });
    }

    const now = new Date().toISOString();
    return {
      ...object,
      rev: 1,
      audit: {
        ...object.audit,
        created_at: now,
        updated_at: now,
        created_by: accountId,
        updated_by: accountId
      }
    };
  }

  private withBackendUpdateFields(object: LwsObject, rev: number, accountId: string): LwsObject {
    return {
      ...object,
      rev,
      audit: {
        ...object.audit,
        updated_at: new Date().toISOString(),
        updated_by: accountId
      }
    };
  }

  private readExpectedKind(kind: ObjectKind, id: string): LwsObject {
    const object = kind === "node" ? this.objectStore.readNode(id) : this.objectStore.readEdge(id);
    if (object.object_kind !== kind) {
      throw new LwsError("SCHEMA_INVALID", `Expected ${kind} object.`, { id });
    }

    return object;
  }

  private exists(kind: ObjectKind, id: string): boolean {
    return kind === "node" ? this.objectStore.nodeExists(id) : this.objectStore.edgeExists(id);
  }

  private assertRestorablePatchRecord(current: LwsObject, patchRecord: {
    event_id: string;
    object_kind: ObjectKind;
    object_id: string;
    inverse_patch: JsonPatchOperation[];
    before_hash: string | null;
    after_hash: string;
  }): void {
    if (
      patchRecord.object_kind !== current.object_kind ||
      patchRecord.object_id !== current.id ||
      !Array.isArray(patchRecord.inverse_patch) ||
      typeof patchRecord.after_hash !== "string" ||
      sha256Object(current) !== patchRecord.after_hash
    ) {
      throw new LwsError("RESTORE_SOURCE_INVALID", "Restore source patch record does not match current object state.", {
        event_id: patchRecord.event_id,
        object_id: current.id
      });
    }

    try {
      applyPatch(current, patchRecord.inverse_patch);
    } catch (error) {
      throw new LwsError("RESTORE_SOURCE_INVALID", "Restore source inverse patch cannot be applied.", {
        event_id: patchRecord.event_id,
        object_id: current.id,
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private assertCanMutatePermissionGraph(before: LwsObject | null, after: LwsObject, context: RequestContext): void {
    if (isPermissionGraphObject(before) || isPermissionGraphObject(after)) {
      this.permissionService.assertCanManageIn(context, "scope.system");
    }
  }
}

function requireMutationAccount(context: RequestContext): string {
  if (!context.accountId) {
    throw new LwsError("PERMISSION_DENIED", "Mutation requires an account context.");
  }

  return context.accountId;
}

const PERMISSION_GRAPH_EDGE_TYPES = [
  "rel.owns",
  "rel.member_of",
  "rel.contains",
  "rel.can_read",
  "rel.can_read_in",
  "rel.can_create_in",
  "rel.can_update",
  "rel.can_update_in",
  "rel.can_manage_in"
] as const;

function isPermissionGraphObject(object: LwsObject | null): boolean {
  if (!object) {
    return false;
  }

  if (object.object_kind === "edge") {
    return PERMISSION_GRAPH_EDGE_TYPES.includes(object.type as (typeof PERMISSION_GRAPH_EDGE_TYPES)[number]);
  }

  return (
    object.id.startsWith("account.") ||
    object.id.startsWith("group.") ||
    object.id.startsWith("scope.") ||
    object.type === "type.account" ||
    object.type === "type.group" ||
    object.type === "type.scope"
  );
}
