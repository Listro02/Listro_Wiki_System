# L.W.S. Frontend Foundation Slice 구현 보고서 및 검토 계획서

작성일: 2026-08-01

## 1. 요약

이 문서는 L.W.S. 프론트엔드의 첫 사용 가능 구현 단위인 Foundation Slice 결과를 정리한다.

이번 구현 범위:

```text
F0 UI Foundation
+ F1 Backend-Integrated Read Workbench
+ 최소 F2 Editing Core
```

이번 slice의 핵심 목표는 실제 `/api/lws/*` 백엔드 응답을 사용해 다음 운영 루프를 검증하는 것이다.

```text
browse -> inspect -> edit -> validate -> reindex enough to continue working
```

첫 화면은 계속 `/`이다. 이 화면은 landing page가 아니라 실제 operator workbench로 동작한다. `/graph`, `/timeline`, `/ontology`, `/admin` 같은 독립 라우트는 후속 slice에서 확장한다. 이번에는 object 탐색, 상세 확인, 생성, 편집, 검증, reindex 흐름을 먼저 안정화하는 데 집중했다.

## 2. 구현 결과

UI foundation:

- `lucide-react`를 추가해 주요 action/icon button에 사용했다.
- Radix primitive 패키지를 추가했다: dialog, tabs, tooltip, select, dropdown menu, switch.
- `src/app/globals.css`에 L.W.S. 소유 CSS design system을 추가했다.
- `src/components/ui.tsx`에 Button, IconButton, Badge, Panel, Tabs, Dialog, Tooltip, Select, Switch, Dropdown wrapper를 추가했다.
- 시각 스타일은 외부 UI kit이 아니라 L.W.S. CSS가 소유한다.

API/client layer:

- `src/lib/lws-api/client.ts`에 `/api/lws/*` 전용 typed client를 추가했다.
- 성공 응답과 LWS error 응답을 정규화한다.
- `LwsApiError`는 UI에서 쓰기 쉽도록 `code`, `message`, `details`, `status`를 가진다.
- local Admin mode가 켜진 경우에만 기존 백엔드 계약에 맞춰 local-admin 헤더를 붙인다.
- frontend는 storage, event store, SQLite, job internals를 직접 import하지 않는다.

Draft/Patch layer:

- `src/lib/lws-api/types.ts`에 frontend client 타입을 추가했다.
- `src/lib/lws-api/drafts.ts`에 node/edge draft 생성, object-to-draft 변환, draft-to-object 변환, JSON Patch 생성 helper를 추가했다.
- PATCH 생성 시 backend-managed field는 제외한다.

제외되는 protected fields:

```text
schema_version
object_kind
id
rev
audit
```

Workbench 화면:

- 기존 단일 `src/app/page.tsx` 시제품을 3-pane workbench로 재구성했다.
- 상단에는 status/session/admin mode/create/refresh control을 둔다.
- 왼쪽에는 object browser와 search/kind filter를 둔다.
- 가운데에는 object detail, edit tab, validation, raw JSON을 둔다.
- 오른쪽에는 storage/index 상태, admin action, capability, graph/timeline/ontology 요약, API boundary 설명을 둔다.

읽기 흐름:

- status/session indicator 표시
- object list/search/filter
- object detail readonly 확인
- validation report 확인
- raw JSON 확인
- graph/timeline/ontology 요약 확인
- index/storage issue 표시

최소 편집 흐름:

- node 생성
- edge 생성
- node 수정
- edge 수정
- explicit Save
- dirty/saving/saved/failure 상태 표시
- mutation result의 `event_id`, `next_rev`, `warnings` 표시
- 저장 실패 시 local draft 보존
- validation, permission, rev conflict error 표시

Local Admin mode:

- production auth UI는 구현하지 않았다.
- 대신 기존 backend local development HTTP contract를 사용한다.
- Admin mode가 켜지고 local secret이 입력된 경우 다음 헤더를 붙인다.

```text
x-lws-auth-source: local-script
x-lws-local-admin-secret: <local secret>
```

- 현재 `.env.local` 기준 local secret은 다음 값이다.

```text
change-me
```

- 이 UI는 권한 판단을 대체하지 않는다. 실제 read/write/admin 허용 여부는 항상 backend service layer가 판단한다.

## 3. 로컬 테스트 데이터

검토를 쉽게 하기 위해 임시 public sample object를 실제 mutation API로 생성했다. 생성 후 reindex를 수행했다.

공통 속성:

