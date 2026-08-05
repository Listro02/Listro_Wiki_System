# L.W.S. Node Model

`props`의 custom time 표현은 [LWS_PROPS_CONVENTION.md](./LWS_PROPS_CONVENTION.md)의 Inline temporal wrapper를 따른다.

이 문서는 L.W.S.의 `node` object를 backend 구현 기준으로 정리한다.

Node는 지식의 대상이다. 일반 wiki page뿐 아니라 tag, node type, relation type, graph view, timeline view, setting 같은 wiki 구조 자체도 node로 표현한다.

## 1. Node가 표현하는 대상

Node는 다음을 모두 표현할 수 있다.

```text
일반 wiki page
상위 collection page
stub page
tag
node type
relation type
graph view
timeline view
setting
template
system object
project
service
concept
event
source
```

예:

```text
app.lws
svc.caddy
tag.server
type.service
rel.depends_on
view.graph.server-infra
view.timeline.server-history
setting.wiki.behavior
```

중요한 점은 tag, type, relation type도 단순 문자열이 아니라 node id라는 것이다.

## 2. Required shape

Node JSON의 필수 shape는 다음이다.

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

## 3. Required field summary

| Field | Type | Required | 의미 |
| --- | --- | --- | --- |
| `schema_version` | integer | yes | object schema version |
| `object_kind` | `"node"` | yes | object 종류를 구분하는 discriminator |
| `id` | string | yes | L.W.S. 전체에서 고유하고 안정적인 node 식별자 |
| `rev` | integer | yes | 저장 충돌 감지를 위한 revision 번호 |
| `title` | string | yes | 사람이 읽는 표시 이름 |
| `slug` | string | yes | URL과 UI 표시용 readable identifier |
| `type` | string | yes | 이 node의 종류를 가리키는 type node id |
| `detail_mode` | enum | yes | node가 가진 설명의 깊이 |
| `visibility` | enum | yes | public/private 공개 경계 |
| `status` | enum | yes | object의 lifecycle 상태 |
| `tags` | string[] | yes | 연결된 tag node id 목록 |
| `props` | object | yes | type별 custom field를 담는 확장 영역 |
| `temporal` | object | yes | 이 node가 설명하는 지식 자체의 시간 정보 |
| `audit` | object | yes | object 생성/수정 메타데이터 |

## 4. Field details

### `schema_version`

```text
Type:
  integer

Required:
  yes

Example:
  1
```

object schema version이다. 이후 schema migration이 필요할 때 사용한다.

### `object_kind`

```text
Type:
  string literal

Required:
  yes

Allowed:
  "node"
```

이 JSON object가 node인지 edge인지 구분하는 discriminator이다. Node file에서는 반드시 `"node"`여야 한다.

### `id`

```text
Type:
  string

Required:
  yes

Must be:
  globally unique within L.W.S.
  stable over time
  lowercase recommended
```

node의 고정 식별자이다. `title`이나 `slug`는 바뀔 수 있지만, `id`는 가능한 바꾸지 않는다.

권장 namespace:

```text
sys.*
app.*
svc.*
concept.*
note.*
doc.*
event.*
collection.*
tag.*
type.*
rel.*
scope.*
view.graph.*
view.timeline.*
setting.*
template.*
account.*
group.*
```

namespace 의미:

| Namespace | 의미 | 예 |
| --- | --- | --- |
| `sys.*` | L.W.S. 내부 동작이나 reserved system object | `sys.root` |
| `app.*` | application, web app, tool, software project | `app.lws` |
| `svc.*` | server/service/process/daemon 같은 운영 서비스 | `svc.caddy` |
| `concept.*` | 개념, 원칙, 추상 주제 | `concept.public-boundary` |
| `note.*` | 짧은 메모나 임시 정리 | `note.proxy-checklist` |
| `doc.*` | 문서, 설계서, 참고 자료 | `doc.storage-contract` |
| `event.*` | 실제 사건, 변경, 장애, 배포 같은 timeline 대상 | `event.lws-initial-design` |
| `collection.*` | 여러 node를 묶는 상위 collection/page | `collection.server-operations` |
| `tag.*` | tag object. 문자열 tag가 아니라 node로 관리한다. | `tag.server` |
| `type.*` | node type object. node의 `type` field가 참조한다. | `type.service` |
| `rel.*` | relation type object. edge의 `type` field가 참조한다. | `rel.depends_on` |
| `scope.*` | 권한이나 설정이 적용되는 범위 object | `scope.wiki` |
| `view.graph.*` | graph view 설정을 담는 node | `view.graph.server-infra` |
| `view.timeline.*` | timeline view 설정을 담는 node | `view.timeline.server-history` |
| `setting.*` | wiki/app 동작 설정을 담는 node | `setting.wiki.behavior` |
| `template.*` | node/edge 생성에 사용할 template object | `template.service-page` |
| `account.*` | account identity object. 사람 계정과 reserved system account를 모두 포함한다. | `account.taewo`, `account.system` |
| `group.*` | 여러 account를 묶는 permission group object | `group.admin` |

