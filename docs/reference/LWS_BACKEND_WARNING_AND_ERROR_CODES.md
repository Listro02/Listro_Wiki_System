# L.W.S. Backend Warning And Error Codes

작성일: 2026-07-30

## 1. 목적

이 문서는 backend가 노출하거나 기록하는 code 값을 한 곳에서 추적하기 위한 기준 문서다.

용어 정의는 [LWS_GLOSSARY.md](./LWS_GLOSSARY.md)를 함께 참조한다.

LWS backend code는 크게 두 종류다.

| 분류 | 저장/전달 위치 | 의미 |
| --- | --- | --- |
| LWS error code | API response, thrown `LwsError`, mutation warning | 요청을 계속 처리할 수 없거나 read model 상태가 API 수행 조건을 만족하지 않음 |
| Validation warning code | SQLite `validation_issues.code`, admin validation report | source JSON/event/history/index projection에서 발견한 복구 또는 점검 대상 |

M3에서 추가된 projection consistency code는 대부분 validation warning code다. 이 값들은 HTTP error가 아니라, reindex/admin validation 결과에서 운영자가 확인해야 하는 진단 신호다.

## 2. LWS Error Codes

| Code | HTTP Status | 주요 발생 위치 | 의미 | 일반 대응 |
| --- | ---: | --- | --- | --- |
| `EVENT_APPEND_FAILED` | 500 | mutation/event commit | object write 이후 event, patch, history, head durable record 완료에 실패 | recovery report 확인 후 repair 또는 manual repair |
| `INDEX_STALE` | 503 | query `openReady()`, mutation warning | source mutation은 성공했지만 SQLite projection이 최신 상태가 아님 | admin reindex 실행 |
| `INDEX_REBUILD_REQUIRED` | 503 | query `openReady()`, status | SQLite DB가 없거나 아직 build되지 않음 | admin reindex 실행 |
| `INDEX_CORRUPT` | 503 | query/reindex/status | SQLite 파일이 열리지 않거나 schema read가 실패함 | corrupt file 격리 후 reindex |
| `INDEX_SCHEMA_MISMATCH` | 503 | query/status | SQLite schema version이 현재 backend와 맞지 않음 | migration 또는 full reindex |

`INDEX_*` code는 query service가 stale/corrupt/missing projection을 정상 read model처럼 사용하지 못하게 막는 fail-closed contract다.

## 3. Projection Validation Warning Codes

### Event Log

| Code | 감지 조건 | 영향 | 일반 대응 |
| --- | --- | --- | --- |
| `EVENT_LOG_INVALID` | `data/events/**/*.jsonl` row가 JSON parse 또는 event shape 검증에 실패 | 해당 global event row가 `events` projection에 들어가지 않음 | event log 원본 확인, backup/recovery 판단 |
| `EVENT_REF_MISSING` | object history row의 `event_id`가 global event projection에 없음 | 해당 history row가 `object_history` projection에 들어가지 않음 | global event log 누락 여부 확인 |
| `EVENT_REF_INVALID` | `event_ref`가 `events/YYYY/MM/DD.jsonl` 형식이 아니거나 expected event file과 불일치 | unsafe 또는 잘못 연결된 history row 차단 | history row와 global event location 확인 |
| `EVENT_BYTE_OFFSET_INVALID` | `byte_offset`이 음수/비정수이거나 global event file의 해당 row가 `event_id`와 불일치 | history lookup의 direct event reference 신뢰 불가 | history row를 event log 기준으로 재생성 또는 manual repair |

### Object History And Patch

| Code | 감지 조건 | 영향 | 일반 대응 |
| --- | --- | --- | --- |
| `OBJECT_HISTORY_INVALID` | `data/history/{nodes,edges}/.../events.jsonl` row가 JSON parse 또는 shape 검증에 실패 | 해당 history row가 projection에서 제외됨 | object history JSONL 복구 |
| `OBJECT_HISTORY_PATH_MISMATCH` | global event의 `object_history_path`가 실제 history file과 불일치 | event/history 양방향 참조 불일치 | global event와 object history link 중 source 신뢰 판단 |
| `PATCH_PATH_INVALID` | history row의 `patch_path`가 safe `patches/event.YYYYMMDD.HEX.json` 형식이 아님 | patch replay/restore source로 사용하면 안 됨 | unsafe path 제거 후 repair |
| `PATCH_PATH_MISSING` | history row가 가리키는 patch record 파일이 없음 | diff/restore 수행 불가 | patch record 복구 또는 manual repair |
| `PATCH_PATH_MISMATCH` | global event `patch_path`와 object history `patch_path`가 같은 patch record를 가리키지 않음 | event와 history가 서로 다른 patch를 참조 | event/history/patch record 대조 |

