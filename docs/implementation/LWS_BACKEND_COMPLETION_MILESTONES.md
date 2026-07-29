# L.W.S. Backend Completion Milestones

작성일: 2026-07-02

## 0. 기준 문서

이 문서는 앞으로 L.W.S. backend 개발을 완료하기 위한 작업을 milestone 단위로 정리한다.

기준으로 삼은 문서는 아래 4개이다.

- `docs/LWS_BACKEND_DESIGN.md`
- `docs/LWS_NODE_MODEL.md`
- `docs/LWS_EDGE_MODEL.md`
- `docs/implementation/LWS_BACKEND_COMPLETION_REVIEW.md`

이 문서의 목적은 "무엇을 더 만들 것인가"보다 "어떤 순서로 만들어야 source of truth를 손상시키지 않는가"를 정리하는 것이다.

## 1. 완료 전략

Backend 완료 작업은 아래 원칙을 우선한다.

1. Source of truth를 먼저 보호한다.
   - node/edge JSON과 event/patch/history가 canonical record이다.
   - SQLite projection, job state, cache, frontend state는 source of truth가 아니다.

2. Backend contract를 먼저 닫는다.
   - API route는 request parsing, RequestContext 생성, service 호출, error mapping만 담당한다.
   - route, frontend, script가 storage/event/SQLite를 직접 만지는 경로를 없앤다.

3. Mutation durability를 permission/query 확장보다 먼저 안정화한다.
   - 불완전 event/history 상태가 생기면 성공 응답을 반환하면 안 된다.
   - recovery는 중복 기록 없이 빠진 조각만 복구해야 한다.

4. SQLite와 permission projection은 재생성 가능해야 한다.
   - 모든 projection은 object JSON과 event/history에서 rebuild 가능해야 한다.
   - projection stale/corrupt 상태에서는 private read와 write가 fail-closed여야 한다.

5. Frontend는 thin workbench로 둔다.
   - browser code는 `/api/lws/*`만 사용한다.
   - storage path, filesystem, SQLite, event log는 frontend에 노출하지 않는다.

## 2. Milestone Overview

| Milestone | 목표 | 주요 Phase | 우선순위 | 완료 신호 |
| --- | --- | --- | --- | --- |
| M1 Safety Boundary Closure | 남은 path/read/service boundary 구멍 차단 | Phase 1, 2.5, 3 | P0 | private leak과 event path traversal 가능성이 닫힘 |
| M2 Durable Mutation And Idempotent Recovery | mutation/event/history를 논리적 단일 mutation으로 안정화 | Phase 3 | P0 | partial failure recovery가 중복 없이 통과 |
| M3 SQLite Projection Completion | read model을 source of truth에서 완전 재생성 | Phase 4 | P1 | events/object_history/search/query projection이 rebuild 가능 |
| M4 Permission Enforcement Completion | projection-backed permission을 read/write/query 전반에 적용 | Phase 5 | P1 | account별 list/search/graph가 permission-aware |
| M5 Admin Jobs And Operational Recovery | admin job/recovery/backup contract 완성 | Phase 6 | P1 | job idempotency, progress, cancel, audit가 동작 |
| M6 API Contract And Integration Hardening | route adapter 규칙과 error/test contract 마감 | Phase 1-6 | P1 | route-level integration tests가 backend contract를 검증 |
| M7 Backend V1 Completion Gate | Phase 1-6 완료 판정과 Phase 7 분리 | Phase 1-6 | P2 | backend complete checklist 통과 |

## 3. M1 - Safety Boundary Closure

### 목표

현재 completion review에서 High risk로 분류된 path safety와 API read boundary 문제를 먼저 닫는다.

이 milestone은 기능 확장이 아니라 source of truth와 private data를 지키기 위한 안정화 작업이다.

### 작업

