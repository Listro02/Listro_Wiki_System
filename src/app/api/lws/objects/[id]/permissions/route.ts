import { NextResponse } from "next/server.js";

import { createLwsBackend } from "../../../../../../server/lws-backend.ts";
import { ok } from "../../../../../../shared/api.ts";
import { toErrorResponse } from "../../../../../../shared/errors.ts";
import { parseRouteParam } from "../../../../../../shared/route-validation.ts";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const params = await context.params;
    const backend = createLwsBackend();
    const requestContext = backend.resolveRequestContext(_request);
    return NextResponse.json(ok(backend.objectService.getObjectPermissions(parseRouteParam(params.id, "id"), requestContext)));
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
