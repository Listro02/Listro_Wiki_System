import fs from "node:fs";
import path from "node:path";

import type { RuntimeConfig } from "../config/runtime-config.ts";
import { LwsError } from "../../shared/errors.ts";
import type { JobActor, JobAuditEntry, JobEnvelope } from "./job-types.ts";

export class JobStore {
  private readonly root: string;
  private readonly auditPath: string;

  constructor(config: RuntimeConfig) {
    this.root = path.join(config.roots.runtime, "jobs");
    this.auditPath = path.join(config.roots.runtime, "admin-audit", "jobs.jsonl");
  }

  create<T>(type: string, clientJobId?: string, actor?: JobActor): JobEnvelope<T> {
    const now = new Date().toISOString();
    return {
      job_id: `job.${now.slice(0, 10).replaceAll("-", "")}.${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      type,
      status: "queued",
      created_at: now,
      started_at: null,
      finished_at: null,
      progress: {
        current: 0,
        total: null,
        message: "Queued"
      },
      result: null,
      error: null,
      ...(clientJobId ? { client_job_id: clientJobId } : {}),
      ...(actor ? { actor } : {}),
      audit: []
    };
  }

  save<T>(job: JobEnvelope<T>): void {
    fs.mkdirSync(this.root, { recursive: true });
    fs.writeFileSync(this.pathFor(job.job_id), `${JSON.stringify(job, null, 2)}\n`, "utf8");
  }

  get(jobId: string): JobEnvelope {
    const filePath = this.pathFor(jobId);
    if (!fs.existsSync(filePath)) {
      throw new LwsError("JOB_NOT_FOUND", "Job was not found.", { job_id: jobId });
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8")) as JobEnvelope;
  }

  findByClientJobId(type: string, clientJobId: string): JobEnvelope | null {
    return this.list().find((job) => job.type === type && job.client_job_id === clientJobId) ?? null;
  }

  list(): JobEnvelope[] {
    if (!fs.existsSync(this.root)) {
      return [];
    }

    return fs
      .readdirSync(this.root)
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(fs.readFileSync(path.join(this.root, file), "utf8")) as JobEnvelope)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  appendAudit<T>(job: JobEnvelope<T>, entry: JobAuditEntry): JobEnvelope<T> {
    const updated: JobEnvelope<T> = {
      ...job,
      audit: [...(job.audit ?? []), entry]
    };
    this.save(updated);
    fs.mkdirSync(path.dirname(this.auditPath), { recursive: true });
    fs.appendFileSync(
      this.auditPath,
      `${JSON.stringify({
        job_id: updated.job_id,
        type: updated.type,
        status: updated.status,
        client_job_id: updated.client_job_id ?? null,
        ...entry
      })}\n`,
      "utf8"
    );
    return updated;
  }

  listAuditEvents(): Array<Record<string, unknown>> {
    if (!fs.existsSync(this.auditPath)) {
      return [];
    }

    return fs
      .readFileSync(this.auditPath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  private pathFor(jobId: string): string {
    if (!/^job\.[A-Za-z0-9.]+$/.test(jobId)) {
      throw new LwsError("JOB_NOT_FOUND", "Job id is invalid.", { job_id: jobId });
    }
    return path.join(this.root, `${jobId}.json`);
  }
}