| ID | 작업 | 설명 | 근거 |
| --- | --- | --- | --- |
| BE-M1-01 | Event id safe validator 추가 | `event.*` id 형식, path separator, traversal, drive/UNC injection 차단 | Phase 1 path safety, Phase 3 event history |
| BE-M1-02 | EventStore path root assertion 적용 | patch, history, head, journal, event_ref read path가 data/runtime root 밖으로 나가지 못하게 한다 | Completion review High risk |
| BE-M1-03 | Restore/history route body/param 검증 | `source_event_id`, `eventId`, `objectId`를 service 진입 전에 normalize하고 service에서도 재검증한다 | Phase 3 restore/history API |
| BE-M1-04 | validation route permission guard 적용 | `GET /api/lws/objects/:id/validation`이 private object를 anonymous에게 노출하지 않게 한다 | Phase 2.5 fail-closed |
| BE-M1-05 | validation/permissions route service adapter화 | route가 `objectStore`, `indexStore`를 직접 읽지 않고 service method를 호출하도록 정리한다 | API route는 service adapter |
| BE-M1-06 | query service index status guard | list/search/graph/timeline/ontology가 SQLite missing/corrupt/schema mismatch를 LWS error로 반환하게 한다 | Phase 4 index state handling |

### 완료 조건

- Anonymous는 private object validation 결과나 existence signal을 얻을 수 없다.
- Restore/history/diff API 입력값으로 storage root 밖 JSON 파일을 읽을 수 없다.
- API route에서 storage/event/index persistence detail을 직접 만지는 예외가 없다.
- SQLite missing/corrupt/schema mismatch 상태가 `INDEX_REBUILD_REQUIRED`, `INDEX_CORRUPT`, `INDEX_SCHEMA_MISMATCH`로 안정적으로 매핑된다.

### 필수 테스트

- `GET /api/lws/objects/:id/validation` anonymous private access는 `PERMISSION_DENIED`.
- `source_event_id=../../...` 같은 traversal payload는 `PATH_OUTSIDE_ROOT` 또는 `PATCH_INVALID`.
- history diff route의 unsafe `eventId`는 storage read 전에 거부.
- query API는 DB missing 상태에서 raw SQLite error 대신 LWS error 반환.

## 4. M2 - Durable Mutation And Idempotent Recovery

### 목표

Phase 3의 mutation/event consistency rule을 완료한다.

현재 구현은 pending journal과 event append failure 감지는 갖췄지만, partial append 후 recovery가 중복 없이 빠진 단계만 완료한다는 보장이 약하다. 이 milestone은 mutation 성공 응답의 의미를 "object JSON과 event/history 기록이 모두 durable하다"로 확정한다.

### 작업

| ID | 작업 | 설명 | 근거 |
| --- | --- | --- | --- |
| BE-M2-01 | mutation journal step state 추가 | prepared, object_written, patch_written, global_event_appended, history_appended, head_written 등 단계 상태 기록 | Phase 3 pending mutation recovery |
| BE-M2-02 | commit step idempotency 구현 | event_id 기준으로 이미 기록된 patch/event/history/head를 감지하고 중복 append를 방지 | Completion review High risk |
| BE-M2-03 | partial failure injection harness | patch write, global append, history append, head write 각 단계에서 실패를 시뮬레이션 | Phase 3 exit criteria |
| BE-M2-04 | recovery command 강화 | pending/failed journal을 보고 빠진 단계만 완료하거나 manual repair로 분류 | Phase 3 recovery rule |
| BE-M2-05 | durable write policy 정의 | atomic rename, append, directory fsync 적용 범위 또는 플랫폼별 한계를 명시하고 구현 | durable mutation response |
| BE-M2-06 | object/event hash consistency check | current object hash와 head/latest event hash 불일치를 validation/recovery report에 포함 | failed event/index consistency report |

### 완료 조건

- object write 후 event append 실패가 발생해도 성공 응답은 반환되지 않는다.
- recovery를 여러 번 실행해도 global event, object history, patch record가 중복되지 않는다.
- startup/status/admin validation이 pending, failed, hash mismatch, missing head를 감지한다.
- restore는 검증된 patch record에서만 수행된다.

### 필수 테스트

- 각 commit step 실패 injection 후 API response는 `EVENT_APPEND_FAILED`.
- recovery 1회 후 history count가 정확히 1 증가.
- recovery 2회 이상 반복해도 event/history 중복 없음.
- head.json latest_hash와 current object hash mismatch detection.
- rev conflict와 inverse patch replay regression.

## 5. M3 - SQLite Projection Completion

### 목표

Phase 4 SQLite generated read model을 완성한다.

