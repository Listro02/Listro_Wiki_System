# L.W.S. Backend Implementation Report

작성일: 2026-07-01

이 문서는 `docs/LWS_BACKEND_DESIGN.md`의 backend implementation milestones를 기준으로 현재 구현된 범위, 검증 결과, 남은 위험을 정리한다.

현재 구현은 frontend product UX가 아니라 backend core contract를 우선한다. Source of truth는 여전히 app repo 밖의 `LWS_KNOWLEDGE_ROOT` 아래 node/edge JSON과 `LWS_DATA_ROOT` 아래 event/patch history이며, SQLite는 재생성 가능한 read model/projection으로만 사용한다.

## 1. 구현 요약

완료된 1차 backend vertical slice:

```text
Sprint A:
  Runtime/config/path safety

Sprint B:
  Node/edge schema validation
  Safe ObjectStore
  Minimal fail-closed permission boundary

Sprint C:
  Rev-based mutation
  JSON patch / inverse patch
  Event and per-object history preservation
  Pending mutation journal

Sprint D:
  SQLite generated read model
  Internal synchronous full reindex command
  Object/search/graph/timeline/ontology read services

Sprint E:
  Projection-backed permission enforcement
  Account/owner/permission edge projection

Sprint F:
  npm install and Next build validation
  Next 16 App Router dynamic route signature fix
  Incremental SQLite projection update after mutation
  Object permissions API
  AdminService / JobService skeleton
  Admin reindex job wrapper
  Failed mutation recovery report/repair command

Sprint G:
  HTTP RequestContext/auth adapter baseline
  Safe local bootstrap admin entrypoint for HTTP routes
  Validation, public-boundary, materialize-core-ontology, backup admin jobs
  Permission projection incremental update after permission graph mutation
  Route/server backend factory boundary adjustment
```

아직 구현하지 않은 범위:

```text
Thin frontend workbench
Production authentication
Cryptographic session/token authentication
Async/background job runner
Retention/encryption/remote backup policy
```

## 2. Sprint A - Runtime Foundation

참조 문서:

```text
docs/LWS_BACKEND_DESIGN.md
  Section 3 - 환경변수 contract
  Section 6.1 - Path resolver
  Section 12 - Phase 1 Runtime Foundation
```

구현된 파일:

```text
.env.example
.gitignore
package.json
tsconfig.json
next.config.ts
src/modules/config/runtime-config.ts
src/modules/storage/path-resolver.ts
src/modules/storage/storage-doctor.ts
src/shared/errors.ts
src/shared/api.ts
src/shared/request-context.ts
src/services/status-service.ts
src/services/session-service.ts
src/app/api/lws/health/route.ts
src/app/api/lws/status/route.ts
src/app/api/lws/session/route.ts
```

구현 내용:

```text
1. RuntimeConfig와 PublicConfig를 분리했다.
2. required env 누락, invalid enum, invalid boolean/integer를 차단한다.
3. storage root를 app root 기준 absolute path로 해석한다.
4. live storage root가 app repo 안에 들어오는 것을 차단한다.
5. SQLite path가 data root 밖에 있으면 CONFIG_INVALID로 실패한다.
6. production에서 LWS_SESSION_SECRET=change-me를 차단한다.
7. LWS_PUBLIC_GRAPH_ENABLED=true는 public boundary validator 완성 전까지 차단한다.
8. PathResolver는 object id를 직접 filesystem path로 쓰지 않고 base64url safe filename으로 변환한다.
9. `..`, slash, drive letter, UNC-like object id를 차단한다.
10. StorageDoctor는 missing root를 자동 생성하지 않고 status issue로 보고한다.
```

검증:

```powershell
npm.cmd run test:sprint-a
```

검증한 항목:

```text
dangerous env 차단
PublicConfig에 absolute storage path 미노출
object id -> safe filename 변환
path traversal / drive letter / UNC id 차단
missing storage root report
SQLite path outside data root 차단
production placeholder session secret 차단
```

## 3. Sprint B - Object Schema, Safe Store, Fail-Closed Boundary

참조 문서:

```text
docs/LWS_BACKEND_DESIGN.md
  Section 5 - Object model
  Section 6.2 - ObjectStore
  Section 7 - Validation rules
  Section 8.6 - RequestContext
  Section 12 - Phase 2 and Phase 2.5

docs/LWS_NODE_MODEL.md
docs/LWS_EDGE_MODEL.md
```

구현된 파일:

