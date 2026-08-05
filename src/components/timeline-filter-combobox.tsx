"use client";

import { useEffect, useId, useState } from "react";

import type { LwsClient } from "../lib/lws-api/client";
import type { ObjectRow } from "../lib/lws-api/types";

type Props = {
  label: string;
  value?: string;
  placeholder: string;
  client: LwsClient;
  candidateType?: string;
  requiredPrefix?: string;
  onDraftChange: (value: string) => void;
  onSelect: (value: string) => void;
};

export function TimelineFilterCombobox({ label, value, placeholder, client, candidateType, requiredPrefix, onDraftChange, onSelect }: Props) {
  const listId = useId();
  const [draft, setDraft] = useState(value ?? "");
  const [results, setResults] = useState<ObjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { setDraft(value ?? ""); setMessage(null); }, [value]);
  useEffect(() => {
    const query = draft.trim();
    if (!query) { setResults([]); setLoading(false); return; }
    let live = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      client.searchObjects({ q: query, type: candidateType, limit: 8 })
        .then((response) => live && setResults(response.items))
        .catch(() => live && setResults([]))
        .finally(() => live && setLoading(false));
    }, 250);
    return () => { live = false; window.clearTimeout(timer); };
  }, [candidateType, client, draft]);

  return <div className="timeline-filter-combobox">
    <label htmlFor={listId}>{label}<input id={listId} role="combobox" aria-autocomplete="list" aria-expanded={results.length > 0} aria-controls={`${listId}-options`} value={draft} placeholder={placeholder} onChange={(event) => { const next = event.target.value; setDraft(next); onDraftChange(next); setMessage(requiredPrefix && next.trim() && !next.trim().startsWith(requiredPrefix) ? `Expected an ID starting with ${requiredPrefix}.` : null); }} /></label>
    {loading ? <small>Searching…</small> : null}
    {results.length ? <ul id={`${listId}-options`} role="listbox">{results.map((item) => <li key={item.id}><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setDraft(item.id); onDraftChange(item.id); onSelect(item.id); setResults([]); setMessage(null); }}><strong>{item.title}</strong><small>{item.id} · {item.type}</small></button></li>)}</ul> : null}
    {message ? <small className="timeline-filter-message">{message}</small> : null}
  </div>;
}