현재 projection은 objects/nodes/edges/tags/graph/timeline/permission 중심으로 동작한다. 남은 작업은 event/history projection, search 품질, include_permissions, index state handling이다.

### 작업

| ID | 작업 | 설명 | 근거 |
| --- | --- | --- | --- |
| BE-M3-01 | event log scanner 구현 | `data/events/**/*.jsonl`을 읽어 `events` projection 재생성 | Phase 4 core projections |
| BE-M3-02 | object history scanner 구현 | `data/history/{nodes,edges}/.../events.jsonl`을 읽어 `object_history` projection 재생성 | Phase 4 history lookup |
| BE-M3-03 | projection consistency validation | event_ref, byte_offset, patch_path, head.json, current rev/hash 불일치 report | Phase 6 validation issues |
| BE-M3-04 | FTS5 또는 fallback search 명확화 | SQLite FTS5 사용 가능 시 FTS table, 아니면 documented fallback search | Phase 4 search API |
| BE-M3-05 | `include_permissions` query option | object list/search response에 viewer permission hint를 선택적으로 포함 | Phase 4 list API |
| BE-M3-06 | incremental projection completeness | mutation 후 objects, graph_edges, timeline, tags, events/history projection이 함께 갱신되거나 stale 처리 | Phase 4 incremental update |
| BE-M3-07 | index metadata hardening | `index_meta`, `index_builds`, schema mismatch, stale reason, build result를 일관 관리 | Phase 4 SQLite foundation |

### 완료 조건

- SQLite DB 삭제 후 full reindex만으로 object list/search/graph/timeline/ontology/history lookup projection이 재생성된다.
- source JSON과 event/history가 유지되는 한 SQLite는 언제든 폐기 후 복구 가능하다.
- projection failure는 source mutation을 rollback하지 않고 `INDEX_STALE` warning/status로 남긴다.
- anonymous search 결과에 private title/summary/content가 포함되지 않는다.

### 필수 테스트

- SQLite file 삭제 후 `ReindexCommand`가 objects/events/object_history를 모두 채움.
- corrupt event_ref나 missing patch_path가 validation issue로 projection됨.
- mutation 후 incremental projection에 event/history row가 추가됨.
- FTS/fallback search 모두 public/private boundary를 지킴.
- `include_permissions=true`가 backend guard를 대체하지 않고 hint만 제공.

## 6. M4 - Permission Enforcement Completion

### 목표

Phase 5의 projection-backed real permission enforcement를 완료한다.

현재 `PermissionService`는 object read/write guard와 permission projection 일부를 갖고 있다. 그러나 list/search/graph/timeline/ontology query는 anonymous public filter 중심이며, authenticated account의 effective permission filtering은 부족하다.

### 작업

| ID | 작업 | 설명 | 근거 |
| --- | --- | --- | --- |
| BE-M4-01 | permission projection stale bug 수정 | old/new edge relevance를 모두 고려해 permission edge type 변경 시 stale grant 제거 | Completion review High risk |
| BE-M4-02 | object/scope membership model 확정 | `rel.contains`, collection/scope ownership, `can_*_in` 적용 대상을 projection에 반영 | Node model scope/account/group |
| BE-M4-03 | permission-aware query module | list/search/graph/timeline/ontology가 RequestContext별 visible set만 반환 | Phase 5 permission-aware query |
| BE-M4-04 | private read fail-closed hardening | permission projection missing/stale/corrupt면 private read와 write 거부 | Phase 5 upgrade rule |
| BE-M4-05 | write guard completion | create/update/delete/restore/admin action이 object/scope permission을 정확히 확인 | Phase 5 service enforcement |
| BE-M4-06 | session and permission hint API | `GET /session`, `GET /objects/:id/permissions`, `viewer_permissions`, `ui_capabilities`를 projection 기반으로 보강 | Phase 5 session and permission API |
| BE-M4-07 | permission graph change incremental update | account/group/scope/permission edge 변경이 permission projection을 즉시 갱신 | Phase 5 exit criteria |

### 완료 조건

