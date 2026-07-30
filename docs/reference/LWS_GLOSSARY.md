# L.W.S. Glossary

작성일: 2026-07-30

## 1. 목적

이 문서는 L.W.S. 설계/구현 문서에서 반복되는 backend, storage, index, permission 용어의 기준 정의를 모은다.

긴 설계 설명을 대신하는 문서가 아니라, "이 용어가 L.W.S.에서 정확히 무엇을 뜻하는가"를 빠르게 확인하기 위한 reference다.

## Source Of Truth

최종 원본 데이터다.

LWS에서는 current node/edge JSON과 event/patch/history record가 source of truth다.

예:

- `knowledge/nodes/*.json`
- `knowledge/edges/*.json`
- `data/events/**/*.jsonl`
- `data/history/{nodes,edges}/.../events.jsonl`
- `data/history/{nodes,edges}/.../patches/*.json`

SQLite DB는 source of truth가 아니다. SQLite가 없어지거나 손상되어도 source of truth가 남아 있으면 read model은 다시 만들 수 있어야 한다.

## Projection

Source of truth에서 파생한 읽기용 데이터 구조다.

LWS에서는 주로 SQLite table을 뜻한다. 예를 들어 `objects`, `graph_edges`, `timeline_items`, `events`, `object_history`, `account_permissions`는 projection이다.

Projection은 source of truth가 아니므로 삭제되거나 손상되어도 reindex로 다시 만들 수 있어야 한다.

헷갈리기 쉬운 구분:

- 원본 JSON/event/history: 진짜 데이터
- SQLite projection: 빠르게 검색하고 조회하기 위해 만든 파생 데이터

## Generated Read Model

Source of truth에서 생성한 읽기 전용 모델이다.

LWS에서는 SQLite projection 전체를 generated read model이라고 부른다. list, search, graph, timeline, ontology, history lookup, permission query는 이 read model을 사용한다.

Generated read model은 사용자가 직접 편집하는 원본이 아니다. mutation은 source JSON과 event/history를 먼저 갱신하고, 이후 read model을 incremental update하거나 stale 상태로 표시한다.

## Reindex

Source of truth를 다시 스캔해 SQLite projection을 재생성하는 작업이다.

Reindex는 source JSON, global event log, object history를 읽어 `objects`, `graph_edges`, `events`, `object_history`, permission projection 같은 테이블을 다시 채운다.

Reindex는 source of truth를 수정하지 않는다.

## Full Reindex

SQLite DB가 없거나 버려진 상태에서도 source of truth만으로 전체 projection을 다시 만드는 재생성 흐름이다.

예:

```text
lws.sqlite 삭제
  -> ReindexCommand 실행
  -> source JSON/event/history scan
  -> SQLite projection 재생성
```

Full reindex가 가능해야 SQLite를 disposable generated read model로 유지할 수 있다.

## Incremental Projection Update

Mutation 성공 후 affected projection row만 갱신하는 흐름이다.

예를 들어 node 하나를 수정하면 해당 object row, tag row, timeline row, event/history projection row만 갱신한다. 매번 full reindex를 실행하지 않기 위한 최적화다.

Incremental update가 실패하면 source mutation은 rollback하지 않고 `INDEX_STALE` 상태를 남긴다. source of truth가 이미 durable하게 기록되었다면, read model은 나중에 reindex로 복구할 수 있기 때문이다.

## INDEX_REBUILD_REQUIRED

SQLite projection이 없거나 아직 build되지 않은 상태다.

예:

- `lws.sqlite` 파일이 없음
- projection schema가 초기화되지 않음

이 상태에서 query API는 read model을 신뢰할 수 없으므로 LWS error로 실패한다. 일반 대응은 reindex다.

## INDEX_STALE

Source of truth는 최신이지만 SQLite projection이 뒤처진 상태다.

예:

```text
node JSON write 성공
event/history append 성공
SQLite projection update 실패
```

이 경우 원본은 최신이지만 list/search/graph/permission query가 보는 SQLite read model은 오래된 상태일 수 있다.

