# L.W.S. Props Convention

작성일: 2026-08-05

## 1. 목적

`props`는 Type별 custom field를 담는 자유 확장 영역이다. Core schema는 일반 property의 이름과 의미를 추론하지 않는다. 다만 Timeline에서 사용할 custom time은 검색·validation·projection을 위해 이 문서의 **Inline temporal wrapper** convention을 명시적으로 사용한다.

일반 scalar가 날짜처럼 보여도 자동으로 시간으로 간주하거나 SQLite에 projection하지 않는다.

## 2. Inline temporal wrapper

`props` 아래의 object가 `$temporal` key를 가지면 temporal wrapper다.

```json
{
  "props": {
    "release": {
      "$value": {
        "version": "1.0",
        "channel": "stable"
      },
      "$temporal": {
        "kind": "point",
        "at": "2026-08-03"
      }
    }
  }
}
```

- `$value`는 optional이며 임의 JSON을 담는다.
- `$temporal`은 required reserved key다.
- wrapper에는 `$value`, `$temporal` 이외의 sibling을 두지 않는다.
- wrapper는 `props`의 nested object에 둘 수 있다.
- array 내부 wrapper는 v1에서 지원하지 않는다.
- wrapper container의 JSON Pointer가 custom Timeline basis가 된다. 위 예의 path는 `/props/release`다.
- JSON Pointer segment의 `~`와 `/`는 RFC 6901 방식으로 `~0`, `~1` escape한다.

## 3. Point와 Interval

Point는 한 시점을 표현한다.

```json
{
  "$value": "v1.0",
  "$temporal": {
    "kind": "point",
    "at": "2026-08-03T15:00:00+09:00"
  }
}
```

Interval은 시작과 종료를 표현한다.

```json
{
  "$value": "supported",
  "$temporal": {
    "kind": "interval",
    "start": "2026-08-03",
    "end": null
  }
}
```

- 허용 값은 ISO full-date, offset/Z datetime, `null`이다.
- point의 `at=null`은 declared but undated다.
- interval의 한쪽 null은 open interval이다.
- interval의 양쪽 null은 declared but undated다.
- 두 endpoint가 있으면 `start <= end`여야 한다.
- number epoch source와 timezone 없는 local datetime은 v1에서 허용하지 않는다.

## 4. Validation과 Projection

신규 mutation의 malformed wrapper는 `SCHEMA_INVALID`로 거부한다. Reindex가 발견한 legacy malformed wrapper는 validation issue로 기록하고 dated Timeline에서 제외한다.

유효하거나 명시적으로 undated인 wrapper만 `timeline_property_values`에 object ID, property path, kind, raw time, normalized key, precision으로 projection한다. `$value`는 projection하지 않는다. SQLite row는 L.W.S. Node가 아니며 source JSON에서 재생성 가능한 read model이다.

```text
Source Node/Edge JSON
  → explicit $temporal wrapper 추출
  → date/datetime normalization
  → timeline_property_values
  → permission-aware Timeline query
```

일반 property는 projection 대상이 아니다.

```json
{
  "props": {
    "description": "2026-08-03",
    "port": 3000
  }
}
```

위 `description`은 문자열 형식이 날짜와 같아도 wrapper가 아니므로 Timeline index에 들어가지 않는다.

## 5. Timeline API

```text
GET /api/lws/timeline?basis=custom&time_path=/props/release
```

Backend는 selected path와 `timeline_property_values.property_path`를 parameter binding으로 JOIN한다. Wrapper의 `kind`가 각 item의 point/interval position을 결정한다. 같은 path의 결과에 두 kind가 함께 존재할 수 있다.

Path가 없는 object는 `missing`, wrapper가 null time을 선언하면 `undated`, legacy malformed wrapper는 `invalid` coverage로 집계한다. 모든 count는 현재 viewer의 permission과 비시간 filter를 적용한 뒤 계산한다.

## 6. Ontology 확장

이번 convention은 instance가 직접 `$temporal`을 선언한다. 향후 Ontology 시스템은 Type 또는 Definition node에서 허용 property path, point/interval kind, value shape를 선언하고 instance wrapper를 validation할 수 있다. Type-level declaration과 saved Timeline View는 현재 convention의 source shape를 변경하지 않는 후속 materialization이다.
