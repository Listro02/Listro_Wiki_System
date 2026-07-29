import { NextResponse } from "next/server.js";

import { createLwsBackend } from "../../../../../../server/lws-backend.ts";
import { ok } from "../../../../../../shared/api.ts";
import { toErrorResponse } from "../../../../../../shared/errors.ts";
import { parseRestoreObjectBody, parseRouteParam, readJsonBody } from "../../../../../../shared/route-validation.ts";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const params = await context.params;
    const backend = createLwsBackend();
    const requestContext = backend.resolveRequestContext(request);
    const body = parseRestoreObjectBody(await readJsonBody(request));
    const result = backend.mutationService.restoreObject(
      {
        id: parseRouteParam(params.id, "id"),
        base_rev: body.base_rev,
        source_event_id: body.source_event_id,
        mode: body.mode,
        summary: body.summary
      },
      requestContext
    );

    return NextResponse.json(ok(result));
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
