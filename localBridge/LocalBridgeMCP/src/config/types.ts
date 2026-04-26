export interface LocalBridgeMcpConfig {
  localbridgeBaseUrl: string;
  enabledTools: string[] | null;
  readOnlyMode: boolean;
  defaultInstanceId: string | null;
  requestTimeoutMs: number;
  debugLogging: boolean;
  exposeRawPayload: boolean;
}
