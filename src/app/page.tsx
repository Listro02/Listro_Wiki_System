"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, DatabaseZap, FilePlus2, GitBranch, GitCommitHorizontal, History as HistoryIcon, MoreHorizontal, Network, RefreshCw, Save, Search, Shield, SquarePen } from "lucide-react";

import { RelationshipFlow } from "../components/relationship-flow";
import { Badge, Button, Dialog, DropdownMenu, IconButton, Panel, Select, Switch, Tabs } from "../components/ui";
import { createLwsClient, toApiError, type LwsClient } from "../lib/lws-api/client";
import {
  COMMON_NODE_TYPES,
  COMMON_RELATION_TYPES,
  EDGE_DETAIL_MODES,
  NODE_DETAIL_MODES,
  OBJECT_STATUSES,
  VISIBILITIES,
  createEmptyEdgeDraft,
  createEmptyNodeDraft,
  createPatchFromObjects,
  draftToComparableObject,
  draftToEdge,
  draftToNode,
  edgeToDraft,
  nodeToDraft,
  parseProps,
  propsToText,
  tagsToText
} from "../lib/lws-api/drafts";
import type {
  AdminJob,
  EdgeDraft,
  EditorState,
  GraphResponse,
  GlobalMutationEvent,
  JsonPatchOperation,
  LwsApiError,
  LwsEdge,
  LwsNode,
  LwsObject,
  NodeDraft,
  ObjectHistoryLink,
  ObjectKind,
  ObjectListResponse,
  ObjectReadResponse,
  ObjectRow,
  OntologyResponse,
  PatchRecord,
  SessionResponse,
  StatusResponse,
  TimelineResponse,
  ValidationReport,
  Visibility
} from "../lib/lws-api/types";

type WorkbenchState = {
  status: StatusResponse | null;
  session: SessionResponse | null;
  objects: ObjectListResponse | null;
  selected: ObjectReadResponse | null;
  validation: ValidationReport | null;
  graph: GraphResponse | null;
  timeline: TimelineResponse | null;
  ontology: OntologyResponse | null;
  error: LwsApiError | null;
  loading: boolean;
};

type AdminMode = {
  enabled: boolean;
  secret: string;
  persist: boolean;
};

const KIND_FILTERS = ["all", "node", "edge"] as const;
const STORED_ADMIN_SECRET = "lws.localAdminSecret";
const EMPTY_AUTH = { adminMode: false, localAdminSecret: "" };

export default function Page() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof KIND_FILTERS)[number]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState<AdminMode>({ enabled: false, secret: "", persist: false });
  const [createKind, setCreateKind] = useState<ObjectKind | null>(null);
  const [adminJob, setAdminJob] = useState<AdminJob | null>(null);
  const [state, setState] = useState<WorkbenchState>({
    status: null,
    session: null,
    objects: null,
    selected: null,
    validation: null,
    graph: null,
    timeline: null,
    ontology: null,
    error: null,
    loading: true
  });

  useEffect(() => {
    const stored = window.sessionStorage.getItem(STORED_ADMIN_SECRET);
    if (stored) {
      setAdminMode({ enabled: true, secret: stored, persist: true });
    }
  }, []);

  useEffect(() => {
    if (adminMode.persist && adminMode.secret) {
      window.sessionStorage.setItem(STORED_ADMIN_SECRET, adminMode.secret);
      return;
    }

    window.sessionStorage.removeItem(STORED_ADMIN_SECRET);
  }, [adminMode.persist, adminMode.secret]);

  const auth = useMemo(
    () => ({
      adminMode: adminMode.enabled,
      localAdminSecret: adminMode.secret,
      env: state.status?.app.env
    }),
    [adminMode.enabled, adminMode.secret, state.status?.app.env]
  );
  const client = useMemo(() => createLwsClient(auth), [auth]);

  const objectParams = useMemo(
    () => ({
      limit: 40,
      include_permissions: true,
      q: query.trim() || undefined,
      kind: kind === "all" ? undefined : kind
    }),
    [kind, query]
  );

  async function loadWorkbench(nextSelectedId: string | null | undefined = selectedId) {
    setState((current) => ({ ...current, loading: true, error: null }));

    let status: StatusResponse | null = null;
    let session: SessionResponse | null = null;

    try {
      [status, session] = await Promise.all([client.getStatus(), client.getSession()]);
    } catch (error) {
      setState((current) => ({
        ...current,
        error: toApiError(error),
        loading: false
      }));
      return;
    }

    try {
      const [objects, timeline, ontology] = await Promise.all([
        client.listObjects(objectParams),
        safeOptional(() => client.getTimeline()),
        safeOptional(() => client.getOntology())
      ]);
      const selectedCandidate = nextSelectedId ?? null;
      const [graph, selected, validation] = selectedCandidate
        ? await Promise.all([
            safeOptional(() => client.getGraph(selectedCandidate)),
            client.getObject(selectedCandidate),
            safeOptional(() => client.validateObject(selectedCandidate))
          ])
        : await Promise.all([safeOptional(() => client.getGraph()), Promise.resolve(null), Promise.resolve(null)]);

      setSelectedId(selectedCandidate);
      setState({
        status,
        session,
        objects,
        selected,
        validation,
        graph,
        timeline,
        ontology,
        error: null,
        loading: false
      });
    } catch (error) {
      setSelectedId(null);
      setState({
        status,
        session,
        objects: null,
        selected: null,
        validation: null,
        graph: null,
        timeline: null,
        ontology: null,
        error: toApiError(error),
        loading: false
      });
    }
  }

  useEffect(() => {
    void loadWorkbench(null);
  }, [objectParams]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSelectedId(null);
    void loadWorkbench(null);
  }

  function selectObject(id: string) {
    const nextId = selectedId === id ? null : id;
    setSelectedId(nextId);
    void loadWorkbench(nextId);
  }

  async function runAdminAction(action: "validate" | "reindex") {
    setAdminJob(null);
    setState((current) => ({ ...current, error: null }));

    try {
      const result = action === "validate" ? await client.runValidationJob() : await client.runReindexJob();
      setAdminJob(result.job);
      await loadWorkbench(selectedId);
    } catch (error) {
      setState((current) => ({ ...current, error: toApiError(error) }));
    }
  }

  const defaultVisibility = state.session?.public_config.defaultVisibility ?? state.status?.public_config.defaultVisibility ?? "private";
  const indexIssue = state.error && isIndexError(state.error) ? state.error : null;

  return (
    <main className="workbench-shell">
      <AppShellTopbar
        adminMode={adminMode}
        status={state.status}
        session={state.session}
        onAdminModeChange={setAdminMode}
        onRefresh={() => void loadWorkbench(selectedId)}
        onCreateNode={() => setCreateKind("node")}
        onCreateEdge={() => setCreateKind("edge")}
      />

      {state.error ? <ErrorBanner error={state.error} /> : null}

      <section className="workbench-grid">
        <ObjectBrowser
          kind={kind}
          loading={state.loading}
          objects={state.objects}
          query={query}
          selectedId={selectedId}
          onKindChange={setKind}
          onQueryChange={setQuery}
          onSearch={submitSearch}
          onSelect={selectObject}
          onCreateNode={() => setCreateKind("node")}
          onCreateEdge={() => setCreateKind("edge")}
        />

        <section className="detail-pane" aria-label="Object detail">
          {indexIssue ? <IndexRecoveryPrompt error={indexIssue} adminMode={adminMode} onReindex={() => void runAdminAction("reindex")} /> : null}
          <ObjectDetail
            client={client}
            defaultVisibility={defaultVisibility}
            graph={state.graph}
            objects={state.objects?.items ?? []}
            selected={state.selected}
            validation={state.validation}
            onError={(error) => setState((current) => ({ ...current, error }))}
            onSaved={(id) => void loadWorkbench(id)}
            onSelect={selectObject}
          />
        </section>

        <RightInspector
          adminJob={adminJob}
          adminMode={adminMode}
          graph={state.graph}
          ontology={state.ontology}
          selected={state.selected}
          session={state.session}
          status={state.status}
          timeline={state.timeline}
          validation={state.validation}
          onSelect={selectObject}
          onReindex={() => void runAdminAction("reindex")}
          onValidate={() => void runAdminAction("validate")}
        />
      </section>

      <CreateObjectDialog
        client={client}
        defaultVisibility={defaultVisibility}
        kind={createKind}
        objects={state.objects?.items ?? []}
        onClose={() => setCreateKind(null)}
        onCreated={(id) => {
          setCreateKind(null);
          void loadWorkbench(id);
        }}
        onError={(error) => setState((current) => ({ ...current, error }))}
      />
    </main>
  );
}

