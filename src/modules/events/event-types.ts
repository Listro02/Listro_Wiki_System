import type { JsonPatchOperation } from "../patch/patch-engine.ts";
import type { ObjectKind } from "../../shared/object-model.ts";

export type MutationEventType =
  | "node.created"
  | "node.updated"
  | "node.deleted"
  | "node.restored"
  | "edge.created"
  | "edge.updated"
  | "edge.deleted"
  | "edge.restored";

export type GlobalMutationEvent = {
  schema_version: 1;
  event_id: string;
  event_kind: "event";
  event_type: MutationEventType;
  object_kind: ObjectKind;
  object_id: string;
  base_rev: number;
  next_rev: number;
  account_id: string;
  occurred_at: string;
  summary: string;
  changed_fields: string[];
  object_history_path: string;
  patch_path: string;
  before_hash: string | null;
  after_hash: string;
};

export type ObjectHistoryLink = {
  schema_version: 1;
  event_id: string;
  event_ref: string;
  line: number;
  byte_offset: number;
  event_type: MutationEventType;
  base_rev: number;
  next_rev: number;
  occurred_at: string;
  summary: string;
  patch_path: string;
  after_hash: string;
};

export type PatchRecord = {
  schema_version: 1;
  event_id: string;
  object_kind: ObjectKind;
  object_id: string;
  base_rev: number;
  next_rev: number;
  patch_format: "json-patch-like";
  patch: JsonPatchOperation[];
  inverse_patch: JsonPatchOperation[];
  before_hash: string | null;
  after_hash: string;
};

export type CommitMutationInput = {
  event_id: string;
  event_type: MutationEventType;
  object_kind: ObjectKind;
  object_id: string;
  base_rev: number;
  next_rev: number;
  account_id: string;
  occurred_at: string;
  summary: string;
  changed_fields: string[];
  patch: JsonPatchOperation[];
  inverse_patch: JsonPatchOperation[];
  before_hash: string | null;
  after_hash: string;
};

export type MutationJournalStep =
  | "prepared"
  | "object_written"
  | "patch_written"
  | "global_event_appended"
  | "history_appended"
  | "head_written";

export type MutationJournalStepState = {
  status: "completed" | "failed";
  at: string;
  error?: string;
};

export type PendingMutationJournal = {
  schema_version: 1;
  event_id: string;
  object_kind: ObjectKind;
  object_id: string;
  event_type: MutationEventType;
  base_rev: number;
  next_rev: number;
  prepared_at: string;
  status: "pending" | "failed" | "committed";
  steps?: Partial<Record<MutationJournalStep, MutationJournalStepState>>;
  error?: string;
  commit?: CommitMutationInput;
};
