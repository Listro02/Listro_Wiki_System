# L.W.S. Public Release Security Strategy

작성일: 2026-07-31

## 0. 검토 결과

일단 검토를 진행은 함. 다만, 향후 git에 public으로 공개할 때 재 고려할 사항들이 꽤나 많음. 대표적으로 제안된 세부 로직 등이 무엇인지까지는 검토하지 않았음. (ex. CSRF 등 관련 내용이나 여러 가지) 따라서 참고용으로 적합한 문서임.

> 기본적으로 Purpose 자체는 적합하다고 할 수 있겠음.

## 1. Purpose

이 문서는 L.W.S. repository를 향후 open-source처럼 public으로 공개할 때 필요한 보안 기준, 문서 공개 범위, production 접근 정책, 그리고 zero-day/file-access 계열 위험을 정리한다.

핵심 결론은 다음과 같다.

```text
Public repository 자체가 보안 취약점은 아니다.
하지만 public repository는 내부 구조, 운영 surface, known gap을 더 쉽게 관찰하게 만든다.
따라서 production 보안은 코드 은닉이 아니라 인증, 권한, 최소 권한 실행, 데이터 분리, 암호화, 감사, 복구 체계로 보장해야 한다.
```

L.W.S.는 공개 가능한 core software와 private production operation을 분리해야 한다.

## 2. Review Of Public Repository Position

L.W.S.를 public으로 두는 방향은 타당하다. 이 프로젝트는 knowledge object model, JSON source of truth, generated SQLite projection, route/service boundary, permission-aware read model 같은 설계 철학 자체가 공개 가능한 가치가 있다.

다만 현재 repository에는 구현 보고서와 completion review가 매우 상세하다. 공개 시 다음 정보가 공격자에게 surface map처럼 보일 수 있다.

- admin/recovery/backup route와 job surface
- permission, mutation, event/history recovery 내부 구조
- production readiness gap
- 과거 high-risk review 항목
- local/admin bootstrap과 auth baseline 설명
- storage root, backup root, runtime root 구조

따라서 public release 전에는 문서 성격을 나누는 것이 좋다.

| Class | Public repository | Private operation notes |
| --- | --- | --- |
| Product and architecture | 공개 가능 | 필요 시 운영 차이만 별도 기록 |
| API contract | 공개 가능 | 실제 deployment URL, admin policy는 비공개 |
| Data model/schema | 공개 가능 | 실제 private knowledge object는 비공개 |
| Security principles | 공개 가능 | 세부 runbook, incident response는 비공개 |
| Known production gaps | 공개 시 완화된 roadmap 표현 | 상세 risk analysis와 우선순위는 비공개 |
| Deployment paths/secrets | 공개 금지 | private secret manager/runbook에서 관리 |
| Backup/restore procedure | 공개 문서에는 원칙만 | 실제 위치, 주기, key, restore 절차는 비공개 |

## 3. Recommended Public Release Policy

Public release는 "security by obscurity"에 의존하지 않아야 한다. 공격자가 code와 public docs를 읽을 수 있다는 전제에서 production을 설계한다.

공개 repository와 production deployment는 같은 신뢰 경계가 아니다. Public repository는 architecture, contract, contributor workflow를 공유하기 위한 공간이고, production deployment는 private data, secret, backup, incident response, operator runbook을 보호해야 하는 별도 운영 환경이다.

따라서 open-source style 공개의 보안 판단은 다음 문장으로 정리한다.

```text
Code visibility increases attacker knowledge, but it should not grant attacker capability.
Production security must assume the architecture is known and still deny unauthorized access.
```

L.W.S.가 public repository로 운영될 수 있는 조건:

- production private data가 repository에 없고 git history에도 없을 것
- production secret, key, backup, runtime state가 repository와 분리될 것
- private/admin 접근이 production-grade auth와 permission check를 통과할 것
- known gap과 운영 절차가 public docs에 exploit map처럼 남지 않을 것
- deployment는 public default config가 아니라 private production config로만 수행할 것
- incident response와 vulnerability disclosure channel이 명확할 것

공개 유지가 위험해지는 조건:

- production-grade authentication 없이 private data를 연결하는 경우
- local-admin shortcut이나 development secret이 production에 남는 경우
- storage/backup/secret root가 web/static serving 경계와 섞이는 경우
- public docs가 실제 운영 경로, admin 절차, backup 위치, unresolved weakness를 상세히 노출하는 경우
- CI/CD token, deployment key, package publish credential이 repository나 logs에 노출되는 경우
- dependency/framework 취약점 발생 시 process 권한으로 읽을 수 있는 파일 범위가 너무 넓은 경우

권장 운영 모델:

```text
public repository:
  open source code, schemas, public docs, tests, high-level security posture

private deployment:
  production env, secrets, key management, storage roots, backup roots, logs

private operations:
  runbooks, risk register, incident response, restore procedure, admin policy
```

공개 repository에 남겨도 되는 내용:

- L.W.S.의 graph-first wiki 철학
- node/edge/schema/event/projection 개념
- public API의 안정적인 contract
- contributor가 알아야 할 local development flow
- 보안 원칙과 production hardening checklist의 high-level 항목

공개 repository에서 완화하거나 제거할 내용:

- "현재 이 부분이 구체적으로 약하다"는 형식의 취약점 목록
- 실제 운영 경로, 서버명, 도메인, IP, backup path
- admin bootstrap 운영 방식
- recovery/manual repair 상세 절차
- secret/key/session/token 정책의 실제 값이나 생성 절차
- 공격 재현에 가까운 failure injection 설명

필수 공개 전 점검:

1. `.env`, `.env.local`, storage, backup, runtime, SQLite DB, real logs가 git history에 없는지 확인한다.
2. `docs/implementation` 문서를 public summary와 private review로 분리한다.
3. `SECURITY.md`를 추가해 vulnerability disclosure, supported versions, production warning을 명시한다.
4. production deployment는 public repository default config와 분리된 private config로만 실행한다.
5. public 문서의 "known gap" 표현은 "planned hardening area"로 완화한다.
6. 공개 repo와 production instance 사이에 어떤 정보가 공유되고 어떤 정보가 private인지 release checklist로 확인한다.

## 4. Production Access Model

Production에서는 인증되지 않은 접근이 private data에 닿지 못해야 한다. 기본 원칙은 다음과 같다.

```text
anonymous:
  public visibility object와 public read model만 접근 가능

authenticated user:
  로그인된 account의 effective permission에 따라 wiki area별 접근 가능

step-up verified user:
  private/high-sensitivity area 접근 시 추가 인증 후 단기 권한 부여

admin/operator:
  MFA, re-auth, scope.system manage permission, audit logging 필수

system/worker:
  사람이 쓰는 session과 분리된 최소 권한 service identity
```

### 4.1 Login And Session

Production login은 v1 local-admin shortcut과 분리되어야 한다.

필수 조건:

- production에서 `local-script` admin shortcut 비활성화
- secure, httpOnly, sameSite cookie
- session expiry와 rotation
- CSRF protection
- account disabled / permission revoked 상태 반영
- suspicious login detection과 audit trail

인증 수단은 project 상황에 맞게 고를 수 있다.

권장:

- passkey/WebAuthn
- authenticator app TOTP
- trusted device + push approval
- recovery code

주의:

- SMS 인증은 없는 것보다 낫지만 SIM swap, 번호 탈취, 통신사 계정 탈취 위험이 있어 high-sensitivity private data의 유일한 보호 수단으로 쓰지 않는 것이 좋다.

### 4.2 Step-Up Access For Private Data

Private data는 단순 로그인만으로 모두 열리지 않게 area와 sensitivity를 나눈다.

예시:

```text
area.public:
  anonymous read 가능

area.member:
  login 필요

area.private:
  login + object/scope permission 필요

area.sensitive:
  login + permission + recent MFA/phone/passkey step-up 필요

area.admin:
  admin permission + recent MFA + re-auth 필요
```

Step-up access는 "한 번 인증하면 영구 허용"이 아니라 짧은 TTL을 가진 grant로 처리한다.

권장 contract:

- `step_up_verified_at`
- `step_up_method`
- `step_up_expires_at`
- `scope_id`
- `reason`
- immutable audit event

### 4.3 Wiki Area And Permission Scope

L.W.S.의 node/edge permission model은 area 분리에 잘 맞는다.

권장 area 모델:

- `scope.public`
- `scope.member`
- `scope.private`
- `scope.sensitive`
- `scope.system`
- project/domain별 `collection.*`

권한은 object JSON에 embed하지 않고 permission edge/projection으로 유지한다.

예시:

```text
account.alice --rel.can_read_in--> scope.private
group.ops     --rel.can_manage_in--> scope.system
scope.private --rel.contains--> note.private-example
```

Production rule:

1. API route는 절대 storage를 직접 읽지 않는다.
2. Service layer는 모든 read/write/admin action에서 `RequestContext`와 `PermissionService`를 통과한다.
3. Private read는 projection이 stale/corrupt/missing이면 fail-closed 한다.
4. Admin job, recovery, backup은 `scope.system` manage permission과 recent step-up auth를 요구한다.

## 5. Server-Side App Boundary