function AppShellTopbar({
  adminMode,
  status,
  session,
  onAdminModeChange,
  onRefresh,
  onCreateNode,
  onCreateEdge
}: {
  adminMode: AdminMode;
  status: StatusResponse | null;
  session: SessionResponse | null;
  onAdminModeChange: (mode: AdminMode) => void;
  onRefresh: () => void;
  onCreateNode: () => void;
  onCreateEdge: () => void;
}) {
  const adminEnabled = adminMode.enabled && status?.app.env !== "production";

  return (
    <section className="topbar" aria-label="System summary">
      <div className="brand-block">
        <div className="brand-mark">L</div>
        <div>
          <p className="eyebrow">Listro Wiki System</p>
          <h1>Frontend Workbench</h1>
        </div>
      </div>

      <div className="command-bar">
        <div className="status-strip">
          <Metric label="Storage" value={status?.storage.status === "ok" ? "Ready" : status ? "Attention" : "..."} tone={status?.storage.status === "ok" ? "good" : "warn"} />
          <Metric label="Env" value={status?.app.env ?? "..."} />
          <Metric label="Viewer" value={session?.display_name ?? "..."} />
          <Metric label="Auth" value={session?.auth_source ?? "..."} />
        </div>

        <Button variant="primary" onClick={onCreateNode}>
          <FilePlus2 size={15} /> Node
        </Button>
        <Button onClick={onCreateEdge}>
          <GitBranch size={15} /> Edge
        </Button>
        <a className="button ghost" href="/graph">
          <Network size={15} /> Graph
        </a>

        <div className="admin-mode">
          <Switch
            checked={adminMode.enabled}
            label="Admin mode"
            onCheckedChange={(enabled) => onAdminModeChange({ ...adminMode, enabled })}
          />
          <input
            className="input admin-secret"
            type="password"
            value={adminMode.secret}
            onChange={(event) => onAdminModeChange({ ...adminMode, secret: event.target.value })}
            placeholder="local secret"
            aria-label="Local admin secret"
            disabled={!adminMode.enabled}
          />
          <Switch
            checked={adminMode.persist}
            label="Keep"
            onCheckedChange={(persist) => onAdminModeChange({ ...adminMode, persist })}
          />
          <Badge tone={adminEnabled ? "good" : adminMode.enabled ? "warn" : "neutral"}>{adminEnabled ? "armed" : adminMode.enabled ? "blocked" : "off"}</Badge>
        </div>

        <IconButton label="Refresh workbench" onClick={onRefresh}>
          <RefreshCw size={16} />
        </IconButton>
      </div>
    </section>
  );
}

