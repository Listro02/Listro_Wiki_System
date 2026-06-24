# L.W.S. Backend Design

## 1. 목적

L.W.S. backend는 외부 JSON 기반 knowledge graph를 안전하게 다루기 위한 server-side layer이다.

backend가 책임지는 것은 다음이다.

```text
1. env로 지정된 외부 storage root를 해석한다.
2. storage root 밖 파일 접근을 차단한다.
3. node/edge JSON을 읽고 검증한다.
4. rev 기반 쓰기 contract를 제공한다.
5. 모든 변경을 event log로 기록한다.
6. graph, timeline, backlinks, ontology, search용 read model을 생성한다.
7. public/private boundary와 permission rule을 검증한다.
8. frontend가 사용할 API surface를 제공한다.
```

backend는 실제 운영 데이터를 repo 안에 만들거나 보관하지 않는다.

## 2. App과 data의 경계

```text
Repo:
  L.W.S/Listro_Wiki_System

Repo에 포함:
  app code
  schema
  validator
  storage adapter
  indexer
  API route
  UI code
  docs
  scripts
  mock fixture
  .env.example

Repo에 포함하지 않음:
  실제 node JSON
  실제 edge JSON
  실제 event log
  실제 generated index
  실제 SQLite DB
  실제 private knowledge
  실제 backup
  실제 secret
  runtime log/cache
```

local development storage는 repo 바깥의 sibling directory를 사용한다.

```text
L.W.S/
├─ Listro_Wiki_System/
└─ storage/
   ├─ knowledge/wiki/
   │  ├─ nodes/
   │  ├─ edges/
   │  ├─ assets/
   │  ├─ imports/
   │  └─ schemas/
   ├─ data/wiki/
   │  ├─ events/
   │  ├─ index/
   │  ├─ db/
   │  ├─ cache/
   │  ├─ history/
   │  └─ exports/
   ├─ runtime/wiki/
   ├─ logs/apps/wiki/
   ├─ backups/wiki/
   └─ secrets/wiki/
```

production storage는 `C:\Server` 아래를 기준으로 한다.

```text
C:\Server\apps\wiki
C:\Server\knowledge\wiki
C:\Server\data\wiki
C:\Server\runtime\wiki
C:\Server\logs\apps\wiki
C:\Server\backups\wiki
C:\Server\secrets\wiki
```

## 3. 환경변수 contract

`.env.example`의 기본값은 local development 기준으로 둔다.

```env
LWS_APP_NAME=Listro Wiki System
LWS_ENV=development

LWS_HOST=127.0.0.1
LWS_PORT=3000

LWS_KNOWLEDGE_ROOT=../storage/knowledge/wiki
LWS_DATA_ROOT=../storage/data/wiki
LWS_RUNTIME_ROOT=../storage/runtime/wiki
LWS_LOG_ROOT=../storage/logs/apps/wiki
LWS_BACKUP_ROOT=../storage/backups/wiki

LWS_AUTH_MODE=local
LWS_SESSION_SECRET=change-me
LWS_ADMIN_BOOTSTRAP_USER=admin

LWS_DEFAULT_VISIBILITY=private
LWS_PUBLIC_GRAPH_ENABLED=false
LWS_ALLOW_STORAGE_INIT=false
LWS_ALLOW_SAMPLE_DATA=false

LWS_INDEX_MODE=json
LWS_SQLITE_ENABLED=true
LWS_SQLITE_PATH=../storage/data/wiki/db/lws.sqlite

LWS_AUTOSAVE_INTERVAL_MS=1000
```

runtime에서는 config loader가 다음을 수행한다.

```text
1. 필수 env 누락 여부 검사
2. 상대 경로를 app root 기준 absolute path로 해석
3. Windows path와 POSIX separator를 정규화
4. storage root별 read/write 가능 여부 검사
5. dangerous value 차단
6. frontend에 노출 가능한 config와 secret config 분리
```

### 3.1 변수별 의미

