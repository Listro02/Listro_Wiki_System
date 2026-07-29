# L.W.S. 선례 조사: node 중심 wiki/knowledge system

조사일: 2026-07-01

이 문서는 L.W.S.의 핵심 철학인 **"의미 있는 모든 것은 node이다"**가 완전히 새로운 발상이 아니라, 여러 wiki/PKM/knowledge graph 계열 도구에서 이미 부분적으로 검증된 패턴임을 정리한다.

목표는 선례를 그대로 따라 하는 것이 아니다. 각 사례에서 L.W.S.에 도움이 되는 설계 원칙과 피해야 할 위험을 뽑아내는 것이다.

## L.W.S. 기준 관점

L.W.S.는 다음 방향을 가진다.

```text
1. 의미 있는 모든 것은 node로 설명 가능해야 한다.
2. edge는 node와 node를 연결하는 1급 관계 object이다.
3. tag, type, relation type, view, account, permission, event/log도 node-like knowledge로 다룰 수 있어야 한다.
4. source of truth는 지정된 L.W.S. storage root 아래의 JSON object file과 event/patch history이다.
5. SQLite/search/graph index는 재생성 가능한 projection이다.
6. frontend보다 backend contract, safety, history, permission boundary가 먼저 안정화되어야 한다.
```

## 요약표

| 사례 | 핵심 단위 | L.W.S.와 닮은 점 | L.W.S.와 다른 점 | 참고 가치 |
| --- | --- | --- | --- | --- |
| TiddlyWiki | tiddler | 거의 모든 것을 작은 정보 단위로 다룬다 | single-file/personal wiki 성격이 강하다 | "모든 것은 node" 철학의 가장 가까운 선례 |
| Wikibase/Wikidata | item/entity/property/statement | item/property/statement 기반으로 세계의 대상을 구조화한다 | structured fact DB에 가깝고 wiki editing/history UX는 다르다 | type/relation/statement를 1급 대상으로 다루는 법 |
| Obsidian | note/link | note graph와 backlinks 중심 탐색 | markdown file 중심, typed object/permission/event contract는 약하다 | graph UI와 local note 탐색의 UX 참고 |
| Logseq/Roam 계열 | page/block/graph | block/page를 graph로 연결하는 networked thought | outliner/PKM 중심이며 backend safety contract는 약하다 | block-level graph UX와 빠른 capture 흐름 |
| Anytype | object/relation/view | object-first, local-first, graph/database view | app/product 중심이며 L.W.S.처럼 app repo 밖의 지정 storage root를 source-of-truth로 삼는 backend 설계는 아니다 | object + relation + view를 한 제품 경험으로 묶는 방식 |
| Dendron | markdown note/schema | local-first, plaintext, schema, backlinks, graph view | developer note IDE에 가깝고 node/edge object model은 약하다 | 점진적 구조화와 refactor 가능한 knowledge base |
| Athens Research | collaborative knowledge graph | graph DB 기반 협업 knowledge graph | 현재 유지보수 중단 | 유지보수/제품화 난이도에 대한 반면교사 |
| RemNote | note/card/knowledge base | note와 학습 단위를 지식 기반에 결합 | 학습/flashcard 중심 | node 기반 지식이 학습 workflow로 확장되는 방향 |

## 1. TiddlyWiki

공식 문서에서 TiddlyWiki의 `tiddler`는 정보의 fundamental unit으로 설명된다. 또한 tiddler는 가능한 작게 유지될수록 여러 방식으로 다시 엮어 재사용하기 좋다고 설명한다. 같은 문서에서는 tiddler가 TiddlyWiki 안에서 code module, setting, UI state까지 저장하는 데 쓰인다고 말한다.

참고:

