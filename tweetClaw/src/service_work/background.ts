/**
 * TweetClaw Background Service Worker
 *
 * AI-Oriented Architecture: 完全透传推特原始响应，不做任何数据解析和缓存
 */

import { MsgType, __DBK_query_id_map, __DBK_bearer_token, defaultQueryKeyMap } from '../capture/consts';
import { DEFAULT_WS_PORT, DEFAULT_REST_PORT } from '../config';
import { LocalBridgeSocket, AccountStatusResult } from '../bridge/local-bridge-socket';
import {
    OpenTabRequestPayload,
    OpenTabResponsePayload,
    CloseTabRequestPayload,
    CloseTabResponsePayload,
    NavigateTabRequestPayload,
    NavigateTabResponsePayload
} from '../bridge/ws-protocol';
import { BackgroundTaskCoordinator } from '../task/task-executor';
import { BackgroundSessionStore } from '../task/background-session-store';
import { getOrCreateInstanceId } from '../bridge/instance-id';
import { logger } from '../task/logger';
import { sendMessageToTab } from '../utils/message-utils';

// ── Type Definitions ──────────────────────────────────────────────────
interface TwitterResponse {
    success: boolean;
    data?: any;
    error?: string;
}

interface ExecActionPayload {
    action: string;
    tweetId?: string;
    userId?: string;
    tabId?: number;
    text?: string;
    media_ids?: string[];
    attachmentUrl?: string;
}

interface QueryTimelinePayload {
    tabId?: number;
}

interface QueryTweetPayload {
    tweetId: string;
    tabId?: number;
}

interface QueryTweetRepliesPayload {
    tweetId: string;
    tabId?: number;
    cursor?: string;
}

interface QueryUserProfilePayload {
    screenName: string;
    tabId?: number;
}

interface QuerySearchTimelinePayload {
    query?: string;
    cursor?: string;
    count?: number;
    tabId?: number;
    product?: string; // Top | Latest | People | Media（透传到 x.com GraphQL SearchTimeline.variables.product）
}

interface QueryUserTweetsPayload {
    userId: string;
    cursor?: string;
    count?: number;
    tabId?: number;
}

interface QueryFollowersPayload {
    userId: string;
    cursor?: string;
    count?: number;
    tabId?: number;
}

interface QueryFollowingPayload {
    userId: string;
    cursor?: string;
    count?: number;
    tabId?: number;
}

interface QueryBlueVerifiedFollowersPayload {
    userId: string;
    cursor?: string;
    count?: number;
    tabId?: number;
}

const backgroundSessionStore = new BackgroundSessionStore();


function getUploadSessionChunk(sessionId: string, chunkIndex: number) {
    return backgroundSessionStore.getChunk(sessionId, chunkIndex);
}

function releaseUploadSession(sessionId: string) {
    console.log(`[TweetClaw-BG] upload session released, sessionId=${sessionId}`);
    backgroundSessionStore.release(sessionId);
}

// Initialize LocalBridge Socket
const localBridge = new LocalBridgeSocket();
void localBridge.recordLifecycleEvent('sw_boot', 'background service worker evaluated');
localBridge.queryXTabsHandler = queryXTabsStatus;
localBridge.queryXBasicInfoHandler = queryXBasicInfo;
localBridge.queryXhsAccountInfoHandler = queryXhsAccountInfo;
localBridge.queryXhsHomefeedHandler = queryXhsHomefeed;
localBridge.queryXhsFeedHandler = queryXhsFeed;
localBridge.queryXhsSearchHandler = queryXhsSearch;
localBridge.queryXhsUserNotesHandler = queryXhsUserNotes;
localBridge.xhsPublishImageNoteHandler = publishXhsImageNote;
localBridge.xhsPublishVideoNoteHandler = publishXhsVideoNote;
localBridge.xhsCheckSignHealthHandler = checkXhsSignHealth;
localBridge.xhsGetNoteCommentsHandler = getXhsNoteComments;
localBridge.xhsGetUserInfoHandler = getXhsUserInfo;
localBridge.xhsSearchTopicsHandler = searchXhsTopics;
localBridge.xhsGetNotificationsHandler = getXhsNotifications;
localBridge.xhsGetPublishedNotesHandler = getXhsPublishedNotes;
localBridge.xhsSearchFilterHandler = getXhsSearchFilter;
localBridge.xhsPostCommentHandler = postXhsComment;
localBridge.xhsSearchUsersHandler = searchXhsUsers;
localBridge.xhsSearchUsersearchHandler = searchXhsUsersearch;
localBridge.xhsGetIntimacyListHandler = getXhsIntimacyList;
localBridge.xhsLikeNoteHandler = likeXhsNote;
localBridge.xhsUnlikeNoteHandler = unlikeXhsNote;
localBridge.xhsFollowUserHandler = followXhsUser;
localBridge.xhsUnfollowUserHandler = unfollowXhsUser;
localBridge.xhsCollectNoteHandler = collectXhsNote;
localBridge.xhsDeleteNoteHandler = deleteXhsNote;
localBridge.xhsDeleteCommentHandler = deleteXhsComment;
localBridge.xhsGetFriendFansHandler = getXhsFriendFans;
localBridge.xhsCreateCollectionHandler = createXhsCollection;
localBridge.xhsListCollectionsHandler = listXhsCollections;
localBridge.xhsListCollectionNotesHandler = listXhsCollectionNotes;
localBridge.xhsUpdateCollectionHandler = updateXhsCollection;
localBridge.xhsGetNoteDetailStatsHandler = getXhsNoteDetailStats;
localBridge.openTabHandler = openTabByPlatform;
localBridge.closeTabHandler = closeTabByPlatform;
localBridge.navigateTabHandler = navigateTabByPlatform;
localBridge.execActionHandler = execAction;
localBridge.queryHomeTimelineHandler = queryHomeTimeline;
localBridge.queryTweetRepliesHandler = queryTweetReplies;
localBridge.queryTweetDetailHandler = queryTweetDetail;
localBridge.queryUserProfileHandler = queryUserProfile;
localBridge.querySearchTimelineHandler = querySearchTimeline;
localBridge.queryUserTweetsHandler = queryUserTweets;
localBridge.queryFollowersHandler = queryFollowers;
localBridge.queryFollowingHandler = queryFollowing;
localBridge.queryBlueVerifiedFollowersHandler = queryBlueVerifiedFollowers;
localBridge.igCheckLoginHandler = igCheckLogin;
localBridge.igGetSelfInfoHandler = igGetSelfInfo;
localBridge.igGetUserInfoHandler = igGetUserInfo;
localBridge.igSearchUserHandler = igSearchUser;
localBridge.igGetFeedHandler = igGetFeed;
localBridge.igGetMediaHandler = igGetMedia;
localBridge.igLikeMediaHandler = igLikeMedia;
localBridge.igUnlikeMediaHandler = igUnlikeMedia;
localBridge.igFollowUserHandler = igFollowUser;
localBridge.igUnfollowUserHandler = igUnfollowUser;
localBridge.igPostCommentHandler = igPostComment;
localBridge.igDeleteCommentHandler = igDeleteComment;
localBridge.igPostMediaHandler = igPostMedia;
localBridge.igDeleteMediaHandler = igDeleteMedia;
localBridge.igGetUserMediaHandler = igGetUserMedia;
localBridge.igGetMediaCommentsHandler = igGetMediaComments;
localBridge.igSearchHandler = igSearch;
localBridge.igGetNotificationsHandler = igGetNotifications;
localBridge.igGetFollowersHandler = igGetFollowers;
localBridge.igGetFollowingHandler = igGetFollowing;
localBridge.collectAccountStatusesHandler = collectAccountStatuses;

// Initialize Background Task Coordinator
let taskCoordinator: BackgroundTaskCoordinator | null = null;
let taskCoordinatorReady = false;

async function getWindowCount(): Promise<number> {
    if (!chrome.windows?.getAll) {
        return -1;
    }

    try {
        const windows = await chrome.windows.getAll({ populate: false });
        return windows.length;
    } catch (e) {
        console.warn('[TweetClaw-BG] failed to read windows for activity log', e);
        return -1;
    }
}


async function reconcileBridgeActivity(reason: string, extra?: Record<string, unknown>) {
    const windowCount = await getWindowCount();
    const payload = {
        reason,
        windowCount,
        ...(extra || {})
    };

    if (windowCount === 0) {
        await localBridge.setDesiredActive(false, reason, payload);
        void localBridge.recordActivityState('inactive', reason, payload);
        console.log(`[TweetClaw-BG] reconcile bridge inactive: reason=${reason} windowCount=0, ${localBridge.getDebugIdentityLabel()} state=${JSON.stringify(localBridge.getConnectionDebugState())} extra=${JSON.stringify(extra || {})}`);
        localBridge.ensureDisconnected(reason);
        taskCoordinator?.handleDisconnect();
        backgroundSessionStore.clear();
        return;
    }

    await localBridge.setDesiredActive(true, reason, payload);
    void localBridge.recordActivityState('active', reason, payload);
    console.log(`[TweetClaw-BG] reconcile bridge active: reason=${reason} windowCount=${windowCount}, ${localBridge.getDebugIdentityLabel()} state=${JSON.stringify(localBridge.getConnectionDebugState())} extra=${JSON.stringify(extra || {})}`);
    await localBridge.ensureConnected(reason);
}

let reconcileInFlight: Promise<void> | null = null;
let pendingReconcileRequest: { reason: string; extra?: Record<string, unknown> } | null = null;

function requestBridgeReconcile(reason: string, extra?: Record<string, unknown>) {
    pendingReconcileRequest = { reason, extra };

    if (reconcileInFlight) {
        console.log(`[TweetClaw-BG] reconcile request coalesced: reason=${reason}, ${localBridge.getDebugIdentityLabel()} extra=${JSON.stringify(extra || {})}`);
        return reconcileInFlight;
    }

    reconcileInFlight = (async () => {
        while (pendingReconcileRequest) {
            const request = pendingReconcileRequest;
            pendingReconcileRequest = null;
            await reconcileBridgeActivity(request.reason, request.extra);
        }
    })().finally(() => {
        reconcileInFlight = null;
    });

    return reconcileInFlight;
}

requestBridgeReconcile('service worker boot', {
    trigger: 'service worker boot'
}).catch((e) => console.warn('[TweetClaw-BG] failed to reconcile bridge on service worker boot', e));

