import {
    watchedOps,
    MsgType,
    __DBK_query_id_map,
    __DBK_bearer_token,
    defaultQueryKeyMap
} from '../capture/consts';
import { findViewerSummary, findFeaturedTweet, findRepliesSnapshot, findProfileTweetsSnapshot, findTweetById, findDeepUser } from '../capture/extractor';
import { derivePageContext } from '../utils/scene-parser';
import { extractTweetId } from '../utils/route-parser';
import { LocalBridgeSocket } from '../bridge/local-bridge-socket';
import { OpenTabRequestPayload, OpenTabResponsePayload, CloseTabRequestPayload, CloseTabResponsePayload, NavigateTabRequestPayload, NavigateTabResponsePayload } from '../bridge/ws-protocol';

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

interface ApiHit {
    op: string;
    apiUrl: string;   // 真实 API 端点（含 queryId）
    pageUrl: string;  // 当前页面 URL
    method: string;
    timestamp: number;
    requestBody?: any;
    responseBody: any;
}

interface TabState {
    id: number;
    url: string;
    lastOp: string;
    data: Record<string, any>;
    apiHits: ApiHit[];
    stats: Record<string, { count: number; lastHit: number }>;
    account: any | null;
    featuredTweet: any | null;
    repliesSnapshot: any[];
    profileTweetsSnapshot: any[];
    uid: string | null;
    timestamp: number;
    lastBgSync: number;
    hookStatus?: { fetch: boolean; xhr: boolean };
}

let tabDataStore = new Map<number, TabState>();

// ── 持久化 ──────────────────────────────────────────────────────────
function saveStore() {
    const obj = Object.fromEntries(tabDataStore);
    chrome.storage.local.set({ '_tc_v4_store': obj });
}

chrome.storage.local.get('_tc_v4_store').then(res => {
    if (res._tc_v4_store) {
        tabDataStore = new Map(
            Object.entries(res._tc_v4_store).map(([k, v]) => [parseInt(k), v as TabState])
        );
    }
});

// ── 初始化默认哈希表 ───────────────────────────────────────────────
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
        console.log("%c[TweetClaw-BG] 🛠️ Default QueryIDs initialized/updated.", "color:#cbd5e0; font-style:italic");
    }
}

// 首次运行或安装时初始化
chrome.runtime.onInstalled.addListener(() => {
    initDefaultQueryKeys();
    console.log("%c[TweetClaw-BG] 🚀 Extension installed/updated.", "color:#1DA1F2; font-weight:bold");
});

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

function getOrCreateState(tabId: number, url = ''): TabState {
    let state = tabDataStore.get(tabId);
    if (!state) {
        state = {
            id: tabId, url, lastOp: 'initialized',
            data: {}, apiHits: [], stats: {},
            account: null, featuredTweet: null, repliesSnapshot: [], 
            profileTweetsSnapshot: [], uid: null,
            timestamp: Date.now(), lastBgSync: Date.now()
        };
        tabDataStore.set(tabId, state);
    }
    return state;
}

/**
 * 重置指定 Tab 的 Session 相关数据（用于登出或 Session 失效）
 */
function invalidateTabSession(tabId: number) {
    const state = tabDataStore.get(tabId);
    if (state) {
        state.account = null;
        state.uid = null;
        state.featuredTweet = null;
        state.repliesSnapshot = [];
        state.profileTweetsSnapshot = [];
        state.apiHits = []; 
        state.stats = {};
        state.data = {};
        state.lastOp = 'session_invalidated';
        saveStore();
        notifyDebugPages(tabId, 'STATUS');
        console.log(`[TweetClaw-BG] 🔒 Session invalidated for tab ${tabId}`);
    }
}

/**
 * 重置全局 Session（用于全局登出）
 */
function invalidateAllSessions() {
    for (const tabId of tabDataStore.keys()) {
        const state = tabDataStore.get(tabId);
        if (state) {
            state.account = null;
            state.uid = null;
            state.featuredTweet = null;
            state.repliesSnapshot = [];
            state.profileTweetsSnapshot = [];
            state.apiHits = [];
            state.stats = {};
            state.data = {};
            state.lastOp = 'session_cleared';
            notifyDebugPages(tabId, 'STATUS');
        }
    }
    saveStore();
    console.log('[TweetClaw-BG] 🔒 Global session invalidated');
}

/**
 * 通知所有已打开的 debug tab 有数据更新。
 * debug tab 的 URL 匹配 chrome-extension://.../debug.html
 */
function notifyDebugPages(xTabId: number, type: 'DATA' | 'STATUS') {
    chrome.tabs.query({ url: chrome.runtime.getURL('debug.html') }).then(debugTabs => {
        for (const dt of debugTabs) {
            if (dt.id) {
                chrome.tabs.sendMessage(dt.id, {
                    type: 'DEBUG_UPDATE_PUSH',
                    updateType: type,
                    tabId: xTabId
                }).catch(() => {});
            }
        }
    }).catch(() => {
        // 若 debug 页未打开则静默忽略
    });
}

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
        console.log(`%c[TweetClaw-BG] 🎯 HARVEST SUCCESS (Hook): ${key} → ${queryId}`, "color:#4ade80; font-weight:bold; border:1px solid #4ade80; padding:2px 4px; border-radius:4px;");
    }
}

