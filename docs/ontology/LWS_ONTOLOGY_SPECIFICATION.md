# L.W.S. Ontology Specification

상태: Draft — 단계별 ontology 규범 확립 중

이 문서는 L.W.S. ontology 체계를 단계적으로 논의하고 최종 확립하기 위한 단일 기준 문서다.
앞으로 각 단계를 순서대로 논의하여 내용을 추가한다. 단계별 규칙은 0.6에서 정의한
`Specification Authority`의 명시적 승인과 문서화 요청을 거쳐 기록하며, 논의 중 동의나
잠정 합의만으로 문서를 수정하지 않는다.

## 기존 ontology 문서의 폐기 및 과거 자료 이관

본 문서가 검토를 마치고 **Canonical** 상태로 승인되면 아래 문서는 현행 규범에서 폐기한다.
내용이 본 문서에 반영되었는지 확인한 뒤 `docs/archive/ontology/`로 이동하여 과거 자료로
보존하거나, 보존 가치가 없는 중복본은 제거한다. 이 작업은 Canonical 승인 이후의 별도
변경으로 수행하며, 지금은 기존 문서를 참고 자료로 유지한다.

| 처리 대상 | Canonical 승인 후 처리 | 이유 |
| --- | --- | --- |
| `docs/LWS_ONTOLOGY_MODEL.md` | 과거 자료 이관 또는 제거 | 현재 구현 인벤토리와 Group ontology 초안 |
| `docs/plans/LWS_ONTOLOGY_SYSTEM_DISCUSSION_AND_PLAN.md` | 과거 자료 이관 | node-first ontology 설계 경위와 초기 논의 |
| `docs/plans/LWS_GROUP_ONTOLOGY_MIGRATION_PLAN.md` | 과거 자료 이관 | 확정 specification 이전의 Group migration proposal |
| `docs/plans/LWS_EDGE_DEFINITION_INSTANCE_PLAN.md` | 과거 자료 이관 | Definition/Relation model 확정 전의 edge definition proposal |

`LWS_NODE_MODEL.md`, `LWS_EDGE_MODEL.md`, `LWS_PROPS_CONVENTION.md`,
`LWS_BACKEND_DESIGN.md`는 ontology 전용 문서가 아니라 현행 저장·구현 계약이므로 이 폐기
목록에 포함하지 않는다. 다만 본 specification과 충돌하는 내용은 Canonical 승인 뒤 별도
compatibility/migration 기록으로 정리한다.

## 목차

### [단계 0 — 문서 권위와 의사결정 규범](#stage-0)

1. 문서의 목적과 적용 범위
2. Canonical specification의 권위와 관련 문서의 우선순위
3. `Current`, `Target`, `Compatibility`, `Deprecated`, `Unresolved`의 의미
4. `MUST`, `MUST NOT`, `SHOULD`, `MAY` 규범어
5. 논의, 승인, 변경, 폐기 절차
6. 단계별 기록 형식과 Exit Criteria
7. Ontology 전체 확립의 완료 조건

### [단계 1 — Ontology의 정의와 시스템 경계](#stage-1)

1. L.W.S.에서 Ontology의 정의
2. Ontology, Knowledge Graph, Schema, Validation, Projection의 구분
3. Ontology graph, domain ontology, instance graph의 층위
4. Ontology가 책임지는 것과 책임지지 않는 것
5. 초기 목표와 non-goal
6. 명시적 선언과 자동 추론의 경계
7. Open-world와 closed-world 해석 정책

### [단계 2 — 저장 철학과 Ontology bootstrap](#stage-2)

1. “의미 있는 모든 것은 Node이다”의 정확한 범위
2. First-class Node/Edge와 literal/property의 판정 기준
3. Durable Node/Edge와 event/history의 source-of-truth 지위
4. Generated projection과 derived assertion의 지위
5. 최소 bootstrap kernel
6. In-code registry와 materialized ontology의 관계
7. Meta-circular Type과 self-description 규칙
8. Built-in term 충돌 시 우선순위와 drift 처리

### [단계 3 — Core meta-model과 semantic role](#stage-3)

1. Ontology Term의 공통 contract
2. Node Type
3. Relation Type
4. Tag
5. Property
6. Definition
7. Axiom/Constraint
8. Group과 Group Role
9. Ontology Profile 또는 Vocabulary Set
10. Term role 판정과 role mismatch
11. Core term과 domain term의 구분

### [단계 4 — 식별자, namespace, version, lifecycle](#stage-4)

1. Canonical ID와 namespace 규칙
2. Stable identity와 rename 금지 원칙
3. Slug, label, alias와 ID의 구분
4. Object revision과 semantic version의 구분
5. Definition version과 authoritative version 선택
6. Term lifecycle: draft, active, deprecated, retired
7. Object status와 ontology lifecycle의 관계
8. Deprecation, replacement, successor, compatibility alias
9. Term 삭제와 기존 usage 보존 정책

