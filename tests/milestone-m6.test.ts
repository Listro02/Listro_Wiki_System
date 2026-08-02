import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadRuntimeConfig } from "../src/modules/config/runtime-config.ts";
import { IndexStore } from "../src/modules/indexing/index-store.ts";
import { ReindexCommand } from "../src/modules/indexing/reindex-command.ts";
import { ObjectStore } from "../src/modules/storage/object-store.ts";
import { PathResolver } from "../src/modules/storage/path-resolver.ts";
import { getStorageBootstrapPlan } from "../src/modules/storage/storage-doctor.ts";
import { ValidationService } from "../src/modules/validation/validation-service.ts";
import type { LwsEdge, LwsNode } from "../src/shared/object-model.ts";

const nodesRoute = await import("../src/app/api/lws/nodes/route.ts");
const nodeByIdRoute = await import("../src/app/api/lws/nodes/[id]/route.ts");
const objectByIdRoute = await import("../src/app/api/lws/objects/[id]/route.ts");
const objectsRoute = await import("../src/app/api/lws/objects/route.ts");
const searchRoute = await import("../src/app/api/lws/search/route.ts");
const graphRoute = await import("../src/app/api/lws/graph/route.ts");
const timelineRoute = await import("../src/app/api/lws/timeline/route.ts");
const ontologyRoute = await import("../src/app/api/lws/ontology/route.ts");
const backlinksRoute = await import("../src/app/api/lws/objects/[id]/backlinks/route.ts");
const historyRoute = await import("../src/app/api/lws/objects/[id]/history/route.ts");
const historyEventRoute = await import("../src/app/api/lws/objects/[id]/history/[eventId]/route.ts");
const historyDiffRoute = await import("../src/app/api/lws/objects/[id]/history/[eventId]/diff/route.ts");
const permissionsRoute = await import("../src/app/api/lws/objects/[id]/permissions/route.ts");
const restoreRoute = await import("../src/app/api/lws/objects/[id]/restore/route.ts");
const validationRoute = await import("../src/app/api/lws/objects/[id]/validation/route.ts");
const adminBackupRoute = await import("../src/app/api/lws/admin/backup/route.ts");
const adminJobsRoute = await import("../src/app/api/lws/admin/jobs/route.ts");
const adminJobRoute = await import("../src/app/api/lws/admin/jobs/[jobId]/route.ts");
const adminJobCancelRoute = await import("../src/app/api/lws/admin/jobs/[jobId]/cancel/route.ts");
const adminReindexRoute = await import("../src/app/api/lws/admin/reindex/route.ts");
const adminRecoveryRoute = await import("../src/app/api/lws/admin/recovery/route.ts");
const adminValidateRoute = await import("../src/app/api/lws/admin/validate/route.ts");

assertRouteBoundaryScan();

const validationFixture = createFixture("validation");
installEnv(validationFixture.env);
await assertErrorResponse(
  await nodeByIdRoute.PATCH(
    request("http://lws.local/api/lws/nodes/note.invalid", { method: "PATCH", body: "{" }),
    routeContext({ id: "note.invalid" })
  ),
  "SCHEMA_INVALID",
  422
);
await assertErrorResponse(
  await nodeByIdRoute.PATCH(
    request("http://lws.local/api/lws/nodes/note.invalid", {
      method: "PATCH",
      body: JSON.stringify({ base_rev: 0, patch: [] })
    }),
    routeContext({ id: "note.invalid" })
  ),
  "SCHEMA_INVALID",
  422
);
await assertErrorResponse(
  await nodeByIdRoute.PATCH(
    request("http://lws.local/api/lws/nodes/note.invalid", {
      method: "PATCH",
      body: JSON.stringify({ base_rev: 1, patch: { op: "replace" } })
    }),
    routeContext({ id: "note.invalid" })
  ),
  "PATCH_INVALID",
  400
);
await assertErrorResponse(
  await restoreRoute.POST(
    request("http://lws.local/api/lws/objects/note.invalid/restore", {
      method: "POST",
      body: JSON.stringify({ base_rev: 1, source_event_id: "../../event.20260703.BAD" })
    }),
    routeContext({ id: "note.invalid" })
  ),
  "PATH_OUTSIDE_ROOT",
  400
);
await assertErrorResponse(
  await objectByIdRoute.GET(
    request("http://lws.local/api/lws/objects/%"),
    routeContext({ id: "%" })
  ),
  "SCHEMA_INVALID",
  422
);
await assertErrorResponse(
  await objectsRoute.GET(request("http://lws.local/api/lws/objects?limit=nan")),
  "SCHEMA_INVALID",
  422
);
await assertErrorResponse(
  await objectsRoute.GET(request("http://lws.local/api/lws/objects?include_permissions=yes")),
  "SCHEMA_INVALID",
  422
);
await assertErrorResponse(
  await objectsRoute.GET(request("http://lws.local/api/lws/objects?kind=folder")),
  "SCHEMA_INVALID",
  422
);
await assertErrorResponse(
  await objectsRoute.GET(request("http://lws.local/api/lws/objects?visibility=secret")),
  "SCHEMA_INVALID",
  422
);