async function harvestBearer(bearer: string | null | undefined) {
    if (!bearer || !bearer.startsWith('Bearer ')) return;
    const res = await chrome.storage.local.get(__DBK_bearer_token);
    if (res[__DBK_bearer_token] !== bearer) {
        await chrome.storage.local.set({ [__DBK_bearer_token]: bearer });
        console.log('[TweetClaw-BG] ✅ Harvested bearer token');
    }
}

// ── 移除旧的 action.onClicked ──────────────────────────────
// 已交由 popup 控制
// ── 消息中枢 ─────────────────────────────────────────────────────────
//
// 重要架构说明：
//   sender.tab 只对 content script 消息有值。
//   debug 页面是 extension page，sender.tab === undefined。
//   因此 tabId guard 不能全局提前，必须按消息类型分别处理。
//
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // ── GET_BRIDGE_STATUS: popup queries live connection state ────────
    if (message.type === 'GET_BRIDGE_STATUS') {
        const status = {
            connected: localBridge.isConnected(),
            url: localBridge.getCurrentUrl(),
            serverInfo: localBridge.getServerInfo()
        };
        if (sendResponse) sendResponse(status);
        return true;
    }

    // ── UPDATE_WS_CONFIG: update WebSocket host and port ──────────────
    if (message.type === 'UPDATE_WS_CONFIG') {
        const { host, port } = message;
        // Save to storage
        chrome.storage.local.set({ wsHost: host, wsPort: port }).then(() => {
            // Reconnect with new config
            localBridge.reconnect(host, port);
            if (sendResponse) sendResponse({ success: true });
        });
        return true;
    }

    // ── UPDATE_INSTANCE_NAME: update instance name and reconnect ──────
    if (message.type === 'UPDATE_INSTANCE_NAME') {
        const { name } = message;
        // Name is already saved to storage by popup, just trigger reconnect
        chrome.storage.local.get(['wsHost', 'wsPort']).then(res => {
            const host = (res.wsHost as string) || '127.0.0.1';
            const port = (res.wsPort as number) || 10086;
            localBridge.reconnect(host, port);
            if (sendResponse) sendResponse({ success: true });
        });
        return true;
    }

    // ── WS_PORT_CHANGED (legacy support) ──────────────────────────────
    if (message.type === 'WS_PORT_CHANGED') {
        // For backward compatibility
        chrome.storage.local.set({ wsPort: message.port }).then(() => {
            localBridge.reconnect('127.0.0.1', message.port);
            if (sendResponse) sendResponse({ ok: true });
        });
        return true;
    }

    // ── 来自 content script 的 API 拦截数据 ────────────────────────
    if (message.type === 'CAPTURED_DATA') {
        const tabId = sender.tab?.id;
        if (!tabId) return; // 必须来自 content script
        (async () => {
            const state = getOrCreateState(tabId, message.pageUrl);
            const confirmedUid = await getAuthenticUid();

            state.lastOp = message.op;
            state.url = message.pageUrl || state.url;
            
            // 每个 op 只保留最新一份数据（覆盖旧的）
            state.data[message.op] = message.data;

            // 核心改进：对于详情页，额外按 tweetId 缓存一份，防止在 thread 中深入跳转时覆盖掉主贴数据
            if (message.op === 'TweetDetail' && message.pageUrl) {
                const focalId = extractTweetId(message.pageUrl);
                if (focalId) {
                    state.data[`TweetDetail_${focalId}`] = message.data;
                }
            }

            state.lastBgSync = Date.now();

            if (!state.stats[message.op]) state.stats[message.op] = { count: 0, lastHit: 0 };
            state.stats[message.op].count++;
            state.stats[message.op].lastHit = Date.now();

            // 去除非重复的同名 op，保持网格界面清爽，每个 op 只留最新一次记录，方便调试
            state.apiHits = state.apiHits.filter(h => h.op !== message.op);
            
            // 加入最新的记录
            state.apiHits.unshift({
                op: message.op,
                apiUrl: message.apiUrl || '',
                pageUrl: message.pageUrl || '',
                method: message.method || 'POST',
                timestamp: Date.now(),
                requestBody: message.requestBody,
                responseBody: message.data
            });
            // 最多保留 30 种不同 op 的详情
            if (state.apiHits.length > 30) state.apiHits.pop();

            // 身份提取
            const summary = findViewerSummary(message.data, confirmedUid || undefined);
            if (summary) {
                state.account = { ...state.account, ...summary };
                state.uid = summary.userId;
                // 将最新身份写入会话级全局存储，确保其他所有模块能快速访问
                chrome.storage.session.set({
                    '_tc_global_session_account': {
                        ...summary,
                        _updatedAt: Date.now()
                    }
                }).catch(() => {});
                
                // 同时保存到 local storage 供 content script fetch 使用
                chrome.storage.local.set({ 
                    screenName: summary.handle.replace('@', ''),
                    userId: summary.userId
                }).catch(() => {});
            }

            // 推文提取
            const tweet = findFeaturedTweet(message.data, message.pageUrl);
            if (tweet) {
                state.featuredTweet = tweet;
                // 当提取到新的主推文时，同时提取一次回复快照
                state.repliesSnapshot = findRepliesSnapshot(message.data, message.pageUrl, state.account?.handle);
            } else if (message.op === 'TweetDetail') {
                // 特殊场景：如果是 TweetDetail 响应但没找到主推文（可能网络包只有回复），也尝试提取
                const snapshot = findRepliesSnapshot(message.data, message.pageUrl, state.account?.handle);
                if (snapshot.length > 0) state.repliesSnapshot = snapshot;
            }

            // Profile 推文快照提取
            if (message.op === 'UserTweets' || message.op === 'UserTweetsAndReplies') {
                const newProfileTweets = findProfileTweetsSnapshot(message.data, state.account?.handle);
                if (newProfileTweets.length > 0) {
                    // 如果 URL 指向不同的 profile，则清除旧快照（简单根据路径名判断）
                    const currentProfile = state.url.split('?')[0].split('/').filter(Boolean).pop();
                    const lastProfile = (state.data['last_profile_handle'] || '');
                    
                    if (currentProfile && currentProfile !== lastProfile) {
                        state.profileTweetsSnapshot = [];
                        state.data['last_profile_handle'] = currentProfile;
                    }

                    const existingMap = new Map((state.profileTweetsSnapshot || []).map(t => [t.tweetId, t]));
                    for (const t of newProfileTweets) {
                        existingMap.set(t.tweetId, t);
                    }
                    
                    // 将 Map 转回数组，保留在列表中的顺序
                    state.profileTweetsSnapshot = Array.from(existingMap.values());
                }
            }

            // 自动收割
            await harvestQueryId(message.op, message.apiUrl);
            await harvestBearer(message.bearerToken);

            saveStore();
            notifyDebugPages(tabId, 'DATA');
        })();
        return; // 异步，不需要 return true（不使用 sendResponse）
    }

    // ── 来自 content script 的 hook 状态上报 ───────────────────────
    if (message.type === 'REPORT_HOOK_STATUS') {
        const tabId = sender.tab?.id;
        if (!tabId) return;
        const state = getOrCreateState(tabId);
        state.hookStatus = message.status;
        state.lastBgSync = Date.now();
        saveStore();
        notifyDebugPages(tabId, 'STATUS');
        return;
    }

    // ── 以下消息来自 debug 页面（sender.tab 为 undefined）─────────

    // 查询所有 x.com tab 列表
    if (message.type === 'LIST_ALL_X_TABS') {
        chrome.tabs.query({ url: ['*://twitter.com/*', '*://x.com/*'] }).then(tabs => {
            const result = tabs.map(t => {
                const s = tabDataStore.get(t.id!);
                return {
                    id: t.id,
                    url: t.url || s?.url || '',
                    active: t.active,
                    lastOp: s?.lastOp || 'pending',
                    account: s?.account || null,
                    hookStatus: s?.hookStatus || null,
                    lastBgSync: s?.lastBgSync || 0
                };
            });
            sendResponse(result);
        });
        return true; // 异步 sendResponse
    }

    if (message.type === 'CREATE_X_TAB') {
        chrome.tabs.create({ url: message.url || 'https://x.com/' }).then(tab => {
            sendResponse({ ok: true, tabId: tab.id });
        }).catch(err => {
            sendResponse({ ok: false, error: err.message });
        });
        return true;
    }

    if (message.type === 'FOCUS_X_TAB') {
        chrome.tabs.update(message.tabId, { active: true }).then(tab => {
            if (tab && tab.windowId) {
                chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
            }
            sendResponse({ ok: true });
        }).catch(err => {
            sendResponse({ ok: false, error: err.message });
        });
        return true;
    }

    if (message.type === 'CLOSE_X_TAB') {
        chrome.tabs.remove(message.tabId).then(() => {
            sendResponse({ ok: true });
        }).catch(err => {
            // If tab already closed, we consider it success for the intended state
            if (err.message.includes('No tab with id')) {
                sendResponse({ ok: true, warning: 'Tab already closed' });
            } else {
                sendResponse({ ok: false, error: err.message });
            }
        });
        return true;
    }

    if (message.type === 'NAVIGATE_X_TAB') {
        const { tabId, url } = message;
        if (!tabId || !url) {
            sendResponse({ ok: false, error: 'Missing tabId or url' });
            return true;
        }

        const isX = url.includes('x.com') || url.includes('twitter.com');
        if (!isX) {
            sendResponse({ ok: false, error: 'Navigation restricted to X domains' });
            return true;
        }

        chrome.tabs.update(tabId, { url }).then(() => {
            sendResponse({ ok: true, tabId, url });
        }).catch(err => {
            sendResponse({ ok: false, error: err.message });
        });
        return true;
    }

    // 查询指定 tab 的完整截获数据
    if (message.type === 'GET_TAB_DATA') {
        const tabId = message.tabId; // 必须由 debug 页面显式传入
        if (!tabId) { sendResponse(null); return true; }
        
        getAuthenticUid().then(uid => {
            let s = tabDataStore.get(tabId);
            
            // 如果实时的 cookie 已经没了，而内存里还觉得有账号，则触发失效
            if (!uid && s?.account) {
                invalidateTabSession(tabId);
                s = tabDataStore.get(tabId);
            }

            // 如果已经登录但 Last Op 还没更新（停留在 session 清理标记上），则标记为正在等待身份
            if (uid && s && (s.lastOp === 'session_cleared' || s.lastOp === 'session_invalidated')) {
                s.lastOp = 'awaiting_identity';
            }
            
            const data = s || { 
                id: tabId, 
                url: '', 
                lastOp: 'unknown', 
                data: {}, 
                apiHits: [], 
                stats: {}, 
                account: null, 
                featuredTweet: null, 
                uid: null, 
                timestamp: Date.now(), 
                lastBgSync: 0 
            };
            
            sendResponse({
                ...data,
                allWatchedOps: watchedOps
            });
        });
        return true;
    }

    // 查询 session 状态（SessionManager 使用）
    if (message.type === 'GET_SESSION_STATUS') {
        const tabId = message.tabId || sender.tab?.id;
        if (!tabId) { sendResponse({ account: null, hookStatus: null, lastBgSync: 0 }); return true; }
        const s = tabDataStore.get(tabId);
        sendResponse({
            account: s?.account || null,
            hookStatus: s?.hookStatus || null,
            lastBgSync: s?.lastBgSync || 0
        });
        return true;
    }

    // 获取当前页面 Scene 上下文
    if (message.type === 'GET_PAGE_CONTEXT') {
        const tabId = message.tabId || sender.tab?.id;
        if (!tabId) {
            sendResponse(derivePageContext(undefined, false, false));
            return true;
        }
        
        getAuthenticUid().then(uid => {
            const isLoggedIn = !!uid;
            const s = tabDataStore.get(tabId);
            const hasSession = !!s?.account?.handle;
            const featuredTweet = s?.featuredTweet || null;
            const activeAccountHandle = s?.account?.handle || null;
            const repliesSnapshot = s?.repliesSnapshot || [];
            const profileTweetsSnapshot = s?.profileTweetsSnapshot || [];

            chrome.tabs.get(tabId).then(tab => {
                const currentUrl = tab.url || s?.url || '';
                const targetId = extractTweetId(currentUrl);
                let featuredTweet = s?.featuredTweet || null;
                let repliesSnapshot = s?.repliesSnapshot || [];

                // 核心修复逻辑：
                // 如果当前是 tweet_detail 场景，尝试从缓存中找回与当前 URL 匹配的数据
                // 优先使用按 ID 索引的缓存，避免在 thread 中由于深入跳转导致的覆盖问题
                if (targetId) {
                    const cachedData = s?.data[`TweetDetail_${targetId}`] || s?.data['TweetDetail'];
                    if (cachedData) {
                        if (featuredTweet?.id !== targetId) {
                            const refitted = findTweetById(cachedData, targetId);
                            if (refitted) {
                                featuredTweet = refitted;
                                s.featuredTweet = refitted;
                            }
                        }
                        // 重新计算回复列表
                        repliesSnapshot = findRepliesSnapshot(cachedData, currentUrl, activeAccountHandle);
                        s.repliesSnapshot = repliesSnapshot;
                    }
                }

                sendResponse({
                    ...derivePageContext(currentUrl, hasSession, isLoggedIn, featuredTweet, activeAccountHandle),
                    repliesSnapshot,
                    profileTweetsSnapshot
                });
            }).catch(() => {
                const currentUrl = s?.url || '';
                const targetId = extractTweetId(currentUrl);
                let featuredTweet = s?.featuredTweet || null;
                let repliesSnapshot = s?.repliesSnapshot || [];

                if (targetId) {
                    const cachedData = s?.data[`TweetDetail_${targetId}`] || s?.data['TweetDetail'];
                    if (cachedData) {
                        if (featuredTweet?.id !== targetId) {
                            const refitted = findTweetById(cachedData, targetId);
                            if (refitted) {
                                featuredTweet = refitted;
                                s.featuredTweet = refitted;
                            }
                        }
                        repliesSnapshot = findRepliesSnapshot(cachedData, currentUrl, activeAccountHandle);
                        s.repliesSnapshot = repliesSnapshot;
                    }
                }

                sendResponse({
                    ...derivePageContext(currentUrl, hasSession, isLoggedIn, featuredTweet, activeAccountHandle),
                    repliesSnapshot,
                    profileTweetsSnapshot
                });
            });
        });
        return true;
    }

    // 写操作代理（debug 页面 → background → content script 执行）
    if (message.type === 'EXEC_PROXY_ACTION') {
        const targetTabId = message.tabId;
        if (!targetTabId) { sendResponse({ ok: false, error: 'No tabId' }); return true; }
        chrome.tabs.sendMessage(targetTabId, {
            type: MsgType.EXECUTE_ACTION,
            action: message.action,
            tweetId: message.tweetId,
            userId: message.userId
        }).then(r => sendResponse(r))
          .catch(e => sendResponse({ ok: false, error: e.message }));
        return true;
    }
});