### [단계 5 — Type과 classification 규칙](#stage-5)

1. Instance의 primary Type
2. Single Type와 multiple Type 정책
3. Type hierarchy와 `subclass_of`
4. Type inheritance의 적용 범위
5. Tag의 classification 의미
6. Type와 Tag의 경계
7. Type/Tag 사용 가능 상태와 visibility
8. Unknown, virtual, unresolved term 처리
9. Type 변경의 semantic impact

### [단계 6 — Relation과 statement 규칙](#stage-6)

1. Relation Type과 Edge Instance의 구분
2. Relation Definition, Relation Profile, Edge Template의 구분
3. Directed, symmetric, inverse relation
4. Structural endpoint object-kind policy
5. Semantic domain/range policy
6. Relation별 source/target role policy
7. Edge를 endpoint로 사용하는 관계
8. Qualified statement와 reification 기준
9. Evidence, provenance, confidence, temporal qualifier
10. Relation identity, 중복, uniqueness, cardinality
11. Inactive 또는 deprecated Relation의 기존 Edge 처리

### [단계 7 — Property와 value model](#stage-7)

1. `props`와 ontology Property의 관계
2. Property ID와 JSON path
3. Datatype과 value shape
4. Required, optional, default value
5. Cardinality와 collection value
6. Enum, reference, embedded object
7. Inline temporal wrapper와 temporal property
8. Unit, locale, normalization
9. Unknown/custom Property 확장 정책
10. JSON Schema와 ontology property rule의 우선순위
11. Property 변경과 instance compatibility

### [단계 8 — Definition과 Axiom model](#stage-8)

1. Definition의 목적과 소유 대상
2. Definition의 revision, version, citation
3. 단순 assertion Edge와 Axiom Node의 선택 기준
4. Axiom의 canonical shape
5. Rule kind와 operator vocabulary
6. Domain/range, property, cardinality, lifecycle Axiom
7. Severity, rationale, evidence, exception
8. Validity period와 effective version
9. Axiom dependency와 conflict
10. Axiom evaluation과 explainability
11. Enforcement policy와 Axiom 자체 의미의 분리

### [단계 9 — Validation과 semantic issue](#stage-9)

1. Shape, reference, role, semantic validation의 단계
2. Advisory, warning, blocking validation
3. Validation code와 governing Term/Axiom
4. Deterministic evaluation과 validation ordering
5. Legacy-invalid source 처리
6. False positive, exception, waiver
7. Issue provenance와 lifecycle
8. Curator disposition과 remediation
9. Strict validation 승격 기준
10. Mutation validation과 reindex validation의 일관성

### [단계 10 — Group, containment, scope ontology](#stage-10)

1. Group의 canonical identity
2. Container Group과 Principal Group
3. Declared Group Role과 relation-derived role
4. Content membership와 account membership
5. Canonical membership direction
6. Direct membership와 transitive closure
7. Group hierarchy, cycle, depth, provenance
8. Navigation Group과 policy-bearing Group
9. Scope/Collection legacy compatibility
10. Workspace/root/global query context
11. Group migration 이후의 canonical contract

### [단계 11 — Permission과 ontology governance](#stage-11)

1. Ontology vocabulary의 소유권과 governance boundary
2. Core ontology와 domain ontology
3. Curator, author, operator의 역할
4. Term 생성, 수정, 승인, 폐기 권한
5. Term visibility와 instance validity의 관계
6. Private term과 private usage 보호
7. Direct capability와 Group capability
8. Membership과 permission effect의 분리
9. Multi-Group permission conflict
10. Workspace-wide capability
11. `can_manage_in`과 ontology 관리 권한
12. Self-escalation과 last-manager safety

### [단계 12 — Materialization contract](#stage-12)

1. Materialization의 정의와 범위
2. Core ontology materialization
3. Virtual/reference term materialization
4. Domain ontology materialization
5. Projection, migration, inference와의 구분
6. Dependency ordering과 bootstrap sequence
7. Dry-run inventory와 impact report
8. Create, skip-equivalent, conflict-preserved, repair-proposed
9. Idempotency와 deterministic output
10. Event/history와 mutation contract
11. Atomicity, failure recovery, resume
12. Reindex와 post-materialization validation
13. Rollback과 source preservation

### [단계 13 — Projection, query, explanation](#stage-13)

1. Ontology term projection
2. Term usage와 reverse usage
3. Assertion과 constraint projection
4. Type/Group hierarchy closure
5. Direct/derived/provenance 구분
6. Validation issue projection
7. Effective permission explanation
8. Permission-aware usage count와 metadata 보호
9. Projection freshness와 fail-closed 정책
10. Source-only rebuild와 parity 검증

