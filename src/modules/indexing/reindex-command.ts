import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { LwsError } from "../../shared/errors.ts";
import type { LwsObject, ObjectKind } from "../../shared/object-model.ts";
import type { GlobalMutationEvent, ObjectHistoryLink } from "../events/event-types.ts";
import { sha256Object } from "../hashing/object-hash.ts";
import type { ObjectStore } from "../storage/object-store.ts";
import type { ValidationService } from "../validation/validation-service.ts";
import type { IndexStore } from "./index-store.ts";
import { INDEX_SCHEMA_VERSION } from "./sqlite-schema.ts";
import type { JobRunContext } from "../../services/job-service.ts";

export type ReindexResult = {
  build_id: string;
  status: "succeeded" | "failed";
  object_count: number;
  edge_count: number;
  warning_count: number;
  started_at: string;
  finished_at: string;
};

export class ReindexCommand {
  private readonly objectStore: ObjectStore;
  private readonly validationService: ValidationService;
  private readonly indexStore: IndexStore;

  constructor(objectStore: ObjectStore, validationService: ValidationService, indexStore: IndexStore) {
    this.objectStore = objectStore;
    this.validationService = validationService;
    this.indexStore = indexStore;
  }

  run(job?: Pick<JobRunContext<ReindexResult>, "updateProgress" | "checkCanceled">): ReindexResult {
    this.recoverCorruptIndexFile();
    const db = this.indexStore.open();
    const startedAt = new Date().toISOString();
    const buildId = `indexbuild.${startedAt.slice(0, 10).replaceAll("-", "")}.${crypto
      .randomUUID()
      .replaceAll("-", "")
      .slice(0, 12)
      .toUpperCase()}`;

    try {
      this.indexStore.initialize(db);
      db.exec("BEGIN");
      this.indexStore.clearProjection(db);
      const result = this.rebuildProjection(db, buildId, startedAt, job);
      job?.checkCanceled();
      job?.updateProgress({ phase: "permissions", message: "Rebuilding permission projection" });
      this.indexStore.rebuildPermissionProjection(db);
      db.exec("COMMIT");
      db.close();
      return result;
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // Ignore rollback failures from early SQLite corruption/cancellation exits.
      }
      db.close();
      if (error instanceof Error && error.name === "JobCanceledSignal") {
        throw error;
      }
      throw new LwsError("INDEX_CORRUPT", "Reindex command failed.", {
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private rebuildProjection(
    db: DatabaseSync,
    buildId: string,
    startedAt: string,
    job?: Pick<JobRunContext<ReindexResult>, "updateProgress" | "checkCanceled">
  ): ReindexResult {
    let objectCount = 0;
    let edgeCount = 0;
    let warningCount = 0;
    job?.updateProgress({ phase: "events", current: 0, total: null, message: "Rebuilding event projection" });
    const eventProjection = this.rebuildEventProjection(db, job);
    warningCount += eventProjection.warning_count;

    const sourceFiles = [...this.objectStore.listSourceFiles("node"), ...this.objectStore.listSourceFiles("edge")];
    job?.updateProgress({
      phase: "objects",
      current: 0,
      total: sourceFiles.length,
      scanned_count: 0,
      warning_count: warningCount,
      message: "Rebuilding object projection"
    });
    for (const filePath of sourceFiles) {
      job?.checkCanceled();
      const raw = readJson(filePath);
      const report = this.validationService.validateUnknownObject(raw);
      if (!report.ok) {
        warningCount += report.issues.length;
        for (const issue of report.issues) {
          this.indexStore.insertValidationIssue(db, {
            object_id: report.object_id,
            object_kind: report.object_kind,
            code: issue.code,
            severity: issue.severity,
            message: issue.message,
            target: issue.target
          });
        }
        continue;
      }

      const object = raw as LwsObject;
      this.indexStore.insertObject(db, object);
      objectCount += 1;
      if (object.object_kind === "edge") {
        edgeCount += 1;
      }
      job?.updateProgress({
        phase: "objects",
        current: objectCount,
        total: sourceFiles.length,
        scanned_count: objectCount,
        warning_count: warningCount,
        message: `Projected ${objectCount}/${sourceFiles.length} valid objects`
      });
    }

    job?.updateProgress({ phase: "history", warning_count: warningCount, message: "Rebuilding object history projection" });
    const historyProjection = this.rebuildObjectHistoryProjection(db, eventProjection.events, job);
    warningCount += historyProjection.warning_count;
    warningCount += this.validateHistoryHeads(db, eventProjection.events, job);

    const finishedAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO index_builds
        (build_id, status, started_at, finished_at, object_count, edge_count, warning_count, schema_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(buildId, "succeeded", startedAt, finishedAt, objectCount, edgeCount, warningCount, INDEX_SCHEMA_VERSION);
    db.prepare("INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)").run("index_state", "ready");
    db.prepare("INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)").run("last_reindex_status", "succeeded");
    db.prepare("INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)").run("last_successful_build_id", buildId);
    db.prepare("INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)").run("last_successful_build_finished_at", finishedAt);
    db.prepare("INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)").run("last_reindex_warning_count", String(warningCount));
    db.prepare("INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)").run("search_mode", "fallback_like");

    return {
      build_id: buildId,
      status: "succeeded",
      object_count: objectCount,
      edge_count: edgeCount,
      warning_count: warningCount,
      started_at: startedAt,
      finished_at: finishedAt
    };
  }

  private rebuildEventProjection(
    db: DatabaseSync,
    job?: Pick<JobRunContext<ReindexResult>, "updateProgress" | "checkCanceled">
  ): {
    events: Map<string, GlobalMutationEvent>;
    warning_count: number;
  } {
    const events = new Map<string, GlobalMutationEvent>();
    let warningCount = 0;
    const eventsRoot = path.join(this.indexStore.getDataRoot(), "events");
    for (const filePath of listJsonlFiles(eventsRoot)) {
      job?.checkCanceled();
      let line = 0;
      for (const entry of readJsonLines(filePath)) {
        job?.checkCanceled();
        line += 1;
        if (!entry.ok) {
          warningCount += 1;
          this.insertProjectionIssue(db, null, null, "EVENT_LOG_INVALID", entry.error, `${filePath}:${line}`);
          continue;
        }

        const event = parseGlobalEvent(entry.value);
        if (!event.ok) {
          warningCount += 1;
          this.insertProjectionIssue(db, null, null, "EVENT_LOG_INVALID", event.error, `${filePath}:${line}`);
          continue;
        }

        this.indexStore.insertEventProjection(db, event.value);
        events.set(event.value.event_id, event.value);
      }
    }

    return { events, warning_count: warningCount };
  }

  private rebuildObjectHistoryProjection(
    db: DatabaseSync,
    events: Map<string, GlobalMutationEvent>,
    job?: Pick<JobRunContext<ReindexResult>, "updateProgress" | "checkCanceled">
  ): { warning_count: number } {
    let warningCount = 0;
    const historyRoot = path.join(this.indexStore.getDataRoot(), "history");
    for (const filePath of listHistoryJsonlFiles(historyRoot)) {
      job?.checkCanceled();
      let line = 0;
      for (const entry of readJsonLines(filePath)) {
        job?.checkCanceled();
        line += 1;
        if (!entry.ok) {
          warningCount += 1;
          this.insertProjectionIssue(db, null, null, "OBJECT_HISTORY_INVALID", entry.error, `${filePath}:${line}`);
          continue;
        }

        const history = parseObjectHistoryLink(entry.value);
        if (!history.ok) {
          warningCount += 1;
          this.insertProjectionIssue(db, null, null, "OBJECT_HISTORY_INVALID", history.error, `${filePath}:${line}`);
          continue;
        }

        const event = events.get(history.value.event_id);
        if (!event) {
          warningCount += 1;
          this.insertProjectionIssue(
            db,
            null,
            null,
            "EVENT_REF_MISSING",
            "Object history references a missing global event.",
            `${filePath}:${line}`
          );
          continue;
        }

        const consistencyIssue = validateHistoryConsistency(this.indexStore.getDataRoot(), filePath, history.value, event);
        if (consistencyIssue) {
          warningCount += 1;
          this.insertProjectionIssue(
            db,
            event.object_id,
            event.object_kind,
            consistencyIssue.code,
            consistencyIssue.message,
            consistencyIssue.target
          );
          continue;
        }

        this.indexStore.insertObjectHistoryProjection(db, event.object_kind, event.object_id, history.value);
      }
    }

    return { warning_count: warningCount };
  }

  private validateHistoryHeads(
    db: DatabaseSync,
    events: Map<string, GlobalMutationEvent>,
    job?: Pick<JobRunContext<ReindexResult>, "updateProgress" | "checkCanceled">
  ): number {
    let warningCount = 0;
    const historyRoot = path.join(this.indexStore.getDataRoot(), "history");
    for (const historyFilePath of listHistoryJsonlFiles(historyRoot)) {
      job?.checkCanceled();
      const objectKind = objectKindFromHistoryFile(historyRoot, historyFilePath);
      const headPath = path.join(path.dirname(historyFilePath), "head.json");
      if (!objectKind) {
        continue;
      }

      if (!fs.existsSync(headPath)) {
        warningCount += 1;
        this.insertProjectionIssue(
          db,
          null,
          objectKind,
          "MUTATION_HEAD_MISSING",
          "Object history is missing head.json.",
          headPath
        );
        continue;
      }

      let rawHead: unknown;
      try {
        rawHead = readJson(headPath);
      } catch (error) {
        warningCount += 1;
        this.insertProjectionIssue(
          db,
          null,
          objectKind,
          "MUTATION_HEAD_INVALID",
          error instanceof Error ? error.message : String(error),
          headPath
        );
        continue;
      }

      const head = parseObjectHistoryHead(rawHead);
      if (!head.ok) {
        warningCount += 1;
        this.insertProjectionIssue(db, null, objectKind, "MUTATION_HEAD_INVALID", head.error, headPath);
        continue;
      }

      if (head.value.object_kind !== objectKind) {
        warningCount += 1;
        this.insertProjectionIssue(
          db,
          head.value.object_id,
          head.value.object_kind,
          "MUTATION_HEAD_KIND_MISMATCH",
          "Object history head kind does not match its history directory.",
          headPath
        );
      }

      if (!events.has(head.value.latest_event_id)) {
        warningCount += 1;
        this.insertProjectionIssue(
          db,
          head.value.object_id,
          head.value.object_kind,
          "MUTATION_HEAD_EVENT_MISSING",
          "Object history head references a missing latest event.",
          headPath
        );
      }

      let object: LwsObject;
      try {
        object = this.objectStore.readObject(head.value.object_id);
      } catch (error) {
        warningCount += 1;
        this.insertProjectionIssue(
          db,
          head.value.object_id,
          head.value.object_kind,
          "MUTATION_OBJECT_MISSING",
          "Object history head references a missing current object.",
          headPath
        );
        continue;
      }

      if (object.object_kind !== head.value.object_kind) {
        warningCount += 1;
        this.insertProjectionIssue(
          db,
          head.value.object_id,
          head.value.object_kind,
          "MUTATION_OBJECT_KIND_MISMATCH",
          "Current object kind does not match its history head.",
          headPath
        );
      }

      if (object.rev !== head.value.current_rev) {
        warningCount += 1;
        this.insertProjectionIssue(
          db,
          head.value.object_id,
          head.value.object_kind,
          "MUTATION_REV_MISMATCH",
          "Current object rev does not match its history head.",
          headPath
        );
      }

      if (sha256Object(object) !== head.value.latest_hash) {
        warningCount += 1;
        this.insertProjectionIssue(
          db,
          head.value.object_id,
          head.value.object_kind,
          "MUTATION_HASH_MISMATCH",
          "Current object hash does not match its history head.",
          headPath
        );
      }
    }

    return warningCount;
  }

  private recoverCorruptIndexFile(): void {
    const status = this.indexStore.getStatus();
    if (status.state !== "INDEX_CORRUPT" || !fs.existsSync(status.sqlitePath)) {
      return;
    }

    const recoveredPath = `${status.sqlitePath}.corrupt.${Date.now()}`;
    fs.renameSync(status.sqlitePath, recoveredPath);
  }

  private insertProjectionIssue(
    db: DatabaseSync,
    objectId: string | null,
    objectKind: "node" | "edge" | null,
    code: string,
    message: string,
    target: string
  ): void {
    this.indexStore.insertValidationIssue(db, {
      object_id: objectId,
      object_kind: objectKind,
      code,
      severity: "warning",
      message,
      target
    });
  }
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listJsonlFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return listJsonlFiles(absolutePath);
    }
    return entry.isFile() && entry.name.endsWith(".jsonl") ? [absolutePath] : [];
  });
}

function listHistoryJsonlFiles(historyRoot: string): string[] {
  return [...listJsonlFiles(path.join(historyRoot, "nodes")), ...listJsonlFiles(path.join(historyRoot, "edges"))].filter(
    (candidate) => path.basename(candidate) === "events.jsonl"
  );
}

function readJsonLines(filePath: string): Array<{ ok: true; value: unknown } | { ok: false; error: string }> {
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      try {
        return { ok: true, value: JSON.parse(line) };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
}

function parseGlobalEvent(value: unknown): { ok: true; value: GlobalMutationEvent } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "Global event row must be an object." };
  }

  const required = [
    "event_id",
    "event_type",
    "object_kind",
    "object_id",
    "base_rev",
    "next_rev",
    "account_id",
    "occurred_at",
    "summary",
    "object_history_path",
    "patch_path",
    "after_hash"
  ];
  for (const key of required) {
    if (!(key in value)) {
      return { ok: false, error: `Global event row is missing ${key}.` };
    }
  }

  if (value.object_kind !== "node" && value.object_kind !== "edge") {
    return { ok: false, error: "Global event object_kind must be node or edge." };
  }

  return { ok: true, value: value as GlobalMutationEvent };
}

