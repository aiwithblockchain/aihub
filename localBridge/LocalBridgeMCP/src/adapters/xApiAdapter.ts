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

export interface XTweetDetail {
  [key: string]: unknown;
}

export interface XTweetReplies {
  [key: string]: unknown;
}

export interface XUserProfile {
  [key: string]: unknown;
}

export interface XApiAdapterDeps {
  client: LocalBridgeClient;
  logger: Logger;
  config: LocalBridgeMcpConfig;
}

function buildInstanceScopedPath(path: string, instanceId?: string): string {
  if (instanceId === undefined) {
    return path;
  }

  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}instanceId=${encodeURIComponent(instanceId)}`;
}

export class XApiAdapter {
  constructor(private readonly deps: XApiAdapterDeps) {}

  async listInstances(timeoutMs?: number): Promise<XInstance[]> {
    this.deps.logger.debug('Listing X instances from LocalBridge');

    return this.deps.client.get<XInstance[]>('/api/v1/x/instances', timeoutMs);
  }

  async getStatus(instanceId?: string, timeoutMs?: number): Promise<XStatus> {
    this.deps.logger.debug('Getting X status from LocalBridge', {
      instanceId: instanceId ?? null,
    });

    return this.deps.client.get<XStatus>(
      buildInstanceScopedPath('/api/v1/x/status', instanceId),
      timeoutMs,
    );
  }

  async getBasicInfo(instanceId?: string, timeoutMs?: number): Promise<XBasicInfo> {
    this.deps.logger.debug('Getting X basic info from LocalBridge', {
      instanceId: instanceId ?? null,
    });

    return this.deps.client.get<XBasicInfo>(
      buildInstanceScopedPath('/api/v1/x/basic_info', instanceId),
      timeoutMs,
    );
  }

  async getHomeTimeline(instanceId?: string, timeoutMs?: number): Promise<XHomeTimeline> {
    this.deps.logger.debug('Getting X home timeline from LocalBridge', {
      instanceId: instanceId ?? null,
    });

    return this.deps.client.get<XHomeTimeline>(
      buildInstanceScopedPath('/api/v1/x/timeline', instanceId),
      timeoutMs,
    );
  }

  async getTweet(
    tweetId: string,
    instanceId?: string,
    timeoutMs?: number,
  ): Promise<XTweetDetail> {
    this.deps.logger.debug('Getting X tweet detail from LocalBridge', {
      tweetId,
      instanceId: instanceId ?? null,
    });

    return this.deps.client.get<XTweetDetail>(
      buildInstanceScopedPath(`/api/v1/x/tweets/${encodeURIComponent(tweetId)}`, instanceId),
      timeoutMs,
    );
  }

  async getTweetReplies(
    tweetId: string,
    cursor?: string,
    instanceId?: string,
    timeoutMs?: number,
  ): Promise<XTweetReplies> {
    this.deps.logger.debug('Getting X tweet replies from LocalBridge', {
      tweetId,
      cursor: cursor ?? null,
      instanceId: instanceId ?? null,
    });

    const params = new URLSearchParams();
    if (cursor !== undefined) {
      params.set('cursor', cursor);
    }

    if (instanceId !== undefined) {
      params.set('instanceId', instanceId);
    }

    const path = params.size > 0
      ? `/api/v1/x/tweets/${encodeURIComponent(tweetId)}/replies?${params.toString()}`
      : `/api/v1/x/tweets/${encodeURIComponent(tweetId)}/replies`;

    return this.deps.client.get<XTweetReplies>(path, timeoutMs);
  }

  async getUserProfile(
    screenName: string,
    instanceId?: string,
    timeoutMs?: number,
  ): Promise<XUserProfile> {
    this.deps.logger.debug('Getting X user profile from LocalBridge', {
      screenName,
      instanceId: instanceId ?? null,
    });

    const params = new URLSearchParams({
      screenName,
    });

    if (instanceId !== undefined) {
      params.set('instanceId', instanceId);
    }

    return this.deps.client.get<XUserProfile>(
      `/api/v1/x/users?${params.toString()}`,
      timeoutMs,
    );
  }
}