### [단계 14 — Compatibility와 source migration](#stage-14)

1. Current implementation inventory
2. Legacy term과 virtual ID inventory
3. Compatibility resolver
4. Advisory-only migration 준비
5. Compatibility-only, retype-in-place, successor 전략
6. Reference와 backlink 보존
7. Permission/query 결과 diff
8. Batch migration과 Curator 승인
9. Rollback과 restore rehearsal
10. Legacy API와 projection retirement
11. 기존 ontology 문서의 폐기 또는 과거 자료 이관

### [단계 15 — Canonical core ontology vocabulary](#stage-15)

1. Core Type 목록과 Definition
2. Core Relation 목록과 Definition
3. Core Property 목록과 Definition
4. Core Tag와 classification policy
5. Core Axiom과 validation code
6. Group/permission vocabulary
7. Definition/replacement vocabulary
8. Materialization manifest와 ontology version
9. Reserved term과 extension point

### [단계 16 — API, editor, explorer](#stage-16)

1. Ontology read API
2. Term detail, usage, constraint API
3. Validation explanation API
4. Curator mutation API
5. Type/Tag/Relation/Property 선택 UX
6. Advisory editing guidance
7. Readonly ontology explorer
8. Impact review와 deprecation workflow
9. Accessibility와 permission-aware UI
10. API versioning과 compatibility alias

### [단계 17 — Conformance와 reference domain](#stage-17)

1. Conformance level과 지원 범위
2. 최소 reference domain ontology
3. Valid/invalid instance fixture
4. Type, Relation, Property, Axiom validation test
5. Group hierarchy와 permission fixture
6. Materialization idempotency test
7. Full reindex/incremental parity
8. Permission과 private metadata security test
9. Migration/restore rehearsal
10. Specification acceptance criteria

### [단계 18 — 구현과 release 전환](#stage-18)

1. 구현 dependency와 phase ordering
2. Advisory-only 최초 release
3. Core materialization release gate
4. Domain ontology opt-in
5. Strict validation activation gate
6. Group migration gate
7. API/UI cutover
8. Legacy retirement gate
9. Monitoring, audit, operational recovery
10. Canonical specification 승인

### [단계 19 — 확장 과제와 부록](#stage-19)

1. Deferred reasoning
2. Inverse/subclass inference
3. External ontology import/export
4. RDF/OWL/SHACL 호환성 검토
5. Ontology package와 federation
6. 용어집
7. Canonical ID registry
8. Validation code registry
9. Decision log
10. Superseded design history
11. 관련 문서와 migration map

---

<a id="stage-0"></a>
## 단계 0 — 문서 권위와 의사결정 규범

단계 상태: **Completed**

승인일: 2026-08-10

승인 주체: 초기 `Specification Authority`

### 0.1 문서의 목적과 적용 범위

**Decision**

`L.W.S. Ontology Specification`은 기존 설계와 구현을 초안 및 근거 자료로 재검토하여
L.W.S. ontology의 개념, 표현, 해석, validation, materialization, governance와
compatibility를 구현 가능한 수준으로 재정립하는 유일한 규범 문서다.

기존 설계 문서, 현재 구현과 기존 데이터는 자동으로 Target ontology의 규범이 되지 않는다.
기존 규칙은 이 specification에서 명시적으로 재승인된 경우에만 Target ontology의 규범이
된다.

이 specification은 다음 세 수준을 연결해야 한다(MUST).

1. **개념 규칙**: Type, Relation, Property, Definition, Axiom 등 ontology 요소의 의미
2. **표현 규칙**: 그 의미를 Node, Edge, ID, field와 `props`로 기록하는 방식
3. **실행 규칙**: validator, materializer, projection과 query가 그 표현을 해석하는 방식

중요한 Decision은 해당되는 경우 다음 대상으로 이어지는 추적 정보를 제공해야 한다(SHOULD).

```text
Decision
├─ source shape 또는 schema
├─ validation rule
├─ materialization rule
├─ projection/query rule
├─ compatibility/migration
└─ conformance test
```

모든 Decision이 위 대상을 전부 가져야 하는 것은 아니다. 해당되지 않는 연결은 생략할 수
있다(MAY).

이 specification의 Decision은 ontology 의미와 구현 목표를 확정하지만, 그 자체로 source
mutation, migration 실행, materialization 실행 또는 permission 완화를 승인하지 않는다.
실제 변경은 0.6의 별도 실행 승인 절차를 따라야 한다(MUST).

**Rationale**

초기 설계의 유효한 기반을 보존하면서도 불명확하거나 우연히 구현된 동작을 영구 규범으로
고정하지 않기 위함이다. 추상적인 개념 설명에 그치지 않고 source 표현과 실행 결과까지
연결해야 구현과 conformance를 객관적으로 판정할 수 있다.

