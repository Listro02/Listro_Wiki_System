import { NextResponse } from "next/server.js";

import { createLwsBackend } from "../../../../server/lws-backend.ts";
import { ok } from "../../../../shared/api.ts";
import { toErrorResponse } from "../../../../shared/errors.ts";
import {
  parseBooleanQuery,
  parseIntegerQuery,
  parseObjectKind
} from "../../../../shared/route-validation.ts";

export function GET(request: Request): NextResponse {
  try {
    const backend = createLwsBackend();
    const context = backend.resolveRequestContext(request);
    const params = new URL(request.url).searchParams;
    const result = backend.objectQueryService.search(
      {
        q: params.get("q") ?? "",
        kind: parseObjectKind(params.get("kind")),
        type: params.get("type") ?? undefined,
        tag: params.get("tag") ?? undefined,
        status: params.get("status") ?? undefined,
        scope: params.get("scope") ?? undefined,
        collection: params.get("collection") ?? undefined,
        limit: parseIntegerQuery(params.get("limit"), "limit"),
        cursor: params.get("cursor") ?? undefined,
        include_permissions: parseBooleanQuery(params.get("include_permissions"), "include_permissions")
      },
      context
    );

    return NextResponse.json(ok(result));
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
