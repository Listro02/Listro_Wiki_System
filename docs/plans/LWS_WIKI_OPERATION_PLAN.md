# L.W.S. Wiki Operation Plan

작성일: 2026-08-02

## 1. 목적

이 문서는 현재 구현 중인 frontend workbench를 바탕으로 L.W.S.를 실제 wiki로 운영하기 위한 전환 계획을 정리한다.

현재 방향은 다음 순서를 따른다.

```text
backend core
-> wiki 운영/작성용 workbench
-> reader-facing wiki surface
```

workbench는 wiki surface의 대체물이 아니라, wiki를 안전하게 만들고 운영하기 위한 작성자/운영자 도구다.

## 2. 현재 판단

백엔드 코어는 내부용 또는 소규모 alpha wiki를 시작할 수 있을 만큼 핵심 기반을 갖추고 있다.

구현된 기반:

- node/edge first-class object model
- JSON source of truth
- event/patch/history 기반 변경 보존
- revision 기반 mutation
- permission-aware read/list/search/graph/timeline/ontology
- public/private boundary
- SQLite generated read model
- reindex/recovery/admin job baseline

다만 현재 frontend는 reader-facing wiki가 아니라 operator-quality workbench에 가깝다.

따라서 실제 운영 전에는 workbench 마무리와 production 권한 체계, 이후 wiki surface 구현이 필요하다.

## 3. Workbench 우선 마무리 범위

wiki 운영 전에 workbench에서 최소한 다음 흐름이 안정적이어야 한다.

```text
browse
-> inspect
-> create/edit
-> relation 확인
-> history/diff 확인
-> validation
-> reindex/recovery
```

우선순위:

1. graph/timeline/ontology 탐색 기능 보강
2. relation 작성/수정 UX 개선
3. history diff와 restore UX 연결
4. validation/public-boundary 결과 표시 개선
5. admin job/recovery 상태 확인 개선
6. permission hint와 실제 backend guard의 차이를 명확히 표시

## 4. Backend 권한 체계 운영화

현재 backend에는 permission-aware query와 public/private boundary의 기반이 있다.

운영 wiki로 전환하려면 다음을 별도 gate로 다뤄야 한다.

- production authentication/session
- secure cookie 또는 token 검증
- session 만료/회전
- account 비활성화 처리
- CSRF/rate limit/body size limit
- admin 권한과 일반 작성 권한 분리
- account/group/scope/permission edge 관리 UI

중요한 구분:

```text
authorization = 읽기/쓰기/관리 권한 판단
authentication = 요청자가 실제로 누구인지 확인
```

L.W.S. backend는 authorization 모델을 상당 부분 갖췄지만, production authentication은 아직 별도 구현 대상이다.

## 5. Wiki Surface 구현 범위

workbench 이후 별도의 reader-facing surface를 추가한다.

최소 surface:

- `/wiki` 또는 `/pages` index
- `/wiki/[slug]` 또는 `/objects/[id]` page view
- Markdown 렌더링
- title/summary/content 표시
- tags/type/relation chips
- backlinks/outgoing relations
- permission-aware 404 또는 access denied
- search result page
- public/private 표시 정책

wiki surface는 storage, event store, SQLite internals를 직접 import하지 않고 `/api/lws/*`를 통해서만 데이터를 읽는다.

## 6. 운영 전 염려점

### Slug와 URL

현재 `id`와 `slug`는 보수적으로 URL-safe ASCII를 요구한다.

향후 방향:

- id는 UUID/ULID 자동 생성 또는 고급 수동 입력
- slug는 Unicode 허용
- title 기반 slug suggestion
- slug 변경 시 alias/redirect 보존 여부 결정

관련 계획은 `docs/plans/LWS_IDENTIFIER_AND_SLUG_PLAN.md`에서 다룬다.

### Markdown 보안

wiki surface에서 Markdown을 HTML로 렌더링하면 sanitization이 필요하다.

특히 public page에서는 다음을 금지하거나 제한해야 한다.

- inline script
- unsafe HTML
- javascript: URL
- 외부 embed 정책 미정 상태의 iframe/object

### 동시 편집

현재 revision conflict 기반은 있으나, 다중 사용자가 동시에 같은 object를 편집하는 운영에서는 추가 정책이 필요하다.

검토 대상:

- per-object lock
- filesystem lock
- SQLite-backed CAS
- mutation queue
- conflict diff/merge UX

### 검색 품질

작은 wiki에서는 현재 search/read model로 시작할 수 있다.

운영 데이터가 커지면 다음이 필요할 수 있다.

- FTS5
- ranking
- snippet/highlight
- 한국어 tokenizer
- type/tag/relation filter

### 백업과 복구

reindex/recovery 기반은 있으나 운영 절차는 별도다.

필요한 것:

- backup retention
- restore drill
- backup integrity manifest
- mutation 중 backup consistency 정책
- admin job audit 조회

## 7. 운영 가능 단계

### Local/Internal Alpha

가능 조건:

- 신뢰된 사용자 중심
- local/admin workbench 사용
- private 중심 데이터
- 수동 reindex/recovery 가능
- 제한된 규모의 search/graph 사용

이 단계는 workbench 마무리와 backend permission 확인만으로 시작 가능하다.

### Private Team Beta

필요 조건:

- production auth/session
- account/group/scope permission 관리
- restore UX
- backup/recovery 절차
- graph/timeline/ontology workbench 탐색 안정화

### Public Wiki

필요 조건:

- reader-facing wiki surface
- Markdown sanitization
- slug/alias/redirect 정책
- public/private boundary 회귀 테스트
- rate limit/body size limit/CSRF
- 공개 오류 메시지 정책
- 운영 백업과 관측성

## 8. 권장 다음 순서

1. workbench의 graph/timeline/ontology 탐색을 마무리한다.
2. relation 작성/수정과 history/restore UX를 연결한다.
3. backend production auth/session 계획을 별도 milestone으로 분리한다.
4. permission management UI를 workbench에 추가한다.
5. wiki surface slice를 시작한다.
6. public 운영 전에 Markdown, slug, security, backup gate를 통과한다.

## 9. 결론

현재 L.W.S. backend core는 wiki 운영의 중심 저장/조회/권한 모델로 사용할 수 있는 수준에 가깝다.

하지만 현재 frontend는 wiki surface가 아니라 workbench다. 따라서 우선 workbench를 작성자/운영자 도구로 완성하고, 그 다음 같은 backend API 위에 reader-facing wiki surface를 얹는 방향이 적절하다.
