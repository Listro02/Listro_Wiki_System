import { NextResponse } from "next/server.js";

export function GET(): NextResponse {
  return NextResponse.json({
    ok: true,
    data: {
      service: "lws",
      status: "ok",
      checked_at: new Date().toISOString()
    }
  });
}