// ── tab 状态监听 ──────────────────────────────────────────────────
// 监听 URL 变化，确保 debug 页面能实时反映 routeKind 变化
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        const url = changeInfo.url;
        const isX = url.includes('x.com') || url.includes('twitter.com');
        
        // 识别登出行为或登录流页面
        const isLogout = url.includes('/logout') || url.includes('/i/flow/login') || url.includes('?logged_out=1');

        if (isX) {
            const state = tabDataStore.get(tabId);
            if (state) state.url = url;
            
            if (isLogout) {
                invalidateTabSession(tabId);
            } else {
                notifyDebugPages(tabId, 'STATUS');
            }
        }
    }
});

// ── tab 关闭时清理内存（storage 里留着供 SW 重启恢复）─────────────
chrome.tabs.onRemoved.addListener(tabId => {
    tabDataStore.delete(tabId);
    saveStore();
    // 通知 debug 页面 tab 列表已变动
    notifyDebugPages(tabId, 'STATUS');
});

// ── Cookie 监听：捕捉登录状态变化 ──────────────────────────────────
chrome.cookies.onChanged.addListener((changeInfo) => {
    if (changeInfo.cookie.domain.includes('x.com') || changeInfo.cookie.domain.includes('twitter.com')) {
        if (changeInfo.cookie.name === 'twid') {
            if (changeInfo.removed) {
                // 再次确认是否真的没了（防止 X 在同一毫秒内更新 cookie 导致频繁清理）
                getAuthenticUid().then(uid => {
                    if (!uid) {
                        invalidateAllSessions();
                    }
                });
            } else {
                // Cookie 更新 -> 重新探测
                chrome.tabs.query({ url: ['*://twitter.com/*', '*://x.com/*'] }).then(tabs => {
                    for (const t of tabs) {
                        if (t.id) notifyDebugPages(t.id, 'STATUS');
                    }
                });
            }
        }
    }
});

