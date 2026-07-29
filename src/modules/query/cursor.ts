import { LwsError } from "../../shared/errors.ts";

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) {
    return 0;
  }

  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { offset?: unknown };
    if (!Number.isInteger(decoded.offset) || Number(decoded.offset) < 0) {
      throw new Error("Invalid cursor offset.");
    }
    return Number(decoded.offset);
  } catch {
    throw new LwsError("CURSOR_INVALID", "Cursor is invalid.");
  }
}
