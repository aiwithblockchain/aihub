/**
 * TweetClaw Background Service Worker
 *
 * AI-Oriented Architecture: 完全透传推特原始响应，不做任何数据解析和缓存
 */

import { MsgType, __DBK_query_id_map, __DBK_bearer_token, defaultQueryKeyMap } from '../capture/consts';
import { DEFAULT_WS_PORT, DEFAULT_REST_PORT } from '../config';
import { LocalBridgeSocket } from '../bridge/local-bridge-socket';
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
localBridge.xhsGetIntimacyListHandler = getXhsIntimacyList;
localBridge.xhsLikeNoteHandler = likeXhsNote;
localBridge.xhsUnlikeNoteHandler = unlikeXhsNote;
localBridge.xhsFollowUserHandler = followXhsUser;
localBridge.xhsDeleteCommentHandler = deleteXhsComment;
localBridge.openTabHandler = openXTab;
localBridge.closeTabHandler = closeXTab;
localBridge.navigateTabHandler = navigateXTab;
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
        console.log(`[TweetClaw-BG] chunk response, sessionId=${uploadSessionId}, chunkIndex=${chunkIndex}, chunkBase64Length=${chunk.chunkBase64.length}`);
        sendResponse({ success: true, ...chunk });
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
                const result = await chrome.tabs.sendMessage(tab.id, {
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

    // x-rap-param 跨 tab 转发：creator tab 请求 → background → www tab 计算 → 返回
    if (message.type === 'XHS_GET_RAP_PARAM') {
        (async () => {
            try {
                const wwwTabs = await chrome.tabs.query({ url: ['*://www.xiaohongshu.com/*', '*://xiaohongshu.com/*'] });
                if (!wwwTabs.length || !wwwTabs[0].id) {
                    sendResponse({ success: false, error: 'No www.xiaohongshu.com tab found' });
                    return;
                }
                const resp: any = await chrome.tabs.sendMessage(wwwTabs[0].id, {
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

    // x-s/x-t/x-s-common 跨 tab 转发：creator tab 请求 → background → www tab 计算 → 返回
    if (message.type === 'XHS_GET_SIGN') {
        (async () => {
            try {
                const wwwTabs = await chrome.tabs.query({ url: ['*://www.xiaohongshu.com/*', '*://xiaohongshu.com/*'] });
                if (!wwwTabs.length || !wwwTabs[0].id) {
                    sendResponse({ success: false, error: 'No www.xiaohongshu.com tab found' });
                    return;
                }
                const resp: any = await chrome.tabs.sendMessage(wwwTabs[0].id, {
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

    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    const targetTab = xTabs.find(t => t.active) || xTabs[0];
    if (!targetTab?.id) {
        throw new Error('No active x.com tab found');
    }

    // 委托 Content Script 调用推特 API 并返回原始响应
    const result: any = await chrome.tabs.sendMessage(targetTab.id, {
        type: 'FETCH_SETTINGS_AND_PROFILE',
    }).catch((e: any) => {
        throw new Error(`Failed to communicate with content script: ${e?.message}`);
    });

    if (!result?.success) {
        throw new Error('Failed to fetch user profile from Twitter API');
    }

    // 直接返回推特原始响应，不做任何解析
    return result.raw;
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
    const result: any = await chrome.tabs.sendMessage(tab.id, msg).catch((e: any) => {
        throw new Error(`Content script communication failed: ${e?.message}`);
    });
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

    const targetTab = await findXhsTab();
    if (!targetTab?.id) {
        throw new Error('No Xiaohongshu tab found');
    }

    const result: any = await chrome.tabs.sendMessage(targetTab.id, {
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

    const targetTab = await findXhsTab();
    if (!targetTab?.id) {
        throw new Error('No Xiaohongshu tab found');
    }

    const result: any = await chrome.tabs.sendMessage(targetTab.id, {
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
 * 关闭指定的 X 标签页
 */
export async function closeXTab(payload: CloseTabRequestPayload): Promise<CloseTabResponsePayload> {
    const tabId = payload.tabId;

    return new Promise((resolve) => {
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
                resolve({ success: false, reason: "not_found" });
                return;
            }

            const url = tab.url || "";
            if (!url.includes("x.com") && !url.includes("twitter.com")) {
                resolve({ success: false, reason: "not_found" });
                return;
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
 * 导航到指定路径
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

    if (!targetTabId) {
        return { success: false, tabId: 0, url: "", error: "No target tab found" };
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
    const result = await chrome.tabs.sendMessage(targetTabId, {
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
    const result = await chrome.tabs.sendMessage(targetTabId, {
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
    const result = await chrome.tabs.sendMessage(targetTabId, {
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
    const result = await chrome.tabs.sendMessage(targetTabId, {
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
    const result = await chrome.tabs.sendMessage(targetTabId, {
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
    const { query, cursor, count, tabId } = payload;

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
    const result = await chrome.tabs.sendMessage(targetTabId, {
        type: 'FETCH_SEARCH_TIMELINE',
        query,
        cursor,
        count,
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
    const result = await chrome.tabs.sendMessage(targetTabId, {
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

    const result = await chrome.tabs.sendMessage(targetTabId, {
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

    const result = await chrome.tabs.sendMessage(targetTabId, {
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

    const result = await chrome.tabs.sendMessage(targetTabId, {
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

    const result: any = await chrome.tabs.sendMessage(targetTab.id, {
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

    const result: any = await chrome.tabs.sendMessage(targetTab.id, {
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

/** 找到或打开 creator.xiaohongshu.com 标签页，等待签名链路就绪后返回 tabId */
async function getOrOpenCreatorTab(): Promise<number> {
    const CREATOR_URL = 'https://creator.xiaohongshu.com/home';

    // 1. 优先找已有的 creator 标签页
    const creatorTabs = await chrome.tabs.query({ url: '*://creator.xiaohongshu.com/*' });
    let tab = creatorTabs[0] || null;

    if (!tab) {
        console.log('[TweetClaw-BG] No creator tab found, opening one...');
        tab = await chrome.tabs.create({ url: CREATOR_URL, active: false });
    }

    const tabId = tab.id!;

    // 2. 轮询等待签名链路就绪（_webmsxyw 可用）
    //    分两阶段：先等 content script PING 通，再等 XHS_SIGN_TEST 成功
    //    creator 页面加载较慢，给 30s
    const MAX_WAIT_MS = 30000;
    const POLL_MS = 800;
    const deadline = Date.now() + MAX_WAIT_MS;

    let pingOk = false;
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, POLL_MS));

        // 阶段一：content script 响应 PING
        if (!pingOk) {
            try {
                const pong: any = await chrome.tabs.sendMessage(tabId, { type: 'XHS_PING' });
                if (pong?.ok) {
                    pingOk = true;
                    console.log(`[TweetClaw-BG] creator tab content script ready: tabId=${tabId}`);
                }
            } catch {
                continue; // content script 还没注入
            }
        }

        // 阶段二：签名函数 _webmsxyw 就绪（通过 SIGN_TEST 验证）
        if (pingOk) {
            try {
                const signResult: any = await chrome.tabs.sendMessage(tabId, {
                    type: 'XHS_SIGN_TEST',
                    url: '/api/sns/web/v2/user/me',
                    data: '',
                });
                if (signResult?.success && signResult?.data?.['x-s'] && signResult?.data?.['x-s-common']) {
                    console.log(`[TweetClaw-BG] creator tab sign+x-s-common ready: tabId=${tabId}`);
                    return tabId;
                }
                const missing = !signResult?.success ? 'sign failed' : (!signResult?.data?.['x-s'] ? 'x-s missing' : 'x-s-common missing');
                console.log(`[TweetClaw-BG] creator tab not ready (${missing}), retrying...`);
            } catch {
                // 继续等
            }
        }
    }

    throw new Error('creator.xiaohongshu.com tab sign function not ready within 30s');
}

export async function publishXhsImageNote(payload: Record<string, unknown> = {}) {
    console.log('[TweetClaw-BG] publishXhsImageNote called', {
        title: payload.title,
        imageCount: (payload.images as any[])?.length,
    });

    if (!payload.images || (payload.images as any[]).length === 0) {
        throw new Error('images array is required');
    }

    // 发布流程必须从 creator.xiaohongshu.com 发出（origin 正确）
    // x-rap-param 通过 background 转发给 www.xiaohongshu.com tab 计算
    const tabId = await getOrOpenCreatorTab();

    const result: any = await chrome.tabs.sendMessage(tabId, {
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

    const result: any = await chrome.tabs.sendMessage(tabId, {
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
 * 检查 creator.xiaohongshu.com 上 window.mnsv2 签名函数的健康状态
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

    const creatorTabs = await chrome.tabs.query({ url: '*://creator.xiaohongshu.com/*' });
    const tab = creatorTabs[0] || null;

    if (!tab?.id) {
        console.warn('[TweetClaw-BG] checkXhsSignHealth: no creator tab found, auto-opening one...');
        try {
            // 自动打开 creator tab 并等待签名链路就绪（最多 30s）
            const newTabId = await getOrOpenCreatorTab();
            console.log(`[TweetClaw-BG] checkXhsSignHealth: auto-opened creator tab tabId=${newTabId}, re-checking health...`);

            // 重新发健康检查消息
            const retryResult: any = await chrome.tabs.sendMessage(newTabId, {
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
                reason: 'no_creator_tab',
                tab_found: false, checked_at: Date.now(),
            };
        }
    }

    console.log(`[TweetClaw-BG] checkXhsSignHealth: found creator tab tabId=${tab.id}, url=${tab.url}`);

    const result: any = await chrome.tabs.sendMessage(tab.id, {
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

    const result: any = await chrome.tabs.sendMessage(tab.id, {
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

    const result: any = await chrome.tabs.sendMessage(tab.id, {
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

    const result: any = await chrome.tabs.sendMessage(tabId, {
        type: 'XHS_SEARCH_TOPICS',
        ...payload,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with creator content script:', e);
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

    const result: any = await chrome.tabs.sendMessage(tab.id, {
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
    // /api/galaxy/v2/creator/note/user/posted 必须从 creator.xiaohongshu.com 发出（CORS）
    // 找到已有 creator tab 或自动打开，等待 content script 就绪后返回
    const tabId = await getOrOpenCreatorTab();

    console.log(`[TweetClaw-BG] Sending XHS_FETCH_PUBLISHED_NOTES to creator tab ${tabId}`);
    const result: any = await chrome.tabs.sendMessage(tabId, {
        type: 'XHS_FETCH_PUBLISHED_NOTES',
        page: payload.page,
    }).catch((e: any) => {
        console.error('[TweetClaw-BG] Failed to communicate with creator content script:', e);
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

    const result: any = await chrome.tabs.sendMessage(tab.id, {
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

    const result: any = await chrome.tabs.sendMessage(tab.id, {
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

    const result: any = await chrome.tabs.sendMessage(tab.id, {
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

export async function followXhsUser(payload: Record<string, unknown>): Promise<any> {
    console.log('[TweetClaw-BG] followXhsUser called', payload);
    const tab = await findXhsTab();
    if (!tab?.id) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] followXhsUser using tab', { tabId: tab.id, url: tab.url });

    const result: any = await chrome.tabs.sendMessage(tab.id, {
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

export async function getXhsIntimacyList(payload: Record<string, unknown> = {}): Promise<any> {
    console.log('[TweetClaw-BG] getXhsIntimacyList called', payload);
    const tab = await findXhsTab();
    if (!tab?.id) {
        throw new Error('No Xiaohongshu tab found. Please open xiaohongshu.com first.');
    }
    console.log('[TweetClaw-BG] getXhsIntimacyList using tab', { tabId: tab.id, url: tab.url });

    const result: any = await chrome.tabs.sendMessage(tab.id, {
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

    const result: any = await chrome.tabs.sendMessage(tab.id, {
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

    const result: any = await chrome.tabs.sendMessage(tab.id, {
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

    const result: any = await chrome.tabs.sendMessage(tab.id, {
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