// ── 全局请求级 QueryID 及 Bearer 拦截（参照 TweetCat）────────────
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        const headers = details.requestHeaders || [];
        const authHeader = headers.find(h => h.name.toLowerCase() === 'authorization');
        if (authHeader && authHeader.value?.startsWith('Bearer ')) {
            const token = authHeader.value;
            chrome.storage.local.get(__DBK_bearer_token).then(res => {
                if (res[__DBK_bearer_token] !== token) {
                    chrome.storage.local.set({ [__DBK_bearer_token]: token }).then(() => {
                        console.log("[TweetClaw-BG] 🌐 Global Intercept Update Bearer Token");
                    });
                }
            });
        }
        return { requestHeaders: headers } as chrome.webRequest.BlockingResponse;
    },
    { urls: ["https://x.com/i/api/graphql/*"] },
    ["requestHeaders"]
);

chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        const url = new URL(details.url);
        const match = url.pathname.match(/^\/i\/api\/graphql\/([^/]+)\/([^/]+)/);

        if (!match) return;
        const queryId = match[1];
        const operationName = match[2];

        if (!watchedOps.includes(operationName)) {
            return;
        }

        chrome.storage.local.get(__DBK_query_id_map).then(data => {
            const existingMap: Record<string, string> = (data[__DBK_query_id_map] as Record<string, string>) || {};
            if (existingMap[operationName] !== queryId) {
                existingMap[operationName] = queryId;
                chrome.storage.local.set({ [__DBK_query_id_map]: existingMap }).then(() => {
                    console.log(`%c[TweetClaw-BG] 🛰️ GLOBAL INTERCEPT (WebRequest): ${operationName} → ${queryId}`, "color:#60a5fa; font-weight:bold; border:1px solid #60a5fa; padding:2px 4px; border-radius:4px;");
                });
            }
        });
        
        return {} as chrome.webRequest.BlockingResponse;
    },
    {
        urls: ["https://x.com/i/api/*"], // 扩大匹配范围到所有 API 子路径
        types: ["xmlhttprequest", "other", "ping"]
    }
);