L.W.S.는 외부 요청자가 URL, query, body 값으로 arbitrary file path를 넣어 storage 밖을 읽는 것을 `PathResolver`, route validation, safe id/ref validator로 막는다. 그러나 이것과 별개로, server-side application code가 직접 `fs`를 import해 storage를 읽도록 작성되면 service/permission boundary를 우회할 수 있다.

이것은 외부 요청자가 곧바로 파일을 읽는 취약점과는 다르다. 서버 코드는 실행될 수밖에 있고, storage/event/index module은 실제로 filesystem을 사용해야 한다. 문제는 filesystem access가 아무 server component, page, route, UI helper에나 퍼지는 것이다.

정상 architecture boundary는 다음과 같다.

```text
page/layout/server component:
  URL params, UI composition, API/service facade call only

API route:
  HTTP parsing, RequestContext resolution, service call, response mapping only

service:
  permission check, validation, mutation/query/admin workflow

store/repository:
  PathResolver를 통과한 filesystem/SQLite access
```

따라서 다음 코드는 금지해야 한다.

```tsx
// forbidden in page.tsx, layout.tsx, route.ts, UI helpers
import fs from "node:fs";

const raw = fs.readFileSync("../storage/knowledge/wiki/nodes/private-note.json", "utf8");
```

금지 이유:

- `RequestContext`가 없다.
- `PermissionService.assertCanRead()`를 통과하지 않는다.
- `PathResolver`와 safe object id 검증을 우회한다.
- audit, error mapping, visibility rule, projection state guard를 우회한다.
- public/private boundary가 UI/page 구현 실수에 의존하게 된다.

허용되는 filesystem access는 좁은 backend internals로 제한한다.

| Area | Filesystem access policy |
| --- | --- |
| `src/modules/storage/**` | 허용. `PathResolver`와 safe path contract를 통과해야 한다. |
| `src/modules/events/**` | 허용. event id/ref/path validator를 통과해야 한다. |
| `src/modules/indexing/**` | 허용. generated SQLite projection과 reindex 범위로 제한한다. |
| `src/modules/backup/**` | 허용. backup root containment와 manifest redaction이 필요하다. |
| `src/modules/jobs/**` | 제한적 허용. runtime job envelope/audit 저장에 한정한다. |
| `src/services/**` | 원칙적으로 직접 `fs` 금지. store/repository를 통해 접근한다. 예외는 명시적으로 문서화한다. |
| `src/app/**` | 직접 `fs`, raw store, raw index, raw event access 금지. |
| frontend/client components | storage access 금지. `/api/lws/*` 또는 route-safe client만 사용한다. |

향후 security milestone에서 추가해야 할 guard:

1. `src/app/**` 전체 static scan 또는 ESLint rule을 추가한다.
2. `page.tsx`, `layout.tsx`, `route.ts`, server component에서 `node:fs`, `fs`, `readFileSync`, `writeFileSync` import/use를 금지한다.
3. `ObjectStore`, `EventStore`, `IndexStore`, `JobStore`, `PathResolver` direct import를 approved composition module 외부에서 금지한다.
4. route-safe facade 또는 server-side service facade를 정의해 page/server component가 같은 경계를 통과하게 한다.
5. scanner fixture test를 추가해 금지 패턴이 실제로 CI에서 잡히는지 검증한다.

이 guard의 목적은 "서버 코드 실행을 막는 것"이 아니다. 목적은 정상 코드가 실수로 service/permission boundary를 우회하지 못하게 하는 것이다.

## 6. Zero-Day And File-Access Risk

Public release에서 가장 중요한 전제는 "코드를 숨기는 것"으로 보안을 보장할 수 없다는 점이다.

특히 file-backed architecture에서는 다음 가능성을 고려해야 한다.

```text
만약 framework, dependency, route handler, template/runtime, upload/import parser 등에 unknown vulnerability가 있고,
그 취약점이 arbitrary file read, path traversal, local file inclusion, RCE로 이어진다면,
공격자는 L.W.S. process가 읽을 수 있는 파일을 읽을 가능성이 있다.
```

이 가능성은 public repo 때문에 새로 생긴다기보다, public repo가 공격자에게 구조를 이해하기 쉽게 만들어 위험 탐색 비용을 낮출 수 있다는 점이 문제다.

따라서 production은 zero-day가 발생해도 피해 범위를 줄이는 구조여야 한다.

Server-side app boundary는 정상 코드 경로의 우회 실수를 줄인다. Zero-day 방어는 그보다 낮은 계층에서, L.W.S. process가 탈취되거나 arbitrary file read가 발생해도 읽을 수 있는 파일과 secret을 최소화하는 문제다.

### 6.1 Blast Radius Reduction

