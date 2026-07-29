import { NextResponse } from "next/server.js";

import { createLwsBackend } from "../../../../server/lws-backend.ts";
import { toErrorResponse } from "../../../../shared/errors.ts";
import { ok } from "../../../../shared/api.ts";

export function GET(request: Request): NextResponse {
  try {
    const backend = createLwsBackend();
    const context = backend.resolveRequestContext(request);
    const session = backend.sessionService.getSession(context, backend.config.publicConfig);
    return NextResponse.json(ok(session));
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
