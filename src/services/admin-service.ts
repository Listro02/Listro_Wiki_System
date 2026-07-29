import type { ReindexCommand, ReindexResult } from "../modules/indexing/reindex-command.ts";
import type { EventStore } from "../modules/events/event-store.ts";
import type { RequestContext } from "../shared/request-context.ts";
import type { BackupWriter, BackupWriterResult } from "../modules/backup/backup-writer.ts";
import type {
  CoreOntologyMaterializer,
  CoreOntologyMaterializeResult
} from "../modules/ontology/core-ontology-materializer.ts";
import type { PublicBoundaryChecker, PublicBoundaryCheckResult } from "../modules/admin/public-boundary-checker.ts";
import type { StorageValidationJob, StorageValidationResult } from "../modules/admin/storage-validation-job.ts";
import type { PermissionService } from "./permission-service.ts";
import type { JobRunOptions, JobService } from "./job-service.ts";
import type { IndexStore } from "../modules/indexing/index-store.ts";

export type AdminJobOptions = {
  client_job_id?: string;
};

export class AdminService {
  private readonly permissionService?: PermissionService;
  private readonly jobService?: JobService;
  private readonly reindexCommand?: ReindexCommand;
  private readonly eventStore?: EventStore;
  private readonly validationJob?: StorageValidationJob;
  private readonly publicBoundaryChecker?: PublicBoundaryChecker;
  private readonly coreOntologyMaterializer?: CoreOntologyMaterializer;
  private readonly backupWriter?: BackupWriter;
  private readonly indexStore?: IndexStore;

  constructor(options: {
    permissionService?: PermissionService;
    jobService?: JobService;
    reindexCommand?: ReindexCommand;
    eventStore?: EventStore;
    validationJob?: StorageValidationJob;
    publicBoundaryChecker?: PublicBoundaryChecker;
    coreOntologyMaterializer?: CoreOntologyMaterializer;
    backupWriter?: BackupWriter;
    indexStore?: IndexStore;
  } = {}) {
    this.permissionService = options.permissionService;
    this.jobService = options.jobService;
    this.reindexCommand = options.reindexCommand;
    this.eventStore = options.eventStore;
    this.validationJob = options.validationJob;
    this.publicBoundaryChecker = options.publicBoundaryChecker;
    this.coreOntologyMaterializer = options.coreOntologyMaterializer;
    this.backupWriter = options.backupWriter;
    this.indexStore = options.indexStore;
  }

  reindex(context: RequestContext, options: AdminJobOptions = {}) {
    this.requirePermissionService().assertCanManageIn(context, "scope.system");
    return this.requireJobService().runSync<ReindexResult>(
      "reindex",
      (_job, run) => this.requireReindexCommand().run(run),
      this.toJobRunOptions(context, options)
    );
  }

  validate(context: RequestContext, options: AdminJobOptions = {}) {
    this.requirePermissionService().assertCanManageIn(context, "scope.system");
    return this.requireJobService().runSync<StorageValidationResult>(
      "validate",
      (_job, run) => this.requireValidationJob().run(run),
      this.toJobRunOptions(context, options)
    );
  }

  checkPublicBoundary(context: RequestContext, options: AdminJobOptions = {}) {
    this.requirePermissionService().assertCanManageIn(context, "scope.system");
    return this.requireJobService().runSync<PublicBoundaryCheckResult>(
      "check-public-boundary",
      (_job, run) => {
        run.updateProgress({ phase: "scan", current: 0, total: null, message: "Checking public boundary" });
        const result = this.requirePublicBoundaryChecker().run();
        run.updateProgress({
          phase: "scan",
          current: result.scanned_edge_count,
          total: result.scanned_edge_count,
          warning_count: result.violation_count,
          message: "Public boundary check complete"
        });
        return result;
      },
      this.toJobRunOptions(context, options)
    );
  }

