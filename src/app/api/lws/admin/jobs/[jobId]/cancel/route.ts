import { NextResponse } from "next/server.js";

import { createLwsBackend } from "../../../../../../../server/lws-backend.ts";
import { ok } from "../../../../../../../shared/api.ts";
import { toErrorResponse } from "../../../../../../../shared/errors.ts";
import { parseRouteParam } from "../../../../../../../shared/route-validation.ts";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const params = await context.params;
    const backend = createLwsBackend();
    const requestContext = backend.resolveRequestContext(_request);
    return NextResponse.json(
      ok({ job: backend.adminService.cancelJob(requestContext, parseRouteParam(params.jobId, "jobId")) })
    );
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
