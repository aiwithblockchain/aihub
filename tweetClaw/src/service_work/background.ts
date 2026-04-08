/**
 * TweetClaw Background Service Worker
 *
 * AI-Oriented Architecture: 完全透传推特原始响应，不做任何数据解析和缓存
 */

import { MsgType, __DBK_query_id_map, __DBK_bearer_token, defaultQueryKeyMap } from '../capture/consts';
import { LocalBridgeSocket } from '../bridge/local-bridge-socket';
import {
    OpenTabRequestPayload,
    OpenTabResponsePayload,
    CloseTabRequestPayload,
    CloseTabResponsePayload,
    NavigateTabRequestPayload,
    NavigateTabResponsePayload
} from '../bridge/ws-protocol';

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

// Initialize LocalBridge Socket
const localBridge = new LocalBridgeSocket();
localBridge.queryXTabsHandler = queryXTabsStatus;
localBridge.queryXBasicInfoHandler = queryXBasicInfo;
localBridge.openTabHandler = openXTab;
localBridge.closeTabHandler = closeXTab;
localBridge.navigateTabHandler = navigateXTab;
localBridge.execActionHandler = execAction;
localBridge.queryHomeTimelineHandler = queryHomeTimeline;
localBridge.queryTweetHandler = queryTweet;
localBridge.queryTweetRepliesHandler = queryTweetReplies;
localBridge.queryTweetDetailHandler = queryTweetDetail;
localBridge.queryUserProfileHandler = queryUserProfile;
localBridge.querySearchTimelineHandler = querySearchTimeline;
localBridge.uploadMediaHandler = uploadMedia;

// ── Listen for reconnect alarms ──────────────────────────────────
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'tweetclaw-reconnect') {
        console.log('[TweetClaw-BG] Reconnect alarm triggered');
        localBridge.handleReconnectAlarm();
    }
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

chrome.runtime.onInstalled.addListener(() => {
    initDefaultQueryKeys();
    console.log("[TweetClaw-BG] Extension installed/updated");
});

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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

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
        const { host, port } = message;
        chrome.storage.local.set({ wsHost: host, wsPort: port }).then(() => {
            localBridge.reconnect(host, port);
            if (sendResponse) sendResponse({ success: true });
        });
        return true;
    }

    // 更新实例名称
    if (message.type === 'UPDATE_INSTANCE_NAME') {
        chrome.storage.local.get(['wsHost', 'wsPort']).then(res => {
            const host = (res.wsHost as string) || '127.0.0.1';
            const port = (res.wsPort as number) || 10086;
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
    const { action, tweetId, userId, tabId, text, media_ids } = payload;
    console.log(`[TweetClaw-BG] execAction: ${action}`, { tweetId, userId, tabId, media_ids });

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
        action,
        tweetId,
        userId,
        text,
        media_ids
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
 * 查询推文详情 - 返回推特原始 GraphQL 响应
 */
export async function queryTweet(payload: QueryTweetPayload): Promise<TwitterResponse> {
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
        type: 'FETCH_TWEET',
        tweetId
    }).catch((e: any) => {
        throw new Error(`Failed to fetch tweet: ${e?.message}`);
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
 * 查询推文详情（旧版兼容接口）- 返回推特原始 GraphQL 响应
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
        count: count || 20
    });

    // 直接返回推特原始 GraphQL 响应
    return result;
}

/**
 * 上传媒体文件 - 返回 media_id
 */
export async function uploadMedia(payload: any): Promise<any> {
    const { mediaData, mimeType, tabId } = payload;
    const estimatedBytes = Math.floor((mediaData?.length || 0) * 3 / 4);
    console.log(`[TweetClaw-BG] uploadMedia called, mimeType=${mimeType}`);

    if (!mediaData || !mimeType) {
        throw new Error('mediaData and mimeType are required');
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

    // 委托 Content Script 调用推特媒体上传 API
    const result = await chrome.tabs.sendMessage(targetTabId, {
        type: 'UPLOAD_MEDIA',
        mediaData,
        mimeType
    }).catch((e: any) => {
        const rawMessage = e?.message || String(e);
        if (rawMessage.includes('Message exceeded maximum allowed size of 64MiB')) {
            const maxBytes = 64 * 1024 * 1024;
            throw new Error(`Media upload request is too large for Chrome extension messaging (limit: 64MiB). Current payload: ${estimatedBytes} bytes (${mimeType}).`);
        }
        throw new Error(`Failed to upload media: ${rawMessage}`);
    });

    if (!result?.success) {
        throw new Error(result?.error || 'Media upload failed');
    }

    // 返回 media_id
    return {
        success: true,
        media_id: result.media_id
    };
}

// 启动时初始化
initDefaultQueryKeys();
