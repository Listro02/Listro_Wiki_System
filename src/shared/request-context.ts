export type AuthSource = "anonymous" | "session" | "local-script" | "system";

export type RequestContext = {
  accountId: string | null;
  isAnonymous: boolean;
  requestId: string;
  authSource: AuthSource;
};

export function createAnonymousContext(requestId = crypto.randomUUID()): RequestContext {
  return {
    accountId: null,
    isAnonymous: true,
    requestId,
    authSource: "anonymous"
  };
}

export function createSystemContext(accountId: string, requestId = crypto.randomUUID()): RequestContext {
  return {
    accountId,
    isAnonymous: false,
    requestId,
    authSource: "system"
  };
}