### 0.2 문서 권위, 우선순위와 충돌 처리

**Decision**

문서 권위는 하나의 단순한 우선순위로 판단하지 않는다. 다음 세 축을 분리해야 한다(MUST).

1. 무엇이 올바른 ontology 의미인가: **의미 규범의 권위**
2. 현재 무엇이 실제로 실행되는가: **현재 동작 판정의 권위**
3. 지금 무엇을 변경할 수 있는가: **변경 권한과 실행 순서**

#### 0.2.1 의미 규범의 권위

Target ontology의 의미를 판정할 때는 다음 규범 우선순위를 적용해야 한다(MUST).

```text
1. 이 specification에 기록된 Decision
2. 이 specification에 기록된 Compatibility
```

`Decision`은 최종 목표 규칙이다. `Compatibility`는 Decision으로 이행하는 동안에만 효력이
있는 임시 규칙이며, Decision의 의미를 영구적으로 변경할 수 없다(MUST NOT).

다음 자료는 규범이 아니라 논의와 사실 확인을 위한 근거다.

```text
1. Proposal
2. 검증된 Current evidence
3. 과거 설계 문서와 구현 보고서
4. 문서에 기록되지 않은 추정
```

Proposal이나 현재 구현은 Specification Decision을 대신할 수 없다(MUST NOT). 적용되는
Decision이 없으면 임의로 Target 규칙을 추론하지 않고 `Unresolved`로 남겨야 한다(MUST).

#### 0.2.2 현재 동작 판정의 권위

Current evidence가 서로 충돌할 때는 다음 우선순위로 현재 동작을 판정해야 한다(MUST).

```text
1. 실행 코드와 schema
2. 해당 동작을 검증하는 test
3. 실제 source와 projection을 이용한 재현 결과
4. 구현 보고서
5. 설계 문서의 Current 설명
```

상위 근거와 하위 근거가 충돌하면 상위 근거를 우선하되, 코드와 test가 서로 충돌하거나
재현 결과가 다르면 확인된 사실로 단정하지 않고 조사 대상 `Current`로 기록해야 한다(MUST).
현재 동작을 설명할 때 코드가 우선한다는 사실은 그 동작을 Target 규칙으로 승인한다는 뜻이
아니다.

#### 0.2.3 변경 권한과 실행 순서

Specification Decision을 실제 코드나 source에 적용할 때는 다음 순서를 따라야 한다(MUST).

```text
1. 승인되고 기록된 Decision을 확인한다.
2. Current와 Decision의 차이를 확인한다.
3. data, API, permission, security와 recovery 영향을 조사한다.
4. Compatibility와 migration 필요 여부를 결정한다.
5. 구현 또는 migration 실행안을 작성한다.
6. `Execution Authority`가 실행안을 검토하고 실행을 승인한다.
7. 승인된 범위에서 변경을 실행한다.
8. test, inventory와 rebuild로 conformance를 검증한다.
9. 임시 Compatibility를 제거하거나 유지 조건과 기한을 기록한다.
```

Decision이 있다는 이유만으로 기존 source를 자동 rewrite하거나 security boundary를 완화해서는
안 된다(MUST NOT).

#### 0.2.4 충돌 처리

Specification과 현재 구현의 차이가 확인되면 적용 가능한 다음 절차를 순서대로 수행해야
한다(MUST).

```text
1. 적용되는 Decision을 식별한다.
2. 코드, schema와 source의 Current 동작을 검증한다.
3. 둘을 비교한다.
4. 일치하면 Conformant candidate로 검증한다.
5. 다르면 Implementation Gap으로 분류한다.
6. Gap을 구현 결함, Compatibility, source migration, security review,
   specification 재논의 중 하나 이상으로 분류한다.
7. 처리 전략과 구체적인 변경 절차를 실행안으로 작성한다.
8. `Execution Authority`가 실행안을 검토하고 실행을 승인한다.
9. 구현 또는 migration을 수행한다.
10. conformance를 검증한다.
11. Compatibility를 종료하거나 잔여 조건을 기록한다.
```

각 Implementation Gap에는 다음 표에서 해당하는 처리 방향을 모두 적용해야 한다(MUST).

| 상황 | 처리 방향 |
| --- | --- |
| 안전하게 즉시 수정할 수 있는 구현 차이 | 구현 결함으로 수정 |
| 기존 데이터가 영향을 받는 차이 | Compatibility와 migration 선행 |
| permission 결과가 달라지는 차이 | security diff와 별도 실행 승인 필요 |
| source rewrite가 필요한 차이 | dry-run, backup과 restore 검증 후 진행 |
| Specification의 맹점이 발견된 경우 | 구현을 중단하고 Decision을 재논의 |
| 현재 동작이 더 엄격한 security boundary인 경우 | 명시적 security 승인 전까지 더 엄격한 동작 유지 |

