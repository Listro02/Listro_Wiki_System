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

단계 상태: **In Discussion**

이 절은 지금까지의 논의를 보존하고 남은 쟁점을 단계별로 나누기 위한 중간 기록이다.
아직 단계 1의 `Decision`이 아니며 규범 효력이나 구현 권한을 갖지 않는다. 논의가 진행되는
동안 내용, 용어, 층위와 후속 단계 배정은 언제든 수정될 수 있다. 단계 1의 규범은 남은
`Unresolved`를 논의한 뒤 `Specification Authority`가 명시적으로 승인하고 문서화를 요청하여
`Decision`으로 기록했을 때 확정된다.

### 단계 1 논의 목차

1. [단계 목적과 논의 범위](#stage-1-purpose)
2. [기존 논의 목적의 포함 여부](#stage-1-agenda-audit)
3. [확인된 Current source shape](#stage-1-current-shape)
4. [L.W.S. Ontology의 정의 후보](#stage-1-ontology-definition)
5. [Knowledge Object와 Node/Edge](#stage-1-knowledge-object)
6. [Ontology, Knowledge Graph, Schema, Validation과 Projection](#stage-1-concept-boundaries)
7. [의미 규칙, JSON Schema와 Semantic Validator](#stage-1-schema-validation)
8. [Ontology graph, domain ontology와 instance graph의 층위](#stage-1-layers)
9. [Canonical source와 derived artifact](#stage-1-source-derived)
10. [책임 범위와 구현 경계](#stage-1-boundary)
11. [초기 목표와 non-goal](#stage-1-goals)
12. [명시적 선언과 자동 추론의 경계](#stage-1-inference)
13. [Open-world와 closed-world 해석 정책](#stage-1-world-assumption)
14. [추가 시스템 경계 질문](#stage-1-cross-cutting)
15. [논의해야 할 사항](#stage-1-unresolved)
16. [Exit Criteria](#stage-1-exit-criteria)

<a id="stage-1-purpose"></a>
### 1.1 단계 목적과 논의 범위

**Proposal**

단계 1의 목적은 L.W.S. Ontology가 무엇을 규정하는지, 어떤 대상과 층위를 다루는지, 그리고
어디부터 애플리케이션 구현의 책임인지를 정하는 것이다. 이 단계에서는 Type, Relation, Tag,
Property 또는 Axiom의 개별 vocabulary를 열거하거나 `type.service` 같은 세부 term의 규칙을
확정하지 않는다. 대신 이후 단계에서 세부 term과 object profile을 일관되게 정의할 수 있는
전반적인 틀과 논의 단위를 정한다.

단계 1에서 정한 경계는 이후 단계의 세부 논의를 제한하거나 중복시키기 위한 별도 추상 계층이
아니다. 의미, canonical JSON 표현, validation, materialization과 conformance를 같은 규칙에서
추적할 수 있게 하는 공통 기준이다.

단계 1에서 승인된 Ontology의 정의와 시스템 경계는 이후 단계가 따라야 하는 규범적 큰 틀이다.
후속 단계는 이 큰 틀 안에서 개념, canonical 표현과 실행 contract를 세분화할 수 있지만, 단계
1의 의미 경계를 재정의하거나 그와 충돌하는 규칙을 재승인 없이 도입할 수 없다. 후속 논의에서
큰 틀 자체의 변경이 필요하다고 확인되면 0.6의 Specification 의사결정 및 문서화 절차에 따라
단계 1 Decision을 다시 검토하고 승인해야 한다.

<a id="stage-1-agenda-audit"></a>
### 1.2 기존 논의 목적의 포함 여부

**Current**

단계 1의 기존 목차에 제시된 일곱 논의 목적을 이번 보강 전의 초안과 대조한 결과는 다음과
같다. 여기서 `포함`은 승인 또는 완료를 뜻하지 않고, 상세 논의를 시작할 수 있는 내용이
기록되어 있었다는 뜻이다.

| 기존 논의 목적 | 보강 전 포함 상태 | 확인 결과와 남은 핵심 |
| --- | --- | --- |
| L.W.S.에서 Ontology의 정의 | 상당 부분 포함 | semantic grammar와 canonical object grammar라는 정의 후보가 있다. Knowledge Object의 최소 성질과 ontology가 L.W.S. 로직 전체 중 어디까지를 지배하는지는 미확정이다. |
| Ontology, Knowledge Graph, Schema, Validation, Projection의 구분 | 부분 포함 | JSON Schema, Semantic Validator와 derived artifact는 구분했다. Knowledge Graph 자체의 정의와 다섯 개념 사이 권위·입출력 관계는 아직 명시하지 않았다. |
| Ontology graph, domain ontology, instance graph의 층위 | 상당 부분 포함 | Meta, Core, Domain, Instance, Derived 후보가 있다. `Ontology graph`가 이 층위들을 포괄하는 graph인지 별도 층위인지와 한 object의 층위 소속 규칙은 미확정이다. |
| Ontology가 책임지는 것과 책임지지 않는 것 | 상당 부분 포함 | 의미에 영향을 주는 JSON shape와 내부 구현을 구분했다. query, permission, lifecycle, provenance 중 무엇이 ontology 의미이고 무엇이 애플리케이션 정책인지는 더 나눠야 한다. |
| 초기 목표와 non-goal | 부분 포함 | non-goal 후보는 있으나 긍정적 목표, 우선순위와 성공 판정 기준이 충분히 정리되지 않았다. |
| 명시적 선언과 자동 추론의 경계 | 최소 포함 | source와 derived artifact는 구분했지만 어떤 inference를 허용하고 그 결과의 권위·충돌·provenance를 어떻게 처리할지는 논의하지 않았다. |
| Open-world와 closed-world 해석 정책 | 미포함에 가까움 | `Unknown`, `Absent`, `Invalid` 쟁점만 등록되어 있다. 적용 단위, negative assertion, permission과 temporal context까지 논의해야 한다. |

따라서 기존 일곱 목적은 목차상 모두 추적되고 있었지만, 보강 전 상태만으로 완료된 항목은
없었다. 특히 마지막 세 항목과 Knowledge Graph의 정의가 부족하여 1.6과 1.11부터 1.14까지에
정의 후보와 상세 논의 질문을 추가했다. 추가된 내용 역시 승인된 답이 아니라 논의 의제다.

이 절은 단계 1 논의 의제의 누락 여부를 확인하기 위한 임시 감사 기록이다. 단계 1의 각 의제가
Decision 또는 적절한 후속 단계의 `Unresolved`로 정리되고 그 추적이 확인되면, Candidate 정리
과정에서 이 절을 삭제한다. 이 기록 자체를 단계 1의 영구 규범이나 Canonical 완료 조건으로
유지하지 않는다.

<a id="stage-1-current-shape"></a>
### 1.3 확인된 Current source shape

**Current**

현재 L.W.S.는 Node와 Edge를 각각 JSON object로 저장하며, `object_kind`를 discriminator로
사용한다. 현재 `schemas/node.schema.json`과 `schemas/edge.schema.json`을 기준으로 확인한
필수 field의 공통 부분과 차이는 다음과 같다.

| 구분 | Current 필수 field |
| --- | --- |
| Node와 Edge 공통 | `schema_version`, `object_kind`, `id`, `rev`, `type`, `title`, `detail_mode`, `visibility`, `status`, `tags`, `props`, `temporal`, `audit` |
| Node에만 존재 | `slug` |
| Edge에만 존재 | `source`, `target` |

현재 Node schema는 `slug`를 필수로 요구하고 Edge schema는 `slug`를 정의하지 않는다. 이 차이는
검증된 `Current`이며, Node만 slug를 가져야 한다는 Target 규칙은 아니다. 모든 Knowledge
Object에 slug가 필요한지, 선택적인지, `title`에서 생성할 수 있는지, 고유성과 변경 시 alias를
어떻게 다룰지는 단계 4에서 결정해야 한다.

현재 shape에서 `id`는 canonical identity와 reference에 사용되고, `title`은 사람이 읽는 표시
이름이다. 다만 현재 mutation의 중복 검사는 Node와 Edge의 각 object kind 안에서만 수행한다.
따라서 같은 문자열 ID의 Node와 Edge가 동시에 존재할 가능성을 전역적으로 차단하지 않으며,
일반 object 조회는 같은 ID의 Node를 Edge보다 먼저 선택하고 SQLite `objects` projection은
`id` 하나를 primary key로 사용한다. 현재 `id`가 identity와 reference에 사용된다는 사실만으로
Node와 Edge 전체에 걸친 전역 uniqueness와 모호하지 않은 resolution이 보장된다고 볼 수 없다.

`title`은 필수인 사람이 읽는 표시 이름이지만 변경과 중복이 가능하다. `slug`는 현재 Node에만
필수인 URL-safe 문자열이며 Node projection과 편집 surface에 존재한다. 현재 구현은 slug의
uniqueness, ID를 대체하는 lookup, URL routing 또는 alias 의미를 보장하지 않는다. `aliases`는
별도의 선택 field이므로 현재 `slug`를 자동으로 address나 alias로 해석하지 않는다.

위 표는 JSON Schema에 선언된 **top-level 필수 field inventory**이며 전체 Current source
grammar를 뜻하지 않는다. 두 JSON Schema는 `additionalProperties: true`를 사용하면서 top-level
`access` field는 금지한다. Runtime shape validator는 schema의 필수 field 외에도 safe object
ID, Node slug pattern, temporal 값과 `audit.created_by`/`audit.updated_by`의 `account.*` 형식 등을
추가로 검사한다. 따라서 JSON Schema와 runtime validator가 표현하는 Current shape의 범위와
강도는 완전히 같지 않다.

위 field 목록과 현재 schema는 Target 설계의 근거이지만 자동으로 최종 canonical shape가 되지
않는다. 이 절은 이후 문법 논의가 참조할 Current baseline만 기록한다. 공통 Knowledge Object
shape와 kind별 semantic profile은 단계 2와 단계 3에서 세분화하고, canonical ID, namespace,
stable identity, slug·label·alias, schema/profile version과 lifecycle은 단계 4에서 확정한다.
JSON Schema와 Semantic Validator의 책임 및 conformance 관계는 1.7에서 경계를 정한 뒤 단계
7과 단계 9에서 구체화한다. 이 과정에서 확인된 Current 한계는 Target 규칙으로 자동 승격하지
않고, 승인된 규칙과 다르면 `Implementation Gap` 또는 Compatibility 대상으로 기록한다.

<a id="stage-1-ontology-definition"></a>
### 1.4 L.W.S. Ontology의 정의 후보

**Proposal**

L.W.S. Ontology는 L.W.S. 지식 체계의 **normative semantic grammar**다. Knowledge Object의
의미, semantic role, 관계, constraint와 canonical 표현을 규정하여, conforming consumer가
동일한 canonical source에 동일한 승인된 ontology 규칙 집합을 적용할 때 일관된 의미로
해석하게 한다.

L.W.S. Ontology는 모든 application behavior를 규정하지 않는다. Knowledge Object의 의미,
semantic role, 관계, constraint와 canonical 표현을 규정하고, 동일한 canonical source의 해석
또는 validity에 영향을 주는 규칙을 그 범위에 포함한다. UI 배치, API의 비규범적 정렬 방식,
물리 파일 layout, database table, cache, module 경계와 내부 알고리즘처럼 의미와 validity를
바꾸지 않는 선택은 애플리케이션 구현의 책임으로 남는다. 반대로 application code에 구현된
규칙이라도 reference, semantic role, relation 방향 또는 validity를 바꾸면 ontology나 그에
연결된 canonical contract의 대상이다.

#### Semantic grammar의 최소 개념 구조

단계 1에서는 다음 개념 구조를 이후 세부 문법을 논의하기 위한 큰 틀로 둔다. 이 구조는 모든
항목을 별도의 object kind나 materialized object로 확정하지 않는다.

```text
저장과 표현
├─ Knowledge Object
│  ├─ Node
│  └─ Edge
└─ Value/Literal

Core Ontology vocabulary
└─ Ontology Term
   └─ Semantic Role Term
      ├─ Type
      ├─ Tag
      ├─ Relation Type
      └─ Property

Semantic Statement
├─ Assertion
├─ Definition
└─ Semantic Rule
   ├─ Axiom
   └─ Constraint
      ├─ Object-scoped Constraint
      └─ Global Constraint
```

`Knowledge Object`, `Node`와 `Edge`는 L.W.S.가 지식을 저장하고 참조하는 기본 형식이다.
`Value/Literal`은 Knowledge Object 안에서 독립적인 canonical identity 없이 기록하는 값의 개념
후보다. 어떤 값에 독립 identity가 필요하여 Knowledge Object가 되는지는 단계 2에서 정한다.

`Ontology Term`은 L.W.S. Ontology의 vocabulary 자체를 구성하기 위해 만든 Knowledge Object다.
모든 Knowledge Object가 Term인 것은 아니며, Knowledge Object가 domain의 Type, Tag, Relation
Type 또는 Property 역할을 적용받았다는 사실만으로 자동으로 Ontology Term이 되지 않는다.
현재 단계에서 확인한 Ontology Term의 최소 하위 범위는 `Type`, `Tag`, `Relation Type`과
`Property` 같은 역할 자체를 확립하는 Core `Semantic Role Term`이다. Term의 lifecycle, version,
provenance, governance와 그 밖의 공통 contract는 아직 확정하지 않고 단계 3·4·11에서 논의한다.

Semantic Role Term이 실제 Knowledge Object에 어떻게 적용되는지와 Type 역할이 적용된
Knowledge Object를 instance가 어떻게 참조하는지는 단계 3과 단계 5에서 정한다. 역할을 적용받은
Knowledge Object는 ontology-aware domain model에 참여할 수 있지만 그 사실만으로 Core Ontology
Term이 되지는 않는다.

`Assertion`은 Knowledge Object 또는 Value 사이에 어떤 사실이나 관계가 성립한다고 표현한
semantic statement다. Assertion은 Ontology Term의 사용을 성립 조건으로 요구하지 않는다.
Relation Type 역할이 적용된 정식 관계 vocabulary로 확립되지 않은 특정 관계도 Edge로 기록된
Assertion일 수 있으며, 그 관계에 어떤 공유 의미와 validation을 적용할 수 있는지는 별도로
판정한다.

`Definition`은 Knowledge Object, Term 또는 Semantic Rule의 의미를 설명하는 statement다.
`Axiom`은 ontology가 의미 체계의 기본 관계, proposition 또는 추론 기반으로 채택한 Semantic
Rule이고, `Constraint`는 Knowledge Object나 grammar에 적용되는 허용·필수·금지 조건을 다루는
Semantic Rule이다. Constraint는 특정 Knowledge Object에 연결되는 `Object-scoped Constraint`와
전체 grammar 또는 대상 집합에 적용되는 `Global Constraint`로 구분한다.

Axiom과 Constraint는 공통 rule shape나 evaluator를 사용할 수 있지만 의미상 같은 종류로
간주하지 않는다. 개별 Axiom은 승인된 Specification Decision을 바탕으로 이후 단계에서
작성하며, materialized Axiom이 Specification Decision을 대신하는 상위 권위가 되지 않는다.
Axiom, Constraint와 공통 rule 표현의 구체 구조는 단계 8에서 결정한다.

별도의 `Semantic Context`를 최소 grammar 구성 요소나 Knowledge Object로 두지 않는다. 의미
판정에 필요한 적용 조건은 Axiom 또는 Constraint를 비롯한 적용 규칙 안에 명시할 수 있다.
현재의 의미 동일성 기준은 동일한 canonical source와 동일한 승인 규칙 집합을 전제로 하며,
숨겨진 runtime 상태가 같은 입력의 의미를 임의로 바꾸는 것은 허용하지 않는 방향으로 둔다.

#### 의미, 표현과 집행의 경계

Semantic grammar는 무엇을 의미하는지, canonical object grammar는 그 의미를 어떻게 기록하는지
정한다. JSON Schema와 Semantic Validator는 canonical object grammar 가운데 각각 구조적으로
검사할 수 있는 규칙과 여러 object의 의미를 함께 해석해야 하는 규칙을 집행한다. 이 관계의
그래프는 1.11에 기록한다.

Ontology 규칙은 기계가 결정적으로 식별하고 적용할 수 있어야 한다. 그러나 이 원칙만으로 모든
규칙을 처음부터 Knowledge Object로 self-description하거나 materialize해야 한다고 선결하지
않는다. bootstrap code/schema와 materialized ontology의 구체적인 authority 및 전환 관계는
단계 2와 단계 12에서 결정한다.

canonical JSON field가 의미 규범에 속하는지는 그 선택이 같은 canonical source의 의미,
reference, validity 또는 consumer 사이의 상호 운용 결과를 바꾸는지로 판정한다. 구체 field,
datatype, required 여부와 role별 profile은 관련 개념을 다루는 단계 3부터 단계 7에서 확정한다.

#### 후속 단계로 이관한 세부사항

| 세부사항 | 주된 후속 단계 | 이관 이유 |
| --- | --- | --- |
| Value/Literal과 first-class Knowledge Object의 정확한 경계 | 단계 2 | source 지위와 독립 identity의 기준이 필요하다. |
| Semantic Role Term의 표현과 실제 Knowledge Object에 대한 role 적용 방식 | 단계 3·5 | core meta-model과 classification 규칙이 필요하다. |
| bootstrap code/schema와 materialized ontology의 authority | 단계 2·12 | bootstrap 및 materialization contract를 함께 정해야 한다. |
| canonical field, datatype, required 여부와 role별 profile | 단계 3~7 | 각 semantic role, identity와 value model의 결정이 선행되어야 한다. |
| 승인 규칙 집합의 revision, ontology version 또는 다른 식별 방식 | 단계 4·15 | stable identity, version과 canonical vocabulary 규칙이 필요하다. |
| validation 상태와 동일성, inference 및 query/projection 결과 | 1.7·1.12·1.13, 단계 9·13·17 | 각 결과의 의미와 conformance 기준이 아직 확정되지 않았다. |
| invalid source의 Knowledge Graph 참여 지위 | 1.6, 단계 9·14 | Knowledge Graph와 validation/source 보존의 관계를 먼저 정해야 한다. |

#### 남은 상세 논의 질문

1. machine-readable 원칙을 만족하기 위해 최초 Canonical에서 모든 규칙을 Knowledge Object로
   self-description해야 하는가, 아니면 명시적인 bootstrap kernel의 code/schema 표현을
   허용할 수 있는가?
2. Core Ontology Term과 일반 Knowledge Object의 경계를 어떤 선언 또는 관계로 판정할 것인가?
   이 판정 원칙을 단계 1에서 어디까지 정하고 구체 표현을 단계 3으로 넘길 것인가?

<a id="stage-1-knowledge-object"></a>
### 1.5 Knowledge Object와 Node/Edge

**Proposal**

`Knowledge Object`를 Node와 Edge의 공통 상위 개념으로 둔다. 이는 JSON 상속을 뜻하는 것이
아니라, 두 object kind가 L.W.S.에서 identity를 가지고 참조·revision·lifecycle·metadata와
semantic role의 적용 대상이 되는 first-class information object라는 뜻이다.

```text
Knowledge Object
├─ Node Object: 지식 대상을 표현한다.
└─ Edge Object: Knowledge Object 사이의 관계 assertion을 표현한다.
```

Node와 Edge는 서로 구별되는 canonical object kind다. Edge를 Node의 하위 type으로 규정하지
않는다. “Edge도 일종의 Node처럼 다룰 수 있다” 또는 “모든 것이 Node다”라는 표현은 Edge도
identity와 내용을 가진 first-class object로 조회하고 참조할 수 있다는 저장 철학을 가리킨다.
그 철학의 정확한 범위와 제한은 단계 2에서 더 논의한다.

Edge가 first-class object라는 이유만으로 모든 Relation의 `source`와 `target`에 Edge를 무제한
허용하지 않는다. 현재 논의의 기준안은 다음과 같다.

> Relation semantic profile이 `source` 또는 `target`에 `edge` object kind를 명시적으로
> 허용한 경우에만 Edge endpoint를 유효하게 본다. 해당 정책이 없으면 Node endpoint만
> 허용하는 방향으로 해석한다.

이 기준안은 Edge endpoint의 기본 폐쇄 정책을 제시할 뿐이며, Relation별 endpoint policy와
`rel.instantiates` 같은 구체적인 relation은 단계 6에서 확정한다. Relation Term 사이의 계층
관계와 실제 Edge Instance가 Definition 또는 evidence를 참조하는 meta-relation도 구분해서
논의해야 한다.

#### `durable source`와 `virtual source`의 현재 의미 후보

앞선 논의에서 Knowledge Object의 성질로 사용한 “durable source 또는 명시된 virtual source를
가진다”는 표현은 아직 확정된 용어가 아니다. 현재 의도는 다음과 같다.

| 용어 후보 | 의도한 의미 |
| --- | --- |
| `durable source` | process 재시작, cache 삭제 또는 index rebuild 뒤에도 남아 canonical object를 다시 구성할 수 있는 지속 저장 원본. 현재의 repository JSON Node/Edge가 대표 후보다. |
| `virtual source` | 별도 JSON object가 없어도 bootstrap registry나 명시적 provider가 canonical ID, 의미와 shape를 결정적으로 제공하는 선언된 source. 단순한 임시 계산 결과나 우연한 fallback은 포함하지 않는다. |

여기서 `durable`과 `virtual`은 Knowledge Object의 종류가 아니라 **source 지위와 provenance**를
설명하려던 표현이다. “source”라는 말이 persisted object와 virtual definition provider를 함께
지칭하여 혼동을 만들 수 있으므로, 단계 2에서는 다음을 다시 결정해야 한다.

1. `canonical source record`, `materialized source object`, `declared virtual term`처럼 용어를
   분리할지
2. virtual term이 실제 Knowledge Object인지, resolver가 제공하는 reference인지
3. virtual term의 권위, revision, lifecycle과 materialization 이전·이후 identity를 어떻게
   유지할지
4. 모든 Knowledge Object가 반드시 source-backed여야 하는지, source가 아닌 선언 provider도
   허용할지

따라서 현시점에는 “durable source 또는 명시된 virtual source를 가진다”를 Knowledge Object의
확정 필수 성질로 사용하지 않는다.

#### 상세 논의 질문

1. Knowledge Object가 되기 위한 최소 조건은 stable identity와 addressability뿐인가, 아니면
   revision, lifecycle, provenance와 독립적인 source 지위도 필수인가?
2. first-class라는 말은 읽기·참조만 뜻하는가, 아니면 직접 수정, history, permission,
   backlink와 audit의 공통 지원까지 뜻하는가?
3. 모든 Knowledge Object가 `object_kind`를 가져야 하는가? 향후 Node/Edge 외의 object kind를
   허용할 것인가, 아니면 모든 확장은 두 kind의 semantic profile로만 표현할 것인가?
4. Node는 “지식 대상”, Edge는 “관계 assertion”이라는 구분이 Definition, Axiom, Event와
   derived assertion에도 충분한가?
5. Edge를 endpoint로 참조할 때 해당 Edge의 상태·visibility·유효 기간이 바뀌면 이를 참조하는
   meta-relation의 의미는 어떻게 달라지는가?
6. source가 없는 virtual term이 Knowledge Object라면 revision, lifecycle, permission과
   provenance를 어디에서 제공하는가?

<a id="stage-1-concept-boundaries"></a>
### 1.6 Ontology, Knowledge Graph, Schema, Validation과 Projection

**Proposal**

다섯 개념의 현재 구분 후보는 다음과 같다. 이 표는 논의를 위한 정의 후보이며 아직
`Decision`이 아니다.

| 개념 | 정의 후보 | 다른 개념과의 관계 |
| --- | --- | --- |
| Ontology | Knowledge Object와 term의 의미, 표현, 관계와 constraint를 규정하는 normative semantic grammar | Schema와 validator가 구현해야 할 의미 contract를 제공하고 Knowledge Graph의 해석을 지배한다. |
| Knowledge Graph | ontology에 의해 해석되는 addressable Knowledge Object와 assertion의 연결된 지식 집합 | source object를 중심으로 구성되며 ontology graph와 instance graph를 포함할 수 있다. derived 결과의 포함 여부는 별도 표시가 필요하다. |
| Schema | object의 machine-checkable structural shape와 일부 국소 constraint를 표현하는 검증 artifact | Ontology 규칙의 구조적 부분을 집행하지만 Ontology 전체 의미와 동일하지 않다. |
| Validation | source나 derived result가 적용 ontology와 profile을 만족하는지 평가하는 절차와 그 결과 | Schema validation과 cross-object semantic validation을 포함한다. validity 판정이지 새로운 의미 source는 아니다. |
| Projection | canonical source와 규칙에서 특정 query/UI/index 목적에 맞게 계산한 derived representation | 원본의 권위를 대체하지 않으며 provenance와 freshness 조건 아래 다시 계산할 수 있어야 한다. |

이 관계는 다음 흐름의 후보로 볼 수 있다.

```text
Ontology ──해석·constraint──> Knowledge Graph
    │                              │
    ├─구조 규칙──> Schema          ├─평가──> Validation result
    └─의미 규칙──> Validator       └─파생──> Projection
```

이 그림은 Schema나 Validator가 Ontology보다 낮은 권위를 갖는다는 추상 관계를 나타내며, 실제
실행 순서나 module 구조를 강제하지 않는다. Schema에 표현되지 않는 ontology 규칙이 있을 수
있고, Projection에만 존재하는 계산 결과가 있을 수 있다.

#### 상세 논의 질문

1. Knowledge Graph는 canonical source object만을 뜻하는가, ontology term과 허용된 derived
   assertion까지 포함하는 논리적 view인가?
2. invalid 또는 unresolved source object는 Knowledge Graph의 일부인가, 별도 quarantine
   영역인가, 아니면 graph에는 남되 validity 상태만 달라지는가?
3. Ontology graph 자체도 Knowledge Graph의 일부인가? 그렇다면 ontology term이 자신을
   설명하는 meta-circular reference를 어떻게 bootstrap하는가?
4. Schema가 Ontology 규칙의 일부를 완전하게 표현하지 못할 때 어떤 추적 정보로 누락을
   표시하고 Semantic Validator와 conformance test에 연결할 것인가?
5. Schema와 Semantic Validator가 서로 다른 결과를 내면 단순 구현 결함인가, 규칙 충돌인가,
   또는 validation phase별 결과로 함께 허용할 수 있는가?
6. Validation 실패는 object의 저장·조회·관계 참여 중 무엇을 막는가? advisory와 blocking
   validation의 구분은 validity 의미를 바꾸는가, enforcement만 바꾸는가?
7. Projection이 source에 없는 집계·closure·설명 정보를 포함할 때 각 값의 direct/derived
   지위와 provenance를 어떻게 노출할 것인가?
8. stale하거나 permission-filtered Projection의 “없음”을 source에 assertion이 없다는 뜻으로
   해석하지 못하게 하려면 어떤 contract가 필요한가?

<a id="stage-1-schema-validation"></a>
### 1.7 의미 규칙, JSON Schema와 Semantic Validator

**Proposal**

Ontology 논의와 JSON 구조 논의를 별개의 연속 단계로 분리하지 않는다. 각 개념 또는 role을
논의할 때 다음 항목을 하나의 specification 단위로 함께 정의한다.

```text
1. Semantic Definition
2. Canonical JSON Shape
3. Structural Constraints
4. Semantic Constraints
5. Compatibility
6. Conformance
```

`JSON Schema`와 `Semantic Validator`의 구분은 specification을 나누기 위한 것이 아니라 동일한
규칙을 어떤 검증 수단이 집행하는지 구분하기 위한 것이다.

| 검증 수단 | 주된 책임 |
| --- | --- |
| JSON Schema | 한 object 내부의 필수 field, datatype, enum, nested shape와 `object_kind`에 따른 조건부 구조 |
| Semantic Validator | reference resolution, term role, 여러 object 사이의 관계, endpoint policy, graph constraint, visibility boundary, cycle와 cardinality |

하나의 규칙이 두 검증 수단에 모두 반영될 수 있으며, 어느 쪽이 담당하는지는 해당 규칙의
conformance 결과가 달라지지 않도록 명시해야 한다. 기존 JSON Schema와 validator는 `Current`
근거다. 새 specification의 의미 또는 canonical shape와 충돌하면 기존 구현을 Target 규칙으로
승격하지 않고 `Implementation Gap`으로 기록한다. 실제 schema 파일과 validator code의 변경은
Specification 확립 후 실행안과 실행 승인을 거쳐 수행한다.

#### 상세 논의 질문

1. canonical profile마다 JSON Schema fragment와 semantic rule의 대응 관계를 의무적으로
   제공할 것인가?
2. `additionalProperties`, custom `props`와 domain extension을 어디까지 구조적으로 허용하고,
   알려지지 않은 field/property를 `Invalid`, `Unknown` 또는 허용된 extension 중 무엇으로
   판정할 것인가?
3. reference existence, target role과 visibility처럼 단일 JSON만으로 판정할 수 없는 규칙을
   schema annotation으로도 선언할 것인가, Semantic Validator registry에서만 관리할 것인가?
4. schema version과 ontology/profile version을 서로 독립적으로 둘 것인가? 어느 변경이 각각의
   version 증가를 요구하는가?
5. structural validation을 통과했지만 semantic validation에 실패한 source의 저장·조회·수정
   가능 범위는 어떻게 정할 것인가?
6. Schema와 Validator가 같은 rule code, governing Term/Axiom과 conformance fixture를 공유해야
   하는가?

<a id="stage-1-layers"></a>
### 1.8 Ontology graph, domain ontology와 instance graph의 층위

**Proposal**

Ontology의 층위는 대상의 기능과 지위를 구별하기 위해 사용하되, 같은 개념을 여러 절에서
중복 정의하는 방식으로 사용하지 않는다.

| 층위 | 논의 대상의 예 |
| --- | --- |
| Meta-ontology | Type, Relation, Tag, Property 같은 semantic role이 무엇인지와 ontology 문장을 구성하는 방법 |
| Core Ontology | L.W.S. 자체가 동작하기 위해 요구하는 built-in term, canonical profile과 공통 constraint |
| Domain Ontology | `type.service`처럼 특정 지식 domain에서 사용하는 구체 term과 domain constraint |
| Instance Graph | `svc.caddy` 같은 지식 대상과 실제 관계 assertion |
| Derived Layer | source와 ontology 규칙으로 계산한 index, projection, closure, inference와 validation result |

`Ontology graph`는 위 표의 단일 행과 같은 별도 추상 수준이라기보다, Meta-ontology, Core
Ontology와 Domain Ontology의 term·Definition·Axiom 및 그 관계를 Knowledge Object로 표현한
graph라는 후보 정의를 둔다. 이 경우 `Domain Ontology`는 ontology graph 안의 domain별
vocabulary/profile이고, `Instance Graph`는 그 term을 사용해 실제 지식 대상과 assertion을
표현하는 graph다. `Derived Layer`는 두 graph와 규칙에서 계산되는 view이며 자동으로 canonical
graph가 되지 않는다.

Meta-ontology와 Core Ontology는 서로 관련되지만 관점이 다르다. Meta-ontology는 “Type이라는
semantic role은 무엇인가”를 설명하고, Core Ontology는 그 role을 L.W.S.에서 사용할 수 있게
하는 built-in term과 canonical object rule을 제공한다. 다만 이 차이가 Type을 두 곳에서 따로
정의하거나 동일한 의미의 source object를 중복 생성해야 한다는 뜻은 아니다.

향후 Type, Tag, Relation 같은 **개념별 주제**를 논의할 때는 한 곳에서 다음 관점을 함께
다룬다.

```text
개념별 통합 profile
├─ Meta: 그 semantic role의 의미
├─ Core: L.W.S.가 요구하는 built-in term과 object rule
├─ Domain: 구체 domain term이 그 role을 사용하는 방식
├─ Instance: 해당 term이 실제 object/assertion에 적용되는 방식
└─ Materialization/Conformance: 각 층위를 source와 실행 결과로 만드는 contract
```

예를 들어 “Type”을 논의할 때 Type role의 의미, Type을 나타내는 core object의 shape,
`type.service` 같은 domain term이 그 role에 속하는 방식과 instance의 `type` field가 이를
참조하는 방식을 한 흐름에서 연결한다. Type role, Core Type object와 Domain Type term 사이를
정확히 `instance` 관계로 부를지, 다른 meta-relation으로 표현할지는 아직 결정하지 않는다.

Materialization은 위 semantic 층위와 별개의 경쟁 정의가 아니다. 합의된 각 층위의 term과
규칙을 어떤 canonical Knowledge Object 또는 선언 provider로 실체화하는지를 다루는 실행
contract다. Core와 Domain의 materialization 대상, bootstrap 순서와 virtual-to-materialized
전환은 단계 12에서 별도로 논의하되, 이 과정에서 개념의 의미를 다시 정의하지 않는다.

#### 상세 논의 질문

1. Ontology graph는 Meta, Core와 모든 Domain Ontology를 포괄하는 하나의 논리 graph인가,
   version이나 workspace별로 구분되는 여러 graph인가?
2. Meta/Core/Domain은 서로 배타적인 분류인가, 하나의 term이 복수 층위의 역할을 가질 수
   있는가? 복수 소속을 허용하면 권위와 dependency를 어떻게 판정하는가?
3. Core Ontology는 L.W.S.가 반드시 제공하는 최소 vocabulary인가, 모든 workspace가 공유하는
   불변 vocabulary인가, 또는 version별로 교체 가능한 system package인가?
4. Domain term은 Meta role의 instance인가, Core term의 subtype인가, profile을 준수하는
   Knowledge Object인가? 이 관계를 어느 canonical relation으로 표현하는가?
5. Ontology term과 ordinary instance를 같은 Node/Edge 저장소와 API에서 다룰 것인가? 같게
   다룬다면 순환 참조, permission과 lifecycle을 어떻게 제한하는가?
6. Instance Graph에서 ontology term 자체를 지식 대상으로 참조하는 meta-knowledge를 허용할
   것인가? 허용한다면 ontology assertion과 일반 instance assertion을 어떻게 구분하는가?
7. Domain Ontology가 Core rule을 확장·좁힘·대체할 수 있는 범위와 충돌 우선순위는 무엇인가?
8. 한 instance에 여러 Domain Ontology 또는 profile이 동시에 적용될 수 있는가? 적용 context는
   source에 명시하는가, query scope에서 정하는가?
9. Derived Layer의 결과를 graph 탐색에 포함할 때 direct edge와 inferred edge를 동일한 API에서
   반환할 것인가, provenance가 드러나는 별도 view로 반환할 것인가?
10. 각 층위의 materialization 여부는 의미적 소속과 독립적인가? virtual Core term과 materialized
    Domain term이 함께 있을 때 동일한 resolution 규칙을 사용할 수 있는가?

<a id="stage-1-source-derived"></a>
### 1.9 Canonical source와 derived artifact

**Proposal**

Knowledge Object의 first-class 지위와 index·projection·closure의 source 지위를 구분한다.
어떤 index row가 Node나 Edge를 설명하거나 object ID를 포함한다는 이유만으로 그 row 자체가
새로운 Knowledge Object 또는 canonical 지식 assertion이 되지는 않는다.

```text
canonical Node/Edge와 승인된 ontology 규칙
                  │
                  └─ 계산 ─> index / projection / closure / validation result
```

Derived artifact는 자신을 만든 canonical source와 규칙에서 결정적으로 다시 계산할 수 있어야
한다는 방향을 기준안으로 둔다. 삭제한 뒤 source-only rebuild로 복구할 수 없는 정보가 derived
layer에만 존재한다면, 그것이 실제 source여야 하는지 또는 source 손실인지 재검토해야 한다.

`durable` 또는 `virtual`은 이 구분에서 object를 직접 다루는지 여부를 뜻하지 않는다. 이는
앞서 설명한 source 지위 후보이며, 다음을 서로 혼동해서는 안 된다.

| 대상 | 현재 논의상 지위 후보 |
| --- | --- |
| 저장된 canonical Node/Edge JSON | source-backed Knowledge Object |
| 명시적으로 선언된 virtual term | 단계 2에서 정할 조건을 만족할 때만 canonical reference 또는 Knowledge Object 후보 |
| index/projection row | 자동으로 Knowledge Object가 되지 않는 derived artifact |
| 계산된 closure 또는 inference | 명시적 승격·materialization 규칙이 없는 한 canonical source assertion이 아님 |

Derived 결과를 canonical source로 승격하거나 독립된 Knowledge Object로 materialize하려면 그
identity, provenance, revision, lifecycle과 재계산 관계를 명시하는 별도 규칙이 필요하다.

#### 상세 논의 질문

1. canonical source의 최소 단위는 JSON object, event/history chain, 선언 registry entry 또는
   이들의 결합 중 무엇인가?
2. source-backed object와 declared virtual term이 같은 ID를 제공하면 충돌인가, materialization
   전환인가? 어떤 equivalence 검사가 필요한가?
3. derived artifact가 “다시 계산 가능”하다는 기준에는 동일한 값뿐 아니라 provenance,
   ordering, validation code와 explanation도 포함되는가?
4. inference 결과를 materialize했을 때 canonical assertion이 되는가, cache된 derived
   assertion으로 남는가? source 승격은 누가 어떤 절차로 승인하는가?
5. derived 결과를 사람이 수정하면 새 explicit assertion으로 전환되는가, 수정 자체를
   금지하는가?
6. source가 삭제·deprecated·invalidated되었을 때 이를 바탕으로 한 projection과 closure의
   invalidation 시점과 stale 처리 원칙은 무엇인가?
7. source-only rebuild의 입력에는 ontology version, bootstrap registry와 permission-independent
   source가 모두 포함되어야 하는가?

<a id="stage-1-boundary"></a>
### 1.10 책임 범위와 구현 경계

**Proposal**

L.W.S. Ontology가 책임지는 범위 후보는 다음과 같다.

1. Knowledge Object, Node와 Edge의 semantic role
2. 의미에 영향을 주는 canonical JSON object grammar
3. Type, Relation, Tag, Property, Definition과 Axiom의 기본 문법
4. reference, relation, constraint, explicit assertion과 derived result의 해석
5. validation, materialization, projection과 query가 지켜야 할 관찰 가능한 contract
6. 동일한 canonical source와 조건에 대한 일관된 기계 해석과 conformance 기준

“애플리케이션 구현 전체를 규정하지 않는다”는 말은 의미를 지닌 JSON 구조까지 범위에서
제외한다는 뜻이 아니다. canonical 해석에 필요한 object shape는 Ontology의 책임이고, 그
shape와 규칙을 어떤 코드 구조로 구현할지는 구현의 책임이다.

#### 경계 판정 기준 후보

어떤 사항이 Ontology의 책임인지 판단할 때 다음 질문을 사용할 수 있다.

1. 같은 canonical source와 context에 대해 선택에 따라 의미 또는 validity가 달라지는가?
2. 다른 consumer가 같은 object를 상호 운용하려면 해당 규칙을 알아야 하는가?
3. source-only rebuild, migration 또는 conformance 판정에 영향을 주는가?
4. identity, reference, lifecycle, provenance, security 또는 observable query 결과에 영향을
   주는가?

하나 이상에 해당하면 ontology 또는 그에 연결된 canonical contract에 포함할 후보가 된다.
단지 성능, 배치, 내부 module 또는 UI 배치만 달라지고 의미와 관찰 가능한 contract가 같다면
구현 선택으로 남길 후보가 된다.

#### 상세 논의 질문

1. query semantics 중 direct/derived 구분, ordering, pagination, ranking과 full-text search는
   각각 ontology contract인가 API contract인가?
2. permission은 ontology vocabulary로 관계를 표현하는 범위와 실제 authorization enforcement
   범위를 어디에서 나눌 것인가?
3. visibility 때문에 읽을 수 없는 object를 reference validation, inference와 cardinality에서
   존재하지 않는 것으로 취급해서는 안 된다는 규칙은 ontology인가 security contract인가?
4. lifecycle 상태(`draft`, `active`, `deprecated`, `archived`, `deleted`)의 의미는 ontology가
   규정하고, 상태 전환 권한과 UI workflow만 애플리케이션이 규정하는가?
5. temporal validity와 audit provenance 중 의미 해석에 필요한 부분과 운영 기록에만 필요한
   부분을 어떻게 구분할 것인가?
6. editor의 default value와 자동 보정은 canonical 의미를 생성할 수 있는가, 단순 authoring
   편의 기능이어야 하는가?
7. materializer의 idempotency와 conflict 결과는 ontology contract인가 실행 contract인가?
   의미적 요구와 구체적인 transaction/retry 구현을 어떻게 분리할 것인가?
8. 외부 RDF/OWL/SHACL 호환성은 core boundary에 포함하는가, 명시적인 후속 adapter 범위로
   남기는가?

<a id="stage-1-goals"></a>
### 1.11 초기 목표와 non-goal

**Proposal**

단계 1의 초기 primary goal은 다음 세 축으로 둔다.

1. **Ontology semantic grammar의 확립**: L.W.S. Ontology가 무엇을 의미하고 무엇을 규정하는지
   정의하며, ontology 전체의 개념, 관계, constraint와 해석 경계를 제공한다. 동일한 승인 규칙이
   적용될 때 conforming consumer가 일관된 의미로 해석하는 것을 이 목표의 성공 기준으로 둔다.
2. **First-class Knowledge Object model과 canonical object grammar의 확립**: Knowledge Object와
   Node/Edge object kind의 관계를 정의하고, 그 모델을 canonical JSON shape, structural
   constraint와 semantic constraint로 표현할 수 있게 한다. Knowledge model은 무엇을 의미하는지
   정하고, object grammar는 그 의미를 어떻게 기록하는지 정하며, JSON Schema와 Semantic
   Validator는 각각 구조와 의미 규칙의 적용 가능한 부분을 집행한다.

   ```mermaid
   flowchart TD
       A["Semantic grammar<br/>무엇을 의미하는가"]
       B["Canonical object grammar<br/>그 의미를 어떻게 기록하는가"]
       C["JSON Schema<br/>구조 규칙을 집행한다"]
       D["Semantic Validator<br/>의미 규칙을 집행한다"]

       A -->|canonical 표현| B
       B -->|structural constraint| C
       B -->|semantic constraint| D
   ```

3. **확장 가능한 Domain Ontology 기반의 확립**: Core semantic grammar를 훼손하지 않으면서
   domain term, relation과 constraint를 추가할 수 있는 확장 경계를 제공한다.

현재는 독립된 선택 사항인 secondary goal을 두지 않는다. 다음 항목은 primary goal을 입증하기
위한 **Canonical 보증 요건**이며, 선택적으로 생략할 수 있는 secondary goal이 아니다.

1. **추적 가능한 규칙 집행**: validation, materialization, projection과 query 결과를 governing
   Decision·Term·Axiom 및 source provenance에 연결할 수 있어야 한다.
2. **설명 가능한 conformance**: 기계와 사람이 적용 규칙과 판정 근거를 확인할 수 있어야 한다.
3. **필요한 derived state의 재구성 가능성**: Canonical 범위에 포함되는 index, projection과
   closure는 canonical source와 적용 규칙에서 다시 만들 수 있어야 한다.

보증 요건의 최소 범위와 관찰 가능한 결과는 관련 의미 규칙이 정해진 뒤 후속 단계에서
구체화한다. 고급 inference, 전체 설명 경로, 대규모 reasoning과 외부 표준 호환은 현재의
secondary goal로 승격하지 않고 아래 non-goal 또는 단계 19의 확장 과제로 관리한다.

#### 일관된 의미 해석의 기준

동일한 canonical source에 동일한 승인된 ontology 규칙 집합을 적용한 conforming consumer는
object kind, semantic role, reference와 assertion/constraint를 동일한 의미로 해석해야 한다는
방향을 기준안으로 둔다. 의미 판정에 필요한 적용 조건은 별도의 `Semantic Context` 개념으로
분리하지 않고 Axiom, Constraint 또는 그 밖의 적용 규칙 안에 명시한다.

여기서 동일한 ontology 규칙 집합은 같은 해석에 적용되는 Decision, Core 규칙과 허용된 Domain
확장 규칙을 뜻한다. 단계 1은 서로 다른 Core Ontology version을 동시에 선택해 사용하는 체계를
전제하지 않는다. 규칙 집합을 specification revision, ontology version, profile 또는 다른
식별 방식 중 무엇으로 재현할지는 단계 4와 단계 15에서 결정한다.

다음은 의미 동일성의 **비규범 예시(설명용 예시)**이며 실제 ID, field 또는 relation 문법을
확정하지 않는다.

```text
지식 대상:
  책 A
  사람 B

선언:
  책 A는 책이다.
  사람 B는 사람이다.
  책 A의 저자는 사람 B다.
```

두 consumer는 `책 A`와 `사람 B`를 지식 대상을 표현하는 Node Knowledge Object로, 두 대상을
연결하는 저자 관계를 관계 assertion을 표현하는 Edge Knowledge Object로 동일하게 해석해야
한다. `책`과 `사람`이 Type semantic role로 선언되었다면 이를 단순 label이나 Tag가 아니라
대상의 종류를 나타내는 Type으로 해석해야 한다. 저자 관계가 사람 B의 canonical ID를 참조하면
같은 이름이나 유사한 slug가 아니라 그 ID의 Knowledge Object를 참조해야 한다. 또한 “책 A의
저자는 사람 B다”라는 관계의 방향과 적용된 source/target role constraint를 서로 반대로
해석해서는 안 된다.

`Valid`, `Invalid`, `Unknown` 같은 판정 상태, direct/derived 지위, provenance와 규범적인
query/projection 결과는 아직 의미가 확정되지 않았으므로 이 단계의 예시로 선결하지 않는다.
해당 규칙은 1.7, 1.12, 1.13과 관련 후속 단계에서 확정한 뒤 관찰 가능한 동일성 범위에
추가한다.

#### Reference domain과 conformance fixture

`Reference domain`과 `conformance fixture`는 별도의 목표가 아니라 primary goal의 달성을
입증하는 상호 보완적인 방법이다.

| 입증 수단 | 정의와 역할 |
| --- | --- |
| Reference domain | 작고 대표적인 domain ontology와 지식 모델을 통해 semantic grammar가 실제로 의미 있는 지식을 표현할 수 있는지 검증한다. |
| Conformance fixture | 고정된 canonical source, 적용 규칙 및 필요한 context와 기대 해석을 묶어 구현이 동일한 규칙을 일관되게 적용하는지 검증한다. |

Reference domain의 구체 사례를 실행 가능한 입력과 기대 해석으로 고정하면 conformance fixture가
될 수 있다. 단계 1에서는 두 수단의 정의와 역할만 정하고, 구체 vocabulary, source fixture와
기대 결과는 의미 규칙을 확정한 뒤 단계 17에서 작성한다.

초기 non-goal 후보는 다음과 같다.

1. 단계 1에서 개별 Type, Relation, Tag, Property 또는 Axiom vocabulary를 확정하는 것
2. 모든 애플리케이션 기능, UI 또는 API 동작을 Ontology로 정의하는 것
3. 물리 파일 layout, database table, cache와 module architecture를 고정하는 것
4. semantic 결과에 영향을 주지 않는 내부 알고리즘을 통일하는 것
5. Specification 논의와 동시에 기존 source, schema 또는 validator를 변경하는 것
6. 첫 Canonical 범위에서 완전한 범용 추론 엔진이나 외부 ontology 표준 호환을 달성하는 것
7. L.W.S.가 기록하지 않은 세계의 모든 사실을 완전하게 표현하거나 참이라고 판정하는 것
8. 단계 1에서 모든 canonical field, 구체적인 JSON Schema fragment, ontology 규칙 집합의
   식별 방식 또는 실제 reference domain fixture를 확정하는 것

#### 남은 상세 논의 질문

1. self-description과 ontology materialization은 최초 Canonical의 필수 목표인가, bootstrap
   fallback을 허용한 뒤 달성할 후속 목표인가?
2. Domain 확장성보다 Core의 폐쇄성과 예측 가능성이 우선되는 지점은 어디인가?
3. explainability에는 rule ID와 provenance만 필요한가, 전체 inference/validation 경로까지
   재현할 수 있어야 하는가?
4. 성능, 대규모 graph reasoning과 외부 federation은 명시적으로 어느 단계까지 non-goal로
   둘 것인가?

<a id="stage-1-inference"></a>
### 1.12 명시적 선언과 자동 추론의 경계

**Proposal**

논의를 위해 지식의 지위를 다음과 같이 구분한다.

| 지위 | 정의 후보 |
| --- | --- |
| Explicit assertion | 사용자 또는 승인된 source mutation이 canonical Node/Edge로 직접 기록한 사실 |
| Inference rule | explicit source와 다른 derived assertion에서 새 결론을 계산하는 versioned ontology rule |
| Derived assertion | inference rule의 평가 결과. provenance와 적용 ontology/context 없이는 독립적인 canonical source가 아님 |
| Materialized derived assertion | 성능이나 조회를 위해 저장한 derived assertion. 별도 승격 규칙이 없으면 여전히 재계산 가능한 derived 지위를 유지함 |

초기 안전 기준 후보는 “선언된 inference rule만 실행하고, inferred 결과는 explicit source와
구분하며, 자동으로 canonical source assertion으로 승격하지 않는다”이다. 허용할 inference
종류와 강제 수준은 아직 정하지 않는다.

#### 상세 논의 질문

1. 최초 Canonical에서 허용할 추론은 subclass, inverse relation, transitive closure와 default
   value 중 어디까지인가? 단계 19로 미룰 추론은 무엇인가?
2. inference rule 자체는 Axiom/Constraint인가, 별도 Rule term인가, code에 연결된 Core
   declaration인가?
3. derived assertion에 source assertion 집합, rule ID/version, evaluation time과 context를 어느
   수준까지 provenance로 보존해야 하는가?
4. explicit assertion과 derived assertion이 충돌하면 explicit가 우선하는가, validation issue를
   발생시키는가, 둘을 동시에 유지하는가?
5. derived assertion끼리 충돌하거나 순환할 때 evaluation ordering, fixed point와 중단 조건을
   어디까지 규정해야 하는가?
6. inference는 monotonic rule로 제한하는가? source 삭제나 negation으로 기존 결론을 철회하는
   non-monotonic rule을 허용하는가?
7. inferred fact가 required relation, permission 또는 blocking validation을 충족하는 근거로
   사용될 수 있는가?
8. 사용자가 inferred 결과를 명시적으로 승인하면 같은 ID의 explicit assertion으로 승격하는가,
   별도의 provenance-bearing assertion을 생성하는가?
9. query consumer가 direct-only, inferred-only 또는 combined view를 선택할 수 있어야 하는가?
10. ontology version 변경 뒤 기존 materialized inference는 언제 invalidated되고 어떻게
    rebuild되는가?

<a id="stage-1-world-assumption"></a>
### 1.13 Open-world와 closed-world 해석 정책

**Proposal**

Open-world와 closed-world를 L.W.S. 전체에 하나로 고정하기보다, 판정 대상과 authoritative
scope별로 명시하는 **혼합 정책**을 논의 기준안으로 둔다.

| 해석 후보 | 의미 |
| --- | --- |
| Open-world | assertion이 없다는 사실만으로 그 assertion이 거짓이라고 결론 내리지 않는다. 결과는 `Unknown`일 수 있다. |
| Closed-world | 완전하다고 선언된 authoritative scope 안에서는 assertion이 없음을 부재 또는 거짓 판정에 사용할 수 있다. |
| Structural closed-world | canonical object shape가 요구하는 field가 없으면 외부에 값이 있을 가능성과 무관하게 구조 위반으로 판정한다. |

초기 후보로는 일반 지식 관계의 부재에는 open-world를, required field와 명시적으로 완전하다고
선언된 profile/scope의 validation에는 closed-world를 적용할 수 있다. 이는 아직 채택된 정책이
아니다.

`Unknown`, `Absent`, `False`와 `Invalid`는 다음처럼 구별할 필요가 있다.

| 상태 후보 | 의미 후보 |
| --- | --- |
| `Unknown` | 참·거짓 또는 존재 여부를 판정할 정보가 충분하지 않음 |
| `Absent` | 완전하다고 선언된 scope에서 값이나 assertion이 존재하지 않음 |
| `False` | 명시적 negative assertion 또는 적용 rule로 거짓이 성립함 |
| `Invalid` | source 또는 assertion이 적용 shape/semantic constraint를 위반함 |

#### 상세 논의 질문

1. world assumption을 ontology 전체, Domain Ontology, Type/Relation/Property profile, 개별
   constraint 또는 query마다 어느 단위로 선언할 것인가?
2. scope가 완전하다고 판정하는 주체와 근거는 무엇인가? workspace, group, temporal window와
   source provider별 완전성을 따로 선언할 수 있는가?
3. permission 때문에 보이지 않는 assertion을 `Absent`로 오판하지 않도록 validation과 query를
   어떤 authority context에서 실행하는가?
4. stale projection이나 부분 index에서 결과가 없을 때 `Unknown`을 반환할 수 있어야 하는가?
5. 명시적 부정은 negative Edge, Property value, Axiom 또는 별도 assertion kind 중 무엇으로
   표현할 것인가?
6. required relation과 cardinality validation은 closed-world scope가 확립된 경우에만 blocking할
   수 있는가?
7. 유효 기간 밖의 assertion은 현재 context에서 `Absent`, `False`, inactive 또는 historical
   truth 중 무엇으로 해석하는가?
8. 서로 다른 source provider가 상반된 assertion을 제공하면 true/false 하나로 합치는가,
   provenance별 복수 주장을 유지하는가?
9. query/API는 `Unknown`, `Absent`, `False`, `Invalid`를 구별해서 반환해야 하는가? 기존 boolean
   consumer와의 Compatibility는 어떻게 제공하는가?
10. open-world에서도 uniqueness, identity collision과 schema required field는 즉시 위반으로
    판정할 수 있음을 어떻게 명시할 것인가?

<a id="stage-1-cross-cutting"></a>
### 1.14 추가 시스템 경계 질문

**Unresolved**

기존 일곱 논의 목적을 대조하면서 다음과 같은 횡단 질문도 확인되었다. 모두 단계 1에서 세부
답을 확정할 필요는 없지만, 의미 경계를 정하고 담당 후속 단계로 이관해야 한다.

| 분류 | 질문 | 경계상 중요성 | 주된 후속 단계 |
| --- | --- | --- | --- |
| `Blocking` | Axiom과 Constraint의 적용 조건을 canonical source 또는 적용 규칙에 어떻게 명시하여 숨겨진 runtime 상태에 따른 의미 차이를 막는가? | “같은 source와 규칙의 같은 의미”를 판정하는 입력 범위를 결정한다. | 단계 8·9·13 |
| `Blocking` | invalid source를 보존하면서 Knowledge Graph 참여를 제한할 수 있는가? | source 보존과 graph validity를 분리한다. | 단계 9·14 |
| `Blocking` | bootstrap code/schema와 materialized ontology가 충돌하면 어느 쪽이 resolver의 authority인가? | self-description과 구현 drift의 경계를 결정한다. | 단계 2·12 |
| `Blocking` | Core namespace와 domain extension point를 누가 소유하고 충돌을 어떻게 막는가? | semantic role의 무제한 확장을 방지한다. | 단계 4·11·15 |
| `Blocking` | ontology change가 기존 instance의 의미를 소급 변경할 수 있는가? | version, migration과 historical interpretation의 기준이 된다. | 단계 4·14 |
| `Blocking` | permission-filtered consumer도 conformance를 판정할 수 있는가, privileged validator만 가능한가? | 숨겨진 metadata 유출 없이 validation 일관성을 유지해야 한다. | 단계 9·11·17 |
| `Blocking` | 하나의 object에 여러 ontology/profile이 적용될 때 충돌 우선순위는 무엇인가? | Domain 결합과 query context의 결정성을 보장한다. | 단계 3·9·13 |
| `Blocking` | conformance의 단위가 object, graph, workspace, implementation 또는 consumer 중 무엇인가? | 테스트 및 Canonical 완료 기준을 구체화한다. | 단계 9·17 |
| `Blocking` | human-readable Definition과 machine-enforceable Axiom이 충돌하면 무엇이 의미 권위인가? | 설명 문구와 실행 규칙의 drift를 방지한다. | 단계 8·9 |
| `Blocking` | ontology가 허용하는 extension이 보안 경계나 permission 의미를 약화시킬 수 있는가? | Domain 확장이 Core safety를 우회하지 못하게 한다. | 단계 6·7·11 |

<a id="stage-1-unresolved"></a>
### 1.15 논의해야 할 사항

**Unresolved**

아래 분류의 `Blocking`은 해당 문제를 해결하지 않은 채 전체 Specification을 Canonical로
승인할 수 없다는 뜻이다. 후속 단계가 지정된 항목은 단계 1에서 문제의 경계와 이관 위치를
합의한 뒤 세부 결정을 해당 단계에서 내릴 수 있다.

| 분류 | 논의할 사항 | 주된 논의 단계 |
| --- | --- | --- |
| `Blocking` | Knowledge Object의 최소 성질을 identity, addressability, revision, lifecycle, semantic role과 source 지위 중 어디까지로 정할지 | 단계 1·2 |
| `Blocking` | `durable source`, `virtual source` 용어를 유지할지와 virtual term의 canonical 지위·권위·identity를 어떻게 정할지 | 단계 2 |
| `Blocking` | Ontology, Knowledge Graph, Schema, Validation과 Projection의 정의·권위·입출력 관계와 invalid source의 graph 지위 | 단계 1·9 |
| `Blocking` | Meta, Core, Domain, Instance와 Derived 층위의 정확한 경계와 한 term이 여러 층위에 관여하는 방식을 어떻게 표현할지 | 단계 1·3 |
| `Blocking` | Type/Tag/Relation role, 이를 나타내는 Core object와 Domain term 사이의 관계를 instance, role assignment 또는 다른 relation 중 무엇으로 표현할지 | 단계 3·5·6 |
| `Blocking` | Core와 Domain Ontology를 무엇으로 materialize하며 virtual term과 materialized object 사이 identity를 어떻게 유지할지 | 단계 2·12 |
| `Blocking` | Knowledge Object 공통 canonical field와 Node/Edge별 field를 어디까지 요구할지. 특히 slug의 공통성, 필수성, 생성, uniqueness와 alias 정책 | 단계 4 |
| `Blocking` | Relation endpoint의 기본 Node-only 정책과 Edge endpoint opt-in을 canonical JSON profile 및 semantic validation에 어떻게 표현할지 | 단계 6 |
| `Blocking` | JSON Schema와 Semantic Validator가 겹치는 규칙의 단일 conformance 판정 및 두 구현이 충돌할 때의 처리 | 단계 7·9 |
| `Blocking` | explicit source assertion과 자동 inference의 경계, 허용 rule, 충돌 우선순위, provenance, derived assertion의 identity와 source 승격 조건 | 단계 1·2·8·13 |
| `Blocking` | 누락된 사실을 `Unknown`, `Absent`, `False`, `Invalid` 중 무엇으로 보는지와 open-world/closed-world 정책을 적용하는 authoritative scope | 단계 1·7·9·13 |
| `Blocking` | 초기 목표의 우선순위, 최초 Canonical의 필수 범위와 측정 가능한 성공·conformance 기준 | 단계 1·17 |
| `Blocking` | 동일한 의미를 판정할 승인 규칙 집합의 식별 방식과 conformance 단위 | 단계 1·4·9·17 |
| `Blocking` | ontology version 변경이 기존 instance와 historical interpretation에 미치는 영향 | 단계 4·14 |

구체적인 schema 파일 구성, validator module, database table, materialization batch 크기와 배포
시점은 semantic contract를 바꾸지 않는 한 단계 1의 결정 대상이 아니다. 필요할 경우 이후
실행안의 `Execution-scoped Unresolved`로 관리한다.

<a id="stage-1-exit-criteria"></a>
### 1.16 Exit Criteria

**Exit Criteria**

단계 1은 다음 조건이 충족되고 `Specification Authority`가 결과를 승인한 뒤 완료된다.

1. L.W.S. Ontology를 semantic grammar로 보는 정의와 적용 범위가 승인되었다.
2. Ontology, Knowledge Graph, Schema, Validation과 Projection의 구분 및 상호 관계가
   승인되었다.
3. Ontology graph, Domain Ontology와 Instance Graph의 층위 및 개념별 통합 논의 방식이
   승인되었다.
4. Knowledge Object와 구별되는 Node/Edge object kind의 관계가 승인되었다.
5. 의미 규칙에 필요한 canonical JSON grammar와 애플리케이션 내부 구현의 책임 경계가
   승인되었다.
6. JSON Schema와 Semantic Validator를 논의 단계가 아니라 집행 책임으로 구분하는 방식이
   승인되었다.
7. 초기 목표, 우선순위, 성공 기준과 non-goal이 승인되었다.
8. canonical source, virtual term과 derived artifact의 기본 지위가 승인되었다.
9. 명시적 assertion과 inference의 경계가 승인되었다.
10. open-world/closed-world 적용 단위와 `Unknown`, `Absent`, `False`, `Invalid`의 구분이
    승인되었다.
11. 단계 1에서 확정하지 않는 세부 쟁점이 적절한 후속 단계로 이관되었다.

현재는 위 조건을 검토하는 중이므로 단계 1을 완료하거나 `Decision`으로 간주하지 않는다.

[목차로 돌아가기](#목차)

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
