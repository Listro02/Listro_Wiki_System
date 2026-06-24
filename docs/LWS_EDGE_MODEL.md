# L.W.S. Edge Model

이 문서는 L.W.S.의 `edge` object를 backend 구현 기준으로 정리한다.

Edge는 node와 node 사이의 관계이다. 단순 연결에서 시작할 수 있지만, summary, temporal, evidence, content를 가진 설명 가능한 edge page로 확장될 수 있다.

## 1. Edge가 표현하는 관계

Edge는 다음 세 수준으로 다룬다.

```text
simple edge:
  source, target, type만 있는 관계

annotated edge:
  summary, temporal, evidence, props가 있는 관계

edge page:
  content까지 갖춘 설명 가능한 관계 page
```

예:

```text
app.lws --rel.depends_on--> svc.caddy
collection.server-operations --rel.contains--> svc.caddy
doc.proxy-boundary --rel.references--> svc.caddy
```

중요한 점은 relation type도 node라는 것이다. 예를 들어 `rel.depends_on`은 relation type node id이다.

## 2. Required shape

Edge JSON의 필수 shape는 다음이다.

```json
{
  "schema_version": 1,
  "object_kind": "edge",
  "id": "edge.01J000000001",
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
    "created_by": "user.admin",
    "updated_by": "user.admin"
  }
}
```

## 3. Required field summary

| Field | Type | Required | 의미 |
| --- | --- | --- | --- |
| `schema_version` | integer | yes | edge schema version |
| `object_kind` | `"edge"` | yes | object 종류를 구분하는 discriminator |
| `id` | string | yes | L.W.S. 전체에서 고유하고 안정적인 edge 식별자 |
| `rev` | integer | yes | 저장 충돌 감지를 위한 revision 번호 |
| `source` | string | yes | 관계가 시작되는 source node id |
| `target` | string | yes | 관계가 향하는 target node id |
| `type` | string | yes | 관계 의미를 나타내는 relation type node id |
| `title` | string | yes | 사람이 읽는 edge 표시 제목 |
| `detail_mode` | enum | yes | edge가 가진 설명의 깊이 |
| `visibility` | enum | yes | public/private 공개 경계 |
| `status` | enum | yes | object의 lifecycle 상태 |
| `tags` | string[] | yes | 연결된 tag node id 목록 |
| `props` | object | yes | relation별 custom field를 담는 확장 영역 |
| `temporal` | object | yes | 이 edge가 설명하는 관계 자체의 시간 정보 |
| `audit` | object | yes | object 생성/수정 메타데이터 |

## 4. Field details

### `schema_version`

Node와 동일하게 schema migration에 사용한다.

```text
Type:
  integer

Required:
  yes
```

### `object_kind`

```text
Type:
  string literal

Required:
  yes

Allowed:
  "edge"
```

edge file에서는 반드시 `"edge"`여야 한다.

### `id`

```text
Type:
  string

Required:
  yes

Recommended:
  edge.<ULID-like-id>
```

edge는 node와 달리 semantic id보다 opaque id를 권장한다.

예:

```json
"id": "edge.01J000000001"
```

이유:

```text
1. source/target/type이 바뀔 수 있다.
2. 같은 두 node 사이에 여러 edge가 존재할 수 있다.
3. edge 자체도 revision/history를 가진 object다.
```

### `rev`

Node와 동일하게 optimistic concurrency control에 사용한다. 저장 API는 request의 `base_rev`와 현재 edge의 `rev`를 비교한다.

```text
base_rev == current rev:
  save allowed

base_rev != current rev:
  409 conflict
```

### `source`

```text
Type:
  string

Required:
  yes

Value:
  existing node id
```

관계의 시작 node이다.

예:

```json
"source": "app.lws"
```

### `target`

```text
Type:
  string

Required:
  yes

Value:
  existing node id
```

관계의 대상 node이다.

예:

```json
"target": "svc.caddy"
```

### `type`

```text
Type:
  string

Required:
  yes

Value:
  relation type node id
```

