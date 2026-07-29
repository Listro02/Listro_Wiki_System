import { NextResponse } from "next/server.js";

import { createLwsBackend } from "../../../../server/lws-backend.ts";
import { StatusService } from "../../../../services/status-service.ts";
import { toErrorResponse } from "../../../../shared/errors.ts";
import { ok } from "../../../../shared/api.ts";

export function GET(request: Request): NextResponse {
  try {
    const backend = createLwsBackend();
    const context = backend.resolveRequestContext(request);
    const status = new StatusService().getStatus(backend.config, context);
    return NextResponse.json(ok(status));
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
