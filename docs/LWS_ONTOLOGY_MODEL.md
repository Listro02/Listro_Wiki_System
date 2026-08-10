# L.W.S. Ontology Model

작성일: 2026-08-06

상태: Phase 0 contract draft

적용 범위: current implementation inventory, target Group ontology, advisory validation

이 문서는 L.W.S. Ontology의 현재 구현과 목표 contract를 분리해 기록한다. 현재 backend
contract를 즉시 변경하지 않으며, 기존 source Node/Edge를 rename, retype, delete 또는 mass
rewrite하지 않는다. durable Node/Edge JSON과 event/history가 source of truth이고 SQLite는
재생성 가능한 projection이다.

## 1. 문서 규범

- **Current**: 2026-08-06 source와 schema가 실제 수행하는 동작
- **Target**: 후속 구현이 만족해야 하는 Group ontology contract
- **Compatibility**: migration 기간에만 유지하는 legacy surface
- **Unresolved**: 구현 전에 선택과 승인이 필요한 permission semantics

`MUST`, `MUST NOT`, `SHOULD`는 Target contract에만 적용한다.

## 2. Ontology 기본 원칙

L.W.S. Ontology는 Knowledge Graph visualization이 아니라 domain conceptualization의
explicit, computer-processable specification이다.

“모든 것은 Node이다”는 모든 literal을 Node로 만든다는 뜻이 아니다. definition,
relation, history, permission, evidence 또는 독립 identity가 필요한 Type, Tag, Relation,
Definition, Axiom/Constraint, Group을 first-class Node로 다룬다는 뜻이다. 단순 string,
date, boolean과 짧은 literal은 property로 유지한다.

Ontology materialization은 다음 원칙을 따른다.

1. 기존 Object의 `type`, `tags`, Edge `type` reference를 복제 저장하지 않는다.
2. term Node와 assertion Edge를 생성할 때 정상 mutation/event/history를 남긴다.
3. materialization은 idempotent해야 한다.
4. prefix만으로 불명확한 domain 의미를 자동 확정하지 않는다.
5. 먼저 inventory와 advisory validation을 수행하고 strict validation은 impact review 뒤에 도입한다.

## 3. Current implementation inventory

### 3.1 Structural schema와 semantic validation

JSON schema에서 Node의 `type`, `tags`, Edge의 `source`, `target`, `type`은 non-empty
string 수준이다. 두 schema 모두 `additionalProperties: true`이며 semantic role은 JSON
schema가 판정하지 않는다 (`schemas/node.schema.json:5-38`,
`schemas/edge.schema.json:5-40`). Runtime shape validator도 문자열 shape와 공통 field를
검사하고, malformed Inline temporal wrapper를 `SCHEMA_INVALID`로 만든다
(`src/modules/validation/schema-validator.ts:71-88`,
`src/modules/validation/schema-validator.ts:132-145`).

실제 reference validation은 다음과 같다.

| Reference | Current acceptance rule | 빠진 role check |
| --- | --- | --- |
| Node `type` | built-in Type ID이거나 존재하는 아무 Node | existing Node가 `type.node-type`인지 확인하지 않음 |
| Object `tags[]` | `tag.*` virtual ID, built-in Scope ID 또는 존재하는 아무 Node | existing Node가 `type.tag`인지 확인하지 않음 |
| Edge `type` | built-in Relation ID이거나 존재하는 아무 Node | existing Node가 `type.relation-type`인지 확인하지 않음 |
| Edge endpoint | 존재하는 Node 또는 built-in Scope ID | Relation별 domain/range와 permission target role을 확인하지 않음 |

근거는 `src/modules/validation/semantic-validator.ts:19-64`다. 신규 mutation은 shape와
semantic issue를 blocking error로 처리한다
(`src/modules/validation/validation-service.ts:36-48`). Reindex와 admin validation은 같은
validator로 legacy source를 검사하지만 source를 고치지 않는다
(`src/modules/indexing/reindex-command.ts:87-123`,
`src/modules/admin/storage-validation-job.ts:44-106`).

