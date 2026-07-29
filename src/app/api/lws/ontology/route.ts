import { NextResponse } from "next/server.js";

import { createLwsBackend } from "../../../../server/lws-backend.ts";
import { ok } from "../../../../shared/api.ts";
import { toErrorResponse } from "../../../../shared/errors.ts";

export function GET(request: Request): NextResponse {
  try {
    const backend = createLwsBackend();
    const context = backend.resolveRequestContext(request);
    return NextResponse.json(ok(backend.ontologyService.getOntology(context)));
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
