import { NextResponse } from "next/server.js";

import { createLwsBackend } from "../../../../server/lws-backend.ts";
import { ok } from "../../../../shared/api.ts";
import { toErrorResponse } from "../../../../shared/errors.ts";
import { parseCreateObjectBody, readJsonBody } from "../../../../shared/route-validation.ts";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const backend = createLwsBackend();
    const context = backend.resolveRequestContext(request);
    const body = parseCreateObjectBody(await readJsonBody(request), "edge");
    const result = backend.edgeService.createEdge(body, context);

    return NextResponse.json(ok(result));
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