const privateFixture = createFixture("private-boundary");
privateFixture.objectStore.writeObjectPrimitive(
  nodeFixture({
    id: "note.public-m6",
    title: "Public M6",
    slug: "public-m6",
    visibility: "public",
    summary: "public route boundary phrase"
  })
);
privateFixture.objectStore.writeObjectPrimitive(
  nodeFixture({
    id: "note.private-m6",
    title: "Private M6 Secret",
    slug: "private-m6",
    summary: "private route boundary phrase",
    content: { format: "markdown", body: "hidden private route content" }
  })
);
privateFixture.objectStore.writeObjectPrimitive(
  nodeFixture({
    id: "type.public-m6",
    title: "Public Type M6",
    slug: "type-public-m6",
    type: "type.node-type",
    visibility: "public"
  })
);
privateFixture.objectStore.writeObjectPrimitive(
  nodeFixture({
    id: "type.private-m6",
    title: "Private Type M6",
    slug: "type-private-m6",
    type: "type.node-type"
  })
);
privateFixture.objectStore.writeObjectPrimitive(
  edgeFixture({
    id: "edge.m6.public-ref",
    source: "note.public-m6",
    target: "type.public-m6",
    visibility: "public",
    title: "Public route edge"
  })
);
privateFixture.objectStore.writeObjectPrimitive(
  edgeFixture({
    id: "edge.m6.private-ref",
    source: "note.public-m6",
    target: "note.private-m6",
    visibility: "private",
    title: "Private route edge"
  })
);
privateFixture.reindexCommand.run();
installEnv(privateFixture.env);

await assertErrorResponse(
  await objectByIdRoute.GET(
    request("http://lws.local/api/lws/objects/note.private-m6"),
    routeContext({ id: "note.private-m6" })
  ),
  "PERMISSION_DENIED",
  403
);
await assertErrorResponse(
  await historyRoute.GET(
    request("http://lws.local/api/lws/objects/note.private-m6/history"),
    routeContext({ id: "note.private-m6" })
  ),
  "PERMISSION_DENIED",
  403
);
await assertErrorResponse(
  await historyEventRoute.GET(
    request("http://lws.local/api/lws/objects/note.private-m6/history/event.20260703.ABCDEF1234567890"),
    routeContext({ id: "note.private-m6", eventId: "event.20260703.ABCDEF1234567890" })
  ),
  "PERMISSION_DENIED",
  403
);
await assertErrorResponse(
  await historyDiffRoute.GET(
    request("http://lws.local/api/lws/objects/note.private-m6/history/event.20260703.ABCDEF1234567890/diff"),
    routeContext({ id: "note.private-m6", eventId: "event.20260703.ABCDEF1234567890" })
  ),
  "PERMISSION_DENIED",
  403
);
await assertErrorResponse(
  await permissionsRoute.GET(
    request("http://lws.local/api/lws/objects/note.private-m6/permissions"),
    routeContext({ id: "note.private-m6" })
  ),
  "PERMISSION_DENIED",
  403
);
await assertErrorResponse(
  await validationRoute.GET(
    request("http://lws.local/api/lws/objects/note.private-m6/validation"),
    routeContext({ id: "note.private-m6" })
  ),
  "PERMISSION_DENIED",
  403
);
await assertErrorResponse(
  await objectByIdRoute.GET(
    request("http://lws.local/api/lws/objects/note.private-m6", {
      headers: {
        "x-lws-auth-source": "session",
        "x-lws-account-id": "account.admin"
      }
    }),
    routeContext({ id: "note.private-m6" })
  ),
  "PERMISSION_DENIED",
  403
);