Temporal legacy data에는 한정된 예외가 있다. malformed knowledge-time issue만 있는 Object는
issue를 남기고 projection하되 dated Timeline에서는 제외한다
(`src/modules/indexing/reindex-command.ts:99-123`). 다른 semantic-invalid Object는 reindex
projection에서 제외된다.

### 3.2 Built-in Type, Relation, Tag와 materialization

In-code registry에는 `type.collection`, `type.scope`, `type.group`, `type.node-type`,
`type.relation-type`을 포함한 Type과 permission/containment Relation이 들어 있다
(`src/modules/ontology/builtin-ontology.ts:1-40`). 별도 `BUILTIN_TAG_IDS`는 없고 모든
`tag.*` string이 virtual Tag로 허용된다
(`src/modules/ontology/builtin-ontology.ts:58-60`).

`CoreOntologyMaterializer`는 built-in Type/Relation Node, 네 built-in Scope Node,
`account.system`, `account.admin`, `group.admin`, admin membership과 `scope.system`/`scope.wiki`
permission Edge를 생성한다 (`src/modules/ontology/core-ontology-materializer.ts:27-82`).
같은 ID가 있으면 Type/content를 보정하지 않고 skip한다
(`src/modules/ontology/core-ontology-materializer.ts:36-51`).

`type.group`은 이미 built-in이지만 Definition/Axiom 전용 Type과 definition, domain/range,
replacement Relation은 아직 없다. `GET /api/lws/ontology`도 semantic role projection이
아니라 readable Object 중 ID가 `type.%`, `tag.%`, `rel.%`인 Object를 반환한다
(`src/services/ontology-service.ts:14-35`).

### 3.3 Scope, Collection, Group과 containment

Current membership은 `rel.contains` Edge 가운데 source ID가 `scope.*` 또는
`collection.*`인 Edge에서 시작한다. 이후 target Object가 다시 `rel.contains`의 source면
최대 16 depth까지 재귀한다 (`src/modules/indexing/index-store.ts:368-388`).

- canonical direction은 사실상 `Scope|Collection --rel.contains--> Object`다.
- `group.* --rel.contains--> Object`는 graph에는 남지만 membership projection root가 아니다.
- intermediate Object의 Type을 확인하지 않아 일반 Object containment도 재귀 경로가 된다.
- active Edge만 사용한다.
- `depth=1`은 direct, `depth>1`은 transitive 결과다.
- `depth < 16`과 path repeat check로 traversal을 멈춘다.
- cycle이나 depth truncation validation issue는 없다.

현재 configured development source에는 Node 5개와 Edge 5개가 있다. Scope, Collection,
Group, permission Edge는 없고 `sample.frontend.workbench --rel.contains-->
sample.frontend.editor-flow` 한 건은 source prefix가 맞지 않아 membership projection에
들어가지 않는다. materialized built-in Type/Relation/Tag, Definition, Axiom Node도 없다.
현재 SQLite의 membership, permission, validation issue row는 모두 0이다. 이는 2026-08-06
read-only inventory이며 source 변경은 없었다.

### 3.4 `object_scope_memberships` projection

Table은 `object_id`, `scope_id`, `source_edge_id`, `depth`를 가지며
`(object_id, scope_id, source_edge_id)`가 primary key다
(`src/modules/indexing/sqlite-schema.ts:160-166`). 이름과 달리 Scope와 Collection을 함께
담는다. Foreign key, container kind, 전체 path 또는 build provenance는 없다.

Full reindex는 projection을 비우고 source Object를 검증·투영한 다음 permission projection을
재생성한다 (`src/modules/indexing/reindex-command.ts:37-55`). Permission 관련 Node/Edge의
incremental update도 전체 permission projection을 다시 만든다
(`src/modules/indexing/index-store.ts:266-280`).