chrome.storage.local.get(['wsHost', 'wsPort', 'restHost', 'restPort']).then(async res => {
    const wsHost = res.wsHost || '127.0.0.1';
    const wsPort = res.wsPort || DEFAULT_WS_PORT;
    const restHost = res.restHost || wsHost;
    const restPort = res.restPort || DEFAULT_REST_PORT;
    const instanceId = await getOrCreateInstanceId();
    console.log(`[TweetClaw-BG] background bootstrap resolved instanceId=${instanceId} ws=${wsHost}:${wsPort} rest=${restHost}:${restPort}`);

    taskCoordinator = new BackgroundTaskCoordinator(localBridge, {
        localBridgeBaseUrl: `http://${restHost}:${restPort}`,
        clientName: 'tweetClaw',
        instanceId: instanceId,
        fetchTimeoutMs: (res.fetchTimeoutMs as number) || 30000,
        uploadTimeoutMs: (res.uploadTimeoutMs as number) || 60000
    }, backgroundSessionStore);

    logger.info(
        `[BackgroundTaskCoordinator] Using endpoints ws=${wsHost}:${wsPort} rest=${restHost}:${restPort}`
    );
    
    // Auto configure log level if specified
    if (res.logLevel) {
        logger.setLevel(res.logLevel as any);
    }
    
    taskCoordinatorReady = true;

    localBridge.startTaskHandler = async (payload) => {
        if (!taskCoordinatorReady) {
            logger.warn('[BackgroundTaskCoordinator] Not ready yet, ignoring start_task');
            return;
        }
        if (taskCoordinator) {
            taskCoordinator.startTask(payload).catch(e => logger.error('[BackgroundTaskCoordinator] start hook error', e));
        }
    };
    
    localBridge.cancelTaskHandler = async (payload) => {
        if (!taskCoordinatorReady) return;
        if (taskCoordinator) {
            taskCoordinator.cancelTask(payload.taskId).catch(e => logger.error('[BackgroundTaskCoordinator] cancel hook error', e));
        }
    };
});

// hook reconnect to flush background task coordinator cancelling stale runs
const originalHandleReconnect = localBridge.handleReconnectAlarm.bind(localBridge);
localBridge.handleReconnectAlarm = function(windowCount?: number) {
    if (taskCoordinator) taskCoordinator.handleDisconnect();
    return originalHandleReconnect(windowCount);
};

// ── Home refresh alarm (A41 stage 4) ──────────────────────────────
//
// 把 online 账号的非活动 tab 刷新到平台首页，保活登录 session。
// "长时间无操作" 的低成本代理：非 active tab = 用户切走后未再操作。
// 只刷新已存在的 tab，不新建 tab；跳过 active tab 避免打断用户浏览。
// 间隔随机化：下次触发在 30~60 分钟之间，避免固定周期形成 bot 指纹。
const HOME_REFRESH_ALARM_NAMES = {
    twitter:      'tweetclaw-home-refresh-twitter',
    instagram:    'tweetclaw-home-refresh-instagram',
    xiaohongshu:  'tweetclaw-home-refresh-xhs',
} as const;

const HOME_REFRESH_LEGACY_ALARM_NAME = 'tweetclaw-home-refresh';
const HOME_REFRESH_MIN_MINUTES = 90;
const HOME_REFRESH_MAX_MINUTES = 120;

interface PlatformRefreshConfig {
    platform: 'twitter' | 'instagram' | 'xiaohongshu';
    urlPatterns: string[];
    homeUrl: string;
    // 小红书有两套域名（主站 + 创作者中心），用数组表达
    extraRefreshes?: { urlPatterns: string[]; homeUrl: string }[];
}

const PLATFORM_REFRESH_CONFIGS: PlatformRefreshConfig[] = [
    {
        platform: 'twitter',
        urlPatterns: ['*://x.com/*', '*://twitter.com/*'],
        homeUrl: 'https://x.com/home',
    },
    {
        platform: 'instagram',
        urlPatterns: ['*://www.instagram.com/*', '*://instagram.com/*'],
        homeUrl: 'https://www.instagram.com/',
    },
    {
        platform: 'xiaohongshu',
        urlPatterns: ['*://www.xiaohongshu.com/*', '*://xiaohongshu.com/*'],
        homeUrl: 'https://www.xiaohongshu.com/explore',
        extraRefreshes: [
            {
                urlPatterns: ['*://creator.xiaohongshu.com/*'],
                homeUrl: 'https://creator.xiaohongshu.com/new/home?source=official',
            },
        ],
    },
];

function nextHomeRefreshDelayMinutes(): number {
    return HOME_REFRESH_MIN_MINUTES + Math.random() * (HOME_REFRESH_MAX_MINUTES - HOME_REFRESH_MIN_MINUTES);
}

// SW 启动时为每个平台独立安排 alarm（若不存在）。
// 三个平台各自独立随机延迟，首次触发时刻天然错开，避免同步指纹。
for (const cfg of PLATFORM_REFRESH_CONFIGS) {
    const alarmName = HOME_REFRESH_ALARM_NAMES[cfg.platform];
    chrome.alarms.get(alarmName, (existing) => {
        if (!existing) {
            const delay = nextHomeRefreshDelayMinutes();
            chrome.alarms.create(alarmName, { delayInMinutes: delay });
            console.log(
                `[tweetClaw][A41][home-refresh] ${cfg.platform} alarm created (next fire in ${delay.toFixed(1)}min)`
            );
        }
    });
}

// ── Listen for reconnect alarms ──────────────────────────────────
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'tweetclaw-reconnect') {
        void localBridge.recordLifecycleEvent('bg_alarm_reconnect', 'background onAlarm listener', {
            alarmName: alarm.name
        });
        void (async () => {
            const windowCount = await getWindowCount();
            if (windowCount === 0) {
                await localBridge.setDesiredActive(false, 'alarm reconnect fired', {
                    alarmName: alarm.name,
                    trigger: 'chrome.alarms.onAlarm',
                    windowCount
                });
                void localBridge.recordActivityState('inactive', 'alarm reconnect fired', {
                    alarmName: alarm.name,
                    trigger: 'chrome.alarms.onAlarm',
                    windowCount
                });
                console.log(`[TweetClaw-BG] reconnect alarm skipped by reconcile: windowCount=0, ${localBridge.getDebugIdentityLabel()} state=${JSON.stringify(localBridge.getConnectionDebugState())}`);
                localBridge.handleReconnectAlarm(windowCount);
                taskCoordinator?.handleDisconnect();
                backgroundSessionStore.clear();
                return;
            }

            console.log(`[TweetClaw-BG] reconnect alarm delegates to active reconcile, windowCount=${windowCount}, ${localBridge.getDebugIdentityLabel()}`);
            await requestBridgeReconcile('alarm reconnect fired', {
                alarmName: alarm.name,
                trigger: 'chrome.alarms.onAlarm',
                windowCount
            });
        })().catch((e) => console.warn('[TweetClaw-BG] failed to reconcile bridge on alarm', e));
        return;
    }
    // 一次性迁移：旧的单 alarm 触发时，按新逻辑刷新所有平台然后删除自己
    if (alarm.name === HOME_REFRESH_LEGACY_ALARM_NAME) {
        void (async () => {
            console.log('[tweetClaw][A41][home-refresh] legacy alarm fired, migrating');
            for (const cfg of PLATFORM_REFRESH_CONFIGS) {
                await refreshSinglePlatformHome(cfg.platform);
            }
            await chrome.alarms.clear(HOME_REFRESH_LEGACY_ALARM_NAME);
            // 确保三个新 alarm 都已安排
            for (const cfg of PLATFORM_REFRESH_CONFIGS) {
                const name = HOME_REFRESH_ALARM_NAMES[cfg.platform];
                const existing = await chrome.alarms.get(name);
                if (!existing) {
                    const delay = nextHomeRefreshDelayMinutes();
                    await chrome.alarms.create(name, { delayInMinutes: delay });
                }
            }
        })().catch((e) =>
            console.warn('[tweetClaw][A41][home-refresh] legacy migration failed', e)
        );
        return;
    }

    // 找到触发的是哪个平台的 alarm
    const platformEntry = Object.entries(HOME_REFRESH_ALARM_NAMES)
        .find(([_, name]) => name === alarm.name);
    if (platformEntry) {
        const platform = platformEntry[0] as keyof typeof HOME_REFRESH_ALARM_NAMES;
        void (async () => {
            try {
                console.log(`[tweetClaw][A41][home-refresh] ${platform} alarm fired`);
                await refreshSinglePlatformHome(platform);
            } finally {
                // 无论成功失败都重新安排下一次，避免链中断
                const delay = nextHomeRefreshDelayMinutes();
                await chrome.alarms.create(alarm.name, { delayInMinutes: delay });
                console.log(
                    `[tweetClaw][A41][home-refresh] ${platform} next fire in ${delay.toFixed(1)}min`
                );
            }
        })().catch((e) =>
            console.warn(`[tweetClaw][A41][home-refresh] ${platform} failed`, e)
        );
        return;
    }
});

chrome.runtime.onStartup?.addListener(() => {
    void localBridge.recordLifecycleEvent('runtime_startup', 'chrome.runtime.onStartup');
    console.log(`[TweetClaw-BG] runtime startup, ${localBridge.getDebugIdentityLabel()}`);
    void requestBridgeReconcile('runtime startup', {
        trigger: 'chrome.runtime.onStartup'
    }).catch((e) => console.warn('[TweetClaw-BG] failed to reconcile bridge on startup', e));
});

chrome.runtime.onInstalled.addListener(() => {
    initDefaultQueryKeys();
    void localBridge.recordLifecycleEvent('runtime_installed', 'chrome.runtime.onInstalled');
    console.log(`[TweetClaw-BG] Extension installed/updated, ${localBridge.getDebugIdentityLabel()}`);
    void requestBridgeReconcile('runtime installed', {
        trigger: 'chrome.runtime.onInstalled'
    }).catch((e) => console.warn('[TweetClaw-BG] failed to reconcile bridge on install', e));
});

chrome.runtime.onSuspend.addListener(() => {
    void localBridge.recordLifecycleEvent('runtime_suspend', 'chrome.runtime.onSuspend');
    console.log(`[TweetClaw-BG] runtime suspend, ${localBridge.getDebugIdentityLabel()}`);
    localBridge.ensureDisconnected('runtime suspend');
    taskCoordinator?.handleDisconnect();
    backgroundSessionStore.clear();
});

chrome.windows?.onCreated?.addListener((window) => {
    void localBridge.recordLifecycleEvent('window_created', 'chrome.windows.onCreated', {
        windowId: window.id ?? null,
        windowType: window.type ?? null
    });
    void requestBridgeReconcile('window created', {
        windowId: window.id ?? null,
        windowType: window.type ?? null,
        trigger: 'chrome.windows.onCreated'
    }).catch((e) => console.warn('[TweetClaw-BG] failed to reconcile bridge on window created', e));
});

chrome.windows?.onRemoved?.addListener((windowId) => {
    void localBridge.recordLifecycleEvent('window_removed', 'chrome.windows.onRemoved', {
        windowId
    });
    void requestBridgeReconcile('window removed', {
        windowId,
        trigger: 'chrome.windows.onRemoved'
    }).catch((e) => console.warn('[TweetClaw-BG] failed to reconcile bridge on window removed', e));
});

// ── 初始化默认 QueryID 映射 ───────────────────────────────────────
async function initDefaultQueryKeys() {
    const res = await chrome.storage.local.get(__DBK_query_id_map);
    let map = (res[__DBK_query_id_map] || {}) as Record<string, string>;
    let changed = false;
    for (const [op, id] of Object.entries(defaultQueryKeyMap)) {
        if (!map[op]) {
            map[op] = id;
            changed = true;
        }
    }
    if (changed) {
        await chrome.storage.local.set({ [__DBK_query_id_map]: map });
        console.log("[TweetClaw-BG] Default QueryIDs initialized");
    }
}

