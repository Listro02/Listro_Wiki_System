import fs from "node:fs";

import type { RuntimeConfig } from "../config/runtime-config.ts";
import type { LwsIssue } from "../../shared/api.ts";
import type { ObjectKind } from "../../shared/object-model.ts";
import type { IndexStore } from "../indexing/index-store.ts";
import type { ObjectStore } from "../storage/object-store.ts";
import { getMutationConsistencyIssues } from "../storage/storage-doctor.ts";
import type { ValidationService } from "../validation/validation-service.ts";
import type { JobRunContext } from "../../services/job-service.ts";

export type StorageValidationIssueRecord = {
  file_path: string;
  object_id: string | null;
  object_kind: ObjectKind | null;
  issues: LwsIssue[];
};

export type StorageValidationResult = {
  scanned_count: number;
  valid_count: number;
  invalid_count: number;
  issue_count: number;
  projection_status: "updated" | "missing";
  index_state: string | null;
  public_boundary_violation_count: number;
  mutation_consistency_issues: LwsIssue[];
  issues: StorageValidationIssueRecord[];
};

export class StorageValidationJob {
  private readonly objectStore: ObjectStore;
  private readonly validationService: ValidationService;
  private readonly indexStore?: IndexStore;
  private readonly config?: RuntimeConfig;

  constructor(objectStore: ObjectStore, validationService: ValidationService, indexStore?: IndexStore, config?: RuntimeConfig) {
    this.objectStore = objectStore;
    this.validationService = validationService;
    this.indexStore = indexStore;
    this.config = config;
  }

  run(job?: Pick<JobRunContext<StorageValidationResult>, "updateProgress" | "checkCanceled">): StorageValidationResult {
    const issueRecords: StorageValidationIssueRecord[] = [];
    let scannedCount = 0;
    let validCount = 0;
    const files = [
      ...this.objectStore.listSourceFiles("node").map((filePath) => ({ kind: "node" as const, filePath })),
      ...this.objectStore.listSourceFiles("edge").map((filePath) => ({ kind: "edge" as const, filePath }))
    ];

    job?.updateProgress({
      phase: "scan",
      current: 0,
      total: files.length,
      scanned_count: 0,
      warning_count: 0,
      message: "Scanning source objects"
    });

    for (const { filePath } of files) {
      job?.checkCanceled();
      scannedCount += 1;
      const report = this.validateFile(filePath);
      if (report.issues.length === 0) {
        validCount += 1;
      } else {
        issueRecords.push(report);
      }
      job?.updateProgress({
        phase: "scan",
        current: scannedCount,
        total: files.length,
        scanned_count: scannedCount,
        warning_count: issueRecords.reduce((count, record) => count + record.issues.length, 0),
        message: `Validated ${scannedCount}/${files.length} source objects`
      });
    }

    const flatIssues = issueRecords.flatMap((record) =>
      record.issues.map((issue) => ({
        object_id: record.object_id,
        object_kind: record.object_kind,
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        target: issue.target
      }))
    );
    const mutationConsistencyIssues = this.config ? getMutationConsistencyIssues(this.config) : [];
    if (this.config) {
      flatIssues.push(
        ...mutationConsistencyIssues.map((issue) => ({
          object_id: null,
          object_kind: null,
          code: issue.code,
          severity: issue.severity,
          message: issue.message,
          target: issue.target
        }))
      );
    }
    const publicBoundaryViolationCount = flatIssues.filter((issue) => issue.code === "PUBLIC_BOUNDARY_VIOLATION").length;
    const indexState = this.indexStore?.getStatus().state ?? null;
    const projectionStatus = this.indexStore?.replaceValidationIssues(flatIssues) ?? "missing";
    job?.updateProgress({
      phase: "projection",
      current: scannedCount,
      total: files.length,
      scanned_count: scannedCount,
      warning_count: flatIssues.length,
      message: "Validation projection updated"
    });

    return {
      scanned_count: scannedCount,
      valid_count: validCount,
      invalid_count: issueRecords.length,
      issue_count: flatIssues.length,
      projection_status: projectionStatus,
      index_state: indexState,
      public_boundary_violation_count: publicBoundaryViolationCount,
      mutation_consistency_issues: mutationConsistencyIssues,
      issues: issueRecords
    };
  }

  private validateFile(filePath: string): StorageValidationIssueRecord {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
      const report = this.validationService.validateUnknownObject(parsed);
      return {
        file_path: filePath,
        object_id: report.object_id,
        object_kind: report.object_kind,
        issues: report.issues
      };
    } catch (error) {
      return {
        file_path: filePath,
        object_id: null,
        object_kind: null,
        issues: [
          {
            code: "SCHEMA_INVALID",
            severity: "error",
            message: error instanceof Error ? error.message : String(error),
            target: "$"
          }
        ]
      };
    }
  }
}
