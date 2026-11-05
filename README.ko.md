# [Deprecated] L.W.S. - Listro Wiki System

[English](./README.md) | 한국어

> **Deprecated — 개발 중단**
>
> L.W.S. (Listro Wiki System)의 개발은 중단되었습니다. 후속 개발은 [L.K.S. (Listro Knowledge System)](https://github.com/Listro02/Listro_Knowledge_System)에서 진행합니다.
>
> 이 저장소는 과거 구현과 설계 기록을 참고할 수 있도록 보존합니다. 아래 문서는 개발 중단 당시의 L.W.S.를 설명합니다.

L.W.S.는 하나의 핵심 철학 위에 세우는 graph-first wiki system이다.

> 의미 있는 모든 것은 node이다.

page는 node이다. tag도 node이다. type도 node이다. relation type도 node이다. graph view, timeline view, setting, account, permission, import source, 그리고 system 안에서 발생한 event/log까지도 node로 이해할 수 있다.

구현상으로는 `node`와 `edge` object를 모두 저장한다. edge는 node와 node 사이의 관계를 나타내는 1급 object이다. 하지만 철학의 중심은 node이다. 어떤 것이 고유한 identity, title, 설명, history, evidence, permission, link를 가져야 한다면, L.W.S.는 그것을 숨겨진 metadata가 아니라 node-like knowledge로 다룰 수 있어야 한다.

## L.W.S.란 무엇인가

L.W.S.는 단순한 wiki page editor가 아니다. 지정된 L.W.S. storage root 아래에 있는 JSON knowledge object를 안전하게 다루는 server-backed knowledge graph interface이다.

여기서 storage root는 application repository 밖에 있지만, 불특정 외부 서비스나 임의의 파일 공간을 뜻하지 않는다. `LWS_KNOWLEDGE_ROOT`, `LWS_DATA_ROOT`처럼 env로 명시된 local 또는 production filesystem root이며, L.W.S. runtime이 소유하고 관리하는 데이터 공간이다.

이 관점에서 L.W.S.는 node/edge knowledge를 위한 domain-specific DBMS-like system으로도 볼 수 있다. 지식을 node와 edge로 정규화하고, event/patch history로 변경을 보존하며, generated index로 query/read model을 제공한다. 단, 범용 database engine이 아니라 wiki 형식으로 읽고 쓰는 knowledge object management system이다.

L.W.S.가 제공하는 것은 다음이다.

- 지정된 L.W.S. storage root에 대한 안전한 접근
- node/edge JSON 검증
- rev 기반 쓰기 contract
- append-only event history
- public/private boundary 검증
- 빠른 탐색, search, graph traversal, timeline, backlinks, ontology, permission-aware read를 위한 SQLite generated read model
- browser가 live storage를 직접 만지지 않도록 하는 API/UI 계층

source of truth는 지정된 storage root 아래의 JSON object file과 event/patch history이다. SQLite는 재생성 가능한 projection이다. index가 없거나 손상되어도 이 knowledge file과 event history에서 다시 만들 수 있어야 한다.

## 설계 철학

### 의미 있는 모든 것은 node이다

L.W.S.는 node를 통해 사물에 의미를 부여한다.

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

이 방식은 system을 설명 가능하게 만든다. 어떤 개념이 code 안의 label이나 database enum으로만 남지 않는다. 그 개념은 title, body, alias, history, permission, backlink, temporal context, relation을 가질 수 있다.

### edge는 node를 연결하고, 관계도 설명될 수 있다

edge는 node 사이의 관계를 설명한다.

```text
app.lws --rel.depends_on--> svc.caddy
account.taewo --rel.owns--> app.lws
tag.backend --rel.classifies--> app.lws
```

edge는 1급 object로 저장한다. 관계에도 summary, evidence, temporal range, visibility, audit field, history, permission이 필요할 수 있기 때문이다. 어떤 관계가 지식으로 설명될 만큼 중요해지면, L.W.S.는 단순한 node-to-node graph model을 유지하면서도 그 관계를 node-like material로 드러낼 수 있어야 한다.

### 1급 object와 지원 기록

현재 구현에서 공식적인 1급 object는 `node`와 `edge`이다.

1급 object는 안정적인 identity, schema validation, storage, permission, history를 가지며 relation에 참여할 수 있다. `node`와 `edge`는 이 조건을 모두 만족한다. edge는 node 사이에 그어진 선이 아니라, 자체 metadata와 history를 가진 관계 object이다.

다른 system record도 철학이나 UX 관점에서는 node-like하게 볼 수 있다. 하지만 `node` 또는 `edge` JSON으로 materialize되지 않는 한 공식적인 1급 object는 아니다.

```text
1급 object           -> node, edge
지원 기록            -> event log row, patch record, object history link, admin job, validation issue
생성된 projection     -> SQLite objects/graph_edges/timeline_items/object_history row
frontend/UI state    -> selected object, draft, active tab, graph viewport
```

이 구분은 "의미 있는 모든 것은 node이다"라는 철학을 유지하면서도, 모든 log, projection row, UI state를 저장된 node로 만들지는 않기 위한 경계이다.

### 현재 상태와 history는 분리한다

현재 `node`와 `edge` JSON 파일은 최신 상태를 나타낸다.

history는 별도로 보존한다.

- append-only JSONL event stream
- object별 history link
- patch와 inverse patch file
- integrity check를 위한 hash

L.W.S.는 기본적으로 모든 revision의 full snapshot을 저장하지 않는다. 무엇이 왜 바뀌었는지를 기록하고, 현재 object는 쉽게 읽을 수 있게 유지한다.

## Repository 경계

이 repository는 app이지 live wiki data store가 아니다.

포함하는 것:

- Next.js App Router application
- TypeScript shared object model
- node, edge, event, storage contract용 JSON schema
- storage adapter, validator, service, API route handler
- UI route, mock fixture, script, docs

포함하지 않는 것:

- 실제 `knowledge/wiki` node/edge file
- 실제 `data/wiki` event log, patch, index, SQLite database
- runtime, log, cache, backup, secret file
- private knowledge

local development storage는 이 repository 밖에 둔다. 일반적으로 sibling `storage/` directory를 사용한다.

## Local Development

`.env.example`에서 local `.env`를 만든다. 기본 storage path는 repository 밖을 가리킨다.

```env
LWS_KNOWLEDGE_ROOT=../storage/knowledge/wiki
LWS_DATA_ROOT=../storage/data/wiki
LWS_RUNTIME_ROOT=../storage/runtime/wiki
LWS_LOG_ROOT=../storage/logs/apps/wiki
LWS_BACKUP_ROOT=../storage/backups/wiki
```

Windows PowerShell에서 script execution policy 때문에 `npm.ps1`이 막히면 `npm.cmd`를 사용한다.

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
```

## 초기 구현 범위

초기 구현은 기능 폭보다 안전을 우선한다.

- runtime config와 path safety
- storage doctor와 명시적 development storage bootstrap
- node/edge schema validation
- minimal fail-closed permission boundary
- rev 기반 mutation contract
- event/patch history 보존
- SQLite read model 생성
- permission-aware read/query layer
- validation, reindex, backup, recovery를 위한 admin job
- live data 생성 전에 model을 탐색하기 위한 mock UI

v1 범위 밖:

- production-grade authentication
- real-time collaborative editing
- graph database
- vector database와 semantic search
- server-wide git orchestration
- deployment 또는 reverse-proxy automation

## 설계 문서

- [Backend Design](./docs/LWS_BACKEND_DESIGN.md)
- [Frontend Design](./docs/LWS_FRONTEND_DESIGN.md)
- [Node Model](./docs/LWS_NODE_MODEL.md)
- [Edge Model](./docs/LWS_EDGE_MODEL.md)