| 변수 | 의미 | 노출 범위 |
| --- | --- | --- |
| `LWS_APP_NAME` | app 표시 이름이다. UI title, health/status 응답, log prefix 등에 사용한다. | frontend 노출 가능 |
| `LWS_ENV` | 실행 환경이다. `development`, `production`, `test` 같은 값을 사용한다. storage init 허용 여부, log level, error detail 노출 정책에 영향을 준다. | frontend에는 제한적으로 노출 |
| `LWS_HOST` | Next.js/Node server가 bind할 host이다. local 기본값은 `127.0.0.1`이며, reverse proxy 뒤에서 실행하는 것을 전제로 한다. | frontend 노출 불필요 |
| `LWS_PORT` | app server port이다. local 기본값은 `3000`이다. | frontend 노출 불필요 |
| `LWS_KNOWLEDGE_ROOT` | source of truth가 되는 knowledge root이다. `nodes`, `edges`, `assets`, `imports`, `schemas` 같은 하위 폴더를 가진다. node/edge JSON의 실제 파일은 이 root 아래에서만 읽고 쓴다. | secret은 아니지만 frontend에 absolute path를 노출하지 않는다 |
| `LWS_DATA_ROOT` | generated data root이다. event log, index, SQLite DB, cache, history, export 결과가 이 root 아래에 위치한다. source of truth가 아니라 app이 재생성 가능한 read model과 운영 데이터를 둔다. | secret은 아니지만 frontend에 absolute path를 노출하지 않는다 |
| `LWS_RUNTIME_ROOT` | app 실행 중 필요한 임시 runtime state를 둔다. lock file, job state, transient status, PID-like metadata 같은 장기 보존 대상이 아닌 파일이 들어간다. | backend only |
| `LWS_LOG_ROOT` | app 운영 log를 저장하는 root이다. request log, validation run log, indexing log, error log를 둘 수 있다. | backend only |
| `LWS_BACKUP_ROOT` | backup output root이다. object snapshot, event log snapshot, index snapshot을 만들 때 사용한다. 초기 구현에서는 backup action을 mock 또는 disabled로 둘 수 있다. | backend only |
| `LWS_AUTH_MODE` | 인증 방식 선택값이다. 초기값 `local`은 단일 사용자 또는 trusted local operator를 가정한다. production auth는 v1 초기 범위 밖이지만, service layer는 actor/role을 받도록 설계한다. | frontend에는 auth 상태만 노출 |
| `LWS_SESSION_SECRET` | session signing/encryption에 사용할 secret이다. `change-me`는 개발용 placeholder이며 production에서는 반드시 강한 값으로 바꾼다. | 절대 노출 금지 |
| `LWS_ADMIN_BOOTSTRAP_USER` | 초기 admin actor id이다. 아직 사용자 관리가 없을 때 admin action의 기본 actor로 사용한다. 예: `admin` 또는 `user.admin`. | backend only |
| `LWS_DEFAULT_VISIBILITY` | 새 node/edge의 기본 공개 범위이다. 안전 기본값은 `private`이다. | frontend 노출 가능 |
| `LWS_PUBLIC_GRAPH_ENABLED` | public graph/read model을 만들거나 노출할지 결정한다. `false`이면 public index 생성과 public graph API 노출을 막거나 disabled 상태로 둔다. | frontend 노출 가능 |
| `LWS_ALLOW_STORAGE_INIT` | storage root와 하위 폴더 자동 생성을 허용할지 결정한다. production에서는 기본적으로 `false`를 권장한다. | backend only |
| `LWS_ALLOW_SAMPLE_DATA` | mock/sample object를 실제 storage에 생성하는 것을 허용할지 결정한다. 기본값은 `false`이며, UI demo는 in-component mock data를 사용한다. | backend only |
| `LWS_INDEX_MODE` | index 저장 방식을 선택한다. 초기값 `json`은 `data/wiki/index/*.json` 기반 read model을 뜻한다. 나중에 `sqlite` 같은 mode를 추가할 수 있다. | frontend에는 index status만 노출 |
| `LWS_SQLITE_ENABLED` | SQLite 기반 cache/search/index DB 사용 여부이다. 초기 구현에서는 JSON index만으로 시작하고, 검색이나 대량 조회가 필요할 때 활성화한다. | backend only |
| `LWS_SQLITE_PATH` | SQLite file path이다. `LWS_SQLITE_ENABLED=true`일 때만 사용한다. 반드시 `LWS_DATA_ROOT` 내부 또는 명시적으로 허용된 DB 경로여야 한다. | backend only |
| `LWS_AUTOSAVE_INTERVAL_MS` | frontend editor autosave debounce/interval의 기본값이다. backend는 이 값을 public config로 내려줄 수 있지만, 실제 저장 요청에는 항상 `base_rev` conflict check를 적용한다. | frontend 노출 가능 |

