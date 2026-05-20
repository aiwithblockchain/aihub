/**
 * Account semantic object.
 * Source: docs/04-x-semantic-data-model.md Section 6
 */
export interface AccountSummary {
    userId: string | null;
    handle: string; // Restored to required as per docs/04
    displayName: string | null;
    verified: boolean;
    avatarUrl: string | null;
    bio: string | null;
}

export type Platform = 'x-web';
export type ProfileMode = 'chrome';
export type RouteKind = 'home' | 'thread' | 'search' | 'notification' | 'profile' | 'xhs_explore' | 'xhs_note' | 'xhs_user' | 'unknown' | 'none';

/**
 * Session status payload.
 * Source: docs/03-tool-contracts.md Section 6.1
 */
export interface SessionStatus {
    connected: boolean;
    platform: Platform;
    profileMode: ProfileMode;
    tabBound: boolean;
    sessionValid: boolean;
    routeKind: RouteKind;
    account: AccountSummary | null;
}

export interface WorkspaceTab {
    tabId: number;
    url: string;
    active: boolean;
    routeKind: RouteKind;
    accountHandle: string | null;
}
