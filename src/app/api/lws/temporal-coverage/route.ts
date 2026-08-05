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
    return NextResponse.json(ok(backend.timelineService.getTemporalCoverage({
      kind: parseObjectKind(params.get("kind")),
      basis: params.get("basis") as "created" | "updated" | "occurred" | "valid" | "custom" | null ?? undefined,
      time_path: params.get("time_path") ?? undefined,
      state: params.get("state") as "undated" | "missing" | "invalid" | null ?? undefined,
      type: params.get("type") ?? undefined,
      tag: params.get("tag") ?? undefined,
      scope: params.get("scope") ?? undefined,
      collection: params.get("collection") ?? undefined,
      status: params.get("status") ?? undefined,
      visibility: parseVisibility(params.get("visibility")),
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
