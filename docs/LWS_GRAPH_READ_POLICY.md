# L.W.S. Graph Read Policy

작성일: 2026-08-02

이 문서는 L.W.S. graph/search 계열 조회에서 object visibility, permission, edge relation, unreadable endpoint를 어떻게 표현할지 정리한다.

핵심 원칙:

```text
현재 center에서 읽을 수 있는 것은 표시한다.
읽을 수 없는 object detail은 표시하지 않는다.
readable edge가 드러내는 endpoint reference는 placeholder로 표현할 수 있다.
```

## 1. 기본 용어

### Readable Object

viewer가 `PermissionService` 기준으로 읽을 수 있는 object이다.

- `visibility: "public"` object
- 또는 owner/direct permission/group permission/scope permission 등 effective permission으로 읽을 수 있는 private object

권한이 없으면 object list/search/detail에서 존재를 알 수 없어야 한다. 억지로 상세 route에 접근해도 object detail은 노출되지 않는다.

### Edge Object

`edge`는 L.W.S.의 1급 relationship object이다.

edge를 읽을 수 있다는 것은 다음 정보를 읽을 수 있다는 뜻으로 본다.

```text
edge.id
edge.type
edge.source
edge.target
edge visibility/status/title/summary 등 edge 자체 metadata
```

따라서 edge object가 readable이면 `source`/`target` id reference 자체를 별도로 검열하지 않는다. 단, source/target object의 title, summary, type, detail 같은 endpoint metadata는 해당 endpoint object가 readable일 때만 표시한다.

### Endpoint Placeholder

읽을 수 있는 edge가 unreadable endpoint를 가리킬 때 사용하는 최소 표현이다.

placeholder는 endpoint object detail이 아니다. edge가 이미 노출한 reference를 graph에서 끊기지 않게 표현하기 위한 자리이다.

예시:

```json
{
  "id": "node.private-target",
  "kind": "unreadable_endpoint"
}
```

placeholder에 포함할 수 있는 정보:

- endpoint id
- placeholder kind

placeholder에 포함하지 않는 정보:

- endpoint title
- endpoint type
- endpoint summary/content
- endpoint tags
- endpoint temporal/audit/detail metadata

## 2. Centered Graph Policy

`GET /api/lws/graph?center=:id`의 정책 기준은 centered graph이다.

```text
center object가 readable이면 graph.nodes에 center object를 포함한다.
readable edge가 있으면 edge relation을 포함한다.
readable endpoint는 nodes에 object row로 포함한다.
unreadable endpoint는 placeholders에 최소 표현으로 포함한다.
readable edge가 없으면 nodes=[center], edges=[], placeholders=[]를 반환한다.
center object가 unreadable이면 detail을 노출하지 않는다.
```

### Center Node

center가 node이고 readable인 경우:

```text
center node readable
-> center node 표시
```

주변 relation은 edge 권한을 기준으로 판단한다.

```text
edge unreadable
-> relation 미표시
-> target node가 readable이어도 이 edge를 통한 관계는 표시하지 않음

edge readable + endpoint readable
-> relation 표시
-> endpoint object metadata 표시

edge readable + endpoint unreadable
-> relation 표시
-> endpoint는 placeholder로 표시
```

중요한 점:

```text
관계성은 edge가 담당한다.
edge가 unreadable이면 target이 readable이어도 해당 관계는 표시하지 않는다.
edge가 readable이면 endpoint 일부가 unreadable이어도 관계 자체는 표시할 수 있다.
```

### Center Edge

center가 edge이고 readable인 경우:

```text
center edge readable
-> center edge object 표시
-> edge relation 표시
-> readable source/target은 object row로 표시
-> unreadable source/target은 placeholder로 표시
```

source와 target 중 하나만 readable해도 readable한 것은 표시하고, unreadable한 것은 placeholder로 남긴다.

예:

```text
edge readable
source readable
target unreadable

=> nodes=[edge object, source object]
=> edges=[edge relation projection]
=> placeholders=[target placeholder]
```