재귀 row의 `source_edge_id`는 마지막 hop Edge다. 이것만으로 root에서 Object까지의 전체
path를 복원할 수 없다. Timeline과 permission evaluator는 `depth`를 제한하지 않아 direct와
transitive row를 같은 membership으로 사용한다.

### 3.5 Permission projection과 평가

Permission projection은 다음 source Edge를 읽는다
(`src/modules/indexing/index-store.ts:348-430`).

- `account.* --rel.member_of--> group.*`를 `account_groups`로 투영
- Account 또는 그 Account가 direct member인 Group의 `rel.owns`
- Account 또는 direct Group의 `rel.can_read`, `rel.can_read_in`, `rel.can_create_in`,
  `rel.can_update`, `rel.can_update_in`, `rel.can_manage_in`

Account direct capability는 priority 10, Group-derived capability는 priority 5로 저장하지만
runtime은 priority를 읽지 않는다. `scope_kind`는 target prefix가 `scope.*`이면 `scope`,
`collection.*`이면 `collection`, 나머지는 모두 `object`다
(`src/modules/indexing/index-store.ts:411-430`,
`src/modules/indexing/index-store.ts:584-585`). Relation-specific source/target constraint와
nested principal Group membership은 없다.

Current effective permission은 allow-only다.

| Operation | Effective allow condition |
| --- | --- |
| read | public, bootstrap/system, owner, direct `can_read`, scoped `can_read_in` |
| create | bootstrap/system 또는 requested target의 `can_create_in` |
| update | bootstrap/system, owner, direct `can_update`, scoped `can_update_in` |
| manage | bootstrap/system 또는 scoped `can_manage_in` |

Scoped evaluation은 exact target, target의 membership, 특별한 `scope.wiki` grant 중 하나면
allow한다 (`src/services/permission-service.ts:155-215`,
`src/services/permission-service.ts:263-286`). deny, inheritance flag, temporal validity,
priority conflict resolution은 평가하지 않는다. Object direct policy, container policy,
ownership과 multi-container grant는 OR/any-allow로 결합된다.

`rel.can_manage_in`은 `scope.system` admin guard와 Object access-management hint에 쓰인다
(`src/services/admin-service.ts:56-106`, `src/services/permission-service.ts:208-215`). 그러나
permission graph mutation은 target별 manage가 아니라 항상 `scope.system` manage를 요구한다
(`src/services/mutation-service.ts:345-369`). 이름, hint, 실제 mutation guard가 아직 하나의
세밀한 contract로 정렬되지 않았다.

Create의 `target_scope`는 authorization context일 뿐이다
(`src/services/mutation-service.ts:71-82`). 성공한 Object에 membership Edge를 자동 생성하지
않으므로 “create in Group”과 “created Object is a member”는 별도 assertion이다.

### 3.6 `scope.wiki` special case

`scope.wiki`는 세 역할이 같은 ID에 겹쳐 있다.

1. create default authorization target (`src/services/mutation-service.ts:71-72`)
2. Object/Timeline query의 global query sentinel
   (`src/services/object-query-service.ts:67-71`, `src/services/timeline-service.ts:177-178`)
3. permission evaluator의 workspace-wide capability target
   (`src/services/permission-service.ts:99-108`, `src/services/permission-service.ts:263-284`)

세 번째 동작은 Object visibility를 public으로 바꾸지 않는다. 다만 해당 principal에
`rel.can_read_in -> scope.wiki`가 있으면 모든 private Object를 읽게 한다.
`can_create_in`, `can_update_in`, 대부분의 `can_manage_in`도 같은 global fallback을 사용하며
`scope.system` manage만 예외다 (`src/services/permission-service.ts:196-205`).

따라서 global query context, root membership, workspace-wide permission grant는 현재 별도
concept가 아니다. Target에서는 분리해야 하지만 기존 Edge 의미를 조용히 바꾸면 안 된다.