```text
schemas/node.schema.json
schemas/edge.schema.json
schemas/event.schema.json
schemas/storage-contract.schema.json
src/shared/object-model.ts
src/modules/ontology/builtin-ontology.ts
src/modules/validation/schema-validator.ts
src/modules/validation/semantic-validator.ts
src/modules/validation/validation-service.ts
src/modules/storage/object-store.ts
src/services/object-service.ts
src/services/permission-service.ts
src/app/api/lws/objects/[id]/route.ts
src/app/api/lws/objects/[id]/validation/route.ts
```

구현 내용:

```text
1. node/edge required shape를 TypeScript model과 validator로 구현했다.
2. object JSON 안의 `access` field를 schema validation에서 차단한다.
3. node.type, edge.type, tag를 문자열 label이 아니라 node id로 다룬다.
4. built-in virtual ontology registry를 두어 Phase 2에서 core ontology materialization 없이 검증한다.
5. edge.source / edge.target existence를 semantic validation에서 확인한다.
6. public edge는 source와 target이 모두 public일 때만 허용한다.
7. ObjectStore는 PathResolver를 통해서만 node/edge source JSON을 읽고 쓴다.
8. anonymous는 public current object만 읽을 수 있다.
9. private read와 write/admin action은 projection permission 전까지 fail closed로 둔다.
```

검증:

```powershell
npm.cmd run test:sprint-b
```

검증한 항목:

```text
real node/edge JSON read
structured schema validation error
anonymous public read allowed
anonymous private read denied
local-script bootstrap account private read allowed
embedded access field rejected
public edge to private target rejected
missing edge target rejected
```

## 4. Sprint C - Mutation, Rev, Event/Patch History

참조 문서:

```text
docs/LWS_BACKEND_DESIGN.md
  Section 6.3 - EventStore
  Section 9.4 - Node/Edge mutation API
  Section 9.5 - PATCH mutation contract
  Section 9.6 - History API
  Section 12 - Phase 3
```

구현된 파일:

```text
src/modules/revision/revision-checker.ts
src/modules/hashing/canonical-json.ts
src/modules/hashing/object-hash.ts
src/modules/patch/patch-engine.ts
src/modules/events/event-types.ts
src/modules/events/event-store.ts
src/services/mutation-service.ts
src/services/node-service.ts
src/services/edge-service.ts
src/services/history-service.ts
src/app/api/lws/nodes/route.ts
src/app/api/lws/nodes/[id]/route.ts
src/app/api/lws/edges/route.ts
src/app/api/lws/edges/[id]/route.ts
src/app/api/lws/objects/[id]/history/route.ts
src/app/api/lws/objects/[id]/history/[eventId]/route.ts
src/app/api/lws/objects/[id]/history/[eventId]/diff/route.ts
src/app/api/lws/objects/[id]/restore/route.ts
```

구현 내용:

```text
1. JSON Patch RFC 6902 subset add/replace/remove/test를 구현했다.
2. backend-managed fields인 id, rev, audit 등은 client patch로 수정할 수 없게 막았다.
3. base_rev conflict를 REV_CONFLICT로 반환한다.
4. inverse_patch와 changed_fields를 생성한다.
5. before_hash / after_hash를 canonical JSON 기반 sha256으로 계산한다.
6. mutation 전 pending journal을 runtime root 아래에 기록한다.
7. object JSON write, patch file, global event JSONL, per-object history link, head.json을 logical mutation으로 묶었다.
8. event/history append 실패 시 successful mutation response를 반환하지 않는다.
9. 실패 journal은 StorageDoctor issue로 노출된다.
10. restore는 과거 파일을 덮어쓰지 않고 inverse_patch 기반 새 mutation event를 만든다.
```

검증:

```powershell
npm.cmd run test:sprint-c
```

검증한 항목:

```text
create/update/delete/restore event history 생성
rev increment
REV_CONFLICT
patch/inverse_patch 기록
history list/detail/diff read
simulated event append failure -> EVENT_APPEND_FAILED
failed mutation journal detection
```

주의:

```text
현재 event append failure 후 object JSON write 자체를 자동 rollback하지 않는다.
대신 문서 계약에 따라 successful response를 막고 failed journal로 recoverable inconsistent state를 남긴다.
Phase 6 recovery job에서 complete-or-manual-repair 흐름을 구현해야 한다.
```

## 5. Sprint D - SQLite Generated Read Model

참조 문서:

```text
docs/LWS_BACKEND_DESIGN.md
  Section 6.4 - IndexStore
  Section 9.2 - Object list/read API
  Section 9.3 - Search API
  Section 9.8 - Read model API
  Section 11 - Indexing model
  Section 12 - Phase 4
```

