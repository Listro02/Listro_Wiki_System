# L.W.S. Ad-hoc Knowledge Timeline 구현 보고서

작성일: 2026-08-05  
최종 정리: 2026-08-05

## 1. 구현 결과 요약

이번 작업으로 저장된 `view.timeline.*` 없이 URL query만으로 탐색 조건을 표현하는 Ad-hoc Knowledge Timeline을 구현했다.

```text
/timeline URL query
  → GET /api/lws/timeline
  → permission-aware SQLite projection query
  → normalized Node/Edge Timeline response
  → Node-based scene adapter
  → React Flow time-axis scene
```

Backend는 `node`, `edge`, 또는 둘 모두를 Timeline item으로 조회할 수 있다. 현재 Frontend는 `kind=node`만 요청하고, 조회된 Node 사이의 readable relation을 scene Edge로 별도 표시한다. 따라서 현재 화면의 relation Edge는 Edge Timeline item이 아니라 Node의 관계 context다.

현재 구현의 핵심 결과는 다음과 같다.

- URL query가 적용된 탐색 조건의 source of truth다.
- `created`, `updated`, `occurred`, `valid`, `custom` time basis를 지원한다.
- Backend가 normalized time과 permission-safe relation을 반환하고 Frontend는 이를 동일한 scene 규칙으로 렌더링한다.
- Dated Node만 시간축에 배치하며, 예외 상태는 Temporal coverage로 분리한다.
- Node/Edge selection inspector와 coverage 목록은 하나의 right sidebar를 공유한다.
- 검색형 filter는 draft를 유지하고 하나의 `Apply filters`로 적용한다.
- History API와 Activity Timeline은 변경하지 않았다.

## 2. Knowledge Timeline과 History의 경계

Knowledge Timeline은 선택한 time basis에 따라 Object를 시간축에 배치하는 탐색 기능이다. History는 Object mutation을 감사 추적하는 별도 기능이다.

| Time basis | 의미 | Scene 표현 |
| --- | --- | --- |
| `created` | 현재 Object revision의 `audit.created_at` | point |
| `updated` | 현재 Object revision의 `audit.updated_at` | point |
| `occurred` | `temporal.occurred_at` knowledge time | point |
| `valid` | `temporal.valid_from`~`valid_to` validity | interval |
| `custom` | Props Inline temporal wrapper가 선언한 시간 | point 또는 interval |

`updated`는 현재 revision의 마지막 수정 시각이지 mutation event 전체가 아니다. 생성·수정·삭제·복원 event와 patch/diff는 기존 Object History API와 UI에서 확인한다. Events 기반 global Activity Timeline은 이번 범위에 포함하지 않는다.

### 2.1 Knowledge Timeline과 Activity Timeline의 차이

두 Timeline은 모두 시간을 사용하지만, 시간의 의미와 탐색 단위가 다르다. 하나의 화면이나 API로 합치지 않는다.

| 구분 | Knowledge Timeline | Activity Timeline (후속) |
| --- | --- | --- |
| 질문 | Object가 지시하는 지식은 언제 발생·유효한가? | 시스템에서 어떤 변경 활동이 언제 일어났는가? |
| 시간 원천 | `audit.created_at`, `audit.updated_at`, canonical `temporal.*`, Custom Props `$temporal` | global event log와 per-object History entry의 event `occurred_at` |
| 기본 항목 | Node 또는 Edge Object | 생성·수정·삭제·복원·권한/운영 작업 같은 mutation event |
| 범위 | Type/Tag/Scope/Collection/center와 knowledge-time range | 전역, Scope/Collection, account, Object, event type과 activity-time range |
| 상세 이동 | Object detail | event detail, diff, Object History, 필요 시 Object detail |
| 주된 목적 | 도메인 사실·유효기간·관계의 시간적 탐색 | 감사, 최근 변경 확인, 운영 활동 추적 |

예를 들어 “프로젝트가 2026-08-03에 시작되었다”는 Knowledge Timeline의 `occurred` 또는 Custom Props point다. “누군가 2026-08-05에 프로젝트의 제목을 수정했다”는 Activity Timeline의 `node.updated` event다. 후자는 Object의 현재 `updated` field 하나로 대체할 수 없다. `updated`는 마지막 수정 시각만 보존하고, Activity Timeline은 모든 mutation event의 순서를 보존해야 한다.

## 3. Timeline API 계약

### 3.1 조회 API

