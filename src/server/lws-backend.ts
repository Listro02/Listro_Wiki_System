import { PublicBoundaryChecker } from "../modules/admin/public-boundary-checker.ts";
import { StorageValidationJob } from "../modules/admin/storage-validation-job.ts";
import { resolveHttpRequestContext } from "../modules/auth/request-context-adapter.ts";
import { BackupWriter } from "../modules/backup/backup-writer.ts";
import { loadRuntimeConfig } from "../modules/config/runtime-config.ts";
import { EventStore } from "../modules/events/event-store.ts";
import { IndexStore } from "../modules/indexing/index-store.ts";
import { ReindexCommand } from "../modules/indexing/reindex-command.ts";
import { JobStore } from "../modules/jobs/job-store.ts";
import { CoreOntologyMaterializer } from "../modules/ontology/core-ontology-materializer.ts";
import { ObjectStore } from "../modules/storage/object-store.ts";
import { PathResolver } from "../modules/storage/path-resolver.ts";
import { ValidationService } from "../modules/validation/validation-service.ts";
import { AdminService } from "../services/admin-service.ts";
import { EdgeService } from "../services/edge-service.ts";
import { GraphService } from "../services/graph-service.ts";
import { HistoryService } from "../services/history-service.ts";
import { JobService } from "../services/job-service.ts";
import { MutationService } from "../services/mutation-service.ts";
import { NodeService } from "../services/node-service.ts";
import { ObjectQueryService } from "../services/object-query-service.ts";
import { ObjectService } from "../services/object-service.ts";
import { OntologyService } from "../services/ontology-service.ts";
import { PermissionService } from "../services/permission-service.ts";
import { SessionService } from "../services/session-service.ts";
import { TimelineService } from "../services/timeline-service.ts";

export function createLwsBackend() {
  const config = loadRuntimeConfig();
  const objectStore = new ObjectStore(new PathResolver(config));
  const validationService = new ValidationService(objectStore);
  const eventStore = new EventStore(config);
  const indexStore = new IndexStore(config);
  const jobStore = new JobStore(config);
  const jobService = new JobService(jobStore);
  const permissionService = new PermissionService({
    adminBootstrapAccount: config.auth.adminBootstrapAccount,
    indexStore
  });
  const mutationService = new MutationService(objectStore, validationService, permissionService, eventStore, indexStore);
  const reindexCommand = new ReindexCommand(objectStore, validationService, indexStore);
  const coreOntologyMaterializer = new CoreOntologyMaterializer(objectStore, mutationService);

  return {
    config,
    permissionService,
    resolveRequestContext: (request: Request) =>
      resolveHttpRequestContext(request, config, permissionService).context,
    objectStore,
    validationService,
    eventStore,
    indexStore,
    objectService: new ObjectService(objectStore, permissionService, validationService, indexStore),
    objectQueryService: new ObjectQueryService(indexStore, permissionService),
    nodeService: new NodeService(mutationService),
    edgeService: new EdgeService(mutationService),
    graphService: new GraphService(indexStore, permissionService),
    historyService: new HistoryService(objectStore, eventStore, permissionService, indexStore),
    timelineService: new TimelineService(indexStore, permissionService),
    ontologyService: new OntologyService(indexStore, permissionService),
    sessionService: new SessionService(permissionService),
    jobService,
    adminService: new AdminService({
      permissionService,
      jobService,
      reindexCommand,
      eventStore,
      validationJob: new StorageValidationJob(objectStore, validationService, indexStore, config),
      publicBoundaryChecker: new PublicBoundaryChecker(objectStore, validationService),
      coreOntologyMaterializer,
      backupWriter: new BackupWriter(config),
      indexStore
    }),
    reindexCommand,
    mutationService
  };
}
