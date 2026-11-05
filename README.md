# [Deprecated] L.W.S. - Listro Wiki System

Korean: [README.ko.md](./README.ko.md)

> **Deprecated — development discontinued.**
>
> Development of L.W.S. (Listro Wiki System) has been discontinued. Further development continues in [L.K.S. (Listro Knowledge System)](https://github.com/Listro02/Listro_Knowledge_System).
>
> This repository is preserved for reference to its past implementation and design. The documentation below describes L.W.S. at the time development stopped.

L.W.S. is still an early implementation, but the backend core contract has moved beyond pure concept work. The current repository contains the app code, schemas, validators, services, API routes, generated read-model code, tests, and docs. Real node JSON, edge JSON, event logs, indexes, runtime files, backups, and secrets live outside this repository.

L.W.S. is a graph-first wiki system built around one core idea:

> Everything meaningful is a node.

A page is a node. A tag is a node. A type is a node. A relation type is a node. A graph view, a timeline view, a setting, an account, a permission, an import source, and even an event about something that happened in the system can be understood as a node.

The implementation still stores both `node` and `edge` objects. Edges are first-class relationship records between nodes. But the philosophy is node-centered: whenever something needs an identity, title, explanation, history, evidence, permissions, or links of its own, L.W.S. should be able to treat it as node-like knowledge rather than as hidden metadata.

## What L.W.S. Is

L.W.S. is not just a wiki page editor. It is a server-backed knowledge graph interface for JSON knowledge objects stored under configured L.W.S. storage roots.

Those storage roots live outside the application repository, but they are not an unspecified external service. They are explicit local or production filesystem roots such as `LWS_KNOWLEDGE_ROOT` and `LWS_DATA_ROOT`, owned and managed by the L.W.S. runtime.

In that sense, L.W.S. can also be viewed as a domain-specific, DBMS-like system for node/edge knowledge. It normalizes knowledge into nodes and edges, preserves changes through event and patch history, and serves query/read models through generated indexes. It is not a general-purpose database engine; it is a wiki-facing knowledge object management system.

The app provides:

- safe access to configured L.W.S. storage roots
- node and edge JSON validation
- rev-based write contracts
- append-only event history
- public/private boundary checks
- SQLite-generated read models for fast browsing, search, graph traversal, timeline views, backlinks, ontology views, and permission-aware reads
- API and UI layers that never touch live storage directly from the browser

The source of truth is JSON object files and event/patch history under the configured storage roots. SQLite is a disposable generated projection. If the index is missing or corrupt, it must be rebuildable from those knowledge files and event history.

## Design Philosophy

### Everything Meaningful Is A Node

L.W.S. uses nodes as the primary way to give meaning to things.

```text
wiki page        -> node
tag              -> node
type             -> node
relation type    -> node
graph view       -> node
timeline view    -> node
account          -> node
permission scope -> node
import source    -> node
event/log entry  -> node-like knowledge
```

This makes the system explainable. A concept is not only a label in code or a database enum. It can have a title, body, aliases, history, permissions, backlinks, temporal context, and relationships to other concepts.

### Edges Connect Nodes, But Relationships Can Also Be Explained

Edges describe relationships between nodes:

```text
app.lws --rel.depends_on--> svc.caddy
account.taewo --rel.owns--> app.lws
tag.backend --rel.classifies--> app.lws
```

An edge is stored as a first-class object because relationships often need their own metadata: summary, evidence, temporal range, visibility, audit fields, history, and permissions. When a relationship becomes important enough to discuss as knowledge, L.W.S. can surface it as node-like material without losing the simple node-to-node graph model.

### First-Class Objects And Supporting Records

In the current implementation, the canonical first-class objects are `node` and `edge`.

A first-class object has stable identity, schema validation, storage, permissions, history, and can participate in relations. `node` and `edge` both meet that bar. An edge is not just a line between nodes; it is a relationship object with its own metadata and history.

Other system records can be node-like in philosophy or UX, but they are not canonical first-class objects unless they are materialized as `node` or `edge` JSON.

```text
first-class objects  -> node, edge
supporting records   -> event log row, patch record, object history link, admin job, validation issue
generated projections -> SQLite objects/graph_edges/timeline_items/object_history rows
frontend/UI state    -> selected object, draft, active tab, graph viewport
```

This keeps the "Everything meaningful is a node" idea without making every log, projection row, or UI state into a stored node.

### Current State And History Are Separate

Current `node` and `edge` JSON files represent the latest state.

History is preserved separately through:

- append-only JSONL event streams
- per-object history links
- patch and inverse patch files
- hashes for integrity checks

L.W.S. does not store full revision snapshots by default. It records what changed and why, then keeps the current object easy to read.

## Repository Boundary

This repository is the app, not the live wiki data store.

Included:

- Next.js App Router application
- TypeScript shared object model
- JSON schemas for node, edge, event, and storage contracts
- storage adapters, validators, services, and API route handlers
- UI routes, mock fixtures, scripts, and docs

Excluded:

- real `knowledge/wiki` node and edge files
- real `data/wiki` event logs, patches, indexes, and SQLite databases
- runtime, log, cache, backup, and secret files
- private knowledge

Local development storage is expected to live outside this repository, normally as a sibling `storage/` directory.

## Local Development

Create a local `.env` from `.env.example`. The default storage paths point outside this repository:

```env
LWS_KNOWLEDGE_ROOT=../storage/knowledge/wiki
LWS_DATA_ROOT=../storage/data/wiki
LWS_RUNTIME_ROOT=../storage/runtime/wiki
LWS_LOG_ROOT=../storage/logs/apps/wiki
LWS_BACKUP_ROOT=../storage/backups/wiki
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`:

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
```

## Initial Implementation Scope

The first implementation prioritizes safety over feature breadth:

- runtime config and path safety
- storage doctor and explicit development storage bootstrap
- node/edge schema validation
- minimal fail-closed permission boundary
- rev-based mutation contract
- event and patch history preservation
- SQLite read model generation
- permission-aware read/query layer
- admin jobs for validation, reindex, backup, and recovery
- mock UI surfaces for exploring the model before live data is created

Out of scope for v1:

- production-grade authentication
- real-time collaborative editing
- graph databases
- vector databases and semantic search
- server-wide git orchestration
- deployment or reverse-proxy automation

## Design Docs

- [Backend Design](./docs/LWS_BACKEND_DESIGN.md)
- [Frontend Design](./docs/LWS_FRONTEND_DESIGN.md)
- [Node Model](./docs/LWS_NODE_MODEL.md)
- [Edge Model](./docs/LWS_EDGE_MODEL.md)