### 3.7 Timeline filter와 grouping

Timeline은 `scope`, `collection`을 따로 받고 동시 사용을 거부한다. `depth`는 membership
depth가 아니라 center query 값이고 현재 `1`만 허용한다
(`src/services/timeline-service.ts:384-406`). Filter는 두 parameter 중 한 값을 같은
membership table에 대입하며 `scope.wiki`만 생략한다
(`src/services/timeline-service.ts:164-180`). Grouping도 같은 table을 읽되 `scope.%`와
`collection.%` prefix로 lane을 나눈다 (`src/services/timeline-service.ts:254-264`).

Frontend도 Scope/Collection combobox를 분리하고 `type.scope`/`scope.*`,
`type.collection`/`collection.*`를 요구한다 (`src/app/timeline/page.tsx:201-233`). URL과 API에
`group` parameter는 없다 (`src/lib/timeline/url-state.ts:11-29`,
`src/app/api/lws/timeline/route.ts:13-30`).

### 3.8 Reindex와 `validation_issues`

`validation_issues`는 object identity, code, severity, message, target만 저장한다
(`src/modules/indexing/sqlite-schema.ts:131-139`). governing term/Axiom, build ID,
first/last seen, disposition, exception과 Curator decision field는 없다.

Reindex는 projection을 clear하고 issue를 다시 넣는다. Admin validation job은 table 전체를
그 scan의 issue로 교체한다 (`src/modules/indexing/index-store.ts:315-345`). 서로 다른 issue
producer의 결과를 병합하거나 lifecycle을 관리하지 못한다.

### 3.9 Inventory 결론

이미 있는 기반은 first-class Node/Edge, built-in `type.group`, idempotent core materializer,
recursive containment projection, permission-aware query, advisory source scan이다. 아직 없는
핵심은 semantic role validation, canonical Group membership, cycle issue, permission target
constraint, conflict Axiom, Definition/Axiom materialization, ontology usage projection과 Curator
issue lifecycle이다.

## 4. Target Group ontology contract

### 4.1 Canonical identity와 role

1. canonical Group Node Type은 `type.group`이다.
2. Group은 navigation, organization, classification, work context, principal grouping과
   선택적인 authority boundary를 표현할 수 있다.
3. `type.scope`, `type.collection`, `scope.*`, `collection.*`는 Compatibility surface다.
4. Group 역할은 ID prefix가 아니라 Type과 Relation으로 판정한다.
5. Group membership 자체는 authorization grant가 아니다.

관계별 역할은 다음과 같다.

```text
Account --rel.member_of--> Principal Group
Container Group --rel.contains--> Object
Parent Group --rel.contains--> Child Group
Account|Principal Group --rel.can_*[_in]--> Object|Container Group
```

### 4.2 Membership direction과 hierarchy

Canonical direction은 `Group --rel.contains--> Object|Group`이다. 반대 방향은 canonical
membership으로 해석하지 않고 advisory issue와 migration candidate로 남긴다.

Group hierarchy는 허용한다. Transitive membership은 Group만 intermediate container로
통과한다. 일반 non-Group Object의 outgoing `rel.contains`는 Group membership closure를
연장하지 않는다. Durable source에는 direct Edge만 저장하고 projection은 다음을 구분한다.

- `depth=1`: direct membership
- `depth>1`: Group hierarchy에서 파생한 transitive membership
- provenance: direct Edge chain을 재구성할 수 있는 정보

Query/API는 장차 `membership=direct|transitive|any`를 명시할 수 있다. migration 기본값은
현재 호환성을 위해 `any`를 추천한다.

### 4.3 Cycle과 depth

Group containment cycle은 invalid semantic data지만 source Edge를 자동 삭제하지 않는다.

