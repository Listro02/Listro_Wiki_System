import { LwsError } from "../../shared/errors.ts";

export function assertBaseRev(currentRev: number, baseRev: number): void {
  if (currentRev !== baseRev) {
    throw new LwsError("REV_CONFLICT", "Object was changed by another write.", {
      current_rev: currentRev,
      base_rev: baseRev
    });
  }
}

export function nextRev(currentRev: number): number {
  return currentRev + 1;
}
