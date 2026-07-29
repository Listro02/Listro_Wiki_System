export type LwsOkResponse<T> = {
  ok: true;
  data: T;
};

export type LwsIssueSeverity = "error" | "warning" | "info";

export type LwsIssue = {
  code: string;
  severity: LwsIssueSeverity;
  message: string;
  target?: string;
  details?: Record<string, unknown>;
};

export function ok<T>(data: T): LwsOkResponse<T> {
  return { ok: true, data };
}