### 0.3 문서와 구현의 상태 체계

**Decision**

Specification 상태와 implementation 상태를 서로 독립된 축으로 관리해야 한다(MUST).

#### Specification status

| 상태 | 의미 |
| --- | --- |
| `Outline` | 목차와 논의 순서만 정립된 상태 |
| `Draft` | 단계별 Proposal과 Decision 작성이 진행 중인 상태 |
| `Candidate` | 필수 규칙이 작성되어 최종 검토 중인 상태 |
| `Canonical` | L.W.S. ontology의 유일한 현행 규범으로 승인된 상태 |
| `Superseded` | 후속 specification으로 대체된 상태 |

#### Implementation status

| 상태 | 의미 |
| --- | --- |
| `Not Implemented` | 해당 Decision을 구현하지 않은 상태 |
| `Partially Implemented` | 일부 구현 또는 Compatibility/migration 진행 상태 |
| `Conformant` | 코드, source 처리, projection과 test가 적용 Decision을 만족하는 상태 |

Specification이 `Canonical`이라는 사실만으로 구현이 `Conformant`가 되지 않는다. 두 상태를
결합하면 다음과 같이 해석한다.

| Specification | Implementation | 의미 |
| --- | --- | --- |
| `Draft` | Current only | 목표 규칙을 논의 중이며 확정된 전체 목표가 없음 |
| `Canonical` | `Not Implemented` | 목표는 확정됐지만 구현하지 않음 |
| `Canonical` | `Partially Implemented` | Compatibility 또는 migration을 거치는 중 |
| `Canonical` | `Conformant` | 구현과 검증 결과가 규범을 만족함 |
| `Superseded` | 기존 `Conformant` | 후속 specification으로 전환 계획이 필요함 |

Canonical과 Conformant의 분리는 불일치를 허용된 최종 상태로 방치하기 위한 것이 아니다.
Canonical Decision과 다른 현재 구현은 명시적으로 관리하고 해소해야 하는
`Implementation Gap`이다(MUST).

### 0.4 본문 기록 상태와 사용 방식

**Decision**

각 주제는 필요한 상태만 사용하되, 사실·논의안·규범·과도기 규칙을 혼합해서는 안 된다
(MUST NOT).

| 기록 상태 | 의미와 효력 |
| --- | --- |
| `Current` | 검증된 현재 동작 또는 데이터 상태. Target 규범이 아님 |
| `Proposal` | 논의 중인 안. 구현 또는 migration 근거로 사용할 수 없음 |
| `Decision` | 승인되고 문서에 기록된 Target 규범 |
| `Rationale` | Decision을 채택한 이유. Decision의 규범 문구를 변경하지 않음 |
| `Compatibility` | Decision으로 이행하기 위한 임시 허용 규칙 |
| `Deprecated` | 아직 지원하지만 제거 대상으로 지정된 규칙 또는 surface |
| `Unresolved` | 아직 결정되지 않은 문제. 0.7에 따라 `Blocking`, `Deferred`, `Execution-scoped`로 분류해야 함 |
| `Rejected` | 검토했지만 채택하지 않은 안과 그 이유 |
| `Exit Criteria` | 단계 논의 또는 구현 전환의 완료 조건 |

대화 중 합의는 자동으로 문서에 기록되지 않으며 자동으로 Decision 효력을 갖지 않는다.
`Specification Authority`의 명시적 문서화 요청, 문서 반영과 검토를 거쳐야 한다(MUST).

다음은 기록 형식의 **비규범 예시(설명용 예시)**다. 이 예시는 `Node.type`의 실제 규칙을 확정하지 않는다.

```text
주제: Node.type의 semantic role

Current:
  built-in Type ID이거나 존재하는 Node ID이면 허용한다.

Proposal:
  Node.type은 active Node Type term을 참조해야 한다.

Rationale:
  임의 Node를 Type으로 사용하면 validation 경계가 불명확해진다.

Compatibility:
  기존 arbitrary Node reference를 migration 동안 warning으로 허용한다.

Unresolved:
  deprecated Type의 기존 사용을 계속 허용할지 결정하지 않았다.

Rejected:
  prefix만으로 Type 역할을 판정하는 안.

Decision:
  승인된 규범 문장을 기록한다.

Exit Criteria:
  resolver, inventory, validation과 conformance fixture가 준비되어야 한다.
```

### 0.5 규범어와 사용 방식

**Decision**

