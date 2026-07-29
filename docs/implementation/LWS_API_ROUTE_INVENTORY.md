# L.W.S. API Route Inventory

Created for M6 API Contract And Integration Hardening.

Route rule:

- `/api/lws/**/route.ts` parses HTTP input, resolves request context, calls a service, and maps the service result or `LwsError` to JSON.
- Route files must not access `objectStore`, `eventStore`, `indexStore`, `jobService`, `permissionService`, or `fs` directly.
- Request body/query/route param validation uses the shared route validation helpers.

| Route | Methods | Service boundary | Primary guard | Direct persistence access |
| --- | --- | --- | --- | --- |
| `/api/lws/health` | GET | storage doctor/config adapter | none | no |
| `/api/lws/status` | GET | status service | none | no |
| `/api/lws/session` | GET | session service | context resolution | no |
| `/api/lws/objects` | GET | object query service | permission-aware query predicate | no |
| `/api/lws/objects/:id` | GET | object service | `assertCanRead` | no |
| `/api/lws/objects/:id/backlinks` | GET | graph service | permission-aware graph predicate | no |
| `/api/lws/objects/:id/history` | GET | history service | `assertCanRead` | no |
| `/api/lws/objects/:id/history/:eventId` | GET | history service | `assertCanRead`, safe event id | no |
| `/api/lws/objects/:id/history/:eventId/diff` | GET | history service | `assertCanRead`, safe event id | no |
| `/api/lws/objects/:id/permissions` | GET | object service | `assertCanRead` | no |
| `/api/lws/objects/:id/restore` | POST | mutation service | `assertCanUpdate`, safe event id | no |
| `/api/lws/objects/:id/validation` | GET | object service | `assertCanRead` | no |
| `/api/lws/nodes` | POST | node service | `assertCanCreateIn` | no |
| `/api/lws/nodes/:id` | PATCH, DELETE | node service | `assertCanUpdate` | no |
| `/api/lws/edges` | POST | edge service | `assertCanCreateIn` | no |
| `/api/lws/edges/:id` | PATCH, DELETE | edge service | `assertCanUpdate` | no |
| `/api/lws/search` | GET | object query service | permission-aware query predicate | no |
| `/api/lws/graph` | GET | graph service | permission-aware graph predicate | no |
| `/api/lws/timeline` | GET | timeline service | permission-aware timeline predicate | no |
| `/api/lws/ontology` | GET | ontology service | permission-aware ontology predicate | no |
| `/api/lws/admin/validate` | POST | admin service | `assertCanManageIn(scope.system)` | no |
| `/api/lws/admin/reindex` | POST | admin service | `assertCanManageIn(scope.system)` | no |
| `/api/lws/admin/materialize-core-ontology` | POST | admin service | `assertCanManageIn(scope.system)` | no |
| `/api/lws/admin/backup` | POST | admin service | `assertCanManageIn(scope.system)` | no |
| `/api/lws/admin/check-public-boundary` | POST | admin service | `assertCanManageIn(scope.system)` | no |
| `/api/lws/admin/recovery` | GET | admin service | `assertCanManageIn(scope.system)` | no |
| `/api/lws/admin/recovery/repair` | POST | admin service | `assertCanManageIn(scope.system)` | no |
| `/api/lws/admin/jobs` | GET | admin service | `assertCanManageIn(scope.system)` | no |
| `/api/lws/admin/jobs/:jobId` | GET | admin service | `assertCanManageIn(scope.system)` | no |
| `/api/lws/admin/jobs/:jobId/cancel` | POST | admin service | `assertCanManageIn(scope.system)` | no |

M6 regression owner:

- `npm.cmd run test:milestone-m6`
