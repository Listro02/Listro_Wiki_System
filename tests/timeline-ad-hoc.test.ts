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
import { assertValidObjectShape } from "../src/modules/validation/schema-validator.ts";
import { buildTimelineScene } from "../src/lib/timeline/scene.ts";
import type { LwsEdge, LwsNode } from "../src/shared/object-model.ts";

const timelineRoute = await import("../src/app/api/lws/timeline/route.ts");
const coverageRoute = await import("../src/app/api/lws/temporal-coverage/route.ts");
const fixture = createFixture();
installEnv(fixture.env);

fixture.objectStore.writeObjectPrimitive(node({ id: "note.early", title: "Early", slug: "early", visibility: "public", tags: ["tag.alpha"], temporal: time("2026-01-01") }));
fixture.objectStore.writeObjectPrimitive(node({ id: "note.late", title: "Late", slug: "late", visibility: "public", tags: ["tag.alpha", "tag.beta"], temporal: time("2026-01-02T09:00:00+09:00") }));
fixture.objectStore.writeObjectPrimitive(node({ id: "note.valid", title: "Valid", slug: "valid", visibility: "public", type: "type.project", temporal: { occurred_at: null, valid_from: "2026-02-01", valid_to: "2026-02-03" } }));
fixture.objectStore.writeObjectPrimitive(node({ id: "note.open", title: "Open interval", slug: "open", visibility: "public", type: "type.project", temporal: { occurred_at: null, valid_from: null, valid_to: "2026-02-01" } }));
fixture.objectStore.writeObjectPrimitive(node({ id: "note.legacy-reversed", title: "Legacy reversed", slug: "legacy-reversed", visibility: "public", temporal: { occurred_at: null, valid_from: "2026-03-03", valid_to: "2026-03-01" } }));
fixture.objectStore.writeObjectPrimitive(node({ id: "note.undated", title: "Undated", slug: "undated", visibility: "public" }));
fixture.objectStore.writeObjectPrimitive(node({ id: "note.custom-point", title: "Custom point", slug: "custom-point", visibility: "public", props: { release: { $value: "v1", $temporal: { kind: "point", at: "2026-04-02" } }, ordinary_date: "2026-04-02" } }));
fixture.objectStore.writeObjectPrimitive(node({ id: "note.custom-interval", title: "Custom interval", slug: "custom-interval", visibility: "public", props: { release: { $value: "supported", $temporal: { kind: "interval", start: "2026-04-01", end: null } } } }));
fixture.objectStore.writeObjectPrimitive(node({ id: "note.custom-closed", title: "Custom closed", slug: "custom-closed", visibility: "public", props: { release: { $temporal: { kind: "interval", start: "2026-04-01", end: "2026-04-04" } } } }));
fixture.objectStore.writeObjectPrimitive(node({ id: "note.custom-undated", title: "Custom undated", slug: "custom-undated", visibility: "public", props: { release: { $temporal: { kind: "point", at: null } } } }));
fixture.objectStore.writeObjectPrimitive(node({ id: "note.custom-invalid", title: "Custom invalid", slug: "custom-invalid", visibility: "public", props: { release: { $temporal: { kind: "point", at: "not-a-date" } } } }));
fixture.objectStore.writeObjectPrimitive(node({ id: "note.private", title: "Private", slug: "private", temporal: time("2026-01-01") }));
fixture.objectStore.writeObjectPrimitive(edge({ id: "edge.public", title: "Public relation", visibility: "public", source: "note.early", target: "note.late", temporal: time("2026-01-01") }));
fixture.reindex.run();

const created = await ok(await timelineRoute.GET(request("http://lws.local/api/lws/timeline?kind=node")));
assert.equal(created.data.query.basis, "created");
assert.equal(created.data.items.every((item: any) => item.position.kind === "point"), true);

const all = await ok(await timelineRoute.GET(request("http://lws.local/api/lws/timeline?basis=occurred&from=2026-01-01&to=2026-01-02")));
assert.equal(all.data.items.some((item: any) => item.object_id === "note.early"), true);
assert.equal(all.data.items.some((item: any) => item.object_id === "edge.public"), true);
assert.equal(all.data.items.some((item: any) => item.object_id === "note.private"), false);
const publicEdge = all.data.items.find((item: any) => item.object_id === "edge.public");
assert.equal(publicEdge.target.object_id, "note.late");
assert.equal(publicEdge.audit.created_at.length > 0, true);

