# L.W.S. Backend Completion Review

검토일: 2026-07-01

## 0. Scope

이 문서는 현재 repository의 L.W.S. backend 구현이 설계 문서 대비 얼마나 구현되었는지 검토한 결과이다.

설계 기준으로 사용한 문서는 아래 3개뿐이다.

- `docs/LWS_BACKEND_DESIGN.md`
- `docs/LWS_NODE_MODEL.md`
- `docs/LWS_EDGE_MODEL.md`

판단 근거로는 source code, schema, tests, API route를 읽었다. README, frontend design, implementation report, precedent research, 기존 대화 내용은 설계 근거로 사용하지 않았다.

Phase 7 이후 항목은 구현 완료도가 아니라 후속 범위로 분리했다.

## 1. Overall Completion

백엔드 core 기준 구현 완료도는 약 68%로 판단한다.

Phase 1-2는 대부분 구현되어 있고, Phase 3-4도 핵심 골격은 존재한다. 다만 Phase 5 permission-aware query, Phase 6 job/recovery 완성도, event/history SQLite projection, mutation recovery idempotency, 일부 API route의 service-layer 위반 때문에 backend core를 완료 상태로 보기는 어렵다.

요약하면 현재 구현은 "source JSON object + event/history + SQLite projection" 아키텍처를 향하고 있으며, 주요 service/module 골격은 존재한다. 그러나 durable mutation consistency, permission projection 기반 query enforcement, admin job framework는 아직 운영급 계약을 완전히 만족하지 못한다.

## 2. Phase Completion Table

| Phase | 설계 요구 | 구현 상태 | 근거 파일 | 남은 작업 | 위험도 |
| --- | --- | --- | --- | --- | --- |
| Phase 1 Runtime/config/path safety | 필수 env, root 분리, public/secret config 분리, root 밖 접근 차단 | Complete | `src/modules/config/runtime-config.ts`, `src/modules/storage/path-resolver.ts`, `src/modules/storage/storage-doctor.ts` | EventStore의 event/history path에도 PathResolver 수준의 검증 일관 적용 | Medium |
| Phase 2 Node/edge schema and ObjectStore | node/edge schema, semantic validation, ObjectStore, safe object path | Complete | `src/modules/validation/schema-validator.ts`, `src/modules/validation/semantic-validator.ts`, `src/modules/storage/object-store.ts`, `schemas/node.schema.json`, `schemas/edge.schema.json` | JSON Schema와 runtime validator 동기화 유지 | Low |
| Phase 2.5 Minimal fail-closed permission boundary | anonymous public-only read, private/write/admin fail-closed, untrusted frontend account 거부 | Partial | `src/services/permission-service.ts`, `src/modules/auth/request-context-adapter.ts`, `src/services/object-service.ts` | validation route의 private read leak 방지, 모든 read/admin route를 service guard로 통일 | High |
| Phase 3 Mutation with rev + event/patch history | base_rev, patch/inverse_patch, event log, per-object history, pending mutation recovery | Partial | `src/services/mutation-service.ts`, `src/modules/events/event-store.ts`, `src/modules/patch/patch-engine.ts`, `src/modules/revision/revision-checker.ts` | crash durability, partial append idempotent repair, fsync/atomicity hardening, event id path validation | High |
| Phase 4 SQLite generated read model and reindex | source of truth에서 SQLite projection 재생성, list/search/graph/timeline/ontology API | Partial | `src/modules/indexing/sqlite-schema.ts`, `src/modules/indexing/reindex-command.ts`, `src/modules/indexing/index-store.ts`, `src/services/object-query-service.ts`, `src/services/graph-service.ts`, `src/services/timeline-service.ts`, `src/services/ontology-service.ts` | `events`, `object_history` projection 채우기, index state aware errors, FTS5/include_permissions 보강 | Medium |
| Phase 5 Real permission enforcement | account/group/scope permission edge 기반 read/write/admin guard, stale/corrupt fail-closed | Partial | `src/services/permission-service.ts`, `src/modules/indexing/index-store.ts`, `src/app/api/lws/objects/[id]/permissions/route.ts` | list/search/graph/timeline/ontology에서 account별 effective permission filtering, old/new permission edge stale 제거 | High |
| Phase 6 Admin jobs and recovery | validation/reindex/backup/public-boundary/materialize jobs, job lifecycle, recovery, audit | Partial | `src/services/admin-service.ts`, `src/services/job-service.ts`, `src/modules/jobs/job-store.ts`, `src/modules/admin/storage-validation-job.ts`, `src/modules/admin/public-boundary-checker.ts`, `src/modules/backup/backup-writer.ts` | true queue, cancellation-aware jobs, client_job_id idempotency, admin event audit logging, stronger recovery report | Medium |