function ObjectBrowser({
  kind,
  loading,
  objects,
  query,
  selectedId,
  onKindChange,
  onQueryChange,
  onSearch,
  onSelect,
  onCreateNode,
  onCreateEdge
}: {
  kind: (typeof KIND_FILTERS)[number];
  loading: boolean;
  objects: ObjectListResponse | null;
  query: string;
  selectedId: string | null;
  onKindChange: (kind: (typeof KIND_FILTERS)[number]) => void;
  onQueryChange: (query: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onSelect: (id: string) => void;
  onCreateNode: () => void;
  onCreateEdge: () => void;
}) {
  return (
    <aside className="object-browser" aria-label="Object browser">
      <Panel
        title="Objects"
        actions={
          <DropdownMenu
            trigger={
              <IconButton label="Create object">
                <MoreHorizontal size={16} />
              </IconButton>
            }
            items={[
              { label: "Create node", onSelect: onCreateNode },
              { label: "Create edge", onSelect: onCreateEdge }
            ]}
          />
        }
      >
        <form className="toolbar" onSubmit={onSearch}>
          <input className="input" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search visible objects" aria-label="Search objects" />
          <Button type="submit">
            <Search size={15} /> Search
          </Button>
        </form>

        <div className="segmented" role="group" aria-label="Object kind filter">
          {KIND_FILTERS.map((filter) => (
            <button key={filter} className={kind === filter ? "active" : ""} type="button" onClick={() => onKindChange(filter)}>
              {filter}
            </button>
          ))}
        </div>

        <div className="object-list">
          {loading && !objects ? <p className="muted">Loading objects...</p> : null}
          {objects?.items.length === 0 ? <p className="muted">No visible objects.</p> : null}
          {objects?.items.map((item) => (
            <button key={item.id} className={`object-row ${selectedId === item.id ? "selected" : ""}`} type="button" onClick={() => onSelect(item.id)}>
              <span className="row-title">{item.title}</span>
              <span className="row-meta">
                {item.object_kind} / {item.type} / rev {item.rev}
              </span>
              <span className={`visibility ${item.visibility}`}>{item.visibility}</span>
            </button>
          ))}
        </div>
      </Panel>
    </aside>
  );
}

function ObjectDetail({
  client,
  defaultVisibility,
  graph,
  objects,
  selected,
  validation,
  onError,
  onSaved,
  onSelect
}: {
  client: LwsClient;
  defaultVisibility: Visibility;
  graph: GraphResponse | null;
  objects: ObjectRow[];
  selected: ObjectReadResponse | null;
  validation: ValidationReport | null;
  onError: (error: LwsApiError) => void;
  onSaved: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const [tab, setTab] = useState("overview");

  if (!selected) {
    return (
      <div className="empty-state">
        <Network size={28} />
        <h2>No object selected</h2>
        <p>Search or run a reindex job if the visible object list is empty.</p>
      </div>
    );
  }

  const object = selected.object;
  const issues = validation?.issues ?? [];

  return (
    <>
      <div className="detail-heading">
        <div>
          <p className="eyebrow">{object.object_kind}</p>
          <h2>{object.title}</h2>
        </div>
        <div className="badge-row">
          <span className={`visibility ${object.visibility}`}>{object.visibility}</span>
          <Badge tone={selected.viewer_permissions.can_update ? "good" : "neutral"}>{selected.viewer_permissions.can_update ? "editable" : "readonly"}</Badge>
        </div>
      </div>

      <div className="detail-grid">
        <Field label="ID" value={object.id} />
        <Field label="Type" value={object.type} />
        <Field label="Status" value={object.status} />
        <Field label="Updated" value={formatDate(object.audit.updated_at)} />
      </div>

      <Tabs
        value={tab}
        onValueChange={setTab}
        tabs={[
          {
            value: "overview",
            label: "Overview",
            content: <ObjectOverview object={object} selected={selected} validation={validation} />
          },
          {
            value: "edit",
            label: "Edit",
            content: (
              <ObjectEditPanel
                client={client}
                defaultVisibility={defaultVisibility}
                object={object}
                objects={objects}
                readonly={!selected.viewer_permissions.can_update}
                onError={onError}
                onSaved={onSaved}
              />
            )
          },
          {
            value: "relations",
            label: `Relations${graph?.edges.length ? ` (${graph.edges.length})` : ""}`,
            content: <ObjectRelations object={object} graph={graph} onSelect={onSelect} />
          },
          {
            value: "history",
            label: "History",
            content: <ObjectHistoryPanel active={tab === "history"} client={client} object={object} onError={onError} />
          },
          {
            value: "validation",
            label: `Validation${issues.length ? ` (${issues.length})` : ""}`,
            content: <IssueList issues={issues} empty="No validation issues returned." />
          },
          {
            value: "raw",
            label: "Raw JSON",
            content: <pre className="raw-json">{JSON.stringify(object, null, 2)}</pre>
          }
        ]}
      />
    </>
  );
}

function ObjectOverview({ object, selected, validation }: { object: LwsObject; selected: ObjectReadResponse; validation: ValidationReport | null }) {
  return (
    <div className="stack">
      {object.summary ? <p className="summary">{object.summary}</p> : <p className="muted">No summary.</p>}
      {object.object_kind === "edge" ? (
        <div className="edge-line">
          <span>{object.source}</span>
          <strong>{object.type}</strong>
          <span>{object.target}</span>
        </div>
      ) : null}
      {object.content?.body ? (
        <section className="subsection">
          <h3>Content</h3>
          <pre className="content-preview">{object.content.body}</pre>
        </section>
      ) : null}
      <section className="subsection">
        <h3>Permissions</h3>
        <div className="permission-row">
          {Object.entries(selected.viewer_permissions).map(([key, value]) => (
            <span key={key} className={value ? "permission on" : "permission"}>
              {key.replace("can_", "")}
            </span>
          ))}
        </div>
      </section>
      <section className="subsection">
        <h3>Validation</h3>
        <IssueList issues={validation?.issues ?? []} empty="No validation issues returned." />
      </section>
    </div>
  );
}

function ObjectRelations({ object, graph, onSelect }: { object: LwsObject; graph: GraphResponse | null; onSelect: (id: string) => void }) {
  const relations = getRelevantEdges(object, graph);

  if (!graph || relations.length === 0) {
    return (
      <div className="empty-relations">
        <Network size={24} />
        <h3>No related objects</h3>
        <p className="muted">No visible 1-hop relations were returned for this object.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <RelationshipFlow graph={graph} focusId={object.id} onSelect={onSelect} />
      <section className="subsection relation-detail-section">
        <h3>Relation Details</h3>
        <div className="relation-detail-list">
          {relations.map((edge) => (
            <RelationRow edge={edge} graph={graph} selectedId={object.id} onSelect={onSelect} key={edge.edge_id} />
          ))}
        </div>
      </section>
    </div>
  );
}

function RelationRow({
  edge,
  graph,
  selectedId,
  onSelect
}: {
  edge: GraphResponse["edges"][number];
  graph: GraphResponse;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const source = getGraphObject(graph, edge.source_id);
  const target = getGraphObject(graph, edge.target_id);
  const edgeObject = getGraphObject(graph, edge.edge_id);
  const selectRelatedObject = (id: string) => {
    if (id !== selectedId) {
      onSelect(id);
    }
  };

  return (
    <div className="relation-detail-row">
      <button className={selectedId === edge.source_id ? "relation-detail-node active" : "relation-detail-node"} type="button" onClick={() => selectRelatedObject(edge.source_id)}>
        <span>{source?.title ?? edge.source_id}</span>
        <small>{edge.source_id}</small>
      </button>
      <button className={selectedId === edge.edge_id ? "relation-detail-edge active" : "relation-detail-edge"} type="button" onClick={() => selectRelatedObject(edge.edge_id)}>
        <strong>{edge.relation_type}</strong>
        <span>{edgeObject?.title ?? edge.edge_id}</span>
      </button>
      <button className={selectedId === edge.target_id ? "relation-detail-node active" : "relation-detail-node"} type="button" onClick={() => selectRelatedObject(edge.target_id)}>
        <span>{target?.title ?? edge.target_id}</span>
        <small>{edge.target_id}</small>
      </button>
    </div>
  );
}

function ObjectHistoryPanel({ active, client, object, onError }: { active: boolean; client: LwsClient; object: LwsObject; onError: (error: LwsApiError) => void }) {
  const [history, setHistory] = useState<ObjectHistoryLink[] | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventDetail, setEventDetail] = useState<GlobalMutationEvent | null>(null);
  const [diff, setDiff] = useState<PatchRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setHistory(null);
    setSelectedEventId(null);
    setEventDetail(null);
    setDiff(null);
    setLocalError(null);
  }, [object.id]);

  useEffect(() => {
    if (!active || history) {
      return;
    }

    let canceled = false;
    setLoading(true);
    setLocalError(null);

    void client
      .listObjectHistory(object.id)
      .then((response) => {
        if (canceled) {
          return;
        }
        setHistory([...response.items].sort(compareHistoryDescending));
      })
      .catch((error) => {
        if (canceled) {
          return;
        }
        const apiError = toApiError(error);
        setLocalError(apiError.message);
        onError(apiError);
      })
      .finally(() => {
        if (!canceled) {
          setLoading(false);
        }
      });

    return () => {
      canceled = true;
    };
  }, [active, client, history, object.id, onError]);

  async function selectEvent(eventId: string) {
    setSelectedEventId(eventId);
    setEventDetail(null);
    setDiff(null);
    setDetailLoading(true);
    setLocalError(null);

    try {
      const [event, patchRecord] = await Promise.all([client.getHistoryEvent(object.id, eventId), client.getHistoryDiff(object.id, eventId)]);
      setEventDetail(event);
      setDiff(patchRecord);
    } catch (error) {
      const apiError = toApiError(error);
      setLocalError(apiError.message);
      onError(apiError);
    } finally {
      setDetailLoading(false);
    }
  }

  if (!active) {
    return <p className="muted">Open History to load object event records.</p>;
  }

  if (loading) {
    return <p className="muted">Loading history...</p>;
  }

  const items = history ?? [];

  if (items.length === 0) {
    return (
      <div className="empty-relations">
        <HistoryIcon size={24} />
        <h3>No history records</h3>
        <p className="muted">No event records were returned for this object.</p>
      </div>
    );
  }

  return (
    <div className="history-layout">
      <section className="history-list" aria-label="Object event history">
        {items.map((item) => (
          <button className={selectedEventId === item.event_id ? "history-card active" : "history-card"} type="button" onClick={() => void selectEvent(item.event_id)} key={item.event_id}>
            <span className="history-card-topline">
              <Badge tone={eventTone(item.event_type)}>{item.event_type}</Badge>
              <span>rev {item.base_rev} -&gt; {item.next_rev}</span>
            </span>
            <strong>{item.summary}</strong>
            <span className="history-card-meta">{formatDate(item.occurred_at)}</span>
            <span className="history-event-id">{item.event_id}</span>
          </button>
        ))}
      </section>

      <section className="history-detail" aria-label="Selected history event detail">
        {localError ? (
          <div className="issue">
            <strong>History lookup failed</strong>
            <span>{localError}</span>
          </div>
        ) : null}
        {!selectedEventId ? (
          <div className="empty-history-detail">
            <GitCommitHorizontal size={24} />
            <h3>Select an event</h3>
            <p className="muted">Event detail and patch records are loaded on demand.</p>
          </div>
        ) : null}
        {detailLoading ? <p className="muted">Loading event detail...</p> : null}
        {eventDetail && diff ? <HistoryEventDetail event={eventDetail} diff={diff} /> : null}
      </section>
    </div>
  );
}

function HistoryEventDetail({ event, diff }: { event: GlobalMutationEvent; diff: PatchRecord }) {
  return (
    <div className="stack">
      <div className="readonly-grid">
        <Field label="Event" value={event.event_id} />
        <Field label="Actor" value={event.account_id} />
        <Field label="Occurred" value={formatDate(event.occurred_at)} />
      </div>
      <div className="readonly-grid">
        <Field label="Revision" value={`${event.base_rev} -> ${event.next_rev}`} />
        <Field label="Before hash" value={shortHash(event.before_hash)} />
        <Field label="After hash" value={shortHash(event.after_hash)} />
      </div>
      <section className="subsection">
        <h3>Changed Fields</h3>
        <div className="badge-row">
          {event.changed_fields.length ? event.changed_fields.map((field) => <span className="badge info" key={field}>{field}</span>) : <span className="muted">No changed fields returned.</span>}
        </div>
      </section>
      <section className="subsection">
        <h3>Changed Values</h3>
        <PatchOperationList operations={diff.patch} inverseOperations={diff.inverse_patch} />
      </section>
      <section className="subsection">
        <h3>Inverse Patch</h3>
        <PatchOperationList operations={diff.inverse_patch} inverseOperations={diff.patch} />
      </section>
      <details className="technical-details">
        <summary>Technical JSON</summary>
        <pre className="raw-json">{JSON.stringify({ event, diff }, null, 2)}</pre>
      </details>
    </div>
  );
}

function PatchOperationList({ operations, inverseOperations = [] }: { operations: JsonPatchOperation[]; inverseOperations?: JsonPatchOperation[] }) {
  if (operations.length === 0) {
    return <p className="muted">No patch operations returned.</p>;
  }

  return (
    <div className="patch-operation-list">
      {operations.map((operation, index) => {
        const inverse = inverseOperations.find((candidate) => candidate.path === operation.path);
        const before = patchBeforeValue(operation, inverse);
        const after = patchAfterValue(operation);
        return (
          <div className="patch-operation" key={`${operation.op}-${operation.path}-${index}`}>
            <div className="patch-operation-main">
              <Badge tone={operation.op === "remove" ? "danger" : operation.op === "test" ? "neutral" : "info"}>{operation.op}</Badge>
              <span>{operation.path}</span>
            </div>
            {before !== null || after !== null ? (
              <div className="patch-values">
                <div>
                  <span>Before</span>
                  <pre>{formatPatchValue(before)}</pre>
                </div>
                <div>
                  <span>After</span>
                  <pre>{formatPatchValue(after)}</pre>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ObjectEditPanel({
  client,
  object,
  objects,
  readonly,
  onError,
  onSaved
}: {
  client: LwsClient;
  defaultVisibility: Visibility;
  object: LwsObject;
  objects: ObjectRow[];
  readonly: boolean;
  onError: (error: LwsApiError) => void;
  onSaved: (id: string) => void;
}) {
  const [draft, setDraft] = useState<NodeDraft | EdgeDraft>(() => (object.object_kind === "node" ? nodeToDraft(object) : edgeToDraft(object)));
  const [editorState, setEditorState] = useState<EditorState>(readonly ? "readonly" : "clean");
  const [lastPatch, setLastPatch] = useState<JsonPatchOperation[]>([]);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const previousObjectId = useRef(object.id);

  useEffect(() => {
    const objectChanged = previousObjectId.current !== object.id;
    previousObjectId.current = object.id;

    setDraft(object.object_kind === "node" ? nodeToDraft(object) : edgeToDraft(object));
    setEditorState(readonly ? "readonly" : "clean");
    setLastPatch([]);
    if (objectChanged) {
      setLastResult(null);
    }
    setLocalError(null);
  }, [object, readonly]);

  async function saveDraft() {
    if (readonly) {
      setEditorState("readonly");
      return;
    }

    const after = draftToComparableObject(object, draft);
    const patch = createPatchFromObjects(object, after);
    setLastPatch(patch);

    if (patch.length === 0) {
      setEditorState("clean");
      return;
    }

    setEditorState("saving");
    setLocalError(null);

    try {
      const result =
        object.object_kind === "node"
          ? await client.patchNode(object.id, object.rev, patch, `Updated ${object.id} from frontend workbench`)
          : await client.patchEdge(object.id, object.rev, patch, `Updated ${object.id} from frontend workbench`);
      setLastResult(`Saved ${result.object.id} at rev ${result.next_rev} via ${result.event_id}.`);
      setEditorState("saved");
      onSaved(result.object.id);
    } catch (error) {
      const apiError = toApiError(error);
      setEditorState(errorToEditorState(apiError));
      setLocalError(apiError.message);
      onError(apiError);
    }
  }

  return (
    <div className="stack">
      {readonly ? (
        <div className="issue">
          <strong>Readonly</strong>
          <span>The backend did not return update permission for this viewer. Admin mode can be enabled and refreshed for local development.</span>
        </div>
      ) : null}
      <DraftForm
        draft={draft}
        kind={object.object_kind}
        objects={objects}
        readonly={readonly || editorState === "saving"}
        onDirty={() => setEditorState((current) => (current === "readonly" ? current : "dirty"))}
        onDraftChange={setDraft}
      />
      {localError ? (
        <div className="issue">
          <strong>{editorState}</strong>
          <span>{localError}</span>
        </div>
      ) : null}
      {lastResult ? (
        <div className="success-banner">
          <strong>Mutation result</strong>
          <span>{lastResult}</span>
        </div>
      ) : null}
      <div className="inline-actions">
        <Button variant="primary" onClick={() => void saveDraft()} disabled={readonly || editorState === "saving" || editorState === "clean"}>
          <Save size={15} /> {editorState === "saving" ? "Saving" : "Save"}
        </Button>
        <Badge tone={editorState === "saved" || editorState === "clean" ? "good" : editorState === "dirty" ? "warn" : editorState === "readonly" ? "neutral" : "danger"}>
          {editorState}
        </Badge>
      </div>
      {lastPatch.length ? (
        <section className="subsection">
          <h3>Generated Patch</h3>
          <pre className="raw-json">{JSON.stringify(lastPatch, null, 2)}</pre>
        </section>
      ) : null}
    </div>
  );
}

function CreateObjectDialog({
  client,
  defaultVisibility,
  kind,
  objects,
  onClose,
  onCreated,
  onError
}: {
  client: LwsClient;
  defaultVisibility: Visibility;
  kind: ObjectKind | null;
  objects: ObjectRow[];
  onClose: () => void;
  onCreated: (id: string) => void;
  onError: (error: LwsApiError) => void;
}) {
  const [nodeDraft, setNodeDraft] = useState<NodeDraft>(() => createEmptyNodeDraft(defaultVisibility));
  const [edgeDraft, setEdgeDraft] = useState<EdgeDraft>(() => createEmptyEdgeDraft(defaultVisibility));
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (kind === "node") {
      setNodeDraft(createEmptyNodeDraft(defaultVisibility));
    }
    if (kind === "edge") {
      setEdgeDraft(createEmptyEdgeDraft(defaultVisibility));
    }
    setLocalError(null);
  }, [defaultVisibility, kind]);

  async function submit() {
    if (!kind) {
      return;
    }

    setSaving(true);
    setLocalError(null);

    try {
      const result =
        kind === "node"
          ? await client.createNode(draftToNode(nodeDraft), `Created ${nodeDraft.id} from frontend workbench`)
          : await client.createEdge(draftToEdge(edgeDraft), `Created ${edgeDraft.id} from frontend workbench`);
      onCreated(result.object.id);
    } catch (error) {
      const apiError = toApiError(error);
      setLocalError(apiError.message);
      onError(apiError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title={kind === "edge" ? "Create Edge" : "Create Node"} description="Creates a real L.W.S. object through /api/lws/*." open={kind !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      {kind ? (
        <div className="stack">
          <DraftForm
            draft={kind === "node" ? nodeDraft : edgeDraft}
            kind={kind}
            objects={objects}
            readonly={saving}
            onDirty={() => undefined}
            onDraftChange={(next) => {
              if (kind === "node") {
                setNodeDraft(next as NodeDraft);
              } else {
                setEdgeDraft(next as EdgeDraft);
              }
            }}
          />
          {localError ? (
            <div className="issue">
              <strong>Create failed</strong>
              <span>{localError}</span>
            </div>
          ) : null}
          <div className="inline-actions">
            <Button variant="primary" onClick={() => void submit()} disabled={saving}>
              <Save size={15} /> {saving ? "Saving" : "Create"}
            </Button>
            <Button onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

function DraftForm({
  draft,
  kind,
  objects,
  readonly,
  onDirty,
  onDraftChange
}: {
  draft: NodeDraft | EdgeDraft;
  kind: ObjectKind;
  objects: ObjectRow[];
  readonly: boolean;
  onDirty: () => void;
  onDraftChange: (draft: NodeDraft | EdgeDraft) => void;
}) {
  const [propsText, setPropsText] = useState(() => propsToText(draft.props));
  const [tagsText, setTagsText] = useState(() => tagsToText(draft.tags));
  const [propsError, setPropsError] = useState<string | null>(null);

  useEffect(() => {
    setPropsText(propsToText(draft.props));
    setTagsText(tagsToText(draft.tags));
    setPropsError(null);
  }, [draft.id]);

  function update(key: keyof NodeDraft | keyof EdgeDraft, value: unknown) {
    onDraftChange({ ...draft, [key]: value });
    onDirty();
  }

  function updateTags(value: string) {
    setTagsText(value);
    update("tags", value.split(",").map((tag) => tag.trim()).filter(Boolean));
  }

  function updateProps(value: string) {
    setPropsText(value);
    const parsed = parseProps(value);
    if (parsed.ok) {
      setPropsError(null);
      update("props", parsed.value);
    } else {
      setPropsError(parsed.message);
      onDirty();
    }
  }

  const publicEdgeWarning = kind === "edge" ? getPublicEdgeWarning(draft as EdgeDraft, objects) : null;

  return (
    <div className="form-grid">
      <TextField label="ID" value={draft.id} onChange={(value) => update("id", value)} readonly={readonly} />
      <TextField label="Title" value={draft.title} onChange={(value) => update("title", value)} readonly={readonly} />
      {kind === "node" ? <TextField label="Slug" value={(draft as NodeDraft).slug} onChange={(value) => update("slug", value)} readonly={readonly} /> : null}
      {kind === "edge" ? (
        <>
          <TextField label="Source" value={(draft as EdgeDraft).source} onChange={(value) => update("source", value)} readonly={readonly} list="object-id-options" />
          <TextField label="Target" value={(draft as EdgeDraft).target} onChange={(value) => update("target", value)} readonly={readonly} list="object-id-options" />
          <datalist id="object-id-options">
            {objects.filter((item) => item.object_kind === "node").map((item) => (
              <option value={item.id} key={item.id}>
                {item.title}
              </option>
            ))}
          </datalist>
        </>
      ) : null}
      <div className="form-field">
        <label>{kind === "edge" ? "Relation type" : "Type"}</label>
        <input
          className="input"
          value={draft.type ?? ""}
          onChange={(event) => update("type", event.target.value)}
          disabled={readonly}
          list={kind === "edge" ? "relation-type-options" : "node-type-options"}
        />
        <datalist id={kind === "edge" ? "relation-type-options" : "node-type-options"}>
          {(kind === "edge" ? COMMON_RELATION_TYPES : COMMON_NODE_TYPES).map((type) => (
            <option value={type} key={type} />
          ))}
        </datalist>
      </div>
      <SelectField label="Detail mode" value={draft.detail_mode} options={kind === "edge" ? EDGE_DETAIL_MODES : NODE_DETAIL_MODES} onChange={(value) => update("detail_mode", value)} readonly={readonly} />
      <SelectField label="Visibility" value={draft.visibility} options={VISIBILITIES} onChange={(value) => update("visibility", value as Visibility)} readonly={readonly} />
      <SelectField label="Status" value={draft.status} options={OBJECT_STATUSES} onChange={(value) => update("status", value)} readonly={readonly} />
      <TextField label="Tags" value={tagsText} onChange={updateTags} readonly={readonly} />
      <TextAreaField label="Summary" value={draft.summary ?? ""} onChange={(value) => update("summary", value)} readonly={readonly} />
      <TextAreaField label="Content" value={draft.content?.body ?? ""} onChange={(value) => update("content", { format: "markdown", body: value })} readonly={readonly} />
      <TextAreaField label="Props JSON" value={propsText} onChange={updateProps} readonly={readonly} mono />
      <TextField label="Occurred at" value={draft.temporal.occurred_at ?? ""} onChange={(value) => update("temporal", { ...draft.temporal, occurred_at: value || null })} readonly={readonly} />
      <TextField label="Valid from" value={draft.temporal.valid_from ?? ""} onChange={(value) => update("temporal", { ...draft.temporal, valid_from: value || null })} readonly={readonly} />
      <TextField label="Valid to" value={draft.temporal.valid_to ?? ""} onChange={(value) => update("temporal", { ...draft.temporal, valid_to: value || null })} readonly={readonly} />
      {propsError ? (
        <div className="form-field full">
          <div className="issue">
            <strong>Props JSON</strong>
            <span>{propsError}</span>
          </div>
        </div>
      ) : null}
      {publicEdgeWarning ? (
        <div className="form-field full">
          <div className="issue">
            <strong>PUBLIC_BOUNDARY_VIOLATION</strong>
            <span>{publicEdgeWarning}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RightInspector({
  adminJob,
  adminMode,
  graph,
  ontology,
  selected,
  session,
  status,
  timeline,
  validation,
  onSelect,
  onReindex,
  onValidate
}: {
  adminJob: AdminJob | null;
  adminMode: AdminMode;
  graph: GraphResponse | null;
  ontology: OntologyResponse | null;
  selected: ObjectReadResponse | null;
  session: SessionResponse | null;
  status: StatusResponse | null;
  timeline: TimelineResponse | null;
  validation: ValidationReport | null;
  onSelect: (id: string) => void;
  onReindex: () => void;
  onValidate: () => void;
}) {
  const selectedObject = selected?.object ?? null;

  return (
    <aside className="operations-panel" aria-label="Operations">
      <Panel
        title="Index And Storage"
        actions={
          <div className="inline-actions">
            <IconButton label="Run validation job" onClick={onValidate} disabled={!adminMode.enabled}>
              <Shield size={16} />
            </IconButton>
            <IconButton label="Run reindex job" onClick={onReindex} disabled={!adminMode.enabled}>
              <DatabaseZap size={16} />
            </IconButton>
          </div>
        }
      >
        <IssueList issues={status?.storage.issues ?? []} empty="No storage issues reported." />
        {adminJob ? (
          <div className="issue">
            <strong>Job {adminJob.status}</strong>
            <span>{adminJob.type ?? adminJob.job_id ?? adminJob.id ?? "admin job"}</span>
          </div>
        ) : null}
      </Panel>

      <Panel title="Capabilities">
        <div className="permission-row">
          {session?.ui_capabilities.length ? session.ui_capabilities.map((capability) => <span className="permission on" key={capability}>{capability}</span>) : <span className="permission">read-only</span>}
        </div>
      </Panel>

      {selectedObject ? (
        <RelatedObjectsPanel object={selectedObject} graph={graph} onSelect={onSelect} />
      ) : (
        <Panel
          title="Graph"
          actions={
            <a className="button ghost" href="/graph">
              <Network size={14} /> Open
            </a>
          }
        >
          <div className="readonly-grid">
            <Field label="Nodes" value={String(graph?.nodes.length ?? 0)} />
            <Field label="Edges" value={String(graph?.edges.length ?? 0)} />
            <Field label="Depth" value={String(graph?.depth ?? 1)} />
          </div>
          <p className="help-text">Select an object to replace this summary with its local relations.</p>
        </Panel>
      )}

      <Panel title="Timeline">
        <Field label="Items" value={String(timeline?.items.length ?? 0)} />
      </Panel>

      <Panel title="Ontology">
        <div className="readonly-grid">
          <Field label="Types" value={String(ontology?.types.length ?? 0)} />
          <Field label="Tags" value={String(ontology?.tags.length ?? 0)} />
          <Field label="Relations" value={String(ontology?.relations.length ?? 0)} />
        </div>
      </Panel>

      <Panel title="Validation">
        <IssueList issues={validation?.issues ?? []} empty="Selected object has no returned issues." />
      </Panel>

      <Panel title="API Boundary">
        <p className="help-text">This frontend calls `/api/lws/*` only. Storage, events, index, permissions, and admin operations remain service-mediated.</p>
      </Panel>
    </aside>
  );
}

function RelatedObjectsPanel({ object, graph, onSelect }: { object: LwsObject; graph: GraphResponse | null; onSelect: (id: string) => void }) {
  const relations = getRelevantEdges(object, graph);
  const relatedEntries = getRelatedObjectEntries(object, relations);

  return (
    <Panel title="Related Objects">
      {relatedEntries.length ? (
        <div className="related-list">
          {relatedEntries.slice(0, 8).map(({ edge, objectId }) => {
            const source = getGraphObject(graph, edge.source_id);
            const target = getGraphObject(graph, edge.target_id);
            const neighbor = getGraphObject(graph, objectId);
            return (
              <button className="related-row" type="button" onClick={() => onSelect(objectId)} key={`${edge.edge_id}-${objectId}`}>
                <span>{neighbor?.title ?? objectId}</span>
                <small>
                  {source?.title ?? edge.source_id} / {edge.relation_type} / {target?.title ?? edge.target_id}
                </small>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="muted">No visible local relations for the selected object.</p>
      )}
    </Panel>
  );
}

function IndexRecoveryPrompt({ error, adminMode, onReindex }: { error: LwsApiError; adminMode: AdminMode; onReindex: () => void }) {
  return (
    <div className="issue">
      <strong>{error.code}</strong>
      <span>{error.message}</span>
      <div className="inline-actions">
        <Button onClick={onReindex} disabled={!adminMode.enabled}>
          <DatabaseZap size={15} /> Reindex
        </Button>
        {!adminMode.enabled ? <span className="muted">Enable local Admin mode to run recovery actions.</span> : null}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, readonly, list }: { label: string; value: string; onChange: (value: string) => void; readonly: boolean; list?: string }) {
  return (
    <div className="form-field">
      <label>{label}</label>
      <input className="input" value={value ?? ""} onChange={(event) => onChange(event.target.value)} disabled={readonly} list={list} />
    </div>
  );
}

function TextAreaField({ label, value, onChange, readonly, mono }: { label: string; value: string; onChange: (value: string) => void; readonly: boolean; mono?: boolean }) {
  return (
    <div className="form-field full">
      <label>{label}</label>
      <textarea className={`textarea ${mono ? "mono" : ""}`} value={value ?? ""} onChange={(event) => onChange(event.target.value)} disabled={readonly} />
    </div>
  );
}

function SelectField({ label, value, options, onChange, readonly }: { label: string; value: string; options: string[]; onChange: (value: string) => void; readonly: boolean }) {
  return (
    <div className="form-field">
      <label>{label}</label>
      <Select label={label} value={value} onValueChange={onChange} options={options.map((option) => ({ value: option, label: option }))} disabled={readonly} />
    </div>
  );
}

function IssueList({ issues, empty }: { issues: Array<{ code: string; severity?: string; message: string }>; empty: string }) {
  if (!issues.length) {
    return <p className="muted">{empty}</p>;
  }

  return (
    <div className="issue-list">
      {issues.map((issue, index) => (
        <div className="issue" key={`${issue.code}-${index}`}>
          <strong>{issue.severity ? `${issue.severity}: ` : ""}{issue.code}</strong>
          <span>{issue.message}</span>
        </div>
      ))}
    </div>
  );
}

function ErrorBanner({ error }: { error: LwsApiError }) {
  return (
    <section className="error-banner" role="alert">
      <strong>{error.code}</strong>
      <span>{error.message}</span>
      {error.details ? <pre className="raw-json">{JSON.stringify(error.details, null, 2)}</pre> : null}
    </section>
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

async function safeOptional<T>(loader: () => Promise<T>): Promise<T | null> {
  try {
    return await loader();
  } catch {
    return null;
  }
}

function errorToEditorState(error: LwsApiError): EditorState {
  if (error.code === "REV_CONFLICT") {
    return "rev conflict";
  }
  if (error.code === "PERMISSION_DENIED") {
    return "permission denied";
  }
  if (error.code === "SCHEMA_INVALID" || error.code === "SEMANTIC_INVALID" || error.code === "PUBLIC_BOUNDARY_VIOLATION") {
    return "validation failed";
  }
  return "save failed";
}

function isIndexError(error: LwsApiError): boolean {
  return ["INDEX_REBUILD_REQUIRED", "INDEX_STALE", "INDEX_CORRUPT", "INDEX_SCHEMA_MISMATCH"].includes(error.code);
}

function getPublicEdgeWarning(draft: EdgeDraft, objects: ObjectRow[]): string | null {
  if (draft.visibility !== "public") {
    return null;
  }

  const source = objects.find((item) => item.id === draft.source);
  const target = objects.find((item) => item.id === draft.target);
  if ((source && source.visibility !== "public") || (target && target.visibility !== "public")) {
    return "public edge requires public source and public target. The backend will enforce this on save.";
  }
  return null;
}

function getRelevantEdges(object: LwsObject, graph: GraphResponse | null): Array<GraphResponse["edges"][number]> {
  if (!graph) {
    return [];
  }

  if (object.object_kind === "edge") {
    return graph.edges.filter((edge) => edge.edge_id === object.id || edge.source_id === object.source || edge.target_id === object.target);
  }

  return graph.edges.filter((edge) => edge.source_id === object.id || edge.target_id === object.id);
}

function getRelatedObjectEntries(object: LwsObject, edges: Array<GraphResponse["edges"][number]>): Array<{ edge: GraphResponse["edges"][number]; objectId: string }> {
  if (object.object_kind === "edge") {
    return edges.flatMap((edge) => {
      if (edge.edge_id === object.id) {
        return [
          { edge, objectId: edge.source_id },
          { edge, objectId: edge.target_id }
        ];
      }
      return [{ edge, objectId: edge.edge_id }];
    });
  }

  return edges.map((edge) => ({
    edge,
    objectId: edge.source_id === object.id ? edge.target_id : edge.source_id
  }));
}

function getGraphObject(graph: GraphResponse | null, id: string): ObjectRow | undefined {
  return graph?.nodes.find((item) => item.id === id);
}

function compareHistoryDescending(left: ObjectHistoryLink, right: ObjectHistoryLink): number {
  const byDate = new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime();
  if (byDate !== 0) {
    return byDate;
  }
  return right.line - left.line;
}

function eventTone(eventType: string): "neutral" | "good" | "warn" | "danger" | "info" {
  if (eventType.endsWith(".created")) {
    return "good";
  }
  if (eventType.endsWith(".deleted")) {
    return "danger";
  }
  if (eventType.endsWith(".restored")) {
    return "warn";
  }
  return "info";
}

function shortHash(value: string | null): string {
  if (!value) {
    return "none";
  }
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

function patchBeforeValue(operation: JsonPatchOperation, inverse: JsonPatchOperation | undefined): unknown {
  if (operation.op === "add") {
    return null;
  }
  if (operation.op === "remove") {
    return inverse && "value" in inverse ? inverse.value : undefined;
  }
  return inverse && "value" in inverse ? inverse.value : undefined;
}

function patchAfterValue(operation: JsonPatchOperation): unknown {
  if (operation.op === "remove") {
    return null;
  }
  return "value" in operation ? operation.value : undefined;
}

function formatPatchValue(value: unknown): string {
  if (value === null) {
    return "(none)";
  }
  if (value === undefined) {
    return "(not recorded)";
  }
  if (typeof value === "string") {
    return value.length > 520 ? `${value.slice(0, 520)}...` : value;
  }

  const text = JSON.stringify(value, null, 2);
  return text.length > 520 ? `${text.slice(0, 520)}...` : text;
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
