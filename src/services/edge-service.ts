import type { RequestContext } from "../shared/request-context.ts";
import type { LwsEdge } from "../shared/object-model.ts";
import type { CreateObjectCommand, DeleteObjectCommand, MutationResult, PatchObjectCommand } from "./mutation-service.ts";
import { MutationService } from "./mutation-service.ts";

export class EdgeService {
  private readonly mutationService?: MutationService;

  constructor(mutationService?: MutationService) {
    this.mutationService = mutationService;
  }

  createEdge(command: CreateObjectCommand<LwsEdge>, context: RequestContext): MutationResult<LwsEdge> {
    return this.requireMutationService().createObject("edge", command, context) as MutationResult<LwsEdge>;
  }

  patchEdge(command: PatchObjectCommand, context: RequestContext): MutationResult<LwsEdge> {
    return this.requireMutationService().patchObject("edge", command, context) as MutationResult<LwsEdge>;
  }

  deleteEdge(command: DeleteObjectCommand, context: RequestContext): MutationResult<LwsEdge> {
    return this.requireMutationService().deleteObject("edge", command, context) as MutationResult<LwsEdge>;
  }

  private requireMutationService(): MutationService {
    if (!this.mutationService) {
      throw new Error("EdgeService mutation pipeline is not configured.");
    }
    return this.mutationService;
  }
}
