import { LwsError } from "../../shared/errors.ts";
import type { LwsIssue } from "../../shared/api.ts";
import type { LwsObject } from "../../shared/object-model.ts";
import type { ObjectStore } from "../storage/object-store.ts";
import { assertValidObjectShape, validateObjectShape } from "./schema-validator.ts";
import { validateObjectSemantics } from "./semantic-validator.ts";

export type ObjectValidationReport = {
  object_id: string | null;
  object_kind: "node" | "edge" | null;
  ok: boolean;
  issues: LwsIssue[];
};

export class ValidationService {
  private readonly objectStore: ObjectStore;

  constructor(objectStore: ObjectStore) {
    this.objectStore = objectStore;
  }

  validateUnknownObject(value: unknown): ObjectValidationReport {
    const shape = validateObjectShape(value);
    const object = shape.object;
    const semanticIssues = object ? validateObjectSemantics(object, this.createLookup()) : [];
    const issues = [...shape.issues, ...semanticIssues];

    return {
      object_id: object?.id ?? null,
      object_kind: object?.object_kind ?? null,
      ok: issues.length === 0,
      issues
    };
  }

  assertValidForSource(value: unknown): LwsObject {
    const object = assertValidObjectShape(value);
    const semanticIssues = validateObjectSemantics(object, this.createLookup());
    if (semanticIssues.length > 0) {
      const hasBoundaryViolation = semanticIssues.some((issue) => issue.code === "PUBLIC_BOUNDARY_VIOLATION");
      throw new LwsError(
        hasBoundaryViolation ? "PUBLIC_BOUNDARY_VIOLATION" : "SEMANTIC_INVALID",
        "Object semantic validation failed.",
        semanticIssues
      );
    }

    return object;
  }

  private createLookup() {
    return {
      nodeExists: (id: string) => this.objectStore.nodeExists(id),
      readNodeOrNull: (id: string) => this.objectStore.readNodeOrNull(id)
    };
  }
}