### 3.2 config loader가 막아야 하는 값

`dangerous value`는 다음을 포함한다.

```text
empty required value
storage root outside allowed policy
storage root inside app repo when live data mode is used
path traversal segment
absolute path injection in object id
Windows drive letter injection in object id
UNC/network path unless explicitly allowed
SQLite path outside data root
production session secret left as "change-me"
public graph enabled without public boundary validator
```

config loader는 안전한 값을 만든 뒤 두 종류의 config로 나눈다.

```text
RuntimeConfig:
  backend only. absolute storage path, secret, write policy 포함.

PublicConfig:
  frontend에 내려줄 수 있는 값. app name, env label, default visibility,
  autosave interval, feature flag 같은 비밀이 아닌 값만 포함.
```

## 4. Backend system 구조

L.W.S. backend는 단순한 API route 모음이 아니다. 기본적인 세부 기능을 책임별 module로 만들고, application service가 그 module들을 조합해서 node/edge 작업 pipeline을 실행하는 구조로 설계한다.

### 4.1 핵심 용어

```text
Module:
  특정 책임을 가진 내부 기능 단위이다.
  예: config, storage, validation, permissions, events, indexing, audit.

Service:
  여러 module을 조합해 하나의 실제 작업 흐름을 완성하는 application layer이다.
  예: NodeService.saveNode, EdgeService.createEdge, AdminService.reindex.

Pipeline:
  service가 실행하는 단계적 처리 흐름이다.
  예: 권한 확인 -> rev 확인 -> validation -> 저장 -> event 기록 -> index 갱신.

API route:
  frontend와 external integration이 service/pipeline을 HTTP로 호출하는 adapter이다.

Store/Repository:
  JSON file, JSONL event, generated index, optional SQLite 같은 persistence detail을 담당한다.
```

여기서 `module`은 별도 서버나 plugin을 뜻하지 않는다. TypeScript 코드 안에서 책임을 기준으로 나눈 내부 부품이다. `service`는 그 부품들을 조립해서 L.W.S.의 실제 use case를 수행하는 계층이다.

### 4.2 핵심 방향성

```text
1. source of truth는 외부 JSON storage이다.
2. backend system은 node/edge object를 다루는 중심 체계이다.
3. module은 validation, storage, event, index 같은 세부 책임을 맡는다.
4. service는 module을 조합해 backend pipeline을 실행한다.
5. API route는 service(backend pipeline)를 호출하는 HTTP interface이다.
6. frontend browser code는 filesystem을 직접 만지지 않고 API를 통해 backend system을 사용한다.
7. Next.js server-side code, scripts, future CLI는 같은 service를 직접 호출할 수 있다.
8. 어떤 진입점이든 write/read rule은 반드시 service layer를 통과한다.
```

즉 L.W.S.는 "frontend가 API만 호출하는 얇은 app"이 아니다. node와 edge 형식으로 존재하는 외부 데이터를 안전하게 다루는 **backend system**이 먼저 있고, API는 그 backend system을 frontend와 외부 integration에 열어주는 접근 방식이다.

### 4.3 권장 호출 흐름