1. `GROUP_CONTAINMENT_CYCLE` advisory issue를 관련 direct Edge에 기록한다.
2. Direct graph assertion은 inspectable하게 유지한다.
3. Transitive projection은 repeated Group 직전에서 branch를 멈춘다.
4. safety limit 도달은 `GROUP_MEMBERSHIP_DEPTH_LIMIT` issue이며 silent truncation이 아니다.
5. strict mutation 차단은 inventory와 migration 뒤 별도 승인한다.

### 4.4 Permission-bearing Group

Group은 active permission relation의 **target**일 때만 policy-bearing container가 된다.
Membership, title, prefix, Type만으로 policy를 활성화하지 않는다.

```text
Account|Principal Group --rel.can_read_in----> Container Group
Account|Principal Group --rel.can_create_in--> Container Group
Account|Principal Group --rel.can_update_in---> Container Group
Account|Principal Group --rel.can_manage_in---> Container Group
```

Target validator는 `_in` Relation source가 Account/Principal Group이고 target이
canonical/legacy-compatible Container Group인지 advisory mode에서 확인해야 한다.
Policy applicability(Object membership)와 permission effect를 분리하며 membership alone은
effect를 만들지 않는다.

### 4.5 Direct policy와 Group policy

Permission evaluator는 public visibility, ownership, direct Object capability, 각 applicable
Group capability, workspace compatibility capability를 provenance와 함께 candidate로 모은다.
Current allow-only 결과는 migration baseline으로 유지할 수 있지만 long-term conflict를 prefix
순서나 query order로 정하지 않는다. Effective decision은 source Edge, principal membership,
container membership path와 적용 Axiom을 설명할 수 있어야 한다.

### 4.6 `rel.can_manage_in` 권장 의미

Phase 0 추천안에서 `rel.can_manage_in -> Group`은 Group Node, direct membership Edge와 그
Group을 target으로 하는 policy Edge를 관리하는 권한이다. 모든 member Object content update
권한은 아니다. Content update에는 `rel.can_update` 또는 `rel.can_update_in`이 별도로 필요하다.

`scope.system` admin compatibility는 workspace/system operation 권한으로 별도 취급한다.
Target-local manage를 실제 mutation guard로 허용할지는 security review와 test 뒤 결정한다.

### 4.7 Root/global query context

추천 target은 global query context와 Group을 분리하는 것이다.

- canonical query context 후보: `workspace.wiki`
- compatibility alias: `scope.wiki`
- root membership: 자동 materialize하지 않음
- policy-bearing root Group: 실제 use case 승인 시 별도 `type.group` Node로 생성
- root query 선택: membership이나 permission inheritance를 발생시키지 않음

`workspace.wiki`가 first-class Node면 `type.workspace` 여부를 별도로 결정한다. 어느 경우든
`scope.wiki`의 기존 workspace-wide capability Edge 의미는 explicit migration 없이 바꾸지 않는다.

### 4.8 Legacy compatibility와 API

Migration 동안 `type.group`, `type.scope`/`scope.*`, `type.collection`/`collection.*`을
compatible Group candidate로 읽을 수 있다. Prefix와 Type이 모순되면 보정하지 않고 issue를
남긴다.

API는 먼저 `group=<id>`와 `group_by=group`을 추가하고 `scope`, `collection`을 deprecated
alias로 유지한다. 여러 alias가 함께 오면 같은 normalized Group인지 확인하고 다르면
`SCHEMA_INVALID`를 반환한다. 제거는 usage inventory와 release notice 뒤에만 한다.

### 4.9 Projection target

권장 canonical table은 `object_group_memberships`다.

```text
object_id
group_id
depth
direct_edge_id
root_edge_id
path_key 또는 동등한 provenance
legacy_kind nullable
```

Migration 중에는 source Node/Edge에서 새 table을 재생성하고 기존
`object_scope_memberships`를 compatibility projection/view로 유지한다. SQLite rename은 source
migration이 아니다.

## 5. Unresolved permission decisions

### 5.1 Multi-Group conflict