permission 관련 namespace 상세:

```text
scope.*:
  권한이 적용되는 범위를 나타내는 node이다.
  특정 object 하나가 아니라 wiki 전체, system 영역, ontology 영역,
  public publishing 영역, 특정 collection 하위 영역처럼 넓은 권한 대상을 표현할 때 사용한다.

  예:
    scope.wiki
    scope.system
    scope.ontology
    scope.public

account.*:
  L.W.S.에서 행위 주체가 되는 account node이다.
  로그인 가능한 사람 계정과 로그인 불가능한 reserved internal account를 모두 포함한다.
  audit.created_by / audit.updated_by는 account.* node id를 참조한다.

  예:
    account.taewo
    account.admin
    account.system
    account.migration

group.*:
  여러 account를 묶는 permission group node이다.
  account는 rel.member_of edge로 group에 연결될 수 있고,
  group은 rel.can_create_in, rel.can_update_in, rel.can_manage_in 같은 permission edge를 받을 수 있다.

  예:
    group.admin
    group.maintainers
```

권한 관계 예:

```text
account.taewo --rel.member_of--> group.admin
group.admin --rel.can_manage_in--> scope.system
account.taewo --rel.can_create_in--> scope.wiki
account.taewo --rel.can_update_in--> collection.server-operations
account.taewo --rel.owns--> svc.caddy
```

예:

```json
"id": "svc.caddy"
```

나쁜 예:

```text
"id": "Caddy"
"id": "caddy server"
```

좋은 예:

```text
"id": "svc.caddy"
"id": "tag.server"
"id": "type.service"
```

### `rev`

```text
Type:
  integer

Required:
  yes

Rule:
  starts from 1
  increments on every successful write
```

실시간 저장과 충돌 감지를 위한 revision number이다. 저장 API는 request의 `base_rev`와 현재 object의 `rev`를 비교한다.

```text
base_rev == current rev:
  save allowed

base_rev != current rev:
  409 conflict
```

### `title`

```text
Type:
  string

Required:
  yes
```

사람이 보는 표시 이름이다.

### `slug`

```text
Type:
  string

Required:
  yes

Rule:
  URL-safe
  unique among nodes when possible
```

URL과 UI route에 쓰는 readable identifier이다. `id`는 내부 연결용이고, `slug`는 URL/표시용이다.

### `type`

```text
Type:
  string

Required:
  yes

Value:
  node id of a type object
```

이 node가 어떤 종류인지 나타낸다. 중요한 점은 `type` 자체도 node라는 것이다.

예:

```json
"type": "type.service"
```

`type.service`는 다음과 같은 node로 존재할 수 있다.

```json
{
  "object_kind": "node",
  "id": "type.service",
  "title": "Service",
  "type": "type.node-type"
}
```

초기에는 built-in virtual ontology로 동작할 수 있고, 나중에 실제 `knowledge/wiki/nodes/type.service.json`으로 materialize할 수 있다.

### `detail_mode`

```text
Type:
  string

Required:
  yes

Allowed:
  "stub"
  "note"
  "page"
  "view"
  "system"
```

object가 얼마나 자세한 설명을 가지고 있는지 나타낸다.

```text
stub:
  이름과 최소 정보만 있음.
  자세한 설명은 보류.

note:
  summary 정도의 짧은 설명이 있음.

page:
  content 본문까지 가진 완전한 wiki page.

view:
  graph, timeline, table, dashboard 같은 시각화 page.

system:
  type, relation type, setting 등 wiki 구조를 정의하는 object.
```

