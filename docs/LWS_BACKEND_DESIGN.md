# L.W.S. Backend Design

## 1. 목적

L.W.S. backend는 지정된 L.W.S. storage root 아래의 JSON 기반 knowledge graph를 안전하게 다루기 위한 server-side layer이다.

여기서 storage root는 application repo 밖에 있지만, 불특정 외부 서비스나 임의의 파일 공간을 뜻하지 않는다. `LWS_KNOWLEDGE_ROOT`, `LWS_DATA_ROOT`처럼 env로 명시된 local/production filesystem root이며, L.W.S. runtime이 소유하고 관리하는 데이터 공간이다.

따라서 L.W.S.는 wiki처럼 읽고 쓰는 node/edge knowledge object management system이며, 특정 domain의 지식 데이터를 관리하는 DBMS-like backend로도 볼 수 있다. 다만 source of truth는 범용 DB 파일이 아니라 storage root 아래의 JSON object file과 event/patch history이고, SQLite는 재생성 가능한 read model이다.

backend가 책임지는 것은 다음이다.

```text
1. env로 지정된 L.W.S. storage root를 해석한다.
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
LWS_ADMIN_BOOTSTRAP_ACCOUNT=account.admin

LWS_DEFAULT_VISIBILITY=private
LWS_PUBLIC_GRAPH_ENABLED=false
LWS_ALLOW_STORAGE_INIT=false
LWS_ALLOW_SAMPLE_DATA=false

LWS_INDEX_MODE=sqlite
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
| `LWS_AUTH_MODE` | 인증 방식 선택값이다. 초기값 `local`은 단일 사용자 또는 trusted local operator를 가정한다. production auth는 v1 초기 범위 밖이지만, service layer는 account/capability를 받도록 설계한다. | frontend에는 auth 상태만 노출 |
| `LWS_SESSION_SECRET` | session signing/encryption에 사용할 secret이다. `change-me`는 개발용 placeholder이며 production에서는 반드시 강한 값으로 바꾼다. | 절대 노출 금지 |
| `LWS_ADMIN_BOOTSTRAP_ACCOUNT` | 초기 admin account id이다. 아직 계정 관리가 없을 때 admin action의 기본 account로 사용한다. 예: `account.admin`. | backend only |
| `LWS_DEFAULT_VISIBILITY` | 새 node/edge의 기본 공개 범위이다. 안전 기본값은 `private`이다. | frontend 노출 가능 |
| `LWS_PUBLIC_GRAPH_ENABLED` | public graph/read model을 만들거나 노출할지 결정한다. `false`이면 public index 생성과 public graph API 노출을 막거나 disabled 상태로 둔다. | frontend 노출 가능 |
| `LWS_ALLOW_STORAGE_INIT` | storage root와 하위 폴더 자동 생성을 허용할지 결정한다. production에서는 기본적으로 `false`를 권장한다. | backend only |
| `LWS_ALLOW_SAMPLE_DATA` | mock/sample object를 실제 storage에 생성하는 것을 허용할지 결정한다. 기본값은 `false`이며, UI demo는 in-component mock data를 사용한다. | backend only |
| `LWS_INDEX_MODE` | index 저장 방식을 선택한다. 기본값 `sqlite`는 `data/wiki/db/lws.sqlite` 기반 generated read model을 뜻한다. | frontend에는 index status만 노출 |
| `LWS_SQLITE_ENABLED` | SQLite 기반 generated index 사용 여부이다. L.W.S.의 기본 빠른 조회 계층이므로 development/production에서는 `true`를 권장한다. | backend only |
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
  JSON file, JSONL event, generated SQLite index 같은 persistence detail을 담당한다.
```

여기서 `module`은 별도 서버나 plugin을 뜻하지 않는다. TypeScript 코드 안에서 책임을 기준으로 나눈 내부 부품이다. `service`는 그 부품들을 조립해서 L.W.S.의 실제 use case를 수행하는 계층이다.

### 4.2 핵심 방향성

```text
1. source of truth는 지정된 L.W.S. storage root 아래의 JSON object storage이다.
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
  -> PATCH /api/lws/nodes/:id
  -> API route parses request and account context
  -> NodeService.saveNode(command, context)
  -> PermissionService.assertCanUpdate(context, nodeId)
  -> ObjectStore reads current node
  -> RevisionModule checks base_rev
  -> PatchModule applies patch and generates inverse_patch
  -> ValidationModule validates node schema
  -> BoundaryModule checks public/private rules
  -> ObjectStore writes JSON under LWS_KNOWLEDGE_ROOT
  -> EventModule appends global event and per-object history link
  -> IndexingModule updates affected projections or marks INDEX_STALE
  -> API route returns updated node, next rev, and event id
```

### 4.5 Edge 생성 pipeline 예시

```text
Frontend Relation Editor
  -> POST /api/lws/edges
  -> API route parses request and account context
  -> EdgeService.createEdge(command, context)
  -> PermissionService.assertCanCreateIn(context, target scope or collection, "edge")
  -> NodeService verifies source node
  -> NodeService verifies target node or creates stub target when requested
  -> OntologyModule verifies relation type
  -> ValidationModule validates edge schema
  -> BoundaryModule blocks public edge if source or target is private
  -> ObjectStore writes edge JSON under LWS_KNOWLEDGE_ROOT
  -> EventModule appends edge.created event
  -> IndexingModule updates graph/backlinks/timeline projections or marks INDEX_STALE
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
│  ├─ object-query-service.ts
│  ├─ node-service.ts
│  ├─ edge-service.ts
│  ├─ history-service.ts
│  ├─ graph-service.ts
│  ├─ timeline-service.ts
│  ├─ ontology-service.ts
│  ├─ search-service.ts
│  ├─ permission-service.ts
│  ├─ session-service.ts
│  ├─ admin-service.ts
│  ├─ job-service.ts
│  ├─ status-service.ts
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
│  ├─ patch/
│  │  ├─ patch-engine.ts
│  │  ├─ inverse-patch.ts
│  │  └─ changed-fields.ts
│  ├─ revision/
│  │  └─ revision-checker.ts
│  ├─ hashing/
│  │  ├─ canonical-json.ts
│  │  └─ object-hash.ts
│  ├─ validation/
│  │  ├─ schema-validator.ts
│  │  ├─ semantic-validator.ts
│  │  └─ boundary-validator.ts
│  ├─ permissions/
│  │  ├─ capabilities.ts
│  │  ├─ permission-checker.ts
│  │  └─ permission-projection.ts
│  ├─ events/
│  │  ├─ event-types.ts
│  │  ├─ event-writer.ts
│  │  ├─ history-writer.ts
│  │  └─ event-reader.ts
│  ├─ indexing/
│  │  ├─ sqlite-schema.ts
│  │  ├─ index-metadata.ts
│  │  ├─ object-indexer.ts
│  │  ├─ graph-indexer.ts
│  │  ├─ timeline-indexer.ts
│  │  ├─ backlinks-indexer.ts
│  │  ├─ ontology-indexer.ts
│  │  ├─ search-indexer.ts
│  │  └─ permission-indexer.ts
│  ├─ query/
│  │  ├─ object-query.ts
│  │  ├─ cursor.ts
│  │  └─ permission-aware-query.ts
│  ├─ jobs/
│  │  ├─ job-store.ts
│  │  ├─ job-runner.ts
│  │  └─ job-types.ts
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
    "created_by": "account.admin",
    "updated_by": "account.admin"
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
    "created_by": "account.admin",
    "updated_by": "account.admin"
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

모든 mutation은 JSONL event로 기록한다. L.W.S.는 wiki이므로 "현재 상태"뿐 아니라 "무슨 일이 있었는가"도 보존 대상이다.

철학적으로 event/log도 node-like object로 본다. 즉 `node.updated`, `edge.created`, `ontology.changed` 같은 사건도 wiki 안에서 설명하고 연결할 수 있는 지식이다. 다만 저장 구현에서는 모든 event를 즉시 개별 node JSON 파일로 materialize하지 않고, append-only JSONL stream과 per-object history projection으로 먼저 보존한다.

EventStore의 역할은 세 가지로 나눈다.

```text
Global event log:
  전체 wiki에서 어떤 사건이 발생했는지 시간순으로 기록한다.
  dashboard, audit, global timeline, index rebuild의 기준이 된다.

Per-object event log:
  global event log를 object별로 빠르게 찾기 위한 link index/projection이다.
  history list에 필요한 최소 display cache만 포함한다.
  상세 내용은 lazy detail loading으로 global event와 patch file을 따라가서 읽는다.

Patch history:
  full revision snapshot 대신 변경된 부분만 patch로 보존한다.
  저장공간을 줄이고, git과 유사하게 변경분 중심 history를 만든다.
```

권장 위치:

```text
data/wiki/events/YYYY/MM/DD.jsonl
data/wiki/history/nodes/<safe-object-id>/events.jsonl
data/wiki/history/nodes/<safe-object-id>/patches/<event-id>.json
data/wiki/history/nodes/<safe-object-id>/head.json
data/wiki/history/edges/<safe-object-id>/events.jsonl
data/wiki/history/edges/<safe-object-id>/patches/<event-id>.json
data/wiki/history/edges/<safe-object-id>/head.json
```

Global event log는 간략한 사건 stream이다. 여기에는 "어떤 사건이 발생했는가"를 빠르게 파악할 수 있는 정보만 둔다.

```json
{
  "schema_version": 1,
  "event_id": "event.20260625.01J000000001",
  "event_kind": "event",
  "event_type": "node.updated",
  "object_kind": "node",
  "object_id": "svc.caddy",
  "base_rev": 1,
  "next_rev": 2,
  "account_id": "account.admin",
  "occurred_at": "2026-06-25T18:00:00+09:00",
  "summary": "Updated Caddy service metadata",
  "changed_fields": ["summary", "props.port"],
  "object_history_path": "history/nodes/svc.caddy/events.jsonl",
  "patch_path": "history/nodes/svc.caddy/patches/event.20260625.01J000000001.json",
  "before_hash": "sha256:...",
  "after_hash": "sha256:..."
}
```

Per-object event log는 global event log의 완전한 복사본이 아니다. object별 history list를 빠르게 열기 위한 link index/projection이다. 저장공간 중복을 줄이기 위해 원본 event metadata는 global event log에 두고, per-object history에는 event reference와 최소 display cache만 둔다.

```json
{
  "schema_version": 1,
  "event_id": "event.20260625.01J000000001",
  "event_ref": "events/2026/06/25.jsonl",
  "line": 42,
  "byte_offset": 18344,
  "event_type": "node.updated",
  "base_rev": 1,
  "next_rev": 2,
  "occurred_at": "2026-06-25T18:00:00+09:00",
  "summary": "Updated Caddy service metadata",
  "patch_path": "patches/event.20260625.01J000000001.json",
  "after_hash": "sha256:..."
}
```

history UI는 lazy detail loading을 사용한다.

```text
History list:
  per-object events.jsonl만 읽어서 표시한다.
  global event log와 patch file은 열지 않는다.

