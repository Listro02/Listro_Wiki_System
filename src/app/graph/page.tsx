"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";

import { RelationshipFlow } from "../../components/relationship-flow";
import { Button, IconButton, Panel } from "../../components/ui";
import { createLwsClient, toApiError } from "../../lib/lws-api/client";
import type { GraphResponse, LwsApiError, ObjectRow } from "../../lib/lws-api/types";

export default function GraphPage() {
  const [centerInput, setCenterInput] = useState("");
  const [center, setCenter] = useState<string | undefined>(undefined);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [error, setError] = useState<LwsApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const client = useMemo(() => createLwsClient({ adminMode: false, localAdminSecret: "" }), []);

  async function loadGraph(nextCenter = center) {
    setLoading(true);
    setError(null);

    try {
      setGraph(await client.getGraph(nextCenter));
    } catch (caught) {
      setError(toApiError(caught));
      setGraph(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGraph(undefined);
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextCenter = centerInput.trim() || undefined;
    setCenter(nextCenter);
    void loadGraph(nextCenter);
  }

  return (
    <main className="graph-page">
      <section className="topbar" aria-label="Graph explorer header">
        <div className="brand-block">
          <div className="brand-mark">G</div>
          <div>
            <p className="eyebrow">L.W.S.</p>
            <h1>Graph Explorer</h1>
          </div>
        </div>
        <form className="toolbar graph-search" onSubmit={submit}>
          <input className="input" value={centerInput} onChange={(event) => setCenterInput(event.target.value)} placeholder="Center object id" aria-label="Center object id" />
          <Button type="submit">
            <Search size={15} /> Center
          </Button>
          <IconButton label="Refresh graph" onClick={() => void loadGraph()}>
            <RefreshCw size={16} />
          </IconButton>
        </form>
      </section>

      <section className="graph-layout">
        <Panel title={center ? `Centered: ${center}` : "Visible Graph"}>
          {error ? (
            <div className="error-banner" role="alert">
              <strong>{error.code}</strong>
              <span>{error.message}</span>
            </div>
          ) : null}
          {loading ? <p className="muted">Loading graph...</p> : null}
          <div className="readonly-grid">
            <Field label="Nodes" value={String(graph?.nodes.length ?? 0)} />
            <Field label="Edges" value={String(graph?.edges.length ?? 0)} />
            <Field label="Placeholders" value={String(graph?.placeholders?.length ?? 0)} />
            <Field label="Depth" value={String(graph?.depth ?? 1)} />
          </div>
          <RelationshipFlow graph={graph} focusId={center} className="relationship-flow-large" showMiniMap />
        </Panel>

        <Panel title="Edges">
          <GraphEdgeList graph={graph} />
        </Panel>
      </section>
    </main>
  );
}

function GraphEdgeList({ graph }: { graph: GraphResponse | null }) {
  if (!graph || graph.edges.length === 0) {
    return <p className="muted">No visible edges.</p>;
  }

  const objectById = new Map(graph.nodes.map((node) => [node.id, node]));
  const placeholderIds = new Set((graph.placeholders ?? []).map((placeholder) => placeholder.id));

  return (
    <div className="relation-list">
      {graph.edges.map((edge) => (
        <div className="relation-row" key={edge.edge_id}>
          <GraphEndpoint object={objectById.get(edge.source_id)} fallback={edge.source_id} placeholder={placeholderIds.has(edge.source_id)} />
          <div className="relation-edge">
            {edge.relation_type}
            <span>{objectById.get(edge.edge_id)?.title ?? edge.edge_id}</span>
          </div>
          <GraphEndpoint object={objectById.get(edge.target_id)} fallback={edge.target_id} placeholder={placeholderIds.has(edge.target_id)} />
        </div>
      ))}
    </div>
  );
}

function GraphEndpoint({ object, fallback, placeholder }: { object: ObjectRow | undefined; fallback: string; placeholder: boolean }) {
  return (
    <div className={placeholder ? "relation-pill placeholder" : "relation-pill"}>
      {object?.title ?? (placeholder ? "Unreadable endpoint" : fallback)}
      <span className="ego-meta">{object?.id ?? fallback}</span>
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