`GET /api/lws/timeline`

```text
kind=node|edge
basis=created|updated|occurred|valid|custom
time_path=/props/...                 # custom에서 필수
temporal_state=dated|undated
from=<ISO full-date | offset/Z datetime>
to=<ISO full-date | offset/Z datetime>
type=<Node Type | relation Type>
tag=<Tag id>
scope=<Scope id>
collection=<Collection id>
status=active|archived|deleted|draft|stub
visibility=public|private
group_by=none|type|tag|scope|collection
center=<Object id>
depth=1
limit=1..100
cursor=<opaque cursor>
```

기본값은 `basis=created`, `temporal_state=dated`, `status=active`, `group_by=none`, `depth=1`, `limit=50`이다. `kind`를 생략하면 Backend는 Node와 Edge를 모두 조회한다.

`scope`와 `collection`은 동시에 사용할 수 없고 `depth`는 현재 `1`만 허용한다. 위반 시 `SCHEMA_INVALID`를 반환한다. `center`는 readable center Object와 readable 1-hop neighbor로 후보 집합을 제한한다.

`scope.wiki`는 일반 membership Scope가 아니라 L.W.S.의 root/global scope다. 따라서 `scope=scope.wiki`는 해당 membership만 가진 Object로 결과를 좁히지 않으며, 전역 탐색의 호환 표현으로 처리한다. 다른 `scope.*` 또는 `collection.*` 값은 `object_scope_memberships` 조건으로 조회한다.

Frontend는 `active`, `archived`, `deleted`, `draft`, `stub`를 Status select 옵션으로 제공한다. Backend의 현재 Timeline query는 status 문자열 자체를 enum으로 제한하지 않고 SQLite equality filter로 전달하므로, API consumer는 지원 상태값을 사용해야 한다.

### 3.2 시간 범위 판정

- point는 `from`~`to` inclusive range 안에 있을 때 조회한다.
- interval은 requested range와 겹칠 때 조회한다.
- null start/end는 open interval로 처리한다.
- date-only point/start는 날짜 시작점으로, date-only interval end는 날짜 종료점으로 정규화한다.
- offset/Z datetime은 UTC epoch key로 변환한다.
- 원본 temporal string과 precision은 API response에 그대로 보존한다.

### 3.3 Response 핵심 구조

```ts
position:
  | {
      kind: "point";
      at: string;
      normalized_at: number;
      precision: "date" | "datetime";
    }
  | {
      kind: "interval";
      start: string | null;
      end: string | null;
      normalized_start: number | null;
      normalized_end: number | null;
      start_precision: "date" | "datetime" | null;
      end_precision: "date" | "datetime" | null;
    }
  | { kind: "undated" };

domain: {
  min_key: number | null;
  max_key: number | null;
};
```

Node page에 포함된 두 readable endpoint를 연결하는 relation은 다음 scene context로 반환한다.

```ts
relations: Array<{
  edge_id: string;
  relation_type: string;
  source_id: string;
  target_id: string;
  branch_at: string | null;
  normalized_branch_at: number | null;
}>;
```

permission을 통과하지 못한 Edge 또는 현재 page에 readable endpoint가 모두 존재하지 않는 Edge는 포함하지 않는다. Frontend는 Graph API를 추가 join하거나 permission을 추론하지 않고 이 응답만으로 scene을 만든다.

## 4. Props Temporal Convention과 SQLite Projection

Custom Timeline은 [LWS_PROPS_CONVENTION.md](../../LWS_PROPS_CONVENTION.md)의 Inline temporal wrapper만 사용한다.

```json
{
  "props": {
    "release": {
      "$value": { "version": "1.0" },
      "$temporal": {
        "kind": "point",
        "at": "2026-08-03"
      }
    }
  }
}
```

- `$value`는 Timeline projection에 복사하지 않는다.
- `$temporal`이 선언된 wrapper만 시간 property로 취급한다.
- 일반 date-like scalar는 자동 추론하거나 projection하지 않는다.
- wrapper container는 `/props/release` 같은 JSON Pointer로 선택한다.
- point, closed/open interval, explicitly undated wrapper를 지원한다.
- array 내부 wrapper와 epoch number source는 현재 지원하지 않는다.

SQLite schema version 5는 다음 read projection을 사용한다.

- `timeline_items`: canonical temporal과 audit time의 normalized key·precision
- `timeline_property_values`: Object ID와 property path별 Custom temporal projection