const objectList = await okBody(await objectsRoute.GET(request("http://lws.local/api/lws/objects?include_permissions=true")));
assertPublicOnly(objectList.data.items, "id");
assert.equal(objectList.data.items.some((item: any) => item.id === "note.public-m6" && item.viewer_permissions), true);

const searchResult = await okBody(await searchRoute.GET(request("http://lws.local/api/lws/search?q=route")));
assertPublicOnly(searchResult.data.items, "id");
assert.equal(JSON.stringify(searchResult).includes("hidden private route content"), false);
assert.equal(JSON.stringify(searchResult).includes("Private M6 Secret"), false);

const graphResult = await okBody(await graphRoute.GET(request("http://lws.local/api/lws/graph")));
assertPublicOnly(graphResult.data.nodes, "id");
assert.equal(graphResult.data.edges.some((edge: any) => edge.edge_id === "edge.m6.private-ref"), false);
const publicEdgeCenteredGraph = await okBody(await graphRoute.GET(request("http://lws.local/api/lws/graph?center=edge.m6.public-ref")));
assert.equal(publicEdgeCenteredGraph.data.edges.some((edge: any) => edge.edge_id === "edge.m6.public-ref"), true);
assert.equal(publicEdgeCenteredGraph.data.nodes.some((node: any) => node.id === "note.public-m6"), true);
assert.equal(publicEdgeCenteredGraph.data.nodes.some((node: any) => node.id === "type.public-m6"), true);
const privateEdgeCenteredGraph = await okBody(await graphRoute.GET(request("http://lws.local/api/lws/graph?center=edge.m6.private-ref")));
assert.equal(privateEdgeCenteredGraph.data.edges.some((edge: any) => edge.edge_id === "edge.m6.private-ref"), false);
assertPublicOnly(privateEdgeCenteredGraph.data.nodes, "id");
const backlinksResult = await okBody(
  await backlinksRoute.GET(
    request("http://lws.local/api/lws/objects/note.private-m6/backlinks"),
    routeContext({ id: "note.private-m6" })
  )
);
assert.equal(backlinksResult.data.items.length, 0);

const timelineResult = await okBody(await timelineRoute.GET(request("http://lws.local/api/lws/timeline")));
assertPublicOnly(timelineResult.data.items, "object_id");

const ontologyResult = await okBody(await ontologyRoute.GET(request("http://lws.local/api/lws/ontology")));
assert.equal(ontologyResult.data.types.some((item: any) => item.id === "type.public-m6"), true);
assert.equal(ontologyResult.data.types.some((item: any) => item.id === "type.private-m6"), false);

const missingIndexFixture = createFixture("missing-index");
installEnv(missingIndexFixture.env);
await assertErrorResponse(
  await searchRoute.GET(request("http://lws.local/api/lws/search?q=anything")),
  "INDEX_REBUILD_REQUIRED",
  503
);

const adminFixture = createFixture("admin");
installEnv(adminFixture.env);
await assertErrorResponse(
  await nodesRoute.POST(
    request("http://lws.local/api/lws/nodes", {
      method: "POST",
      body: JSON.stringify({ object: nodeFixture({ id: "note.admin-denied", slug: "admin-denied" }) })
    })
  ),
  "PERMISSION_DENIED",
  403
);
await assertErrorResponse(
  await adminReindexRoute.POST(
    request("http://lws.local/api/lws/admin/reindex", {
      method: "POST",
      body: "",
      headers: { "x-lws-auth-source": "local-script", "x-lws-local-admin-secret": "wrong" }
    })
  ),
  "PERMISSION_DENIED",
  403
);
await assertErrorResponse(
  await adminReindexRoute.POST(
    request("http://lws.local/api/lws/admin/reindex", {
      method: "POST",
      body: JSON.stringify({ client_job_id: "../escape" }),
      headers: localAdminHeaders()
    })
  ),
  "SCHEMA_INVALID",
  422
);

const mutationResponse = await nodesRoute.POST(
  request("http://lws.local/api/lws/nodes", {
    method: "POST",
    body: JSON.stringify({
      object: nodeFixture({
        id: "note.admin-created",
        title: "Admin Created",
        slug: "admin-created",
        visibility: "public"
      })
    }),
    headers: localAdminHeaders()
  })
);
assert.equal(mutationResponse.status, 200);
assert.equal((await okBody(mutationResponse)).data.object.id, "note.admin-created");

