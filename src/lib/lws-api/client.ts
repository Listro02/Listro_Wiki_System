import type {
  AdminJobResponse,
  GraphResponse,
  GlobalMutationEvent,
  JsonPatchOperation,
  LwsApiError,
  LwsAuthContext,
  LwsEdge,
  LwsNode,
  MutationResult,
  ObjectKind,
  ObjectHistoryResponse,
  ObjectListResponse,
  ObjectReadResponse,
  OntologyResponse,
  PatchRecord,
  SessionResponse,
  StatusResponse,
  TimelineResponse,
  ValidationReport,
  Visibility
} from "./types";

type LwsOkResponse<T> = { ok: true; data: T };
type LwsErrorResponse = { error: { code: string; message: string; details?: unknown } };
type LwsResponse<T> = LwsOkResponse<T> | LwsErrorResponse;

type Fetcher = typeof fetch;
const defaultFetcher: Fetcher = (input, init) => fetch(input, init);

export type ObjectListParams = {
  q?: string;
  kind?: ObjectKind;
  type?: string;
  tag?: string;
  status?: string;
  visibility?: Visibility;
  limit?: number;
  cursor?: string;
  include_permissions?: boolean;
};

export type LwsClient = ReturnType<typeof createLwsClient>;

export function createLwsClient(auth: LwsAuthContext, fetcher: Fetcher = defaultFetcher) {
  return {
    getStatus: () => request<StatusResponse>("/api/lws/status", { auth, fetcher }),
    getSession: () => request<SessionResponse>("/api/lws/session", { auth, fetcher }),
    listObjects: (params: ObjectListParams = {}) => request<ObjectListResponse>(withQuery("/api/lws/objects", params), { auth, fetcher }),
    searchObjects: (params: ObjectListParams = {}) => request<ObjectListResponse>(withQuery("/api/lws/search", params), { auth, fetcher }),
    getObject: (id: string) => request<ObjectReadResponse>(`/api/lws/objects/${encodeURIComponent(id)}`, { auth, fetcher }),
    validateObject: (id: string) => request<ValidationReport>(`/api/lws/objects/${encodeURIComponent(id)}/validation`, { auth, fetcher }),
    listObjectHistory: (id: string) => request<ObjectHistoryResponse>(`/api/lws/objects/${encodeURIComponent(id)}/history`, { auth, fetcher }),
    getHistoryEvent: (id: string, eventId: string) =>
      request<GlobalMutationEvent>(`/api/lws/objects/${encodeURIComponent(id)}/history/${encodeURIComponent(eventId)}`, { auth, fetcher }),
    getHistoryDiff: (id: string, eventId: string) =>
      request<PatchRecord>(`/api/lws/objects/${encodeURIComponent(id)}/history/${encodeURIComponent(eventId)}/diff`, { auth, fetcher }),
    getGraph: (center?: string) => request<GraphResponse>(withQuery("/api/lws/graph", { center, depth: center ? 1 : undefined }), { auth, fetcher }),
    getTimeline: () => request<TimelineResponse>("/api/lws/timeline", { auth, fetcher }),
    getOntology: () => request<OntologyResponse>("/api/lws/ontology", { auth, fetcher }),
    createNode: (object: LwsNode, summary?: string, target_scope?: string) =>
      request<MutationResult<LwsNode>>("/api/lws/nodes", {
        auth,
        fetcher,
        init: mutationInit({ object, summary, target_scope })
      }),
    createEdge: (object: LwsEdge, summary?: string, target_scope?: string) =>
      request<MutationResult<LwsEdge>>("/api/lws/edges", {
        auth,
        fetcher,
        init: mutationInit({ object, summary, target_scope })
      }),
    patchNode: (id: string, base_rev: number, patch: JsonPatchOperation[], summary?: string) =>
      request<MutationResult<LwsNode>>(`/api/lws/nodes/${encodeURIComponent(id)}`, {
        auth,
        fetcher,
        init: mutationInit({ base_rev, patch, summary }, "PATCH")
      }),
    patchEdge: (id: string, base_rev: number, patch: JsonPatchOperation[], summary?: string) =>
      request<MutationResult<LwsEdge>>(`/api/lws/edges/${encodeURIComponent(id)}`, {
        auth,
        fetcher,
        init: mutationInit({ base_rev, patch, summary }, "PATCH")
      }),
    runValidationJob: () =>
      request<AdminJobResponse>("/api/lws/admin/validate", {
        auth,
        fetcher,
        init: mutationInit({})
      }),
    runReindexJob: () =>
      request<AdminJobResponse>("/api/lws/admin/reindex", {
        auth,
        fetcher,
        init: mutationInit({})
      })
  };
}

export function buildLwsHeaders(auth: LwsAuthContext, baseHeaders: HeadersInit = {}): Headers {
  const headers = new Headers(baseHeaders);
  headers.set("accept", "application/json");

  if (shouldAttachLocalAdmin(auth)) {
    headers.set("x-lws-auth-source", "local-script");
    headers.set("x-lws-local-admin-secret", auth.localAdminSecret);
  }

  return headers;
}

export function shouldAttachLocalAdmin(auth: LwsAuthContext): boolean {
  return auth.adminMode && auth.env !== "production" && auth.localAdminSecret.trim().length > 0;
}

export function toApiError(error: unknown): LwsApiError {
  if (isApiError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      code: "CLIENT_ERROR",
      message: error.message,
      status: 0
    };
  }

  return {
    code: "CLIENT_ERROR",
    message: "Unexpected client error.",
    status: 0
  };
}

async function request<T>(
  path: string,
  options: {
    auth: LwsAuthContext;
    fetcher: Fetcher;
    init?: RequestInit;
  }
): Promise<T> {
  const response = await options.fetcher(path, {
    ...options.init,
    headers: buildLwsHeaders(options.auth, options.init?.headers),
    cache: "no-store"
  });
  const body = (await response.json()) as LwsResponse<T>;

  if ("error" in body) {
    throw {
      ...body.error,
      status: response.status
    } satisfies LwsApiError;
  }

  return body.data;
}

function mutationInit(body: unknown, method = "POST"): RequestInit {
  return {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function withQuery(path: string, params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }

  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

function isApiError(error: unknown): error is LwsApiError {
  return typeof error === "object" && error !== null && "code" in error && "message" in error && "status" in error;
}