// ── 临时调试监听：捕捉一切非 GraphQL 的关注请求 ──────────────────────
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        const url = new URL(details.url);
        if (url.pathname.includes('friendships') || url.pathname.includes('follow')) {
            console.log(`%c[TweetClaw-DEBUG] 🔍 DETECTED POTENTIAL FOLLOW API: ${url.pathname}`, "color: #fbbf24; font-weight: bold;");
        }
        return {};
    },
    { urls: ["https://x.com/i/api/*"] }
);

// ── LocalBridge 业务逻辑 ──────────────────────────────────────────

export async function queryXTabsStatus() {
    console.log('[TweetClaw-BG] queryXTabsStatus called');
    
    // 1. Query all X tabs
    const tabs = await chrome.tabs.query({ url: ["*://x.com/*", "*://twitter.com/*"] });
    
    // 2. Query active tab in current window
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 3. Find if active tab is an X tab
    const isXTabNative = (url: string | undefined) => {
        if (!url) return false;
        return url.includes('x.com') || url.includes('twitter.com');
    }
    
    let activeXTabId: number | null = null;
    let activeXUrl: string | null = null;
    
    if (activeTab && isXTabNative(activeTab.url)) {
        activeXTabId = activeTab.id || null;
        activeXUrl = activeTab.url || null;
    }
    
    // 4. Check login status (twid cookie)
    const uid = await getAuthenticUid();
    const isLoggedIn = !!uid;
    
    // 5. Map tabs to XTabInfo
    const tabInfos = tabs.map(t => ({
        tabId: t.id || 0,
        url: t.url || '',
        active: t.active
    }));
    
    const payload = {
        hasXTabs: tabs.length > 0,
        isLoggedIn: isLoggedIn,
        activeXTabId: activeXTabId,
        activeXUrl: activeXUrl,
        tabs: tabInfos
    };
    
    console.log('[TweetClaw-BG] queryXTabsStatus result:', payload);
    return payload;
}

