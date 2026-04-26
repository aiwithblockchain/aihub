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

export interface XStatusTab {
  tabId: number;
  url: string;
  active: boolean;
}

export interface XStatus {
  hasXTabs: boolean;
  isLoggedIn: boolean;
  activeXTabId?: number | null;
  activeXUrl?: string | null;
  tabs: XStatusTab[];
}

export interface XBasicInfo {
  isLoggedIn: boolean;
  name?: string | null;
  screenName?: string | null;
  twitterId?: string | null;
  verified?: boolean | null;
  followersCount?: number | null;
  friendsCount?: number | null;
  statusesCount?: number | null;
  avatar?: string | null;
  description?: string | null;
  createdAt?: string | null;
  raw?: unknown;
  updatedAt?: number | null;
}

export interface XHomeTimeline {
  [key: string]: unknown;
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

  async getStatus(timeoutMs?: number): Promise<XStatus> {
    this.deps.logger.debug('Getting X status from LocalBridge');

    return this.deps.client.get<XStatus>('/api/v1/x/status', timeoutMs);
  }

  async getBasicInfo(timeoutMs?: number): Promise<XBasicInfo> {
    this.deps.logger.debug('Getting X basic info from LocalBridge');

    return this.deps.client.get<XBasicInfo>('/api/v1/x/basic_info', timeoutMs);
  }

  async getHomeTimeline(timeoutMs?: number): Promise<XHomeTimeline> {
    this.deps.logger.debug('Getting X home timeline from LocalBridge');

    return this.deps.client.get<XHomeTimeline>('/api/v1/x/timeline', timeoutMs);
  }
}
