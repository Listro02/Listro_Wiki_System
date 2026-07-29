import fs from "node:fs";
import path from "node:path";

import type { RuntimeConfig } from "../config/runtime-config.ts";
import { assertInsideRoot, objectIdToSafeSegment } from "../storage/path-resolver.ts";
import { LwsError } from "../../shared/errors.ts";
import type {
  CommitMutationInput,
  GlobalMutationEvent,
  MutationJournalStep,
  ObjectHistoryLink,
  PatchRecord,
  PendingMutationJournal
} from "./event-types.ts";
import { assertSafeEventId } from "./event-id.ts";

export type EventStoreOptions = {
  simulateCommitFailure?: boolean;
  failCommitStep?: "patch_write" | "global_event_append" | "history_append" | "head_write";
};

type AppendResult = {
  line: number;
  byteOffset: number;
};

type JsonLineRecord<T> = {
  value: T;
  line: number;
  byteOffset: number;
};

export class EventStore {
  private readonly config: RuntimeConfig;
  private readonly options: EventStoreOptions;

  constructor(config: RuntimeConfig, options: EventStoreOptions = {}) {
    this.config = config;
    this.options = options;
  }

  createEventId(now = new Date()): string {
    const date = isoDate(now).replaceAll("-", "");
    const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
    return `event.${date}.${suffix}`;
  }

  preparePendingMutation(input: CommitMutationInput): void {
    assertSafeEventId(input.event_id);
    const journal: PendingMutationJournal = {
      schema_version: 1,
      event_id: input.event_id,
      object_kind: input.object_kind,
      object_id: input.object_id,
      event_type: input.event_type,
      base_rev: input.base_rev,
      next_rev: input.next_rev,
      prepared_at: new Date().toISOString(),
      status: "pending",
      steps: {
        prepared: {
          status: "completed",
          at: new Date().toISOString()
        }
      },
      commit: input
    };

    this.writeJournal("pending", journal);
  }

  markObjectWritten(eventId: string): void {
    assertSafeEventId(eventId);
    this.markJournalStep(eventId, "object_written", "completed");
  }

  commitMutation(input: CommitMutationInput): { event: GlobalMutationEvent; history: ObjectHistoryLink } {
    assertSafeEventId(input.event_id);
    if (this.options.simulateCommitFailure) {
      throw new LwsError("EVENT_APPEND_FAILED", "Simulated event/history append failure.");
    }

    const paths = this.getObjectHistoryPaths(input.object_kind, input.object_id, input.event_id, input.occurred_at);
    const patchRecord: PatchRecord = {
      schema_version: 1,
      event_id: input.event_id,
      object_kind: input.object_kind,
      object_id: input.object_id,
      base_rev: input.base_rev,
      next_rev: input.next_rev,
      patch_format: "json-patch-like",
      patch: input.patch,
      inverse_patch: input.inverse_patch,
      before_hash: input.before_hash,
      after_hash: input.after_hash
    };

    this.runCommitStep(input.event_id, "patch_written", "patch_write", () =>
      this.writePatchRecordIfMissing(paths.patchAbsolutePath, patchRecord)
    );

    const event: GlobalMutationEvent = {
      schema_version: 1,
      event_id: input.event_id,
      event_kind: "event",
      event_type: input.event_type,
      object_kind: input.object_kind,
      object_id: input.object_id,
      base_rev: input.base_rev,
      next_rev: input.next_rev,
      account_id: input.account_id,
      occurred_at: input.occurred_at,
      summary: input.summary,
      changed_fields: input.changed_fields,
      object_history_path: paths.objectHistoryRelativePath,
      patch_path: paths.globalPatchRelativePath,
      before_hash: input.before_hash,
      after_hash: input.after_hash
    };

    const append = this.runCommitStep(input.event_id, "global_event_appended", "global_event_append", () =>
      this.appendGlobalEventIfMissing(paths.globalEventAbsolutePath, event)
    );
    const history: ObjectHistoryLink = {
      schema_version: 1,
      event_id: input.event_id,
      event_ref: paths.globalEventRelativePath,
      line: append.line,
      byte_offset: append.byteOffset,
      event_type: input.event_type,
      base_rev: input.base_rev,
      next_rev: input.next_rev,
      occurred_at: input.occurred_at,
      summary: input.summary,
      patch_path: paths.objectPatchRelativePath,
      after_hash: input.after_hash
    };

    this.runCommitStep(input.event_id, "history_appended", "history_append", () =>
      this.appendHistoryIfMissing(paths.objectHistoryAbsolutePath, history)
    );
    this.runCommitStep(input.event_id, "head_written", "head_write", () =>
      this.writeHeadRecord(paths.headAbsolutePath, {
      object_kind: input.object_kind,
      object_id: input.object_id,
      current_rev: input.next_rev,
      latest_event_id: input.event_id,
      latest_hash: input.after_hash
      })
    );
    this.moveJournalToCommitted(input.event_id);

    return { event, history };
  }