History detail / diff:
  사용자가 특정 event를 열 때 event_ref + byte_offset으로 global event를 읽는다.
  patch_path로 patch/inverse_patch를 읽어 diff와 rollback candidate를 표시한다.
```

`line`과 `byte_offset`은 global event lookup 지연을 줄이기 위한 optional optimization이다. 둘 중 하나만 저장해도 되지만, 가능하면 `byte_offset`을 저장하고 읽을 때 `event_id`를 다시 검증한다.

Patch file은 변경분을 보존한다. 기본 전략은 full revision snapshot이 아니라 `patch`와 `inverse_patch`를 저장하는 것이다.

```json
{
  "schema_version": 1,
  "event_id": "event.20260625.01J000000001",
  "object_kind": "node",
  "object_id": "svc.caddy",
  "base_rev": 1,
  "next_rev": 2,
  "patch_format": "json-patch-like",
  "patch": [
    {
      "op": "replace",
      "path": "/summary",
      "value": "Caddy reverse proxy service"
    },
    {
      "op": "replace",
      "path": "/props/port",
      "value": 3000
    }
  ],
  "inverse_patch": [
    {
      "op": "replace",
      "path": "/summary",
      "value": "Caddy"
    },
    {
      "op": "remove",
      "path": "/props/port"
    }
  ],
  "before_hash": "sha256:...",
  "after_hash": "sha256:..."
}
```

`head.json`은 object별 history head를 빠르게 찾기 위한 작은 metadata이다.

```json
{
  "object_kind": "node",
  "object_id": "svc.caddy",
  "current_rev": 2,
  "latest_event_id": "event.20260625.01J000000001",
  "latest_hash": "sha256:..."
}
```

revision snapshot은 기본값으로 만들지 않는다. 저장공간 낭비를 줄이기 위해 patch 기반 history를 우선한다. 단, 아주 오래된 revision 복원 성능이 문제가 되면 다음 단계에서 optional checkpoint를 추가할 수 있다.

Event/history implementation roadmap:

```text
v1:
  current JSON
  global event log as canonical event source
  per-object history as link index/projection
  patch/inverse_patch as canonical change source
  before_hash / after_hash for integrity check
  lazy detail loading for history UI
  optional line/byte_offset for faster global event lookup

v2:
  event lookup optimization
  runtime hot cache
  compacted history pages
  every N revisions checkpoint
  monthly checkpoint
  manual checkpoint before migration
  event node materialization
  history graph view
  advanced event lookup indexes