브라우저 frontend는 HTTP API를 통해 backend system에 접근한다.

```text
Browser Frontend
  -> /api/lws/*
  -> API route
  -> Application Service
  -> Modules
  -> Store/Repository
  -> External storage
```

서버 내부 코드나 script는 HTTP를 다시 거치지 않고 service를 직접 호출할 수 있다.

```text
Server-side page / script / future CLI
  -> Application Service
  -> Modules
  -> Store/Repository
  -> External storage
```

하지만 두 흐름 모두 같은 service와 module을 사용해야 한다. API route만 우회하지 않으면 된다는 뜻이 아니라, **service layer를 우회하지 않는 것**이 핵심 규칙이다.

### 4.4 Node 저장 pipeline 예시

```text
Frontend Node Editor
  -> PUT /api/lws/nodes/:id
  -> API route parses request and actor context
  -> NodeService.saveNode(command, context)
  -> PermissionModule checks write permission
  -> ObjectStore reads current node
  -> RevisionModule checks base_rev
  -> ValidationModule validates node schema
  -> BoundaryModule checks public/private rules
  -> ObjectStore writes JSON under LWS_KNOWLEDGE_ROOT
  -> EventModule appends JSONL under LWS_DATA_ROOT/events
  -> IndexingModule marks graph/timeline/search index stale or rebuilds
  -> API route returns updated node and next rev
```

### 4.5 Edge 생성 pipeline 예시

```text
Frontend Relation Editor
  -> POST /api/lws/edges
  -> API route parses request and actor context
  -> EdgeService.createEdge(command, context)
  -> PermissionModule checks relation write permission
  -> NodeService verifies source node
  -> NodeService verifies target node or creates stub target when requested
  -> OntologyModule verifies relation type
  -> ValidationModule validates edge schema
  -> BoundaryModule blocks public edge if source or target is private
  -> ObjectStore writes edge JSON under LWS_KNOWLEDGE_ROOT
  -> EventModule appends edge.created event
  -> IndexingModule marks graph/backlinks/timeline index stale
  -> API route returns created edge
```

### 4.6 External API import pipeline 예시

향후 외부 API 호출로 데이터를 가져오는 기능이 생겨도 같은 원칙을 따른다.

```text
External API import
  -> ImportService.importFromSource(command, context)
  -> IngestionModule fetches or receives external payload
  -> NormalizerModule converts payload to node/edge drafts
  -> ValidationModule checks schema and semantic rules
  -> BoundaryModule checks visibility rules
  -> ObjectStore writes node/edge JSON under LWS_KNOWLEDGE_ROOT
  -> EventModule appends import events
  -> IndexingModule refreshes read models
  -> frontend displays imported objects through backend API
```

### 4.7 Layer별 책임

```text
API route:
  HTTP request/response, auth context, parameter parsing 담당.
  backend system으로 들어오는 adapter 역할을 한다.
  filesystem, event log, index file을 직접 만지지 않는다.

Application service:
  user/system use case를 실행한다.
  여러 module을 조합해 pipeline을 구성한다.
  permission, rev, validation, event, index 순서를 통제한다.

Module:
  특정 세부 책임을 수행한다.
  재사용 가능한 작은 기능 단위로 유지한다.

Store/Repository:
  persistence detail을 담당한다.
  path resolver를 통해 안전한 파일 접근만 수행한다.
```

이렇게 하면 같은 backend system을 HTTP API뿐 아니라 server-side render, script, test, future CLI에서도 재사용할 수 있다.

### 4.8 권장 source layout