### Mutation Head And Current Object

| Code | 감지 조건 | 영향 | 일반 대응 |
| --- | --- | --- | --- |
| `MUTATION_HEAD_MISSING` | history directory에 `head.json`이 없음 | latest rev/hash 신뢰 불가 | event/history tail 기준 head 재생성 또는 manual repair |
| `MUTATION_HEAD_INVALID` | `head.json` parse 또는 shape 검증 실패 | latest rev/hash 신뢰 불가 | head record 복구 |
| `MUTATION_HEAD_KIND_MISMATCH` | history directory kind와 head `object_kind` 불일치 | 잘못된 history directory에 head가 있음 | storage layout 점검 |
| `MUTATION_HEAD_EVENT_MISSING` | head `latest_event_id`가 global event projection에 없음 | head가 event log와 연결되지 않음 | event log 누락 또는 head stale 여부 확인 |
| `MUTATION_OBJECT_MISSING` | head가 가리키는 current object JSON이 없음 | 현재 object와 history 연결 불가 | object JSON 복구 또는 tombstone 정책 확인 |
| `MUTATION_OBJECT_KIND_MISMATCH` | current object kind와 head `object_kind` 불일치 | object/history kind contract 위반 | object id collision 또는 잘못된 파일 위치 확인 |
| `MUTATION_REV_MISMATCH` | current object `rev`와 head `current_rev` 불일치 | latest revision 판단 불가 | object JSON과 head 중 최신 source 확인 |
| `MUTATION_HASH_MISMATCH` | current object hash와 head `latest_hash` 불일치 | object JSON이 event/history commit 이후 변경됐거나 head가 stale | mutation recovery/admin validation 확인 |

## 4. Index Metadata Keys

M3 기준 reindex 성공 시 다음 metadata가 `index_meta`에 기록된다.

| Key | 값 예시 | 의미 |
| --- | --- | --- |
| `schema_version` | `3` | SQLite schema version |
| `index_state` | `ready` / `INDEX_STALE` | query 가능 상태 또는 stale 상태 |
| `index_stale_reason` | `incremental event/history projection update failed` | stale 전환 원인 |
| `last_reindex_status` | `succeeded` | 마지막 reindex 결과 |
| `last_successful_build_id` | `indexbuild.20260730.ABCDEF123456` | 마지막 성공 build id |
| `last_successful_build_finished_at` | ISO datetime | 마지막 성공 build 종료 시각 |
| `last_reindex_warning_count` | `0` | 마지막 reindex warning issue 개수 |
| `search_mode` | `fallback_like` | 현재 search implementation mode |

`index_builds.build_id`와 `index_meta.last_successful_build_id`는 같은 successful build를 가리켜야 한다.

## 5. 운영 해석 규칙

- `LwsError` code는 API 요청 처리 결과다. client는 HTTP status와 함께 처리한다.
- `validation_issues.code`는 reindex/admin validation 진단 결과다. source mutation을 자동 rollback하지 않는다.
- projection warning이 존재해도 SQLite DB 자체는 `ready`일 수 있다. 이 경우 read API는 사용 가능하지만 admin validation report를 확인해야 한다.
- `INDEX_STALE`은 generated read model이 source of truth를 따라가지 못했다는 뜻이다. source JSON/event/history를 보존한 뒤 reindex로 복구한다.
- `MUTATION_*` warning은 M2 recovery와 M3 projection validation 양쪽에서 볼 수 있다. M2는 mutation journal/head consistency를 중심으로 보고, M3는 SQLite projection 재생성 중 source/event/history 불일치를 기록한다.
