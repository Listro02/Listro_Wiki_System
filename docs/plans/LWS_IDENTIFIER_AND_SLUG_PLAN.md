# L.W.S. ID 및 Slug 계획

작성일: 2026-08-02

## 현재 상태

- 현재 `id`와 `slug`는 ASCII URL-safe 문자만 허용한다.
- `title`, `summary`, `content`에는 한국어/Unicode 텍스트를 사용할 수 있다.
- 한국어 `slug`를 입력하면 `SCHEMA_INVALID`가 발생한다.
- `id`는 storage, edge reference, history, permission, API routing에 쓰이므로 보수적으로 유지하는 편이 안전하다.

## 방향

시스템 식별자와 사람이 읽는 이름을 분리한다.

```text
id    -> 안정적인 시스템 식별자
slug  -> 사람이 읽기 쉬운 route/display 식별자
title -> 자유로운 표시 텍스트
```

향후 권장 방향:

- backend가 UUID/ULID 계열 ID를 자동 생성할 수 있게 한다.
- 필요할 때는 고급 옵션으로 수동 ID 입력도 허용한다.
- Unicode slug는 normalization과 uniqueness 정책을 정한 뒤 허용한다.
- frontend는 title을 바탕으로 slug suggestion을 제공한다.
- edge reference와 history는 slug가 아니라 안정적인 ID를 기준으로 유지한다.

## 나중에 결정할 것

- ID 형식: UUID, ULID, prefixed ULID 중 선택.
- create API에서 `id` 생략을 허용할지 여부.
- slug Unicode normalization 정책. 기본 후보는 NFC.
- slug uniqueness 범위: global, kind별, collection별 중 선택.
- slug 변경 시 이전 slug를 alias/redirect로 남길지 여부.
- frontend UX: 기본은 자동 ID, 수동 ID는 advanced mode로 둘지 여부.

## 구상해둔 것

- ID는 title이 영어라면, 그대로 활용해서 ID를 제공하는 규칙을 만들고, 아니라면 UUID 등을 자동 생성하도록 하면 될거 같음.
- 근데 어차피 ID는 백엔드용이니까 알아서 하는게 나을 듯. (실제 production에서는 title만 보일테니)
- 대신 Slug는 사용자에게 보이니까 한국어도 되도록 해야할거 같음. (이때 고려사항은 여러 가지가 있을거 같네.)