import { createHash } from "node:crypto";

import { canonicalJson } from "./canonical-json.ts";

export function sha256Object(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}
