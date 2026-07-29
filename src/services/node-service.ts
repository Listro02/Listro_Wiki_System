import type { RequestContext } from "../shared/request-context.ts";
import type { LwsNode } from "../shared/object-model.ts";
import type { CreateObjectCommand, DeleteObjectCommand, MutationResult, PatchObjectCommand } from "./mutation-service.ts";
import { MutationService } from "./mutation-service.ts";

export class NodeService {
  private readonly mutationService?: MutationService;

  constructor(mutationService?: MutationService) {
    this.mutationService = mutationService;
  }

  createNode(command: CreateObjectCommand<LwsNode>, context: RequestContext): MutationResult<LwsNode> {
    return this.requireMutationService().createObject("node", command, context) as MutationResult<LwsNode>;
  }

  patchNode(command: PatchObjectCommand, context: RequestContext): MutationResult<LwsNode> {
    return this.requireMutationService().patchObject("node", command, context) as MutationResult<LwsNode>;
  }

  deleteNode(command: DeleteObjectCommand, context: RequestContext): MutationResult<LwsNode> {
    return this.requireMutationService().deleteObject("node", command, context) as MutationResult<LwsNode>;
  }

  private requireMutationService(): MutationService {
    if (!this.mutationService) {
      throw new Error("NodeService mutation pipeline is not configured.");
    }
    return this.mutationService;
  }
}