source of truth는 Node/Edge JSON이다. SQLite row는 mutation과 full reindex에서 같은 extractor로 다시 만들 수 있는 generated read projection이며 별도 Node가 아니다.

신규 mutation의 malformed temporal value와 reversed interval은 `SCHEMA_INVALID`로 거부한다. Legacy invalid value는 validation issue로 남기고 dated projection에서 제외한다.

## 5. Permission, Filter, Grouping, Cursor

permission predicate와 Type/Tag/Scope/Collection/status/visibility/center 조건은 같은 SQLite query boundary에서 적용한다. group count와 Temporal coverage count도 현재 viewer에게 readable한 matching Object만 집계한다.

`group_by`는 filter가 아니라 scene lane의 display dimension이다.

- `none`: 단일 Timeline lane
- `type`: primary Type별 lane
- `tag`, `scope`, `collection`: many-to-many facet lane

Facet grouping에서는 같은 Object가 여러 lane에 projection될 수 있으나 Object identity와 relation identity는 하나다. relation을 모든 projection 조합으로 복제하지 않는다. 기본 Edge는 숨기고 선택한 Node copy의 직접 readable relation만 해당 copy를 anchor로 표시한다.

Timeline은 opaque keyset cursor를 사용한다. cursor는 query hash, index revision, normalized sort key와 Object ID에 묶인다. query 조건이나 index revision이 달라지면 `CURSOR_INVALID`를 반환하고 Frontend는 첫 page로 복구한다.

## 6. Node-based Scene

초기 card DOM·CSS zoom·scroll 기반 구현은 API result, layout, hit testing, relation anchor가 서로 다른 좌표 체계를 사용해 갱신과 상호작용 오류를 만들었다. 이를 다음 구조로 교체했다.

```text
TimelineResponse
  → buildTimelineScene()
  → React Flow Node/Edge
  → 하나의 viewport transform
```

Scene 규칙은 다음과 같다.

- Node의 X 좌표는 Backend normalized key와 response domain으로 계산한다.
- 같은 time bucket의 Node는 같은 vertical time guide를 공유한다.
- 같은 guide에서 겹치는 Node는 deterministic row allocation으로 Y만 분리한다.
- point는 marker, interval은 duration line, open interval은 continuation cap으로 표시한다.
- response 또는 granularity가 바뀌면 scene을 재구성한다.
- wheel/trackpad pinch는 zoom, canvas drag는 전 방향 pan을 담당한다.
- `Fit scene`, `Zoom out`, MiniMap과 React Flow controls를 제공한다.
- time guide 선택은 더 세분화된 granularity로 drill down하며 URL drill history로 이전 범위를 복원한다.

## 7. Node와 Relation 상호작용

- Node를 선택하면 Node와 직접 relation을 강조하고 selection inspector를 연다.
- 같은 Node copy를 다시 선택하거나 canvas를 선택하면 focus가 해제된다.
- Node를 drag하는 동안 relation 위치를 임시로 확인할 수 있고, 놓으면 원래 시간 기반 위치로 돌아간다.
- Edge는 평소 희미하게 표시하고 선택되거나 선택 Node와 직접 연결되면 강조한다.
- Edge drag는 relation 곡률의 임시 preview이며 놓으면 원래 경로로 돌아가되 focus는 유지한다.
- Node와 Edge double click은 Workbench의 Object detail로 이동한다.
- query/filter/basis가 바뀌면 Node·Edge focus와 sidebar selection을 해제한다.

Node drag와 Edge drag는 data mutation이 아니며 scene layout이나 source JSON을 저장하지 않는다.

## 8. Dated Scene과 Temporal Coverage

Timeline scene은 선택 basis에서 유효한 point 또는 interval을 가진 Dated Node만 렌더링한다. Undated Object를 임의 X 좌표에 놓는 표현은 시간 의미를 왜곡하므로 제거했다.

```text
Dated
  → time-axis scene
  → 하단 Chronological list

Undated / Missing / Invalid
  → Temporal coverage right sidebar
```

Dated 목록은 이미 scene과 접근 가능한 `Chronological list`에서 제공하므로 coverage sidebar에 중복 탭을 만들지 않는다.

Coverage 상태는 다음과 같다.

- `undated`: `occurred`/`valid`의 canonical 값이 없거나 Custom wrapper가 명시적으로 undated다.
- `missing`: Custom `time_path`에 wrapper가 없다.
- `invalid`: normalization 실패, reversed interval 또는 invalid Custom projection이다.