대문자로 쓴 `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, `MAY`만 이 문서의 규범어로
사용한다. 일반 서술의 “필수”, “권장” 또는 “가능”은 문맥 설명이며 규범어를 대신하지 않는다.

| 규범어 | 의미 |
| --- | --- |
| `MUST` | Conformance를 위해 반드시 만족해야 하는 요구사항 |
| `MUST NOT` | Conformance를 위해 반드시 금지되는 동작 |
| `SHOULD` | 원칙적으로 따라야 하며 예외에는 명시적 이유가 필요한 요구사항 |
| `SHOULD NOT` | 원칙적으로 금지되며 예외에는 명시적 이유가 필요한 동작 |
| `MAY` | 구현 또는 domain이 선택할 수 있는 기능이나 동작 |

규범 문장은 가능한 한 다음 형식을 따라야 한다(SHOULD).

```text
[주체]는 [조건]에서 [행동]해야 한다(MUST/SHOULD/MAY).
위반 여부는 [관찰 가능한 결과]로 판정한다.
```

다음은 규범어의 문법과 강도를 보여 주는 **비규범 예시(설명용 예시)**이며, 이후 단계의 substantive
Decision을 선결하지 않는다.

```text
MUST:
  Materializer는 변경되지 않은 동일 source에 대한 반복 실행에서 동일한
  결과를 생성해야 한다.

MUST NOT:
  Role resolver는 ID prefix만으로 사용자 정의 Node의 semantic role을
  확정해서는 안 된다.

SHOULD:
  Curator는 active Term을 deprecated로 전환할 때 replacement를 제공해야 한다.

SHOULD NOT:
  Materializer는 사람이 작성한 Definition을 자동으로 덮어쓰지 않아야 한다.

MAY:
  Domain ontology는 Property의 권장 표시 단위를 선언할 수 있다.
```

`SHOULD` 또는 `SHOULD NOT`의 예외는 이유와 영향을 기록해야 한다(MUST). `MAY` 기능을
사용하지 않는 구현은 그 이유만으로 비준수로 판정하지 않으며, consumer는 `MAY` 기능이 항상
존재한다고 가정해서는 안 된다(MUST NOT).

“적절하게”, “안전하게”, “필요에 따라”처럼 위반 여부를 객관적으로 판정할 수 없는 표현을
단독 규범으로 사용해서는 안 된다(MUST NOT). `MUST`가 기록되었다는 사실은 구현 완료를
뜻하지 않으며 implementation status로 별도 판정해야 한다(MUST).

### 0.6 의사결정, 문서화와 실행 승인 절차

**Decision**

#### 0.6.1 권한 주체

이 specification에서 별도 한정 없이 의사결정 주체로 지칭한 `사용자`는 L.W.S. 프로젝트
소유자를 뜻한다. L.W.S. 프로젝트 소유자는 초기 `Specification Authority`이자 초기
`Execution Authority`다.

`Specification Authority`는 이 specification의 Proposal을 Decision으로 승인하고, 기록·변경·
폐기 및 문서화를 요청할 수 있는 권한 주체다. `Execution Authority`는 승인된 Decision을
적용하기 위한 implementation, materialization, migration, source rewrite 또는 permission
변경의 실행을 승인할 수 있는 권한 주체다.

별도 위임이 없으면 `Specification Authority`가 `Execution Authority`를 겸한다. 두 Authority는
권한의 전부 또는 일부를 위임할 수 있다(MAY). 권한 위임에는 위임자, 수임자, 권한 범위,
허용 행위, 유효 시점, 종료 또는 철회 조건을 명시적으로 기록해야 한다(MUST).

일반 L.W.S. 사용자, Curator, 구현 담당자, 자동화 도구 또는 Codex를 명시적인 위임 없이
`Specification Authority`나 `Execution Authority`로 간주해서는 안 된다(MUST NOT).

#### 0.6.2 승인 종류

승인 종류는 `Specification 승인`과 `실행 승인` 두 가지로 구분해야 한다(MUST). 실행안의
작성과 검토는 실행 승인에 포함되는 절차이며 별도의 세 번째 승인 종류가 아니다.

```text
Specification 승인:
  ontology 의미, canonical 표현, 요구 동작, Compatibility, Conformance와
  구현이 지켜야 할 contract를 구체화하고 승인한다.

실행 승인:
  실제 구현 방식, migration 절차, 영향, recovery, test와 실행 시점을 담은
  실행안을 검토하고 실제 변경을 승인한다.