function parseObjectHistoryLink(value: unknown): { ok: true; value: ObjectHistoryLink } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "Object history row must be an object." };
  }

  const required = [
    "event_id",
    "event_ref",
    "line",
    "byte_offset",
    "event_type",
    "base_rev",
    "next_rev",
    "occurred_at",
    "summary",
    "patch_path",
    "after_hash"
  ];
  for (const key of required) {
    if (!(key in value)) {
      return { ok: false, error: `Object history row is missing ${key}.` };
    }
  }

  return { ok: true, value: value as ObjectHistoryLink };
}

function validateHistoryConsistency(
  dataRoot: string,
  historyFilePath: string,
  history: ObjectHistoryLink,
  event: GlobalMutationEvent
): { code: string; message: string; target: string } | null {
  if (!/^events\/\d{4}\/\d{2}\/\d{2}\.jsonl$/.test(history.event_ref)) {
    return {
      code: "EVENT_REF_INVALID",
      message: "Object history event_ref is not a safe global event reference.",
      target: historyFilePath
    };
  }

  const expectedEventRef = toPosix(path.relative(dataRoot, findGlobalEventPath(dataRoot, event.occurred_at)));
  if (history.event_ref !== expectedEventRef || history.event_ref !== eventRefFromHistory(history.event_ref)) {
    return {
      code: "EVENT_REF_INVALID",
      message: "Object history event_ref does not match its global event.",
      target: historyFilePath
    };
  }

  const byteOffsetIssue = validateEventByteOffset(findGlobalEventPath(dataRoot, event.occurred_at), history);
  if (byteOffsetIssue) {
    return byteOffsetIssue;
  }

  if (!/^patches\/event\.\d{8}\.[A-F0-9]{16}\.json$/.test(history.patch_path)) {
    return {
      code: "PATCH_PATH_INVALID",
      message: "Object history patch_path is not a safe patch record reference.",
      target: historyFilePath
    };
  }

  const patchPath = path.join(path.dirname(historyFilePath), history.patch_path);
  if (!fs.existsSync(patchPath)) {
    return {
      code: "PATCH_PATH_MISSING",
      message: "Object history patch_path does not point to an existing patch record.",
      target: patchPath
    };
  }

  if (event.patch_path !== toPosix(path.relative(dataRoot, patchPath))) {
    return {
      code: "PATCH_PATH_MISMATCH",
      message: "Global event patch_path does not match the object history patch record.",
      target: patchPath
    };
  }

  if (event.object_history_path !== toPosix(path.relative(dataRoot, historyFilePath))) {
    return {
      code: "OBJECT_HISTORY_PATH_MISMATCH",
      message: "Global event object_history_path does not match the projected history file.",
      target: historyFilePath
    };
  }

  return null;
}