const nodesOnly = await ok(await timelineRoute.GET(request("http://lws.local/api/lws/timeline?kind=node&basis=occurred&type=type.note&tag=tag.alpha&group_by=tag")));
assert.equal(nodesOnly.data.items.every((item: any) => item.object_kind === "node"), true);
assert.equal(nodesOnly.data.groups.find((group: any) => group.key === "tag.alpha").count, 2);
assert.equal(nodesOnly.data.items.find((item: any) => item.object_id === "note.late").group_keys.includes("tag.beta"), true);
assert.equal(nodesOnly.data.relations.some((relation: any) => relation.edge_id === "edge.public"), true);
assert.equal(typeof nodesOnly.data.domain.min_key, "number");
assert.equal(typeof nodesOnly.data.items[0].position.normalized_at, "number");
const datedScene = buildTimelineScene(nodesOnly.data);
assert.equal(datedScene.nodes.filter((node) => node.type === "timelinePoint").length >= 2, true);
assert.equal(datedScene.edges.some((edge) => edge.id === "edge.public"), true);
const earlySceneNode = datedScene.nodes.find((node) => node.data.objectId === "note.early");
const lateSceneNode = datedScene.nodes.find((node) => node.data.objectId === "note.late");
assert.equal((earlySceneNode?.position.x ?? 0) < (lateSceneNode?.position.x ?? 0), true);

const sameDayItems = nodesOnly.data.items.slice(0, 2).map((item: any, index: number) => ({
  ...item,
  position: {
    ...item.position,
    kind: "point",
    at: `2026-08-01T${index ? "10" : "05"}:08:17.${index ? "827" : "691"}Z`,
    normalized_at: Date.parse(`2026-08-01T${index ? "10" : "05"}:08:17.${index ? "827" : "691"}Z`),
    precision: "datetime"
  }
}));
const sameDayResponse = {
  ...nodesOnly.data,
  items: sameDayItems,
  relations: [],
  domain: { min_key: sameDayItems[0].position.normalized_at, max_key: sameDayItems[1].position.normalized_at }
};
const dateBucketScene = buildTimelineScene(sameDayResponse);
const dateBucketNodes = dateBucketScene.nodes.filter((node) => node.data.objectId);
assert.equal(dateBucketScene.granularity, "day");
assert.equal(dateBucketNodes[0].position.x, dateBucketNodes[1].position.x);
const hourBucketScene = buildTimelineScene(sameDayResponse, { granularity: "hour" });
const hourBucketNodes = hourBucketScene.nodes.filter((node) => node.data.objectId);
assert.notEqual(hourBucketNodes[0].position.x, hourBucketNodes[1].position.x);

const valid = await ok(await timelineRoute.GET(request("http://lws.local/api/lws/timeline?kind=node&basis=valid&from=2026-02-01&to=2026-02-02")));
assert.equal(valid.data.items.some((item: any) => item.object_id === "note.valid"), true);
assert.equal(valid.data.items.some((item: any) => item.object_id === "note.open"), true);
assert.equal(valid.data.items.find((item: any) => item.object_id === "note.valid").position.kind, "interval");
const reversed = await ok(await timelineRoute.GET(request("http://lws.local/api/lws/timeline?kind=node&basis=valid&from=2026-03-01&to=2026-03-04")));
assert.equal(reversed.data.items.some((item: any) => item.object_id === "note.legacy-reversed"), false);

const undated = await ok(await timelineRoute.GET(request("http://lws.local/api/lws/timeline?kind=node&basis=occurred&temporal_state=undated")));
assert.equal(undated.data.items.some((item: any) => item.object_id === "note.undated"), true);
assert.equal(undated.data.items.every((item: any) => item.position.kind === "undated"), true);
const undatedScene = buildTimelineScene(undated.data);
assert.equal(undatedScene.nodes.every((node) => node.type !== "timelineTick"), true);
assert.equal(undatedScene.nodes.some((node) => node.type === "timelineUndated"), true);