```text
visibility: public
status: active
tags: tag.frontend, tag.sample
```

현재 샘플 데이터 규모:

```text
nodes: 4
edges: 4
total objects: 8
```

### 3.1 샘플 노드

| ID | 표시 제목 | Type | 확인 목적 | 요약 |
| --- | --- | --- | --- | --- |
| `sample.frontend.workbench` | 프론트엔드 워크벤치 샘플 | `type.note` | 메인 검토 시작점 | L.W.S. 프론트엔드 Foundation Slice를 확인하기 위한 공개 샘플 노드 |
| `sample.frontend.api-client` | LWS API 클라이언트 계층 | `type.service` | API client/read-write boundary 확인 | typed `/api/lws/*` client와 error/admin header normalization 확인 |
| `sample.frontend.admin-mode` | 로컬 Admin Mode 어댑터 | `type.concept` | local-admin UX와 permission boundary 확인 | Admin mode가 백엔드 권한 검사를 대체하지 않는지 확인 |
| `sample.frontend.editor-flow` | 명시적 저장 편집 흐름 | `type.concept` | create/edit/save/draft 보존 확인 | JSON Patch 생성과 실패 시 draft 보존 확인 |

### 3.2 샘플 엣지

| ID | 표시 제목 | Source | Relation | Target | 관계 의미 |
| --- | --- | --- | --- | --- | --- |
| `sample.edge.frontend-workbench-api-client` | 워크벤치가 API 클라이언트를 사용함 | `sample.frontend.workbench` | `rel.depends_on` | `sample.frontend.api-client` | 워크벤치는 storage에 직접 접근하지 않고 API client에 의존한다. |
| `sample.edge.frontend-workbench-admin-mode` | 워크벤치가 Admin mode를 노출함 | `sample.frontend.workbench` | `rel.references` | `sample.frontend.admin-mode` | 워크벤치는 local development mutation을 위해 Admin mode adapter를 참조한다. |
| `sample.edge.frontend-workbench-editor-flow` | 워크벤치가 편집 흐름을 포함함 | `sample.frontend.workbench` | `rel.contains` | `sample.frontend.editor-flow` | 워크벤치 안에 명시적 저장 편집 흐름이 포함된다. |
| `sample.edge.editor-flow-api-client` | 편집 흐름이 API 클라이언트를 호출함 | `sample.frontend.editor-flow` | `rel.depends_on` | `sample.frontend.api-client` | 편집 저장은 base_rev와 JSON Patch를 API client로 전송한다. |

### 3.3 샘플 관계도

```mermaid
flowchart LR
  Workbench["sample.frontend.workbench<br/>프론트엔드 워크벤치 샘플"]
  ApiClient["sample.frontend.api-client<br/>LWS API 클라이언트 계층"]
  AdminMode["sample.frontend.admin-mode<br/>로컬 Admin Mode 어댑터"]
  EditorFlow["sample.frontend.editor-flow<br/>명시적 저장 편집 흐름"]

  Workbench -- "rel.depends_on<br/>API 호출 경계" --> ApiClient
  Workbench -- "rel.references<br/>로컬 운영 권한 힌트" --> AdminMode
  Workbench -- "rel.contains<br/>편집 기능 포함" --> EditorFlow
  EditorFlow -- "rel.depends_on<br/>PATCH 저장 호출" --> ApiClient
```

### 3.4 샘플 그래프 확인 방법

- object browser에서 `프론트엔드` 또는 `frontend`를 검색한다.
- 먼저 `sample.frontend.workbench`를 선택한다.
- object list에 node와 edge가 함께 보이는지 확인한다.
- edge object를 열었을 때 source, relation type, target이 edge line에 표시되는지 확인한다.
- graph summary가 `sample.frontend.workbench` 중심 관계를 반영하는지 확인한다.
- Admin mode를 켠 뒤 refresh하면 backend permission hint에 따라 sample object 편집 가능 상태가 보이는지 확인한다.

이 샘플 그래프는 일부러 작게 만들었다. 큰 데이터셋으로 UI 상태 버그가 가려지는 것을 피하고, list/search/detail/edit/graph 흐름을 빠르게 검토하기 위한 목적이다.

## 4. 프론트엔드 구조

현재 UI 구성:

```mermaid
flowchart TD
  Page["src/app/page.tsx"]
  Shell["AppShell topbar"]
  Browser["Object Browser"]
  Detail["Object Detail + Edit Tabs"]
  Inspector["Right Inspector"]
  UI["src/components/ui.tsx"]
  Client["src/lib/lws-api/client.ts"]
  Drafts["src/lib/lws-api/drafts.ts"]
  API["/api/lws/*"]

  Page --> Shell
  Page --> Browser
  Page --> Detail
  Page --> Inspector
  Shell --> UI
  Browser --> UI
  Detail --> UI
  Inspector --> UI
  Page --> Client
  Detail --> Drafts
  Client --> API
```

Mutation flow:

```mermaid
sequenceDiagram
  participant User as 사용자
  participant Workbench as Workbench
  participant Draft as Draft Helper
  participant Client as LWS API Client
  participant Backend as /api/lws/*

  User->>Workbench: node 또는 edge field 수정
  Workbench->>Draft: dirty 표시 및 local draft 유지
  User->>Workbench: Save 클릭
  Workbench->>Draft: server object와 draft 비교
  Draft-->>Workbench: JSON Patch 생성
  Workbench->>Client: base_rev와 patch 전달
  Client->>Backend: PATCH /api/lws/nodes/:id 또는 /api/lws/edges/:id
  Backend-->>Client: object, event_id, next_rev, warnings
  Client-->>Workbench: mutation result 반환
  Workbench->>Backend: object/list/validation refresh
```

Permission boundary:

```mermaid
flowchart LR
  UI["Frontend Admin Mode Toggle"]
  Headers["local-script headers"]
  Route["/api/lws route"]
  Context["RequestContext resolver"]
  Service["Service layer guard"]
  Result["Allowed result or LWS error"]

  UI --> Headers
  Headers --> Route
  Route --> Context
  Context --> Service
  Service --> Result
```

중요한 점:

- frontend는 권한을 최종 판단하지 않는다.
- frontend는 local development admin 요청 헤더를 붙일 뿐이다.
- backend service layer가 매 요청마다 permission guard를 다시 수행한다.
- wrong secret, anonymous, production local-admin disabled 상태는 backend error로 표현되어야 한다.

## 5. 수동 검토 계획

브라우저에서 다음 주소를 연다.

```text
http://127.0.0.1:3000
```

코드나 env가 바뀐 뒤에는 `Ctrl + F5`로 강력 새로고침한다.

### 5.1 Anonymous Read 확인

확인할 것:

- 상단 status bar에 `Storage: Ready`, `Env: development`, viewer/auth 상태가 표시되는지 확인한다.
- `프론트엔드` 또는 `frontend`를 검색한다.
- 샘플 object 8개가 보이는지 확인한다.
- `sample.frontend.workbench`를 선택한다.
- Overview, Edit, Validation, Raw JSON tab이 동작하는지 확인한다.
- Admin mode를 켜기 전에는 Edit tab이 readonly인지 확인한다.
- 오른쪽 panel에 Graph, Timeline, Ontology, Validation, API Boundary가 보이는지 확인한다.

기대 결과:

```text
anonymous 사용자는 public sample object를 읽을 수 있지만 수정할 수 없다.
```

### 5.2 Admin Mode 확인

확인할 것:

- `Admin mode`를 켠다.
- local secret을 입력한다.

```text
change-me
```

- refresh 버튼을 누른다.
- `sample.frontend.workbench`를 다시 선택한다.
- backend permission hint에 따라 edit control이 활성화되는지 확인한다.
- 잘못된 secret을 입력했을 때 저장/admin action이 `PERMISSION_DENIED`로 실패하는지 확인한다.

기대 결과:

```text
Admin mode는 local development request adapter로만 동작한다.
권한 실패는 조용히 무시되지 않고 LWS error로 표시된다.
```

### 5.3 Node 생성 확인

확인할 것:

- `Node` 버튼을 클릭한다.
- 예시 ID로 public node를 만든다.

```text
sample.frontend.manual-note
```

- 권장 입력:

```text
type: type.note
detail_mode: note
visibility: public
status: active
```

- 생성 후 해당 object detail이 열리는지 확인한다.
- 검색으로 새 node가 보이는지 확인한다.
- Raw JSON에 source object field가 정상 표시되는지 확인한다.

기대 결과:

```text
POST /api/lws/nodes를 통해 생성되고 workbench가 refresh된다.
```

### 5.4 Edge 생성 확인

확인할 것:

- `Edge` 버튼을 클릭한다.
- source는 `sample.frontend.workbench`를 사용한다.
- target은 `sample.frontend.manual-note` 또는 다른 public sample node를 사용한다.
- relation은 `rel.references`를 사용한다.
- visibility는 `public`으로 둔다.
- 생성 후 edge가 object search에 나타나는지 확인한다.