```text
src/
├─ app/
│  └─ api/
│     └─ lws/
│        └─ ...
├─ services/
│  ├─ object-service.ts
│  ├─ node-service.ts
│  ├─ edge-service.ts
│  ├─ graph-service.ts
│  ├─ timeline-service.ts
│  ├─ ontology-service.ts
│  ├─ admin-service.ts
│  └─ import-service.ts
├─ modules/
│  ├─ config/
│  │  ├─ env.ts
│  │  ├─ runtime-config.ts
│  │  └─ public-config.ts
│  ├─ storage/
│  │  ├─ path-resolver.ts
│  │  ├─ object-store.ts
│  │  ├─ event-store.ts
│  │  ├─ index-store.ts
│  │  └─ storage-doctor.ts
│  ├─ validation/
│  │  ├─ schema-validator.ts
│  │  ├─ semantic-validator.ts
│  │  └─ boundary-validator.ts
│  ├─ permissions/
│  │  ├─ roles.ts
│  │  └─ permission-checker.ts
│  ├─ events/
│  │  ├─ event-types.ts
│  │  └─ event-writer.ts
│  ├─ indexing/
│  │  ├─ graph-indexer.ts
│  │  ├─ timeline-indexer.ts
│  │  ├─ backlinks-indexer.ts
│  │  └─ ontology-indexer.ts
│  ├─ ontology/
│  │  ├─ ontology-rules.ts
│  │  └─ relation-rules.ts
│  ├─ import/
│  │  ├─ ingestion.ts
│  │  └─ normalizer.ts
│  └─ audit/
│     └─ audit-metadata.ts
└─ shared/
   ├─ ids.ts
   ├─ types.ts
   ├─ errors.ts
   └─ date.ts
```

초기 구현은 module과 service를 작게 시작한다. 다만 API route, frontend, script가 storage를 직접 만지는 구조는 피하고, 모든 의미 있는 작업은 service pipeline을 거치도록 한다.

## 5. Object model

L.W.S.의 source object는 두 종류이다.

```text
node:
  지식 대상, wiki page, tag, type, relation type, view, setting 등

edge:
  node와 node 사이의 관계
```

상세한 field-level model은 다음 문서를 기준으로 한다.

```text
Node model:
  docs/LWS_NODE_MODEL.md

Edge model:
  docs/LWS_EDGE_MODEL.md
```

- [LWS_NODE_MODEL.md](./LWS_NODE_MODEL.md): node의 의미, required fields, optional fields, validation notes
- [LWS_EDGE_MODEL.md](./LWS_EDGE_MODEL.md): edge의 의미, required fields, optional fields, public boundary rule, validation notes

### 5.1 Node required fields 요약

```json
{
  "schema_version": 1,
  "object_kind": "node",
  "id": "svc.caddy",
  "rev": 1,
  "title": "Caddy",
  "slug": "caddy",
  "type": "type.service",
  "detail_mode": "page",
  "visibility": "private",
  "status": "active",
  "tags": [],
  "props": {},
  "temporal": {
    "occurred_at": null,
    "valid_from": null,
    "valid_to": null
  },
  "audit": {
    "created_at": "2026-06-23T00:00:00+09:00",
    "updated_at": "2026-06-23T00:00:00+09:00",
    "created_by": "user.admin",
    "updated_by": "user.admin"
  }
}
```

필드별 상세 설명은 [LWS_NODE_MODEL.md](./LWS_NODE_MODEL.md)를 따른다.

### 5.2 Edge required fields 요약

```json
{
  "schema_version": 1,
  "object_kind": "edge",
  "id": "edge.app-lws.depends-on.svc-caddy",
  "rev": 1,
  "source": "app.lws",
  "target": "svc.caddy",
  "type": "rel.depends_on",
  "title": "L.W.S. depends on Caddy",
  "detail_mode": "note",
  "visibility": "private",
  "status": "active",
  "tags": [],
  "props": {},
  "temporal": {
    "occurred_at": null,
    "valid_from": null,
    "valid_to": null
  },
  "audit": {
    "created_at": "2026-06-23T00:00:00+09:00",
    "updated_at": "2026-06-23T00:00:00+09:00",
    "created_by": "user.admin",
    "updated_by": "user.admin"
  }
}
```

필드별 상세 설명은 [LWS_EDGE_MODEL.md](./LWS_EDGE_MODEL.md)를 따른다.

