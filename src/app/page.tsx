"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type LwsResponse<T> = { ok: true; data: T } | { error: LwsApiError };

type LwsApiError = {
  code: string;
  message: string;
  details?: unknown;
};

type StatusResponse = {
  app: {
    name: string;
    env: string;
  };
  request: {
    request_id: string;
    auth_source: string;
  };
  storage: {
    ok: boolean;
    issues: Array<{
      code: string;
      severity: string;
      message: string;
      target?: string;
    }>;
  };
  public_config: {
    publicGraphEnabled: boolean;
    defaultPageSize: number;
    maxPageSize: number;
  };
};

type SessionResponse = {
  account_id: string | null;
  is_anonymous: boolean;
  display_name: string;
  auth_source: string;
  ui_capabilities: string[];
  default_scope: string | null;
};

type ObjectRow = {
  id: string;
  object_kind: "node" | "edge";
  title: string;
  type: string;
  status: string;
  visibility: "public" | "private";
  detail_mode: string;
  summary: string | null;
  rev: number;
  updated_at: string;
  viewer_permissions?: ViewerPermissions;
};

type ObjectListResponse = {
  items: ObjectRow[];
  next_cursor: string | null;
  limit: number;
};

type ObjectReadResponse = {
  object: ObjectRow & {
    tags?: string[];
    content?: {
      body: string;
    };
    source?: string;
    target?: string;
  };
  viewer_permissions: ViewerPermissions;
};

type ViewerPermissions = {
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_restore: boolean;
  can_manage_access: boolean;
};

type ValidationReport = {
  valid?: boolean;
  issues?: Array<{
    code: string;
    severity: string;
    message: string;
    target?: string;
  }>;
};

type LoadState = {
  status: StatusResponse | null;
  session: SessionResponse | null;
  objects: ObjectListResponse | null;
  selected: ObjectReadResponse | null;
  validation: ValidationReport | null;
  error: LwsApiError | null;
  loading: boolean;
};

const filters = ["all", "node", "edge"] as const;