필수 완화책:

- web process OS user를 분리한다.
- app process가 필요한 root만 읽고 쓰도록 filesystem permission을 제한한다.
- secret root와 backup root는 web request 처리 process가 직접 읽지 못하게 한다.
- backup은 가능하면 별도 worker/service identity가 만들고, web app은 backup archive를 직접 serve하지 않는다.
- production storage root는 app repository와 분리한다.
- static file serving root와 knowledge/data root를 절대 겹치지 않는다.
- upload/import 기능이 생기면 quarantine directory와 MIME/size validation을 둔다.

권장 완화책:

- container 또는 OS sandbox
- read-only app code mount
- separate volume for knowledge/data/runtime/backup/secrets
- deny-by-default outbound and filesystem policy
- WAF/rate limit/body size limit
- dependency update and security scan cadence

### 6.2 Encryption And Key Separation

File read zero-day에 대비하려면 "파일을 읽어도 바로 평문 private data가 노출되지 않는 구조"가 필요할 수 있다.

가능한 방향:

- sensitive area object encryption at rest
- envelope encryption
- key encryption key는 OS env file이 아니라 KMS, HSM, platform secret manager, 또는 별도 local key agent에서 관리
- high-sensitivity object decrypt는 recent step-up access가 있을 때만 허용
- backup encryption key는 app runtime secret과 분리

주의할 점:

서버가 request 처리 중 항상 모든 private data decryption key를 메모리에 들고 있다면 file-at-rest encryption의 효과가 제한된다. Encryption은 access control을 대체하지 않으며, key separation과 step-up authorization이 함께 있어야 한다.

### 6.3 Monitoring For Suspicious File Access

Zero-day를 완전히 없앨 수는 없으므로 탐지도 필요하다.

권장 signal:

- unusual 404/path traversal-like request pattern
- repeated `PATH_OUTSIDE_ROOT`
- unexpected admin/recovery endpoint access
- sudden spike in private read attempts
- large export/backup/download behavior
- SQLite/index corruption or repeated recovery events
- process-level unexpected file read if OS/audit tooling supports it

## 7. Public Documentation Strategy

공개 문서에는 다음 문장을 기준으로 삼는다.

```text
The public repository documents the architecture and supported contracts.
Deployment-specific secrets, runbooks, known internal risk assessments,
and incident response procedures are intentionally kept outside the public repository.
```

권장 문서 구조:

```text
docs/
  public architecture and model docs
  public release security strategy
  public production hardening checklist

private operation notes:
  deployment runbook
  backup/restore runbook
  incident response
  known gap/risk register
  secret/key rotation procedure
```

현재 `docs/implementation` 문서는 공개 전 다음 작업이 필요하다.

1. 과거 high-risk review는 historical context로 정리하고, 이미 해결된 항목과 남은 항목을 분리한다.
2. production gap은 "known weakness"가 아니라 "hardening roadmap"으로 표현한다.
3. admin/recovery/backup 세부 운영 절차는 public docs에서 제거하거나 high-level로 완화한다.
4. 실제 운영 config, path, account, secret, backup location은 절대 포함하지 않는다.

## 8. Recommended Next Milestones

Public release와 production readiness를 분리해 진행한다.

### Public Release Preparation

- `SECURITY.md` 작성
- public docs sanitization
- git history secret/data scan
- example config 검토
- implementation reports의 risk wording 완화
- license/contribution policy 결정
- public repository와 private production operation의 정보 분리표 유지

### Production Security Gate

- open-source/public-code threat model review
- server-side app boundary static scan/ESLint rule
- production auth/session/token system
- MFA/passkey/TOTP step-up access
- scope/area-based permission administration
- per-object mutation lock/CAS
- admin route MFA/re-auth
- backup encryption/retention/restore drill
- secret/key separation
- observability and alerting
- load/fault/zero-day blast-radius test

## 9. Conclusion

L.W.S.를 향후 public open-source style repository로 공개하는 방향은 가능하다. 다만 public release와 production deployment를 같은 기준으로 보면 안 된다.

Public release는 architecture와 contributor trust를 위해 열 수 있다. Production deployment는 인증, 권한, step-up verification, OS-level least privilege, encrypted backup, key separation, observability, incident response가 닫힌 뒤에만 private data를 연결해야 한다.

특히 file-backed source-of-truth 구조에서는 두 경계를 함께 닫아야 한다. 첫째, 정상 server-side app code가 직접 filesystem/store를 우회하지 못하게 해야 한다. 둘째, zero-day file access 가능성을 설계상 가정하고 process 권한, storage 분리, 암호화, key 관리, audit, backup policy까지 함께 닫아야 한다.