/**
 * 从 raw user result 对象中组装标准 profile（不依赖 findViewerSummary）
 */
function buildProfileFromRaw(raw: any, uid: string | null) {
    const legacy = raw?.legacy ?? {};

    // X 的 GraphQL 响应中，screen_name 和 name 可能在多个位置：
    // 1. legacy.screen_name （标准路径）
    // 2. core.screen_name （新版本 API 把基础字段收紧到 core 顶层）
    // 3. core.user_results.result.legacy.screen_name （嵌套引用）
    const screenName =
        legacy.screen_name ||
        raw?.core?.screen_name ||
        raw?.core?.user_results?.result?.legacy?.screen_name ||
        '';
    const name =
        legacy.name ||
        raw?.core?.name ||
        raw?.core?.user_results?.result?.legacy?.name ||
        screenName;

    const createdAt = legacy.created_at || raw?.core?.created_at || '';
    const avatar = legacy.profile_image_url_https
        // X 有时返回 _normal 缩略图，换成原图
        ? legacy.profile_image_url_https.replace('_normal', '')
        : undefined;

    return {
        isLoggedIn: true,
        twitterId: uid || raw?.rest_id || '',
        name,
        screenName: screenName ? `@${screenName}` : '',
        verified: raw?.is_blue_verified || legacy.verified || false,
        followersCount: legacy.followers_count,
        friendsCount: legacy.friends_count,
        statusesCount: legacy.statuses_count,
        avatar,
        description: legacy.description,
        createdAt,
        raw,   // 完整原始数据透传给 Mac App
        updatedAt: Date.now()
    };
}

export async function queryXBasicInfo() {
    console.log('[TweetClaw-BG] queryXBasicInfo called');

    // 1. 找活跃的 x.com 标签页
    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    const targetTab = xTabs.find(t => t.active) || xTabs[0];
    if (!targetTab?.id) throw new Error('No active x.com tab found');

    const uid = await getAuthenticUid();

    // 2. 委托 Content Script 在页面上下文执行 fetchUserByScreenName
    console.log('[TweetClaw-BG] queryXBasicInfo: delegating to content script, tab', targetTab.id);
    const messagePromise = chrome.tabs.sendMessage(targetTab.id, {
        type: 'FETCH_SETTINGS_AND_PROFILE',
    }).catch((e: any) => {
        console.warn('[TweetClaw-BG] sendMessage error:', e?.message);
        return null;
    });
    const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 15000));
    const result: any = await Promise.race([messagePromise, timeoutPromise]);

    // 3. Content Script 成功返回
    if (result?.success && result?.raw) {
        console.log('[TweetClaw-BG] queryXBasicInfo: success from content script');
        return buildProfileFromRaw(result.raw, uid);
    }

    // 4. Fallback：tabDataStore 里找 uid 匹配 of UserByScreenName
    console.warn('[TweetClaw-BG] queryXBasicInfo: content script failed/timeout, trying tabDataStore fallback');
    if (uid) {
        const capturedData = tabDataStore.get(targetTab.id)?.data?.['UserByScreenName'];
        if (capturedData) {
            const rawFromStore = findDeepUser(capturedData);
            if (rawFromStore?.rest_id === uid) {
                console.log('[TweetClaw-BG] queryXBasicInfo: fallback ok from tabDataStore');
                return buildProfileFromRaw(rawFromStore, uid);
            }
            console.warn('[TweetClaw-BG] queryXBasicInfo: tabDataStore uid mismatch, skipping');
        }
    }

    // 5. 最终兜底：返回基础登录信息
    console.error('[TweetClaw-BG] queryXBasicInfo: all strategies failed, returning minimal profile');
    const storedScreenName = (await chrome.storage.local.get('screenName')).screenName as string | undefined;
    return {
        isLoggedIn: true,
        twitterId: uid || '',
        name: storedScreenName || '',
        screenName: storedScreenName ? `@${storedScreenName}` : '',
        verified: false,
        raw: null,
        updatedAt: Date.now()
    };
}

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

