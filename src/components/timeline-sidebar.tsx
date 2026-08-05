"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

import type { LwsClient, TemporalCoverageParams } from "../lib/lws-api/client";
import type { LwsEdge, NodeTimelineItem, TemporalCoverageResponse, TemporalCoverageState, TimelineResponse } from "../lib/lws-api/types";

export type TimelineSidebarMode = "closed" | "selection" | "coverage";

type Props = {
  mode: TimelineSidebarMode;
  response: TimelineResponse;
  client: LwsClient;
  selectedNode: NodeTimelineItem | null;
  selectedEdgeId: string | null;
  onClose: () => void;
  onOpenObject: (objectId: string) => void;
};

type CoverageCacheEntry = { response: TemporalCoverageResponse; pages: TemporalCoverageResponse["items"] };

export function TimelineSidebar({ mode, response, client, selectedNode, selectedEdgeId, onClose, onOpenObject }: Props) {
  const cacheRef = useRef(new Map<string, CoverageCacheEntry>());
  const requestRef = useRef(0);
  const [edge, setEdge] = useState<LwsEdge | null>(null);
  const [edgeError, setEdgeError] = useState<string | null>(null);
  const [coverageState, setCoverageState] = useState<TemporalCoverageState>(firstCoverageState(response));
  const [coverage, setCoverage] = useState<CoverageCacheEntry | null>(null);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);

  const coverageKey = useMemo(() => `${response.index_revision}:${JSON.stringify(response.query)}:${coverageState}`, [coverageState, response.index_revision, response.query]);
  const coverageCounts = response.time_coverage;

  useEffect(() => {
    cacheRef.current.clear();
    setCoverage(null);
    setCoverageState(firstCoverageState(response));
  }, [response.index_revision, response.query]);

  useEffect(() => {
    if (mode !== "selection" || !selectedEdgeId) return;
    const requestId = ++requestRef.current;
    setEdge(null);
    setEdgeError(null);
    client.getObject(selectedEdgeId)
      .then((result) => {
        if (requestId !== requestRef.current || result.object.object_kind !== "edge") return;
        setEdge(result.object);
      })
      .catch((error: unknown) => requestId === requestRef.current && setEdgeError(error instanceof Error ? error.message : "Unable to load edge detail."));
  }, [client, mode, selectedEdgeId]);

  useEffect(() => {
    if (mode !== "coverage") return;
    const cached = cacheRef.current.get(coverageKey);
    if (cached) {
      setCoverage(cached);
      setCoverageError(null);
      return;
    }
    const requestId = ++requestRef.current;
    setCoverageLoading(true);
    setCoverageError(null);
    client.getTemporalCoverage(coverageParams(response, coverageState))
      .then((result) => {
        if (requestId !== requestRef.current) return;
        const entry = { response: result, pages: result.items };
        cacheRef.current.set(coverageKey, entry);
        setCoverage(entry);
      })
      .catch((error: unknown) => requestId === requestRef.current && setCoverageError(error instanceof Error ? error.message : "Unable to load temporal coverage."))
      .finally(() => requestId === requestRef.current && setCoverageLoading(false));
  }, [client, coverageKey, coverageState, mode, response]);

  useEffect(() => {
    if (mode === "closed") return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mode, onClose]);

  if (mode === "closed") return null;
  const openMore = async () => {
    if (!coverage?.response.next_cursor || coverageLoading) return;
    const requestId = ++requestRef.current;
    setCoverageLoading(true);
    try {
      const result = await client.getTemporalCoverage({ ...coverageParams(response, coverageState), cursor: coverage.response.next_cursor });
      if (requestId !== requestRef.current) return;
      const entry = { response: result, pages: [...coverage.pages, ...result.items] };
      cacheRef.current.set(coverageKey, entry);
      setCoverage(entry);
    } catch (error) {
      if (requestId === requestRef.current) setCoverageError(error instanceof Error ? error.message : "Unable to load more coverage items.");
    } finally {
      if (requestId === requestRef.current) setCoverageLoading(false);
    }
  };

  return <aside className="timeline-sidebar" aria-label={mode === "selection" ? "Timeline inspector" : "Temporal coverage"}>
    <header><strong>{mode === "selection" ? "Inspector" : "Temporal coverage"}</strong><button type="button" className="icon-button" aria-label="Close sidebar" onClick={onClose}><X size={16} /></button></header>
    {mode === "selection" ? <SelectionPanel node={selectedNode} edge={edge} edgeId={selectedEdgeId} edgeError={edgeError} onOpenObject={onOpenObject} /> : <>
      <div className="timeline-coverage-tabs">
        {(["undated", ...(response.query.basis === "custom" ? ["missing"] : []), "invalid"] as TemporalCoverageState[]).map((state) => <button type="button" className={coverageState === state ? "active" : ""} key={state} onClick={() => { setCoverageState(state); setCoverage(null); }}>
          {coverageLabel(state)} <span>{coverageCount(coverageCounts, state)}</span>
        </button>)}
      </div>
      {coverageLoading && !coverage ? <p className="muted">Loading coverage…</p> : null}
      {coverageError ? <p className="timeline-sidebar-error">{coverageError}</p> : null}
      {coverage ? <div className="timeline-coverage-list">{coverage.pages.length ? coverage.pages.map((item) => <article key={item.object_id}>
        <strong>{item.title}</strong><small>{item.object_id} · {item.type}</small><p>{item.reason}</p><button type="button" onClick={() => onOpenObject(item.object_id)}>Open object detail</button>
      </article>) : <p className="muted">No readable objects in this state.</p>}
      {coverage.response.next_cursor ? <button type="button" className="button" disabled={coverageLoading} onClick={() => void openMore}>{coverageLoading ? "Loading…" : "Load more"}</button> : null}</div> : null}
    </>}
  </aside>;
}

