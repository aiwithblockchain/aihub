import type { LocalBridgeMcpConfig } from '../config/types.js';
import type { Logger } from '../logging/logger.js';
import type { LocalBridgeClient } from './localBridgeClient.js';

export interface XInstance {
  clientName: string;
  instanceId: string;
  instanceName?: string | null;
  clientVersion?: string;
  capabilities?: string[];
  connectedAt?: string;
  lastSeenAt?: string;
  xScreenName?: string | null;
  isTemporary?: boolean;
}

export interface XApiAdapterDeps {
  client: LocalBridgeClient;
  logger: Logger;
  config: LocalBridgeMcpConfig;
}

export class XApiAdapter {
  constructor(private readonly deps: XApiAdapterDeps) {}

  async listInstances(timeoutMs?: number): Promise<XInstance[]> {
    this.deps.logger.debug('Listing X instances from LocalBridge');

    return this.deps.client.get<XInstance[]>('/api/v1/x/instances', timeoutMs);
  }
}