const custom = await ok(await timelineRoute.GET(request("http://lws.local/api/lws/timeline?kind=node&basis=custom&time_path=%2Fprops%2Frelease&from=2026-04-02&to=2026-04-03")));
assert.equal(custom.data.items.some((item: any) => item.object_id === "note.custom-point" && item.position.kind === "point"), true);
assert.equal(custom.data.items.some((item: any) => item.object_id === "note.custom-interval" && item.position.kind === "interval"), true);
assert.equal(custom.data.items.some((item: any) => item.object_id === "note.custom-closed" && item.position.end === "2026-04-04"), true);
assert.equal(custom.data.time_coverage.declared_count, 5);
assert.equal(custom.data.time_coverage.dated_count, 3);
assert.equal(custom.data.time_coverage.undated_count, 1);
assert.equal(custom.data.time_coverage.invalid_count, 1);
assert.equal(custom.data.time_coverage.missing_count > 0, true);
const customUndated = await ok(await timelineRoute.GET(request("http://lws.local/api/lws/timeline?kind=node&basis=custom&time_path=%2Fprops%2Frelease&temporal_state=undated")));
assert.deepEqual(customUndated.data.items.map((item: any) => item.object_id), ["note.custom-undated"]);
const customMissingCoverage = await ok(await coverageRoute.GET(request("http://lws.local/api/lws/temporal-coverage?kind=node&basis=custom&time_path=%2Fprops%2Frelease&state=missing&limit=2")));
assert.equal(customMissingCoverage.data.items.every((item: any) => item.state === "missing"), true);
assert.equal(customMissingCoverage.data.items.some((item: any) => item.object_id === "note.private"), false);
assert.equal(customMissingCoverage.data.time_coverage.missing_count > 0, true);
const customInvalidCoverage = await ok(await coverageRoute.GET(request("http://lws.local/api/lws/temporal-coverage?kind=node&basis=custom&time_path=%2Fprops%2Frelease&state=invalid")));
assert.deepEqual(customInvalidCoverage.data.items.map((item: any) => item.object_id), ["note.custom-invalid"]);
const validInvalidCoverage = await ok(await coverageRoute.GET(request("http://lws.local/api/lws/temporal-coverage?kind=node&basis=valid&state=invalid")));
assert.deepEqual(validInvalidCoverage.data.items.map((item: any) => item.object_id), ["note.legacy-reversed"]);
const invalidCoverageState = await coverageRoute.GET(request("http://lws.local/api/lws/temporal-coverage?kind=node&basis=created&state=missing"));
assert.equal(invalidCoverageState.status, 422);
const projectionDb = fixture.indexStore.openReady();
assert.equal((projectionDb.prepare("SELECT COUNT(*) AS count FROM timeline_property_values").get() as any).count, 5);
assert.equal((projectionDb.prepare("SELECT COUNT(*) AS count FROM timeline_property_values WHERE property_path = '/props/ordinary_date'").get() as any).count, 0);
projectionDb.close();

const pageOne = await ok(await timelineRoute.GET(request("http://lws.local/api/lws/timeline?kind=node&limit=1")));
assert.equal(typeof pageOne.data.next_cursor, "string");
const pageTwo = await ok(await timelineRoute.GET(request(`http://lws.local/api/lws/timeline?kind=node&limit=1&cursor=${encodeURIComponent(pageOne.data.next_cursor)}`)));
assert.notEqual(pageOne.data.items[0].object_id, pageTwo.data.items[0].object_id);
const mismatch = await timelineRoute.GET(request(`http://lws.local/api/lws/timeline?kind=node&limit=1&type=type.note&cursor=${encodeURIComponent(pageOne.data.next_cursor)}`));
assert.equal(mismatch.status, 400);
assert.equal((await mismatch.json()).error.code, "CURSOR_INVALID");

const invalidRange = await timelineRoute.GET(request("http://lws.local/api/lws/timeline?scope=scope.wiki&collection=collection.demo"));
assert.equal(invalidRange.status, 422);
assert.equal((await invalidRange.json()).error.code, "SCHEMA_INVALID");
const invalidCustom = await timelineRoute.GET(request("http://lws.local/api/lws/timeline?basis=custom&time_path=%2Ftemporal%2Foccurred_at"));
assert.equal(invalidCustom.status, 422);
assert.throws(() => assertValidObjectShape(node({ id: "note.bad-time", slug: "bad-time", temporal: time("not-a-date") })), /Object schema validation failed/);
assert.throws(() => assertValidObjectShape(node({ id: "note.bad-wrapper", slug: "bad-wrapper", props: { release: { $temporal: { kind: "point", at: "not-a-date" } } } })), /Object schema validation failed/);
assert.throws(() => assertValidObjectShape(node({ id: "note.array-wrapper", slug: "array-wrapper", props: { releases: [{ $temporal: { kind: "point", at: "2026-01-01" } }] } })), /Object schema validation failed/);

