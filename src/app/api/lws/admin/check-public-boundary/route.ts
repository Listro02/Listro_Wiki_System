import { NextResponse } from "next/server.js";

import { createLwsBackend } from "../../../../../server/lws-backend.ts";
import { ok } from "../../../../../shared/api.ts";
import { toErrorResponse } from "../../../../../shared/errors.ts";
import { parseAdminJobOptions } from "../job-options.ts";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const backend = createLwsBackend();
    const context = backend.resolveRequestContext(request);
    const job = backend.adminService.checkPublicBoundary(context, await parseAdminJobOptions(request));
    return NextResponse.json(ok({ job }), { status: job.status === "succeeded" ? 200 : 202 });
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