## 6. Storage design

### 6.1 Path resolver

`PathResolver`는 backend safety의 핵심이다.

필수 규칙:

```text
1. object id를 그대로 filesystem path로 쓰지 않는다.
2. object id는 안전한 filename으로 변환한다.
3. resolved path가 지정 root 내부인지 확인한다.
4. `..`, absolute path injection, drive letter injection을 차단한다.
5. symlink가 root 밖으로 나가는 경우를 차단한다.
6. read/write root를 명시적으로 구분한다.
```

예상 API:

```ts
resolveNodePath(id: string): SafePath
resolveEdgePath(id: string): SafePath
resolveEventLogPath(date: string): SafePath
resolveIndexPath(name: string): SafePath
assertInsideRoot(root: string, candidate: string): void
```

### 6.2 ObjectStore

`ObjectStore`는 node/edge source JSON을 다룬다.

책임:

```text
list objects
read object by id
create object
update object with base_rev
soft delete object
restore object
validate object before write
write atomically when possible
```

쓰기 규칙:

```text
1. current object를 읽는다.
2. request의 base_rev와 current rev를 비교한다.
3. 불일치하면 409 conflict를 반환한다.
4. patch 또는 full replacement를 validate한다.
5. rev를 +1 한다.
6. audit.updated_at / audit.updated_by를 갱신한다.
7. 임시 파일에 쓴 뒤 atomic rename을 시도한다.
8. event log append를 수행한다.
9. index refresh job을 enqueue하거나 stale flag를 남긴다.
```

### 6.3 EventStore

모든 mutation은 JSONL event로 기록한다.

권장 위치:

```text
data/wiki/events/YYYY-MM-DD.jsonl
```

event shape:

```json
{
  "schema_version": 1,
  "event_id": "evt_20260624_000001",
  "event_type": "object.updated",
  "object_kind": "node",
  "object_id": "svc.caddy",
  "base_rev": 1,
  "next_rev": 2,
  "actor": "user.admin",
  "occurred_at": "2026-06-24T18:00:00+09:00",
  "summary": "Updated node summary",
  "changes": {}
}
```

초기에는 full diff 대신 `summary`, `base_rev`, `next_rev`, `changed_fields`만 저장해도 된다.

### 6.4 IndexStore

index는 generated read model이다. source of truth가 아니다.

권장 index:

```text
data/wiki/index/objects.json
data/wiki/index/nodes.json
data/wiki/index/edges.json
data/wiki/index/graph.json
data/wiki/index/timeline.json
data/wiki/index/backlinks.json
data/wiki/index/ontology.json
data/wiki/index/search.json
data/wiki/index/public-graph.json
```

초기 구현은 JSON index로 충분하다. SQLite는 search/cache 최적화 단계에서 추가한다.

## 7. Validation rules

validation은 세 단계로 나눈다.

```text
schema validation:
  JSON shape, required fields, enum, type 검사

semantic validation:
  id uniqueness, edge source/target existence, type/tag/relation reference 검사

boundary validation:
  visibility, permission, public graph leakage, storage root 접근 검사
```

필수 rule:

```text
node.object_kind must be "node"
edge.object_kind must be "edge"
id must be stable and globally unique
rev must be positive integer
tags must be node ids of type tag or virtual tag
node.type must reference a type node or built-in virtual type
edge.type must reference a relation type node or built-in virtual relation
edge.source must reference an existing node unless creating a stub in same transaction
edge.target must reference an existing node unless creating a stub in same transaction
public edge requires public source and public target
deleted object is hidden from default queries
archived object is hidden unless explicitly included
```

## 8. Permission model

초기 role:

```text
viewer:
  read private objects allowed by deployment context

editor:
  create/update node and edge

curator:
  merge tags, manage ontology, restore deleted objects

architect:
  manage schemas, storage contract, index behavior

admin:
  run admin actions, manage roles, materialize core ontology
```

초기 app은 production auth를 완성하지 않는다. 단, service layer의 모든 mutation은 `actor`와 `role`을 받는 형태로 설계한다.

