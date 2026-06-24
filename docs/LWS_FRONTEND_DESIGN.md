# L.W.S. Frontend Design

## 1. 목적

L.W.S. frontend는 외부 JSON knowledge graph를 다루는 technical workbench이다.

UI의 목표는 예쁜 wiki landing page가 아니라, power user가 다음 작업을 빠르고 안전하게 수행하는 것이다.

```text
browse objects
edit node
edit edge
create relation
create stub
inspect graph
inspect timeline
manage ontology
run validation
check storage/index status
resolve warnings
```

초기 frontend는 실제 데이터 연결보다 mock object를 이용한 정보 구조, 화면 배치, interaction state를 먼저 검증한다.

## 2. Product posture

```text
Product identity:
  L.W.S. - Listro Wiki System

User:
  single technical operator or small trusted team

Mood:
  technical knowledge workbench
  graph-first wiki
  calm, dense, structured, professional

Not:
  blog
  marketing site
  decorative graph demo
  casual note-taking app
```

UI는 Notion보다 technical하고, Obsidian graph보다 structured하며, admin console보다 읽기 좋아야 한다.

## 3. Frontend route structure

권장 App Router 구조:

```text
src/app/
├─ layout.tsx
├─ page.tsx
├─ objects/
│  ├─ page.tsx
│  └─ [id]/page.tsx
├─ graph/
│  ├─ page.tsx
│  └─ [viewId]/page.tsx
├─ timeline/
│  ├─ page.tsx
│  └─ [viewId]/page.tsx
├─ ontology/
│  ├─ page.tsx
│  ├─ tags/page.tsx
│  ├─ types/page.tsx
│  └─ relations/page.tsx
└─ admin/
   ├─ page.tsx
   ├─ storage/page.tsx
   ├─ validation/page.tsx
   └─ indexing/page.tsx
```

초기에는 route별 page가 mock data를 직접 import해도 된다. API 연결이 시작되면 `src/modules/client` 또는 `src/lib/api`로 분리한다.

## 4. App shell

모든 주요 화면은 같은 shell을 공유한다.

```text
Left sidebar:
  Home
  Objects
  Graph
  Timeline
  Ontology
  Admin
  Favorite views

Top command/search bar:
  global object search
  command palette entry
  create node
  create edge
  validation indicator
  autosave/index status

Main content:
  route-specific work area

Right inspector:
  selected object summary
  validation warnings
  recent events
  quick actions
```

shell은 desktop-first로 시작하되, 좁은 화면에서는 sidebar와 inspector를 collapsible panel로 바꾼다.

## 5. Visual system

기본 방향:

```text
theme:
  dark mode first

background:
  neutral dark surface

layout density:
  dense but readable

surface:
  subtle borders
  low elevation
  no decorative card nesting

accent:
  selected node/edge only

status colors:
  active
  draft
  stub
  archived
  deleted
  private
  public
  warning
  error
```

주의:

```text
1. marketing hero를 만들지 않는다.
2. 설명용 장식 그래프를 만들지 않는다.
3. mock data라도 실제 object workbench처럼 보이게 한다.
4. 버튼, 토글, 탭, 메뉴, badge는 일관된 component로 만든다.
5. 화면 안내 문구보다 object 정보와 작업 affordance를 우선한다.
```

## 6. Shared component structure

권장 component layout:

```text
src/components/
├─ layout/
│  ├─ AppShell.tsx
│  ├─ Sidebar.tsx
│  ├─ TopCommandBar.tsx
│  └─ InspectorPanel.tsx
├─ object/
│  ├─ ObjectTable.tsx
│  ├─ ObjectBadges.tsx
│  ├─ ObjectSummary.tsx
│  ├─ ObjectFilters.tsx
│  └─ ValidationWarnings.tsx
├─ node/
│  ├─ NodeHeader.tsx
│  ├─ NodeEditor.tsx
│  ├─ NodeMetadataPanel.tsx
│  ├─ TagEditor.tsx
│  ├─ PropsEditor.tsx
│  └─ LocalGraphPreview.tsx
├─ edge/
│  ├─ EdgeHeader.tsx
│  ├─ RelationEditor.tsx
│  ├─ EvidenceList.tsx
│  └─ EdgePropsPanel.tsx
├─ graph/
│  ├─ GraphExplorer.tsx
│  ├─ GraphCanvas.tsx
│  ├─ GraphFilters.tsx
│  └─ GraphObjectInspector.tsx
├─ timeline/
│  ├─ TimelineExplorer.tsx
│  ├─ TimelineLane.tsx
│  ├─ TimelineFilters.tsx
│  └─ TimelineItemDrawer.tsx
├─ ontology/
│  ├─ TagManager.tsx
│  ├─ TypeManager.tsx
│  ├─ RelationTypeManager.tsx
│  ├─ ViewManager.tsx
│  └─ SettingManager.tsx
└─ admin/
   ├─ StorageDoctorPanel.tsx
   ├─ IndexStatusPanel.tsx
   ├─ ValidationPanel.tsx
   └─ AdminActionsPanel.tsx
```

