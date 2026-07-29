import { NextResponse } from "next/server.js";

import { createLwsBackend } from "../../../../../server/lws-backend.ts";
import { ok } from "../../../../../shared/api.ts";
import { toErrorResponse } from "../../../../../shared/errors.ts";
import {
  parseDeleteObjectBody,
  parsePatchObjectBody,
  parseRouteParam,
  readJsonBody
} from "../../../../../shared/route-validation.ts";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const params = await context.params;
    const backend = createLwsBackend();
    const requestContext = backend.resolveRequestContext(request);
    const body = parsePatchObjectBody(await readJsonBody(request));
    const result = backend.edgeService.patchEdge(
      {
        id: parseRouteParam(params.id, "id"),
        ...body,
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

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const params = await context.params;
    const backend = createLwsBackend();
    const requestContext = backend.resolveRequestContext(request);
    const body = parseDeleteObjectBody(await readJsonBody(request, { allowEmpty: true }));
    const result = backend.edgeService.deleteEdge(
      {
        id: parseRouteParam(params.id, "id"),
        base_rev: body.base_rev,
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
