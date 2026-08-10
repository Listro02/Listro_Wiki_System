# L.W.S. Group Ontology Migration Plan

작성일: 2026-08-06

상태: proposal; no source migration authorized

이 문서는 Scope와 Collection을 canonical `type.group`으로 통합하기 위한 단계별 plan이다.
[LWS_ONTOLOGY_MODEL.md](../LWS_ONTOLOGY_MODEL.md)의 Current inventory와 Target contract를
전제로 한다.

## 1. Migration boundary

이 plan은 다음 작업을 승인하지 않는다.

- 기존 `scope.*`/`collection.*` Node rename 또는 retype
- permission Edge target/relation 자동 변경
- source JSON 일괄 수정
- `scope.wiki` 삭제 또는 의미 변경
- `scope`/`collection` API parameter 제거
- strict semantic validation 활성화
- core ontology materializer 실행

Source mutation은 dry-run impact, mapping, recovery 절차와 test 결과 검토 뒤 별도 승인한다.

## 2. 목표와 성공 조건

```text
Durable source
  type.group Node
  Group --rel.contains--> Object|Group
  explicit permission Edge
        │
        ├─ rebuild → object_group_memberships
        ├─ evaluate → explainable effective permission
        └─ dual-read → legacy scope/collection API
```

1. membership과 permission grant가 분리된다.
2. direct/transitive membership과 provenance를 설명할 수 있다.
3. legacy data가 migration 중 동일한 query/permission result를 유지한다.
4. `scope.wiki` query와 workspace-wide permission 관계가 명시된다.
5. source Node/Edge는 승인 없이 바뀌지 않는다.
6. SQLite projection은 source에서 완전히 재생성 가능하다.

## 3. Phase G0 — freeze와 read-only inventory

상태: 이번 session에서 문서 수준 완료

수집 대상:

- Type/Tag/Relation usage와 role mismatch
- `type.scope`, `type.collection`, `type.group` Node
- `scope.*`, `collection.*`, `group.*` ID와 Type 조합
- active/inactive `rel.contains`, direction, depth, cycle, 일반 Object intermediate
- capability별 source와 Object/Scope/Collection/Group target
- `scope.wiki` target capability
- direct/transitive multi-Group membership
- Collection-target permission의 effective result
- API/UI의 `scope`, `collection`, `scope.wiki` usage

산출물은 source revision/snapshot과 함께 보존하며 SQLite count만으로 source inventory를
대체하지 않는다. 현재 development baseline은 Node 5, Edge 5,
permission/Scope/Collection/Group 0, legacy membership row 0이다. 작은 sample이므로 synthetic
fixture가 별도로 필요하다.

Exit gate:

- inventory command가 read-only
- source 변경 0건
- unresolved mapping 자동 확정 없음

## 4. Phase G1 — advisory contract validation

Ontology model의 advisory code를 report에 추가하되 기존 mutation을 새 rule로 차단하지 않는다.

1. prefix가 아닌 semantic role resolver를 별도 module로 만든다.
2. canonical `type.group`과 legacy-compatible Group 판정을 분리한다.
3. containment cycle/depth/direction issue를 만든다.
4. permission Relation별 source/target role issue를 만든다.
5. source Edge, membership path, proposed rule을 포함한 dry-run report를 만든다.
6. 기존 `validation_issues`에는 요약을 쓰되 richer report를 잃지 않는다.

Exit gate:

- source 자동 수정 없음
- 동일 source에서 deterministic report
- permission result 변화 0건
- issue별 false-positive review 완료

## 5. Phase G2 — canonical Group projection dual-write

SQLite schema version을 올리고 `object_group_memberships`를 추가한다. 기존
`object_scope_memberships`는 compatibility read model로 유지한다.

Projection rule:

1. canonical Group은 `type.group`으로 판정한다.
2. compatibility mode에서는 legacy Scope/Collection도 Group candidate로 읽는다.
3. direct source는 `Group --rel.contains--> Object|Group`이다.
4. transitive traversal은 Group intermediate만 지난다.
5. repeat Group은 issue를 남기고 branch를 중단한다.
6. depth limit은 issue이며 silent truncation이 아니다.
7. direct/root Edge와 path provenance를 보존한다.

Compatibility strategy:

- 새 evaluator/query는 canonical table을 사용한다.
- old query용 legacy table을 같은 source에서 재생성하거나 compatibility view로 제공한다.
- 두 projection의 normalized legacy subset parity test를 둔다.
- parity mismatch에서는 permission evaluator 전환을 중단한다.

Exit gate:

- full reindex/incremental parity
- current fixture의 legacy query/permission result 동일
- cycle/depth issue test
- SQLite 삭제 후 source-only rebuild 성공

## 6. Phase G3 — API와 URL dual-read

추가 surface:

```text
GET /api/lws/objects?group=<id>
GET /api/lws/timeline?group=<id>
GET /api/lws/timeline?group_by=group
```

- `scope`, `collection`은 deprecated alias로 계속 받는다.
- normalized response에는 canonical `group`과 optional `legacy_filter_kind`를 둔다.
- `group`과 legacy alias가 함께 오면 같은 normalized ID인지 검사한다.
- Frontend는 새 link를 `group`으로 쓰고 old bookmark를 canonical URL로 바꿀 수 있다.
- removal date는 실제 usage inventory 뒤에 결정한다.

