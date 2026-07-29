import { NextResponse } from "next/server.js";

import { createLwsBackend } from "../../../../../../../server/lws-backend.ts";
import { ok } from "../../../../../../../shared/api.ts";
import { toErrorResponse } from "../../../../../../../shared/errors.ts";
import { parseEventIdParam, parseRouteParam } from "../../../../../../../shared/route-validation.ts";

type RouteContext = {
  params: Promise<{
    id: string;
    eventId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const params = await context.params;
    const backend = createLwsBackend();
    const requestContext = backend.resolveRequestContext(_request);
    const eventId = parseEventIdParam(params.eventId);
    const event = backend.historyService.getHistoryEvent(
      parseRouteParam(params.id, "id"),
      eventId,
      requestContext
    );
    return NextResponse.json(ok(event));
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