관계의 의미이다. 중요한 점은 relation type도 node라는 것이다.

예:

```json
"type": "rel.depends_on"
```

`rel.depends_on`은 실제로 다음과 같은 node일 수 있다.

```json
{
  "object_kind": "node",
  "id": "rel.depends_on",
  "title": "depends_on",
  "type": "type.relation-type"
}
```

### `title`

```text
Type:
  string

Required:
  yes
```

edge를 UI에서 표시할 때 쓰는 제목이다. 생성 시 `source`, `type`, `target`을 바탕으로 자동 생성할 수 있다.

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
```

edge도 설명 수준을 가진다.

```text
stub:
  source, target, type 중심의 단순 관계.

note:
  summary가 있는 관계.

page:
  content까지 가진 설명 가능한 edge page.
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

node와 동일하게 공개 범위를 나타낸다. 단, edge에는 더 강한 boundary rule이 있다.

```text
public edge는 source와 target이 모두 public일 때만 허용한다.
```

금지되는 public edge:

```text
public node -> private node
private node -> public node
private node -> private node
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

edge의 lifecycle state이다.

### `tags`

```text
Type:
  string[]

Required:
  yes

Default:
  []
```

edge에도 tag를 붙일 수 있다.

예:

```json
"tags": ["tag.server", "tag.ingress"]
```

이렇게 하면 "server 관련 관계만 보기", "ingress 관련 edge만 timeline에 표시" 같은 기능이 가능하다.

### `props`

```text
Type:
  object

Required:
  yes

Default:
  {}
```

edge의 자유 확장 영역이다.

예:

```json
"props": {
  "weight": 1,
  "confidence": 0.9,
  "direction": "source_to_target"
}
```

권장 edge props:

```text
weight:
  graph 시각화에서 edge 강도.

confidence:
  관계 확실성.

direction:
  source_to_target, bidirectional, undirected 등.

note:
  짧은 관계 설명.
```

### `temporal`

```text
Type:
  object

Required:
  yes
```

관계 자체의 시간 정보이다.

예:

```json
"temporal": {
  "occurred_at": null,
  "valid_from": "2026-06-22",
  "valid_to": null
}
```

관계 timeline에 사용할 수 있다.

### `audit`

```text
Type:
  object

Required:
  yes
```

edge object의 생성/수정 이력이다.

```json
"audit": {
  "created_at": "2026-06-23T00:00:00+09:00",
  "updated_at": "2026-06-23T00:00:00+09:00",
  "created_by": "user.admin",
  "updated_by": "user.admin"
}
```

## 5. Optional fields

초기 optional fields는 다음을 권장한다.

```json
{
  "summary": "cloudflared forwards tunnel traffic to Caddy.",
  "content": {
    "format": "markdown",
    "body": "# Relationship\n\n..."
  },
  "evidence": [
    {
      "type": "node",
      "target": "doc.ingress-proxy-design"
    }
  ],
  "access": {
    "read_roles": ["viewer"],
    "write_roles": ["curator"],
    "manage_roles": ["admin"]
  }
}
```

### `summary`

관계에 대한 짧은 설명이다.

### `content`

edge 자체를 page로 확장할 때 쓰는 본문이다.

### `evidence`

관계의 근거이다. node, edge, URL, file reference를 포함할 수 있다.

예:

```json
"evidence": [
  {
    "type": "node",
    "target": "doc.proxy-security-boundary"
  },
  {
    "type": "url",
    "target": "https://example.com"
  }
]
```

### `access`

edge-level permission override이다.

## 6. Validation notes

Edge validation은 최소한 다음을 확인한다.

```text
object_kind == "edge"
id is globally unique
rev is positive integer
source references an existing node
target references an existing node
type references a relation type node or built-in virtual relation
title is non-empty
detail_mode is one of allowed edge values
visibility defaults to private
public edge requires public source and public target
tags are tag node ids or accepted virtual tags
props is object
temporal has occurred_at, valid_from, valid_to
audit has created_at, updated_at, created_by, updated_by
```