`scope.wiki`는 초기에는 global-query sentinel로 유지한다. `workspace.wiki`를 추가하면 query
parity를 검증하고 sentinel 선택이 membership row를 만들지 않게 한다. Permission evaluator의
legacy `scope.wiki` global grant는 이 phase에서 바꾸지 않는다.

Exit gate:

- old/new URL bookmark test
- filter/grouping/coverage parity
- conflicting alias rejection
- permission predicate가 membership filter와 함께 적용되는 test

## 7. Phase G4 — permission compatibility evaluator

Permission decision을 candidate collection과 resolution으로 나눈다.

```text
public / owner / direct / Group / workspace legacy candidates
        ↓
resolution Axiom
        ↓
allow or deny + provenance
```

초기 resolution은 현재와 같은 additive allow-only를 추천한다. deny/priority는 별도 승인 전
평가하지 않으며 `account_permissions.priority`를 conflict rule로 간주하지 않는다.

`can_manage_in`은 먼저 explanation에서 Group management와 member content update를
구분한다. Target-local policy mutation은 self-escalation과 last-manager safety test 뒤에만
검토한다.

Exit gate:

- current M4 permission fixture parity
- direct/Group-derived provenance
- multi-Group any-allow fixture
- `can_manage_in`이 member content update를 암묵 허용하지 않는 target-contract fixture
- missing/stale/corrupt projection fail-closed

## 8. Phase G5 — ontology materialization

기존 Object retype과 분리해 다음 candidate부터 materialize한다.

- `type.group`
- membership과 permission Relation term
- Phase 0에서 ID가 확정된 Definition/Axiom Type과 Relation
- compatibility mapping Definition/Axiom

Materializer는 dry-run create/skip/conflict report, idempotent second run, conflict 보존,
정상 event/history와 실행 후 reindex/validation을 제공해야 한다. Legacy Scope/Collection은
자동 retype하지 않는다.

Exit gate:

- second run source change 0건
- existing conflicting term 보존
- created term role validation 통과
- event/history와 rebuild 검증

## 9. Phase G6 — controlled source migration

| 전략 | 동작 | 적합한 경우 |
| --- | --- | --- |
| compatibility-only | source 유지, reader가 Group으로 해석 | ID 안정성이 가장 중요 |
| retype in place | ID 유지, Type만 `type.group`으로 patch | prefix를 alias로 유지 가능 |
| successor Group | 새 `group.*` Node와 replacement relation | 새 canonical ID 필요 |

자동 rename은 사용하지 않는다. Successor 전략도 기존 Node/Edge를 즉시 삭제하거나
permission target을 자동 교체하지 않고 dual-read와 explicit cutover를 둔다.

각 batch 전 요구 사항:

- affected Object/Edge 목록
- before/after effective permission diff
- Timeline/filter/grouping diff
- broken link/bookmark 영향
- backup과 restore rehearsal
- Curator 승인

## 10. Phase G7 — legacy retirement

다음 조건이 모두 충족될 때만 시작한다.

- legacy-only consumer가 없음
- supported client가 `group` parameter 사용
- `scope.wiki` query/policy split 완료
- compatibility projection 제거 rehearsal 성공
- rollback 가능한 release boundary

제거 순서:

1. UI 신규 생성에서 Scope/Collection option 제거
2. legacy parameter deprecation warning
3. legacy projection/view 제거
4. `type.scope`/`type.collection` virtual acceptance 재검토
5. legacy parameter 제거

## 11. Required test plan

### Validation

- arbitrary Node의 Type/Tag/Relation role mismatch
- legacy prefix/Type mismatch
- permission source/target role mismatch
- self-cycle, cycle, diamond hierarchy, depth limit
- legacy invalid source에 issue만 남고 source mutation 0건

### Projection

- direct depth 1, hierarchy transitive depth 2+
- non-Group intermediate traversal 중단
- multi-Group provenance
- full reindex/incremental parity
- old/new membership projection parity

### Permission

- membership만으로 grant 없음
- direct Object와 Group policy allow
- principal Group-derived capability
- multiple Group additive allow baseline
- `scope.wiki` legacy grant parity와 `scope.system` isolation
- `can_manage_in`/member update 분리
- stale/missing/corrupt fail-closed

### API, Timeline, Frontend

- `group`, `scope`, `collection` dual-read
- old URL bookmark recovery
- filter/grouping/coverage parity
- global sentinel에 membership narrowing 없음
- unreadable Object가 count/coverage/relation에 노출되지 않음
- cursor가 normalized Group query와 index revision에 결합

### Materialization and recovery

- dry-run/execute diff, idempotent second run
- existing ID conflict 보존
- event/history 생성
- backup, reindex, restore rehearsal

## 12. Approval checkpoints

1. Phase 1 conflict model을 additive allow-only로 명시할지
2. `workspace.wiki` 명칭과 first-class Node 여부
3. `scope.wiki` legacy capability replacement
4. target-local `can_manage_in` 범위
5. canonical projection exact schema/provenance
6. legacy Node별 compatibility-only/retype/successor 전략

이 checkpoint 전까지 안전한 다음 구현은 read-only inventory command와 advisory validator다.
