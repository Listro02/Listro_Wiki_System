import { LwsError } from "../../shared/errors.ts";
import { canonicalJson } from "../hashing/canonical-json.ts";

export type JsonPatchOperation =
  | { op: "add"; path: string; value: unknown }
  | { op: "replace"; path: string; value: unknown }
  | { op: "remove"; path: string }
  | { op: "test"; path: string; value: unknown };

export type PatchApplication = {
  document: unknown;
  inversePatch: JsonPatchOperation[];
  changedFields: string[];
};

const PROTECTED_PATHS = new Set([
  "/schema_version",
  "/object_kind",
  "/id",
  "/rev",
  "/audit",
  "/audit/created_at",
  "/audit/created_by",
  "/audit/updated_at",
  "/audit/updated_by"
]);

export function applyPatch(document: unknown, patch: JsonPatchOperation[]): PatchApplication {
  if (!Array.isArray(patch)) {
    throw new LwsError("PATCH_INVALID", "patch must be an array.");
  }

  const draft = cloneJson(document);
  const inverse: JsonPatchOperation[] = [];
  const changedFields: string[] = [];

  for (const operation of patch) {
    assertAllowedOperation(operation);
    if (operation.op !== "test") {
      assertMutablePath(operation.path);
      changedFields.push(pointerToChangedField(operation.path));
    }

    const inverseOperation = applyOperation(draft, operation);
    if (inverseOperation) {
      inverse.unshift(inverseOperation);
    }
  }

  return {
    document: draft,
    inversePatch: inverse,
    changedFields: Array.from(new Set(changedFields))
  };
}

function applyOperation(document: unknown, operation: JsonPatchOperation): JsonPatchOperation | null {
  const pointer = parsePointer(operation.path);
  const target = resolveParent(document, pointer);
  const key = pointer[pointer.length - 1];

  if (operation.op === "test") {
    const current = readValue(target.parent, key);
    if (canonicalJson(current) !== canonicalJson(operation.value)) {
      throw new LwsError("PATCH_INVALID", "JSON Patch test operation failed.", { path: operation.path });
    }
    return null;
  }

  if (operation.op === "remove") {
    const oldValue = readValue(target.parent, key);
    removeValue(target.parent, key);
    return { op: "add", path: operation.path, value: oldValue };
  }

  if (operation.op === "replace") {
    const oldValue = readValue(target.parent, key);
    writeValue(target.parent, key, operation.value, true);
    return { op: "replace", path: operation.path, value: oldValue };
  }

  const existed = hasValue(target.parent, key);
  const oldValue = existed ? readValue(target.parent, key) : undefined;
  writeValue(target.parent, key, operation.value, false);
  return existed ? { op: "replace", path: operation.path, value: oldValue } : { op: "remove", path: operation.path };
}

function assertAllowedOperation(operation: JsonPatchOperation): void {
  const op = (operation as { op?: unknown }).op;
  if (!operation || typeof op !== "string" || !["add", "replace", "remove", "test"].includes(op)) {
    throw new LwsError("PATCH_INVALID", "Unsupported patch operation.");
  }

  if (typeof operation.path !== "string" || !operation.path.startsWith("/")) {
    throw new LwsError("PATCH_INVALID", "Patch operation path must be a JSON pointer.");
  }

  if ((op === "add" || op === "replace" || op === "test") && !("value" in operation)) {
    throw new LwsError("PATCH_INVALID", "Patch operation requires a value.", { op });
  }
}

function assertMutablePath(pointer: string): void {
  if (PROTECTED_PATHS.has(pointer) || pointer.startsWith("/audit/")) {
    throw new LwsError("PATCH_INVALID", "Patch operation attempted to modify backend-managed fields.", {
      path: pointer
    });
  }
}

function parsePointer(pointer: string): string[] {
  if (pointer === "") {
    throw new LwsError("PATCH_INVALID", "Root-level patch operations are not accepted for client mutation.");
  }

  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function resolveParent(document: unknown, pointer: string[]): { parent: unknown; key: string } {
  if (pointer.length === 0) {
    throw new LwsError("PATCH_INVALID", "Patch path must not be empty.");
  }

  let parent = document;
  for (const segment of pointer.slice(0, -1)) {
    parent = readValue(parent, segment);
  }

  return {
    parent,
    key: pointer[pointer.length - 1]
  };
}

function readValue(parent: unknown, key: string): unknown {
  if (Array.isArray(parent)) {
    const index = parseArrayIndex(key, parent.length - 1);
    if (!(index in parent)) {
      throw new LwsError("PATCH_INVALID", "Patch path does not exist.", { key });
    }
    return parent[index];
  }

  if (isRecord(parent) && key in parent) {
    return parent[key];
  }

  throw new LwsError("PATCH_INVALID", "Patch path does not exist.", { key });
}

function writeValue(parent: unknown, key: string, value: unknown, mustExist: boolean): void {
  if (Array.isArray(parent)) {
    const index = key === "-" ? parent.length : parseArrayIndex(key, parent.length);
    if (mustExist && !(index in parent)) {
      throw new LwsError("PATCH_INVALID", "Patch path does not exist.", { key });
    }
    parent[index] = value;
    return;
  }

  if (isRecord(parent)) {
    if (mustExist && !(key in parent)) {
      throw new LwsError("PATCH_INVALID", "Patch path does not exist.", { key });
    }
    parent[key] = value;
    return;
  }

  throw new LwsError("PATCH_INVALID", "Patch parent is not writable.", { key });
}

function removeValue(parent: unknown, key: string): void {
  if (Array.isArray(parent)) {
    const index = parseArrayIndex(key, parent.length - 1);
    parent.splice(index, 1);
    return;
  }

  if (isRecord(parent) && key in parent) {
    delete parent[key];
    return;
  }

  throw new LwsError("PATCH_INVALID", "Patch path does not exist.", { key });
}

function hasValue(parent: unknown, key: string): boolean {
  if (Array.isArray(parent)) {
    const index = parseArrayIndex(key, parent.length);
    return index in parent;
  }

  return isRecord(parent) && key in parent;
}

function parseArrayIndex(key: string, max: number): number {
  const index = Number(key);
  if (!Number.isInteger(index) || index < 0 || index > max) {
    throw new LwsError("PATCH_INVALID", "Array patch path has invalid index.", { key });
  }
  return index;
}

function pointerToChangedField(pointer: string): string {
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
    .join(".");
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
