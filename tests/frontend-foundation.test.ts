import assert from "node:assert/strict";

import { buildLwsHeaders, createLwsClient, shouldAttachLocalAdmin, toApiError } from "../src/lib/lws-api/client.ts";
import {
  createEmptyEdgeDraft,
  createEmptyNodeDraft,
  createPatchFromObjects,
  draftToComparableObject,
  draftToEdge,
  draftToNode,
  edgeToDraft,
  nodeToDraft
} from "../src/lib/lws-api/drafts.ts";
import type { LwsEdge, LwsNode } from "../src/lib/lws-api/types.ts";

assert.equal(shouldAttachLocalAdmin({ adminMode: true, localAdminSecret: "secret", env: "development" }), true);
assert.equal(shouldAttachLocalAdmin({ adminMode: true, localAdminSecret: "secret", env: "production" }), false);
assert.equal(shouldAttachLocalAdmin({ adminMode: false, localAdminSecret: "secret", env: "development" }), false);

const adminHeaders = buildLwsHeaders({ adminMode: true, localAdminSecret: "secret", env: "development" });
assert.equal(adminHeaders.get("x-lws-auth-source"), "local-script");
assert.equal(adminHeaders.get("x-lws-local-admin-secret"), "secret");

const prodHeaders = buildLwsHeaders({ adminMode: true, localAdminSecret: "secret", env: "production" });
assert.equal(prodHeaders.get("x-lws-auth-source"), null);
assert.equal(prodHeaders.get("x-lws-local-admin-secret"), null);

const fetcher: typeof fetch = async (_input, init) => {
  const headers = new Headers(init?.headers);
  assert.equal(headers.get("x-lws-auth-source"), "local-script");
  return Response.json({ ok: true, data: { app: { name: "LWS", env: "development" }, request: { request_id: "req", auth_source: "local-script" }, storage: { ok: true, issues: [] }, public_config: {} } });
};
await createLwsClient({ adminMode: true, localAdminSecret: "secret", env: "development" }, fetcher).getStatus();

const errorFetcher: typeof fetch = async () => Response.json({ error: { code: "PERMISSION_DENIED", message: "Nope" } }, { status: 403 });
await assert.rejects(
  () => createLwsClient({ adminMode: false, localAdminSecret: "" }, errorFetcher).getSession(),
  (error) => {
    const apiError = toApiError(error);
    assert.equal(apiError.code, "PERMISSION_DENIED");
    assert.equal(apiError.status, 403);
    return true;
  }
);

const emptyNode = draftToNode(createEmptyNodeDraft("public"));
assert.equal(emptyNode.object_kind, "node");
assert.equal(emptyNode.visibility, "public");
assert.equal(emptyNode.rev, 1);
assert.equal(emptyNode.audit.created_by, "client.draft");

const emptyEdge = draftToEdge(createEmptyEdgeDraft("private"));
assert.equal(emptyEdge.object_kind, "edge");
assert.equal(emptyEdge.visibility, "private");
assert.equal(emptyEdge.type, "rel.references");

const baselineNode: LwsNode = {
  schema_version: 1,
  object_kind: "node",
  id: "note.frontend",
  rev: 7,
  title: "Old title",
  slug: "old-title",
  type: "type.note",
  detail_mode: "note",
  visibility: "private",
  status: "active",
  tags: ["tag.old"],
  props: { a: 1 },
  temporal: { occurred_at: null, valid_from: null, valid_to: null },
  audit: {
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    created_by: "account.admin",
    updated_by: "account.admin"
  },
  content: { format: "markdown", body: "old" }
};
const nodeDraft = nodeToDraft(baselineNode);
nodeDraft.title = "New title";
nodeDraft.tags = ["tag.new"];
const nodeAfter = draftToComparableObject(baselineNode, nodeDraft);
const nodePatch = createPatchFromObjects(baselineNode, nodeAfter);
assert.deepEqual(
  nodePatch.map((operation) => operation.path).sort(),
  ["/tags", "/title"]
);
assert.equal(nodePatch.some((operation) => operation.path === "/rev" || operation.path.startsWith("/audit")), false);

const partialNodeDraft = nodeToDraft({
  ...baselineNode,
  slug: undefined,
  type: undefined,
  tags: undefined,
  props: undefined,
  temporal: undefined
} as unknown as LwsNode);
assert.equal(partialNodeDraft.slug, "");
assert.equal(partialNodeDraft.type, "type.note");
assert.deepEqual(partialNodeDraft.tags, []);
assert.deepEqual(partialNodeDraft.props, {});
assert.deepEqual(partialNodeDraft.temporal, { occurred_at: null, valid_from: null, valid_to: null });

const baselineEdge: LwsEdge = {
  schema_version: 1,
  object_kind: "edge",
  id: "edge.frontend",
  rev: 2,
  title: "Old edge",
  source: "note.a",
  target: "note.b",
  type: "rel.references",
  detail_mode: "note",
  visibility: "private",
  status: "active",
  tags: [],
  props: {},
  temporal: { occurred_at: null, valid_from: null, valid_to: null },
  audit: {
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    created_by: "account.admin",
    updated_by: "account.admin"
  }
};
const edgeDraft = edgeToDraft(baselineEdge);
edgeDraft.target = "note.c";
edgeDraft.visibility = "public";
const edgePatch = createPatchFromObjects(baselineEdge, draftToComparableObject(baselineEdge, edgeDraft));
assert.deepEqual(
  edgePatch.map((operation) => operation.path).sort(),
  ["/target", "/visibility"]
);

const partialEdgeDraft = edgeToDraft({
  ...baselineEdge,
  source: undefined,
  target: undefined,
  type: undefined,
  content: undefined
} as unknown as LwsEdge);
assert.equal(partialEdgeDraft.source, "");
assert.equal(partialEdgeDraft.target, "");
assert.equal(partialEdgeDraft.type, "rel.references");
assert.deepEqual(partialEdgeDraft.content, { format: "markdown", body: "" });

console.log("Frontend foundation checks passed.");
