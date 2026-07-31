# L.W.S. Implementation Reports

이 폴더는 설계 문서와 별도로, 실제 구현 진행 상황, 검증 결과, 남은 작업을 추적한다.

현재 코드 기준으로 백엔드 핵심 구현은 Sprint A-G와 Milestone M1-M6 검증을 통과한 상태다. 즉, 기존 completion review에서 위험 항목으로 남아 있던 path/read boundary, mutation recovery, SQLite projection, permission enforcement, admin job, API contract 항목은 후속 milestone 테스트로 상당 부분 닫혔다. 다음 큰 정리 지점은 M7 Backend V1 Completion Gate와 thin frontend workbench다.

## Current Backend Status

구현 및 검증된 범위:

- runtime config, storage root 분리, path safety
- node/edge schema validation, semantic validation, safe ObjectStore
- anonymous public-only read, private/write/admin fail-closed permission baseline
- rev 기반 mutation, JSON Patch/inverse patch, event/patch/history 기록
- mutation journal, partial failure detection, idempotent recovery baseline
- SQLite generated read model, full reindex, incremental projection update
- object list/search/graph/backlinks/timeline/ontology read services
- projection-backed account/group/owner/permission enforcement
- admin validate/reindex/backup/public-boundary/materialize-core-ontology/recovery jobs
- route adapter boundary, request validation, stable LwsError mapping

검증 명령:

```powershell
npm.cmd run test:sprint-a
npm.cmd run test:sprint-b
npm.cmd run test:sprint-c
npm.cmd run test:sprint-d
npm.cmd run test:sprint-e
npm.cmd run test:sprint-f
npm.cmd run test:sprint-g
npm.cmd run test:milestone-m1
npm.cmd run test:milestone-m2
npm.cmd run test:milestone-m3
npm.cmd run test:milestone-m4
npm.cmd run test:milestone-m5
npm.cmd run test:milestone-m6
npm.cmd run test:milestone-m7
npm.cmd run build
```

남은 큰 범위:

- M7 Backend V1 Completion Gate 문서/체크리스트 정리
- production-grade authentication and token/session verification
- true async/background job runner and long-running cancellation semantics
- backup retention, encryption, remote copy policy
- real Next dev server HTTP smoke tests
- read-only thin frontend workbench

## Documents

