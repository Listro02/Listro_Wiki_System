export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export type JobProgress = {
  current: number;
  total: number | null;
  message: string;
  phase?: string;
  scanned_count?: number;
  warning_count?: number;
};

export type JobActor = {
  account_id: string | null;
  auth_source: string;
  request_id: string;
};

export type JobAuditEntry = {
  occurred_at: string;
  action: "created" | "running" | "progress" | "succeeded" | "failed" | "cancel_requested" | "canceled";
  account_id: string | null;
  auth_source: string | null;
  request_id: string | null;
  message: string;
};

export type JobEnvelope<T = unknown> = {
  job_id: string;
  type: string;
  status: JobStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  progress: JobProgress;
  result: T | null;
  error: {
    code: string;
    message: string;
  } | null;
  client_job_id?: string;
  actor?: JobActor;
  audit: JobAuditEntry[];
};