center edge가 unreadable이면 edge detail, source/target metadata, relation line을 노출하지 않는다.

## 3. Graph API Response Shape

목표 응답 shape:

```ts
type GraphResponse = {
  nodes: ObjectRow[];
  edges: GraphEdge[];
  placeholders: GraphPlaceholderNode[];
  depth: number;
};

type GraphEdge = {
  edge_id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  status: string;
  visibility: "public" | "private";
};

type GraphPlaceholderNode = {
  id: string;
  kind: "unreadable_endpoint";
};
```

해석 규칙:

```text
nodes[]에 있으면 readable object box로 렌더링한다.
placeholders[]에 있으면 unreadable endpoint placeholder box로 렌더링한다.
edges[]는 source_id/target_id가 nodes 또는 placeholders 중 하나에 있으면 relation line으로 렌더링할 수 있다.
```

## 4. Scenario Matrix

| Scenario | Expected graph response |
| --- | --- |
| center node readable, no readable edge | `nodes=[center]`, `edges=[]`, `placeholders=[]` |
| center node readable, edge unreadable, target readable | `nodes=[center]`; unreadable edge를 통한 target relation은 표시하지 않음 |
| center node readable, edge readable, target readable | `nodes=[center,target,edgeObject]`, `edges=[edge]`, `placeholders=[]` |
| center node readable, edge readable, target unreadable | `nodes=[center,edgeObject]`, `edges=[edge]`, `placeholders=[target]` |
| center edge readable, both endpoints readable | `nodes=[edgeObject,source,target]`, `edges=[edge]`, `placeholders=[]` |
| center edge readable, one endpoint unreadable | `nodes=[edgeObject,readableEndpoint]`, `edges=[edge]`, `placeholders=[unreadableEndpoint]` |
| center edge readable, both endpoints unreadable | `nodes=[edgeObject]`, `edges=[edge]`, `placeholders=[source,target]` |
| center object unreadable | no object detail is exposed |

## 5. Security Boundary

이 정책은 private endpoint detail을 노출하지 않는다.

노출 가능한 것:

```text
readable object metadata
readable edge metadata
readable edge가 가진 source/target id reference
```

노출하지 않는 것:

```text
unreadable endpoint title
unreadable endpoint type
unreadable endpoint summary/content
unreadable endpoint tags
unreadable endpoint detail/history/validation
```

anonymous 사용자는 권한 없는 object detail에 접근할 수 없다. 이 정책은 readable center 또는 readable edge를 이미 조회할 수 있는 context 안에서 graph를 어떻게 구성할지에 대한 정책이다.

## 6. Current Implementation Gap

현재 구현의 `GraphService.getGraph()`는 edge/source/target이 모두 visible predicate를 통과해야 edge row를 반환한다. 따라서 readable center object가 있어도 readable edge가 없으면 `nodes=[]`, `edges=[]`가 될 수 있고, readable edge의 endpoint 중 하나가 unreadable이면 edge relation 자체가 빠질 수 있다.

목표 정책에 맞추려면 다음 구현이 필요하다.

```text
1. center object가 readable이면 항상 nodes에 포함한다.
2. edge object visibility와 endpoint object visibility를 분리해서 판단한다.
3. readable edge는 edges에 포함한다.
4. readable endpoint는 nodes에 포함한다.
5. unreadable endpoint는 placeholders에 포함한다.
6. GraphResponse에 placeholders field를 추가한다.
7. frontend graph renderer는 placeholder endpoint를 object node와 구분해 표시한다.
```

필수 회귀 테스트:

```text
public center node + no readable edge -> nodes includes center, edges empty
public center node + private edge only -> nodes includes center, edge omitted
public center node + readable edge + private target -> edge included, target placeholder included
readable center edge + one unreadable endpoint -> edge included, readable endpoint node included, unreadable endpoint placeholder included
unreadable center object -> object detail not exposed
```