## 3. Core Design Principles

### Source of Truth

Partial.

Node/edge JSON은 `ObjectStore`가 `LWS_KNOWLEDGE_ROOT` 아래에서 읽고 쓴다. Event/patch/history도 `EventStore`에 구현되어 있다. Mutation service는 object write 전에 pending journal을 준비하고, object JSON write 이후 event/history commit이 실패하면 성공 응답을 반환하지 않는다.

근거:

- `src/modules/storage/object-store.ts`
- `src/modules/events/event-store.ts`
- `src/services/mutation-service.ts`

남은 문제:

- `ObjectStore.writeObjectPrimitive()`는 service 외부에서도 호출 가능하므로 public API가 아니더라도 source of truth를 history 없이 변경할 수 있는 primitive가 열려 있다.
- partial event append 후 recovery가 빠진 조각만 보충하는 방식이 아니라 commit을 다시 실행한다.
- event/history path가 PathResolver를 통하지 않는다.

### SQLite Projection

Partial.

SQLite는 source of truth가 아니라 generated read model로 설계되어 있고, full reindex command가 source node/edge JSON을 스캔해 projection을 다시 만든다.

근거:

- `src/modules/indexing/reindex-command.ts`
- `src/modules/indexing/index-store.ts`
- `src/modules/indexing/sqlite-schema.ts`

남은 문제:

- `events`와 `object_history` table은 schema에 있지만 reindex가 event log/history JSONL을 스캔해 채우지 않는다.
- query service가 index status를 먼저 확인하지 않아 missing/corrupt DB 상태가 설계된 LWS error로 안정적으로 변환되지 않을 수 있다.

### Path Safety

Mostly complete for object paths.

Object id는 파일명으로 직접 쓰지 않고 base64url safe segment로 변환된다. `PathResolver`는 absolute path, traversal segment, drive injection, UNC path, root escape를 차단한다.

근거:

- `src/modules/storage/path-resolver.ts`
- `tests/sprint-a.test.ts`

남은 문제:

- `EventStore`는 event/history/patch/journal path를 직접 `path.join()`으로 구성한다.
- `source_event_id` 같은 route body 값이 patch path 구성에 쓰이므로 별도 safe id 검증이 필요하다.

### Node/Edge Model

Mostly complete.

`node.type`, `edge.type`, `tags`는 단순 label이 아니라 node id 또는 built-in virtual ontology id로 검증된다. relation type도 `rel.*` node id로 다뤄진다. Edge는 source/target/type을 가진 first-class object로 저장, 검증, mutation/history 처리된다.

근거:

- `src/shared/object-model.ts`
- `src/modules/validation/schema-validator.ts`
- `src/modules/validation/semantic-validator.ts`
- `src/modules/ontology/builtin-ontology.ts`

남은 문제:

- tag 검증은 `tag.*` prefix를 accepted virtual tag로 허용하므로 실제 tag node materialization 강제는 아직 약하다.
- relation/type ontology materialization은 Phase 6 admin job으로 존재하지만, 실제 운영 데이터에서 ontology completeness를 강제하는 수준은 아니다.

### Permission Model

Partial.

Object JSON 안의 `access` field는 금지되어 있고, permission edge/projection 기반 모델이 구현되어 있다. Anonymous는 public read만 가능하고 write/admin은 fail-closed로 동작한다.

근거:

- `src/modules/validation/schema-validator.ts`
- `src/services/permission-service.ts`
- `src/modules/indexing/index-store.ts`

남은 문제:

- list/search/graph/timeline/ontology query는 anonymous public filter만 적용한다. 로그인 account의 effective permission filtering은 부족하다.
- `GET /api/lws/objects/:id/validation`은 private object read guard 없이 objectStore를 직접 읽는다.
- permission edge가 permission relation에서 일반 relation으로 바뀌는 mutation에서 old grant가 projection에 남을 위험이 있다.