`created`와 `updated`는 audit timestamp가 항상 정규화 가능하다는 Object model을 전제한다. 예외적으로 audit key를 만들 수 없는 legacy data는 `undated`가 아니라 `invalid`로 분류한다.

일반 Timeline UI는 `temporal_state=dated`로 scene을 조회한다. Backend의 `temporal_state=undated` 계약은 curator와 data-quality workflow를 위해 유지한다.

## 9. Temporal Coverage API와 Lazy Loading

`GET /api/lws/temporal-coverage`

```text
basis, time_path, state=undated|missing|invalid
kind, type, tag, scope, collection
status, visibility, center, depth
limit, cursor
```

Coverage는 선택 basis의 선언·유효성 상태를 점검하므로 `from`, `to`, `group_by`를 받지 않는다. Timeline API와 같은 base filter builder와 temporal classifier를 사용하여 Timeline count와 대상 목록이 같은 규칙을 따른다.

- Timeline 최초 요청은 `time_coverage` count만 반환한다.
- Coverage 목록은 sidebar를 열고 state tab을 처음 선택할 때 lazy fetch한다.
- cache key는 normalized Timeline query, coverage state, index revision이다.
- 같은 tab 재진입과 tab 왕복은 cached page를 재사용한다.
- `Load more`는 해당 state의 다음 cursor page만 append한다.
- basis, Custom path, filter, center, Admin auth context, Refresh 또는 index revision 변경 시 cache를 무효화한다.
- request sequence guard로 이전 조건의 늦은 응답이 새 sidebar를 덮어쓰지 못하게 한다.

Coverage cursor도 query, state, index revision, title과 Object ID에 묶인 opaque keyset cursor다.

## 10. Inspector와 Sidebar Layout

Node/Edge inspector와 Temporal coverage는 하나의 right sidebar를 공유한다.

```text
closed | selection | coverage
```

- Node inspector는 time position, Type, Tag, audit metadata와 detail action을 표시한다.
- Edge 선택 시 Object detail을 lazy fetch하여 relation Type, source/target, status, visibility, Tag, temporal, audit metadata를 표시한다.
- Escape, close button, canvas click 또는 query 변경으로 닫는다.
- Desktop에서는 sidebar가 390px 공간을 차지하고 Timeline 페이지 전체가 좌측 가용 영역으로 부드럽게 재배치된다.
- Mobile에서는 전체 너비 drawer로 표시한다.

## 11. Filter와 URL State

URL query는 적용 완료된 탐색 상태다. 입력 중인 draft는 URL이나 Timeline query를 변경하지 않는다.

- `Time basis`, `Status`, `Group` select는 즉시 적용한다.
- `From`, `To`, Custom path, Type, Tag, Scope, Collection, Center는 local draft다.
- 검색형 field는 250ms debounce로 `/api/lws/search` 후보만 조회한다.
- 후보 선택은 canonical ID를 draft에 채우며 Timeline은 다시 조회하지 않는다.
- 하나의 `Apply filters`가 모든 draft를 검증하고 URL을 한 번 갱신한다.
- 올바른 prefix의 raw ID는 search result에 없어도 적용할 수 있다.
- Scope와 Collection은 상호 배타적이며 한쪽을 입력하면 다른 draft를 비운다.
- 실제 filter 적용 시 cursor, drill history, selection과 coverage cache를 초기화한다.
- 새로고침, bookmark, 공유와 browser back/forward에서 적용된 조건을 복원한다.
- local admin secret과 session 정보는 URL에 기록하지 않는다.

## 12. Permission과 Admin Mode

Timeline item, scene relation, group count, center context, coverage count와 coverage 대상 목록은 모두 permission-aware query 결과다. unreadable Object, private Edge와 unreadable endpoint ID/title은 anonymous viewer에게 노출하지 않는다.

Local development의 Admin mode는 Workbench와 같은 local-admin request header 정책을 사용한다. Admin mode 또는 auth context가 바뀌면 Timeline을 다시 조회하고 selection과 coverage cache를 초기화한다.

## 13. Error와 Index 상태

