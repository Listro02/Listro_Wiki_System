import type {
  EdgeDetailMode,
  EdgeDraft,
  JsonPatchOperation,
  LwsEdge,
  LwsNode,
  LwsObject,
  NodeDetailMode,
  NodeDraft,
  ObjectStatus,
  TemporalFields,
  Visibility
} from "./types";

const MUTABLE_PATHS = [
  "/title",
  "/slug",
  "/source",
  "/target",
  "/type",
  "/detail_mode",
  "/visibility",
  "/status",
  "/summary",
  "/content",
  "/tags",
  "/props",
  "/temporal"
] as const;

const DEFAULT_TEMPORAL: TemporalFields = {
  occurred_at: null,
  valid_from: null,
  valid_to: null
};

export function createEmptyNodeDraft(defaultVisibility: Visibility = "private"): NodeDraft {
  return {
    id: "",
    title: "",
    slug: "",
    type: "type.note",
    detail_mode: "note",
    visibility: defaultVisibility,
    status: "active",
    summary: "",
    content: { format: "markdown", body: "" },
    tags: [],
    props: {},
    temporal: { ...DEFAULT_TEMPORAL }
  };
}

export function createEmptyEdgeDraft(defaultVisibility: Visibility = "private"): EdgeDraft {
  return {
    id: "",
    title: "",
    source: "",
    target: "",
    type: "rel.references",
    detail_mode: "note",
    visibility: defaultVisibility,
    status: "active",
    summary: "",
    content: { format: "markdown", body: "" },
    tags: [],
    props: {},
    temporal: { ...DEFAULT_TEMPORAL }
  };
}

export function nodeToDraft(node: LwsNode): NodeDraft {
  return {
    id: textOrEmpty(node.id),
    title: textOrEmpty(node.title),
    slug: textOrEmpty(node.slug),
    type: textOrDefault(node.type, "type.note"),
    detail_mode: valueOrDefault(node.detail_mode, "note"),
    visibility: valueOrDefault(node.visibility, "private"),
    status: valueOrDefault(node.status, "active"),
    summary: node.summary ?? "",
    content: normalizeDraftContent(node.content),
    tags: normalizeTags(Array.isArray(node.tags) ? node.tags : []),
    props: cloneRecord(node.props),
    temporal: normalizeDraftTemporal(node.temporal)
  };
}

export function edgeToDraft(edge: LwsEdge): EdgeDraft {
  return {
    id: textOrEmpty(edge.id),
    title: textOrEmpty(edge.title),
    source: textOrEmpty(edge.source),
    target: textOrEmpty(edge.target),
    type: textOrDefault(edge.type, "rel.references"),
    detail_mode: valueOrDefault(edge.detail_mode, "note"),
    visibility: valueOrDefault(edge.visibility, "private"),
    status: valueOrDefault(edge.status, "active"),
    summary: edge.summary ?? "",
    content: normalizeDraftContent(edge.content),
    tags: normalizeTags(Array.isArray(edge.tags) ? edge.tags : []),
    props: cloneRecord(edge.props),
    temporal: normalizeDraftTemporal(edge.temporal)
  };
}

export function draftToNode(draft: NodeDraft): LwsNode {
  const now = new Date().toISOString();
  return stripEmptyOptional({
    schema_version: 1,
    object_kind: "node",
    id: draft.id.trim(),
    rev: 1,
    title: draft.title.trim(),
    slug: draft.slug.trim(),
    type: draft.type.trim(),
    detail_mode: draft.detail_mode,
    visibility: draft.visibility,
    status: draft.status,
    summary: draft.summary?.trim() ?? "",
    content: normalizeContent(draft.content?.body),
    tags: normalizeTags(draft.tags),
    props: cloneRecord(draft.props),
    temporal: normalizeTemporal(draft.temporal),
    audit: {
      created_at: now,
      updated_at: now,
      created_by: "client.draft",
      updated_by: "client.draft"
    }
  }) as LwsNode;
}

export function draftToEdge(draft: EdgeDraft): LwsEdge {
  const now = new Date().toISOString();
  return stripEmptyOptional({
    schema_version: 1,
    object_kind: "edge",
    id: draft.id.trim(),
    rev: 1,
    title: draft.title.trim(),
    source: draft.source.trim(),
    target: draft.target.trim(),
    type: draft.type.trim(),
    detail_mode: draft.detail_mode,
    visibility: draft.visibility,
    status: draft.status,
    summary: draft.summary?.trim() ?? "",
    content: normalizeContent(draft.content?.body),
    tags: normalizeTags(draft.tags),
    props: cloneRecord(draft.props),
    temporal: normalizeTemporal(draft.temporal),
    audit: {
      created_at: now,
      updated_at: now,
      created_by: "client.draft",
      updated_by: "client.draft"
    }
  }) as LwsEdge;
}

