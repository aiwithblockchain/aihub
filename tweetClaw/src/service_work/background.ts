import {
    watchedOps,
    MsgType,
    __DBK_query_id_map,
    __DBK_bearer_token,
    defaultQueryKeyMap
} from '../capture/consts';
import { findViewerSummary, findFeaturedTweet, findRepliesSnapshot, findProfileTweetsSnapshot, findTweetById } from '../capture/extractor';
import { derivePageContext } from '../utils/scene-parser';
import { extractTweetId } from '../utils/route-parser';
import { LocalBridgeSocket } from '../bridge/local-bridge-socket';

// Initialize LocalBridge WebSocket Client
const localBridge = new LocalBridgeSocket();
localBridge.queryXTabsHandler = queryXTabsStatus;
localBridge.queryXBasicInfoHandler = queryXBasicInfo;

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

// ── 点击扩展图标：打开或聚焦 debug tab ──────────────────────────────
chrome.action.onClicked.addListener(() => {
    const debugUrl = chrome.runtime.getURL('debug.html');
    chrome.tabs.query({ url: debugUrl }).then(existing => {
        if (existing.length > 0 && existing[0].id) {
            // 已有 debug tab → 聚焦它
            chrome.tabs.update(existing[0].id, { active: true });
            if (existing[0].windowId) {
                chrome.windows.update(existing[0].windowId, { focused: true }).catch(() => {});
            }
        } else {
            // 没有 → 新开一个
            chrome.tabs.create({ url: debugUrl });
        }
    });
});

// ── 消息中枢 ─────────────────────────────────────────────────────────
//
// 重要架构说明：
//   sender.tab 只对 content script 消息有值。
//   debug 页面是 extension page，sender.tab === undefined。
//   因此 tabId guard 不能全局提前，必须按消息类型分别处理。
//
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

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

export async function queryXBasicInfo() {
    console.log('[TweetClaw-BG] queryXBasicInfo called');
    
    // Check login status (twid cookie)
    const uid = await getAuthenticUid();
    const isLoggedIn = !!uid;
    
    if (!isLoggedIn) {
        return { isLoggedIn: false };
    }
    
    // 优先从 session storage 判断是否已有最近更新的数据
    let matchedAccount: any = null;
    let updatedAt: number | null = null;
    try {
        const sessionData = await chrome.storage.session.get('_tc_global_session_account');
        if (sessionData && sessionData._tc_global_session_account) {
            const acc = sessionData._tc_global_session_account as any;
            // 确保 userId 匹配当前有效的 uid
            if (acc.userId === uid) {
                matchedAccount = acc;
                updatedAt = acc._updatedAt || null;
            }
        }
    } catch (e) {
        console.warn('[TweetClaw-BG] queryXBasicInfo session.get err:', e);
    }
    
    // 如果 session 中没有命中，再降级去查找 tab 状态缓存
    if (!matchedAccount) {
        for (const [tabId, state] of tabDataStore.entries()) {
            if (state.account && state.account.userId === uid) {
                matchedAccount = state.account;
                updatedAt = state.timestamp || null; // fallback
                break;
            }
        }
    }
    
    // 最后如果还是找不到完全一致的，返回任意存在的账号兜底
    if (!matchedAccount) {
        for (const [tabId, state] of tabDataStore.entries()) {
            if (state.account) {
                matchedAccount = state.account;
                updatedAt = state.timestamp || null;
                break;
            }
        }
    }
    
    const payload: any = {
        isLoggedIn: true,
        name: matchedAccount?.displayName,
        screenName: matchedAccount?.handle,
        twitterId: uid,
        verified: matchedAccount?.verified
    };
    if (updatedAt) payload.updatedAt = updatedAt;
    
    console.log('[TweetClaw-BG] queryXBasicInfo result:', payload);
    return payload;
}

// 启动时确保存储已就绪
initDefaultQueryKeys();