- Anonymous는 public current object와 public read model만 볼 수 있다.
- Account는 명시적 object permission, ownership, group permission, scope permission에 따라 private object를 볼 수 있다.
- Query API는 authenticated context에서도 허용되지 않은 private summary/search text를 반환하지 않는다.
- Permission projection stale/corrupt 상태에서는 private read와 write가 fail-closed된다.
- Permission edge 변경 후 reindex 없이도 runtime permission 결과가 갱신된다.

### 필수 테스트

- Account A/B 간 private object list/search isolation.
- group membership 추가/삭제 후 permission result 변경.
- permission edge type을 `rel.can_read`에서 `rel.references`로 변경하면 grant 제거.
- `rel.can_update_in` scope/collection write guard.
- stale/corrupt permission projection에서 private read/write denied.
- frontend-supplied account/capability header는 trusted source가 아님.

## 7. M5 - Admin Jobs And Operational Recovery

### 목표

Phase 6 admin job contract를 운영 가능한 수준으로 완성한다.

현재 AdminService는 synchronous job envelope로 validate/reindex/backup/materialize/check-public-boundary/recovery를 감싼다. 남은 작업은 job lifecycle, progress, cancellation, idempotency, audit, recovery hardening이다.

### 작업

| ID | 작업 | 설명 | 근거 |
| --- | --- | --- | --- |
| BE-M5-01 | JobService lifecycle 확장 | queued/running/succeeded/failed/canceled 상태 전이를 저장하고 조회 API 안정화 | Phase 6 job framework |
| BE-M5-02 | `client_job_id` idempotency | 같은 client_job_id 요청은 기존 job envelope를 반환 | Phase 6 idempotency baseline |
| BE-M5-03 | cancellation-aware runner | long-running validation/reindex/backup이 cancel request를 확인하고 중단 | Phase 6 cancel |
| BE-M5-04 | progress persistence | scanned count, current phase, total, warning count 등 진행률 저장 | Phase 6 progress shape |
| BE-M5-05 | admin audit event logging | admin job start/success/failure/cancel을 account.system/account.admin attribution으로 기록 | Phase 6 audit |
| BE-M5-06 | validation job 강화 | object validation, public boundary, mutation consistency, projection consistency를 하나의 report로 연결 | Phase 6 validation |
| BE-M5-07 | backup policy hardening | backup root path safety, manifest 민감 정보 정책, source object/event/index snapshot 명확화 | Phase 6 backup |
| BE-M5-08 | index recovery workflow | INDEX_STALE/CORRUPT/SCHEMA_MISMATCH 상태에서 reindex/migration/manual repair path 제공 | Phase 6 recovery |

### 완료 조건

- 모든 admin action은 permission guarded job envelope를 반환한다.
- job list/detail/cancel API가 guard를 통과한 admin에게만 노출된다.
- reindex job은 Phase 4 ReindexCommand에 delegate한다.
- backup은 app repo 밖 configured backup root 아래에 생성된다.
- admin job은 audit trail을 남긴다.

### 필수 테스트

- 동일 `client_job_id`로 reindex 요청 시 같은 job 반환.
- cancel 가능한 long validation/reindex fixture.
- admin route anonymous/session spoof denied.
- backup root traversal denied.
- validation job이 public boundary와 mutation inconsistency를 report.
- INDEX_CORRUPT fixture에서 reindex recovery 성공.

## 8. M6 - API Contract And Integration Hardening

### 목표

모든 `/api/lws/*` route가 backend service adapter 역할만 하도록 마감하고, route-level integration tests로 backend contract를 고정한다.

### 작업

| ID | 작업 | 설명 | 근거 |
| --- | --- | --- | --- |
| BE-M6-01 | route inventory 작성 | 각 route가 호출하는 service, permission guard, persistence direct access 여부를 표로 정리 | API route adapter rule |
| BE-M6-02 | request body validation | mutation/admin/search/query route의 request shape validation과 error code 통일 | Phase 3/4/6 API |
| BE-M6-03 | route direct storage 금지 test | `src/app/api/lws/**/route.ts`에서 `objectStore`, `eventStore`, `indexStore`, `fs` direct use를 금지하거나 예외 문서화 | Phase 1 exit criteria |
| BE-M6-04 | route-level auth tests | anonymous, local-admin, untrusted-session, future session context별 route behavior 검증 | Phase 2.5/5 |
| BE-M6-05 | error response contract | LwsError code/status/details shape snapshot tests | backend API contract |
| BE-M6-06 | public/private API regression | object read, list, search, graph, timeline, ontology, history, admin 전체 public/private boundary 검증 | Phase 2.5/4/5 |