## 7. Data shape used by UI

초기 UI mock은 backend schema와 같은 shape를 사용한다.

### 7.1 Node

```ts
type LwsNode = {
  schema_version: number
  object_kind: "node"
  id: string
  rev: number
  title: string
  slug: string
  type: string
  detail_mode: "stub" | "note" | "page" | "view" | "system"
  visibility: "private" | "public"
  status: "active" | "draft" | "stub" | "archived" | "deleted"
  tags: string[]
  props: Record<string, unknown>
  temporal: {
    occurred_at: string | null
    valid_from: string | null
    valid_to: string | null
  }
  audit: {
    created_at: string
    updated_at: string
    created_by: string
    updated_by: string
  }
}
```

### 7.2 Edge

```ts
type LwsEdge = {
  schema_version: number
  object_kind: "edge"
  id: string
  rev: number
  source: string
  target: string
  type: string
  title: string
  detail_mode: "stub" | "note" | "page"
  visibility: "private" | "public"
  status: "active" | "draft" | "stub" | "archived" | "deleted"
  tags: string[]
  props: Record<string, unknown>
  temporal: {
    occurred_at: string | null
    valid_from: string | null
    valid_to: string | null
  }
  audit: {
    created_at: string
    updated_at: string
    created_by: string
    updated_by: string
  }
}
```

## 8. Screen design

### 8.1 Home Dashboard

목적:

```text
system status와 최근 작업 흐름을 한 화면에서 파악한다.
```

필수 영역:

```text
Recent Nodes
Recent Edges
Favorite Graph Views
Favorite Timeline Views
Validation Warnings
Storage Status
Index Status
Stub Objects Needing Expansion
```

주요 interaction:

```text
object open
warning open
run validation
open storage doctor
open favorite view
quick create node
quick create edge
```

### 8.2 Object Explorer

목적:

```text
node와 edge를 하나의 object list에서 탐색한다.
```

필수 기능:

```text
combined node/edge table
search by title, id, alias, tag
filter by object_kind
filter by type
filter by tag
filter by visibility
filter by status
filter by detail_mode
stub only toggle
orphan nodes filter
recently updated filter
quick create node
quick create edge
quick create stub node
right inspector for selected object
```

table column:

```text
kind
title
id
type
tags
visibility
status
detail_mode
rev
updated_at
warnings
```

### 8.3 Node Page / Node Editor

목적:

```text
node의 내용, metadata, tag, props, temporal, relation을 한 곳에서 편집한다.
```

필수 panel:

```text
Header:
  title
  id
  type
  detail_mode
  visibility
  status
  rev
  autosave state

Content:
  summary editor
  markdown body editor

Tags:
  tag chips
  tag autocomplete
  create tag as node

Props:
  type-based custom fields
  raw JSON props editor option

Temporal:
  occurred_at
  valid_from
  valid_to

Relations:
  outgoing edges
  incoming edges
  add relation
  create stub target

Local Graph:
  1-hop graph
  optional 2-hop expansion

History:
  rev history
  event log

Validation:
  schema errors
  semantic warnings
  public boundary warnings
```

state:

```text
clean
dirty
autosaving
saved
save failed
rev conflict
validation failed
readonly
```

### 8.4 Edge Page / Relation Editor

목적:

```text
관계를 단순 link가 아니라 설명 가능한 object로 편집한다.
```

초기 구현은 form 기반이다. drag-to-connect는 나중 단계이다.

필수 UI:

```text
Header:
  source node -> relation type -> target node
  edge id
  rev
  visibility
  status
  detail_mode

Relation form:
  source node autocomplete
  relation type selector
  target node autocomplete
  create target as stub option

Content:
  summary editor
  optional markdown content editor

Props:
  weight
  confidence
  direction
  custom props

Temporal:
  occurred_at
  valid_from
  valid_to

Evidence:
  node reference
  edge reference
  URL reference
  file reference

Actions:
  save
  promote edge to page
  archive
  delete
```

### 8.5 Graph Explorer

목적:

```text
object graph를 탐색하고 관계를 이해한다.
```

필수 UI:

```text
large graph canvas
filter panel
selected node/edge inspector
start node selector
max depth selector
relation type toggles
group by type/tag selector
show edge labels toggle
private/public filter
neighbor list
open selected node
open selected edge
create relation from selected node
```

초기 graph는 mock data로 rendering한다. backend index가 생긴 뒤 `/api/lws/graph`로 연결한다.

### 8.6 Timeline Explorer

목적:

```text
edit timeline과 knowledge timeline을 분리해서 본다.
```

