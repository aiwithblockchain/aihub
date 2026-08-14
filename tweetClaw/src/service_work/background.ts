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
import {
    getLiveTabs,
    pruneStaleHealthEntries,
    TWEETCLAW_ALIVE_KEY_PREFIX
} from '../utils/live-tabs';

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
    text?: string;
    media_ids?: string[];
    attachmentUrl?: string;
}

interface QueryTimelinePayload {
}

interface QueryTweetPayload {
    tweetId: string;
}

interface QueryTweetRepliesPayload {
    tweetId: string;
    cursor?: string;
}

interface QueryUserProfilePayload {
    screenName: string;
}

interface QuerySearchTimelinePayload {
    query?: string;
    cursor?: string;
    count?: number;
    product?: string; // Top | Latest | People | Media（透传到 x.com GraphQL SearchTimeline.variables.product）
}

interface QueryUserTweetsPayload {
    userId: string;
    cursor?: string;
    count?: number;
}

interface QueryFollowersPayload {
    userId: string;
    cursor?: string;
    count?: number;
}

interface QueryFollowingPayload {
    userId: string;
    cursor?: string;
    count?: number;
}

interface QueryBlueVerifiedFollowersPayload {
    userId: string;
    cursor?: string;
    count?: number;
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

    if (alarm.name === HEALTH_CHECK_ALARM) {
        void pruneStaleHealthEntries()
            .catch((e) => console.warn('[TweetClaw-BG] failed to prune health entries', e));
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

// ── 平台存活健康表（实现抽到 ../utils/live-tabs.ts）────────────────────────

const HEALTH_CHECK_ALARM = 'tweetclaw-health-check';

// 同名 alarm 会覆盖旧 alarm；periodInMinutes: 1 对应 60s 检查一次
void chrome.alarms.create(HEALTH_CHECK_ALARM, { periodInMinutes: 1 })
    .catch((e) => console.warn('[TweetClaw-BG] failed to create health-check alarm', e));

// 统一的 Twitter / Instagram 业务 tab 选择入口：
// 先用 chrome.tabs.query 确认 tab 当前仍存在，再用健康表过滤出 content script 存活的 tab，
// 最后取最小 tabId，保证确定性。
async function findLiveTab(platform: 'twitter' | 'instagram'): Promise<number | null> {
    const urlPatterns = platform === 'twitter'
        ? ['*://x.com/*', '*://twitter.com/*']
        : ['*://www.instagram.com/*', '*://instagram.com/*'];

    const tabs = await chrome.tabs.query({ url: urlPatterns });
    const liveIds = (await getLiveTabs())[platform] ?? [];
    const candidates = tabs
        .map(t => t.id)
        .filter((id): id is number => id != null && liveIds.includes(id));

    return candidates.length ? Math.min(...candidates) : null;
}

// 观测用：SW 醒着时周期打印一次，便于排查
setInterval(() => {
    void getLiveTabs().then(tabs => {
        console.log(`[TweetClaw-BG] Live tabs:`, JSON.stringify(tabs));
    });
}, 30_000);

// ── 消息中枢 ─────────────────────────────────────────────────────
// 注意：onMessage 监听器必须保持在 SW 顶层同步注册。content script 的首条心跳在注入后
// 立即发送，若把本监听器移入异步初始化，冷启动窗口内会丢首条心跳并触发 content 侧 reload。
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // content script 消息式心跳：background 更新健康表
    if (message.type === 'TWEETCLAW_HEARTBEAT') {
        const platform = typeof message.platform === 'string' ? message.platform : '';
        const tabId = sender.tab?.id;
        if (platform && tabId != null) {
            void chrome.storage.session
                .set({ [`${TWEETCLAW_ALIVE_KEY_PREFIX}${platform}:${tabId}`]: Date.now() })
                .catch((e) => console.warn('[TweetClaw-BG] health table update failed', e));
        }
        if (sendResponse) sendResponse({ ok: true });
        return false;
    }

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
                await reloadIgHomeTab();
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
                const tabId = await findXhsMainTab();
                if (!tabId) throw new Error('No Xiaohongshu tab found');
                const result = await sendMessageToTab(tabId, {
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

/**
 * 查询当前登录账号基本信息 - 返回推特原始 GraphQL 响应
 */
export async function queryXBasicInfo() {
    console.log('[TweetClaw-BG] queryXBasicInfo called');

    const tabId = await findLiveTab('twitter');
    if (!tabId) {
        throw new Error('No x.com tab found');
    }

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
}> = [
    { platform: 'twitter' },
    { platform: 'instagram' },
    { platform: 'xiaohongshu' },
];

async function checkPlatformLogin(
    platform: 'twitter' | 'instagram' | 'xiaohongshu'
): Promise<AccountStatusResult> {
    // Twitter / Instagram 与业务命令统一走 findLiveTab；XHS 与业务命令统一走 findXhsMainTab。
    let tabId: number | null = null;
    if (platform === 'twitter' || platform === 'instagram') {
        tabId = await findLiveTab(platform);
    } else {
        tabId = await findXhsMainTab();
    }

    if (!tabId) {
        console.log(`[tweetClaw][A41] ${platform}: no live tab → logged_out`);
        return {
            platform,
            status: 'logged_out',
            tabId: null,
            lastCheckedAt: Date.now(),
        };
    }

    console.log(`[tweetClaw][A41] ${platform}: querying live tabId=${tabId}`);
    try {
        const resp = await sendMessageToTab<CheckLoginResponse>(tabId, {
            type: 'CHECK_LOGIN',
            tabId,
        });
        console.log(`[tweetClaw][A41] ${platform}: content script replied`, JSON.stringify(resp));
        return {
            platform,
            status: resp?.loggedIn ? 'logged_in' : 'logged_out',
            tabId,
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
            tabId,
            lastCheckedAt: Date.now(),
            error: e?.message || String(e),
        };
    }
}

async function collectAccountStatuses(): Promise<AccountStatusResult[]> {
    const results = await Promise.all(
        PLATFORM_TAB_CONFIG.map(cfg => checkPlatformLogin(cfg.platform))
    );
    return results;
}

// ── IG doc_id 过期自愈 ────────────────────────────────────────────
//
// IG doc_id 过期自愈：把 instagram 非活动 tab 导航回主页，让前端重新发 GraphQL 以捕获新 doc_id。

async function reloadIgHomeTab(): Promise<void> {
    const HOME_URL = 'https://www.instagram.com/';
    const tabs = await chrome.tabs.query({ url: ['*://www.instagram.com/*', '*://instagram.com/*'] });
    const tab = tabs.find(t => !t.active) || tabs[0];
    if (!tab?.id) {
        console.log('[tweetClaw-BG] reloadIgHomeTab: no IG tab found, skip');
        return;
    }
    const normalize = (u: string) => u.split('#')[0].split('?')[0];
    if (normalize(tab.url || '') === normalize(HOME_URL)) {
        console.log(`[tweetClaw-BG] reloadIgHomeTab: reload tabId=${tab.id} (already on home)`);
        await chrome.tabs.reload(tab.id);
    } else {
        console.log(`[tweetClaw-BG] reloadIgHomeTab: navigate tabId=${tab.id} from=${tab.url} to=${HOME_URL}`);
        await chrome.tabs.update(tab.id, { url: HOME_URL });
    }
}

// ── XHS 工具函数 ──────────────────────────────────────────────────────────────

/** 找到已打开的任意小红书标签页 */
async function pickMinLiveTab(platform: string, tabs: chrome.tabs.Tab[]): Promise<number | null> {
    const liveIds = (await getLiveTabs())[platform] ?? [];
    const candidates = tabs
        .map(t => t.id)
        .filter((id): id is number => id != null && liveIds.includes(id));
    return candidates.length ? Math.min(...candidates) : null;
}

async function findXhsMainTab(): Promise<number | null> {
    // 主站内容浏览 / 互动 API：只用 www / xiaohongshu.com
    const allTabs = await chrome.tabs.query({});
    const tabs = allTabs.filter(t => {
        const url = t.url || '';
        return url.startsWith('https://www.xiaohongshu.com/')
            || url.startsWith('https://xiaohongshu.com/')
            || url.startsWith('http://www.xiaohongshu.com/')
            || url.startsWith('http://xiaohongshu.com/');
    });
    return pickMinLiveTab('xiaohongshu', tabs);
}

async function findXhsCreatorTab(): Promise<number | null> {
    // 发布 / 创作者数据 API：只用 creator.xiaohongshu.com
    const allTabs = await chrome.tabs.query({});
    const tabs = allTabs.filter(t => {
        const url = t.url || '';
        return url.startsWith('https://creator.xiaohongshu.com/')
            || url.startsWith('http://creator.xiaohongshu.com/');
    });
    return pickMinLiveTab('xiaohongshu', tabs);
}

/** 向小红书 content script 发消息，返回 result.data 或抛错 */
async function sendXhsMessage(tabId: number, msg: Record<string, any>): Promise<any> {
    const result: any = await sendMessageToTab(tabId, msg);
    if (!result?.success) {
        throw new Error(result?.error || `XHS command failed: ${msg.type}`);
    }
    return result.data;
}

// ── XHS Handler 函数 ────────────────────────────────────────────────────────

export async function queryXhsHomefeed(payload: Record<string, unknown> = {}) {
    console.log('[TweetClaw-BG] queryXhsHomefeed called');
    const tabId = await findXhsMainTab();
    if (!tabId) throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    return sendXhsMessage(tabId, { type: 'XHS_FETCH_HOMEFEED', ...payload });
}

/**
 * 查询小红书当前登录账号信息
 */
export async function queryXhsAccountInfo() {
    console.log('[TweetClaw-BG] queryXhsAccountInfo called');

    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
        type: 'XHS_FETCH_CURRENT_USER',
    }).catch((e: any) => {
        throw new Error(`Failed to communicate with content script: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Failed to fetch current user info from Xiaohongshu API');
    }

    return result.data;
}

/**
 * 查询小红书笔记详情（通过 feed 接口）
 */
export async function queryXhsFeed(payload: Record<string, unknown> = {}) {
    console.log('[TweetClaw-BG] queryXhsFeed called');

    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found');
    }

    const result: any = await sendMessageToTab(tabId, {
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
    console.log(`[TweetClaw-BG] execAction: ${payload.action}`, payload);

    const targetTabId = await findLiveTab('twitter');
    if (!targetTabId) {
        throw new Error('No x.com tab found');
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
export async function queryHomeTimeline(_payload: QueryTimelinePayload): Promise<TwitterResponse> {
    const targetTabId = await findLiveTab('twitter');
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
    const { tweetId, cursor } = payload;
    if (!tweetId) {
        throw new Error('tweetId is required');
    }

    const targetTabId = await findLiveTab('twitter');
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
    const { tweetId } = payload;
    if (!tweetId) {
        throw new Error('tweetId is required');
    }

    const targetTabId = await findLiveTab('twitter');
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
    const { screenName } = payload;
    if (!screenName) {
        throw new Error('screenName is required');
    }

    const targetTabId = await findLiveTab('twitter');
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
    const { query, cursor, count, product } = payload;

    const targetTabId = await findLiveTab('twitter');
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
    const { userId, cursor, count } = payload;

    const targetTabId = await findLiveTab('twitter');
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
    const { userId, cursor, count } = payload;
    if (!userId) throw new Error('userId is required');

    const targetTabId = await findLiveTab('twitter');
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
    const { userId, cursor, count } = payload;
    if (!userId) throw new Error('userId is required');

    const targetTabId = await findLiveTab('twitter');
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
    const { userId, cursor, count } = payload;
    if (!userId) throw new Error('userId is required');

    const targetTabId = await findLiveTab('twitter');
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

    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found');
    }

    const result: any = await sendMessageToTab(tabId, {
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

    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found');
    }

    const result: any = await sendMessageToTab(tabId, {
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

    const tabId = await findXhsCreatorTab();
    if (!tabId) throw new Error('No creator.xiaohongshu.com tab found. Please open creator tab first.');

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

    const tabId = await findXhsCreatorTab();
    if (!tabId) throw new Error('No creator.xiaohongshu.com tab found. Please open creator tab first.');

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

    const tabId = await findXhsMainTab();
    if (!tabId) {
        console.warn('[TweetClaw-BG] checkXhsSignHealth: no xiaohongshu tab found');
        return {
            ok: false, mnsv2_present: false, sign_format_ok: false,
            reason: 'no_xiaohongshu_tab',
            tab_found: false, checked_at: Date.now(),
        };
    }

    console.log(`[TweetClaw-BG] checkXhsSignHealth: found xiaohongshu tab tabId=${tabId}`);

    const result: any = await sendMessageToTab(tabId, {
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
    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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
    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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
    const tabId = await findXhsCreatorTab();
    if (!tabId) throw new Error('No creator.xiaohongshu.com tab found. Please open creator tab first.');

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
    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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
    const tabId = await findXhsCreatorTab();
    if (!tabId) throw new Error('No creator.xiaohongshu.com tab found. Please open creator tab first.');

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
    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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
    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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
    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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
    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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
    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] followXhsUser using tab', { tabId });

    const result: any = await sendMessageToTab(tabId, {
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
    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] unfollowXhsUser using tab', { tabId });

    const result: any = await sendMessageToTab(tabId, {
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
    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] deleteXhsNote using tab', { tabId });

    const result: any = await sendMessageToTab(tabId, {
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
    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] collectXhsNote using tab', { tabId });

    const result: any = await sendMessageToTab(tabId, {
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
    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] getXhsIntimacyList using tab', { tabId });

    const result: any = await sendMessageToTab(tabId, {
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
    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] deleteXhsComment using tab', { tabId });

    const result: any = await sendMessageToTab(tabId, {
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
    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] unlikeXhsNote using tab', { tabId });

    const result: any = await sendMessageToTab(tabId, {
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
    const tabId = await findXhsMainTab();
    if (!tabId) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] likeXhsNote using tab', { tabId });

    const result: any = await sendMessageToTab(tabId, {
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
    const tabId = await findXhsCreatorTab();
    if (!tabId) throw new Error('No creator.xiaohongshu.com tab found. Please open creator tab first.');

    const result: any = await sendMessageToTab(tabId, {
        type: 'XHS_GET_FRIEND_FANS',
        ...payload,
    }).catch((e: any) => { throw new Error(`Content script communication failed: ${e?.message}`); });

    if (!result?.success) throw new Error(result?.error || 'Failed to get friend fans');
    return result.data;
}

export async function createXhsCollection(payload: Record<string, unknown>): Promise<any> {
    const tabId = await findXhsCreatorTab();
    if (!tabId) throw new Error('No creator.xiaohongshu.com tab found. Please open creator tab first.');

    const result: any = await sendMessageToTab(tabId, {
        type: 'XHS_CREATE_COLLECTION',
        ...payload,
    }).catch((e: any) => { throw new Error(`Content script communication failed: ${e?.message}`); });

    if (!result?.success) throw new Error(result?.error || 'Failed to create collection');
    return result.data;
}

export async function listXhsCollections(payload: Record<string, unknown> = {}): Promise<any> {
    const tabId = await findXhsCreatorTab();
    if (!tabId) throw new Error('No creator.xiaohongshu.com tab found. Please open creator tab first.');

    const result: any = await sendMessageToTab(tabId, {
        type: 'XHS_LIST_COLLECTIONS',
        ...payload,
    }).catch((e: any) => { throw new Error(`Content script communication failed: ${e?.message}`); });

    if (!result?.success) throw new Error(result?.error || 'Failed to list collections');
    return result.data;
}

export async function listXhsCollectionNotes(payload: Record<string, unknown>): Promise<any> {
    const tabId = await findXhsCreatorTab();
    if (!tabId) throw new Error('No creator.xiaohongshu.com tab found. Please open creator tab first.');

    const result: any = await sendMessageToTab(tabId, {
        type: 'XHS_LIST_COLLECTION_NOTES',
        ...payload,
    }).catch((e: any) => { throw new Error(`Content script communication failed: ${e?.message}`); });

    if (!result?.success) throw new Error(result?.error || 'Failed to list collection notes');
    return result.data;
}

export async function updateXhsCollection(payload: Record<string, unknown>): Promise<any> {
    const tabId = await findXhsCreatorTab();
    if (!tabId) throw new Error('No creator.xiaohongshu.com tab found. Please open creator tab first.');

    const result: any = await sendMessageToTab(tabId, {
        type: 'XHS_UPDATE_COLLECTION',
        ...payload,
    }).catch((e: any) => { throw new Error(`Content script communication failed: ${e?.message}`); });

    if (!result?.success) throw new Error(result?.error || 'Failed to update collection');
    return result.data;
}

export async function getXhsNoteDetailStats(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] getXhsNoteDetailStats called', payload);
    const tabId = await findXhsCreatorTab();
    if (!tabId) throw new Error('No creator.xiaohongshu.com tab found. Please open creator tab first.');

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

interface IgCheckLoginPayload {}

interface IgGetSelfInfoPayload {}

interface IgGetUserInfoPayload {
    userId: string;
}

interface IgSearchUserPayload {
    username: string;
}

interface IgGetFeedPayload {
    maxId?: string;
}

interface IgGetMediaPayload {
    shortcode: string;
}

interface IgLikeMediaPayload {
    mediaId: string;
    moduleName?: string;
    userId?: string;
    username?: string;
    d?: number;
}

interface IgUnlikeMediaPayload {
    mediaId: string;
}

interface IgFollowUserPayload {
    userId: string;
    moduleName?: string;
    username?: string;
}

interface IgUnfollowUserPayload {
    userId: string;
}

interface IgPostCommentPayload {
    mediaId: string;
    text: string;
    repliedToCommentId?: string;
}

interface IgDeleteCommentPayload {
    mediaId: string;
    commentId: string;
}

interface IgPostMediaPayload {
    caption: string;
    imageBase64?: string;
    imageBytes?: any;
    imageBase64List?: string[];
    videoBytes?: any;
    videoBase64?: string;
    uploadIds?: string[];
    mimeType?: string;
    disableComments?: boolean;
    shareToThreads?: boolean;
    location?: any;
    videoDuration?: number;
    videoWidth?: number;
    videoHeight?: number;
    thumbnailBase64?: string;
    thumbnailBytes?: any;
}

interface IgDeleteMediaPayload {
    mediaId: string;
}

interface IgGetUserMediaPayload {
    userId?: string;
    username?: string;
    count?: number;
    after?: string;
}

interface IgGetMediaCommentsPayload {
    mediaId: string;
    minId?: string;
    sortOrder?: 'popular' | 'chronological';
    canSupportThreading?: boolean;
    permalinkEnabled?: boolean;
}

interface IgSearchPayload {
    query: string;
    searchSessionId?: string;
    serpSessionId?: string;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
    context?: string;
}

interface IgGetNotificationsPayload {
    maxId?: string;
}

interface IgGetFollowersPayload {
    userId: string;
    count?: number;
    maxId?: string;
    searchSurface?: string;
}

interface IgGetFollowingPayload {
    userId: string;
    count?: number;
    maxId?: string;
}

export async function igCheckLogin(payload: IgCheckLoginPayload): Promise<any> {
    console.log('[TweetClaw-BG] igCheckLogin called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igGetSelfInfo(payload: IgGetSelfInfoPayload): Promise<any> {
    console.log('[TweetClaw-BG] igGetSelfInfo called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

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

export async function igGetUserInfo(payload: IgGetUserInfoPayload): Promise<any> {
    console.log('[TweetClaw-BG] igGetUserInfo called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igSearchUser(payload: IgSearchUserPayload): Promise<any> {
    console.log('[TweetClaw-BG] igSearchUser called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igGetFeed(payload: IgGetFeedPayload): Promise<any> {
    console.log('[TweetClaw-BG] igGetFeed called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igGetMedia(payload: IgGetMediaPayload): Promise<any> {
    console.log('[TweetClaw-BG] igGetMedia called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igLikeMedia(payload: IgLikeMediaPayload): Promise<any> {
    console.log('[TweetClaw-BG] igLikeMedia called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igUnlikeMedia(payload: IgUnlikeMediaPayload): Promise<any> {
    console.log('[TweetClaw-BG] igUnlikeMedia called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igFollowUser(payload: IgFollowUserPayload): Promise<any> {
    console.log('[TweetClaw-BG] igFollowUser called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igUnfollowUser(payload: IgUnfollowUserPayload): Promise<any> {
    console.log('[TweetClaw-BG] igUnfollowUser called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igPostComment(payload: IgPostCommentPayload): Promise<any> {
    console.log('[TweetClaw-BG] igPostComment called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igDeleteComment(payload: IgDeleteCommentPayload): Promise<any> {
    console.log('[TweetClaw-BG] igDeleteComment called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igPostMedia(payload: IgPostMediaPayload): Promise<any> {
    console.log('[TweetClaw-BG] igPostMedia called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igDeleteMedia(payload: IgDeleteMediaPayload): Promise<any> {
    console.log('[TweetClaw-BG] igDeleteMedia called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igGetUserMedia(payload: IgGetUserMediaPayload): Promise<any> {
    console.log('[TweetClaw-BG] igGetUserMedia called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igGetMediaComments(payload: IgGetMediaCommentsPayload): Promise<any> {
    console.log('[TweetClaw-BG] igGetMediaComments called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igSearch(payload: IgSearchPayload): Promise<any> {
    console.log('[TweetClaw-BG] igSearch called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igGetNotifications(payload: IgGetNotificationsPayload): Promise<any> {
    console.log('[TweetClaw-BG] igGetNotifications called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igGetFollowers(payload: IgGetFollowersPayload): Promise<any> {
    console.log('[TweetClaw-BG] igGetFollowers called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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

export async function igGetFollowing(payload: IgGetFollowingPayload): Promise<any> {
    console.log('[TweetClaw-BG] igGetFollowing called', payload);
    const tabId = await findLiveTab('instagram');
    if (!tabId) {
        throw new Error('No Instagram tab found. Please open instagram.com first.');
    }

    const result: any = await sendMessageToTab(tabId, {
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
