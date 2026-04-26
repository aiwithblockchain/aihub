import type { LocalBridgeMcpConfig } from './types.js';

export const defaultConfig: LocalBridgeMcpConfig = {
  localbridgeBaseUrl: 'http://127.0.0.1:10088',
  enabledTools: null,
  readOnlyMode: false,
  defaultInstanceId: null,
  requestTimeoutMs: 30000,
  debugLogging: true,
  exposeRawPayload: true,
};
