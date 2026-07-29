import fs from "node:fs";

import type { LwsIssue } from "../../shared/api.ts";
import type { ValidationService } from "../validation/validation-service.ts";
import type { ObjectStore } from "../storage/object-store.ts";

export type PublicBoundaryViolation = {
  file_path: string;
  edge_id: string | null;
  issues: LwsIssue[];
};

export type PublicBoundaryCheckResult = {
  scanned_edge_count: number;
  violation_count: number;
  ok: boolean;
  violations: PublicBoundaryViolation[];
};

export class PublicBoundaryChecker {
  private readonly objectStore: ObjectStore;
  private readonly validationService: ValidationService;

  constructor(objectStore: ObjectStore, validationService: ValidationService) {
    this.objectStore = objectStore;
    this.validationService = validationService;
  }

  run(): PublicBoundaryCheckResult {
    const violations: PublicBoundaryViolation[] = [];
    let scannedEdgeCount = 0;

    for (const filePath of this.objectStore.listSourceFiles("edge")) {
      scannedEdgeCount += 1;
      const violation = this.checkEdgeFile(filePath);
      if (violation) {
        violations.push(violation);
      }
    }

    return {
      scanned_edge_count: scannedEdgeCount,
      violation_count: violations.length,
      ok: violations.length === 0,
      violations
    };
  }

  private checkEdgeFile(filePath: string): PublicBoundaryViolation | null {
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
      const report = this.validationService.validateUnknownObject(raw);
      const issues = report.issues.filter((issue) => issue.code === "PUBLIC_BOUNDARY_VIOLATION");
      if (issues.length === 0) {
        return null;
      }

      return {
        file_path: filePath,
        edge_id: report.object_id,
        issues
      };
    } catch {
      return null;
    }
  }
}