### 완료 조건

- API route는 request parsing, context resolving, service call, response mapping만 담당한다.
- 모든 route가 permission boundary를 service layer에서 통과한다.
- malformed request는 raw exception 대신 documented LwsError로 변환된다.
- Browser/frontend가 storage를 직접 읽거나 쓰는 경로가 없다.

### 필수 테스트

- API route import/static scan.
- Next route handler unit/integration tests.
- anonymous private object read/list/search/history denied.
- local admin mutation/admin allowed only with valid local secret and non-production environment.
- untrusted session header is anonymous.

## 9. M7 - Backend V1 Completion Gate

### 목표

Phase 1-6이 backend v1 complete 상태인지 판정하는 release gate를 만든다.

### 완료 체크리스트

아래 조건이 모두 충족되어야 backend core complete로 본다.

- Source of truth는 node/edge JSON과 event/patch/history이다.
- SQLite는 삭제 후 source of truth에서 full rebuild 가능하다.
- Object id, event id, history ref, backup/job id는 storage root 밖 접근에 사용될 수 없다.
- API route와 frontend는 storage를 직접 읽거나 쓰지 않는다.
- Node type, edge type, tag, relation type은 node id 또는 built-in virtual ontology id로 취급된다.
- Relation type도 materializable node로 유지된다.
- Edge는 first-class relationship object로 저장, 검증, mutation, history 처리된다.
- Public edge는 source와 target이 모두 public일 때만 허용된다.
- Node/edge JSON에 `access` field를 넣지 않는다.
- Anonymous/private/write/admin permission boundary는 fail-closed이다.
- Mutation success response는 object JSON과 event/history durable record 이후에만 반환된다.
- Incomplete mutation state는 status/admin validation에서 탐지되고 recovery 가능하다.
- Permission graph 변경은 permission projection을 갱신한다.
- Admin validate/reindex/backup/recovery jobs는 permission guarded이고 audit trail을 남긴다.
- Test suite가 M1-M6 필수 테스트를 모두 통과한다.

### Phase 7 이후로 분리할 항목

아래 항목은 backend v1 complete gate를 막지 않는다.

- event byte_offset lookup optimization hardening
- event hash chain decision
- history checkpoint/compaction
- event node full materialization
- advanced FTS tuning
- vector/semantic search
- schema migration runner and rollback
- advanced observability dashboard
- advanced permission administration UI
- visual diff merge editor

## 10. Suggested Execution Order

1. M1을 먼저 완료한다.
   - 이유: path/read boundary 문제는 기능 확장 전 닫아야 한다.

2. M2를 완료한다.
   - 이유: mutation/event/history가 안정화되어야 SQLite와 permission projection이 신뢰할 수 있다.

3. M3를 완료한다.
   - 이유: Permission enforcement와 admin recovery가 의존할 generated read model을 완성한다.

4. M4를 완료한다.
   - 이유: public/private boundary와 account-based collaboration의 backend contract를 닫는다.

5. M5를 완료한다.
   - 이유: 운영/복구/admin 작업을 job contract로 감싸 backend를 관리 가능하게 만든다.

6. M6로 API contract를 고정한다.
   - 이유: frontend와 future CLI가 같은 service contract를 안전하게 사용할 수 있게 한다.

7. M7 gate로 backend v1 complete를 판정한다.
   - 이유: Phase 7 이후 확장과 v1 안정화 범위를 섞지 않기 위해서다.

## 11. Tracking Labels

향후 issue 또는 PR로 나눌 때 아래 label을 권장한다.

- `backend/safety`
- `backend/mutation`
- `backend/recovery`
- `backend/sqlite-projection`
- `backend/permission`
- `backend/admin-job`
- `backend/api-contract`
- `backend/test-gap`
- `phase/1-runtime`
- `phase/2-object-store`
- `phase/2.5-permission-baseline`
- `phase/3-mutation-history`
- `phase/4-read-model`
- `phase/5-permission-enforcement`
- `phase/6-admin-recovery`