구현된 파일:

```text
src/modules/indexing/sqlite-schema.ts
src/modules/indexing/index-store.ts
src/modules/indexing/reindex-command.ts
src/modules/query/cursor.ts
src/services/object-query-service.ts
src/services/graph-service.ts
src/services/timeline-service.ts
src/services/ontology-service.ts
src/app/api/lws/objects/route.ts
src/app/api/lws/search/route.ts
src/app/api/lws/graph/route.ts
src/app/api/lws/objects/[id]/backlinks/route.ts
src/app/api/lws/timeline/route.ts
src/app/api/lws/ontology/route.ts
```

구현 내용:

```text
1. Node.js built-in node:sqlite 기반 IndexStore를 구현했다.
2. index_meta, index_builds, objects, nodes, edges, object_tags, graph_edges, timeline_items, validation_issues, permission tables를 생성한다.
3. ReindexCommand는 source JSON을 scan하고 validation 결과를 projection에 반영한다.
4. full reindex는 아직 admin job이 아니라 internal synchronous backend command이다.
5. object list/search/graph/backlinks/timeline/ontology service는 SQLite projection을 읽는다.
6. anonymous read model query는 public object만 반환한다.
7. anonymous search 결과에 private object summary/content가 포함되지 않게 했다.
```

검증:

```powershell
npm.cmd run test:sprint-d
```

검증한 항목:

```text
full reindex from source JSON
index status ready
object list uses public-only anonymous filtering
search public/private filtering
graph_edges projection 기반 graph query
backlinks query
timeline public-only filtering
```

남은 일:

```text
mutation 이후 affected object projection incremental update를 구현했다.
다만 permission graph mutation 이후 permission projection incremental update는 아직 full reindex에 의존한다.
```

## 6. Sprint E - Permission Enforcement

참조 문서:

```text
docs/LWS_BACKEND_DESIGN.md
  Section 8 - Permission model
  Section 9.7 - Session and permission API
  Section 12 - Phase 5
```

구현된 파일:

```text
src/services/permission-service.ts
src/modules/indexing/reindex-command.ts
src/modules/indexing/sqlite-schema.ts
```

구현 내용:

```text
1. 기존 fail-closed baseline을 제거하지 않고 projection-backed permission으로 확장했다.
2. account.* node를 accounts projection으로 만든다.
3. rel.member_of edge를 account_groups projection으로 만든다.
4. rel.owns edge를 object_owners projection으로 만든다.
5. rel.can_read, rel.can_read_in, rel.can_create_in, rel.can_update, rel.can_update_in, rel.can_manage_in edge를 account_permissions projection으로 만든다.
6. PermissionService는 SQLite projection이 ready가 아니면 private read와 write를 fail closed 처리한다.
7. object read, create, update pipeline은 PermissionService guard를 통과해야 한다.
8. frontend permission hint는 viewer_permissions로만 제공되며 mutation 승인 근거로 쓰지 않는다.
```

검증:

```powershell
npm.cmd run test:sprint-e
```

검증한 항목:

```text
permission edge 기반 private object read
anonymous private read denied
owner update allowed
rel.can_create_in 기반 create allowed
permission 없는 account create denied
```

## 7. API Surface Status

현재 route는 service adapter 역할만 하도록 구성했다.

구현된 API:

```text
GET    /api/lws/health
GET    /api/lws/status
GET    /api/lws/session

GET    /api/lws/objects
GET    /api/lws/objects/:id
GET    /api/lws/objects/:id/validation
GET    /api/lws/objects/:id/permissions
GET    /api/lws/search
GET    /api/lws/graph
GET    /api/lws/objects/:id/backlinks
GET    /api/lws/timeline
GET    /api/lws/ontology

POST   /api/lws/nodes
PATCH  /api/lws/nodes/:id
DELETE /api/lws/nodes/:id
POST   /api/lws/edges
PATCH  /api/lws/edges/:id
DELETE /api/lws/edges/:id

GET    /api/lws/objects/:id/history
GET    /api/lws/objects/:id/history/:eventId
GET    /api/lws/objects/:id/history/:eventId/diff
POST   /api/lws/objects/:id/restore

POST   /api/lws/admin/reindex
POST   /api/lws/admin/validate
POST   /api/lws/admin/check-public-boundary
POST   /api/lws/admin/materialize-core-ontology
POST   /api/lws/admin/backup
GET    /api/lws/admin/jobs
GET    /api/lws/admin/jobs/:jobId
POST   /api/lws/admin/jobs/:jobId/cancel
GET    /api/lws/admin/recovery
POST   /api/lws/admin/recovery/repair
```