### Mutation Durability

Partial.

Mutation service는 `preparePendingMutation()` 후 object JSON을 쓰고, event/patch/history/head를 commit한다. 실패 시 `EVENT_APPEND_FAILED`를 반환하고 failed journal을 남긴다. 테스트도 simulated event failure를 검증한다.

근거:

- `src/services/mutation-service.ts`
- `src/modules/events/event-store.ts`
- `tests/sprint-c.test.ts`
- `tests/sprint-f.test.ts`

남은 문제:

- object write는 atomic rename이지만 fsync 수준 durability는 없다.
- event commit 내부의 patch write, global event append, object history append, head update는 하나의 filesystem transaction이 아니다.
- recovery가 idempotent하지 않으면 중복 global event append 가능성이 있다.

### Admin/Recovery

Partial.

AdminService가 validate/reindex/materialize-core-ontology/backup/check-public-boundary/recovery를 제공하고, JobService가 queued/running/succeeded/failed/canceled envelope를 저장한다.

근거:

- `src/services/admin-service.ts`
- `src/services/job-service.ts`
- `src/modules/jobs/job-store.ts`
- `src/modules/backup/backup-writer.ts`

남은 문제:

- 현재 job은 synchronous wrapper이다. true queue, polling progress, cancellation-aware execution은 없다.
- `client_job_id` field는 있으나 idempotency lookup이 없다.
- admin job event logging, requestId propagation, account.system/account.admin attribution audit가 부족하다.

## 4. Implemented Items

- Runtime config loader가 필수 env를 요구하고, storage root를 absolute path로 정규화한다: `src/modules/config/runtime-config.ts`.
- PublicConfig가 absolute storage path와 secret을 노출하지 않는다: `src/modules/config/runtime-config.ts`.
- production에서 `LWS_SESSION_SECRET=change-me`를 막는다: `src/modules/config/runtime-config.ts`.
- public graph enabled를 boundary validator 구현 전 차단한다: `src/modules/config/runtime-config.ts`.
- object id를 파일 경로로 직접 쓰지 않고 base64url filename으로 변환한다: `src/modules/storage/path-resolver.ts`.
- node/edge read/write primitive와 list source files가 있다: `src/modules/storage/object-store.ts`.
- node/edge runtime schema validation이 있다: `src/modules/validation/schema-validator.ts`.
- `access` field embedded permission을 거부한다: `src/modules/validation/schema-validator.ts`, `schemas/node.schema.json`, `schemas/edge.schema.json`.
- node.type, edge.type, tags semantic validation이 있다: `src/modules/validation/semantic-validator.ts`.
- public edge source/target public boundary rule이 있다: `src/modules/validation/semantic-validator.ts`.
- anonymous public-only read, local bootstrap/system privileged context가 구현되어 있다: `src/services/permission-service.ts`, `src/modules/auth/request-context-adapter.ts`.
- create/patch/delete/restore mutation API와 service가 있다: `src/services/mutation-service.ts`, `src/services/node-service.ts`, `src/services/edge-service.ts`.
- rev conflict check가 있다: `src/modules/revision/revision-checker.ts`.
- JSON Patch subset과 inverse patch generation이 있다: `src/modules/patch/patch-engine.ts`.
- before_hash/after_hash 계산이 있다: `src/modules/hashing/object-hash.ts`.
- global event JSONL, object history JSONL, patch record, head.json write가 있다: `src/modules/events/event-store.ts`.
- pending/failed/committed mutation journal과 recovery report가 있다: `src/modules/events/event-store.ts`, `src/modules/storage/storage-doctor.ts`.
- SQLite schema, full reindex command, objects/nodes/edges/tags/graph/timeline/validation/permission projection이 있다: `src/modules/indexing/sqlite-schema.ts`, `src/modules/indexing/reindex-command.ts`, `src/modules/indexing/index-store.ts`.
- list/search/graph/backlinks/timeline/ontology read APIs가 있다: `src/services/object-query-service.ts`, `src/services/graph-service.ts`, `src/services/timeline-service.ts`, `src/services/ontology-service.ts`.
- permission projection이 account/group/owner/capability relation에서 생성된다: `src/modules/indexing/index-store.ts`.
- admin validate/reindex/materialize-core-ontology/backup/check-public-boundary/recovery routes가 있다: `src/app/api/lws/admin/*`.
- backup writer가 configured backup root 아래 snapshot manifest를 만든다: `src/modules/backup/backup-writer.ts`.
- frontend page는 storage를 직접 읽거나 쓰지 않는다: `src/app/page.tsx`, `src/app/layout.tsx`.