특히 permission projection이 stale이면 이전 권한이 남아 있거나 새 권한이 반영되지 않았을 수 있으므로 private read/write는 fail-closed로 거부한다.

## INDEX_CORRUPT

SQLite 파일이 깨졌거나 열 수 없는 상태다.

예:

- `lws.sqlite` 파일 내용이 SQLite DB가 아님
- `index_meta` 같은 필수 table을 읽을 수 없음
- SQLite open/read 중 low-level error 발생

이 상태의 projection은 신뢰할 수 없다. 일반 대응은 corrupt file을 격리하고 full reindex를 실행하는 것이다.

## INDEX_SCHEMA_MISMATCH

SQLite schema version이 현재 backend가 기대하는 version과 다른 상태다.

예:

```text
index_meta.schema_version = 2
현재 backend INDEX_SCHEMA_VERSION = 3
```

이 경우 query code가 기대하는 table/column과 실제 DB가 다를 수 있으므로 read model을 ready로 취급하지 않는다. 일반 대응은 migration 또는 full reindex다.

## Fail-Closed

권한이나 상태 판단이 불확실하면 접근을 거부하는 정책이다.

문이 고장났을 때 열린 상태로 두는 것이 fail-open이고, 닫힌 상태로 두는 것이 fail-closed다. LWS는 private read/write/admin boundary에서 fail-closed를 기본으로 한다.

예:

- permission projection missing: private read 거부
- permission projection stale: private write 거부
- SQLite corrupt: private permission 판단 거부
- untrusted frontend account header: anonymous로 처리

Public object read는 object JSON의 `visibility: "public"`을 기준으로 허용될 수 있지만, private object는 effective permission을 확인할 수 없으면 거부한다.

## Permission Projection

Permission graph를 SQLite permission table로 펼친 projection이다.

LWS에서 권한의 원본은 account/group/scope/object node와 permission edge다. Reindex 또는 incremental update는 이 원본을 다음 테이블로 변환한다.

- `accounts`
- `account_groups`
- `object_owners`
- `object_scope_memberships`
- `account_permissions`

PermissionService는 매 요청마다 raw graph를 직접 순회하지 않고, 이 permission projection을 조회해 read/write/admin 권한을 판단한다.

## Effective Permission

직접 권한, ownership, group membership, scope/collection permission을 합쳐 계산한 최종 적용 권한이다.

예를 들어 `account.a`가 `note.private`를 읽을 수 있는 경로는 여러 가지다.

- `account.a --rel.can_read--> note.private`
- `account.a --rel.owns--> note.private`
- `account.a --rel.member_of--> group.team` 그리고 `group.team --rel.can_read--> note.private`
- `account.a --rel.member_of--> group.team`, `group.team --rel.can_read_in--> collection.team`, `collection.team --rel.contains--> note.private`

이 모든 경로를 permission projection에서 계산한 결과가 effective permission이다.

## RequestContext

요청자가 누구인지와 어떤 auth source에서 왔는지를 담는 request identity context다.

예:

- `accountId`
- `isAnonymous`
- `authSource`
- `requestId`

RequestContext는 권한의 source of truth가 아니다. 실제 object/scope 권한은 PermissionService가 permission projection을 조회해 판단한다.

## Viewer Permissions

이미 볼 수 있는 object에 대해 UI가 참고할 수 있는 per-object capability hint다.

예:

- `can_read`
- `can_update`
- `can_delete`
- `can_restore`
- `can_manage_access`

`viewer_permissions`는 guard를 대체하지 않는다. Backend service는 mutation/read 요청마다 PermissionService guard를 다시 통과해야 한다.

## UI Capabilities

Session API가 UI에 알려주는 coarse-grained capability hint다.

예:

- `object.read.public`
- `object.create`
- `object.read.private`
- `object.manage.access`
- `system.manage`

UI capabilities는 화면 표시와 버튼 활성화에 도움을 주는 hint다. 이것도 backend guard를 대체하지 않는다.