const adminReindex = await adminReindexRoute.POST(
  request("http://lws.local/api/lws/admin/reindex", {
    method: "POST",
    body: JSON.stringify({ client_job_id: "m6.reindex.once" }),
    headers: localAdminHeaders()
  })
);
assert.equal(adminReindex.status, 200);
const adminReindexBody = await okBody(adminReindex);
assert.equal(adminReindexBody.data.job.status, "succeeded");
const adminJobId = adminReindexBody.data.job.job_id;

await assertAdminDeniedRoutes(adminJobId);

const productionFixture = createFixture("production", { env: "production", sessionSecret: "prod-secret" });
installEnv(productionFixture.env);
await assertErrorResponse(
  await adminReindexRoute.POST(
    request("http://lws.local/api/lws/admin/reindex", {
      method: "POST",
      body: "",
      headers: { "x-lws-auth-source": "local-script", "x-lws-local-admin-secret": "prod-secret" }
    })
  ),
  "PERMISSION_DENIED",
  403
);

console.log("Milestone M6 API contract and integration hardening checks passed.");

function assertRouteBoundaryScan(): void {
  const routeFiles = listRouteFiles(path.join(process.cwd(), "src", "app", "api", "lws"));
  assert.equal(routeFiles.length > 0, true);

  const forbidden = [
    /\bbackend\.(objectStore|eventStore|indexStore|permissionService|jobService)\b/,
    /\brequest\.json\(/,
    /\bNumber\(/,
    /\bdecodeURIComponent\(/,
    /from\s+["'](?:node:)?fs["']/,
    /require\(["'](?:node:)?fs["']\)/
  ];

  for (const file of routeFiles) {
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, `${path.relative(process.cwd(), file)} matched ${pattern}`);
    }
  }
}

function listRouteFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listRouteFiles(candidate);
    }
    return entry.isFile() && entry.name === "route.ts" ? [candidate] : [];
  });
}

function createFixture(label: string, options: { env?: "development" | "production"; sessionSecret?: string } = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `lws-m6-${label}-`));
  const appRoot = path.join(tempRoot, "app");
  const storageRoot = path.join(tempRoot, "storage");
  fs.mkdirSync(appRoot, { recursive: true });

  const env: Record<string, string> = {
    LWS_APP_NAME: "Listro Wiki System",
    LWS_ENV: options.env ?? "development",
    LWS_HOST: "127.0.0.1",
    LWS_PORT: "3000",
    LWS_KNOWLEDGE_ROOT: path.join(storageRoot, "knowledge", "wiki"),
    LWS_DATA_ROOT: path.join(storageRoot, "data", "wiki"),
    LWS_RUNTIME_ROOT: path.join(storageRoot, "runtime", "wiki"),
    LWS_LOG_ROOT: path.join(storageRoot, "logs", "apps", "wiki"),
    LWS_BACKUP_ROOT: path.join(storageRoot, "backups", "wiki"),
    LWS_AUTH_MODE: "local",
    LWS_SESSION_SECRET: options.sessionSecret ?? "change-me",
    LWS_ADMIN_BOOTSTRAP_ACCOUNT: "account.admin",
    LWS_DEFAULT_VISIBILITY: "private",
    LWS_PUBLIC_GRAPH_ENABLED: "false",
    LWS_ALLOW_STORAGE_INIT: "false",
    LWS_ALLOW_SAMPLE_DATA: "false",
    LWS_INDEX_MODE: "sqlite",
    LWS_SQLITE_ENABLED: "true",
    LWS_SQLITE_PATH: path.join(storageRoot, "data", "wiki", "db", "lws.sqlite"),
    LWS_AUTOSAVE_INTERVAL_MS: "1000"
  };

  const config = loadRuntimeConfig(env, appRoot);
  for (const directory of getStorageBootstrapPlan(config)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const objectStore = new ObjectStore(new PathResolver(config));
  const validationService = new ValidationService(objectStore);
  const indexStore = new IndexStore(config);
  const reindexCommand = new ReindexCommand(objectStore, validationService, indexStore);

  return {
    env,
    objectStore,
    reindexCommand
  };
}

function installEnv(env: Record<string, string>): void {
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
}

function request(url: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return new Request(url, {
    ...init,
    headers
  });
}

function routeContext(params: Record<string, string>): any {
  return {
    params: Promise.resolve(params)
  };
}

function localAdminHeaders(): Record<string, string> {
  return {
    "x-lws-auth-source": "local-script",
    "x-lws-local-admin-secret": "change-me"
  };
}

