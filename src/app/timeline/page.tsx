"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarRange, ChevronRight, RefreshCw } from "lucide-react";

import { TimelineFlow } from "../../components/timeline-flow";
import { TimelineFilterCombobox } from "../../components/timeline-filter-combobox";
import { TimelineSidebar, type TimelineSidebarMode } from "../../components/timeline-sidebar";
import { Badge, Switch } from "../../components/ui";
import { createLwsClient, toApiError, type TimelineParams } from "../../lib/lws-api/client";
import type { LwsApiError, NodeTimelineItem, TimelineEndpoint, TimelineItem, TimelineResponse } from "../../lib/lws-api/types";
import { parseTimelineSearch, updateTimelineSearch } from "../../lib/timeline/url-state";
import { parseTimelineGranularity } from "../../lib/timeline/granularity";
import { parseTimelineDrillHistory, serializeTimelineDrillHistory } from "../../lib/timeline/drill-history";

type AdminMode = {
  enabled: boolean;
  secret: string;
  persist: boolean;
};

const STORED_ADMIN_SECRET = "lws.localAdminSecret";
const STORED_ADMIN_ENABLED = "lws.localAdminEnabled";

export default function TimelinePage() {
  return <Suspense fallback={<main className="timeline-page"><p className="timeline-loading">Loading timeline…</p></main>}><TimelineClient /></Suspense>;
}

function TimelineClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryText = searchParams.toString();
  const [response, setResponse] = useState<TimelineResponse | null>(null);
  const [error, setError] = useState<LwsApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NodeTimelineItem | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [sidebarMode, setSidebarMode] = useState<TimelineSidebarMode>("closed");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [adminMode, setAdminMode] = useState<AdminMode>({ enabled: false, secret: "", persist: false });
  const [environment, setEnvironment] = useState<string | null>(null);
  const params = useMemo(() => parseTimelineSearch(new URLSearchParams(queryText)), [queryText]);
  const timelineParams = useMemo<TimelineParams>(() => ({ ...params, temporal_state: "dated" }), [params]);
  const displayGranularity = useMemo(() => parseTimelineGranularity(searchParams.get("granularity")), [searchParams]);
  const drillHistory = useMemo(() => parseTimelineDrillHistory(searchParams.get("timeline_drill")), [searchParams]);
  const auth = useMemo(() => ({
    adminMode: adminMode.enabled,
    localAdminSecret: adminMode.secret,
    env: environment ?? undefined
  }), [adminMode.enabled, adminMode.secret, environment]);
  const client = useMemo(() => createLwsClient(auth), [auth]);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(STORED_ADMIN_SECRET);
    if (stored) setAdminMode({ enabled: window.sessionStorage.getItem(STORED_ADMIN_ENABLED) !== "false", secret: stored, persist: true });
  }, []);

  useEffect(() => {
    if (adminMode.persist && adminMode.secret) {
      window.sessionStorage.setItem(STORED_ADMIN_SECRET, adminMode.secret);
      window.sessionStorage.setItem(STORED_ADMIN_ENABLED, String(adminMode.enabled));
      return;
    }
    window.sessionStorage.removeItem(STORED_ADMIN_SECRET);
    window.sessionStorage.removeItem(STORED_ADMIN_ENABLED);
  }, [adminMode.enabled, adminMode.persist, adminMode.secret]);

  useEffect(() => {
    setSelected(null);
    setSelectedEdgeId(null);
    setSidebarMode("closed");
    const current = new URLSearchParams(queryText);
    if (current.get("temporal_state") !== "undated") return;
    current.delete("temporal_state");
    router.replace(`${pathname}${current.size ? `?${current}` : ""}`);
  }, [pathname, queryText, router]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    Promise.all([client.getTimeline(timelineParams), client.getStatus().catch(() => null)])
      .then(([data, status]) => {
        if (!live) return;
        if (status) setEnvironment(status.app.env);
        setResponse(data);
        setSelected((current) => current
          ? (data.items.find((item) => item.object_kind === "node" && item.object_id === current.object_id) as NodeTimelineItem | undefined) ?? null
          : null);
      })
      .catch((reason) => live && setError(toApiError(reason)))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [client, refreshVersion, timelineParams]);

  function navigate(values: Record<string, string | undefined>) {
    const next = updateTimelineSearch(new URLSearchParams(searchParams), values);
    router.push(`${pathname}${next.size ? `?${next}` : ""}`);
  }

  function update(values: Record<string, string | undefined>) {
    navigate({ ...values, timeline_drill: undefined });
  }

  function drillInto({ from, to, granularity }: { from: string; to: string; granularity: Exclude<ReturnType<typeof parseTimelineGranularity>, "auto"> }) {
    const nextHistory = serializeTimelineDrillHistory([
      ...drillHistory,
      { from: params.from ?? null, to: params.to ?? null, granularity: displayGranularity }
    ]);
    navigate({ from, to, granularity, timeline_drill: nextHistory });
  }

  function zoomOut() {
    const parent = drillHistory.at(-1);
    if (!parent) return;
    navigate({
      from: parent.from ?? undefined,
      to: parent.to ?? undefined,
      granularity: parent.granularity === "auto" ? undefined : parent.granularity,
      timeline_drill: serializeTimelineDrillHistory(drillHistory.slice(0, -1))
    });
  }

  function resetCursor() {
    const next = new URLSearchParams(searchParams);
    next.delete("cursor");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`);
  }

  return <main className={`timeline-page${sidebarMode !== "closed" ? " timeline-page-sidebar-open" : ""}`}>
    <header className="timeline-header">
      <div>
        <p className="eyebrow">Object Timeline</p>
        <h1>선택한 시간 기준으로 탐색하는 Node</h1>
        <p className="timeline-intro">Audit time, Knowledge time 또는 명시적으로 선언한 Props time을 같은 Node scene 규칙으로 표시합니다.</p>
      </div>
      <div className="timeline-actions">
        <a className="button ghost" href="/">Workbench</a>
        <button className="button" type="button" onClick={() => setRefreshVersion((version) => version + 1)}><RefreshCw size={15} /> Refresh</button>
      </div>
    </header>

    <section className="timeline-admin-mode" aria-label="Timeline local admin mode">
      <Switch checked={adminMode.enabled} label="Admin mode" onCheckedChange={(enabled) => setAdminMode((current) => ({ ...current, enabled }))} />
      <input className="timeline-admin-secret" type="password" value={adminMode.secret} onChange={(event) => setAdminMode((current) => ({ ...current, secret: event.target.value }))} placeholder="local secret" aria-label="Local admin secret" disabled={!adminMode.enabled} />
      <Switch checked={adminMode.persist} label="Keep" onCheckedChange={(persist) => setAdminMode((current) => ({ ...current, persist }))} />
      <Badge tone={adminMode.enabled && environment !== "production" && Boolean(adminMode.secret.trim()) ? "good" : adminMode.enabled ? "warn" : "neutral"}>
        {adminMode.enabled && environment !== "production" && Boolean(adminMode.secret.trim()) ? "armed" : adminMode.enabled ? "blocked" : "off"}
      </Badge>
    </section>

    <TimelineFilters params={params} update={update} client={client} />
    {error ? <TimelineError error={error} onRecover={error.code === "CURSOR_INVALID" ? resetCursor : undefined} /> : null}
    {loading ? <p className="timeline-loading">Loading timeline…</p> : null}

    {response ? <>
      <TimelineSummary response={response} />
      <TemporalCoverage response={response} onOpen={() => { setSelected(null); setSelectedEdgeId(null); setSidebarMode("coverage"); }} />
      {response.query.basis === "updated" ? <p className="timeline-basis-note">Last updated는 현재 revision의 마지막 수정 시점입니다. 전체 변경 과정은 각 object의 History에서 확인합니다.</p> : null}
      {response.context ? <section className="timeline-context"><strong>Center context</strong> {endpointLabel(response.context.center)} · {response.context.relations.length} readable relation(s)</section> : null}
      {!loading && response.items.length === 0 ? <TimelineEmpty response={response} /> : null}
      {response.items.length > 0 ? <TimelineFlow
        response={response}
        selectionScopeKey={queryText}
        selectedId={selected?.object_id ?? null}
        selectedEdgeId={selectedEdgeId}
        onSelect={(item) => { setSelected(item); setSelectedEdgeId(null); setSidebarMode(item ? "selection" : "closed"); }}
        onSelectEdge={(edgeId) => { setSelectedEdgeId(edgeId); setSidebarMode(edgeId ? "selection" : selected ? "selection" : "closed"); }}
        onOpenObject={(objectId) => window.location.assign(`/?object=${encodeURIComponent(objectId)}`)}
        granularity={displayGranularity}
        onDrill={drillInto}
        onZoomOut={zoomOut}
        canZoomOut={drillHistory.length > 0}
      /> : null}
      {response.next_cursor ? <button type="button" className="button timeline-more" onClick={() => update({ cursor: response.next_cursor! })}>Load next page <ChevronRight size={15} /></button> : null}
      <AccessibleTimeline items={response.items} onSelect={(item) => { setSelected(item); setSelectedEdgeId(null); setSidebarMode("selection"); }} />
      <TimelineSidebar mode={sidebarMode} response={response} client={client} selectedNode={selected} selectedEdgeId={selectedEdgeId} onClose={() => { setSelected(null); setSelectedEdgeId(null); setSidebarMode("closed"); }} onOpenObject={(objectId) => window.location.assign(`/?object=${encodeURIComponent(objectId)}`)} />
    </> : null}
  </main>;
}

function TimelineFilters({ params, update, client }: { params: TimelineParams; update: (values: Record<string, string | undefined>) => void; client: ReturnType<typeof createLwsClient> }) {
  const [basisDraft, setBasisDraft] = useState(params.basis ?? "created");
  const [draft, setDraft] = useState(() => timelineFilterDraft(params));
  const [draftError, setDraftError] = useState<string | null>(null);
  useEffect(() => { setBasisDraft(params.basis ?? "created"); setDraft(timelineFilterDraft(params)); setDraftError(null); }, [params]);

  function changeBasis(value: string) {
    setBasisDraft(value as NonNullable<TimelineParams["basis"]>);
    if (value !== "custom") update({ basis: value, time_path: undefined });
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    const from = normalizeDateDraft(draft.from);
    const to = normalizeDateDraft(draft.to);
    if (from === null || to === null) { setDraftError("From과 To에는 ISO full-date 또는 offset datetime을 입력하세요."); return; }
    if (basisDraft === "custom" && (!draft.time_path.startsWith("/props/") || draft.time_path.length <= "/props/".length)) { setDraftError("Custom props에는 /props/... temporal wrapper path가 필요합니다."); return; }
    for (const [key, prefix] of [["type", "type."], ["tag", "tag."], ["scope", "scope."], ["collection", "collection."]] as const) {
      const value = draft[key].trim();
      if (value && !value.startsWith(prefix)) { setDraftError(`${key} ID는 ${prefix}로 시작해야 합니다.`); return; }
    }
    setDraftError(null);
    update({
      basis: basisDraft,
      time_path: basisDraft === "custom" ? draft.time_path.trim() : undefined,
      from: from || undefined,
      to: to || undefined,
      type: draft.type.trim() || undefined,
      tag: draft.tag.trim() || undefined,
      scope: draft.scope.trim() || undefined,
      collection: draft.collection.trim() || undefined,
      center: draft.center.trim() || undefined
    });
  }

  const setField = (field: keyof TimelineFilterDraft, value: string) => setDraft((current) => ({
    ...current,
    [field]: value,
    ...(field === "scope" && value.trim() ? { collection: "" } : {}),
    ...(field === "collection" && value.trim() ? { scope: "" } : {})
  }));
  return <form className="timeline-controls" aria-label="Timeline filters" onSubmit={applyFilters}>
    <label>Time basis<select value={basisDraft} onChange={(event) => changeBasis(event.target.value)}><option value="created">Created</option><option value="updated">Last updated</option><option value="occurred">Occurred</option><option value="valid">Valid interval</option><option value="custom">Custom props</option></select></label>
    {basisDraft === "custom" ? <label>Temporal wrapper path<input type="text" value={draft.time_path} placeholder="/props/release" onChange={(event) => setField("time_path", event.target.value)} /></label> : null}
    <label>From<input type="text" value={draft.from} placeholder="2026-01-01" onChange={(event) => setField("from", event.target.value)} /></label>
    <label>To<input type="text" value={draft.to} placeholder="2026-12-31" onChange={(event) => setField("to", event.target.value)} /></label>
    <TimelineFilterCombobox label="Type" value={draft.type} placeholder="type.project" client={client} candidateType="type.node-type" requiredPrefix="type." onDraftChange={(value) => setField("type", value)} onSelect={(value) => setField("type", value)} />
    <TimelineFilterCombobox label="Tag" value={draft.tag} placeholder="tag.frontend" client={client} candidateType="type.tag" requiredPrefix="tag." onDraftChange={(value) => setField("tag", value)} onSelect={(value) => setField("tag", value)} />
    <TimelineFilterCombobox label="Scope" value={draft.scope} placeholder="scope.wiki" client={client} candidateType="type.scope" requiredPrefix="scope." onDraftChange={(value) => setField("scope", value)} onSelect={(value) => setField("scope", value)} />
    <TimelineFilterCombobox label="Collection" value={draft.collection} placeholder="collection.*" client={client} candidateType="type.collection" requiredPrefix="collection." onDraftChange={(value) => setField("collection", value)} onSelect={(value) => setField("collection", value)} />
    <label>Status<select value={params.status ?? "active"} onChange={(event) => update({ status: event.target.value })}><option value="active">Active</option><option value="archived">Archived</option><option value="deleted">Deleted</option><option value="draft">Draft</option><option value="stub">Stub</option></select></label>
    <label>Group<select value={params.group_by ?? "none"} onChange={(event) => update({ group_by: event.target.value })}><option value="none">None</option><option value="type">Type</option><option value="tag">Tag</option><option value="scope">Scope</option><option value="collection">Collection</option></select></label>
    <TimelineFilterCombobox label="Center object" value={draft.center} placeholder="project.lws" client={client} onDraftChange={(value) => setField("center", value)} onSelect={(value) => setField("center", value)} />
    <div className="timeline-filter-apply"><button className="button" type="submit">Apply filters</button>{draftError ? <small>{draftError}</small> : null}</div>
  </form>;
}

type TimelineFilterDraft = { from: string; to: string; time_path: string; type: string; tag: string; scope: string; collection: string; center: string };
function timelineFilterDraft(params: TimelineParams): TimelineFilterDraft { return { from: params.from ?? "", to: params.to ?? "", time_path: params.time_path ?? "/props/", type: params.type ?? "", tag: params.tag ?? "", scope: params.scope ?? "", collection: params.collection ?? "", center: params.center ?? "" }; }
function normalizeDateDraft(value: string) { const next = value.trim(); return !next || /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(next) ? next : null; }

function TimelineSummary({ response }: { response: TimelineResponse }) {
  const coverage = response.time_coverage;
  return <section className="timeline-summary" aria-label="Timeline summary">
    <span><CalendarRange size={16} /> {response.items.length} Node on this page</span>
    <span>{coverage.dated_count} dated</span><span>{coverage.undated_count} undated</span>
    {response.query.basis === "custom" ? <><span>{coverage.declared_count} declared</span><span>{coverage.missing_count} missing</span><span>{coverage.invalid_count} invalid</span></> : null}
    <span>{response.relations.length} scene relations</span><span>{response.groups.length} groups</span>
    <code>{basisLabel(response.query)} · {response.query.temporal_state} · {response.query.status}</code>
  </section>;
}

function TemporalCoverage({ response, onOpen }: { response: TimelineResponse; onOpen: () => void }) {
  const coverage = response.time_coverage;
  const hasNonDatedValue = coverage.undated_count > 0 || coverage.missing_count > 0 || coverage.invalid_count > 0;
  if (!hasNonDatedValue) return null;

  return <section className="timeline-coverage" aria-label="Temporal coverage">
    <div className="timeline-coverage-header">
      <div><strong>Temporal coverage</strong><span>시간축에는 dated Node만 표시합니다.</span></div>
      <button className="button ghost" type="button" onClick={onOpen}>Inspect coverage</button>
    </div>
  </section>;
}

function TimelineEmpty({ response }: { response: TimelineResponse }) {
  if (response.query.basis === "custom") {
    const coverage = response.time_coverage;
    return <div className="timeline-empty">No readable Node has a usable value for <code>{response.query.time_path}</code>. {coverage.missing_count} missing, {coverage.invalid_count} invalid, {coverage.undated_count} undated.</div>;
  }
  return <div className="timeline-empty">No readable Node matches this {basisLabel(response.query)} query.</div>;
}

function AccessibleTimeline({ items, onSelect }: { items: TimelineItem[]; onSelect: (item: NodeTimelineItem) => void }) {
  return <section className="timeline-accessible-list" aria-label="Chronological list"><h2>Chronological list</h2><ol>{items.map((item) => <li key={item.object_id}><button type="button" onClick={() => item.object_kind === "node" && onSelect(item)}>{positionLabel(item)} — {item.title}</button></li>)}</ol></section>;
}

function TimelineError({ error, onRecover }: { error: LwsApiError; onRecover?: () => void }) {
  return <div className="timeline-error"><AlertTriangle size={18} /><div><strong>{error.code}</strong><p>{error.message}</p></div>{onRecover ? <button className="button" type="button" onClick={onRecover}>Return to first page</button> : null}</div>;
}

function positionLabel(item: TimelineItem) {
  if (item.position.kind === "point") return item.position.at;
  if (item.position.kind === "interval") return `${item.position.start ?? "open"} → ${item.position.end ?? "open"}`;
  return "Undated";
}

function basisLabel(query: TimelineResponse["query"]) {
  return ({ created: "Created", updated: "Last updated", occurred: "Occurred", valid: "Valid interval", custom: "Custom props" } as const)[query.basis];
}
function endpointLabel(endpoint: TimelineEndpoint) { return "kind" in endpoint ? "Unreadable endpoint" : endpoint.title; }