// ── 获取认证 UID ──────────────────────────────────────────────────
async function getAuthenticUid(): Promise<string | null> {
    return new Promise(resolve => {
        chrome.cookies.get({ url: 'https://x.com', name: 'twid' }, cookie => {
            if (cookie?.value) {
                const decoded = decodeURIComponent(cookie.value);
                const match = decoded.match(/u=(\d+)/);
                resolve(match ? match[1] : decoded);
            } else {
                resolve(null);
            }
        });
    });
}

// ── 自动收割 QueryID 和 Bearer Token ──────────────────────────────
async function harvestQueryId(op: string, apiUrl: string) {
    if (!apiUrl) return;
    const match = apiUrl.match(/\/graphql\/([^/?#\s]+)\/([^/?#\s]+)/);
    if (!match) return;
    const [, queryId, opFromUrl] = match;
    const key = op || opFromUrl;
    if (!key || !queryId) return;

    const res = await chrome.storage.local.get(__DBK_query_id_map);
    const map = (res[__DBK_query_id_map] || {}) as Record<string, string>;
    if (map[key] !== queryId) {
        map[key] = queryId;
        await chrome.storage.local.set({ [__DBK_query_id_map]: map });
        console.log(`[TweetClaw-BG] Harvested QueryID: ${key} → ${queryId}`);
    }
}

async function harvestBearer(bearer: string | null | undefined) {
    if (!bearer || !bearer.startsWith('Bearer ')) return;
    const res = await chrome.storage.local.get(__DBK_bearer_token);
    if (res[__DBK_bearer_token] !== bearer) {
        await chrome.storage.local.set({ [__DBK_bearer_token]: bearer });
        console.log('[TweetClaw-BG] Harvested bearer token');
    }
}

// ── 消息中枢 ─────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

    // Bridge 状态查询
    if (message.type === 'GET_BRIDGE_STATUS') {
        const status = {
            connected: localBridge.isConnected(),
            url: localBridge.getCurrentUrl(),
            serverInfo: localBridge.getServerInfo()
        };
        if (sendResponse) sendResponse(status);
        return true;
    }

    // 更新 WebSocket 配置
    if (message.type === 'UPDATE_WS_CONFIG') {
        const { host, port, restPort: newRestPort } = message;
        const storageUpdate: Record<string, any> = { wsHost: host, wsPort: port };
        if (newRestPort) storageUpdate.restPort = newRestPort;
        chrome.storage.local.set(storageUpdate).then(() => {
            localBridge.reconnect(host, port);
            if (sendResponse) sendResponse({ success: true });
        });
        // 重建 taskCoordinator，REST host 与 WS host 相同
        const restPort = (newRestPort as number) || DEFAULT_REST_PORT;
        getOrCreateInstanceId().then(instanceId => {
            taskCoordinator = new BackgroundTaskCoordinator(localBridge, {
                localBridgeBaseUrl: `http://${host}:${restPort}`,
                clientName: 'tweetClaw',
                instanceId,
                fetchTimeoutMs: 30000,
                uploadTimeoutMs: 60000
            }, backgroundSessionStore);
            taskCoordinatorReady = true;
        });
        return true;
    }

    // 更新实例名称
    if (message.type === 'UPDATE_INSTANCE_NAME') {
        chrome.storage.local.get(['wsHost', 'wsPort']).then(res => {
            const host = (res.wsHost as string) || '127.0.0.1';
            const port = (res.wsPort as number) || DEFAULT_WS_PORT;
            localBridge.reconnect(host, port);
            if (sendResponse) sendResponse({ success: true });
        });
        return true;
    }

    // 来自 content script 的 API 拦截数据（仅用于自动收割）
    if (message.type === 'CAPTURED_DATA') {
        (async () => {
            await harvestQueryId(message.op, message.apiUrl);
            await harvestBearer(message.bearerToken);
        })();
        return;
    }

    if (message.type === 'GET_UPLOAD_SESSION_CHUNK') {
        const { uploadSessionId, chunkIndex } = message;
        console.log(`[TweetClaw-BG] chunk request, sessionId=${uploadSessionId}, chunkIndex=${chunkIndex}`);
        const chunk = getUploadSessionChunk(uploadSessionId, chunkIndex);
        if (!chunk) {
            console.warn(`[TweetClaw-BG] chunk request failed, sessionId=${uploadSessionId}, chunkIndex=${chunkIndex}`);
            sendResponse({ success: false, error: 'Upload session chunk not found' });
            return true;
        }
        console.log(`[TweetClaw-BG] chunk response, sessionId=${uploadSessionId}, chunkIndex=${chunkIndex}, byteLength=${chunk.chunkData.byteLength}`);

        // sendResponse 走 JSON 序列化，Uint8Array 必须转成 number[] 才能正确还原
        sendResponse({
            success: true,
            chunkData: Array.from(chunk.chunkData),
            totalBytes: chunk.totalBytes,
            mimeType: chunk.mimeType,
            transferChunkCount: chunk.transferChunkCount
        });
        return true;
    }

    if (message.type === 'RELEASE_UPLOAD_SESSION') {
        console.log(`[TweetClaw-BG] release session request, sessionId=${message.uploadSessionId}`);
        releaseUploadSession(message.uploadSessionId);
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'TASK_PROGRESS_FROM_CONTENT') {
        taskCoordinator?.handleContentProgress(message.taskId, message.phase, Number(message.progress || 0));
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'TASK_COMPLETED_FROM_CONTENT') {
        (async () => {
            try {
                await taskCoordinator?.handleContentCompleted(message.taskId, message.resultBase64, message.contentType || 'application/json');
                sendResponse({ success: true });
            } catch (error: any) {
                sendResponse({ success: false, error: error?.message || String(error) });
            }
        })();
        return true;
    }

    if (message.type === 'TASK_FAILED_FROM_CONTENT') {
        taskCoordinator?.handleContentFailed(message.taskId, message.phase, message.errorCode, message.errorMessage);
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'TASK_CANCELLED_FROM_CONTENT') {
        taskCoordinator?.handleContentCancelled(message.taskId);
        sendResponse({ success: true });
        return true;
    }

    // Content Script 请求获取 twid cookie 中的数字 UID（HttpOnly，CS 读不到）
    if (message.type === 'GET_AUTH_UID') {
        (async () => {
            const uid = await getAuthenticUid();
            sendResponse({ uid });
        })();
        return true;
    }

    // IG doc_id 过期自愈：content script 检测到 field_exception 后请求刷新 IG 主页 tab，
    // 让 IG 前端重新发 GraphQL 请求 → injection 捕获最新 doc_id 写入 sessionStorage。
    // fire-and-forget：content script 不等待结果，下次调用 getDocId 时自然读到新值。
    if (message.type === 'IG_TRIGGER_HOME_REFRESH') {
        (async () => {
            try {
                console.log(`[tweetClaw-BG] IG_TRIGGER_HOME_REFRESH received (friendlyName=${message.friendlyName}), refreshing IG home tab`);
                await refreshSinglePlatformHome('instagram');
                if (sendResponse) sendResponse({ success: true });
            } catch (e: any) {
                console.warn('[tweetClaw-BG] IG_TRIGGER_HOME_REFRESH failed', e);
                if (sendResponse) sendResponse({ success: false, error: e?.message || String(e) });
            }
        })();
        return true;
    }

    // 小红书 Ping
    if (message.type === 'XHS_PING') {
        sendResponse({
            ok: true,
            platform: 'xiaohongshu',
            version: chrome.runtime.getManifest().version
        });
        return true;
    }

    // 签名链路测试：转发给 XHS Content Script，让它走完整签名流程
    if (message.type === 'XHS_SIGN_TEST') {
        (async () => {
            try {
                const tab = await findXhsTab();
                if (!tab?.id) throw new Error('No Xiaohongshu tab found');
                const result = await sendMessageToTab(tab.id, {
                    type: 'XHS_SIGN_TEST',
                    url: message.url || '/api/sns/web/v1/homefeed',
                    data: message.data || '',
                });
                sendResponse(result);
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    // ── XHS API 直接调用（供 DevTools 测试和内部调用使用）────────────────────────
    if (message.type === 'XHS_FETCH_HOMEFEED') {
        (async () => {
            try {
                const { type: _t, ...payload } = message;
                const data = await queryXhsHomefeed(payload);
                sendResponse({ success: true, data });
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (message.type === 'XHS_FETCH_CURRENT_USER') {
        (async () => {
            try {
                const data = await queryXhsAccountInfo();
                sendResponse({ success: true, data });
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (message.type === 'XHS_FETCH_FEED') {
        (async () => {
            try {
                const { type: _t, ...payload } = message;
                const data = await queryXhsFeed(payload);
                sendResponse({ success: true, data });
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (message.type === 'XHS_SEARCH_NOTES') {
        (async () => {
            try {
                const { type: _t, ...payload } = message;
                const data = await queryXhsSearch(payload);
                sendResponse({ success: true, data });
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (message.type === 'XHS_FETCH_USER_NOTES') {
        (async () => {
            try {
                const { type: _t, ...payload } = message;
                const data = await queryXhsUserNotes(payload);
                sendResponse({ success: true, data });
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (message.type === 'XHS_PUBLISH_IMAGE_NOTE') {
        (async () => {
            try {
                const { type: _t, ...payload } = message;
                const data = await publishXhsImageNote(payload);
                sendResponse({ success: true, data });
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (message.type === 'XHS_PUBLISH_VIDEO_NOTE') {
        (async () => {
            try {
                const { type: _t, ...payload } = message;
                const data = await publishXhsVideoNote(payload);
                sendResponse({ success: true, data });
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    // x-rap-param 跨 tab 转发：调用方请求 → background → www tab 计算 → 返回
    if (message.type === 'XHS_GET_RAP_PARAM') {
        (async () => {
            try {
                const wwwTabs = await chrome.tabs.query({ url: ['*://www.xiaohongshu.com/*', '*://xiaohongshu.com/*'] });
                if (!wwwTabs.length || !wwwTabs[0].id) {
                    sendResponse({ success: false, error: 'No www.xiaohongshu.com tab found' });
                    return;
                }
                const resp: any = await sendMessageToTab(wwwTabs[0].id, {
                    type: 'XHS_CALC_RAP_PARAM',
                    apiPath: message.apiPath,
                    body: message.body,
                });
                sendResponse(resp);
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    // x-s/x-t/x-s-common 跨 tab 转发：调用方请求 → background → www tab 计算 → 返回
    if (message.type === 'XHS_GET_SIGN') {
        (async () => {
            try {
                const wwwTabs = await chrome.tabs.query({ url: ['*://www.xiaohongshu.com/*', '*://xiaohongshu.com/*'] });
                if (!wwwTabs.length || !wwwTabs[0].id) {
                    sendResponse({ success: false, error: 'No www.xiaohongshu.com tab found' });
                    return;
                }
                const resp: any = await sendMessageToTab(wwwTabs[0].id, {
                    type: 'XHS_CALC_SIGN',
                    apiPath: message.apiPath,
                    body: message.body,
                });
                sendResponse(resp);
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    return false;
});

// ══════════════════════════════════════════════════════════════════
// Handler Functions - 完全透传推特原始响应
// ══════════════════════════════════════════════════════════════════

/**
 * 查询所有 X 标签页状态
 */
export async function queryXTabsStatus() {
    console.log('[TweetClaw-BG] queryXTabsStatus called');

    const tabs = await chrome.tabs.query({ url: ["*://x.com/*", "*://twitter.com/*"] });
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const isXTab = (url: string | undefined) => {
        if (!url) return false;
        return url.includes('x.com') || url.includes('twitter.com');
    };

    let activeXTabId: number | null = null;
    let activeXUrl: string | null = null;

    if (activeTab && isXTab(activeTab.url)) {
        activeXTabId = activeTab.id || null;
        activeXUrl = activeTab.url || null;
    }

    const uid = await getAuthenticUid();
    const isLoggedIn = !!uid;

    const tabInfos = tabs.map(t => ({
        tabId: t.id || 0,
        url: t.url || '',
        active: t.active
    }));

    return {
        hasXTabs: tabs.length > 0,
        isLoggedIn: isLoggedIn,
        activeXTabId: activeXTabId,
        activeXUrl: activeXUrl,
        tabs: tabInfos
    };
}

// ── 平台 tab 保活工具 ──────────────────────────────────────────────────────────

/**
 * 等待指定 tabId 加载到 status === 'complete'，带超时兜底。
 * 用于在导航/刷新后确保页面就绪，再向 content script 发消息。
 */
function waitForTabComplete(tabId: number, timeoutMs = 15000): Promise<void> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const listener = (updatedTabId: number, info: chrome.tabs.OnUpdatedInfo) => {
            if (settled || updatedTabId !== tabId) return;
            if (info.status === 'complete') {
                settled = true;
                chrome.tabs.onUpdated.removeListener(listener);
                clearTimeout(timer);
                resolve();
            }
        };
        chrome.tabs.onUpdated.addListener(listener);

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            chrome.tabs.onUpdated.removeListener(listener);
            reject(new Error(`Tab ${tabId} did not reach 'complete' within ${timeoutMs}ms`));
        }, timeoutMs);
    });
}

/**
 * 确保存在一个指定平台的标签页，并刷新到首页，等待加载完成后再返回 tabId。
 *
 * 反页面过时策略：
 * - 无该平台 tab → 新建 inactive 标签页打开 homeUrl（session 存在则自动登录）
 * - 已有 tab → 一律刷新到 homeUrl：已在 home 则 reload 强制激活，否则导航到 home
 *
 * @param urlPatterns chrome.tabs.query 的 url 匹配模式
 * @param homeUrl     目标首页 URL
 * @returns 就绪后的 tabId
 */
async function ensurePlatformTabReady(
    urlPatterns: string[],
    homeUrl: string,
    timeoutMs = 15000
): Promise<number> {
    const tabs = await chrome.tabs.query({ url: urlPatterns });

    // 优先复用非活动标签页，避免抢占用户当前正在浏览的 tab；
    // 只有当平台仅存在一个活动 tab 时才回退到它。
    const inactiveTab = tabs.find(t => !t.active);
    const tab = inactiveTab || tabs[0] || null;

    let tabId: number;
    if (!tab?.id) {
        // 没有已有标签页 → 后台打开首页
        const created = await chrome.tabs.create({ url: homeUrl, active: false });
        tabId = created.id!;
        await waitForTabComplete(tabId, timeoutMs);
    } else {
        // tab 已存在 → 不 reload / navigate，避免打断用户浏览。
        // signedFetch 只要求 tab 在目标域名上（cookie/origin 正确）。
        tabId = tab.id;
        // 仅当 tab 仍在加载时才等待；已 complete 则直接返回，
        // 否则 onUpdated 永不触发 → 超时。
        const current = await chrome.tabs.get(tabId);
        if (current.status !== 'complete') {
            await waitForTabComplete(tabId, timeoutMs);
        }
    }
    return tabId;
}

/**
 * 查询当前登录账号基本信息 - 返回推特原始 GraphQL 响应
 */
export async function queryXBasicInfo() {
    console.log('[TweetClaw-BG] queryXBasicInfo called');

    const tabId = await ensurePlatformTabReady(
        ['*://x.com/*', '*://twitter.com/*'],
        'https://x.com/home'
    );

    // 委托 Content Script 调用推特 API 并返回原始响应
    const result: any = await sendMessageToTab(tabId, {
        type: 'FETCH_SETTINGS_AND_PROFILE',
    });

    if (!result?.success) {
        throw new Error('Failed to fetch user profile from Twitter API');
    }

    // 直接返回推特原始响应，不做任何解析
    return result.raw;
}

// ── A41 账号状态采集 ──────────────────────────────────────────────────────────
//
// 复用 WS 心跳节奏（60s 节流在 LocalBridgeSocket.startHeartbeat 里做）。
// 本函数只负责"查 tab + sendMessage 给 content script"，三平台并行。
// 采集失败 = logged_out（content script 未注入 / tab 不存在 / selector 未命中 都算 logged_out）。
// 阶段一：只打印日志，不塞进 ping payload，不发往 LocalBridge。

interface CheckLoginResponse {
    loggedIn: boolean;
    platform: 'twitter' | 'instagram' | 'xiaohongshu';
    tabId: number | null;
    account?: {
        username?: string | null;
        userId?: string | null;
        displayName?: string | null;
        avatarUrl?: string | null;
    };
    error?: string;
}

const PLATFORM_TAB_CONFIG: Array<{
    platform: 'twitter' | 'instagram' | 'xiaohongshu';
    urlPatterns: string[];
}> = [
    { platform: 'twitter', urlPatterns: ['*://x.com/*', '*://twitter.com/*'] },
    { platform: 'instagram', urlPatterns: ['*://www.instagram.com/*', '*://instagram.com/*'] },
    { platform: 'xiaohongshu', urlPatterns: ['*://www.xiaohongshu.com/*', '*://xiaohongshu.com/*'] },
];

async function checkPlatformLogin(
    platform: 'twitter' | 'instagram' | 'xiaohongshu',
    urlPatterns: string[]
): Promise<AccountStatusResult> {
    const tabs = await chrome.tabs.query({ url: urlPatterns });
    if (tabs.length === 0) {
        console.log(`[tweetClaw][A41] ${platform}: no tab open → logged_out`);
        return {
            platform,
            status: 'logged_out',
            tabId: null,
            lastCheckedAt: Date.now(),
        };
    }
    // 优先用非活动 tab，避免打扰用户当前浏览
    const tab = tabs.find(t => !t.active) || tabs[0];
    console.log(`[tweetClaw][A41] ${platform}: ${tabs.length} tab(s) open, querying tabId=${tab.id} active=${tab.active} url=${tab.url}`);
    try {
        const resp = await sendMessageToTab<CheckLoginResponse>(tab.id!, {
            type: 'CHECK_LOGIN',
            tabId: tab.id,
        });
        console.log(`[tweetClaw][A41] ${platform}: content script replied`, JSON.stringify(resp));
        return {
            platform,
            status: resp?.loggedIn ? 'logged_in' : 'logged_out',
            tabId: tab.id ?? null,
            lastCheckedAt: Date.now(),
            account: resp?.account,
            error: resp?.error,
        };
    } catch (e: any) {
        // sendMessage 失败（content script 未注入 / tab 正在导航）= logged_out
        console.warn(`[tweetClaw][A41] ${platform}: sendMessage failed → logged_out, error=${e?.message || String(e)}`);
        return {
            platform,
            status: 'logged_out',
            tabId: tab.id ?? null,
            lastCheckedAt: Date.now(),
            error: e?.message || String(e),
        };
    }
}

async function collectAccountStatuses(): Promise<AccountStatusResult[]> {
    const results = await Promise.all(
        PLATFORM_TAB_CONFIG.map(cfg => checkPlatformLogin(cfg.platform, cfg.urlPatterns))
    );
    return results;
}

// ── A41 stage 4: Home refresh ─────────────────────────────────────
//
// 把已登录账号的非活动 tab 刷新到平台首页，保活 session。
// "长时间无操作" 的低成本代理：
//   - 非 active tab：用户切到了同窗口的另一个 tab → 无操作
//   - active 但窗口失焦：用户离开浏览器（如切到 VS Code）→ 无操作
//   - active 且窗口有焦点：用户可能正在看 → 跳过，避免打断
// 只刷新已存在的 tab，不新建。

async function refreshTabsToHome(urlPatterns: string[], homeUrl: string): Promise<number> {
    const tabs = await chrome.tabs.query({ url: urlPatterns });
    if (tabs.length === 0) return 0;

    // 查询每个 tab 所在窗口是否拥有 OS 焦点
    const windowFocused = new Map<number, boolean>();
    for (const t of tabs) {
        if (t.windowId != null && !windowFocused.has(t.windowId)) {
            try {
                const win = await chrome.windows.get(t.windowId);
                windowFocused.set(t.windowId, !!win.focused);
            } catch {
                windowFocused.set(t.windowId, false);
            }
        }
    }

    // 只跳过"active 且窗口有焦点"的 tab（用户真的可能在看）
    const inactiveTabs = tabs.filter(t => t.id && !(t.active && windowFocused.get(t.windowId)));
    if (inactiveTabs.length === 0) {
        console.log(`[tweetClaw][A41][home-refresh] all tabs active+focused, skipping (patterns=${JSON.stringify(urlPatterns)})`);
        return 0;
    }

    const normalize = (u: string) => u.split('#')[0].split('?')[0];
    let refreshed = 0;
    for (const tab of inactiveTabs) {
        try {
            if (normalize(tab.url || '') === normalize(homeUrl)) {
                await chrome.tabs.reload(tab.id!);
            } else {
                await chrome.tabs.update(tab.id!, { url: homeUrl });
            }
            refreshed++;
        } catch (e: any) {
            console.warn(`[tweetClaw][A41][home-refresh] failed tabId=${tab.id}`, e?.message || String(e));
        }
    }
    return refreshed;
}

async function refreshSinglePlatformHome(
    platform: 'twitter' | 'instagram' | 'xiaohongshu'
): Promise<void> {
    // 先检查该平台账号是否仍在线；离线则跳过（不刷新、不报错）
    const statuses = await collectAccountStatuses();
    const online = statuses.find(s => s.platform === platform && s.status === 'logged_in');
    if (!online) {
        console.log(`[tweetClaw][A41][home-refresh] ${platform} not online, skip`);
        return;
    }

    const cfg = PLATFORM_REFRESH_CONFIGS.find(c => c.platform === platform);
    if (!cfg) return;

    const n = await refreshTabsToHome(cfg.urlPatterns, cfg.homeUrl);
    console.log(`[tweetClaw][A41][home-refresh] ${platform}: refreshed ${n} tab(s)`);

    // 小红书主站 + 创作者中心
    if (cfg.extraRefreshes) {
        for (const extra of cfg.extraRefreshes) {
            const n2 = await refreshTabsToHome(extra.urlPatterns, extra.homeUrl);
            console.log(
                `[tweetClaw][A41][home-refresh] ${platform} extra: refreshed ${n2} tab(s)`
            );
        }
    }
}

// ── XHS 工具函数 ──────────────────────────────────────────────────────────────

/** 找到已打开的任意小红书标签页 */
async function findXhsTab(): Promise<chrome.tabs.Tab | null> {
    // 强制只匹配 www.xiaohongshu.com / xiaohongshu.com 主站，保证 Origin 和 Cookie 正确
    const tabs = await chrome.tabs.query({
        url: ['*://www.xiaohongshu.com/*', '*://xiaohongshu.com/*']
    });
    return tabs.find(t => t.active) || tabs[0] || null;
}

/** 向小红书 content script 发消息，返回 result.data 或抛错 */
async function sendXhsMessage(tab: chrome.tabs.Tab, msg: Record<string, any>): Promise<any> {
    if (!tab.id) throw new Error('No valid Xiaohongshu tab');
    const result: any = await sendMessageToTab(tab.id, msg);
    if (!result?.success) {
        throw new Error(result?.error || `XHS command failed: ${msg.type}`);
    }
    return result.data;
}

// ── XHS Handler 函数 ────────────────────────────────────────────────────────

export async function queryXhsHomefeed(payload: Record<string, unknown> = {}) {
    console.log('[TweetClaw-BG] queryXhsHomefeed called');
    const tab = await findXhsTab();
    if (!tab) throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    return sendXhsMessage(tab, { type: 'XHS_FETCH_HOMEFEED', ...payload });
}

/**
 * 查询小红书当前登录账号信息
 */
export async function queryXhsAccountInfo() {
    console.log('[TweetClaw-BG] queryXhsAccountInfo called');

    // 并行确保 home 和 creator 两个 tab 都打开：
    //   - home  (www.xiaohongshu.com/explore)   → 账号信息查询所需，等待加载完成
    //   - creator (creator.xiaohongshu.com/...)  → 后续 published_notes 等同域请求所需，
    //     后台打开即可，失败不阻塞账号查询（下次 getOrOpenCreatorTab 会再补开）
    const creatorOpenPromise = ensurePlatformTabReady(
        ['*://creator.xiaohongshu.com/*'],
        'https://creator.xiaohongshu.com/new/note-manager?source=official'
    ).then(id => {
        console.log(`[TweetClaw-BG] creator tab ensured in background: tabId=${id}`);
    }).catch(e => {
        console.warn(`[TweetClaw-BG] creator tab open failed (non-fatal): ${e?.message}`);
    });

    const tabId = await ensurePlatformTabReady(
        ['*://www.xiaohongshu.com/*', '*://xiaohongshu.com/*'],
        'https://www.xiaohongshu.com/explore'
    );

    const result: any = await sendMessageToTab(tabId, {
        type: 'XHS_FETCH_CURRENT_USER',
    }).catch((e: any) => {
        throw new Error(`Failed to communicate with content script: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to fetch current user info from Xiaohongshu API');
    }

    // 账号信息已拿到，creator tab 仍在后台并行打开中，不阻塞返回
    void creatorOpenPromise;

    return result.data;
}

/**
 * 查询小红书笔记详情（通过 feed 接口）
 */
export async function queryXhsFeed(payload: Record<string, unknown> = {}) {
    console.log('[TweetClaw-BG] queryXhsFeed called');

    const targetTab = await findXhsTab();
    if (!targetTab?.id) {
        throw new Error('No Xiaohongshu tab found');
    }

    const result: any = await sendMessageToTab(targetTab.id, {
        type: 'XHS_FETCH_FEED',
        ...payload,
    }).catch((e: any) => {
        throw new Error(`Failed to communicate with content script: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to fetch Xiaohongshu feed');
    }

    return result.data;
}

/**
 * 打开新的 X 标签页
 */
export async function openXTab(payload: OpenTabRequestPayload): Promise<OpenTabResponsePayload> {
    const path = payload.path || "home";
    const url = "https://x.com/" + (path.startsWith("/") ? path.substring(1) : path);

    return new Promise((resolve) => {
        chrome.tabs.create({ url }, (tab) => {
            if (chrome.runtime.lastError) {
                resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
                resolve({
                    success: true,
                    tabId: tab.id,
                    url: tab.url || url
                });
            }
        });
    });
}

/**
 * 打开新的小红书标签页。path 是相对 https://www.xiaohongshu.com/ 的路径，
 * 例如 "explore"（首页）、"user/profile/<id>"。
 */
export async function openXhsTab(payload: OpenTabRequestPayload): Promise<OpenTabResponsePayload> {
    const path = payload.path || "explore";
    const url = "https://www.xiaohongshu.com/" + (path.startsWith("/") ? path.substring(1) : path);

    return new Promise((resolve) => {
        chrome.tabs.create({ url }, (tab) => {
            if (chrome.runtime.lastError) {
                resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
                resolve({
                    success: true,
                    tabId: tab.id,
                    url: tab.url || url
                });
            }
        });
    });
}

/**
 * 打开新的 Instagram 标签页。path 是相对 https://www.instagram.com/ 的路径，
 * 例如 "<username>"、"<username>/reels"。
 */
export async function openIgTab(payload: OpenTabRequestPayload): Promise<OpenTabResponsePayload> {
    const path = payload.path || "";
    const url = "https://www.instagram.com/" + (path.startsWith("/") ? path.substring(1) : path);

    return new Promise((resolve) => {
        chrome.tabs.create({ url }, (tab) => {
            if (chrome.runtime.lastError) {
                resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
                resolve({
                    success: true,
                    tabId: tab.id,
                    url: tab.url || url
                });
            }
        });
    });
}

/**
 * 按 platform 字段分发打开标签页。默认/未指定时按 X 处理（向后兼容）。
 */
export async function openTabByPlatform(payload: OpenTabRequestPayload): Promise<OpenTabResponsePayload> {
    switch (payload.platform) {
        case 'xhs':
            return openXhsTab(payload);
        case 'ig':
            return openIgTab(payload);
        case 'x':
        default:
            return openXTab(payload);
    }
}

/**
 * 导航 X 标签页到指定路径。若已有 x.com/twitter.com 标签页则刷新到目标 URL，
 * 否则打开新标签页。
 */
export async function navigateXTab(payload: NavigateTabRequestPayload): Promise<NavigateTabResponsePayload> {
    const path = payload.path || "home";
    const url = "https://x.com/" + (path.startsWith("/") ? path.substring(1) : path);

    let targetTabId = payload.tabId;
    if (!targetTabId) {
        const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
        const targetTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = targetTab?.id;
    }

    // 没有现有标签页 → 打开新标签页
    if (!targetTabId) {
        const opened = await openXTab({ path, platform: 'x' });
        return {
            success: opened.success,
            tabId: opened.tabId || 0,
            url: opened.url || url,
            error: opened.error,
        };
    }

    return new Promise((resolve) => {
        chrome.tabs.update(targetTabId!, { url }, (tab) => {
            if (chrome.runtime.lastError) {
                resolve({
                    success: false,
                    tabId: targetTabId!,
                    url: "",
                    error: chrome.runtime.lastError.message
                });
            } else {
                resolve({
                    success: true,
                    tabId: tab.id || targetTabId!,
                    url: tab.url || url
                });
            }
        });
    });
}

/**
 * 导航小红书标签页到指定路径。若已有 xiaohongshu.com 标签页则刷新，
 * 否则打开新标签页。path 是相对 https://www.xiaohongshu.com/ 的路径。
 */
export async function navigateXhsTab(payload: NavigateTabRequestPayload): Promise<NavigateTabResponsePayload> {
    const path = payload.path || "explore";
    const url = "https://www.xiaohongshu.com/" + (path.startsWith("/") ? path.substring(1) : path);

    let targetTabId = payload.tabId;
    if (!targetTabId) {
        const xhsTabs = await chrome.tabs.query({ url: ['*://www.xiaohongshu.com/*', '*://xiaohongshu.com/*'] });
        const targetTab = xhsTabs.find(t => t.active) || xhsTabs[0];
        targetTabId = targetTab?.id;
    }

    if (!targetTabId) {
        const opened = await openXhsTab({ path, platform: 'xhs' });
        return {
            success: opened.success,
            tabId: opened.tabId || 0,
            url: opened.url || url,
            error: opened.error,
        };
    }

    return new Promise((resolve) => {
        chrome.tabs.update(targetTabId!, { url }, (tab) => {
            if (chrome.runtime.lastError) {
                resolve({
                    success: false,
                    tabId: targetTabId!,
                    url: "",
                    error: chrome.runtime.lastError.message
                });
            } else {
                resolve({
                    success: true,
                    tabId: tab.id || targetTabId!,
                    url: tab.url || url
                });
            }
        });
    });
}

/**
 * 导航 Instagram 标签页到指定路径。若已有 instagram.com 标签页则刷新，
 * 否则打开新标签页。path 是相对 https://www.instagram.com/ 的路径。
 */
export async function navigateIgTab(payload: NavigateTabRequestPayload): Promise<NavigateTabResponsePayload> {
    const path = payload.path || "";
    const url = "https://www.instagram.com/" + (path.startsWith("/") ? path.substring(1) : path);

    let targetTabId = payload.tabId;
    if (!targetTabId) {
        const igTabs = await chrome.tabs.query({ url: ['*://www.instagram.com/*', '*://instagram.com/*'] });
        const targetTab = igTabs.find(t => t.active) || igTabs[0];
        targetTabId = targetTab?.id;
    }

    if (!targetTabId) {
        const opened = await openIgTab({ path, platform: 'ig' });
        return {
            success: opened.success,
            tabId: opened.tabId || 0,
            url: opened.url || url,
            error: opened.error,
        };
    }

    return new Promise((resolve) => {
        chrome.tabs.update(targetTabId!, { url }, (tab) => {
            if (chrome.runtime.lastError) {
                resolve({
                    success: false,
                    tabId: targetTabId!,
                    url: "",
                    error: chrome.runtime.lastError.message
                });
            } else {
                resolve({
                    success: true,
                    tabId: tab.id || targetTabId!,
                    url: tab.url || url
                });
            }
        });
    });
}

/**
 * 按 platform 字段分发导航标签页。默认/未指定时按 X 处理（向后兼容）。
 * 语义：已有该平台标签页则刷新到目标 URL，否则打开新标签页。
 */
export async function navigateTabByPlatform(payload: NavigateTabRequestPayload): Promise<NavigateTabResponsePayload> {
    switch (payload.platform) {
        case 'xhs':
            return navigateXhsTab(payload);
        case 'ig':
            return navigateIgTab(payload);
        case 'x':
        default:
            return navigateXTab(payload);
    }
}

/**
 * 按 platform 字段分发关闭标签页。close-tab 用 tabId 定位，
 * 平台字段用于校验该 tab 是否属于指定平台（避免误关别平台 tab）。
 */
export async function closeTabByPlatform(payload: CloseTabRequestPayload): Promise<CloseTabResponsePayload> {
    const tabId = payload.tabId;
    const platform = payload.platform || 'x';

    return new Promise((resolve) => {
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
                resolve({ success: false, reason: "not_found" });
                return;
            }

            // 空 URL = 正在导航过渡中（chrome.tabs.update 后 tab.url 可能短暂为空/about:blank），
            // 此时仍应允许 close；仅当 URL 明确不属于目标平台时才拒绝。
            const url = tab.url || "";
            if (url) {
                const matches =
                    (platform === 'x' && (url.includes("x.com") || url.includes("twitter.com"))) ||
                    (platform === 'xhs' && url.includes("xiaohongshu.com")) ||
                    (platform === 'ig' && url.includes("instagram.com"));
                if (!matches) {
                    resolve({ success: false, reason: "not_found" });
                    return;
                }
            }

            chrome.tabs.remove(tabId, () => {
                if (chrome.runtime.lastError) {
                    resolve({
                        success: false,
                        reason: "failed",
                        error: chrome.runtime.lastError.message
                    });
                } else {
                    resolve({ success: true, reason: "success" });
                }
            });
        });
    });
}

/**
 * 执行推特操作（like, retweet, follow 等）- 返回推特原始响应
 */
export async function execAction(payload: ExecActionPayload): Promise<TwitterResponse> {
    const { tabId } = payload;
    console.log(`[TweetClaw-BG] execAction: ${payload.action}`, payload);

    let targetTabId = tabId;
    if (!targetTabId) {
        const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
        const targetTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = targetTab?.id;
    }

    if (!targetTabId) {
        throw new Error('No target tab found for action');
    }

    // 委托 Content Script 执行操作并返回推特原始响应
    const result = await sendMessageToTab(targetTabId, {
        type: MsgType.EXECUTE_ACTION,
        ...payload,
    }).catch((e: any) => {
        throw new Error(`Failed to execute action: ${e?.message}`);
    });

    // 直接返回推特原始响应
    return result;
}

/**
 * 查询主页时间线 - 返回推特原始 GraphQL 响应
 */
export async function queryHomeTimeline(payload: QueryTimelinePayload): Promise<TwitterResponse> {
    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = payload?.tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) {
        throw new Error('No x.com tab found');
    }

    // 委托 Content Script 调用推特 API 并返回原始响应
    const result = await sendMessageToTab(targetTabId, {
        type: 'FETCH_HOME_TIMELINE'
    }).catch((e: any) => {
        throw new Error(`Failed to fetch timeline: ${e?.message}`);
    });

    // 直接返回推特原始 GraphQL 响应
    return result;
}

/**
 * 查询推文回复 - 返回推特原始 GraphQL 响应
 */
export async function queryTweetReplies(payload: QueryTweetRepliesPayload): Promise<TwitterResponse> {
    const { tweetId, tabId, cursor } = payload;
    if (!tweetId) {
        throw new Error('tweetId is required');
    }

    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) {
        throw new Error('No x.com tab found');
    }

    // 委托 Content Script 调用推特 API 并返回原始响应
    const result = await sendMessageToTab(targetTabId, {
        type: 'FETCH_TWEET_REPLIES',
        tweetId,
        cursor
    });

    // 直接返回推特原始 GraphQL 响应
    return result;
}

/**
 * 查询推文详情 - 返回推特原始 GraphQL 响应
 */
export async function queryTweetDetail(payload: QueryTweetPayload): Promise<TwitterResponse> {
    const { tweetId, tabId } = payload;
    if (!tweetId) {
        throw new Error('tweetId is required');
    }

    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) {
        throw new Error('No x.com tab found');
    }

    // 委托 Content Script 调用推特 API 并返回原始响应
    const result = await sendMessageToTab(targetTabId, {
        type: 'FETCH_TWEET_DETAIL',
        tweetId
    });

    // 直接返回推特原始 GraphQL 响应
    return result;
}

/**
 * 查询用户资料 - 返回推特原始 GraphQL 响应
 */
export async function queryUserProfile(payload: QueryUserProfilePayload): Promise<TwitterResponse> {
    const { screenName, tabId } = payload;
    if (!screenName) {
        throw new Error('screenName is required');
    }

    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) {
        throw new Error('No x.com tab found');
    }

    // 委托 Content Script 调用推特 API 并返回原始响应
    const result = await sendMessageToTab(targetTabId, {
        type: 'FETCH_USER_PROFILE',
        screenName
    });

    // 直接返回推特原始 GraphQL 响应
    return result;
}

/**
 * 搜索推文 - 返回推特原始 GraphQL 响应
 */
export async function querySearchTimeline(payload: QuerySearchTimelinePayload): Promise<TwitterResponse> {
    const { query, cursor, count, tabId, product } = payload;

    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) {
        throw new Error('No x.com tab found');
    }

    // 委托 Content Script 调用推特 API 并返回原始响应
    const result = await sendMessageToTab(targetTabId, {
        type: 'FETCH_SEARCH_TIMELINE',
        query,
        cursor,
        count,
        product,
    });

    // 直接返回推特原始 GraphQL 响应
    return result;
}

/**
 * 查询用户推文 - 返回推特原始 GraphQL 响应
 */
export async function queryUserTweets(payload: QueryUserTweetsPayload): Promise<TwitterResponse> {
    const { userId, cursor, count, tabId } = payload;

    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) {
        throw new Error('No x.com tab found');
    }

    // 委托 Content Script 调用推特 API 并返回原始响应
    const result = await sendMessageToTab(targetTabId, {
        type: 'FETCH_USER_TWEETS',
        userId,
        cursor,
        count,
    });

    // 直接返回推特原始 GraphQL 响应
    return result;
}

/**
 * 查询粉丝列表（关注我的） - 返回推特原始 GraphQL 响应
 */
export async function queryFollowers(payload: QueryFollowersPayload): Promise<TwitterResponse> {
    const { userId, cursor, count, tabId } = payload;
    if (!userId) throw new Error('userId is required');

    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) throw new Error('No x.com tab found');

    const result = await sendMessageToTab(targetTabId, {
        type: 'FETCH_FOLLOWERS_PAGE',
        userId,
        cursor,
        count,
    });

    return result;
}

/**
 * 查询我关注的用户列表 - 返回推特原始 GraphQL 响应
 */
export async function queryFollowing(payload: QueryFollowingPayload): Promise<TwitterResponse> {
    const { userId, cursor, count, tabId } = payload;
    if (!userId) throw new Error('userId is required');

    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) throw new Error('No x.com tab found');

    const result = await sendMessageToTab(targetTabId, {
        type: 'FETCH_FOLLOWING_PAGE',
        userId,
        cursor,
        count,
    });

    return result;
}

/**
 * 查询关注我的蓝 V 用户列表 - 返回推特原始 GraphQL 响应
 */
export async function queryBlueVerifiedFollowers(payload: QueryBlueVerifiedFollowersPayload): Promise<TwitterResponse> {
    const { userId, cursor, count, tabId } = payload;
    if (!userId) throw new Error('userId is required');

    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) throw new Error('No x.com tab found');

    const result = await sendMessageToTab(targetTabId, {
        type: 'FETCH_BLUE_VERIFIED_FOLLOWERS_PAGE',
        userId,
        cursor,
        count,
    });

    return result;
}

/**
 * 上传媒体文件 - 返回 media_id
 */

// 启动时初始化
initDefaultQueryKeys();

// ══════════════════════════════════════════════════════════════════
// Xiaohongshu (小红书) Data Handlers
// ══════════════════════════════════════════════════════════════════

/**
 * 搜索小红书笔记
 */
export async function queryXhsSearch(payload: Record<string, unknown> = {}) {
    console.log('[TweetClaw-BG] queryXhsSearch called', payload);

    const targetTab = await findXhsTab();
    if (!targetTab?.id) {
        throw new Error('No Xiaohongshu tab found');
    }

    const result: any = await sendMessageToTab(targetTab.id, {
        type: 'XHS_SEARCH_NOTES',
        ...payload,
    }).catch((e: any) => {
        throw new Error(`Failed to communicate with content script: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to search Xiaohongshu notes');
    }

    return result.data;
}

/**
 * 获取指定用户发布的小红书笔记列表
 */
export async function queryXhsUserNotes(payload: Record<string, unknown> = {}) {
    console.log('[TweetClaw-BG] queryXhsUserNotes called', payload);

    const targetTab = await findXhsTab();
    if (!targetTab?.id) {
        throw new Error('No Xiaohongshu tab found');
    }

    const result: any = await sendMessageToTab(targetTab.id, {
        type: 'XHS_FETCH_USER_NOTES',
        ...payload,
    }).catch((e: any) => {
        throw new Error(`Failed to communicate with content script: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to fetch user notes from Xiaohongshu');
    }

    return result.data;
}

/** 找到或打开 www.xiaohongshu.com 标签页，等待签名链路就绪后返回 tabId。
 *  不再使用 creator.xiaohongshu.com（/home 为死链，根目录需登录且无意义），
 *  统一复用/创建 www.xiaohongshu.com 标签页。content-xhs.js 在 *.xiaohongshu.com 下均注入，
 *  签名函数 _webmsxyw 在 www 域同样可用，且发布流程已验证不依赖 creator 子域名。
 */
async function getOrOpenCreatorTab(): Promise<number> {
    const CREATOR_URL = 'https://creator.xiaohongshu.com/new/note-manager?source=official';
    const XHS_URL = 'https://www.xiaohongshu.com';
    const MAX_WAIT_MS = 30000;
    const POLL_MS = 800;

    // 等待指定 tab 的签名链路就绪
    async function waitSignReady(tabId: number, label: string): Promise<boolean> {
        const deadline = Date.now() + MAX_WAIT_MS;
        let pingOk = false;
        while (Date.now() < deadline) {
            await new Promise(r => setTimeout(r, POLL_MS));
            // 阶段一：content script 响应 PING
            if (!pingOk) {
                try {
                    const pong: any = await sendMessageToTab(tabId, { type: 'XHS_PING' });
                    if (pong?.ok) {
                        pingOk = true;
                        console.log(`[TweetClaw-BG] ${label} tab content script ready: tabId=${tabId}`);
                    }
                } catch {
                    continue; // content script 还没注入
                }
            }
            // 阶段二：签名函数就绪
            if (pingOk) {
                try {
                    const signResult: any = await sendMessageToTab(tabId, {
                        type: 'XHS_SIGN_TEST',
                        url: '/api/sns/web/v2/user/me',
                        data: '',
                    });
                    if (signResult?.success && signResult?.data?.['x-s'] && signResult?.data?.['x-s-common']) {
                        console.log(`[TweetClaw-BG] ${label} tab sign+x-s-common ready: tabId=${tabId}`);
                        return true;
                    }
                    const missing = !signResult?.success ? 'sign failed' : (!signResult?.data?.['x-s'] ? 'x-s missing' : 'x-s-common missing');
                    console.log(`[TweetClaw-BG] ${label} tab not ready (${missing}), retrying...`);
                } catch {
                    // 继续等
                }
            }
        }
        return false;
    }

    // 1. 优先复用已有的 creator.xiaohongshu.com 标签页（同域，无 CORS）
    const creatorTabs = await chrome.tabs.query({
        url: ['*://creator.xiaohongshu.com/*']
    });
    let creatorTab = creatorTabs.find(t => t.active) || creatorTabs[0] || null;

    if (creatorTab?.id) {
        console.log(`[TweetClaw-BG] Reusing existing creator tab: ${creatorTab.id}`);
        if (await waitSignReady(creatorTab.id, 'creator')) {
            return creatorTab.id;
        }
        // 签名未就绪：刷新后重试一次（可能登录过期）
        console.log(`[TweetClaw-BG] Creator tab sign not ready, reloading...`);
        await chrome.tabs.reload(creatorTab.id, { bypassCache: true });
        await new Promise(r => setTimeout(r, 3000)); // 等待 reload 完成
        if (await waitSignReady(creatorTab.id, 'creator(reloaded)')) {
            return creatorTab.id;
        }
    }

    // 2. 没有现有 creator 标签页：新建一个
    //    测试已确认：在 www 已登录状态下，直接打开 creator URL 可自动登录
    console.log('[TweetClaw-BG] No creator tab found, opening new one...');
    const newTab = await chrome.tabs.create({ url: CREATOR_URL, active: false });
    const tabId = newTab.id!;
    if (await waitSignReady(tabId, 'creator(new)')) {
        return tabId;
    }

    // 3. 兜底：回退到 www.xiaohongshu.com（保留原有行为，但 published_notes 会 CORS 失败）
    const tabs = await chrome.tabs.query({
        url: ['*://www.xiaohongshu.com/*', '*://xiaohongshu.com/*']
    });
    let tab = tabs.find(t => t.active) || tabs[0] || null;
    if (!tab) {
        console.log('[TweetClaw-BG] No xiaohongshu tab found, opening www...');
        tab = await chrome.tabs.create({ url: XHS_URL, active: false });
    }
    const wwwTabId = tab.id!;
    if (await waitSignReady(wwwTabId, 'www')) {
        return wwwTabId;
    }

    throw new Error('xiaohongshu.com tab sign function not ready within 30s');
}

export async function publishXhsImageNote(payload: Record<string, unknown> = {}) {
    const hasImages = Array.isArray(payload.images) && (payload.images as any[]).length > 0;
    const hasImageFileInfos = Array.isArray(payload.imageFileInfos) && (payload.imageFileInfos as any[]).length > 0;
    console.log('[TweetClaw-BG] publishXhsImageNote called', {
        title: payload.title,
        imageCount: (payload.images as any[])?.length,
        imageFileInfosCount: (payload.imageFileInfos as any[])?.length,
    });

    if (!hasImages && !hasImageFileInfos) {
        throw new Error('images or imageFileInfos array is required');
    }

    // 发布流程通过 content script 在 xiaohongshu.com 域下执行（origin 正确）
    // x-rap-param 通过 background 转发给 www.xiaohongshu.com tab 计算
    const tabId = await getOrOpenCreatorTab();

    const result: any = await sendMessageToTab(tabId, {
        type: 'XHS_PUBLISH_IMAGE_NOTE',
        ...payload,
    }).catch((e: any) => {
        throw new Error(`Failed to communicate with content script: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to publish image note to Xiaohongshu');
    }

    return result.data;
}

export async function publishXhsVideoNote(payload: Record<string, unknown> = {}) {
    console.log('[TweetClaw-BG] publishXhsVideoNote called', {
        title: payload.title,
    });

    if (!payload.video) throw new Error('video is required');

    const tabId = await getOrOpenCreatorTab();

    const result: any = await sendMessageToTab(tabId, {
        type: 'XHS_PUBLISH_VIDEO_NOTE',
        ...payload,
    }).catch((e: any) => {
        throw new Error(`Failed to communicate with content script: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to publish video note to Xiaohongshu');
    }

    return result.data;
}

/**
 * 检查 www.xiaohongshu.com 上 window.mnsv2 签名函数的健康状态
 * 供 tweetpilot 通过 REST API 主动查询（command.xhs_check_sign_health）
 */
export async function checkXhsSignHealth(_payload?: any): Promise<{
    ok: boolean;
    mnsv2_present: boolean;
    sign_format_ok: boolean;
    reason?: string;
    sample?: string;
    tab_found: boolean;
    checked_at: number;
}> {
    console.log('[TweetClaw-BG] checkXhsSignHealth called');

    const xhsTabs = await chrome.tabs.query({ url: ['*://www.xiaohongshu.com/*', '*://xiaohongshu.com/*'] });
    const tab = xhsTabs.find(t => t.active) || xhsTabs[0] || null;

    if (!tab?.id) {
        console.warn('[TweetClaw-BG] checkXhsSignHealth: no xiaohongshu tab found, auto-opening one...');
        try {
            // 自动打开 xiaohongshu tab 并等待签名链路就绪（最多 30s）
            const newTabId = await getOrOpenCreatorTab();
            console.log(`[TweetClaw-BG] checkXhsSignHealth: auto-opened xiaohongshu tab tabId=${newTabId}, re-checking health...`);

            // 重新发健康检查消息
            const retryResult: any = await sendMessageToTab(newTabId, {
                type: 'XHS_CHECK_SIGN_HEALTH',
            }).catch((e: any) => ({
                success: false,
                error: `Content script communication failed after auto-open: ${e?.message}`,
            }));

            if (!retryResult?.success) {
                return {
                    ok: false, mnsv2_present: false, sign_format_ok: false,
                    reason: retryResult?.error || 'content_script_error_after_auto_open',
                    tab_found: true, checked_at: Date.now(),
                };
            }
            return { ...retryResult.data, tab_found: true, checked_at: Date.now() };
        } catch (openErr: any) {
            console.error(`[TweetClaw-BG] checkXhsSignHealth: auto-open failed: ${openErr.message}`);
            return {
                ok: false, mnsv2_present: false, sign_format_ok: false,
                reason: 'no_xiaohongshu_tab',
                tab_found: false, checked_at: Date.now(),
            };
        }
    }

    console.log(`[TweetClaw-BG] checkXhsSignHealth: found xiaohongshu tab tabId=${tab.id}, url=${tab.url}`);

    const result: any = await sendMessageToTab(tab.id, {
        type: 'XHS_CHECK_SIGN_HEALTH',
    }).catch((e: any) => ({
        success: false,
        error: `Content script communication failed: ${e?.message}`,
    }));

    if (!result?.success) {
        console.error(`[TweetClaw-BG] checkXhsSignHealth: content script error: ${result?.error}`);
        return {
            ok: false,
            mnsv2_present: false,
            sign_format_ok: false,
            reason: result?.error || 'content_script_error',
            tab_found: true,
            checked_at: Date.now(),
        };
    }

    const data = result.data;
    console.log(`[TweetClaw-BG] checkXhsSignHealth: ok=${data?.ok}, mnsv2_present=${data?.mnsv2_present}, sign_format_ok=${data?.sign_format_ok}, reason=${data?.reason || 'none'}, sample=${data?.sample || 'n/a'}`);

    return {
        ...data,
        tab_found: true,
        checked_at: Date.now(),
    };
}

export async function getXhsNoteComments(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] getXhsNoteComments called', payload);
    const tab = await findXhsTab();
    if (!tab?.id) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'XHS_FETCH_NOTE_COMMENTS',
        ...payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with XHS content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        console.error('[TweetClaw-BG] XHS_FETCH_NOTE_COMMENTS failed:', result?.error);
        throw new Error(result?.error || 'Failed to fetch note comments');
    }

    console.log('[TweetClaw-BG] getXhsNoteComments success, data keys:', Object.keys(result.data || {}));
    return result.data;
}

export async function getXhsUserInfo(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] getXhsUserInfo called', payload);
    const tab = await findXhsTab();
    if (!tab?.id) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'XHS_FETCH_USER_INFO',
        ...payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with XHS content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        console.error('[TweetClaw-BG] XHS_FETCH_USER_INFO failed:', result?.error);
        throw new Error(result?.error || 'Failed to fetch user info');
    }

    console.log('[TweetClaw-BG] getXhsUserInfo success, data keys:', Object.keys(result.data || {}));
    return result.data;
}

export async function searchXhsTopics(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] searchXhsTopics called', payload);
    const tabId = await getOrOpenCreatorTab();

    const result: any = await sendMessageToTab(tabId, {
        type: 'XHS_SEARCH_TOPICS',
        ...payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with xiaohongshu content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        console.error('[TweetClaw-BG] XHS_SEARCH_TOPICS failed:', result?.error);
        throw new Error(result?.error || 'Failed to search topics');
    }

    console.log('[TweetClaw-BG] searchXhsTopics success, data keys:', Object.keys(result.data || {}));
    return result.data;
}

export async function getXhsNotifications(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] getXhsNotifications called', payload);
    const tab = await findXhsTab();
    if (!tab?.id) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'XHS_FETCH_NOTIFICATIONS',
        ...payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with XHS content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        console.error('[TweetClaw-BG] XHS_FETCH_NOTIFICATIONS failed:', result?.error);
        throw new Error(result?.error || 'Failed to fetch notifications');
    }

    console.log('[TweetClaw-BG] getXhsNotifications success, data keys:', Object.keys(result.data || {}));
    return result.data;
}

export async function getXhsPublishedNotes(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] getXhsPublishedNotes called');
    // /api/galaxy/v2/creator/note/user/posted 通过 xiaohongshu.com tab 的 content script 发出
    // 找到已有 xiaohongshu tab 或自动打开，等待 content script 就绪后返回
    const tabId = await getOrOpenCreatorTab();

    console.log(`[TweetClaw-BG] Sending XHS_FETCH_PUBLISHED_NOTES to xiaohongshu tab ${tabId}`);
    const result: any = await sendMessageToTab(tabId, {
        type: 'XHS_FETCH_PUBLISHED_NOTES',
        page: payload.page,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with xiaohongshu content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to fetch published notes');
    }

    return result.data;
}

export async function getXhsSearchFilter(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] getXhsSearchFilter called', payload);
    const tab = await findXhsTab();
    if (!tab?.id) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'XHS_SEARCH_FILTER',
        ...payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with XHS content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to fetch search filter');
    }

    return result.data;
}

export async function postXhsComment(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] postXhsComment called', payload);
    const tab = await findXhsTab();
    if (!tab?.id) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'XHS_POST_COMMENT',
        ...payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with XHS content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to post comment');
    }

    return result.data;
}

export async function searchXhsUsers(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] searchXhsUsers called', payload);
    const tab = await findXhsTab();
    if (!tab?.id) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'XHS_SEARCH_USERS',
        ...payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with XHS content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to search users');
    }

    return result.data;
}

export async function searchXhsUsersearch(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] searchXhsUsersearch called', payload);
    const tab = await findXhsTab();
    if (!tab?.id) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'XHS_SEARCH_USERSEARCH',
        ...payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with XHS content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to search users (usersearch)');
    }

    return result.data;
}

export async function followXhsUser(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] followXhsUser called', payload);
    const tab = await findXhsTab();
    if (!tab?.id) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] followXhsUser using tab', { tabId: tab.id, url: tab.url });

    const result: any = await sendMessageToTab(tab.id, {
        type: 'XHS_FOLLOW_USER',
        ...payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with XHS content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    console.log('[TweetClaw-BG] followXhsUser content script result', {
        success: result?.success,
        fstatus: result?.data?.data?.fstatus,
        error: result?.error,
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to follow user');
    }

    return result.data;
}

export async function unfollowXhsUser(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] unfollowXhsUser called', payload);
    const tab = await findXhsTab();
    if (!tab?.id) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] unfollowXhsUser using tab', { tabId: tab.id, url: tab.url });

    const result: any = await sendMessageToTab(tab.id, {
        type: 'XHS_UNFOLLOW_USER',
        ...payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with XHS content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    console.log('[TweetClaw-BG] unfollowXhsUser content script result', {
        success: result?.success,
        fstatus: result?.data?.data?.fstatus,
        error: result?.error,
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to unfollow user');
    }

    return result.data;
}

export async function deleteXhsNote(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] deleteXhsNote called', payload);
    const tab = await findXhsTab();
    if (!tab?.id) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] deleteXhsNote using tab', { tabId: tab.id, url: tab.url });

    const result: any = await sendMessageToTab(tab.id, {
        type: 'XHS_DELETE_NOTE',
        ...payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with XHS content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    console.log('[TweetClaw-BG] deleteXhsNote content script result', {
        success: result?.success,
        code: result?.data?.code,
        error: result?.error,
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to delete note');
    }

    return result.data;
}

export async function collectXhsNote(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] collectXhsNote called', payload);
    const tab = await findXhsTab();
    if (!tab?.id) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] collectXhsNote using tab', { tabId: tab.id, url: tab.url });

    const result: any = await sendMessageToTab(tab.id, {
        type: 'XHS_COLLECT_NOTE',
        ...payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with XHS content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    console.log('[TweetClaw-BG] collectXhsNote content script result', {
        success: result?.success,
        code: result?.data?.code,
        error: result?.error,
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to collect note');
    }

    return result.data;
}

export async function getXhsIntimacyList(payload: Record<string, unknown> = {}): Promise<any> {
    console.log('[TweetClaw-BG] getXhsIntimacyList called', payload);
    const tab = await findXhsTab();
    if (!tab?.id) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] getXhsIntimacyList using tab', { tabId: tab.id, url: tab.url });

    const result: any = await sendMessageToTab(tab.id, {
        type: 'XHS_GET_INTIMACY_LIST',
        ...payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with XHS content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    console.log('[TweetClaw-BG] getXhsIntimacyList content script result', {
        success: result?.success,
        items: result?.data?.data?.items?.length || 0,
        error: result?.error,
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to get intimacy list');
    }

    return result.data;
}

export async function deleteXhsComment(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] deleteXhsComment called', payload);
    const tab = await findXhsTab();
    if (!tab?.id) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] deleteXhsComment using tab', { tabId: tab.id, url: tab.url });

    const result: any = await sendMessageToTab(tab.id, {
        type: 'XHS_DELETE_COMMENT',
        ...payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with XHS content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    console.log('[TweetClaw-BG] deleteXhsComment content script result', {
        success: result?.success,
        code: result?.data?.code,
        error: result?.error,
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to delete comment');
    }

    return result.data;
}

export async function unlikeXhsNote(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] unlikeXhsNote called', payload);
    const tab = await findXhsTab();
    if (!tab?.id) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] unlikeXhsNote using tab', { tabId: tab.id, url: tab.url });

    const result: any = await sendMessageToTab(tab.id, {
        type: 'XHS_UNLIKE_NOTE',
        ...payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with XHS content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    console.log('[TweetClaw-BG] unlikeXhsNote content script result', {
        success: result?.success,
        like_count: result?.data?.data?.like_count,
        error: result?.error,
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to unlike note');
    }

    return result.data;
}

export async function likeXhsNote(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] likeXhsNote called', payload);
    const tab = await findXhsTab();
    if (!tab?.id) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] likeXhsNote using tab', { tabId: tab.id, url: tab.url });

    const result: any = await sendMessageToTab(tab.id, {
        type: 'XHS_LIKE_NOTE',
        ...payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with XHS content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    console.log('[TweetClaw-BG] likeXhsNote content script result', {
        success: result?.success,
        new_like: result?.data?.data?.new_like,
        code: result?.data?.code,
        error: result?.error,
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to like note');
    }

    return result.data;
}

export async function getXhsFriendFans(payload: Record<string, unknown> = {}): Promise<any> {
    const tabId = await getOrOpenCreatorTab();
    if (!tabId) throw new Error('No Xiaohongshu tab found.');

    const result: any = await sendMessageToTab(tabId, {
        type: 'XHS_GET_FRIEND_FANS',
        ...payload,
    }).catch((e: any) => { throw new Error(`Content script communication failed: ${e?.message}`); });

    if (!result?.success) throw new Error(result?.error || 'Failed to get friend fans');
    return result.data;
}

export async function createXhsCollection(payload: Record<string, unknown>): Promise<any> {
    const tabId = await getOrOpenCreatorTab();
    if (!tabId) throw new Error('No Xiaohongshu tab found.');

    const result: any = await sendMessageToTab(tabId, {
        type: 'XHS_CREATE_COLLECTION',
        ...payload,
    }).catch((e: any) => { throw new Error(`Content script communication failed: ${e?.message}`); });

    if (!result?.success) throw new Error(result?.error || 'Failed to create collection');
    return result.data;
}

export async function listXhsCollections(payload: Record<string, unknown> = {}): Promise<any> {
    const tabId = await getOrOpenCreatorTab();
    if (!tabId) throw new Error('No Xiaohongshu tab found.');

    const result: any = await sendMessageToTab(tabId, {
        type: 'XHS_LIST_COLLECTIONS',
        ...payload,
    }).catch((e: any) => { throw new Error(`Content script communication failed: ${e?.message}`); });

    if (!result?.success) throw new Error(result?.error || 'Failed to list collections');
    return result.data;
}

export async function listXhsCollectionNotes(payload: Record<string, unknown>): Promise<any> {
    const tabId = await getOrOpenCreatorTab();
    if (!tabId) throw new Error('No Xiaohongshu tab found.');

    const result: any = await sendMessageToTab(tabId, {
        type: 'XHS_LIST_COLLECTION_NOTES',
        ...payload,
    }).catch((e: any) => { throw new Error(`Content script communication failed: ${e?.message}`); });

    if (!result?.success) throw new Error(result?.error || 'Failed to list collection notes');
    return result.data;
}

export async function updateXhsCollection(payload: Record<string, unknown>): Promise<any> {
    const tabId = await getOrOpenCreatorTab();
    if (!tabId) throw new Error('No Xiaohongshu tab found.');

    const result: any = await sendMessageToTab(tabId, {
        type: 'XHS_UPDATE_COLLECTION',
        ...payload,
    }).catch((e: any) => { throw new Error(`Content script communication failed: ${e?.message}`); });

    if (!result?.success) throw new Error(result?.error || 'Failed to update collection');
    return result.data;
}

export async function getXhsNoteDetailStats(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] getXhsNoteDetailStats called', payload);
    // /api/galaxy/creator/data/note_detail_new 通过 xiaohongshu.com tab 的 content script 发出
    const tabId = await getOrOpenCreatorTab();

    console.log(`[TweetClaw-BG] Sending XHS_FETCH_NOTE_DETAIL_STATS to xiaohongshu tab ${tabId}`);
    const result: any = await sendMessageToTab(tabId, {
        type: 'XHS_FETCH_NOTE_DETAIL_STATS',
        note_id: payload.note_id,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with xiaohongshu content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to fetch note detail stats');
    }

    return result.data;
}

// ============================================================
// Instagram Handler Functions
// ============================================================

async function findIgTab(): Promise<chrome.tabs.Tab | null> {
    const tabs = await chrome.tabs.query({ url: 'https://www.instagram.com/*' });
    return tabs[0] || null;
}

export async function igCheckLogin(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igCheckLogin called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_check_login',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to check login status');
    }
    return result.data;
}

export async function igGetSelfInfo(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igGetSelfInfo called', payload);
    const tabId = await ensurePlatformTabReady(
        ['*://www.instagram.com/*'],
        'https://www.instagram.com/'
    );

    const result: any = await sendMessageToTab(tabId, {
        type: 'command.ig_get_self_info',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to get self info');
    }
    return result.data;
}

export async function igGetUserInfo(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igGetUserInfo called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_get_user_info',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to get user info');
    }
    return result.data;
}

export async function igSearchUser(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igSearchUser called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_search_user',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to search user');
    }
    return result.data;
}

export async function igGetFeed(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igGetFeed called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_get_feed',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to get feed');
    }
    return result.data;
}

export async function igGetMedia(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igGetMedia called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_get_media',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to get media info');
    }
    return result.data;
}

export async function igLikeMedia(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igLikeMedia called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_like_media',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to like media');
    }
    return result.data;
}

export async function igUnlikeMedia(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igUnlikeMedia called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_unlike_media',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to unlike media');
    }
    return result.data;
}

export async function igFollowUser(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igFollowUser called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_follow_user',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to follow user');
    }
    return result.data;
}

export async function igUnfollowUser(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igUnfollowUser called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_unfollow_user',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to unfollow user');
    }
    return result.data;
}

export async function igPostComment(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igPostComment called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_post_comment',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to post comment');
    }
    return result.data;
}

export async function igDeleteComment(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igDeleteComment called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_delete_comment',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to delete comment');
    }
    return result.data;
}

export async function igPostMedia(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igPostMedia called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_post_media',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to post media');
    }
    return result.data;
}

export async function igDeleteMedia(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igDeleteMedia called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_delete_media',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to delete media');
    }
    return result.data;
}

export async function igGetUserMedia(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igGetUserMedia called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_get_user_media',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to get user media');
    }
    return result.data;
}

export async function igGetMediaComments(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igGetMediaComments called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_get_media_comments',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to get media comments');
    }
    return result.data;
}

export async function igSearch(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igSearch called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_search',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to search');
    }
    return result.data;
}

export async function igGetNotifications(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igGetNotifications called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_get_notifications',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to get notifications');
    }
    return result.data;
}

export async function igGetFollowers(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igGetFollowers called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_get_followers',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to get followers');
    }
    return result.data;
}

export async function igGetFollowing(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] igGetFollowing called', payload);
    const tab = await findIgTab();
    if (!tab?.id) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tab.id, {
        type: 'command.ig_get_following',
        params: payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with IG content script:', e);
        throw new Error(`Content script communication failed: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to get following');
    }
    return result.data;
}