  markPendingFailed(eventId: string, error: unknown): void {
    assertSafeEventId(eventId);
    const pending = this.readJournal("pending", eventId);
    if (!pending) {
      return;
    }

    const failed: PendingMutationJournal = {
      ...pending,
      status: "failed",
      error: error instanceof Error ? error.message : String(error)
    };
    this.writeJournal("failed", failed);
    this.deleteJournal("pending", eventId);
  }

  listIncompleteMutations(): PendingMutationJournal[] {
    return [...this.readJournals("pending"), ...this.readJournals("failed")];
  }

  getRecoveryReport(): {
    pending: PendingMutationJournal[];
    failed: PendingMutationJournal[];
    repairable_count: number;
    manual_repair_count: number;
  } {
    const pending = this.readJournals("pending");
    const failed = this.readJournals("failed");
    const all = [...pending, ...failed];
    return {
      pending,
      failed,
      repairable_count: all.filter((journal) => Boolean(journal.commit)).length,
      manual_repair_count: all.filter((journal) => !journal.commit).length
    };
  }

  repairMutation(eventId: string): { event_id: string; status: "repaired" | "manual_repair_required" } {
    assertSafeEventId(eventId);
    const journal = this.readJournal("pending", eventId) ?? this.readJournal("failed", eventId);
    if (!journal?.commit) {
      return {
        event_id: eventId,
        status: "manual_repair_required"
      };
    }

    try {
      this.commitMutation(journal.commit);
    } catch (error) {
      this.markPendingFailed(eventId, error);
      return {
        event_id: eventId,
        status: "manual_repair_required"
      };
    }

    return {
      event_id: eventId,
      status: "repaired"
    };
  }

  repairAllMutations(): {
    repaired: string[];
    manual_repair_required: string[];
  } {
    const repaired: string[] = [];
    const manualRepairRequired: string[] = [];
    for (const journal of this.listIncompleteMutations()) {
      const result = this.repairMutation(journal.event_id);
      if (result.status === "repaired") {
        repaired.push(journal.event_id);
      } else {
        manualRepairRequired.push(journal.event_id);
      }
    }

    return {
      repaired,
      manual_repair_required: manualRepairRequired
    };
  }

  listObjectHistory(objectKind: "node" | "edge", objectId: string): ObjectHistoryLink[] {
    const paths = this.getObjectHistoryCollectionPaths(objectKind, objectId);
    if (!fs.existsSync(paths.objectHistoryAbsolutePath)) {
      return [];
    }

    return readJsonLines<ObjectHistoryLink>(paths.objectHistoryAbsolutePath);
  }

  readGlobalEvent(history: ObjectHistoryLink): GlobalMutationEvent {
    assertSafeEventId(history.event_id);
    const absolutePath = this.resolveGlobalEventRef(history.event_ref);
    const events = readJsonLines<GlobalMutationEvent>(absolutePath);
    const event = events.find((candidate) => candidate.event_id === history.event_id);
    if (!event) {
      throw new LwsError("OBJECT_NOT_FOUND", "History event was not found.", { event_id: history.event_id });
    }

    return event;
  }