```

#### 0.6.3 Specification 의사결정 및 문서화

Specification Decision은 다음 절차를 따라야 한다(MUST).

```text
1. Issue를 제기한다.
2. Current evidence를 확인한다.
3. 목표와 제약을 확인한다.
4. 가능한 대안을 작성한다.
5. 의미, 구현, migration과 security 영향을 비교한다.
6. 잠정 합의를 도출한다.
7. 남은 Unresolved를 확인한다.
8. `Specification Authority`가 규칙을 명시적으로 승인한다.
9. `Specification Authority`가 문서화를 명시적으로 요청한다.
10. Decision, Rationale와 필요한 Compatibility를 문서에 반영한다.
11. `Specification Authority`가 반영 결과를 검토한다.
12. 기록된 Decision이 규범 효력을 갖는다.
```

논의 중의 동의, 잠정 합의, `Specification Authority`의 규칙 승인과 문서화 요청은 동일한
행위로 간주하지 않는다(MUST NOT). `Specification Authority`의 명시적 문서화 요청이 없으면
파일을 수정해서는 안 된다(MUST NOT).

#### 0.6.4 실행 승인

기록된 Decision을 실제 시스템에 적용하려면 다음 실행 승인 절차를 따라야 한다(MUST).

```text
1. 적용할 Decision과 Current의 차이를 확인한다.
2. 변경 범위와 구현 또는 migration 방법을 실행안으로 작성한다.
3. data, API, permission, security와 recovery 영향을 기록한다.
4. dry-run, backup, rollback과 conformance test 방법을 기록한다.
5. `Execution Authority`가 실행안 전체를 검토한다.
6. `Execution Authority`가 실행을 명시적으로 승인한다.
7. 승인된 범위와 절차에 따라서만 변경한다.
8. 실행 결과와 conformance를 검증한다.
```

Specification 승인은 ontology 규칙과 구현이 만족해야 할 contract를 구체화하는 승인이다.
이는 materialization, migration, source rewrite 또는 permission 변경의 실행 승인이 아니다.
실제 구현 방식, migration 절차, 영향, recovery와 실행 시점은 실행안으로 제시하며, 실행
승인에서 함께 검토하고 승인해야 한다(MUST).

이미 기록된 Decision을 변경하거나 폐기할 때도 같은 Specification 의사결정 및 문서화 절차를
적용해야 한다(MUST). 승인된 실행안의 범위나 절차를 변경하려면 변경된 실행안을 다시 검토하고
실행 승인을 받아야 한다(MUST).

### 0.7 단계별 기록 형식과 Ontology 확립 완료 조건

**Decision**

각 단계는 가능한 경우 다음 구조로 작성해야 한다(SHOULD).

```text
단계 목적
Current
Proposal
Decision
Rationale
Compatibility
Deprecated
Unresolved
Rejected
Exit Criteria
```

해당 상태가 없는 항목은 생략할 수 있다(MAY). `Decision`과 `Compatibility`는 구분해야 하며
Compatibility에는 종료 조건 또는 재검토 조건이 있어야 한다(MUST).

모든 `Unresolved`는 다음 세 종류 중 하나로 분류해야 한다(MUST).

| 분류 | 의미 | 승인에 미치는 영향 |
| --- | --- | --- |
| `Blocking` | 필수 의미, 표현, 동작, Compatibility, safety 또는 Conformance를 불명확하게 하는 문제 | Canonical 승인 차단 |
| `Deferred` | 현재 필수 범위 밖의 선택적 또는 후속 기능 | 아래 이관 조건을 만족하면 Canonical 승인 허용 |
| `Execution-scoped` | 구체적인 구현 또는 migration 실행안에 속하는 문제 | Canonical 승인은 허용하지만 관련 실행 승인 차단 |

다음 중 하나 이상에 해당하는 `Unresolved`는 `Blocking`으로 분류해야 한다(MUST).

1. ontology 의미를 불명확하게 한다.
2. canonical source 표현을 불명확하게 한다.
3. 필수 동작이나 금지 동작을 불명확하게 한다.
4. mandatory Compatibility의 적용 또는 종료 조건을 불명확하게 한다.
5. security 또는 source 보존 경계를 불명확하게 한다.
6. Conformance 판정을 불명확하게 한다.
7. 동일한 canonical source와 동일한 조건에 대해 상반된 semantic 해석이나 관찰 가능한 결과를 허용한다.

내부 구현 방식이 다르더라도 동일한 canonical source에 대해 같은 semantic 해석과 관찰 가능한
결과를 생성한다면 그 차이만으로 `Blocking`으로 분류하지 않는다. Specification이 `MAY`로
복수의 동작을 의도적으로 허용한 경우에도 허용 범위와 이를 이용하는 구현체의 처리 방식이
명확하면 그 선택 가능성만으로 `Blocking`으로 분류하지 않는다.

`Unresolved`를 `Deferred`로 이관하려면 다음 조건을 모두 충족해야 한다(MUST).

1. 현재 필수 범위 밖임을 명시한다.
2. 해당 기능이 없을 때의 현재 동작을 정의한다.
3. 기존 Decision의 의미를 변경하지 않는다.
4. 현재 Conformance 판정을 변경하지 않는다.
5. 영향 범위와 다시 논의할 조건을 기록한다.

구체적인 module, migration batch 크기, 배포 시점 또는 backup 경로 같은 문제는
`Execution-scoped`로 분류할 수 있다(MAY). 그러나 복구 가능한 backup의 필요 여부처럼
security나 source 보존의 규범적 경계를 결정하는 문제는 `Execution-scoped`로 낮춰서는 안
되며 `Blocking`으로 분류해야 한다(MUST).

Specification은 다음 조건을 모두 충족한 뒤에만 `Canonical`로 승인할 수 있다(MUST).

1. 단계 0부터 단계 18까지의 필수 규칙이 작성되고 검토되었다.
2. `Blocking Unresolved`가 없다.
3. 모든 `Deferred Unresolved`가 이관 조건을 충족한다.
4. canonical vocabulary, identity와 lifecycle 규칙이 확정되었다.
5. validation, materialization, conflict와 recovery 규칙이 확정되었다.
6. reference domain으로 규칙의 표현 가능성을 검증했다.
7. conformance test와 acceptance criteria가 정의되었다.
8. 기존 ontology 문서의 반영, 폐기 또는 과거 자료 이관 여부가 결정되었다.
9. implementation 및 legacy transition이 따라야 할 규범적 요구사항과 실행 승인 gate가 정의되었다.

`Execution-scoped Unresolved`는 Specification의 Canonical 승인을 차단하지 않지만, 해당 문제가
해결되고 실행안에 반영되기 전까지 관련 작업의 실행 승인을 차단해야 한다(MUST).

단계 19의 deferred reasoning, 외부 ontology 호환과 federation은 명시적으로 필수 범위로
승격되지 않는 한 Canonical 승인을 막지 않는다.

**Exit Criteria**

단계 0은 다음 조건을 충족하면 완료된다.

1. 문서의 목적과 적용 범위가 승인되었다.
2. 의미 규범, Current 판정과 변경 권한의 관계가 승인되었다.
3. 문서 및 구현 상태와 본문 기록 상태가 승인되었다.
4. 규범어와 비규범 예시(설명용 예시)의 사용 방식이 승인되었다.
5. 의사결정, 문서화와 실행 승인의 분리가 승인되었다.
6. Specification의 Canonical 완료 조건이 승인되었다.

위 조건은 2026-08-10 초기 `Specification Authority`의 검토와 승인으로 충족되었다.

[목차로 돌아가기](#목차)

<a id="stage-1"></a>
## 단계 1 — Ontology의 정의와 시스템 경계

<!-- 논의 후 작성 -->

<a id="stage-2"></a>
## 단계 2 — 저장 철학과 Ontology bootstrap

<!-- 논의 후 작성 -->

<a id="stage-3"></a>
## 단계 3 — Core meta-model과 semantic role

<!-- 논의 후 작성 -->

<a id="stage-4"></a>
## 단계 4 — 식별자, namespace, version, lifecycle

<!-- 논의 후 작성 -->

<a id="stage-5"></a>
## 단계 5 — Type과 classification 규칙

<!-- 논의 후 작성 -->

<a id="stage-6"></a>
## 단계 6 — Relation과 statement 규칙

<!-- 논의 후 작성 -->

<a id="stage-7"></a>
## 단계 7 — Property와 value model

<!-- 논의 후 작성 -->

<a id="stage-8"></a>
## 단계 8 — Definition과 Axiom model

<!-- 논의 후 작성 -->

<a id="stage-9"></a>
## 단계 9 — Validation과 semantic issue

<!-- 논의 후 작성 -->

<a id="stage-10"></a>
## 단계 10 — Group, containment, scope ontology

<!-- 논의 후 작성 -->

<a id="stage-11"></a>
## 단계 11 — Permission과 ontology governance

<!-- 논의 후 작성 -->

<a id="stage-12"></a>
## 단계 12 — Materialization contract

<!-- 논의 후 작성 -->

<a id="stage-13"></a>
## 단계 13 — Projection, query, explanation

<!-- 논의 후 작성 -->

<a id="stage-14"></a>
## 단계 14 — Compatibility와 source migration

<!-- 논의 후 작성 -->

<a id="stage-15"></a>
## 단계 15 — Canonical core ontology vocabulary

<!-- 논의 후 작성 -->

<a id="stage-16"></a>
## 단계 16 — API, editor, explorer

<!-- 논의 후 작성 -->

<a id="stage-17"></a>
## 단계 17 — Conformance와 reference domain

<!-- 논의 후 작성 -->

<a id="stage-18"></a>
## 단계 18 — 구현과 release 전환

<!-- 논의 후 작성 -->

<a id="stage-19"></a>
## 단계 19 — 확장 과제와 부록

<!-- 논의 후 작성 -->
