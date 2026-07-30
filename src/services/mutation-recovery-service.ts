import type { RuntimeConfig } from "../modules/config/runtime-config.ts";
import type { EventStore } from "../modules/events/event-store.ts";
import type { MutationJournalStep, PendingMutationJournal } from "../modules/events/event-types.ts";
import { sha256Object } from "../modules/hashing/object-hash.ts";
import { getMutationConsistencyIssues } from "../modules/storage/storage-doctor.ts";
import type { ObjectStore } from "../modules/storage/object-store.ts";
import { LwsError } from "../shared/errors.ts";

const COMMIT_STEPS: MutationJournalStep[] = [
  "prepared",
  "object_written",
  "patch_written",
  "global_event_appended",
  "history_appended",
  "head_written"
];

export type MutationManualRepairReason =
  | "COMMIT_PAYLOAD_MISSING"
  | "OBJECT_MISSING"
  | "OBJECT_HASH_MISMATCH"
  | "COMMIT_STEP_CONFLICT";

export type MutationRecoveryItem = {
  event_id: string;
  object_id: string;
  status: "pending" | "failed" | "committed";
  completed_steps: MutationJournalStep[];
  failed_steps: MutationJournalStep[];
  missing_steps: MutationJournalStep[];
  repairable: boolean;
  manual_repair_reason?: MutationManualRepairReason;
};

export type MutationRecoveryReport = {
  pending: PendingMutationJournal[];
  failed: PendingMutationJournal[];
  repairable_count: number;
  manual_repair_count: number;
  recovery_items: MutationRecoveryItem[];
  mutation_consistency_issues: ReturnType<typeof getMutationConsistencyIssues>;
};

export type MutationRepairResult = {
  repaired: string[];
  manual_repair_required: string[];
  recovery_items: MutationRecoveryItem[];
};

export class MutationRecoveryService {
  private readonly objectStore: ObjectStore;
  private readonly eventStore: EventStore;
  private readonly config: RuntimeConfig;

  constructor(objectStore: ObjectStore, eventStore: EventStore, config: RuntimeConfig) {
    this.objectStore = objectStore;
    this.eventStore = eventStore;
    this.config = config;
  }

  getRecoveryReport(): MutationRecoveryReport {
    const pending = this.eventStore.listIncompleteMutations().filter((journal) => journal.status === "pending");
    const failed = this.eventStore.listIncompleteMutations().filter((journal) => journal.status === "failed");
    const recoveryItems = [...pending, ...failed].map((journal) => this.classifyJournal(journal));

    return {
      pending,
      failed,
      repairable_count: recoveryItems.filter((item) => item.repairable).length,
      manual_repair_count: recoveryItems.filter((item) => !item.repairable).length,
      recovery_items: recoveryItems,
      mutation_consistency_issues: getMutationConsistencyIssues(this.config)
    };
  }

  repairAllMutations(): MutationRepairResult {
    const repaired: string[] = [];
    const manualRepairRequired: string[] = [];
    const recoveryItems: MutationRecoveryItem[] = [];

    for (const journal of this.eventStore.listIncompleteMutations()) {
      const item = this.classifyJournal(journal);
      if (!item.repairable) {
        manualRepairRequired.push(item.event_id);
        recoveryItems.push(item);
        continue;
      }

      const result = this.eventStore.repairMutation(item.event_id);
      if (result.status === "repaired") {
        repaired.push(item.event_id);
      } else {
        manualRepairRequired.push(item.event_id);
        recoveryItems.push({
          ...item,
          repairable: false,
          manual_repair_reason: "COMMIT_STEP_CONFLICT"
        });
      }
    }

    return {
      repaired,
      manual_repair_required: manualRepairRequired,
      recovery_items: recoveryItems
    };
  }

  private classifyJournal(journal: PendingMutationJournal): MutationRecoveryItem {
    const completedSteps = COMMIT_STEPS.filter((step) => journal.steps?.[step]?.status === "completed");
    const failedSteps = COMMIT_STEPS.filter((step) => journal.steps?.[step]?.status === "failed");
    const missingSteps = COMMIT_STEPS.filter((step) => journal.steps?.[step]?.status !== "completed");
    const base = {
      event_id: journal.event_id,
      object_id: journal.object_id,
      status: journal.status,
      completed_steps: completedSteps,
      failed_steps: failedSteps,
      missing_steps: missingSteps
    };

    if (!journal.commit) {
      return {
        ...base,
        repairable: false,
        manual_repair_reason: "COMMIT_PAYLOAD_MISSING"
      };
    }

    try {
      const object = this.objectStore.readObject(journal.object_id);
      const currentHash = sha256Object(object);
      if (currentHash !== journal.commit.after_hash) {
        return {
          ...base,
          repairable: false,
          manual_repair_reason: "OBJECT_HASH_MISMATCH"
        };
      }
    } catch (error) {
      if (error instanceof LwsError && error.code === "OBJECT_NOT_FOUND") {
        return {
          ...base,
          repairable: false,
          manual_repair_reason: "OBJECT_MISSING"
        };
      }
      throw error;
    }

    return {
      ...base,
      repairable: true
    };
  }
}