## 5. Missing Or Partial Items

- Phase 2.5: `GET /api/lws/objects/:id/validation`이 service permission guard 없이 objectStore를 직접 읽는다. Private object metadata leak 가능성이 있다.
- Phase 3: event/history append failure 후 partial write 상태를 정확히 식별하고 빠진 기록만 복구하는 idempotent recovery가 없다.
- Phase 3: event id와 patch path 입력값 검증이 부족하다.
- Phase 3: no successful mutation response rule은 구현되어 있으나, storage-level fsync/durable write guarantee는 불명확하다.
- Phase 4: SQLite `events`와 `object_history` projection이 source event/history에서 재생성되지 않는다.
- Phase 4: object list/search는 SQLite를 쓰지만 FTS5는 없다. 현재 `LIKE` fallback search에 가깝다.
- Phase 4: `include_permissions` option은 구현되지 않았다.
- Phase 5: account별 permission-aware list/search/graph/timeline/ontology filtering이 부족하다.
- Phase 5: permission graph 변경 시 incremental projection update는 있으나, old permission edge가 non-permission edge로 바뀌는 경우 stale grant 제거 위험이 있다.
- Phase 6: true async job queue, cancel propagation, progress persistence, client_job_id idempotency baseline이 완성되지 않았다.
- Phase 6: admin job event logging과 audit attribution이 부족하다.
- Phase 6: INDEX_CORRUPT/INDEX_SCHEMA_MISMATCH migration path는 status detection 수준에 가깝고 recovery workflow는 제한적이다.

## 6. Potential Bugs And Risks

### High

1. Private object validation leak

   `src/app/api/lws/objects/[id]/validation/route.ts`에서 `backend.objectStore.readObject()`를 직접 호출하고 permission guard를 적용하지 않는다. Anonymous가 private object id를 알고 있으면 validation response를 통해 existence와 schema 상태를 알 수 있다.

2. Event path traversal surface

   `src/modules/events/event-store.ts`는 `eventId`를 `patches/${eventId}.json` path에 직접 사용한다. `restore` route body의 `source_event_id`도 별도 safe id 검증 없이 들어온다. 현재 event id는 내부 생성 시 안전하지만, restore/history API 입력값까지 동일하게 안전하다고 볼 수 없다.

3. Partial event commit repair is not idempotent

   `EventStore.commitMutation()`은 patch write, global event append, object history append, head write를 순차 수행한다. 중간 실패 후 `repairMutation()`이 같은 commit을 다시 실행하면 이미 append된 global event가 중복될 수 있다.

4. Permission projection stale grant risk

   `IndexStore.updateObjectProjection()`은 변경 후 object가 permission-relevant일 때만 permission projection을 rebuild한다. 기존 `rel.can_read` edge가 다른 type으로 바뀌면 변경 후 object는 permission-relevant가 아니므로 old grant가 projection에 남을 수 있다.

### Medium

5. Query services do not consistently check index status

   `ObjectQueryService`, `GraphService`, `TimelineService`, `OntologyService`는 `indexStore.open()`으로 바로 DB를 연다. missing/corrupt/schema mismatch 상태에서 설계된 LWS error 대신 raw/internal error가 나올 수 있다.

6. Admin jobs are synchronous wrappers

   Job envelope는 있으나 실제 queue/poll/cancel-aware execution은 아니다. `cancelJob()`은 status file만 바꿀 수 있고 실행 중 작업을 중단시키지 않는다.

7. Backup includes generated data and manifest with absolute source roots

   Backup 자체는 configured backup root 아래 생성되지만 manifest에 source absolute root가 들어간다. 운영 환경에서 manifest 노출 정책이 필요하다.

### Low