export default function Page() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof filters)[number]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({
    status: null,
    session: null,
    objects: null,
    selected: null,
    validation: null,
    error: null,
    loading: true
  });

  const objectParams = useMemo(() => {
    const params = new URLSearchParams({
      limit: "25",
      include_permissions: "true"
    });

    if (query.trim()) {
      params.set("q", query.trim());
    }

    if (kind !== "all") {
      params.set("kind", kind);
    }

    return params;
  }, [kind, query]);

  const loadWorkbench = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const [status, session, objects] = await Promise.all([
        fetchLws<StatusResponse>("/api/lws/status"),
        fetchLws<SessionResponse>("/api/lws/session"),
        fetchLws<ObjectListResponse>(`/api/lws/objects?${objectParams.toString()}`)
      ]);

      const nextSelectedId = selectedId ?? objects.items[0]?.id ?? null;
      const selected = nextSelectedId ? await fetchLws<ObjectReadResponse>(`/api/lws/objects/${encodeURIComponent(nextSelectedId)}`) : null;
      const validation = nextSelectedId
        ? await fetchLws<ValidationReport>(`/api/lws/objects/${encodeURIComponent(nextSelectedId)}/validation`)
        : null;

      setState({
        status,
        session,
        objects,
        selected,
        validation,
        error: null,
        loading: false
      });
      setSelectedId(nextSelectedId);
    } catch (error) {
      setState((current) => ({
        ...current,
        error: toApiError(error),
        loading: false
      }));
    }
  }, [objectParams, selectedId]);

  useEffect(() => {
    void loadWorkbench();
  }, [loadWorkbench]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSelectedId(null);
    void loadWorkbench();
  }

  function selectObject(id: string) {
    setSelectedId(id);
  }

  const selectedObject = state.selected?.object ?? null;
  const validationIssues = state.validation?.issues ?? [];

  return (
    <main className="workbench-shell">
      <section className="topbar" aria-label="System summary">
        <div>
          <p className="eyebrow">L.W.S.</p>
          <h1>Backend Workbench</h1>
        </div>
        <div className="status-strip">
          <Metric label="Storage" value={state.status?.storage.ok ? "Ready" : state.status ? "Needs attention" : "..."} tone={state.status?.storage.ok ? "good" : "warn"} />
          <Metric label="Auth" value={state.session?.auth_source ?? "..."} />
          <Metric label="Viewer" value={state.session?.display_name ?? "..."} />
          <button className="icon-button" type="button" onClick={() => void loadWorkbench()} aria-label="Refresh workbench" title="Refresh">
            <span aria-hidden="true">R</span>
          </button>
        </div>
      </section>

      {state.error ? <ErrorBanner error={state.error} /> : null}

      <section className="workbench-grid">
        <aside className="object-browser" aria-label="Object browser">
          <form className="toolbar" onSubmit={submitSearch}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search public objects" aria-label="Search objects" />
            <button type="submit">Search</button>
          </form>

          <div className="segmented" role="group" aria-label="Object kind filter">
            {filters.map((filter) => (
              <button key={filter} className={kind === filter ? "active" : ""} type="button" onClick={() => setKind(filter)}>
                {filter}
              </button>
            ))}
          </div>

          <div className="object-list">
            {state.loading && !state.objects ? <p className="muted">Loading objects...</p> : null}
            {state.objects?.items.length === 0 ? <p className="muted">No visible objects.</p> : null}
            {state.objects?.items.map((item) => (
              <button key={item.id} className={`object-row ${selectedId === item.id ? "selected" : ""}`} type="button" onClick={() => selectObject(item.id)}>
                <span className="row-title">{item.title}</span>
                <span className="row-meta">
                  {item.object_kind} / {item.type} / rev {item.rev}
                </span>
                <span className={`visibility ${item.visibility}`}>{item.visibility}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="detail-pane" aria-label="Object detail">
          {selectedObject ? (
            <>
              <div className="detail-heading">
                <div>
                  <p className="eyebrow">{selectedObject.object_kind}</p>
                  <h2>{selectedObject.title}</h2>
                </div>
                <span className={`visibility ${selectedObject.visibility}`}>{selectedObject.visibility}</span>
              </div>

              <div className="detail-grid">
                <Field label="ID" value={selectedObject.id} />
                <Field label="Type" value={selectedObject.type} />
                <Field label="Status" value={selectedObject.status} />
                <Field label="Updated" value={formatDate(selectedObject.updated_at)} />
              </div>

              {selectedObject.summary ? <p className="summary">{selectedObject.summary}</p> : null}

              {selectedObject.object_kind === "edge" ? (
                <div className="edge-line">
                  <span>{selectedObject.source}</span>
                  <strong>{selectedObject.type}</strong>
                  <span>{selectedObject.target}</span>
                </div>
              ) : null}

              <section className="subsection">
                <h3>Viewer Permissions</h3>
                <div className="permission-row">
                  {Object.entries(state.selected?.viewer_permissions ?? {}).map(([key, value]) => (
                    <span key={key} className={value ? "permission on" : "permission"}>
                      {key.replace("can_", "")}
                    </span>
                  ))}
                </div>
              </section>

              <section className="subsection">
                <h3>Validation</h3>
                {validationIssues.length ? (
                  <div className="issue-list">
                    {validationIssues.map((issue, index) => (
                      <div className="issue" key={`${issue.code}-${index}`}>
                        <strong>{issue.code}</strong>
                        <span>{issue.message}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No validation issues returned.</p>
                )}
              </section>

              {selectedObject.content?.body ? (
                <section className="subsection">
                  <h3>Content</h3>
                  <pre className="content-preview">{selectedObject.content.body}</pre>
                </section>
              ) : null}
            </>
          ) : (
            <div className="empty-state">
              <h2>No object selected</h2>
              <p>Run a reindex job after configuring storage if this list is empty.</p>
            </div>
          )}
        </section>

        <aside className="operations-panel" aria-label="Operations">
          <section className="subsection">
            <h3>Index And Storage</h3>
            <div className="issue-list">
              {state.status?.storage.issues.length ? (
                state.status.storage.issues.map((issue, index) => (
                  <div className="issue" key={`${issue.code}-${index}`}>
                    <strong>{issue.severity}</strong>
                    <span>{issue.message}</span>
                  </div>
                ))
              ) : (
                <p className="muted">No storage issues reported.</p>
              )}
            </div>
          </section>

          <section className="subsection">
            <h3>Capabilities</h3>
            <div className="permission-row">
              {state.session?.ui_capabilities.length ? (
                state.session.ui_capabilities.map((capability) => (
                  <span className="permission on" key={capability}>
                    {capability}
                  </span>
                ))
              ) : (
                <span className="permission">read-only</span>
              )}
            </div>
          </section>

          <section className="subsection">
            <h3>API Boundary</h3>
            <p className="muted">This workbench reads only `/api/lws/*` routes and keeps filesystem storage behind the backend service layer.</p>
          </section>
        </aside>
      </section>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div className={`metric ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ErrorBanner({ error }: { error: LwsApiError }) {
  return (
    <section className="error-banner" role="alert">
      <strong>{error.code}</strong>
      <span>{error.message}</span>
    </section>
  );
}

async function fetchLws<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: {
      accept: "application/json"
    },
    cache: "no-store"
  });
  const body = (await response.json()) as LwsResponse<T>;

  if ("error" in body) {
    throw body.error;
  }

  return body.data;
}

function toApiError(error: unknown): LwsApiError {
  if (isApiError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      code: "CLIENT_ERROR",
      message: error.message
    };
  }

  return {
    code: "CLIENT_ERROR",
    message: "Unexpected client error."
  };
}

function isApiError(error: unknown): error is LwsApiError {
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
