import { LwsError, toLwsError } from "../shared/errors.ts";
import type { JobActor, JobEnvelope, JobProgress } from "../modules/jobs/job-types.ts";
import { JobStore } from "../modules/jobs/job-store.ts";

export type JobRunContext<T = unknown> = {
  job_id: string;
  updateProgress(progress: Partial<JobProgress>): JobEnvelope<T>;
  checkCanceled(): void;
  isCancellationRequested(): boolean;
};

export type JobRunOptions = {
  clientJobId?: string;
  actor?: JobActor;
};

export class JobService {
  private readonly jobStore: JobStore;

  constructor(jobStore: JobStore) {
    this.jobStore = jobStore;
  }

  runSync<T>(
    type: string,
    work: (job: JobEnvelope<T>, context: JobRunContext<T>) => T,
    optionsOrClientJobId?: JobRunOptions | string
  ): JobEnvelope<T> {
    const options = normalizeRunOptions(optionsOrClientJobId);
    const clientJobId = normalizeClientJobId(options.clientJobId);
    if (clientJobId) {
      const existing = this.jobStore.findByClientJobId(type, clientJobId);
      if (existing) {
        return existing as JobEnvelope<T>;
      }
    }

    let job = this.jobStore.create<T>(type, clientJobId, options.actor);
    this.jobStore.save(job);
    job = this.audit(job, "created", "Job created.", options.actor);

    let running: JobEnvelope<T> = {
      ...job,
      status: "running",
      started_at: new Date().toISOString(),
      progress: {
        current: 0,
        total: null,
        message: "Running"
      }
    };
    this.jobStore.save(running);
    running = this.audit(running, "running", "Job started.", options.actor);
    const runContext = this.createRunContext<T>(running.job_id, options.actor);

    try {
      runContext.checkCanceled();
      const result = work(running, runContext);
      runContext.checkCanceled();
      const latest = this.jobStore.get(running.job_id) as JobEnvelope<T>;
      if (latest.status === "canceled") {
        return latest;
      }
      const succeeded: JobEnvelope<T> = {
        ...latest,
        status: "succeeded",
        finished_at: new Date().toISOString(),
        progress: {
          ...latest.progress,
          current: latest.progress.total ?? Math.max(latest.progress.current, 1),
          total: latest.progress.total ?? Math.max(latest.progress.current, 1),
          message: "Succeeded"
        },
        result
      };
      this.jobStore.save(succeeded);
      return this.audit(succeeded, "succeeded", "Job succeeded.", options.actor);
    } catch (error) {
      if (error instanceof JobCanceledSignal) {
        return this.cancelPersistedJob(running.job_id, options.actor, "Job canceled.");
      }

      const lwsError = toLwsError(error);
      const latest = this.jobStore.get(running.job_id) as JobEnvelope<T>;
      const failed: JobEnvelope<T> = {
        ...latest,
        status: "failed",
        finished_at: new Date().toISOString(),
        error: {
          code: lwsError.code,
          message: lwsError.message
        }
      };
      this.jobStore.save(failed);
      return this.audit(failed, "failed", `Job failed: ${lwsError.code}.`, options.actor);
    }
  }

  listJobs(): JobEnvelope[] {
    return this.jobStore.list();
  }

  getJob(jobId: string): JobEnvelope {
    return this.jobStore.get(jobId);
  }

  cancelJob(jobId: string): JobEnvelope {
    const job = this.jobStore.get(jobId);
    if (job.status === "canceled") {
      return job;
    }
    if (job.status !== "queued" && job.status !== "running") {
      throw new LwsError("JOB_CONFLICT", "Only queued or running jobs can be canceled.", { job_id: jobId });
    }

    return this.cancelPersistedJob(jobId, job.actor, "Job cancel requested.");
  }

  listAuditEvents(): Array<Record<string, unknown>> {
    return this.jobStore.listAuditEvents();
  }

  private createRunContext<T>(jobId: string, actor?: JobActor): JobRunContext<T> {
    return {
      job_id: jobId,
      updateProgress: (progress) => {
        const current = this.jobStore.get(jobId) as JobEnvelope<T>;
        if (current.status === "canceled") {
          throw new JobCanceledSignal();
        }
        const updated: JobEnvelope<T> = {
          ...current,
          progress: {
            ...current.progress,
            ...progress
          }
        };
        this.jobStore.save(updated);
        return this.audit(updated, "progress", updated.progress.message, actor);
      },
      checkCanceled: () => {
        if (this.jobStore.get(jobId).status === "canceled") {
          throw new JobCanceledSignal();
        }
      },
      isCancellationRequested: () => this.jobStore.get(jobId).status === "canceled"
    };
  }

  private cancelPersistedJob<T>(jobId: string, actor: JobActor | undefined, message: string): JobEnvelope<T> {
    const job = this.jobStore.get(jobId) as JobEnvelope<T>;
    if (job.status === "canceled") {
      return job;
    }
    const canceled: JobEnvelope<T> = {
      ...job,
      status: "canceled",
      finished_at: new Date().toISOString(),
      progress: {
        ...job.progress,
        message: "Canceled"
      }
    };
    this.jobStore.save(canceled);
    return this.audit(canceled, "canceled", message, actor);
  }

  private audit<T>(
    job: JobEnvelope<T>,
    action: JobEnvelope["audit"][number]["action"],
    message: string,
    actor?: JobActor
  ): JobEnvelope<T> {
    return this.jobStore.appendAudit(job, {
      occurred_at: new Date().toISOString(),
      action,
      account_id: actor?.account_id ?? job.actor?.account_id ?? null,
      auth_source: actor?.auth_source ?? job.actor?.auth_source ?? null,
      request_id: actor?.request_id ?? job.actor?.request_id ?? null,
      message
    });
  }
}

class JobCanceledSignal extends Error {
  constructor() {
    super("Job canceled.");
    this.name = "JobCanceledSignal";
  }
}

function normalizeRunOptions(optionsOrClientJobId?: JobRunOptions | string): JobRunOptions {
  if (typeof optionsOrClientJobId === "string") {
    return { clientJobId: optionsOrClientJobId };
  }
  return optionsOrClientJobId ?? {};
}

function normalizeClientJobId(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(trimmed)) {
    throw new LwsError("SCHEMA_INVALID", "client_job_id is invalid.", { client_job_id: value });
  }
  return trimmed;
}