function SelectionPanel({ node, edge, edgeId, edgeError, onOpenObject }: { node: NodeTimelineItem | null; edge: LwsEdge | null; edgeId: string | null; edgeError: string | null; onOpenObject: (id: string) => void }) {
  if (edgeId) {
    if (edgeError) return <p className="timeline-sidebar-error">{edgeError}</p>;
    if (!edge) return <p className="muted">Loading edge detail…</p>;
    return <div className="timeline-inspector-content"><p className="eyebrow">Selected Edge</p><h2>{edge.title}</h2><p>Relation: {edge.type}</p><p>Source: {edge.source}</p><p>Target: {edge.target}</p><p>Status: {edge.status} · {edge.visibility}</p><p>Tags: {edge.tags.join(", ") || "—"}</p><p>Occurred: {edge.temporal.occurred_at ?? "—"}</p><p>Valid: {edge.temporal.valid_from ?? "open"} — {edge.temporal.valid_to ?? "open"}</p><p>Created: {edge.audit.created_at}</p><p>Last updated: {edge.audit.updated_at}</p><button className="button primary" type="button" onClick={() => onOpenObject(edge.id)}>Open object detail</button></div>;
  }
  if (!node) return <p className="muted">Select a Node or relation to inspect it.</p>;
  return <div className="timeline-inspector-content"><p className="eyebrow">Selected Node</p><h2>{node.title}</h2><p>Position: {positionLabel(node)}</p><p>Type: {node.type}</p><p>Tags: {node.tags.join(", ") || "—"}</p><p>Created: {node.audit.created_at}</p><p>Last updated: {node.audit.updated_at}</p><button className="button primary" type="button" onClick={() => onOpenObject(node.object_id)}>Open object detail</button></div>;
}

function coverageParams(response: TimelineResponse, state: TemporalCoverageState): TemporalCoverageParams {
  const query = response.query;
  return { kind: query.kind, basis: query.basis, time_path: query.time_path, type: query.type, tag: query.tag, scope: query.scope, collection: query.collection, status: query.status, visibility: query.visibility, center: query.center, depth: query.depth, limit: 25, state };
}

function firstCoverageState(response: TimelineResponse): TemporalCoverageState {
  const coverage = response.time_coverage;
  if (coverage.undated_count > 0) return "undated";
  if (coverage.missing_count > 0) return "missing";
  return "invalid";
}
function coverageCount(coverage: TimelineResponse["time_coverage"], state: TemporalCoverageState) { return state === "undated" ? coverage.undated_count : state === "missing" ? coverage.missing_count : coverage.invalid_count; }
function coverageLabel(state: TemporalCoverageState) { return state === "undated" ? "Undated" : state === "missing" ? "Missing" : "Invalid"; }
function positionLabel(item: NodeTimelineItem) { return item.position.kind === "point" ? item.position.at : item.position.kind === "interval" ? `${item.position.start ?? "open"} — ${item.position.end ?? "open"}` : "Undated"; }