- missing, stale, corrupt, schema mismatch projection은 기존 LWS error response pattern으로 표시한다.
- `INDEX_SCHEMA_MISMATCH`에서는 reindex가 완료될 때까지 Timeline query를 허용하지 않는다.
- cursor query/revision mismatch는 `CURSOR_INVALID`이며 첫 page로 돌아가는 action을 제공한다.
- malformed Custom path, temporal input과 Scope/Collection 동시 조건은 `SCHEMA_INVALID`다.
- production build에는 `next.config.ts → storage-doctor.ts`의 동적 filesystem tracing에 관한 기존 Turbopack warning이 남아 있다. Timeline 기능 오류는 아니지만 별도 build 정비 대상으로 추적한다.

## 14. 검증 결과

다음 자동 검증을 수행했다.

```powershell
npm.cmd run test:timeline
npm.cmd run test:milestone-m3
npm.cmd run test:milestone-m4
npm.cmd run test:milestone-m6
npm.cmd run test:frontend-foundation
npm.cmd run build
```

검증 범위는 다음을 포함한다.

- Node/Edge/all Timeline query와 anonymous permission boundary
- Type/Tag/grouping과 readable relation scene 변환
- occurred point range, validity overlap, open interval과 reversed legacy interval 제외
- created/updated basis와 Custom point/closed/open/undated/invalid projection
- 일반 date-like Props scalar projection 제외
- Custom missing/undated/invalid coverage 분류와 permission-safe 목록
- Timeline 및 coverage cursor query mismatch
- incremental mutation과 full reindex projection 일치
- same-day time bucket과 drill granularity scene 좌표
- production TypeScript build와 frontend foundation 회귀

Pointer, keyboard, responsive layout은 자동 계약 검증만으로 충분하지 않으므로 실제 browser에서 별도로 확인해야 한다.

## 15. 최종 정리 및 추가 진행 사항

현재 Ad-hoc Knowledge Timeline은 첫 frontend release 범위에서 완료로 판단한다. URL 기반 시간 탐색, Node scene, relation context, inspector, coverage, Custom Props time, permission, grouping과 cursor가 하나의 계약으로 연결되어 있다.

### 15.1 마무리 점검

기능 확장 전에 실제 browser에서 다음 회귀 항목을 한 차례 확인한다.

- Node/Edge click, 재선택 해제, drag 후 focus 유지
- Inspector 개폐 시 전체 Timeline page의 desktop push animation
- Mobile full-width drawer와 Escape/close 동작 (이거는 확인 안 했음.)
- 단일 `Apply filters`, autocomplete draft와 browser back/forward
- Coverage lazy fetch, cache 재사용, state tab과 pagination
- Admin mode on/off에서 private Node/Edge 노출 경계
- wheel/pinch zoom, 전 방향 pan, time guide drill과 Zoom out

이 점검에서 발견되는 문제는 새 기능이 아니라 Timeline stabilization bug로 처리한다.

### 15.2 후속 구현으로 보류

- saved `view.timeline.*`와 `/api/lws/timeline/:viewId`
- saved Timeline View 생성·편집·공유·History
- Edge 자체를 time-axis item으로 표시하는 Frontend Edge Timeline
- relation `branch_at` junction과 temporal graph routing
- 대규모 result virtualization과 semantic zoom
- History event 기반 global Activity Timeline
- Type/Definition Node가 권장 temporal property path를 선언·검증하는 Ontology 연계
- array 내부 temporal wrapper와 epoch number source
- curator용 temporal data-quality 편집 workflow

`type.timeline-view`와 `/timeline/:viewId` route reservation은 future saved view를 위해 유지한다.

### 15.3 Activity Timeline 보류 범위

Activity Timeline은 Knowledge Timeline의 확장이 아니라 global event log를 읽는 별도 read model·API·UI다. 현재 Backend에는 global event log와 Object별 History projection이 존재하지만, 전역 activity list API와 Timeline 화면은 구현하지 않았다.

향후 Activity Timeline을 시작할 때는 다음을 별도 설계한다.

- permission-aware global event pagination과 event-type/account/Scope/Collection/Object filter
- event summary 목록과 lazy event detail·diff 연결
- audit/activity time의 cursor와 retention·compaction 정책
- Knowledge Timeline과 분리된 route, URL query, saved activity view 여부
- public activity 노출 금지 및 과거 private data가 event stream으로 새지 않는 permission 정책

이 기능은 현재 `/timeline`의 basis나 coverage에 추가하지 않는다. `/timeline`은 Object knowledge time 탐색 화면으로 유지하고, Activity Timeline은 별도 route와 API로 도입한다.
