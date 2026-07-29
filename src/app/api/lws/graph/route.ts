import { NextResponse } from "next/server.js";

import { createLwsBackend } from "../../../../server/lws-backend.ts";
import { ok } from "../../../../shared/api.ts";
import { toErrorResponse } from "../../../../shared/errors.ts";
import { parseIntegerQuery } from "../../../../shared/route-validation.ts";

export function GET(request: Request): NextResponse {
  try {
    const backend = createLwsBackend();
    const context = backend.resolveRequestContext(request);
    const params = new URL(request.url).searchParams;
    const result = backend.graphService.getGraph(
      {
        center: params.get("center") ?? undefined,
        depth: parseIntegerQuery(params.get("depth"), "depth")
      },
      context
    );

    return NextResponse.json(ok(result));
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
