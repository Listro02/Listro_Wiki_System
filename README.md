# L.W.S. - Listro Wiki System

아직 대강 개념만 잡고, Wiki DB를 구체적으로 설계하며 개발을 진행하지는 않은 상태입니다.
아래의 내용은 지금까지의 구상과 논의로 AI를 통해 정리해달라고 둔 것이라 정확하지 않을 수 있음을 참고바랍니다.

"모든 것은 node이다."를 기반으로 데이터를 바루는 DBMS를 만드는 것이 목표라고 할 수 있겠습니다.

---

L.W.S. is a graph-first wiki application for managing external JSON knowledge objects. The app repository contains code, schemas, validators, indexes, APIs, UI, scripts, and docs. Real node JSON, edge JSON, event logs, indexes, runtime files, backups, and secrets live outside this repository.

## Repository Boundary

This repository is the app, not the wiki data store.

Included:

- Next.js App Router application
- TypeScript shared object model
- JSON Schemas for node, edge, event, and storage contracts
- storage adapters and validators
- UI routes and mock fixtures
- API route handlers
- operational docs and scripts

Excluded:

- real `knowledge/wiki` node and edge files
- real `data/wiki` event logs and indexes
- real sqlite/search databases
- runtime/log/cache/backup/secret files

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

## First Vertical Slice

The initial implementation provides:

- storage root resolution and path traversal protection
- node/edge/event schemas and TypeScript types
- basic validation and public/private boundary checks
- rev-based object write contract
- JSONL event append contract
- API skeletons for health, status, objects, nodes, edges, graph, timeline, ontology, and admin
- mock workbench UI for Home, Object Explorer, Node Page, Edge Page, Graph, Timeline, Ontology, and Admin

Production authentication, graph databases, vector databases, server-wide git orchestration, and reverse proxy configuration are intentionally out of scope for v1.