```

Event/log를 실제 node처럼 탐색해야 하는 경우에는 JSONL event stream에서 event node index를 생성하거나, 필요한 event만 `event.*` node로 materialize한다.

차후 논의할 내용:

```text
1. patch format을 JSON Patch RFC 6902에 맞출지, L.W.S. custom patch로 둘지 결정한다.
2. inverse_patch 생성 실패나 partial write 실패 시 rollback 전략을 정한다.
3. global event log append와 per-object history projection append의 일관성 보장 방식을 정한다.
4. byte_offset을 Windows/Node.js 파일 쓰기 방식에서 안정적으로 계산하는 방식을 검증한다.
5. event hash chain을 둘지 결정한다. 예: prev_global_event_hash, prev_object_event_hash.
6. event/log를 언제 `event.*` node로 materialize할지 정책을 정한다.
7. history graph view의 최소 read model을 정한다.
```

### 6.4 IndexStore

IndexStore는 빠른 검색과 탐색을 위한 SQLite 기반 generated read model을 관리한다. SQLite는 source of truth가 아니다.

source of truth는 다음 파일들이다.

```text
knowledge/wiki/nodes/*.json
knowledge/wiki/edges/*.json
data/wiki/events/**/*.jsonl
data/wiki/history/**/patches/*.json
```

SQLite index는 삭제되거나 손상되어도 위 source of truth에서 재생성할 수 있어야 한다.

권장 위치:

```text
data/wiki/db/lws.sqlite
```

IndexStore가 담당하는 빠른 조회:

```text
Object Explorer:
  id, title, type, tag, visibility, status, detail_mode 검색과 필터

Graph:
  source, target, relation type 기반 adjacency 조회

Timeline:
  temporal.occurred_at, valid_from, valid_to, audit.updated_at 기반 정렬

History:
  object_id -> event_id, event_ref, byte_offset, patch_path 빠른 조회

Validation/Admin:
  validation issue 목록, index 상태, object count, stale 상태 조회

Search:
  title, summary, alias, content 검색. 필요하면 SQLite FTS5를 사용한다.
```

권장 table 초안:

```text
objects
nodes
edges
object_tags
graph_edges
timeline_items
events
object_history
validation_issues
index_meta
index_builds
```

table 역할:

```text
objects:
  node/edge 공통 summary index.

nodes:
  node 전용 field index.

edges:
  edge 전용 field index.

object_tags:
  tag filter를 위한 many-to-many index.

graph_edges:
  graph adjacency query를 위한 edge projection.

timeline_items:
  edit timeline과 knowledge timeline 조회용 projection.

events:
  global event lookup index. canonical event source는 JSONL이다.

object_history:
  per-object history link index/projection.

validation_issues:
  validation/admin UI용 issue index.

index_meta / index_builds:
  SQLite index 자체의 schema version, build status, rebuild 이력.
```

별도의 tiny JSON index metadata는 기본 설계에 두지 않는다. index 상태도 SQLite의 `index_meta`/`index_builds` table로 관리한다. SQLite가 없거나, 열 수 없거나, schema version이 맞지 않으면 `INDEX_REBUILD_REQUIRED`, `INDEX_CORRUPT`, `INDEX_SCHEMA_MISMATCH` 같은 상태를 반환한다.

```text
SQLite missing:
  INDEX_REBUILD_REQUIRED

SQLite unreadable:
  INDEX_CORRUPT

SQLite schema outdated:
  INDEX_SCHEMA_MISMATCH
```

JSON export가 필요하면 운영 보고서나 debug export로 생성할 수 있다. 그러나 그것은 source of truth나 기본 metadata 저장소가 아니다.

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

L.W.S. permission model은 role-first가 아니라 account-first로 설계한다. 계정도 node이며, 권한도 가능하면 node/edge model로 표현한다. 다만 runtime 권한 판단은 매 요청마다 raw graph를 순회하지 않고, PermissionService와 SQLite projection을 통해 빠르게 수행한다.

핵심 원칙:

```text
1. 로그인하지 않은 사용자는 public object만 읽을 수 있다.
2. 로그인한 account는 기본 read 권한을 가진다.
3. account는 추가로 허용된 private object를 읽을 수 있다.
4. create capability가 있는 account는 node와 edge를 만들 수 있다.
5. edge 생성 권한은 node 간 관계 생성 권한을 포함한다.
6. account가 만든 node/edge는 기본적으로 그 account가 소유한다.
7. 소유자는 자신이 만든 node/edge를 수정할 수 있다.
8. admin은 계정, 권한, system object를 관리할 수 있다.
9. curator/architect는 초기 role이 아니라 향후 capability bundle로 다룬다.
```

### 8.1 Actor types

```text
anonymous:
  로그인하지 않은 사용자.
  public object만 읽을 수 있다.

account:
  로그인한 사용자 계정.
  계정 자체도 node이다. 예: account.taewo
  기본 read 권한과 object별 private access를 가질 수 있다.

admin:
  account 관리, 권한 부여, system/ontology/schema/storage/index 관리가 가능한 계정.
  초기에는 별도 복잡한 role hierarchy보다 admin capability로 처리한다.
```

계정 node 예:

```json
{
  "schema_version": 1,
  "object_kind": "node",
  "id": "account.taewo",
  "rev": 1,
  "title": "taewo",
  "slug": "taewo",
  "type": "type.account",
  "detail_mode": "system",
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
    "created_at": "2026-06-25T00:00:00+09:00",
    "updated_at": "2026-06-25T00:00:00+09:00",
    "created_by": "account.system",
    "updated_by": "account.system"
  }
}
```

`account.system`은 로그인 가능한 일반 계정이 아니라 reserved internal account이다. system, migration, bootstrap, automated maintenance 작업은 raw string `"system"`이 아니라 `account.system` 또는 필요한 경우 `account.migration`, `account.import` 같은 reserved account id로 기록한다.

reserved account는 다음과 같은 `props`를 가진다.

```json
{
  "account_kind": "system",
  "login_enabled": false,
  "reserved": true
}
```

### 8.2 Capabilities

초기 capability는 작게 시작한다.

```text
object.read.public:
  public object 읽기. anonymous도 가능.

object.read.private:
  허용된 private object 읽기.

object.create:
  node와 edge 생성.

object.update.own:
  자신이 소유한 node/edge 수정.

object.update.any:
  모든 node/edge 수정. admin급 권한.

object.manage.access:
  object/scope permission edge 관리.

account.manage:
  account 생성/비활성화/권한 관리.

system.manage:
  schema, storage contract, index behavior, core ontology 같은 system-level object 관리.
```

`create`는 node 생성뿐 아니라 edge 생성도 포함한다. L.W.S.에서 edge는 node 간 관계를 만드는 핵심 object이므로, create 권한이 있다면 기본 relation 생성 흐름도 허용한다. 단, public/private boundary와 target object 접근 권한은 별도로 검증한다.

### 8.3 Permission as node/edge

권한의 canonical model은 node/edge로 표현할 수 있다.

```text
account.taewo --rel.can_create_in--> scope.wiki
account.taewo --rel.owns--> svc.caddy
account.taewo --rel.member_of--> group.admin
group.admin --rel.can_manage_in--> scope.system
account.taewo --rel.can_read--> node.private-note
```

권장 relation type:

```text
rel.owns:
  source account가 target object를 소유한다.

rel.member_of:
  source account가 target group에 속한다.

rel.can_read:
  source account/group이 target object를 읽을 수 있다.

rel.can_read_in:
  source account/group이 target scope나 collection 내부 object를 읽을 수 있다.

rel.can_create_in:
  source account/group이 target scope나 collection 내부에 node/edge를 만들 수 있다.

rel.can_update:
  source account/group이 target object를 수정할 수 있다.

rel.can_update_in:
  source account/group이 target scope나 collection 내부 object를 수정할 수 있다.

rel.can_manage_in:
  source account/group이 target scope 내부의 권한, system object, ontology 등을 관리할 수 있다.
```

permission relation의 방향은 다음으로 고정한다.

```text
source:
  권한을 받는 account 또는 group.

target:
  권한이 적용되는 object, scope, collection.

type:
  source가 target에 대해 할 수 있는 행동.
```

권한 edge 예:

```json
{
  "schema_version": 1,
  "object_kind": "edge",
  "id": "edge.01JPERMISSION0001",
  "rev": 1,
  "source": "account.taewo",
  "target": "scope.wiki",
  "type": "rel.can_create_in",
  "title": "taewo can create objects in wiki scope",
  "detail_mode": "note",
  "visibility": "private",
  "status": "active",
  "tags": [],
  "props": {
    "object_kinds": ["node", "edge"],
    "inheritance": "recursive"
  },
  "temporal": {
    "occurred_at": null,
    "valid_from": "2026-06-25",
    "valid_to": null
  },
  "audit": {
    "created_at": "2026-06-25T00:00:00+09:00",
    "updated_at": "2026-06-25T00:00:00+09:00",
    "created_by": "account.admin",
    "updated_by": "account.admin"
  }
}
```

### 8.4 Runtime optimization

권한을 node/edge로 표현하더라도, 매 request마다 permission graph를 직접 순회하지 않는다. PermissionService는 account/group/permission edge를 해석해 SQLite projection을 만들고, runtime에서는 projection을 조회한다.

권장 projection:

```text
accounts:
  account_id
  status
  display_name

account_groups:
  account_id
  group_id
  source_edge_id

object_owners:
  object_kind
  object_id
  account_id
  source_edge_id

account_permissions:
  account_id
  capability
  scope_kind
  scope_id
  source_edge_id
  priority
```

권한 판단 흐름:

```text
1. object.visibility == public 이면 read 허용.
2. anonymous이고 private object이면 거부.
3. account status가 active인지 확인.
4. object owner이면 object.update.own 허용.
5. account_permissions projection에서 matching capability를 확인.
6. group-derived permission을 확인.
7. object-specific permission이 broader scope permission보다 우선한다.
8. service layer가 최종 permission result를 반환한다.
```

projection은 source of truth가 아니다. permission node/edge에서 재생성 가능해야 한다.

### 8.5 Curator and architect

`curator`, `architect`는 초기 필수 role로 두지 않는다. 두 개념은 나중에 capability bundle로 정의할 수 있다.

```text
curator bundle:
  ontology.manage
  object.restore
  object.update.any_limited
  validation.resolve

architect bundle:
  schema.manage
  storage.contract.manage
  index.schema.manage
  migration.approve
```

초기 구현에서는 단순하게 `account`, `account with object.create`, `admin`으로 충분하다.

### 8.6 RequestContext

초기 app은 운영 수준의 로그인/세션 보안 시스템까지 완성하지 않는다. 여기서 운영 수준 인증은 secure login, password hashing, session rotation, secure cookie, CSRF protection, account lockout, password reset, OAuth/passkey 같은 실제 배포용 인증 체계를 뜻한다.

다만 service layer의 모든 read/write는 나중에 실제 인증 시스템을 붙일 수 있도록 account context와 `PermissionService` guard를 받는 형태로 설계한다.

`RequestContext`는 API route, server-side action, script, future CLI 같은 진입점에서 만들어져 service layer로 전달된다. service는 request header, cookie, token, local script flag를 직접 해석하지 않는다. 인증/계정 해석은 진입점 또는 auth adapter가 담당하고, service는 정규화된 `RequestContext`를 요청 신원 정보로 사용한다.

여기서 중요한 점은 `RequestContext`가 permission source of truth가 아니라는 것이다. `RequestContext`는 "누가 요청했는가"와 "어떤 요청인가"를 담고, 실제 object/scope 권한은 `PermissionService`가 SQLite permission projection을 조회해 판정한다.

```ts
type RequestContext = {
  accountId: string | null
  isAnonymous: boolean
  requestId: string
  authSource: "anonymous" | "session" | "local-script" | "system"
}
```

field 의미:

```text
accountId:
  현재 요청을 수행하는 account node id이다.
  로그인하지 않은 사용자는 null이다.
  로그인 계정은 account.taewo 같은 id를 사용한다.
  내부 작업은 account.system, account.migration 같은 reserved account를 사용할 수 있다.

isAnonymous:
  로그인하지 않은 요청인지 나타낸다.
  true이면 public read 외의 작업은 기본적으로 거부한다.

requestId:
  log, event, error trace를 연결하기 위한 요청 식별자이다.
  mutation event에는 필요하면 requestId를 함께 기록할 수 있다.

authSource:
  RequestContext가 어떤 진입점/인증 경로에서 만들어졌는지 나타낸다.
  초기 app에서는 session보다 local-script 또는 system 진입점이 먼저 사용될 수 있다.
  authSource는 감사와 디버깅을 위한 메타데이터이며 권한 승인 근거가 아니다.
```

`RequestContext`에 object별 permission 결과를 미리 담지 않는 이유:

```text
1. 권한은 account/group/scope/object 사이의 edge로 표현된다.
2. 같은 account라도 target object, collection, scope에 따라 허용 여부가 달라진다.
3. frontend나 token claim이 보낸 capability 배열을 그대로 믿으면 permission graph와 불일치할 수 있다.
4. service guard가 PermissionService를 통해 매번 target 기준으로 확인해야 한다.
5. 반복 조회 성능은 RequestContext가 아니라 request-local memoization과 SQLite projection index로 해결한다.
```

권장 생성 흐름:

```text
API route:
  cookie/session/token/local mode를 해석한다.
  account id 후보를 얻는다.
  PermissionService.resolveContext(accountId)를 호출한다.
  service method에 RequestContext를 전달한다.

script / future CLI:
  명시적인 --account 또는 reserved account를 사용한다.
  예: account.system, account.migration.
  PermissionService.resolveContext(accountId)를 호출한다.

service layer:
  RequestContext 없이 read/write를 수행하지 않는다.
  필요한 권한은 PermissionService 또는 guard helper로 확인한다.
```

예:

```ts
type SaveNodeCommand = {
  id: string
  baseRev: number
  patch: unknown
}

await nodeService.saveNode(command, context)
```

권장 guard API:

```ts
await permissionService.assertCanRead(context, objectId)
await permissionService.assertCanCreateIn(context, scopeOrCollectionId, objectKind)
await permissionService.assertCanUpdate(context, objectId)
await permissionService.assertCanManageIn(context, scopeId)
```

guard 내부 판정 원칙:

```text
1. RequestContext.accountId와 target object/scope/collection id를 입력으로 받는다.
2. SQLite permission projection에서 account status, group membership, owner, permission edge를 조회한다.
3. projection은 source of truth가 아니며 node/edge JSON과 event log에서 재생성 가능해야 한다.
4. 같은 요청 안의 반복 판정은 request-local memoization으로 캐시할 수 있다.
5. projection이 없거나 stale/corrupt 상태이면 private read와 write는 fail closed로 거부한다.
```

service guard 예:

```text
read public object:
  SQLite objects.visibility 또는 object header에서 public 여부를 확인한다.
  public이면 anonymous도 허용한다.

read private object:
  PermissionService.canRead(context, objectId)를 호출한다.
  rel.can_read, rel.can_read_in, group-derived permission, global private-read policy를 projection에서 확인한다.

create node/edge:
  PermissionService.canCreateIn(context, targetScopeOrCollectionId, objectKind)를 호출한다.
  target scope/collection에 대한 rel.can_create_in을 projection에서 확인한다.

update owned object:
  PermissionService.canUpdate(context, objectId)를 호출한다.
  object_owners projection에서 rel.owns를 확인하고 object.update.own policy를 적용한다.

update object in collection/scope:
  PermissionService.canUpdate(context, objectId)를 호출한다.
  object-specific rel.can_update 또는 scope/collection rel.can_update_in을 projection에서 확인한다.
```

신뢰 경계:

```text
1. frontend가 보낸 accountId/capabilities는 신뢰하지 않는다.
2. API route도 raw token claim을 최종 권한으로 사용하지 않는다.
3. RequestContext의 신뢰 범위는 accountId, isAnonymous, requestId, authSource 같은 요청 신원 정보로 제한한다.
4. object/scope별 권한 승인 여부는 RequestContext가 아니라 PermissionService guard 결과를 사용한다.
5. SQLite permission projection은 source of truth가 아니며 permission node/edge에서 재생성 가능해야 한다.
6. account.system은 reserved internal account이며 login_enabled=false여야 한다.
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

### 9.2 Object list/read API

읽기와 탐색은 `/objects`를 중심으로 둔다. L.W.S.에서 node와 edge는 모두 object이므로, list/read entry는 object 단위로 통합한다.

```text
GET    /api/lws/objects
GET    /api/lws/objects/:id
```

`GET /api/lws/objects`는 SQLite read model을 사용해 node와 edge를 함께 탐색한다. Object Explorer, sidebar list, relation picker, tag/type filtered view의 기본 API이다.

권장 query:

```text
kind=node|edge
type=type.service
tag=tag.server
scope=scope.wiki
collection=collection.server-ops
status=active|archived|deleted
visibility=public|private
q=caddy
sort=updated_at_desc|title_asc|id_asc|created_at_desc
include_permissions=true|false
limit=50
cursor=...
```

edge 탐색용 query:

```text
source=svc.caddy
target=svc.webapp
relation=rel.depends_on
```

query 의미:

```text
kind:
  node와 edge 중 어떤 object_kind를 조회할지 제한한다.
  생략하면 node와 edge를 함께 반환한다.

type:
  node.type 또는 edge.type을 기준으로 필터링한다.

tag:
  object_tags projection을 사용해 tag를 필터링한다.

scope / collection:
  해당 scope 또는 collection 내부 object만 조회한다.
  권한 판정에도 사용될 수 있다.

status:
  기본값은 active이다.
  archived/deleted는 명시적으로 요청한 경우에만 포함한다.

visibility:
  public/private 필터이다.
  private 필터를 요청해도 PermissionService가 허용한 object만 반환한다.

q:
  list 안에서 title, summary, aliases 정도를 가볍게 좁히는 filter이다.
  본문 full-text ranked search는 `/search`를 사용한다.

source / target / relation:
  edge 탐색과 graph adjacency UI에 사용한다.

sort:
  cursor pagination의 정렬 기준이다.
  v1 기본값은 updated_at_desc이다.

include_permissions:
  true이면 각 item에 viewer_permissions를 포함한다.
  기본값은 false로 두고, editor/list action UI에서 필요할 때만 요청한다.
```

pagination은 offset이 아니라 cursor-based로 설계한다. cursor는 opaque string이며 client가 내부 구조를 해석하지 않는다.

```json
{
  "items": [
    {
      "id": "svc.caddy",
      "object_kind": "node",
      "title": "Caddy",
      "type": "type.service",
      "summary": "Reverse proxy service",
      "status": "active",
      "visibility": "private",
      "updated_at": "2026-06-25T18:00:00+09:00",
      "viewer_permissions": {
        "can_read": true,
        "can_update": true,
        "can_delete": false,
        "can_restore": true,
        "can_manage_access": false
      }
    }
  ],
  "next_cursor": "opaque-cursor",
  "limit": 50
}
```

cursor 원칙:

```text
1. cursor는 sort key, last object id, query hash, index revision 같은 값을 담을 수 있다.
2. cursor는 base64url 등으로 인코딩한 opaque token으로 취급한다.
3. client는 cursor를 저장하거나 수정하지 않고 다음 page 요청에 그대로 전달한다.
4. query parameter가 바뀌면 기존 cursor는 무효이다.
5. index rebuild로 cursor가 무효화되면 CURSOR_INVALID를 반환하고 client는 첫 page부터 다시 요청한다.
```

permission filtering은 pagination 전에 적용되어야 한다. private object가 섞인 결과에서 page를 만든 뒤 client-side로 제거하면 빈 page나 누락이 생길 수 있다.

```text
Object list flow:
  1. API route가 RequestContext를 만든다.
  2. ObjectQueryService가 query를 정규화한다.
  3. PermissionService가 account/group/scope permission projection을 query에 결합한다.
  4. SQLite에서 visible object만 조회한다.
  5. cursor page를 만든다.
  6. include_permissions=true이면 viewer_permissions를 함께 계산해 반환한다.
```

`GET /api/lws/objects/:id`는 object id만으로 node 또는 edge를 읽는다. 응답에는 `object_kind`를 포함해 frontend가 node/edge editor를 선택할 수 있게 한다.

object read response 예:

```json
{
  "object": {
    "object_kind": "node",
    "id": "svc.caddy",
    "rev": 4,
    "title": "Caddy"
  },
  "viewer_permissions": {
    "can_read": true,
    "can_update": true,
    "can_delete": false,
    "can_restore": true,
    "can_manage_access": false
  }
}
```

`viewer_permissions`는 frontend 버튼/메뉴 상태를 위한 hint이다. 실제 mutation에서는 service layer가 `PermissionService.assertCan...()`를 다시 호출한다.

### 9.3 Search API

`/objects`는 browse/filter API이고, `/search`는 full-text/ranked search API이다.

```text
GET /api/lws/search
```

권장 query:

```text
q=caddy reverse proxy
kind=node|edge
type=type.service
tag=tag.server
scope=scope.wiki
status=active
limit=20
cursor=...
```

`/search`는 title, summary, aliases, content body를 대상으로 한다. SQLite FTS5 사용을 권장하되, SQLite FTS가 비활성화된 환경에서는 title/summary/aliases 기반 fallback search로 동작할 수 있다.

search response 예:

```json
{
  "items": [
    {
      "id": "svc.caddy",
      "object_kind": "node",
      "title": "Caddy",
      "summary": "Reverse proxy service",
      "score": 12.4,
      "highlights": [
        {
          "field": "summary",
          "text": "Reverse proxy service"
        }
      ],
      "viewer_permissions": {
        "can_read": true,
        "can_update": true
      }
    }
  ],
  "next_cursor": null,
  "limit": 20
}
```

search도 permission-aware query여야 한다. 검색 index에 private content가 들어갈 수 있으므로, anonymous/public search와 authenticated/private search는 반드시 RequestContext를 기준으로 분리한다.

```text
anonymous search:
  public object만 검색한다.

account search:
  public object + account가 읽을 수 있는 private object만 검색한다.

admin/system search:
  system.manage 또는 object.manage.access에 해당하는 guard를 통과한 경우에만 broad search를 허용한다.
```

### 9.4 Node/Edge mutation API

생성/수정은 schema가 다른 `/nodes`, `/edges`를 중심으로 둔다. API route는 request shape를 검증한 뒤 service layer로 전달하고, 실제 read/write는 backend service와 store를 거친다.

```text
POST   /api/lws/nodes
PATCH  /api/lws/nodes/:id
DELETE /api/lws/nodes/:id
POST   /api/lws/edges
PATCH  /api/lws/edges/:id
DELETE /api/lws/edges/:id
```

생성은 `POST`를 사용한다. 생성 요청은 full object 또는 draft object를 받으며, backend가 schema default, audit field, initial event를 정규화한다.

```json
{
  "object": {
    "id": "svc.caddy",
    "title": "Caddy",
    "type": "type.service"
  },
  "target_scope": "scope.wiki"
}
```

수정은 `PATCH`를 기본 mutation 계약으로 둔다. L.W.S. history가 `patch`와 `inverse_patch` 중심이므로, API도 변경분을 1급 입력으로 받는다.

### 9.5 PATCH mutation contract

`PATCH` request는 `base_rev`와 `patch`를 포함한다.

```json
{
  "base_rev": 3,
  "patch": [
    {
      "op": "replace",
      "path": "/summary",
      "value": "Caddy reverse proxy service"
    },
    {
      "op": "replace",
      "path": "/props/port",
      "value": 3000
    }
  ],
  "client_mutation_id": "optional-client-id"
}
```

client는 `patch`만 보낸다. `inverse_patch`, `before_hash`, `after_hash`, `changed_fields`, event metadata는 backend가 current object를 읽은 뒤 생성한다.

권장 PATCH 처리 흐름:

```text
1. API route가 RequestContext를 만든다.
2. PermissionService.assertCanUpdate(context, objectId)를 호출한다.
3. ObjectStore에서 current object를 읽는다.
4. base_rev conflict를 확인한다.
5. patch를 적용한다.
6. schema validation과 semantic validation을 수행한다.
7. inverse_patch를 생성한다.
8. before_hash / after_hash를 계산한다.
9. object JSON을 atomic write한다.
10. global event log를 append한다.
11. per-object history projection을 append한다.
12. SQLite index를 update하거나 stale로 표시한다.
```

Patch format은 JSON Patch RFC 6902를 기준으로 하되, v1에서는 허용 op를 좁게 시작한다.

```text
v1 allowed:
  add
  replace
  remove
  test

v1 deferred:
  move
  copy
```

배열 field는 index 기반 patch가 동시 수정에 취약하므로 v1에서는 전체 replace를 권장한다.

```text
tags:
  /tags 전체 replace 권장

aliases:
  /aliases 전체 replace 권장

content.body:
  v1에서는 문자열 전체 replace
  v2에서 text diff 또는 block-level patch 검토
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

### 9.6 History API

history는 node/edge 공통 기능이므로 `/objects` 중심으로 둔다. list는 per-object history projection을 읽고, detail/diff는 lazy loading으로 global event log와 patch file을 따라간다.

```text
GET  /api/lws/objects/:id/history
GET  /api/lws/objects/:id/history/:eventId
GET  /api/lws/objects/:id/history/:eventId/diff
POST /api/lws/objects/:id/restore
```

역할:

```text
GET /objects/:id/history:
  per-object history projection만 읽는다.
  history list UI용이다.
  patch 본문은 읽지 않는다.

GET /objects/:id/history/:eventId:
  event_ref와 byte_offset을 사용해 global event log를 lazy loading한다.
  patch metadata와 validation result 같은 상세 정보를 함께 반환할 수 있다.

GET /objects/:id/history/:eventId/diff:
  patch/inverse_patch를 읽고 frontend 표시용 diff를 반환한다.
  frontend가 patch format을 직접 해석하지 않아도 된다.

POST /objects/:id/restore:
  과거 event를 기준으로 현재 object에 복원 mutation을 생성한다.
  과거 파일로 되돌리는 것이 아니라 새 PATCH event를 만든다.
```

history list response 예:

```json
{
  "items": [
    {
      "event_id": "event.20260625.01J000000001",
      "event_type": "node.updated",
      "base_rev": 1,
      "next_rev": 2,
      "occurred_at": "2026-06-25T18:00:00+09:00",
      "account_id": "account.admin",
      "summary": "Updated Caddy service metadata",
      "changed_fields": ["summary", "props.port"]
    }
  ],
  "next_cursor": null
}
```

restore request 예:

```json
{
  "base_rev": 9,
  "source_event_id": "event.20260625.01J000000001",
  "mode": "inverse_patch"
}
```

restore는 `POST`를 사용한다. client가 patch를 직접 제공하는 것이 아니라, backend가 `source_event_id`의 patch/inverse_patch를 읽어 server-derived patch를 만든 뒤 현재 object에 새 mutation으로 적용하기 때문이다.

restore 처리 원칙:

```text
1. PermissionService.assertCanUpdate(context, objectId)를 통과해야 한다.
2. source_event_id가 object history에 속하는지 확인한다.
3. base_rev conflict를 확인한다.
4. mode에 따라 복원 patch를 생성한다.
5. 복원 결과도 schema/semantic/public-boundary validation을 통과해야 한다.
6. 복원은 기존 event를 삭제하거나 덮어쓰지 않고 새 global event와 per-object history entry를 만든다.
```

history permission은 current object read보다 보수적으로 둔다.

```text
current object read 가능:
  history list 조회 가능.

private object read 가능:
  history detail/diff 조회 가능.

anonymous public read:
  v1에서는 current object read만 허용한다.
  public history 공개는 별도 정책으로 나중에 검토한다.
```

### 9.7 Session and permission API

session/permission API는 frontend가 현재 account와 UI state를 알기 위한 API이다. 이 API의 결과는 UI hint이며, mutation 승인 근거가 아니다. 모든 read/write service는 항상 `PermissionService.assertCan...()`를 다시 수행한다.

```text
GET /api/lws/session
GET /api/lws/objects/:id/permissions
```

`GET /api/lws/session`은 현재 요청의 account context를 반환한다.

```json
{
  "account_id": "account.taewo",
  "is_anonymous": false,
  "display_name": "taewo",
  "auth_source": "session",
  "ui_capabilities": [
    "object.create",
    "admin.open"
  ],
  "default_scope": "scope.wiki"
}
```

anonymous session 예:

```json
{
  "account_id": null,
  "is_anonymous": true,
  "display_name": "Anonymous",
  "auth_source": "anonymous",
  "ui_capabilities": [],
  "default_scope": null
}
```

`ui_capabilities`는 raw token claim이 아니다. backend가 RequestContext와 PermissionService를 통해 계산한 UI용 capability hint이다. object/scope별 권한은 `/objects/:id/permissions` 또는 object read response의 `viewer_permissions`로 확인한다.

`GET /api/lws/objects/:id/permissions`는 현재 viewer 기준의 object-level permission을 반환한다.

```json
{
  "object_id": "svc.caddy",
  "object_kind": "node",
  "viewer_permissions": {
    "can_read": true,
    "can_update": true,
    "can_delete": false,
    "can_restore": true,
    "can_manage_access": false,
    "can_view_history": true,
    "can_view_diff": true
  },
  "reason": [
    "rel.owns",
    "rel.can_update_in:scope.wiki"
  ],
  "projection_rev": 12
}
```

permission API 원칙:

```text
1. frontend가 보낸 permission 값은 backend에서 신뢰하지 않는다.
2. session API는 account identity와 UI hint만 제공한다.
3. object permission API는 현재 viewer 기준 결과만 제공한다.
4. raw permission graph 전체는 admin/permission management API에서만 별도로 다룬다.
5. projection_rev는 디버깅과 stale permission 확인용이며 권한 승인 근거가 아니다.
```

### 9.8 Read model API

```text
GET /api/lws/graph
GET /api/lws/graph?center=svc.caddy&depth=1
GET /api/lws/graph/:viewId
GET /api/lws/objects/:id/backlinks
GET /api/lws/timeline
GET /api/lws/timeline/:viewId
GET /api/lws/ontology
```

read model API는 SQLite projection을 읽어 graph, backlinks, timeline, ontology view를 반환한다. 이 API도 permission-aware query를 사용해야 하며, public graph 노출은 `LWS_PUBLIC_GRAPH_ENABLED`와 public boundary validation 결과를 따른다.

graph navigation 예:

```text
GET /api/lws/graph?center=svc.caddy&depth=1:
  특정 object를 중심으로 주변 node/edge를 조회한다.

GET /api/lws/graph/:viewId:
  view.graph.* node에 저장된 filter/layout 설정을 기준으로 graph를 조회한다.

GET /api/lws/objects/:id/backlinks:
  target이 현재 object인 edge와 source object summary를 조회한다.
```

graph API는 source JSON을 매번 직접 순회하지 않고 `objects`, `graph_edges`, `object_tags`, permission projection을 join해 응답한다.

### 9.9 Admin API and jobs

```text
POST /api/lws/admin/validate
POST /api/lws/admin/reindex
POST /api/lws/admin/materialize-core-ontology
POST /api/lws/admin/backup
POST /api/lws/admin/check-public-boundary
GET  /api/lws/admin/jobs
GET  /api/lws/admin/jobs/:jobId
POST /api/lws/admin/jobs/:jobId/cancel
```

admin API는 권한이 큰 command이므로 `system.manage`, `object.manage.access`, `account.manage` 같은 capability guard를 통과해야 한다. 초기 UI에서는 일부 action을 mock 또는 disabled state로 둘 수 있지만, API contract는 job 기반으로 잡는다.

admin action은 오래 걸릴 수 있으므로 job envelope를 반환한다. v1 구현은 내부적으로 synchronous로 실행해도 되지만, response shape는 queued/running/succeeded/failed를 표현할 수 있어야 한다.

admin action response 예:

```json
{
  "job": {
    "job_id": "job.20260625.01J000000001",
    "type": "reindex",
    "status": "queued",
    "created_at": "2026-06-25T18:00:00+09:00",
    "started_at": null,
    "finished_at": null,
    "progress": {
      "current": 0,
      "total": null,
      "message": "Waiting to rebuild SQLite index"
    },
    "result": null,
    "error": null
  }
}
```

job status:

```text
queued:
  job이 생성되었지만 아직 실행되지 않았다.

running:
  job이 실행 중이다.

succeeded:
  job이 성공적으로 완료되었다.

failed:
  job이 실패했다. error.code와 error.message를 포함한다.

canceled:
  사용자가 취소했거나 system이 중단했다.
```

job detail response 예:

```json
{
  "job": {
    "job_id": "job.20260625.01J000000001",
    "type": "validate",
    "status": "succeeded",
    "created_at": "2026-06-25T18:00:00+09:00",
    "started_at": "2026-06-25T18:00:01+09:00",
    "finished_at": "2026-06-25T18:00:04+09:00",
    "progress": {
      "current": 120,
      "total": 120,
      "message": "Validation complete"
    },
    "result": {
      "error_count": 0,
      "warning_count": 2
    },
    "error": null
  }
}
```

job 처리 원칙:

```text
1. POST admin action은 job_id를 반환한다.
2. 오래 걸리는 action은 202 Accepted와 queued/running job을 반환할 수 있다.
3. 빠른 action은 200 OK와 succeeded job을 바로 반환할 수 있다.
4. frontend는 GET /api/lws/admin/jobs/:jobId로 progress를 polling한다.
5. job result는 runtime state이며 source of truth가 아니다.
6. validation/reindex/backup 같은 admin event는 필요하면 EventStore에 별도 admin event로 기록한다.
7. 동일 action의 중복 실행을 줄이기 위해 request body에 client_job_id를 받을 수 있다.
```

admin action별 성격:

```text
validate:
  source object와 permission boundary를 검증한다.
  validation_issues projection을 갱신할 수 있다.

reindex:
  SQLite generated read model을 재생성한다.
  source of truth는 변경하지 않는다.

materialize-core-ontology:
  core type/tag/relation/scope node를 생성하거나 보정한다.
  실제 mutation이므로 event log를 남긴다.

backup:
  knowledge/data/index snapshot을 backup root에 만든다.

check-public-boundary:
  public object가 private object를 부적절하게 참조하는지 확인한다.
```

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
PATCH_INVALID
RESTORE_SOURCE_INVALID
CURSOR_INVALID
EVENT_APPEND_FAILED
INDEX_STALE
INDEX_REBUILD_REQUIRED
INDEX_CORRUPT
INDEX_SCHEMA_MISMATCH
SEARCH_UNAVAILABLE
JOB_NOT_FOUND
JOB_CONFLICT
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

indexing은 SQLite generated read model을 만드는 과정이다. 이 index를 통해 object list, graph traversal, backlinks, timeline, ontology, search, permission-aware read를 빠르게 수행한다.

index는 source of truth가 아니다. 언제든 다음 원본에서 재생성 가능해야 한다.

```text
knowledge/wiki/nodes/*.json
knowledge/wiki/edges/*.json
data/wiki/events/**/*.jsonl
data/wiki/history/**/patches/*.json
```

초기 indexing은 sync command 또는 admin job API action으로 시작한다. 일반적인 운영 흐름에서는 전체 reindex를 매번 수행하지 않는다. `POST`, `PATCH`, `DELETE`, `restore` 같은 mutation이 성공하면 affected projection만 incremental update한다.

mutation별 index update:

```text
POST node/edge:
  object JSON write
  event append
  affected index rows insert/update

PATCH node/edge:
  object JSON write
  event append
  affected index rows update

DELETE node/edge:
  status=deleted patch mutation
  event append
  affected index rows update or hide

restore:
  restore patch mutation
  event append
  affected index rows update
```

incremental update 대상:

```text
node 변경:
  objects
  nodes
  object_tags
  timeline_items
  search index
  permission projection if account/group/scope/type/tag node changed

edge 변경:
  objects
  edges
  graph_edges
  backlinks view/projection
  timeline_items
  search index
  permission projection if rel.can_* / rel.owns / rel.member_of changed

event/history 변경:
  events
  object_history
```

권장 mutation pipeline에서 index update 위치:

```text
1. permission check.
2. current object read.
3. base_rev check.
4. create/apply patch.
5. validation.
6. object JSON atomic write.
7. global event append.
8. per-object history append.
9. incremental index update.
10. response.
```

index update 실패 정책:

```text
object write + event append 성공
index update 성공:
  정상 응답.

object write + event append 성공
index update 실패:
  mutation은 성공으로 유지한다.
  INDEX_STALE 상태를 기록한다.
  response에 warning을 포함할 수 있다.
  admin reindex job으로 복구한다.
```

이 정책을 두는 이유는 SQLite index가 재생성 가능한 projection이기 때문이다. source of truth인 object JSON과 event log가 성공적으로 기록되었다면, index update 실패만으로 지식 저장 자체를 rollback하지 않는다.

full reindex는 복구/검증/마이그레이션용으로 둔다.

full reindex가 필요한 경우:

```text
SQLite missing/corrupt.
SQLite schema version changed.
index projection code changed.
bulk import completed.
manual file edit detected.
event log replay verification requested.
permission projection mismatch detected.
public boundary validation needs full rerun.
```

권장 full rebuild pipeline:

```text
1. scan node source files.
2. scan edge source files.
3. validate object shape and semantic constraints.
4. normalize node/edge summary into objects table.
5. project node-only fields into nodes table.
6. project edge-only fields into edges table.
7. project source/target/relation into graph_edges table.
8. project reverse links/backlinks from graph_edges.
9. project tag/type/relation/scope/collection membership.
10. project temporal/audit fields into timeline_items.
11. project account/group/owner/permission edges into permission tables.
12. build title/summary/alias/content search index. Use SQLite FTS5 when available.
13. project global events and per-object history links.
14. run public boundary validation before public graph exposure.
15. write index_meta and index_builds rows.
```

주요 projection:

```text
objects:
  id, object_kind, title, type, status, visibility, detail_mode, summary, updated_at.

graph_edges:
  edge_id, source_id, target_id, relation_type, status, visibility.

backlinks:
  graph_edges에서 target_id 기준으로 계산한다.
  별도 table로 materialize할 수도 있지만 v1에서는 graph_edges index로 충분하다.

timeline_items:
  object_id, occurred_at, valid_from, valid_to, created_at, updated_at.

object_tags:
  object_id, tag_id.

permission projection:
  accounts, account_groups, object_owners, account_permissions.

search index:
  title, summary, aliases, content body.

events / object_history:
  event_id, object_id, event_ref, byte_offset, patch_path.
```

graph 이동은 index를 통해 수행한다.

```text
center object 주변 graph:
  graph_edges where source_id = center or target_id = center
  -> related object ids
  -> objects table에서 summary 조회
  -> PermissionService projection으로 visible object만 반환

backlinks:
  graph_edges where target_id = current object
  -> incoming relation list

relation filter:
  graph_edges where relation_type = rel.depends_on

scope/collection graph:
  objects + membership projection + graph_edges join

timeline 이동:
  timeline_items에서 object_id 또는 scope/view 기준으로 정렬 조회
```

따라서 graph UI는 원본 JSON을 직접 훑지 않는다. UI는 read model API를 호출하고, backend가 SQLite projection을 통해 필요한 node/edge summary와 relation을 빠르게 구성한다.

index metadata는 별도 tiny JSON 파일로 두지 않는다. SQLite의 `index_meta`와 `index_builds`에 저장한다.

logical `index_builds` row 예:

```json
{
  "schema_version": 1,
  "build_id": "indexbuild.20260625.01J000000001",
  "status": "succeeded",
  "started_at": "2026-06-25T18:00:00+09:00",
  "finished_at": "2026-06-25T18:00:04+09:00",
  "object_count": 120,
  "edge_count": 48,
  "warning_count": 2,
  "source_rev": "event-log-offset-or-hash",
  "schema_hash": "sha256:..."
}
```

index consistency 원칙:

```text
1. SQLite index는 disposable이다.
2. object read의 source of truth는 current node/edge JSON이다.
3. list/search/graph/timeline/history list는 SQLite projection을 우선 사용한다.
4. mutation 성공 후 affected projection을 갱신하거나 INDEX_STALE 상태를 기록한다.
5. INDEX_STALE 상태에서도 current object read는 가능하지만, graph/search/timeline은 stale warning을 포함할 수 있다.
6. SQLite가 없거나 손상되면 INDEX_REBUILD_REQUIRED 또는 INDEX_CORRUPT를 반환한다.
7. full reindex는 일반 mutation path가 아니라 admin job, migration, recovery path이다.
```

## 12. Backend implementation milestones

이 milestone은 1~11장의 설계 계약을 구현 순서로 재배열한 것이다. 목표는 "작동하는 최소 API"보다 "source of truth를 손상시키지 않는 순서"를 우선하는 것이다.

핵심 순서:

```text
1. runtime/config/path safety.
2. object schema and safe store.
3. minimal fail-closed permission boundary before public mutation/read APIs.
4. PATCH mutation and event/history preservation.
5. SQLite generated read model.
6. full permission enforcement.
7. admin jobs and recovery.
8. later hardening and v2 extensions.
```

### Implementation Rule - Module First, Service Composition

각 phase의 실제 구현은 module부터 시작하고 service가 module을 조합하는 순서로 진행한다. API route는 가장 마지막 adapter이다.

```text
1. module contract를 먼저 정의한다.
2. module 단위 구현과 단위 테스트를 작성한다.
3. service가 module을 조합해 use-case pipeline을 만든다.
4. API route는 request parsing, RequestContext 생성, service 호출, error mapping만 담당한다.
5. integration test는 API가 아니라 service pipeline을 우선 검증하고, 그 다음 API adapter를 검증한다.
```

금지할 구현 방식:

```text
API route:
  filesystem, JSONL event, SQLite를 직접 만지지 않는다.

Service:
  path 계산, raw file write, raw SQL, patch 연산 세부 구현을 직접 품지 않는다.

Module:
  HTTP request/response나 frontend state를 알지 않는다.
```

권장 구현 흐름 예:

```text
PatchModule:
  applyPatch()
  generateInversePatch()
  extractChangedFields()

RevisionModule:
  assertBaseRev()
  nextRev()

HashingModule:
  canonicalizeObject()
  sha256Object()

EventModule:
  appendGlobalEvent()
  appendObjectHistoryLink()
  writePatchFile()

NodeService.saveNode():
  PermissionService.assertCanUpdate()
  ObjectStore.readNode()
  RevisionModule.assertBaseRev()
  PatchModule.applyPatch()
  ValidationModule.validateNode()
  HashingModule.sha256Object()
  ObjectStore.atomicWrite()
  EventModule.append...
  IndexingModule.updateAffected()
```

Service는 backend use case의 이름을 가진다. Module은 재사용 가능한 기술/도메인 책임을 가진다.

```text
Service examples:
  ObjectService
  NodeService
  EdgeService
  HistoryService
  GraphService
  SearchService
  PermissionService
  AdminService
  JobService

Module examples:
  config
  storage
  patch
  revision
  hashing
  validation
  permissions
  events
  indexing
  query
  jobs
  ontology
  audit
```

`PermissionService`는 service layer에서 호출되는 guard facade이다. 내부 판정 로직은 `permissions/capabilities`, `permissions/permission-checker`, `permissions/permission-projection`, SQLite projection query module로 분리한다.

phase별 구현 dependency map:

```text
Phase 1:
  modules:
    config, storage/path-resolver, storage-doctor, shared errors, request context.
  services:
    StatusService, PermissionService stub, AdminService stub.
  APIs:
    health, status, session skeleton.

Phase 2:
  modules:
    schema validation, semantic validation baseline, built-in ontology registry,
    ObjectStore, atomic writer.
  services:
    ObjectService read path, NodeService/EdgeService read helpers.
  APIs:
    object read, validation baseline.

Phase 2.5:
  modules:
    minimal permission policy, public/private read boundary, bootstrap account guard.
  services:
    PermissionService fail-closed baseline, SessionService skeleton completion.
  APIs:
    session, object read with minimal permission filtering.

Phase 3:
  modules:
    patch, revision, hashing, EventStore, history writer/reader, boundary validator,
    mutation journal or equivalent write/event consistency guard.
  services:
    NodeService mutation pipeline, EdgeService mutation pipeline, HistoryService.
  APIs:
    POST node/edge, PATCH node/edge, DELETE node/edge, restore, history.
    Until Phase 5, public API exposure remains local/system/bootstrap-account only.

Phase 4:
  modules:
    SQLite schema, index metadata, object indexer, graph indexer, timeline indexer,
    search indexer, query/cursor, permission-aware query, internal reindex command.
  services:
    ObjectQueryService/ObjectService list path, GraphService, TimelineService,
    OntologyService, SearchService.
  APIs:
    objects list, search, graph, backlinks, timeline, ontology.

Phase 5:
  modules:
    permission-checker, permission-projection, permission-aware-query hardening,
    account/group/scope projection.
  services:
    PermissionService real enforcement, SessionService or session path in ObjectService.
  APIs:
    session, object permissions, permission-aware read/write.

Phase 6:
  modules:
    job-store, job-runner, validation job, reindex job wrapper, backup writer,
    public-boundary checker.
  services:
    JobService, AdminService.
  APIs:
    admin action APIs and admin job APIs.

Phase 7:
  modules:
    event lookup optimizer, checkpoint/compaction, migration runner,
    optional event node materializer.
  services:
    HistoryService optimization, AdminService migration/recovery.
  APIs:
    no new public API unless a v2 feature requires one.
```

### Phase 1 - Runtime Foundation

목표: app process가 안전한 runtime boundary를 가진 상태로 뜬다.

```text
config loader:
  required env check
  absolute path resolution
  Windows/POSIX separator normalization
  RuntimeConfig / PublicConfig separation

path resolver:
  safe object id -> safe filename
  root boundary check
  path traversal / drive letter / UNC guard
  read root and write root distinction

storage doctor:
  storage root existence check
  read/write capability check
  storage init policy check
  explicit development bootstrap command contract
  SQLite path under data root check

shared contracts:
  error model
  RequestContext type
  LwsRole-free account context shape
  API response envelope baseline

service skeleton:
  ObjectService
  NodeService
  EdgeService
  PermissionService stub
  AdminService stub

API skeleton:
  GET /api/lws/health
  GET /api/lws/status
  GET /api/lws/session
```

storage bootstrap 원칙:

```text
1. 기본 runtime은 storage root가 없으면 자동 생성하지 않는다.
2. 개발 환경에서는 명시적 storage-doctor init command로 필요한 하위 폴더를 만들 수 있다.
3. init command도 LWS_ALLOW_STORAGE_INIT=true일 때만 실행한다.
4. production 또는 live data mode에서는 missing root를 STORAGE_ROOT_MISSING으로 보고한다.
5. bootstrap은 실제 sample node/edge를 만들지 않는다. sample data는 LWS_ALLOW_SAMPLE_DATA가 별도로 허용된 경우에만 다룬다.
```

exit criteria:

```text
1. app can report config/storage/index status.
2. no API route reads or writes storage directly.
3. service methods accept RequestContext from the start.
4. dangerous storage/path values fail before runtime mutation.
5. empty development storage can be initialized only through an explicit allowed bootstrap command.
```

### Phase 2 - Object Schema And Safe Store

목표: node/edge source JSON을 안전하게 읽고 검증할 수 있다.

```text
schema:
  node schema validator
  edge schema validator
  shared object field validator
  id/rev/status/visibility/detail_mode enum check

semantic validation baseline:
  id uniqueness
  node.type reference check against existing type node or built-in virtual type
  edge.type reference check against existing relation node or built-in virtual relation
  edge.source / edge.target existence check
  public edge requires public source and public target

built-in ontology baseline:
  minimal in-code registry for type.*, rel.*, scope.* required by validation
  materialize-core-ontology is not required for Phase 2 validation
  later materialization can create node/edge JSON for these concepts with events

ObjectStore:
  read node by id
  read edge by id
  read object by id
  list source files
  safe path resolution for node/edge
  atomic JSON write primitive

object read API:
  GET /api/lws/objects/:id
  current JSON read from source of truth
  viewer_permissions placeholder only

validation API baseline:
  object validation result
  validation issue shape
  schema/semantic error mapping
```

exit criteria:

```text
1. backend can read real node/edge JSON from configured L.W.S. storage roots.
2. invalid object JSON produces structured errors.
3. source files are never accessed outside configured roots.
4. write primitive exists but public mutation API is not considered complete until Phase 3 event/history is attached.
5. type/relation validation works before core ontology nodes are materialized.
```

### Phase 2.5 - Minimal Permission Boundary

목표: 실제 permission graph 전체를 구현하기 전에 public/private와 write guard의 안전 기본값을 먼저 적용한다.

```text
minimal policy:
  anonymous can read public current objects only
  anonymous cannot read private objects
  anonymous cannot write
  private read and all write fail closed unless local/system/bootstrap context is explicitly allowed
  frontend-supplied accountId or capability values are never trusted

bootstrap context:
  account.admin from LWS_ADMIN_BOOTSTRAP_ACCOUNT
  account.system for internal maintenance
  local-script/system authSource only where the entrypoint explicitly opts in

PermissionService baseline:
  resolveContext(accountId)
  assertCanRead(context, objectId)
  assertCanCreateIn(context, scopeOrCollectionId, objectKind)
  assertCanUpdate(context, objectId)
  assertCanManageIn(context, scopeId)
  returns PERMISSION_DENIED for unsupported private/write checks
```

API exposure rule:

```text
1. Phase 3 mutation APIs can be implemented and tested, but public exposure remains local/system/bootstrap-account only.
2. Phase 4 list/search/graph APIs must apply at least public-only filtering for anonymous requests.
3. Full account/group/scope permission graph is still Phase 5.
4. Phase 5 replaces this baseline with projection-backed real enforcement without changing service method signatures.
```

exit criteria:

```text
1. anonymous cannot read private current objects.
2. anonymous cannot call mutation/admin APIs successfully.
3. service methods already call PermissionService guards.
4. unsupported permission checks fail closed.
5. Phase 3 and Phase 4 can be developed without accidentally exposing private data.
```

### Phase 3 - Mutation And Event History

목표: 모든 mutation이 PATCH/event/history 보존 계약을 지킨다.

```text
mutation API:
  POST /api/lws/nodes
  POST /api/lws/edges
  PATCH /api/lws/nodes/:id
  PATCH /api/lws/edges/:id
  DELETE /api/lws/nodes/:id
  DELETE /api/lws/edges/:id
  POST /api/lws/objects/:id/restore

PATCH contract:
  JSON Patch RFC 6902 subset
  allowed v1 ops: add, replace, remove, test
  base_rev conflict check
  changed_fields extraction
  inverse_patch generation
  before_hash / after_hash calculation

write pipeline:
  RequestContext required
  PermissionService guard called
  current object read
  rev check
  patch apply
  schema/semantic/boundary validation
  audit field update
  mutation journal prepared or equivalent consistency guard started
  atomic object JSON write

EventStore:
  global event log append
  per-object history link append
  patch file write
  head.json update
  event_id generation
  event append failure handling
  pending mutation recovery handling

history API:
  GET /api/lws/objects/:id/history
  GET /api/lws/objects/:id/history/:eventId
  GET /api/lws/objects/:id/history/:eventId/diff
  lazy detail loading

index fallback:
  mutation can return INDEX_STALE warning before full read model exists
```

mutation/event consistency rule:

```text
1. service computes patch, inverse_patch, before_hash, after_hash before writing current JSON.
2. service writes a small pending mutation journal entry or equivalent recoverable intent before the object write.
3. object JSON write, patch file write, global event append, per-object history append, and head update are treated as one logical mutation.
4. if event/history append fails after object JSON write, the API returns EVENT_APPEND_FAILED and records a recoverable inconsistent state.
5. startup/status/admin validation must detect pending or incomplete mutation state.
6. recovery either completes the missing event/history writes from the journal or reports the object as requiring manual repair.
7. no successful mutation response is returned until object JSON and event/history records are both durable.
```

Phase 3 API exposure rule:

```text
1. mutation routes may exist for integration testing.
2. before Phase 5, mutation access is limited to local/system/bootstrap contexts from Phase 2.5.
3. public or ordinary account write access is not enabled until projection-backed PermissionService is implemented.
```

exit criteria:

```text
1. create/update/delete/restore never happen without event history.
2. patch and inverse_patch can reconstruct mutation intent.
3. rev conflict returns REV_CONFLICT.
4. history list/detail/diff works from JSONL/history files.
5. mutation response includes next rev and event id.
6. simulated event/history write failure cannot produce a successful mutation response.
7. status/admin validation can detect and report pending or incomplete mutation state.
```

### Phase 4 - SQLite Index And Read Models

목표: object 탐색, graph 이동, history lookup, search를 SQLite projection으로 수행한다.

```text
SQLite foundation:
  data/wiki/db/lws.sqlite
  schema version management
  index_meta
  index_builds
  INDEX_REBUILD_REQUIRED / INDEX_CORRUPT / INDEX_SCHEMA_MISMATCH handling

core projections:
  objects
  nodes
  edges
  object_tags
  graph_edges
  timeline_items
  events
  object_history
  validation_issues

permission projection baseline:
  accounts
  account_groups
  object_owners
  account_permissions

full rebuild:
  scan node source files
  scan edge source files
  validate objects
  rebuild SQLite projection
  write index_builds row
  implemented as an internal synchronous reindex command
  callable by tests, scripts, and later admin job wrapper

incremental update:
  update affected rows after POST/PATCH/DELETE/restore
  mark INDEX_STALE on projection failure
  keep object/event mutation successful when source write succeeded

list/search API:
  GET /api/lws/objects
  cursor pagination
  structured filters
  include_permissions option
  GET /api/lws/search
  SQLite FTS5 or fallback search

read model API:
  GET /api/lws/graph
  GET /api/lws/graph?center=svc.caddy&depth=1
  GET /api/lws/objects/:id/backlinks
  GET /api/lws/timeline
  GET /api/lws/ontology
```

Phase 4와 Phase 6의 reindex 역할 분리:

```text
Phase 4:
  ReindexCommand 또는 ReindexModule을 구현한다.
  source of truth에서 SQLite projection을 재생성하는 순수 backend capability이다.
  job queue, polling, cancel, client_job_id는 아직 필수 조건이 아니다.

Phase 6:
  Phase 4의 reindex command를 AdminService/JobService가 job envelope로 감싼다.
  frontend polling, cancel, idempotency, progress persistence를 제공한다.
```

permission-aware query baseline:

```text
1. anonymous list/search/graph는 public object만 반환한다.
2. private object 검색 본문은 anonymous 결과에 절대 포함하지 않는다.
3. projection-backed full account/group permission filtering은 Phase 5에서 완성한다.
4. Phase 4 query API는 Phase 2.5의 fail-closed baseline을 유지한다.
```

exit criteria:

```text
1. object list/search no longer scans source JSON files.
2. graph/backlinks navigation uses graph_edges projection.
3. timeline and ontology views use SQLite projection.
4. internal full reindex command can rebuild from source of truth without job framework.
5. incremental update keeps affected read model rows current after mutation.
6. anonymous read model APIs cannot leak private object summaries or search content.
```

### Phase 5 - Permission Enforcement

목표: account/permission edge 기반의 실제 read/write guard를 적용한다.

```text
account model:
  account.* node support
  account.system reserved account
  login_enabled=false reserved account handling
  group.* node support
  scope.* node support

permission edges:
  rel.owns
  rel.member_of
  rel.can_read
  rel.can_read_in
  rel.can_create_in
  rel.can_update
  rel.can_update_in
  rel.can_manage_in

PermissionService:
  resolveContext(accountId)
  assertCanRead(context, objectId)
  assertCanCreateIn(context, scopeOrCollectionId, objectKind)
  assertCanUpdate(context, objectId)
  assertCanManageIn(context, scopeId)
  request-local memoization
  fail closed on stale/corrupt permission projection

service enforcement:
  read public object
  read private object
  create node/edge in scope or collection
  update owned object
  update object by object/scope permission
  restore/delete guard
  admin action guard

session and permission API:
  GET /api/lws/session
  GET /api/lws/objects/:id/permissions
  viewer_permissions hints
  ui_capabilities hints

boundary validation:
  public/private edge rule
  public graph leakage check
  permission-aware list/search/graph query
```

Phase 5 upgrade rule:

```text
1. 기존 Phase 2.5 fail-closed baseline을 제거하지 않고 projection-backed 판정으로 확장한다.
2. PermissionService method signature는 Phase 2.5와 동일하게 유지한다.
3. unsupported or stale permission projection state still fails closed for private read and write.
4. account/group/scope permission changes trigger incremental permission projection updates.
```

exit criteria:

```text
1. anonymous can only read public current objects.
2. private read requires effective permission.
3. write/restore/delete require service guard approval.
4. frontend permission hints never replace backend guard checks.
5. permission graph changes update SQLite permission projection.
```

### Phase 6 - Admin Jobs And Recovery

목표: 운영/복구/검증 작업을 job contract로 실행한다.

```text
job framework:
  job id generation
  queued/running/succeeded/failed/canceled states
  runtime job status store
  progress shape
  error shape
  client_job_id idempotency baseline

admin APIs:
  POST /api/lws/admin/validate
  POST /api/lws/admin/reindex
  POST /api/lws/admin/materialize-core-ontology
  POST /api/lws/admin/backup
  POST /api/lws/admin/check-public-boundary
  GET /api/lws/admin/jobs
  GET /api/lws/admin/jobs/:jobId
  POST /api/lws/admin/jobs/:jobId/cancel

admin jobs:
  validation job
  full reindex job wrapper around Phase 4 reindex command
  materialize core ontology job
  backup job
  public boundary check job

recovery:
  INDEX_STALE recovery
  INDEX_CORRUPT recovery
  INDEX_SCHEMA_MISMATCH migration path
  storage doctor hardening
  failed event/index consistency report

audit:
  admin job event logging
  account.system / account.admin attribution
  requestId propagation
```

admin job layering:

```text
1. JobService owns job lifecycle, progress, cancellation state, and client_job_id idempotency.
2. AdminService owns capability guard and calls backend commands such as validate, reindex, backup, and materialize-core-ontology.
3. Reindex job delegates rebuild work to the Phase 4 reindex command.
4. materialize-core-ontology can create or repair node/edge JSON for built-in concepts, but Phase 2 validation must not depend on it.
```

exit criteria:

```text
1. admin actions return job envelope.
2. reindex can recover missing/corrupt SQLite index.
3. validation issues can be projected into SQLite.
4. backup writes outside app repo under configured backup root.
5. admin actions are permission guarded.
```

### Phase 7 - Later Hardening And V2 Extensions

목표: v1 core가 안정화된 뒤 성능/탐색/복원성을 확장한다.

```text
event lookup optimization:
  byte_offset validation
  event lookup index hardening
  event hash chain decision

history optimization:
  optional checkpoints
  compacted history pages
  runtime hot cache

event node materialization:
  selected event.* node creation
  history graph view
  event/log ontology refinement

search expansion:
  advanced FTS tuning
  semantic/vector search evaluation only after v1

migration hardening:
  schema migration runner
  dry-run migration report
  rollback strategy for migration jobs
```

exit criteria:

```text
1. v1 behavior remains compatible.
2. new optimizations are rebuildable from source of truth.
3. optional projections can be dropped and regenerated.
4. event/log materialization does not duplicate canonical history.
```

## 13. Backend non-goals for initial implementation

이 절은 v1 초기 구현의 범위를 보호하기 위한 제외 목록이다. 아래 항목은 L.W.S. 철학과 충돌해서 제외하는 것이 아니라, source of truth, event history, SQLite projection, permission enforcement를 먼저 안정화하기 위해 초기 구현에서 제외한다.

### 13.1 Authentication and collaboration

```text
real production authentication:
  secure login, password hashing, session rotation, secure cookie, CSRF protection,
  account lockout, password reset, OAuth/passkey는 초기 구현 범위 밖이다.
  단, RequestContext, account node, PermissionService guard, session API skeleton은 구현 범위에 포함한다.

multi-user real-time collaboration:
  websocket live editing, CRDT, operational transform, live cursor, simultaneous editor presence는 제외한다.
  rev/base_rev conflict와 PATCH history는 구현하지만 collaborative merge UX는 다루지 않는다.

distributed sync:
  여러 서버/장치 간 양방향 sync, offline-first replication, conflict-free distributed store는 제외한다.
  v1 source of truth는 단일하게 설정된 L.W.S. storage root set이다.
```

### 13.2 Storage and source of truth

```text
storing live knowledge inside app repo:
  실제 node/edge/event/index/backup/private knowledge를 app repo에 저장하지 않는다.
  app repo에는 code, docs, schema, mock fixture만 둔다.

hard delete:
  초기 삭제는 status=deleted mutation과 event history로 처리한다.
  파일 영구 삭제, history purge, privacy erasure workflow는 별도 정책 전까지 제외한다.

full revision snapshot by default:
  모든 revision의 full object snapshot을 저장하지 않는다.
  patch/inverse_patch와 before_hash/after_hash를 기본 history 전략으로 둔다.

server-wide git management:
  git commit, branch, push, pull, repo-wide rollback을 backend 기능으로 제공하지 않는다.
  history 모델은 git의 변경분 아이디어를 참고하지만 git 자체를 운영 계층으로 삼지 않는다.

schema migration runner:
  자동 schema migration 실행기, migration rollback, dry-run report는 v1 초기 범위 밖이다.
  schema version과 migration 필요 상태를 감지하는 contract만 먼저 둔다.
```

### 13.3 Database, graph, and search

```text
graph database:
  Neo4j 같은 별도 graph database는 사용하지 않는다.
  graph traversal은 SQLite projection의 graph_edges, objects, permission projection으로 처리한다.

vector database / semantic search:
  vector index, embedding generation, semantic ranking은 초기 구현 범위 밖이다.
  검색은 SQLite FTS5 또는 title/summary/alias/content 기반 fallback search로 시작한다.

advanced graph algorithms:
  centrality, clustering, graph layout optimization, path finding 같은 분석 알고리즘은 제외한다.
  v1 graph API는 center/depth, backlinks, relation filter 중심이다.

public search index separation at scale:
  public/private 전용 대규모 분리 index 운영은 초기 범위 밖이다.
  v1은 RequestContext와 permission-aware SQLite query로 public/private boundary를 지킨다.
```

### 13.4 Event and history expansion

```text
full event node materialization:
  event/log는 node-like object로 보지만 모든 event를 즉시 event.* node JSON으로 만들지 않는다.
  v1 canonical history는 JSONL event log, per-object history projection, patch file이다.

history graph view:
  history를 별도 graph view로 시각화하는 기능은 초기 구현 범위 밖이다.
  v1은 history list/detail/diff API를 먼저 구현한다.

checkpoint / compaction:
  N revision마다 checkpoint, monthly checkpoint, compacted history page는 초기 범위 밖이다.
  patch replay 성능 문제가 실제로 확인되면 Phase 7에서 검토한다.

public history publishing:
  public object의 current state read는 가능할 수 있지만, anonymous history/diff 공개는 초기 범위 밖이다.
  history에는 과거 private 값이 남아 있을 수 있으므로 보수적으로 닫아둔다.
```

### 13.5 External integrations and automation

```text
Cloudflare/Caddy/Docker/server automation:
  Caddy, Cloudflare, Docker, server 상태를 node/edge로 기록할 수는 있다.
  하지만 backend가 실제 인프라를 변경하거나 배포 자동화를 수행하지 않는다.

external API connector runtime:
  외부 API import pipeline의 설계 여지는 남겨둔다.
  그러나 실제 외부 connector, scheduler, credential vault, retry queue는 초기 구현 범위 밖이다.

real sample content generation:
  실제 knowledge storage에 자동 sample data를 생성하지 않는다.
  UI demo와 test는 mock fixture 또는 in-component mock data를 사용한다.

public publishing platform:
  static export, sitemap, RSS, SEO page publishing, public website hosting workflow는 초기 backend 범위 밖이다.
  public read boundary와 public graph validation은 backend safety 기능으로만 다룬다.
```

### 13.6 Admin and operations beyond v1

```text
enterprise backup system:
  v1 backup job은 configured backup root에 snapshot을 만드는 수준으로 제한한다.
  retention policy, encryption, deduplication, remote backup, disaster recovery orchestration은 제외한다.

advanced observability:
  distributed tracing, metrics dashboard, alerting integration은 초기 범위 밖이다.
  requestId, job status, error response, basic logs는 구현 범위에 포함한다.

advanced permission administration UI:
  backend는 permission edge와 projection을 지원한다.
  복잡한 role designer, policy simulator, permission diff/approval workflow는 초기 범위 밖이다.

visual diff merge editor:
  backend는 diff API와 restore mutation을 제공한다.
  사람이 직접 충돌을 시각적으로 병합하는 editor workflow는 초기 backend 범위 밖이다.
```