| 선택지 | 의미 | 평가 |
| --- | --- | --- |
| A. additive allow-only | matching allow 하나면 허용, deny는 아직 없음 | 현재 호환성이 높고 단순함 |
| B. deny-overrides | matching deny가 allow보다 우선 | cross-Group surprise와 lockout 위험 |
| C. explicit priority/specificity | direct/Group/priority로 승자 결정 | Axiom, stable ordering, explanation 선행 필요 |

**추천:** Phase 1은 A를 명시적 Compatibility Axiom으로 채택하고 deny vocabulary를 만들지
않는다. 실제 deny use case와 explanation UI 뒤 B/C를 별도 migration으로 결정한다. 현재
저장된 priority 10/5는 평가되지 않으므로 policy로 문서화하면 안 된다.

### 5.2 Workspace-wide capability

`scope.wiki` capability를 계속 workspace-wide grant로 둘지, explicit root policy Group 또는
별도 workspace capability로 옮길지 미확정이다. 추천은 query sentinel과 policy target을
분리하되 기존 grant는 Compatibility evaluator에서 같은 result를 유지하고 Curator가 한 건씩
replacement를 승인하는 것이다.

### 5.3 `can_manage_in` delegation

Target-local Group manager가 membership/policy Edge를 직접 mutate할 수 있게 할지 미확정이다.
실제 guard 완화는 self-escalation, source/target 변경, last-manager removal test 뒤 도입한다.

## 6. Advisory validation backlog

| Code | 조건 |
| --- | --- |
| `ONTOLOGY_TERM_ROLE_MISMATCH` | Type/Tag/Relation reference가 기대 ontology role이 아님 |
| `GROUP_LEGACY_KIND` | legacy Scope/Collection Group candidate |
| `GROUP_PREFIX_TYPE_MISMATCH` | ID prefix와 declared Type role 충돌 |
| `GROUP_MEMBERSHIP_DIRECTION_INVALID` | Object-to-Group 방향 containment candidate |
| `GROUP_CONTAINMENT_CYCLE` | Group hierarchy cycle |
| `GROUP_MEMBERSHIP_DEPTH_LIMIT` | closure safety limit 도달 |
| `PERMISSION_SUBJECT_INVALID` | capability source가 Account/Principal Group이 아님 |
| `PERMISSION_TARGET_INVALID` | `_in` target이 Container Group이 아님 |
| `PERMISSION_POLICY_AMBIGUOUS` | conflict Axiom 없이 future deny/priority data 존재 |
| `ROOT_CONTEXT_POLICY_LEGACY` | `scope.wiki` policy target legacy grant |

초기 severity는 warning/advisory다. Blocking 전환은 issue count, remediation, regression test와
Curator 승인 뒤에 한다.

## 7. Curator workflow

1. Inventory/reindex가 issue와 usage를 기록한다.
2. Curator가 source data 문제인지 ontology rule 문제인지 판정한다.
3. source 수정, term materialization, deprecation/replacement, exception 또는 controlled
   migration을 선택한다.
4. mutation은 event/history를 남긴다.
5. reindex/validation으로 재검증한다.

현재 `validation_issues`가 이 lifecycle을 표현하지 못하므로 초기에는 report artifact와 기존
table을 병행하고 provenance/lifecycle schema는 별도 migration으로 설계한다.

## 8. Related documents

- [Ontology discussion and plan](./plans/LWS_ONTOLOGY_SYSTEM_DISCUSSION_AND_PLAN.md)
- [Group ontology migration plan](./plans/LWS_GROUP_ONTOLOGY_MIGRATION_PLAN.md)
- [Node model](./LWS_NODE_MODEL.md)
- [Edge model](./LWS_EDGE_MODEL.md)
- [Props convention](./LWS_PROPS_CONVENTION.md)
- [Backend design](./LWS_BACKEND_DESIGN.md)
- [Timeline implementation report](./implementation/timeline/LWS_TIMELINE_IMPLEMENTATION_REPORT.md)