const incrementalObject = node({ id: "note.incremental-wrapper", title: "Incremental", slug: "incremental-wrapper", visibility: "public", props: { lifecycle: { support: { $value: "active", $temporal: { kind: "interval", start: "2027-01-01", end: null } } } } });
fixture.objectStore.writeObjectPrimitive(incrementalObject);
const incrementalDb = fixture.indexStore.openReady();
fixture.indexStore.insertObject(incrementalDb, incrementalObject);
const incrementalBefore = incrementalDb.prepare("SELECT property_path, time_kind, start_value, end_value, projection_status FROM timeline_property_values WHERE object_id = ?").get(incrementalObject.id);
incrementalDb.close();
fixture.reindex.run();
const rebuiltDb = fixture.indexStore.openReady();
const incrementalAfter = rebuiltDb.prepare("SELECT property_path, time_kind, start_value, end_value, projection_status FROM timeline_property_values WHERE object_id = ?").get(incrementalObject.id);
rebuiltDb.close();
assert.deepEqual(incrementalAfter, incrementalBefore);

console.log("Ad-hoc Knowledge Timeline contract checks passed.");

function time(occurred_at: string) { return { occurred_at, valid_from: null, valid_to: null }; }

function node(overrides: Partial<LwsNode>): LwsNode {
  return {
    schema_version: 1, object_kind: "node", id: "note.placeholder", rev: 1, title: "Placeholder", slug: "placeholder", type: "type.note", detail_mode: "page",
    visibility: "private", status: "active", tags: [], props: {}, temporal: { occurred_at: null, valid_from: null, valid_to: null },
    audit: { created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", created_by: "account.admin", updated_by: "account.admin" }, ...overrides
  };
}

function edge(overrides: Partial<LwsEdge>): LwsEdge {
  return {
    schema_version: 1, object_kind: "edge", id: "edge.placeholder", rev: 1, title: "Edge", source: "note.early", target: "note.late", type: "rel.references", detail_mode: "note",
    visibility: "private", status: "active", tags: [], props: {}, temporal: { occurred_at: null, valid_from: null, valid_to: null },
    audit: { created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", created_by: "account.admin", updated_by: "account.admin" }, ...overrides
  };
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lws-timeline-"));
  const appRoot = path.join(root, "app"); const storage = path.join(root, "storage"); fs.mkdirSync(appRoot, { recursive: true });
  const env: Record<string, string> = {
    LWS_APP_NAME: "LWS", LWS_ENV: "development", LWS_HOST: "127.0.0.1", LWS_PORT: "3000", LWS_KNOWLEDGE_ROOT: path.join(storage, "knowledge"), LWS_DATA_ROOT: path.join(storage, "data"), LWS_RUNTIME_ROOT: path.join(storage, "runtime"), LWS_LOG_ROOT: path.join(storage, "logs"), LWS_BACKUP_ROOT: path.join(storage, "backups"), LWS_AUTH_MODE: "local", LWS_SESSION_SECRET: "change-me", LWS_ADMIN_BOOTSTRAP_ACCOUNT: "account.admin", LWS_DEFAULT_VISIBILITY: "private", LWS_PUBLIC_GRAPH_ENABLED: "false", LWS_ALLOW_STORAGE_INIT: "false", LWS_ALLOW_SAMPLE_DATA: "false", LWS_INDEX_MODE: "sqlite", LWS_SQLITE_ENABLED: "true", LWS_SQLITE_PATH: path.join(storage, "data", "db", "lws.sqlite"), LWS_AUTOSAVE_INTERVAL_MS: "1000"
  };
  const config = loadRuntimeConfig(env, appRoot); for (const directory of getStorageBootstrapPlan(config)) fs.mkdirSync(directory, { recursive: true });
  const objectStore = new ObjectStore(new PathResolver(config));
  const indexStore = new IndexStore(config);
  return { env, objectStore, indexStore, reindex: new ReindexCommand(objectStore, new ValidationService(objectStore), indexStore) };
}

function installEnv(env: Record<string, string>) { for (const [key, value] of Object.entries(env)) process.env[key] = value; }
function request(url: string) { return new Request(url); }
async function ok(response: Response): Promise<any> { const body = await response.json(); assert.equal(response.status, 200, JSON.stringify(body)); return body; }