기대 결과:

```text
POST /api/lws/edges를 통해 생성된다.
public edge의 source/target이 public이 아니면 저장 전 warning이 표시된다.
최종 차단은 backend validation이 수행한다.
```

### 5.5 Edit 확인

확인할 것:

- sample node를 선택한다.
- summary 또는 content를 수정한다.
- 상태가 `dirty`로 바뀌는지 확인한다.
- Save를 누른다.
- mutation result에 event id와 next rev가 표시되는지 확인한다.
- generated patch에 protected field가 포함되지 않는지 확인한다.

기대 결과:

```text
PATCH 요청은 base_rev와 generated JSON Patch를 사용한다.
저장 실패 시 draft가 유지된다.
```

### 5.6 Recovery/Reindex 확인

확인할 것:

- Admin mode가 켜진 상태에서 오른쪽 inspector의 reindex icon을 누른다.
- job result가 표시되는지 확인한다.
- refresh 후 storage/index 상태가 ready인지 확인한다.

기대 결과:

```text
reindex는 local operator recovery action으로 사용할 수 있다.
```

## 6. 시각 검토 자료 계획

다음 검토에서는 아래 화면을 캡처해 비교하는 것이 좋다.

| 시각 자료 | 목적 | 필요한 화면 상태 |
| --- | --- | --- |
| 전체 workbench screenshot | shell 밀도, 3-pane layout, status strip, right inspector 확인 | 검색어 `프론트엔드` 또는 `frontend` |
| Object detail screenshot | 선택 object의 metadata, summary, validation, permission 표시 확인 | `sample.frontend.workbench` 선택 |
| Edit tab screenshot | draft field, state badge, save action, generated patch 영역 확인 | Admin mode enabled |
| Create node dialog screenshot | Radix dialog layout과 field fit 확인 | Node dialog open |
| Edge detail screenshot | source/relation/target edge line 표시 확인 | sample edge 선택 |
| Graph summary screenshot | centered sample graph의 node/edge count 확인 | `sample.frontend.workbench` 선택 |
| Error state screenshot | LWS error banner와 detail disclosure 확인 | wrong admin secret 또는 validation error |

시각 검토 기준:

- 버튼, 탭, field, panel 안의 텍스트가 넘치지 않는다.
- desktop width에서 3-pane layout이 읽기 쉽다.
- 좁은 화면에서는 panel이 겹치지 않고 stack된다.
- icon-only button에는 accessible label과 tooltip이 있다.
- error banner가 object browser나 edit form을 가리지 않는다.
- generated patch 영역은 scroll 가능하고 전체 workbench를 과도하게 밀어내지 않는다.

## 7. 검증 결과

구현 중 통과한 명령:

```powershell
npm.cmd run test:frontend-foundation
npm.cmd run build
npm.cmd run test:milestone-m7
```

샘플 데이터 생성 후 수행한 runtime check:

```text
GET /api/lws/status
POST /api/lws/admin/reindex
GET /api/lws/objects?q=frontend&include_permissions=true&limit=20
GET /api/lws/objects?q=프론트엔드&include_permissions=true&limit=20
GET /api/lws/graph?center=sample.frontend.workbench&depth=1
```

관찰 결과:

- storage status는 `ok`이다.
- SQLite index state는 `ready`이다.
- reindex는 `object_count: 8`, `edge_count: 4`로 성공했다.
- public object search에서 sample frontend node/edge가 반환된다.
- 한국어 검색어 `프론트엔드`로 한국어 제목과 요약이 반환된다.
- `sample.frontend.workbench` 중심 graph query가 관련 node와 edge를 반환한다.
- local-admin context에서 `sample.frontend.workbench`는 `can_update: true`로 조회된다.

## 8. 알려진 후속 작업

- object detail 상태가 안정화되면 `/objects/[id]` 전용 route를 추가한다.
- F3에서 full graph explorer와 accessible graph list alternative를 추가한다.
- F4에서 history/diff/restore UX를 추가한다.
- F5에서 admin job list/detail/cancel 화면을 확장한다.
- UI 동작이 안정화되면 Playwright 또는 route-level browser smoke test를 추가한다.
- `next`, `postcss`, `sharp` 관련 `npm audit` finding은 별도 framework upgrade 계획으로 처리한다.
- 기존 Turbopack NFT tracing warning은 이번 frontend slice 이전부터 있던 경고이며 별도 작업으로 정리한다.