export async function closeXTab(payload: CloseTabRequestPayload): Promise<CloseTabResponsePayload> {
    const tabId = payload.tabId;
    
    return new Promise((resolve) => {
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
                resolve({ success: false, reason: "not_found" });
                return;
            }

            // Check if it's an x.com tab
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


export async function navigateXTab(payload: NavigateTabRequestPayload): Promise<NavigateTabResponsePayload> {
    let tabId = payload.tabId;
    const path = payload.path || "home";
    const url = "https://x.com/" + (path.startsWith("/") ? path.substring(1) : path);

    if (!tabId) {
        // Find the first x.com tab
        const tabs = await chrome.tabs.query({ url: ["*://x.com/*", "*://twitter.com/*"] });
        if (tabs.length === 0) {
            throw new Error("No x.com tabs found to navigate");
        }
        tabId = tabs[0].id;
    }

    if (!tabId) {
        throw new Error("Invalid tabId");
    }

    const targetTabId = tabId;

    return new Promise((resolve) => {
        chrome.tabs.update(targetTabId, { url }, (tab) => {
            if (chrome.runtime.lastError) {
                resolve({ success: false, tabId: targetTabId, url, error: chrome.runtime.lastError.message });
            } else {
                resolve({
                    success: true,
                    tabId: targetTabId,
                    url: tab?.url || url
                });
            }
        });
    });
}

export async function execAction(payload: any): Promise<any> {
    const { action, tweetId, userId, tabId } = payload;
    console.log(`[TweetClaw-BG] execAction called: ${action}`, { tweetId, userId, tabId });

    let targetTabId = tabId;
    if (!targetTabId) {
        const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
        const targetTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = targetTab?.id;
    }

    if (!targetTabId) {
        throw new Error('No target tab found for action');
    }

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('Content script response timeout'));
        }, 8000);

        chrome.tabs.sendMessage(targetTabId, {
            type: MsgType.EXECUTE_ACTION,
            action,
            tweetId,
            userId,
            text: payload?.text || null   // 新增：透传 text 字段给 content script
        }).then(res => {
            clearTimeout(timer);
            resolve(res);
        }).catch(err => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

// 启动时确保存储已就绪
initDefaultQueryKeys();

// B1: 读取主页时间线
export async function queryHomeTimeline(payload: any) {
    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = payload?.tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) return { ok: false, error: 'No x.com tab found', data: null };

    const state = tabDataStore.get(targetTabId);
    const rawTimeline = state?.data?.['HomeLatestTimeline']
                     || state?.data?.['HomeTimeline']
                     || state?.data?.['TimelineHome'];

    if (!rawTimeline) {
        return {
            ok: false,
            error: 'Home timeline not yet captured. Navigate to x.com/home and wait for the page to load.',
            data: null
        };
    }

    const { extractTweetsFromTimeline } = await import('../capture/timeline-extractor');
    const tweets = extractTweetsFromTimeline(rawTimeline);
    return { ok: true, data: { tweets, count: tweets.length }, error: null };
}

// B2: 读取推文详情及回复
export async function queryTweet(payload: any) {
    const { tweetId, tabId } = payload as { tweetId: string, tabId?: number };
    if (!tweetId) return { ok: false, error: 'tweetId is required', data: null };

    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) return { ok: false, error: 'No x.com tab found', data: null };

    const state = tabDataStore.get(targetTabId);
    const rawDetail = (tweetId && state?.data?.[`TweetDetail_${tweetId}`])
                   || state?.data?.['TweetDetail'];

    if (!rawDetail) {
        return {
            ok: false,
            error: 'TweetDetail not captured yet. Navigate to the tweet detail page first.',
            data: null
        };
    }

    const tweet = findTweetById(rawDetail, tweetId) || state?.featuredTweet || null;
    if (!tweet) {
        return {
            ok: false,
            error: `Tweet ${tweetId} not found in captured detail payload.`,
            data: null
        };
    }

    return { ok: true, data: tweet, error: null };
}