mode:

```text
Edit Timeline:
  object가 생성/수정된 시간

Knowledge Timeline:
  object가 설명하는 사건이나 관계의 temporal 정보
```

필수 UI:

```text
mode toggle
date range filter
group by type/tag/user
filter by object_kind
filter by visibility
filter by status
timeline item drawer
warnings for missing temporal fields
single date item
range item
```

### 8.7 Ontology Manager

목적:

```text
tag, type, relation type, view, setting을 wiki object로 관리한다.
```

sections:

```text
Tag Manager:
  list tags
  aliases
  usage count
  merge tags
  parent/child relation

Type Manager:
  list node types
  default fields
  recommended relations
  icon/color

Relation Type Manager:
  directed/undirected
  inverse label
  allowed source types
  allowed target types

View Manager:
  graph view nodes
  timeline view nodes
  query preview

Setting Manager:
  safe wiki behavior settings only
```

ontology 변경은 wiki 구조에 영향을 주므로 warning state와 confirmation dialog가 필요하다.

### 8.8 Admin

목적:

```text
storage, validation, index, backup, role 상태를 운영 관점에서 확인한다.
```

필수 panel:

```text
Storage Doctor:
  knowledge root status
  data root status
  runtime root status
  log root status
  backup root status

Index Status:
  nodes index
  edges index
  graph index
  timeline index
  backlinks index
  ontology index
  last rebuilt time

Validation:
  hard errors
  soft warnings
  curation suggestions

Actions:
  Run Validation
  Rebuild Index
  Materialize Core Ontology
  Create Backup
  Check Public Boundary

Roles:
  viewer
  editor
  curator
  architect
  admin
```

초기 Admin action은 disabled 또는 mock success state로 시작해도 된다.

## 9. Interaction rules

### 9.1 Autosave

node/edge editor는 autosave 상태를 명확히 보여준다.

```text
Idle:
  no local changes

Dirty:
  local changes not saved

Saving:
  request in progress

Saved:
  latest server rev saved

Conflict:
  base_rev mismatch

Failed:
  network or validation error
```

초기 mock UI에서도 이 상태는 표시한다.

### 9.2 Rev conflict

conflict UI는 사용자가 다음 중 하나를 선택할 수 있게 한다.

```text
reload current object
compare local draft and server version
copy local draft to clipboard-style temporary state
cancel edit
```

merge UI는 초기 범위 밖이다.

### 9.3 Creating relation

relation 생성 흐름:

```text
1. source 선택
2. relation type 선택
3. target 검색
4. target이 없으면 stub 생성 선택
5. detail_mode 선택
6. visibility 선택
7. temporal/evidence 선택 입력
8. validation preview
9. save
```

public edge를 만들 때 source/target이 private이면 UI에서 warning을 띄우고 backend에서도 차단한다.

## 10. Accessibility requirements

필수 기준:

```text
semantic layout
keyboard navigable sidebar
keyboard navigable object table
visible focus state
dialog focus trap
escape closes modal/drawer
aria labels for icon-only buttons
form field label and error text 연결
status updates announced where appropriate
color alone must not communicate state
```

graph canvas는 완전한 keyboard graph editing까지 초기 범위에 넣지 않는다. 대신 selected object list와 inspector를 keyboard accessible하게 제공한다.

## 11. Mock data policy

frontend mock은 실제 storage에 쓰지 않는다.

허용:

```text
small inline mock objects
examples/mock-fixtures/mock-nodes.ts
examples/mock-fixtures/mock-edges.ts
read-only story/demo data
```

금지:

```text
실제 private knowledge
실제 server path에 쓰기
repo 내부 live data 생성
production auth 흉내를 실제 보안처럼 취급
```

mock examples는 다음 object를 포함하면 좋다.

```text
app.lws
svc.caddy
type.service
tag.server
rel.depends_on
view.graph.server-infra
view.timeline.server-history
```

## 12. Frontend implementation milestones

### Phase 1 - Static workbench prototype

```text
AppShell
Sidebar
TopCommandBar
InspectorPanel
mock object data
Home Dashboard
Object Explorer
Node Page mock
Edge Page mock
```

### Phase 2 - Editor states

```text
dirty/saved/autosaving states
validation warning display
rev conflict display
relation editor flow
stub creation UI state
```

### Phase 3 - Visual explorers

```text
Graph Explorer mock canvas
Timeline Explorer mock lane
filter panels
selected object inspector
view node selector
```

### Phase 4 - Backend integration

```text
GET objects
GET node/edge
PUT node/edge with base_rev
POST create node/edge
validation API
status API
graph/timeline index API
```

## 13. Frontend non-goals for initial implementation

```text
landing page
public publishing UI
production auth UI
drag-to-connect graph editing
collaborative editing
visual diff merge editor
real database connection
real server data generation
```