8. Runtime JSON Schema and TypeScript validator can diverge

   `schemas/*.json`과 `schema-validator.ts`가 모두 존재하지만, runtime이 JSON Schema 파일을 직접 사용하지는 않는다. 둘 사이 차이가 생기면 schema contract drift가 생길 수 있다.

## 7. Test And Verification State

### Existing tests

- `tests/sprint-a.test.ts`: runtime/config/path safety
- `tests/sprint-b.test.ts`: object schema, ObjectStore, minimal permission boundary, public edge boundary
- `tests/sprint-c.test.ts`: mutation, rev conflict, event/history, restore, simulated event failure
- `tests/sprint-d.test.ts`: SQLite reindex, object list/search, graph/backlinks, timeline anonymous filtering
- `tests/sprint-e.test.ts`: permission projection and enforcement
- `tests/sprint-f.test.ts`: incremental index update, admin reindex job, recovery repair
- `tests/sprint-g.test.ts`: HTTP auth context, admin jobs, ontology materialization, backup, incremental permission projection

### Commands executed

Initial commands failed because PowerShell blocked `npm.ps1` by execution policy:

```powershell
npm run test:sprint-a
npm run test:sprint-b
npm run test:sprint-c
npm run test:sprint-d
npm run test:sprint-e
npm run test:sprint-f
npm run test:sprint-g
```

Failure reason:

```text
npm : 이 시스템에서 스크립트를 실행할 수 없으므로 C:\Program Files\nodejs\npm.ps1 파일을 로드할 수 없습니다.
```

Then tests were rerun with `npm.cmd`:

```powershell
npm.cmd run test:sprint-a
npm.cmd run test:sprint-b
npm.cmd run test:sprint-c
npm.cmd run test:sprint-d
npm.cmd run test:sprint-e
npm.cmd run test:sprint-f
npm.cmd run test:sprint-g
```

Result:

```text
Sprint A runtime/config/path safety checks passed.
Sprint B object schema/store/permission boundary checks passed.
Sprint C mutation/event/history consistency checks passed.
Sprint D SQLite reindex/read-model checks passed.
Sprint E permission projection/enforcement checks passed.
Sprint F incremental index/admin job/recovery checks passed.
Sprint G auth/admin jobs/backup/incremental permission projection checks passed.
```

### Missing tests

- Anonymous access to `GET /api/lws/objects/:id/validation` for private object.
- Unsafe `source_event_id` or event id path traversal in history/restore APIs.
- Failure injection at each step of event commit: patch write, global append, object history append, head write.
- Idempotent recovery from partial event append.
- Permission edge type mutation from permission relation to non-permission relation.
- Query service behavior when SQLite DB is missing, corrupt, stale, or schema-mismatched.
- SQLite full reindex of event/history projection.
- Admin job `client_job_id` idempotency.
- Cancel behavior during long-running admin job.

## 8. Recommended Implementation Priority

1. Harden EventStore path safety.

   Add safe event id validation and route body validation for `source_event_id`, history `eventId`, patch path, journal path. Prefer routing all storage-relative paths through one safe resolver or equivalent root assertion.

2. Close read leaks before expanding features.

   Make validation and permissions routes service adapters. Ensure every current-object read uses `PermissionService.assertCanRead()`.

3. Make mutation recovery idempotent.

   Record commit step state or make each step detect existing records by `event_id`. Recovery should complete missing writes, not blindly append all records again.

4. Fix permission projection stale updates.

   On edge update, compare old and new object relevance. If either old or new edge is permission-relevant, rebuild or incrementally repair permission projection.

5. Add permission-aware query contract.

   Extend list/search/graph/timeline/ontology queries beyond anonymous public filter. Apply effective account/group/object/scope permissions from projection and fail closed on stale/corrupt permission projection.

6. Complete SQLite event/history projection.

   Reindex should scan event JSONL and per-object history files, populate `events` and `object_history`, and report inconsistencies.

7. Finish Phase 6 job contract.

   Implement client_job_id idempotency, progress persistence, cancel-aware long jobs, admin audit event logging, and requestId/account attribution.

8. Keep frontend as thin workbench.

   Frontend/browser should continue to use `/api/lws/*` only. Storage access must remain backend-only and service-mediated.

