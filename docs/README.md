# L.W.S. Design Docs

이 폴더는 **L.W.S. - Listro Wiki System**의 구현 전에 합의해야 할 설계 기준을 정리한다.

L.W.S.는 wiki 데이터를 담는 저장소가 아니라, 외부 `knowledge/wiki`와 `data/wiki`에 있는 JSON 기반 `node`/`edge` object를 안전하게 읽고, 수정하고, 연결하고, 검증하고, index로 다루는 app이다.

## 문서 구조

| 문서 | 역할 |
| --- | --- |
| [LWS_BACKEND_DESIGN.md](./LWS_BACKEND_DESIGN.md) | 외부 storage, schema, API, validation, event log, index, permission 설계 |
| [LWS_FRONTEND_DESIGN.md](./LWS_FRONTEND_DESIGN.md) | app shell, 화면 정보 구조, editor workflow, graph/timeline UI, mock UI 기준 |
| [LWS_NODE_MODEL.md](./LWS_NODE_MODEL.md) | node object 의미, required fields, optional fields, validation 기준 |
| [LWS_EDGE_MODEL.md](./LWS_EDGE_MODEL.md) | edge object 의미, required fields, relation boundary, validation 기준 |

## 고정된 설계 기준

1. `Listro_Wiki_System` repo는 **app code only**이다.
2. 실제 node JSON, edge JSON, event log, index, DB, backup, secret은 repo 밖에 둔다.
3. source of truth는 외부 JSON 파일이다.
4. 기본 object kind는 `node`와 `edge`이다.
5. tag, type, relation type, graph view, timeline view, setting도 모두 `node`로 다룬다.
6. 모든 쓰기 작업은 `rev` 기반 optimistic concurrency를 사용한다.
7. 모든 변경은 외부 `data/wiki/events`에 JSONL event log로 남긴다.
8. public object boundary는 backend validation으로 강제한다.
9. 초기 구현은 실제 데이터 생성이 아니라 **안전한 interface와 mock 기반 UI**를 먼저 만든다.

## 권장 기술 기준

```text
Framework:
  Next.js App Router + TypeScript

UI:
  React
  Tailwind CSS
  shadcn/ui style components
  Radix UI primitives

Graph:
  Cytoscape.js for graph explorer
  React Flow for relation editing / node-based editing later

Timeline:
  vis-timeline or equivalent timeline layer

Storage:
  External JSON file storage as source of truth
  SQLite as optional generated index/cache/search DB
```

## 다음 산출물

설계 문서 이후에는 다음 파일을 우선 작성한다.

```text
.env.example
.gitignore
schemas/node.schema.json
schemas/edge.schema.json
schemas/event.schema.json
schemas/storage-contract.schema.json
src/modules/config/*
src/modules/storage/*
src/modules/validation/*
src/app/api/lws/health/route.ts
src/app/api/lws/status/route.ts
```