async function okBody(response: Response): Promise<any> {
  const body = await response.json();
  assert.equal(response.status >= 200 && response.status < 300, true, JSON.stringify(body));
  assert.equal(body.ok, true);
  return body;
}

async function assertErrorResponse(response: Response, code: string, expectedStatus?: number): Promise<void> {
  const body = await response.json();
  const expectedStatusByCode: Record<string, number> = {
    SCHEMA_INVALID: 422,
    PATCH_INVALID: 400,
    PATH_OUTSIDE_ROOT: 400,
    PERMISSION_DENIED: 403,
    INDEX_REBUILD_REQUIRED: 503
  };
  assert.equal(response.status, expectedStatus ?? expectedStatusByCode[code] ?? response.status);
  assert.equal(body.ok, undefined);
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, "string");
  if ("details" in body.error) {
    assert.equal(typeof body.error.details === "object", true);
  }
  assert.equal("stack" in body.error, false);
}

async function assertAdminDeniedRoutes(jobId: string): Promise<void> {
  const contexts = [
    {},
    {
      "x-lws-auth-source": "session",
      "x-lws-account-id": "account.admin",
      "x-lws-ui-capabilities": "system.manage"
    }
  ];

  for (const headers of contexts) {
    await assertErrorResponse(
      await adminJobsRoute.GET(request("http://lws.local/api/lws/admin/jobs", { headers })),
      "PERMISSION_DENIED",
      403
    );
    await assertErrorResponse(
      await adminJobRoute.GET(request(`http://lws.local/api/lws/admin/jobs/${jobId}`, { headers }), routeContext({ jobId })),
      "PERMISSION_DENIED",
      403
    );
    await assertErrorResponse(
      await adminJobCancelRoute.POST(
        request(`http://lws.local/api/lws/admin/jobs/${jobId}/cancel`, { method: "POST", headers }),
        routeContext({ jobId })
      ),
      "PERMISSION_DENIED",
      403
    );
    await assertErrorResponse(
      await adminValidateRoute.POST(request("http://lws.local/api/lws/admin/validate", { method: "POST", headers })),
      "PERMISSION_DENIED",
      403
    );
    await assertErrorResponse(
      await adminBackupRoute.POST(request("http://lws.local/api/lws/admin/backup", { method: "POST", headers })),
      "PERMISSION_DENIED",
      403
    );
    await assertErrorResponse(
      await adminRecoveryRoute.GET(request("http://lws.local/api/lws/admin/recovery", { headers })),
      "PERMISSION_DENIED",
      403
    );
    await assertErrorResponse(
      await adminReindexRoute.POST(request("http://lws.local/api/lws/admin/reindex", { method: "POST", headers })),
      "PERMISSION_DENIED",
      403
    );
  }
}

function assertPublicOnly(items: any[], key: "id" | "object_id"): void {
  assert.equal(items.some((item) => item[key] === "note.private-m6"), false);
  assert.equal(items.some((item) => item[key] === "type.private-m6"), false);
}

function nodeFixture(overrides: Partial<LwsNode>): LwsNode {
  return {
    schema_version: 1,
    object_kind: "node",
    id: "node.placeholder",
    rev: 1,
    title: "Placeholder",
    slug: "placeholder",
    type: "type.note",
    detail_mode: "page",
    visibility: "private",
    status: "active",
    tags: [],
    props: {},
    temporal: {
      occurred_at: null,
      valid_from: null,
      valid_to: null
    },
    audit: {
      created_at: "2026-07-03T00:00:00+09:00",
      updated_at: "2026-07-03T00:00:00+09:00",
      created_by: "account.admin",
      updated_by: "account.admin"
    },
    ...overrides
  };
}

function edgeFixture(overrides: Partial<LwsEdge>): LwsEdge {
  return {
    schema_version: 1,
    object_kind: "edge",
    id: "edge.placeholder",
    rev: 1,
    source: "note.public-m6",
    target: "type.public-m6",
    type: "rel.references",
    title: "Reference",
    detail_mode: "note",
    visibility: "private",
    status: "active",
    tags: [],
    props: {},
    temporal: {
      occurred_at: null,
      valid_from: null,
      valid_to: null
    },
    audit: {
      created_at: "2026-07-03T00:00:00+09:00",
      updated_at: "2026-07-03T00:00:00+09:00",
      created_by: "account.admin",
      updated_by: "account.admin"
    },
    ...overrides
  };
}
