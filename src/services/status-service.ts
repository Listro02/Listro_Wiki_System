import type { RuntimeConfig } from "../modules/config/runtime-config.ts";
import { checkStorage, type StorageDoctorReport } from "../modules/storage/storage-doctor.ts";
import type { RequestContext } from "../shared/request-context.ts";

export type StatusResponse = {
  app: {
    name: string;
    env: RuntimeConfig["env"];
  };
  request: {
    request_id: string;
    auth_source: RequestContext["authSource"];
  };
  storage: StorageDoctorReport;
  public_config: RuntimeConfig["publicConfig"];
};

export class StatusService {
  getStatus(config: RuntimeConfig, context: RequestContext): StatusResponse {
    return {
      app: {
        name: config.appName,
        env: config.env
      },
      request: {
        request_id: context.requestId,
        auth_source: context.authSource
      },
      storage: checkStorage(config),
      public_config: config.publicConfig
    };
  }
}