export function draftToComparableObject(object: LwsObject, draft: NodeDraft | EdgeDraft): LwsObject {
  if (object.object_kind === "node") {
    return {
      ...object,
      ...stripEmptyOptional({
        title: draft.title.trim(),
        slug: (draft as NodeDraft).slug.trim(),
        type: draft.type.trim(),
        detail_mode: draft.detail_mode as NodeDetailMode,
        visibility: draft.visibility,
        status: draft.status,
        summary: draft.summary?.trim() ?? "",
        content: normalizeContent(draft.content?.body),
        tags: normalizeTags(draft.tags),
        props: cloneRecord(draft.props),
        temporal: normalizeTemporal(draft.temporal)
      })
    };
  }

  return {
    ...object,
    ...stripEmptyOptional({
      title: draft.title.trim(),
      source: (draft as EdgeDraft).source.trim(),
      target: (draft as EdgeDraft).target.trim(),
      type: draft.type.trim(),
      detail_mode: draft.detail_mode as EdgeDetailMode,
      visibility: draft.visibility,
      status: draft.status,
      summary: draft.summary?.trim() ?? "",
      content: normalizeContent(draft.content?.body),
      tags: normalizeTags(draft.tags),
      props: cloneRecord(draft.props),
      temporal: normalizeTemporal(draft.temporal)
    })
  };
}

export function createPatchFromObjects(before: LwsObject, after: LwsObject): JsonPatchOperation[] {
  const patch: JsonPatchOperation[] = [];

  for (const path of MUTABLE_PATHS) {
    const beforeValue = valueAtPath(before, path);
    const afterValue = valueAtPath(after, path);

    if (stableJson(beforeValue) === stableJson(afterValue)) {
      continue;
    }

    if (afterValue === undefined) {
      patch.push({ op: "remove", path });
    } else if (beforeValue === undefined) {
      patch.push({ op: "add", path, value: afterValue });
    } else {
      patch.push({ op: "replace", path, value: afterValue });
    }
  }

  return patch;
}

export function normalizeTags(value: string[] | string): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => tag.trim()).filter(Boolean);
  }

  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function tagsToText(value: string[]): string {
  return value.join(", ");
}

export function parseProps(text: string): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  if (text.trim().length === 0) {
    return { ok: true, value: {} };
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (isRecord(parsed) && !Array.isArray(parsed)) {
      return { ok: true, value: parsed };
    }
    return { ok: false, message: "props must be a JSON object." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "props must be valid JSON."
    };
  }
}

export function propsToText(props: Record<string, unknown>): string {
  return JSON.stringify(props, null, 2);
}

function normalizeContent(body: string | undefined) {
  const trimmed = body?.trimEnd() ?? "";
  return trimmed.length > 0 ? { format: "markdown" as const, body: trimmed } : undefined;
}

function normalizeDraftContent(content: LwsNode["content"] | LwsEdge["content"]) {
  return {
    format: "markdown" as const,
    body: textOrEmpty(content?.body)
  };
}

function normalizeDraftTemporal(value: TemporalFields | undefined): TemporalFields {
  return {
    occurred_at: value?.occurred_at ?? null,
    valid_from: value?.valid_from ?? null,
    valid_to: value?.valid_to ?? null
  };
}

function normalizeTemporal(value: TemporalFields): TemporalFields {
  return {
    occurred_at: nullIfBlank(value.occurred_at),
    valid_from: nullIfBlank(value.valid_from),
    valid_to: nullIfBlank(value.valid_to)
  };
}

function nullIfBlank(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function textOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function textOrDefault(value: unknown, fallback: string): string {
  const text = textOrEmpty(value);
  return text.length > 0 ? text : fallback;
}

function valueOrDefault<T>(value: T | undefined, fallback: T): T {
  return value ?? fallback;
}

function stripEmptyOptional<T extends Record<string, unknown>>(object: T): Partial<T> {
  const next = { ...object };

  if (next.summary === "") {
    delete next.summary;
  }

  if (next.content === undefined) {
    delete next.content;
  }

  return next;
}

function valueAtPath(object: LwsObject, path: string): unknown {
  const key = path.slice(1) as keyof LwsObject;
  return object[key];
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortForJson(value));
}

function sortForJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForJson);
  }

  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortForJson(item)]));
  }

  return value;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const NODE_DETAIL_MODES: NodeDetailMode[] = ["stub", "note", "page", "view", "system"];
export const EDGE_DETAIL_MODES: EdgeDetailMode[] = ["stub", "note", "page"];
export const VISIBILITIES: Visibility[] = ["private", "public"];
export const OBJECT_STATUSES: ObjectStatus[] = ["active", "draft", "stub", "archived", "deleted"];
export const COMMON_NODE_TYPES = ["type.note", "type.page", "type.concept", "type.project", "type.service", "type.document"];
export const COMMON_RELATION_TYPES = ["rel.references", "rel.contains", "rel.depends_on", "rel.classifies"];
