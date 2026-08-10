# L.W.S. Design Docs

이 폴더는 **L.W.S. - Listro Wiki System**의 설계 기준과 구현 추적 문서를 모아 둔다.

L.W.S.는 단순한 wiki page editor가 아니라, configured storage root 아래의 JSON `node`/`edge` object를 source of truth로 삼는 graph-first knowledge system이다. SQLite는 source of truth가 아니라 재생성 가능한 read model/projection이며, frontend와 API route는 live storage를 직접 만지지 않는 것이 핵심 경계다.

## Project Snapshot

현재 구현은 backend core contract를 우선으로 진행되었다.

구현된 주요 범위:

- Next.js App Router + TypeScript backend/API skeleton
- runtime env contract, public/secret config 분리, storage root safety
- node/edge JSON schema와 semantic validation
- safe ObjectStore, EventStore, Patch/History model
- rev 기반 mutation과 restore flow
- SQLite generated read model과 reindex
- object/search/graph/backlinks/timeline/ontology API
- projection-backed permission enforcement
- admin validation/reindex/backup/recovery/materialization jobs
- route-level service boundary와 API contract regression tests

아직 제품 기능으로 남은 범위:

- production-grade auth/session/token system
- 실제 사용 가능한 frontend workbench
- async/background job runner
- backup retention/encryption/remote policy
- deployment/runtime operation hardening

## Document Map

| Document | Role |
| --- | --- |
| [LWS_BACKEND_DESIGN.md](./LWS_BACKEND_DESIGN.md) | storage root, schema, API, validation, event log, index, permission, admin/recovery까지 포함한 backend 기준 설계 |
| [LWS_FRONTEND_DESIGN.md](./LWS_FRONTEND_DESIGN.md) | app shell, 화면 정보 구조, editor workflow, graph/timeline UI, thin workbench 방향 |
| [LWS_NODE_MODEL.md](./LWS_NODE_MODEL.md) | node object shape, required/optional fields, node type/tag/ontology validation 기준 |
| [LWS_EDGE_MODEL.md](./LWS_EDGE_MODEL.md) | edge object shape, relation type, source/target boundary, first-class relationship validation 기준 |
| [LWS_PROPS_CONVENTION.md](./LWS_PROPS_CONVENTION.md) | 자유 `props`와 `$value`/`$temporal` Inline temporal wrapper의 공식 convention |
| [LWS_ONTOLOGY_MODEL.md](./LWS_ONTOLOGY_MODEL.md) | 실제 구현 inventory, canonical Group ontology contract, unresolved permission decision과 advisory validation backlog |
| [LWS_GRAPH_READ_POLICY.md](./LWS_GRAPH_READ_POLICY.md) | graph/search 계열 조회에서 readable center, readable edge, unreadable endpoint placeholder를 다루는 정책 |
| [LWS_PRECEDENT_RESEARCH.md](./LWS_PRECEDENT_RESEARCH.md) | node-centered wiki/knowledge system 선례 조사와 L.W.S. 설계 교훈 |
| [LWS_PUBLIC_RELEASE_SECURITY_STRATEGY.md](./LWS_PUBLIC_RELEASE_SECURITY_STRATEGY.md) | repository public release, production access control, step-up private access, zero-day/file-access risk 완화 전략 |
| [reference/LWS_GLOSSARY.md](./reference/LWS_GLOSSARY.md) | source of truth, projection, read model, fail-closed, effective permission 같은 핵심 용어 기준 정의 |
| [implementation/](./implementation/README.md) | 실제 구현 진행 보고서, milestone 상태, API route inventory, 검증 명령 |
| [plans/LWS_ONTOLOGY_SYSTEM_DISCUSSION_AND_PLAN.md](./plans/LWS_ONTOLOGY_SYSTEM_DISCUSSION_AND_PLAN.md) | Node-first Ontology의 design history와 phased implementation plan |
| [plans/LWS_GROUP_ONTOLOGY_MIGRATION_PLAN.md](./plans/LWS_GROUP_ONTOLOGY_MIGRATION_PLAN.md) | Scope/Collection compatibility를 보존하는 Group projection/API/permission migration과 test gate |

## Fixed Design Principles

1. `Listro_Wiki_System` repo는 app code, schema, docs, tests를 담는다.
2. 실제 knowledge/data/runtime/log/backup/secret은 repo 밖 configured storage root에 둔다.
3. Source of truth는 node/edge JSON object와 event/patch/history record다.
4. SQLite는 삭제 후 재생성 가능한 generated read model이다.
5. 기본 object kind는 `node`와 `edge`다.
6. Tag, Type, Relation, Definition, Axiom, Group, graph/timeline view, setting, account는 필요한 경우 first-class Node로 표현할 수 있어야 한다. Legacy permission Scope/Collection은 Group migration의 Compatibility surface다.
7. Edge는 node 사이의 first-class relationship object이며 자체 metadata, validation, history를 가진다.
8. 모든 write는 `rev` 기반 optimistic concurrency를 사용한다.
9. 모든 변경은 event log와 per-object history로 추적한다.
10. Public/private/read/write/admin boundary는 backend service layer에서 fail-closed로 강제한다.
11. Browser/frontend는 `/api/lws/*`만 사용하고 filesystem, SQLite, event log에 직접 접근하지 않는다.

## Recommended Technical Baseline

```text
Framework:
  Next.js App Router + TypeScript

UI:
  React
  Radix UI primitives for accessibility-sensitive controls
  lucide-react for icons
  L.W.S.-owned CSS design system

Graph:
  readonly graph explorer first
  graph library decision after the first usable frontend slice

Timeline:
  readonly timeline explorer first
  timeline library decision after the first usable frontend slice

Storage:
  Configured L.W.S. storage roots
  JSON node/edge object files as source of truth
  JSONL event/history streams
  SQLite generated index/search/read model
```

## Where To Continue

1. Backend 상태를 다시 잡을 때는 [implementation/README.md](./implementation/README.md)에서 구현 보고서 요약을 먼저 본다.
2. Backend v1을 닫으려면 M7 completion gate 문서를 최신 테스트 결과에 맞게 정리한다.
3. 다음 기능 개발은 read-only thin frontend workbench부터 시작하는 것이 가장 자연스럽다.
