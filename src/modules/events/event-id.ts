import path from "node:path";

import { LwsError } from "../../shared/errors.ts";

const EVENT_ID_PATTERN = /^event\.\d{8}\.[A-F0-9]{16}$/;

export function assertSafeEventId(eventId: string): void {
  if (typeof eventId !== "string" || eventId.trim().length === 0) {
    throw new LwsError("PATH_OUTSIDE_ROOT", "Event id must not be empty.");
  }

  if (
    eventId !== eventId.trim() ||
    path.isAbsolute(eventId) ||
    eventId.includes("/") ||
    eventId.includes("\\") ||
    eventId.includes("..") ||
    /^[A-Za-z]:/.test(eventId) ||
    eventId.startsWith("//") ||
    eventId.startsWith("\\\\") ||
    !EVENT_ID_PATTERN.test(eventId)
  ) {
    throw new LwsError("PATH_OUTSIDE_ROOT", "Event id is not safe for storage path resolution.", {
      event_id: eventId
    });
  }
}

export function normalizeEventId(value: unknown): string {
  if (typeof value !== "string") {
    throw new LwsError("PATH_OUTSIDE_ROOT", "Event id must be a string.");
  }

  const eventId = value.trim();
  assertSafeEventId(eventId);
  return eventId;
}