주의:

```text
API route는 HTTP RequestContext adapter를 통과한다.
development/test의 local auth mode에서만 x-lws-local-admin-secret이 LWS_SESSION_SECRET과 일치하면 bootstrap admin으로 승격된다.
production에서는 local-script HTTP 승격이 비활성화된다.
session header가 보낸 account id는 아직 신뢰하지 않고 anonymous로 fail closed 처리한다.
따라서 production-grade session/token authentication은 아직 후속 작업이다.
```

## 8. Sprint F - Build, Incremental Index, Admin Jobs, Recovery

참조 문서:

```text
docs/LWS_BACKEND_DESIGN.md
  Section 9.7 - Session and permission API
  Section 9.9 - Admin API and jobs
  Section 11 - Indexing model
  Section 12 - Phase 4 and Phase 6
```

구현된 파일:

```text
package-lock.json
src/modules/jobs/job-types.ts
src/modules/jobs/job-store.ts
src/services/job-service.ts
src/services/admin-service.ts
src/app/api/lws/objects/[id]/permissions/route.ts
src/app/api/lws/admin/reindex/route.ts
src/app/api/lws/admin/jobs/route.ts
src/app/api/lws/admin/jobs/[jobId]/route.ts
src/app/api/lws/admin/jobs/[jobId]/cancel/route.ts
src/app/api/lws/admin/recovery/route.ts
src/app/api/lws/admin/recovery/repair/route.ts
tests/sprint-f.test.ts
```

구현 내용:

```text
1. npm install을 수행하고 package-lock.json을 생성했다.
2. Next 16 App Router dynamic route context가 params Promise를 요구하므로 [id] route signatures를 수정했다.
3. npm.cmd run build로 TypeScript/Next build를 통과했다.
4. mutation 성공 후 IndexStore.updateObjectProjection()으로 affected object projection을 갱신한다.
5. projection update 실패 시 mutation은 유지하고 INDEX_STALE warning/metadata를 남긴다.
6. GET /api/lws/objects/:id/permissions route를 추가했다.
7. JobStore, JobService, AdminService skeleton을 추가했다.
8. POST /api/lws/admin/reindex는 Phase 4 ReindexCommand를 synchronous job envelope로 감싼다.
9. EventStore failed/pending mutation journal에 commit payload를 보존한다.
10. recovery report와 repair command를 추가했다.
```

검증:

```powershell
npm.cmd run test:sprint-f
npm.cmd run build
```

검증한 항목:

```text
admin reindex job succeeded envelope
job persisted in runtime job store
mutation after reindex updates SQLite projection without full reindex
search reflects updated projection
failed event append leaves repairable journal
recovery report exposes failed repairable mutation
repair command completes missing event/history from journal payload
Next build/typecheck succeeds
```

주의:

```text
Next build는 성공하지만 Turbopack NFT tracing warning이 1개 남아 있다.
warning은 path/fs 기반 backend modules가 App Route dependency graph에 들어가면서 whole project trace 가능성을 알리는 내용이다.
현재 실패 조건은 아니지만, 향후 route runtime packaging을 더 엄격하게 다듬을 때 분리 검토가 필요하다.
```

## 9. Sprint G - HTTP Auth Boundary And Admin Jobs

참조 문서:

```text
docs/LWS_BACKEND_DESIGN.md
  Section 8.6 - RequestContext
  Section 9.9 - Admin API and jobs
  Section 11 - Indexing model
  Section 12 - Phase 5 and Phase 6

docs/LWS_NODE_MODEL.md
docs/LWS_EDGE_MODEL.md
```

구현된 파일:

```text
src/modules/auth/request-context-adapter.ts
src/modules/admin/storage-validation-job.ts
src/modules/admin/public-boundary-checker.ts
src/modules/backup/backup-writer.ts
src/modules/ontology/core-ontology-materializer.ts
src/server/lws-backend.ts
src/modules/indexing/index-store.ts
src/modules/indexing/reindex-command.ts
src/services/admin-service.ts
src/app/api/lws/admin/validate/route.ts
src/app/api/lws/admin/check-public-boundary/route.ts
src/app/api/lws/admin/materialize-core-ontology/route.ts
src/app/api/lws/admin/backup/route.ts
tests/sprint-g.test.ts
```

구현 내용:

```text
1. HTTP RequestContext adapter를 추가했다.
2. local-script bootstrap admin HTTP entrypoint는 development/test + local auth mode + LWS_SESSION_SECRET 일치 조건에서만 열린다.
3. session header account id는 아직 신뢰하지 않고 anonymous로 처리한다.
4. 모든 주요 API route가 backend.resolveRequestContext(request)를 통해 context를 생성한다.
5. AdminService에 validate, check-public-boundary, materialize-core-ontology, backup job wrapper를 추가했다.
6. validation job은 source JSON을 scan하고 validation_issues projection을 갱신한다.
7. check-public-boundary job은 public edge boundary violation을 scan한다.
8. materialize-core-ontology job은 type/relation/scope/account/group core nodes와 admin permission edges를 source-of-truth mutation으로 생성한다.
9. backup writer는 configured LWS_BACKUP_ROOT 아래에 knowledge/data snapshot과 manifest를 쓰며, backup target이 copied source root 내부에 들어가면 실패한다.
10. IndexStore.rebuildPermissionProjection()을 공통화하고 permission 관련 node/edge mutation 이후 permission projection을 incremental update한다.
11. App Route 내부 factory 의존을 src/server/lws-backend.ts로 분리해 server module boundary를 조정했다.
```

검증:

```powershell
npm.cmd run test:sprint-g
npm.cmd run build
```

검증한 항목:

```text
local admin HTTP adapter 승격
잘못된 local admin secret fail closed
untrusted session header anonymous 처리
materialize-core-ontology job success
admin reindex job 이후 index ready
permission edge mutation 후 full reindex 없이 private read permission 반영
validation job success and validation_issues projection update
public boundary job success
backup job manifest 생성
Next build/typecheck success
```

주의:

```text
Turbopack NFT tracing warning은 1개 남아 있다.
원인은 route/server graph 안에 PathResolver의 fs/path 기반 storage safety code가 포함되는 것으로 좁혀졌다.
backend safety code를 제거하지 않고 완전 제거되지는 않았으며, 현재 build failure는 아니다.
```

## 10. 검증 요약

현재 통과한 테스트:

```powershell
npm.cmd run test:sprint-a
npm.cmd run test:sprint-b
npm.cmd run test:sprint-c
npm.cmd run test:sprint-d
npm.cmd run test:sprint-e
npm.cmd run test:sprint-f
npm.cmd run test:sprint-g
npm.cmd run build
```

테스트 환경:

```text
Node.js 24
node --experimental-strip-types
node:sqlite
temp storage root
Next.js 16.2.9
```

아직 수행하지 않은 검증:

```text
npm run dev
real Next.js route runtime smoke test
```

이유:

```text
npm install과 npm run build는 완료했다.
dev server와 실제 HTTP smoke test는 아직 실행하지 않았다.
```

## 11. 설계 계약 준수 상태

준수한 계약:

```text
1. app repo는 code/schema/docs/test 중심으로 유지한다.
2. live storage root는 env로 지정된 repo 밖 path를 전제로 한다.
3. object id를 filesystem path로 직접 쓰지 않는다.
4. browser/frontend가 storage를 직접 읽거나 쓰는 코드는 없다.
5. API route는 service adapter로만 구성했다.
6. node.type, edge.type, tags, relation type은 node id로 검증한다.
7. edge는 first-class object로 저장하고 history를 가진다.
8. public edge boundary를 backend validation으로 강제한다.
9. permission은 node/edge graph와 SQLite projection으로 해석한다.
10. mutation success는 event/history commit 이후에만 반환한다.
11. SQLite는 source of truth가 아니라 disposable projection이다.
```

부분 구현 또는 후속 필요:

```text
1. production-grade session/token authentication
2. async/background job runner and cancellation semantics
3. backup retention/encryption/remote copy policy
4. route runtime smoke tests against a real Next dev server
5. thin frontend workbench
```

## 12. 다음 권장 작업

다음 순서는 HTTP auth boundary를 실제 session/token adapter로 확장하고, 그 뒤 thin frontend workbench를 read-only부터 붙이는 작업을 권장한다.

```text
1. signed session/token verification adapter 구현
2. dev server 기반 HTTP smoke test 추가
3. async job runner와 client_job_id idempotency 보강
4. validation/public-boundary 결과 조회 API 정리
5. backup retention/restore dry-run command 설계
6. read-only Object Explorer와 Status/Index panel thin workbench 구현
7. Turbopack NFT tracing warning을 Next/Turbopack issue와 route runtime packaging 관점에서 계속 추적
```

Thin frontend workbench는 storage를 직접 읽지 않고 service/API contract 검증용으로만 붙인다.
