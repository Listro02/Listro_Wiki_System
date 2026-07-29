import type { AdminJobOptions } from "../../../../services/admin-service.ts";
import { assertRecord, optionalString, readJsonBody } from "../../../../shared/route-validation.ts";

export async function parseAdminJobOptions(request: Request): Promise<AdminJobOptions> {
  const parsed = assertRecord(await readJsonBody(request, { allowEmpty: true }), "Request body");
  const clientJobId = optionalString(parsed.client_job_id, "client_job_id");
  return clientJobId ? { client_job_id: clientJobId } : {};
}