```ts
type RequestContext = {
  actorId: string
  roles: LwsRole[]
  requestId: string
}
```

## 9. API design

Route prefix:

```text
/api/lws
```

### 9.1 Health and status

```text
GET /api/lws/health
GET /api/lws/status
GET /api/lws/admin/storage
```

`health`는 app process 상태만 반환한다. `status`는 storage/index 상태를 포함한다.

### 9.2 Object API

```text
GET    /api/lws/objects
GET    /api/lws/objects/:id
GET    /api/lws/nodes
POST   /api/lws/nodes
GET    /api/lws/nodes/:id
PUT    /api/lws/nodes/:id
DELETE /api/lws/nodes/:id
POST   /api/lws/nodes/:id/restore
GET    /api/lws/edges
POST   /api/lws/edges
GET    /api/lws/edges/:id
PUT    /api/lws/edges/:id
DELETE /api/lws/edges/:id
POST   /api/lws/edges/:id/restore
```

mutation request는 `base_rev`를 포함한다.

```json
{
  "base_rev": 3,
  "object": {}
}
```

conflict response:

```json
{
  "error": {
    "code": "REV_CONFLICT",
    "message": "Object was changed by another write.",
    "current_rev": 4
  }
}
```

### 9.3 Read model API

```text
GET /api/lws/graph
GET /api/lws/graph/:viewId
GET /api/lws/timeline
GET /api/lws/timeline/:viewId
GET /api/lws/ontology
GET /api/lws/search?q=
```

### 9.4 Admin API

```text
POST /api/lws/admin/validate
POST /api/lws/admin/reindex
POST /api/lws/admin/materialize-core-ontology
POST /api/lws/admin/backup
POST /api/lws/admin/check-public-boundary
```

admin API는 초기 UI에서는 mock 또는 disabled state로 둘 수 있다.

## 10. Error model

권장 error code:

```text
CONFIG_INVALID
STORAGE_ROOT_MISSING
PATH_OUTSIDE_ROOT
OBJECT_NOT_FOUND
OBJECT_ALREADY_EXISTS
SCHEMA_INVALID
SEMANTIC_INVALID
PUBLIC_BOUNDARY_VIOLATION
PERMISSION_DENIED
REV_CONFLICT
EVENT_APPEND_FAILED
INDEX_STALE
INTERNAL_ERROR
```

API error response:

```json
{
  "error": {
    "code": "SCHEMA_INVALID",
    "message": "Node schema validation failed.",
    "details": []
  }
}
```

## 11. Indexing model

초기 indexing은 sync command 또는 API action으로 시작한다.

```text
1. list all node files
2. list all edge files
3. validate each object
4. build object summary index
5. build graph adjacency index
6. build backlinks index
7. build timeline index from temporal and audit fields
8. build ontology index from tag/type/relation nodes
9. build public graph index after public boundary validation
10. write index metadata
```

index metadata:

```json
{
  "schema_version": 1,
  "index_name": "graph",
  "built_at": "2026-06-24T18:00:00+09:00",
  "object_count": 120,
  "warning_count": 2,
  "source_rev": "event-log-offset-or-hash"
}
```

## 12. Backend implementation milestones

### Phase 1 - Contract skeleton

```text
config loader
path resolver
storage doctor
node schema
edge schema
health/status API
mock object API response
```

### Phase 2 - Safe read/write

```text
ObjectStore read/list
rev conflict check
create/update/delete/restore
event append
basic validation report
```

### Phase 3 - Read models

```text
graph index
timeline index
backlinks index
ontology index
search index stub
admin reindex action
```

### Phase 4 - Hardening

```text
permission enforcement
public boundary checker
backup action
schema migration plan
SQLite optional cache
```

## 13. Backend non-goals for initial implementation

```text
real production authentication
graph database
vector database
server-wide git management
Cloudflare/Caddy automation
real sample content generation
storing live knowledge inside repo
```