### `visibility`

```text
Type:
  string

Required:
  yes

Allowed v1:
  "private"
  "public"
```

object 공개 범위이다. 기본값은 반드시 `private`로 둔다.

```text
private:
  private index에만 포함.

public:
  public index에 포함 가능.
```

### `status`

```text
Type:
  string

Required:
  yes

Allowed recommended:
  "active"
  "draft"
  "stub"
  "archived"
  "deleted"
```

object의 현재 상태이다.

```text
active:
  정상 사용 중.

draft:
  작성 중.

stub:
  placeholder 상태.

archived:
  보관됨. 기본 view에서는 숨길 수 있음.

deleted:
  soft delete. 실제 파일 삭제 전 복구 가능 상태.
```

### `tags`

```text
Type:
  string[]

Required:
  yes

Default:
  []
```

node에 연결된 tag node id 목록이다. 문자열 label이 아니라 tag object의 id를 저장한다.

예:

```json
"tags": ["tag.server", "tag.proxy", "tag.ingress"]
```

각 tag도 node이다.

```json
{
  "object_kind": "node",
  "id": "tag.server",
  "title": "server",
  "type": "type.tag"
}
```

### `props`

```text
Type:
  object

Required:
  yes

Default:
  {}
```

자유 확장 영역이다. type별 custom field를 여기에 저장한다.

예:

```json
"props": {
  "port": 8787,
  "bind": "127.0.0.1",
  "startup": "auto"
}
```

Core schema는 얇게 유지하고, 사용자가 원하는 구조는 `props`에 둔다.

### `temporal`

```text
Type:
  object

Required:
  yes
```

지식 자체의 시간 정보를 저장한다. `audit.created_at`과 다르다.

```json
"temporal": {
  "occurred_at": null,
  "valid_from": null,
  "valid_to": null
}
```

필드 의미:

```text
occurred_at:
  사건이 실제로 발생한 날짜/시각.

valid_from:
  이 지식/상태/관계가 유효해진 시작 시점.

valid_to:
  이 지식/상태/관계가 종료된 시점.
```

### `audit`

```text
Type:
  object

Required:
  yes
```

wiki object의 편집/생성 메타데이터이다.

```json
"audit": {
  "created_at": "2026-06-23T00:00:00+09:00",
  "updated_at": "2026-06-23T00:00:00+09:00",
  "created_by": "account.admin",
  "updated_by": "account.admin"
}
```

`audit.created_at`은 이 object가 wiki에 생성된 시점이고, `temporal.occurred_at`은 object가 설명하는 사건의 실제 발생 시점이다. 둘은 반드시 분리한다.

`audit.created_by`와 `audit.updated_by`는 반드시 `account.*` node id를 참조한다. 사람이 수행한 작업은 `account.taewo` 같은 로그인 계정을 사용하고, system/bootstrap/migration 같은 내부 작업은 raw string `"system"` 대신 reserved account인 `account.system`을 사용한다.

## 5. Optional fields

초기 optional fields는 다음을 권장한다.

```json
{
  "summary": "Short description",
  "aliases": ["alias 1", "alias 2"],
  "content": {
    "format": "markdown",
    "body": "# Markdown body"
  }
}
```

optional fields는 core schema를 무겁게 만들지 않으면서 page content와 alias를 확장하기 위한 영역이다.

object-level access는 node 안의 `access` field로 직접 저장하지 않는다. L.W.S. permission model은 account-first/capability 기반이므로, object별 접근 제어는 permission edge로 표현한다.

```text
account.taewo --rel.can_read--> node.private-note
group.admin --rel.can_update_in--> scope.wiki
account.taewo --rel.can_create_in--> collection.server-operations
```

PermissionService는 이 permission edge들을 해석해 SQLite permission projection을 만들고, runtime에서는 projection을 조회한다.

## 6. Validation notes

Node validation은 최소한 다음을 확인한다.

```text
object_kind == "node"
id is globally unique
rev is positive integer
title is non-empty
slug is URL-safe
type references a type node or built-in virtual type
detail_mode is one of allowed values
visibility defaults to private
tags are tag node ids or accepted virtual tags
props is object
temporal has occurred_at, valid_from, valid_to
audit has created_at, updated_at, created_by, updated_by
access is not embedded in node JSON; use permission edges instead
```
