import { NextResponse } from "next/server.js";

import { createLwsBackend } from "../../../../server/lws-backend.ts";
import { ok } from "../../../../shared/api.ts";
import { toErrorResponse } from "../../../../shared/errors.ts";
import { parseIntegerQuery, parseObjectKind, parseVisibility } from "../../../../shared/route-validation.ts";

export function GET(request: Request): NextResponse {
  try {
    const backend = createLwsBackend();
    const context = backend.resolveRequestContext(request);
    const params = new URL(request.url).searchParams;
    return NextResponse.json(ok(backend.timelineService.getTimeline({
      kind: parseObjectKind(params.get("kind")),
      basis: params.get("basis") as "created" | "updated" | "occurred" | "valid" | "custom" | null ?? undefined,
      time_path: params.get("time_path") ?? undefined,
      temporal_state: params.get("temporal_state") as "dated" | "undated" | null ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      type: params.get("type") ?? undefined,
      tag: params.get("tag") ?? undefined,
      scope: params.get("scope") ?? undefined,
      collection: params.get("collection") ?? undefined,
      status: params.get("status") ?? undefined,
      visibility: parseVisibility(params.get("visibility")),
      group_by: params.get("group_by") as "none" | "type" | "tag" | "scope" | "collection" | null ?? undefined,
      center: params.get("center") ?? undefined,
      depth: parseIntegerQuery(params.get("depth"), "depth"),
      limit: parseIntegerQuery(params.get("limit"), "limit"),
      cursor: params.get("cursor") ?? undefined
    }, context)));
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