- [TiddlyWiki - Tiddlers](https://tiddlywiki.com/static/Tiddlers.html)
- [TiddlyWiki GitHub](https://github.com/TiddlyWiki/TiddlyWiki5)

L.W.S.와 닮은 점:

```text
1. 정보의 기본 단위를 작고 재조합 가능한 object로 본다.
2. content뿐 아니라 setting, UI state, code-like object까지 같은 체계 안에 둘 수 있다.
3. "모든 것은 node/tiddler"에 가까운 철학을 실제 제품으로 오래 유지했다.
```

L.W.S.와 다른 점:

```text
1. TiddlyWiki는 개인 wiki/single-file app 성격이 강하다.
2. L.W.S.는 app repo 밖의 지정 storage root에 있는 JSON object source of truth, backend service layer, permission, event history, SQLite projection을 명시한다.
3. TiddlyWiki의 유연함은 강점이지만, L.W.S.는 운영 안전성과 schema contract를 더 강하게 둔다.
```

L.W.S. 설계 교훈:

```text
node는 page만이 아니라 system concept, setting, view, event까지 담을 수 있어야 한다.
다만 모든 것을 자유 형식으로만 두면 backend validation과 permission boundary가 약해질 수 있다.
따라서 L.W.S.는 TiddlyWiki식 확장성을 유지하되 schema, rev, event, index contract로 안전장치를 둔다.
```

## 2. Wikibase / Wikidata

Wikibase DataModel은 Wikibase가 다루는 데이터 구조를 설명한다. 문서에서는 Wikibase data model이 real world entities를 설명하기 위한 metamodel/ontology를 제공한다고 설명한다. Wikidata에서는 어떤 "thing"이 `Item`으로 표현되고, 그 item에 statement를 붙여 사실을 기록한다. `Property`도 별도의 entity처럼 다룬다.

참고:

- [Wikibase/DataModel](https://www.mediawiki.org/wiki/Wikibase/DataModel)

L.W.S.와 닮은 점:

```text
1. 세계의 대상을 identity가 있는 entity/item으로 표현한다.
2. property/relation 자체도 모델 안에서 중요하게 다룬다.
3. item에 label, description, statement, reference를 붙여 설명 가능한 지식으로 만든다.
```

L.W.S.와 다른 점:

```text
1. Wikibase는 structured fact와 statement 중심이다.
2. L.W.S.는 wiki page, editor workflow, event/patch history, private knowledge 관리가 더 중요하다.
3. Wikibase는 RDF/JSON serialization과 public knowledge base 성격이 강하지만, L.W.S.는 env로 지정된 storage root와 permission boundary를 우선한다.
```

L.W.S. 설계 교훈:

```text
type, relation type, property-like concept는 단순 enum보다 node로 다루는 편이 좋다.
edge가 단순 링크로 끝나지 않고 evidence, temporal, reference를 가져야 하는 이유도 Wikibase의 statement/reference 모델에서 확인할 수 있다.
```

## 3. Obsidian

Obsidian Graph view 공식 도움말은 graph view가 vault 안 note 사이의 관계를 시각화한다고 설명한다. graph에서 circle은 note 또는 node를, line은 internal link를 나타낸다.

참고:

- [Obsidian Help - Graph view](https://obsidian.md/help/plugins/graph)

L.W.S.와 닮은 점:

```text
1. note를 node로 보고 link를 edge처럼 시각화한다.
2. local graph, backlinks, graph filtering 같은 탐색 UX가 중요하다.
3. 파일 기반 knowledge를 graph로 보는 사용자 경험이 검증되어 있다.
```

L.W.S.와 다른 점:

```text
1. Obsidian은 markdown note와 internal link 중심이다.
2. L.W.S.는 typed node/edge JSON, permission, event log, generated index를 backend contract로 둔다.
3. Obsidian의 graph는 주로 탐색 UI이고, L.W.S.의 graph는 backend read model과 permission-aware query의 결과이다.
```

L.W.S. 설계 교훈:

```text
graph UI는 화려한 전체 그래프보다 active node 주변 local graph, backlinks, filter가 먼저 중요하다.
frontend 첫 구현도 완성형 graph editor보다 backend projection 검증용 graph explorer가 더 적합하다.
```

## 4. Logseq / Roam 계열

Logseq는 GitHub README에서 privacy-first, open-source knowledge management and collaboration platform으로 소개된다. 최근 Logseq DB version은 DB graph를 도입하고 있으며, graph 간 sync와 collaboration도 실험하고 있다.

Roam Research는 "networked thought"를 전면에 내세운 note-taking tool이다. Roam/Logseq 계열은 page와 block을 연결해 생각의 네트워크를 만드는 쪽에 강하다.

참고:

- [Logseq GitHub](https://github.com/logseq/logseq)
- [Roam Research](https://roamresearch.com/)

L.W.S.와 닮은 점:

```text
1. knowledge를 선형 문서보다 graph/network로 본다.
2. 빠른 capture, backlink, block/page reference가 중요하다.
3. 작은 단위의 지식 조각이 서로 연결되며 의미가 생긴다.
```

L.W.S.와 다른 점:

```text
1. Logseq/Roam은 outliner와 block-level note-taking UX가 중심이다.
2. L.W.S.는 block editor보다 node/edge object contract, storage safety, event history가 중심이다.
3. L.W.S.는 "작성 경험"보다 "지정 storage root의 JSON 지식 데이터를 안전하게 운영하는 backend layer"를 먼저 세운다.
```

L.W.S. 설계 교훈:

```text
capture UX는 중요하지만 초기 구현의 중심이 되면 backend model이 흔들릴 수 있다.
L.W.S.는 block-level editing보다 node-level identity, relation, history, permission을 먼저 고정해야 한다.
```

## 5. Anytype

Anytype 공식 사이트는 "single objects, infinite possibilities"와 graph/database views를 강조한다. 또한 local-first, private, user-owned data 방향을 강하게 내세운다.

참고:

- [Anytype](https://anytype.io/)

L.W.S.와 닮은 점:

```text
1. object-first knowledge management에 가깝다.
2. graph view와 database view를 같은 object layer 위에서 제공한다.
3. user-owned data, local/offline-first 성격이 있다.
```

L.W.S.와 다른 점:

```text
1. Anytype은 완성형 productivity/collaboration app의 제품 경험이 중심이다.
2. L.W.S.는 app repo와 live data storage를 강하게 분리한다.
3. L.W.S.는 app repo 밖의 지정 storage root, JSON object file, event/patch history, service pipeline, generated SQLite projection을 명시적인 backend contract로 둔다.
```

L.W.S. 설계 교훈:

```text
object, relation, view를 같은 mental model로 묶는 것은 사용자에게 강력하다.
하지만 L.W.S.는 제품 UX보다 source-of-truth와 mutation/history contract를 먼저 안정화해야 한다.
```

## 6. Dendron

Dendron은 공식 wiki에서 open-source, local-first, markdown-based note-taking tool로 설명된다. 또한 개발자와 IDE 중심 knowledge base이며, gradual structure, schema, backlinks, graph view, refactor를 강조한다.

참고:

- [Dendron Wiki](https://wiki.dendron.so/)

L.W.S.와 닮은 점:

```text
1. local-first knowledge base를 지향한다.
2. plaintext/markdown 기반이지만 schema와 구조화도 지원한다.
3. backlinks, graph view, refactor 가능한 지식 구조를 중요하게 본다.
```

L.W.S.와 다른 점:

```text
1. Dendron은 developer note IDE에 가깝다.
2. hierarchy와 markdown workflow가 중심이고, L.W.S.처럼 node/edge source object와 event history를 핵심 모델로 삼지는 않는다.
3. L.W.S.는 wiki app이면서 동시에 backend-managed object graph이다.
```

L.W.S. 설계 교훈:

```text
처음부터 완전한 ontology를 강제하기보다 gradual structure가 필요하다.
node type, relation type, tag, scope는 schema로 검증하되 사용자가 나중에 refactor할 수 있어야 한다.
```

## 7. Athens Research

Athens Research는 open-source collaborative knowledge graph였지만 현재는 actively maintained 상태가 아니다. GitHub README는 Athens가 graph database 기반으로 복잡한 domain knowledge를 capture/synthesize하는 도구였다고 설명한다.

참고:

- [Athens Research GitHub](https://github.com/athensresearch/athens)

L.W.S.와 닮은 점:

```text
1. collaborative knowledge graph를 지향했다.
2. graph database 기반으로 knowledge를 map하고 communicate하는 방향을 가졌다.
3. Roam 계열 graph note app의 open-source 실험이었다.
```

L.W.S.와 다른 점:

```text
1. Athens는 graph DB/app product로 접근했다.
2. L.W.S.는 별도 graph DB를 v1 non-goal로 두고, 지정 storage root의 JSON object source + SQLite projection으로 시작한다.
3. L.W.S.는 backend safety, event history, permission boundary를 먼저 세운다.
```

L.W.S. 설계 교훈:

```text
graph knowledge app은 UX와 데이터 모델이 빠르게 복잡해진다.
초기부터 실시간 협업, graph DB, rich frontend를 모두 잡으려 하면 유지보수 부담이 커질 수 있다.
L.W.S.는 backend core를 먼저 안정화하고 thin workbench UI로 검증하는 전략이 더 적합하다.
```

## 8. RemNote

RemNote는 note-taking, PDF annotation, flashcard, spaced repetition을 결합한 학습 중심 knowledge base를 제공한다. 공식 사이트는 "A Knowledge-Base for Life"를 강조하고, notes와 flashcards가 함께 학습 이해를 만든다고 설명한다.

참고:

- [RemNote](https://www.remnote.com/)

L.W.S.와 닮은 점:

```text
1. note를 장기 지식 기반의 일부로 본다.
2. 지식 단위가 학습/복습 workflow와 연결된다.
3. table/database와 note가 같은 제품 경험 안에 들어간다.
```

L.W.S.와 다른 점:

```text
1. RemNote는 학습과 spaced repetition 중심이다.
2. L.W.S.는 knowledge object, relation, event/history, permission, backend storage가 중심이다.
3. flashcard나 learning workflow는 L.W.S.의 v1 core가 아니다.
```

L.W.S. 설계 교훈:

```text
L.W.S.의 node가 충분히 안정화되면 학습 card, reminder, review schedule 같은 것도 node/edge로 확장할 수 있다.
하지만 초기에는 learning feature보다 object graph와 history contract를 먼저 완성한다.
```

## 종합 판단

L.W.S.의 "모든 것은 node이다" 철학은 완전히 새로운 발상이 아니다. 이미 다음 계열에서 각각 부분적으로 검증되어 있다.

```text
TiddlyWiki:
  everything-as-small-reusable-information-unit

Wikibase:
  entity/property/statement as structured knowledge model

Obsidian/Logseq/Roam:
  notes/blocks/pages as graph nodes

Anytype:
  object-first product experience with graph/database views

Dendron:
  local-first structured knowledge base with gradual schema

Athens:
  open-source collaborative graph knowledge app as cautionary example
```

L.W.S.의 독자성은 다음 조합에 있다.

```text
1. node-centered wiki philosophy.
2. edge as first-class relationship object.
3. JSON object source of truth under configured L.W.S. storage roots outside the app repo.
4. append-only event and patch history.
5. generated SQLite read model rather than canonical database.
6. backend-first safety, permission, validation, and recovery contract.
7. thin workbench frontend before full product UX.
```

따라서 현재 전략은 타당하다.

```text
Backend contract first.
Thin frontend workbench second.
Full frontend product UX after the object/history/index/permission model is stable.
```

## L.W.S.에 반영할 설계 원칙

1. `node`는 page보다 넓은 개념이다.
2. `edge`는 단순 link가 아니라 history와 permission을 가질 수 있는 관계 object이다.
3. `type`, `relation type`, `tag`, `view`, `scope`, `account`, `permission`, `event`는 모두 node-like knowledge로 다룰 수 있어야 한다.
4. graph UI는 전체 우주를 보여주는 것보다 active node 주변 context를 잘 보여주는 것이 먼저다.
5. capture/editor UX보다 source-of-truth, event/history, permission, index contract가 먼저다.
6. graph database는 v1 필수가 아니다. SQLite projection과 재생성 가능한 index로 충분히 시작할 수 있다.
7. schema는 강제하되, Dendron식 gradual structure처럼 나중에 refactor할 수 있어야 한다.
8. 모든 선례가 보여주는 공통 위험은 "유연함이 커질수록 일관성과 복구성이 약해진다"는 점이다. L.W.S.는 이 문제를 backend contract로 막아야 한다.