  materializeCoreOntology(context: RequestContext, options: AdminJobOptions = {}) {
    this.requirePermissionService().assertCanManageIn(context, "scope.system");
    return this.requireJobService().runSync<CoreOntologyMaterializeResult>(
      "materialize-core-ontology",
      (_job, run) => {
        run.updateProgress({ phase: "materialize", current: 0, total: 1, message: "Materializing core ontology" });
        const result = this.requireCoreOntologyMaterializer().run(context.requestId);
        run.updateProgress({ phase: "materialize", current: 1, total: 1, message: "Core ontology materialized" });
        return result;
      },
      this.toJobRunOptions(context, options)
    );
  }

  backup(context: RequestContext, options: AdminJobOptions = {}) {
    this.requirePermissionService().assertCanManageIn(context, "scope.system");
    return this.requireJobService().runSync<BackupWriterResult>(
      "backup",
      (_job, run) => this.requireBackupWriter().writeSnapshot({}, run),
      this.toJobRunOptions(context, options)
    );
  }

  getRecoveryReport(context: RequestContext) {
    this.requirePermissionService().assertCanManageIn(context, "scope.system");
    const eventRecovery = this.requireEventStore().getRecoveryReport();
    const indexStatus = this.indexStore?.getStatus() ?? null;
    return {
      ...eventRecovery,
      index: indexStatus
        ? {
            status: indexStatus,
            recovery_action: indexStatus.state === "ready" ? "none" : "reindex"
          }
        : null
    };
  }

  repairFailedMutations(context: RequestContext) {
    this.requirePermissionService().assertCanManageIn(context, "scope.system");
    return this.requireEventStore().repairAllMutations();
  }

  listJobs(context: RequestContext) {
    this.requirePermissionService().assertCanManageIn(context, "scope.system");
    return this.requireJobService().listJobs();
  }

  getJob(context: RequestContext, jobId: string) {
    this.requirePermissionService().assertCanManageIn(context, "scope.system");
    return this.requireJobService().getJob(jobId);
  }

  cancelJob(context: RequestContext, jobId: string) {
    this.requirePermissionService().assertCanManageIn(context, "scope.system");
    return this.requireJobService().cancelJob(jobId);
  }

  private toJobRunOptions(context: RequestContext, options: AdminJobOptions): JobRunOptions {
    return {
      clientJobId: options.client_job_id,
      actor: {
        account_id: context.accountId,
        auth_source: context.authSource,
        request_id: context.requestId
      }
    };
  }

  private requirePermissionService(): PermissionService {
    if (!this.permissionService) {
      throw new Error("AdminService permission service is not configured.");
    }
    return this.permissionService;
  }

  private requireJobService(): JobService {
    if (!this.jobService) {
      throw new Error("AdminService job service is not configured.");
    }
    return this.jobService;
  }

  private requireReindexCommand(): ReindexCommand {
    if (!this.reindexCommand) {
      throw new Error("AdminService reindex command is not configured.");
    }
    return this.reindexCommand;
  }

  private requireEventStore(): EventStore {
    if (!this.eventStore) {
      throw new Error("AdminService event store is not configured.");
    }
    return this.eventStore;
  }

  private requireValidationJob(): StorageValidationJob {
    if (!this.validationJob) {
      throw new Error("AdminService validation job is not configured.");
    }
    return this.validationJob;
  }

  private requirePublicBoundaryChecker(): PublicBoundaryChecker {
    if (!this.publicBoundaryChecker) {
      throw new Error("AdminService public boundary checker is not configured.");
    }
    return this.publicBoundaryChecker;
  }

  private requireCoreOntologyMaterializer(): CoreOntologyMaterializer {
    if (!this.coreOntologyMaterializer) {
      throw new Error("AdminService core ontology materializer is not configured.");
    }
    return this.coreOntologyMaterializer;
  }

  private requireBackupWriter(): BackupWriter {
    if (!this.backupWriter) {
      throw new Error("AdminService backup writer is not configured.");
    }
    return this.backupWriter;
  }
}