  readPatchRecord(objectKind: "node" | "edge", objectId: string, eventId: string): PatchRecord {
    assertSafeEventId(eventId);
    const paths = this.getObjectHistoryPaths(objectKind, objectId, eventId, new Date().toISOString());
    if (!fs.existsSync(paths.patchAbsolutePath)) {
      throw new LwsError("OBJECT_NOT_FOUND", "Patch record was not found.", { event_id: eventId });
    }

    return JSON.parse(fs.readFileSync(paths.patchAbsolutePath, "utf8")) as PatchRecord;
  }

  private runCommitStep<T>(
    eventId: string,
    journalStep: MutationJournalStep,
    failureStep: NonNullable<EventStoreOptions["failCommitStep"]>,
    action: () => T
  ): T {
    try {
      if (this.options.failCommitStep === failureStep) {
        throw new LwsError("EVENT_APPEND_FAILED", `Simulated ${failureStep} failure.`);
      }
      const result = action();
      this.markJournalStep(eventId, journalStep, "completed");
      return result;
    } catch (error) {
      this.markJournalStep(eventId, journalStep, "failed", error);
      if (error instanceof LwsError && error.code === "EVENT_APPEND_FAILED") {
        throw error;
      }
      throw new LwsError("EVENT_APPEND_FAILED", "Mutation did not complete durable event/history recording.", {
        event_id: eventId,
        step: journalStep,
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private writePatchRecordIfMissing(filePath: string, expected: PatchRecord): void {
    if (fs.existsSync(filePath)) {
      assertJsonEquivalent(
        JSON.parse(fs.readFileSync(filePath, "utf8")) as PatchRecord,
        expected,
        "Patch record conflicts with pending mutation journal.",
        expected.event_id
      );
      return;
    }

    writeJsonFile(filePath, expected);
  }

  private appendGlobalEventIfMissing(filePath: string, expected: GlobalMutationEvent): AppendResult {
    const existing = findJsonLine<GlobalMutationEvent>(
      filePath,
      (candidate) => candidate.event_id === expected.event_id
    );
    if (existing) {
      assertJsonEquivalent(
        existing.value,
        expected,
        "Global event record conflicts with pending mutation journal.",
        expected.event_id
      );
      return {
        line: existing.line,
        byteOffset: existing.byteOffset
      };
    }

    return appendJsonLine(filePath, expected);
  }

  private appendHistoryIfMissing(filePath: string, expected: ObjectHistoryLink): void {
    const existing = findJsonLine<ObjectHistoryLink>(
      filePath,
      (candidate) => candidate.event_id === expected.event_id
    );
    if (existing) {
      assertJsonEquivalent(
        existing.value,
        expected,
        "Object history record conflicts with pending mutation journal.",
        expected.event_id
      );
      return;
    }

    appendJsonLine(filePath, expected);
  }

  private writeHeadRecord(
    filePath: string,
    expected: {
      object_kind: "node" | "edge";
      object_id: string;
      current_rev: number;
      latest_event_id: string;
      latest_hash: string;
    }
  ): void {
    if (fs.existsSync(filePath)) {
      const existing = JSON.parse(fs.readFileSync(filePath, "utf8")) as typeof expected;
      if (JSON.stringify(existing) === JSON.stringify(expected)) {
        return;
      }
      if (
        existing.object_kind !== expected.object_kind ||
        existing.object_id !== expected.object_id ||
        existing.current_rev !== expected.current_rev - 1
      ) {
        throw new LwsError("EVENT_APPEND_FAILED", "Object history head conflicts with pending mutation journal.", {
          event_id: expected.latest_event_id
        });
      }
    }

    writeJsonFile(filePath, expected);
  }

  private getObjectHistoryPaths(objectKind: "node" | "edge", objectId: string, eventId: string, occurredAt: string) {
    assertSafeEventId(eventId);

    const date = occurredAt.slice(0, 10);
    const [year, month, day] = date.split("-");
    const globalEventRelativePath = toPosix(path.join("events", year, month, `${day}.jsonl`));
    const collectionPaths = this.getObjectHistoryCollectionPaths(objectKind, objectId);
    const objectPatchRelativePath = toPosix(path.join("patches", `${eventId}.json`));
    const globalPatchRelativePath = toPosix(path.join(collectionPaths.objectHistoryRoot, objectPatchRelativePath));

    return {
      globalEventRelativePath,
      globalEventAbsolutePath: this.resolveDataRelativePath(globalEventRelativePath, "write"),
      objectHistoryRelativePath: collectionPaths.objectHistoryRelativePath,
      objectHistoryAbsolutePath: collectionPaths.objectHistoryAbsolutePath,
      objectPatchRelativePath,
      globalPatchRelativePath,
      patchAbsolutePath: this.resolveDataRelativePath(globalPatchRelativePath, "write"),
      headAbsolutePath: collectionPaths.headAbsolutePath
    };
  }

  private getObjectHistoryCollectionPaths(objectKind: "node" | "edge", objectId: string) {
    const safeObjectId = objectIdToSafeSegment(objectId);
    const objectHistoryRoot = path.join("history", `${objectKind}s`, safeObjectId);
    const objectHistoryRelativePath = toPosix(path.join(objectHistoryRoot, "events.jsonl"));
    const headRelativePath = toPosix(path.join(objectHistoryRoot, "head.json"));

    return {
      objectHistoryRoot: toPosix(objectHistoryRoot),
      objectHistoryRelativePath,
      objectHistoryAbsolutePath: this.resolveDataRelativePath(objectHistoryRelativePath, "read"),
      headAbsolutePath: this.resolveDataRelativePath(headRelativePath, "write")
    };
  }

  private writeJournal(state: "pending" | "failed" | "committed", journal: PendingMutationJournal): void {
    assertSafeEventId(journal.event_id);
    const directory = this.resolveRuntimeRelativePath(path.join("mutations", state), "write");
    fs.mkdirSync(directory, { recursive: true });
    writeJsonFile(this.resolveRuntimeRelativePath(path.join("mutations", state, `${journal.event_id}.json`), "write"), journal);
  }

  private readJournal(state: "pending" | "failed" | "committed", eventId: string): PendingMutationJournal | null {
    assertSafeEventId(eventId);
    const file = this.resolveRuntimeRelativePath(path.join("mutations", state, `${eventId}.json`), "read");
    if (!fs.existsSync(file)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(file, "utf8")) as PendingMutationJournal;
  }

  private readJournals(state: "pending" | "failed" | "committed"): PendingMutationJournal[] {
    const directory = this.resolveRuntimeRelativePath(path.join("mutations", state), "read");
    if (!fs.existsSync(directory)) {
      return [];
    }

    return fs
      .readdirSync(directory)
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")) as PendingMutationJournal);
  }

  private moveJournalToCommitted(eventId: string): void {
    const from = this.readJournal("pending", eventId) ? "pending" : "failed";
    const journal = this.readJournal(from, eventId);
    if (!journal) {
      return;
    }

    this.writeJournal("committed", {
      ...journal,
      status: "committed"
    });
    this.deleteJournal(from, eventId);
  }

  private deleteJournal(state: "pending" | "failed" | "committed", eventId: string): void {
    assertSafeEventId(eventId);
    const file = this.resolveRuntimeRelativePath(path.join("mutations", state, `${eventId}.json`), "write");
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }

  private markJournalStep(
    eventId: string,
    step: MutationJournalStep,
    status: "completed" | "failed",
    error?: unknown
  ): void {
    const state = this.readJournal("pending", eventId)
      ? "pending"
      : this.readJournal("failed", eventId)
        ? "failed"
        : null;
    if (!state) {
      return;
    }

    const journal = this.readJournal(state, eventId);
    if (!journal) {
      return;
    }

    this.writeJournal(state, {
      ...journal,
      steps: {
        ...journal.steps,
        [step]: {
          status,
          at: new Date().toISOString(),
          ...(error === undefined
            ? {}
            : { error: error instanceof Error ? error.message : String(error) })
        }
      }
    });
  }

  private resolveGlobalEventRef(eventRef: string): string {
    if (!/^events\/\d{4}\/\d{2}\/\d{2}\.jsonl$/.test(eventRef)) {
      throw new LwsError("PATH_OUTSIDE_ROOT", "History event reference is not safe for storage path resolution.", {
        event_ref: eventRef
      });
    }

    return this.resolveDataRelativePath(eventRef, "read");
  }

  private resolveDataRelativePath(relativePath: string, access: "read" | "write"): string {
    return this.resolveRootRelativePath(this.config.roots.data, "data", relativePath, access);
  }

  private resolveRuntimeRelativePath(relativePath: string, access: "read" | "write"): string {
    return this.resolveRootRelativePath(this.config.roots.runtime, "runtime", relativePath, access);
  }

  private resolveRootRelativePath(
    root: string,
    rootName: "data" | "runtime",
    relativePath: string,
    _access: "read" | "write"
  ): string {
    this.assertRootExists(root, rootName);
    if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes("..")) {
      throw new LwsError("PATH_OUTSIDE_ROOT", "Resolved relative path attempted to escape its root.", {
        root: rootName,
        relative_path: relativePath
      });
    }

    const absolutePath = path.resolve(root, relativePath);
    assertInsideRoot(root, absolutePath);
    return absolutePath;
  }

  private assertRootExists(root: string, name: string): void {
    if (!fs.existsSync(root)) {
      throw new LwsError("STORAGE_ROOT_MISSING", `${name} root does not exist.`, { root });
    }
  }
}

function appendJsonLine(filePath: string, value: unknown): AppendResult {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const byteOffset = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  const line = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter((item) => item.length > 0).length + 1
    : 1;
  const fd = fs.openSync(filePath, "a");
  try {
    fs.writeSync(fd, `${JSON.stringify(value)}\n`, undefined, "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fsyncDirectory(path.dirname(filePath));
  return { line, byteOffset };
}

function writeJsonFile(filePath: string, value: unknown): void {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const tempPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`);
  const fd = fs.openSync(tempPath, "w");
  try {
    fs.writeSync(fd, `${JSON.stringify(value, null, 2)}\n`, undefined, "utf8");
    fs.fsyncSync(fd);
  } catch (error) {
    fs.closeSync(fd);
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
  fs.closeSync(fd);
  fs.renameSync(tempPath, filePath);
  fsyncDirectory(directory);
}

function readJsonLines<T>(filePath: string): T[] {
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toPosix(candidate: string): string {
  return candidate.replaceAll("\\", "/");
}

function findJsonLine<T>(filePath: string, predicate: (value: T) => boolean): JsonLineRecord<T> | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  let byteOffset = 0;
  const lines = fs.readFileSync(filePath, "utf8").split(/(\r?\n)/);
  let logicalLine = 0;
  for (let index = 0; index < lines.length; index += 2) {
    const line = lines[index];
    const newline = lines[index + 1] ?? "";
    if (line.trim().length === 0) {
      byteOffset += Buffer.byteLength(line + newline, "utf8");
      continue;
    }

    logicalLine += 1;
    const value = JSON.parse(line) as T;
    if (predicate(value)) {
      return {
        value,
        line: logicalLine,
        byteOffset
      };
    }

    byteOffset += Buffer.byteLength(line + newline, "utf8");
  }

  return null;
}

function assertJsonEquivalent(existing: unknown, expected: unknown, message: string, eventId: string): void {
  if (JSON.stringify(existing) === JSON.stringify(expected)) {
    return;
  }

  throw new LwsError("EVENT_APPEND_FAILED", message, { event_id: eventId });
}

function fsyncDirectory(directory: string): void {
  try {
    const fd = fs.openSync(directory, "r");
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    // Directory fsync is platform-dependent; file fsync remains the durable baseline.
  }
}