export async function queryTweetReplies(payload: any) {
    const { tweetId, tabId, cursor } = payload as { tweetId: string, tabId?: number, cursor?: string };
    if (!tweetId) return { ok: false, error: 'tweetId is required', data: null };
    console.log(`[TweetClaw-BG] queryTweetReplies start tweetId=${tweetId} cursor=${cursor || '<nil>'} tabId=${tabId ?? '<nil>'}`);

    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) return { ok: false, error: 'No x.com tab found', data: null };
    console.log(`[TweetClaw-BG] queryTweetReplies using targetTabId=${targetTabId}`);

    const state = tabDataStore.get(targetTabId);
    const rawDetail = (tweetId && state?.data?.[`TweetDetail_${tweetId}`])
                   || state?.data?.['TweetDetail'];

    // 如果没有缓存数据且没有 cursor，返回错误
    if (!rawDetail && !cursor) {
        console.warn(`[TweetClaw-BG] queryTweetReplies missing cached TweetDetail tweetId=${tweetId} tabId=${targetTabId}`);
        return {
            ok: false,
            error: 'TweetDetail not captured yet. Navigate to the tweet detail page first.',
            data: null
        };
    }

    const { extractTimelineCursors } = await import('../capture/timeline-extractor');
    let detailPageData = rawDetail;
    let detailPageUrl = state?.url || '';

    // 始终主动获取最新数据以确保获得完整的 cursor 信息（包括 Top 和 Bottom cursor）
    // 缓存数据可能只包含 Bottom cursor，因为页面首次加载时已经在顶部
    if (true) {
        console.log(`[TweetClaw-BG] queryTweetReplies fetching continuation tweetId=${tweetId} cursor=${cursor}`);
        const fetchedPage: any = await new Promise(resolve => {
            chrome.tabs.sendMessage(targetTabId!, {
                type: 'FETCH_TWEET_REPLIES_PAGE',
                tweetId,
                cursor
            }, (resp) => resolve(resp || { success: false, error: 'No response' }));
        });

        if (!fetchedPage?.success || !fetchedPage?.data) {
            console.error(`[TweetClaw-BG] queryTweetReplies continuation failed tweetId=${tweetId} cursor=${cursor}`, fetchedPage);
            return {
                ok: false,
                error: fetchedPage?.error || 'Failed to fetch tweet replies page',
                data: null
            };
        }

        detailPageData = fetchedPage.data;
        detailPageUrl = fetchedPage.pageUrl || detailPageUrl;
        console.log(`[TweetClaw-BG] queryTweetReplies continuation success tweetId=${tweetId} cursor=${cursor}`);
    }

    const replies = findRepliesSnapshot(detailPageData, detailPageUrl, state?.account?.handle);
    const cursors = extractTimelineCursors(detailPageData);
    console.log(`[TweetClaw-BG] queryTweetReplies done tweetId=${tweetId} items=${replies.length} next=${cursors.next ? 'yes' : 'no'} previous=${cursors.previous ? 'yes' : 'no'} source=${cursor ? 'fetched_page' : 'cached_page'}`);

    // 防御性校验：如果是 continuation 页面而且没有 items，Twitter 依然会返回完整的 cursor 状态。
    // 我们必须如实返回从 API 拿到的 cursor（而不是返回 null），以免中断调用端（Mac UI）的分页状态导致上一页/下一页按钮永久失效。
    if (cursor && replies.length === 0) {
        console.warn(`[TweetClaw-BG] ⚠️ queryTweetReplies got EMPTY continuation page tweetId=${tweetId} cursor=${cursor} - returning empty result but preserving API cursors`);
        return {
            ok: true,
            data: {
                items: [],
                cursor: {
                    next: cursors.next,
                    previous: cursors.previous
                },
                hasMore: !!cursors.next,
                requestCursor: cursor,
                source: 'fetched_page',
                emptyPage: true
            },
            error: null
        };
    }

    return {
        ok: true,
        data: {
            items: replies,
            cursor: {
                next: cursors.next,
                previous: cursors.previous
            },
            hasMore: !!cursors.next,
            requestCursor: cursor || null,
            source: cursor ? 'fetched_page' : 'cached_page'
        },
        error: null
    };
}

export async function queryTweetDetail(payload: any) {
    const { tweetId, tabId } = payload as { tweetId: string, tabId?: number };
    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) return { ok: false, error: 'No x.com tab found', data: null };

    const state = tabDataStore.get(targetTabId);
    const rawDetail = (tweetId && state?.data?.[`TweetDetail_${tweetId}`])
                   || state?.data?.['TweetDetail'];

    if (!rawDetail) {
        return {
            ok: false,
            error: `TweetDetail not captured yet. Navigate to the tweet detail page first.`,
            data: null
        };
    }

    const { extractTweetsFromTimeline } = await import('../capture/timeline-extractor');
    const tweets = extractTweetsFromTimeline(rawDetail);
    return {
        ok: true,
        data: {
            featuredTweet: state?.featuredTweet || null,
            replies: state?.repliesSnapshot || [],
            allTweets: tweets,
            count: tweets.length
        },
        error: null
    };
}

// B3: 获取指定用户的 Profile（主动调用，不依赖页面导航）
export async function queryUserProfile(payload: any) {
    const { screenName, tabId } = payload as { screenName: string, tabId?: number };
    if (!screenName) return { ok: false, error: 'screenName is required', data: null };

    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) return { ok: false, error: 'No x.com tab found', data: null };

    const result: any = await new Promise(resolve => {
        chrome.tabs.sendMessage(targetTabId!, {
            type: 'FETCH_USER_PROFILE_BY_SCREEN_NAME',
            screenName: screenName.replace('@', '')
        }, (resp) => resolve(resp || { success: false, error: 'No response' }));
    });

    if (result?.success && result?.data) return { ok: true, data: result.data, error: null };
    return { ok: false, error: result?.error || 'Failed to fetch user profile', data: null };
}

// B4: 读取搜索结果
export async function querySearchTimeline(payload: any) {
    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = payload?.tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) return { ok: false, error: 'No x.com tab found', data: null };

    const state = tabDataStore.get(targetTabId);
    const rawSearch = state?.data?.['SearchTimeline'];

    if (!rawSearch) {
        return {
            ok: false,
            error: 'Search results not captured. Navigate to x.com/search?q=... first.',
            data: null
        };
    }

    const { extractTweetsFromTimeline } = await import('../capture/timeline-extractor');
    const tweets = extractTweetsFromTimeline(rawSearch);
    return { ok: true, data: { tweets, count: tweets.length }, error: null };
}