| Document | Purpose | Read First When |
| --- | --- | --- |
| [LWS_BACKEND_IMPLEMENTATION_REPORT.md](./LWS_BACKEND_IMPLEMENTATION_REPORT.md) | Sprint A-G 기준으로 실제 구현된 backend vertical slice, 검증 명령, 남은 운영/프론트엔드 범위를 정리한다. | 지금 코드가 어떤 기능까지 갖췄는지 빠르게 복원할 때 |
| [LWS_M1_SAFETY_BOUNDARY_IMPLEMENTATION_REPORT.md](./LWS_M1_SAFETY_BOUNDARY_IMPLEMENTATION_REPORT.md) | M1 Safety Boundary Closure 구현 결과, PathResolver 기반 EventStore 경로 통합, route-safe backend surface, 검증 결과를 정리한다. | M1에서 path/read/service boundary가 어떻게 닫혔는지 확인할 때 |
| [LWS_M2_DURABLE_MUTATION_RECOVERY_IMPLEMENTATION_REPORT.md](./LWS_M2_DURABLE_MUTATION_RECOVERY_IMPLEMENTATION_REPORT.md) | M2 Durable Mutation And Idempotent Recovery 구현 결과, recovery classification, durable write policy, 검증 결과를 정리한다. | M2에서 mutation/recovery consistency가 어떻게 닫혔는지 확인할 때 |
| [LWS_M3_SQLITE_PROJECTION_IMPLEMENTATION_REPORT.md](./LWS_M3_SQLITE_PROJECTION_IMPLEMENTATION_REPORT.md) | M3 SQLite Projection Completion 구현 결과, full reindex/event-history projection/search policy/index metadata 검증 결과를 정리한다. | M3에서 SQLite generated read model이 어떻게 재생성 가능하게 고정됐는지 확인할 때 |
| [LWS_M4_PERMISSION_ENFORCEMENT_IMPLEMENTATION_REPORT.md](./LWS_M4_PERMISSION_ENFORCEMENT_IMPLEMENTATION_REPORT.md) | M4 Permission Enforcement Completion 구현 결과, permission projection/effective permission/query boundary/fail-closed 검증 결과를 정리한다. | M4에서 projection-backed permission enforcement가 어떻게 닫혔는지 확인할 때 |
| [LWS_M5_ADMIN_JOBS_OPERATIONAL_RECOVERY_IMPLEMENTATION_REPORT.md](./LWS_M5_ADMIN_JOBS_OPERATIONAL_RECOVERY_IMPLEMENTATION_REPORT.md) | M5 Admin Jobs And Operational Recovery 구현 결과, job lifecycle/idempotency/progress/audit/backup/recovery 검증 결과를 정리한다. | M5에서 admin job과 운영 복구 표면이 어떻게 고정됐는지 확인할 때 |
| [LWS_M6_API_CONTRACT_INTEGRATION_HARDENING_IMPLEMENTATION_REPORT.md](./LWS_M6_API_CONTRACT_INTEGRATION_HARDENING_IMPLEMENTATION_REPORT.md) | M6 API Contract And Integration Hardening 구현 결과, route adapter boundary/request validation/error response/auth regression 검증 결과를 정리한다. | M6에서 `/api/lws/*` route contract가 어떻게 고정됐는지 확인할 때 |
| [LWS_M7_BACKEND_V1_COMPLETION_GATE_REPORT.md](./LWS_M7_BACKEND_V1_COMPLETION_GATE_REPORT.md) | M7 Backend V1 Completion Gate 판정 결과, M1-M6 evidence, Phase 7 이후 분리 항목, 최종 regression 기준을 정리한다. | backend v1 core complete 여부를 최종 확인할 때 |
| [LWS_GLOSSARY.md](../../reference/LWS_GLOSSARY.md) | source of truth, projection, generated read model, fail-closed, effective permission 같은 핵심 용어를 정리한다. | 구현 보고서의 용어가 헷갈릴 때 |
| [LWS_BACKEND_WARNING_AND_ERROR_CODES.md](../../reference/LWS_BACKEND_WARNING_AND_ERROR_CODES.md) | API/service error code와 projection validation warning code의 의미, 저장 위치, 운영 대응을 정리한다. | `EVENT_*`, `INDEX_*`, `PATCH_PATH_*`, `MUTATION_*` code 의미를 확인할 때 |
| [LWS_BACKEND_COMPLETION_REVIEW.md](./LWS_BACKEND_COMPLETION_REVIEW.md) | 설계 대비 구현 완료도를 평가하고, 당시 남아 있던 phase별 gap과 high-risk 항목을 정리한다. 현재는 일부 내용이 milestone 구현 전 기준이다. | 왜 M1-M6 작업이 필요했는지 배경을 볼 때 |
| [LWS_BACKEND_COMPLETION_MILESTONES.md](./LWS_BACKEND_COMPLETION_MILESTONES.md) | M1-M7로 백엔드 완성 작업을 나누고, 각 milestone의 작업, 완료 조건, 필수 테스트를 정의한다. | 다음 작업 순서나 completion gate를 판단할 때 |
| [LWS_API_ROUTE_INVENTORY.md](./LWS_API_ROUTE_INVENTORY.md) | `/api/lws/**` route가 어떤 service boundary와 permission guard를 통과해야 하는지 목록화한다. | route를 추가하거나 API contract를 점검할 때 |

## Practical Reading Order

1. 현재 구현 범위만 확인하려면 [LWS_BACKEND_IMPLEMENTATION_REPORT.md](./LWS_BACKEND_IMPLEMENTATION_REPORT.md)를 먼저 본다.
2. 남은 일의 우선순위를 잡으려면 [LWS_BACKEND_COMPLETION_MILESTONES.md](./LWS_BACKEND_COMPLETION_MILESTONES.md)의 M7과 Phase 7 이후 분리 항목을 본다.
3. 특정 위험 항목의 배경을 확인하려면 [LWS_BACKEND_COMPLETION_REVIEW.md](./LWS_BACKEND_COMPLETION_REVIEW.md)를 본다.
4. route를 만질 때는 [LWS_API_ROUTE_INVENTORY.md](./LWS_API_ROUTE_INVENTORY.md)를 함께 확인한다.