function validateEventByteOffset(
  eventFilePath: string,
  history: ObjectHistoryLink
): { code: string; message: string; target: string } | null {
  if (!Number.isInteger(history.byte_offset) || history.byte_offset < 0) {
    return {
      code: "EVENT_BYTE_OFFSET_INVALID",
      message: "Object history byte_offset must be a non-negative integer.",
      target: eventFilePath
    };
  }

  const eventLine = readGlobalEventAtByteOffset(eventFilePath, history.byte_offset);
  if (!eventLine.ok) {
    return {
      code: "EVENT_BYTE_OFFSET_INVALID",
      message: eventLine.error,
      target: eventFilePath
    };
  }

  if (eventLine.event_id !== history.event_id) {
    return {
      code: "EVENT_BYTE_OFFSET_INVALID",
      message: "Object history byte_offset does not point to the referenced global event.",
      target: eventFilePath
    };
  }

  return null;
}

function readGlobalEventAtByteOffset(
  filePath: string,
  byteOffset: number
): { ok: true; event_id: string } | { ok: false; error: string } {
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: "Object history event_ref points to a missing global event file." };
  }

  const buffer = fs.readFileSync(filePath);
  if (byteOffset >= buffer.length) {
    return { ok: false, error: "Object history byte_offset is outside the global event file." };
  }

  const nextLineBreak = buffer.indexOf(0x0a, byteOffset);
  const lineEnd = nextLineBreak === -1 ? buffer.length : nextLineBreak;
  const line = buffer.subarray(byteOffset, lineEnd).toString("utf8").trim();
  if (!line) {
    return { ok: false, error: "Object history byte_offset points to an empty global event line." };
  }

  try {
    const parsed = JSON.parse(line) as unknown;
    if (!isRecord(parsed) || typeof parsed.event_id !== "string") {
      return { ok: false, error: "Object history byte_offset points to a malformed global event line." };
    }
    return { ok: true, event_id: parsed.event_id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function objectKindFromHistoryFile(historyRoot: string, historyFilePath: string): ObjectKind | null {
  const relativePath = toPosix(path.relative(historyRoot, historyFilePath));
  if (relativePath.startsWith("nodes/")) {
    return "node";
  }
  if (relativePath.startsWith("edges/")) {
    return "edge";
  }
  return null;
}

function parseObjectHistoryHead(
  value: unknown
):
  | {
      ok: true;
      value: {
        object_kind: ObjectKind;
        object_id: string;
        current_rev: number;
        latest_event_id: string;
        latest_hash: string;
      };
    }
  | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "Object history head must be an object." };
  }

  if (value.object_kind !== "node" && value.object_kind !== "edge") {
    return { ok: false, error: "Object history head object_kind must be node or edge." };
  }
  if (typeof value.object_id !== "string" || value.object_id.length === 0) {
    return { ok: false, error: "Object history head object_id must be a non-empty string." };
  }
  if (typeof value.current_rev !== "number" || !Number.isInteger(value.current_rev) || value.current_rev < 1) {
    return { ok: false, error: "Object history head current_rev must be a positive integer." };
  }
  if (typeof value.latest_event_id !== "string" || value.latest_event_id.length === 0) {
    return { ok: false, error: "Object history head latest_event_id must be a non-empty string." };
  }
  if (typeof value.latest_hash !== "string" || value.latest_hash.length === 0) {
    return { ok: false, error: "Object history head latest_hash must be a non-empty string." };
  }

  return {
    ok: true,
    value: {
      object_kind: value.object_kind,
      object_id: value.object_id,
      current_rev: value.current_rev,
      latest_event_id: value.latest_event_id,
      latest_hash: value.latest_hash
    }
  };
}

function findGlobalEventPath(dataRoot: string, occurredAt: string): string {
  const [year, month, day] = occurredAt.slice(0, 10).split("-");
  return path.join(dataRoot, "events", year, month, `${day}.jsonl`);
}

function eventRefFromHistory(eventRef: string): string {
  return eventRef;
}

function toPosix(candidate: string): string {
  return candidate.replaceAll("\\", "/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
