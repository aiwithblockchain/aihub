/**
 * background.ts - aiClaw Background Service Worker (Phase 1)
 *
 * 职责：
 *   1. 接收并存储从 content script 转发来的凭证数据
 *   2. 提供凭证查询接口（供未来的任务执行模块使用）
 *   3. 通过 webRequest 被动捕获 Bearer Token（全局补充拦截）
 *   4. 管理 hook 状态
 *
 * 架构层级：Layer 3（Service Worker）
 */

import { STORAGE_KEY_CREDENTIALS, MsgType } from '../capture/consts';
import type { PlatformType } from '../capture/consts';
import { LocalBridgeSocket } from '../bridge/local-bridge-socket';
import type { AITabInfo, QueryAITabsStatusResponsePayload } from '../bridge/ws-protocol';

// ── 凭证数据结构 ──

interface PlatformCredentials {
    bearerToken: string | null;
    apiEndpoint: string | null;
    lastCapturedHeaders: Record<string, string>;
    lastCapturedAt: number;       // 时间戳
    captureCount: number;         // 累计捕获次数
}

interface AllCredentials {
    chatgpt: PlatformCredentials;
    gemini: PlatformCredentials;
    grok: PlatformCredentials;
}

// ── hook 状态 ──

interface HookStatusMap {
    [tabId: number]: {
        fetch: boolean;
        xhr: boolean;
        lastReport: number;
    };
}

let hookStatusMap: HookStatusMap = {};

// ── 默认空凭证 ──

function emptyCredentials(): PlatformCredentials {
    return {
        bearerToken: null,
        apiEndpoint: null,
        lastCapturedHeaders: {},
        lastCapturedAt: 0,
        captureCount: 0,
    };
}

function defaultAllCredentials(): AllCredentials {
    return {
        chatgpt: emptyCredentials(),
        gemini: emptyCredentials(),
        grok: emptyCredentials(),
    };
}

// ── 凭证存储操作 ──

async function loadCredentials(): Promise<AllCredentials> {
    const res = await chrome.storage.local.get(STORAGE_KEY_CREDENTIALS);
    const creds = res[STORAGE_KEY_CREDENTIALS];

    if (creds && typeof creds === 'object' && 'chatgpt' in creds && 'gemini' in creds && 'grok' in creds) {
        return creds as AllCredentials;
    }

    return defaultAllCredentials();
}

async function saveCredentials(creds: AllCredentials): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY_CREDENTIALS]: creds });
}

async function updatePlatformCredentials(
    platform: PlatformType,
    bearerToken: string | null,
    apiUrl: string | null,
    headers: Record<string, string>
): Promise<void> {
    const creds = await loadCredentials();
    const pc = creds[platform];

    // 无论是否有 token，都更新活跃时间（只要有流量就代表已登录）
    pc.lastCapturedAt = Date.now();
    pc.captureCount += 1;

    // 只有新值非空时才更新 token/url（防止覆盖已有值）
    if (bearerToken) {
        pc.bearerToken = bearerToken;
    }
    if (apiUrl) {
        pc.apiEndpoint = apiUrl;
    }
    if (Object.keys(headers).length > 0) {
        pc.lastCapturedHeaders = headers;
    }

    creds[platform] = pc;
    await saveCredentials(creds);

    // 打印日志
    const tokenPreview = pc.bearerToken
        ? `${pc.bearerToken.substring(0, 25)}...`
        : 'null';
    console.log(
        `%c[aiClaw-BG] 🔐 Credentials updated for %c${platform}%c | Token: ${tokenPreview} | Count: ${pc.captureCount}`,
        'color: #718096',
        'color: #4ade80; font-weight: bold',
        'color: #718096'
    );
}

export async function clearPlatformCredentials(platform: PlatformType): Promise<void> {
    const creds = await loadCredentials();
    creds[platform].bearerToken = null;
    creds[platform].apiEndpoint = null;
    await saveCredentials(creds);
    console.log(`[aiClaw-BG] 🗑️ Cleared credentials for ${platform}`);
}

// ── 扩展安装/更新事件 ──

chrome.runtime.onInstalled.addListener(async () => {
    console.log(
        '%c[aiClaw-BG] 🚀 Extension installed/updated.',
        'color: #60a5fa; font-weight: bold; font-size: 13px;'
    );

    // 初始化凭证存储（如果不存在）
    const existing = await chrome.storage.local.get(STORAGE_KEY_CREDENTIALS);
    if (!existing[STORAGE_KEY_CREDENTIALS]) {
        await saveCredentials(defaultAllCredentials());
        console.log('[aiClaw-BG] 📦 Credential store initialized.');
    }
});

// ── 消息中枢 ──

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // 0. WebSocket port update
    if (message.type === 'WS_PORT_CHANGED') {
        localBridge.reconnectWithNewPort(message.port);
        if (sendResponse) sendResponse({ ok: true });
        return;
    }

    // 1. 凭证捕获消息（来自 content script 中继）
    if (message.type === MsgType.CAPTURED_CREDENTIALS) {
        const { platform, bearerToken, apiUrl, requestHeaders } = message;

        if (platform && (platform === 'chatgpt' || platform === 'gemini' || platform === 'grok')) {
            updatePlatformCredentials(
                platform as PlatformType,
                bearerToken || null,
                apiUrl || null,
                requestHeaders || {}
            );
        }
        return;  // 无需 sendResponse
    }

    // 2. Hook 状态上报
    if (message.type === 'AC_HOOK_STATUS') {
        const tabId = sender.tab?.id;
        if (tabId) {
            hookStatusMap[tabId] = {
                fetch: message.status?.fetch || false,
                xhr: message.status?.xhr || false,
                lastReport: Date.now(),
            };
        }
        return;
    }

    // 3. 查询某平台的凭证（供未来任务执行模块使用）
    if (message.type === 'AC_GET_CREDENTIALS') {
        const platform = message.platform as PlatformType;
        loadCredentials().then(creds => {
            if (platform && creds[platform]) {
                sendResponse({ ok: true, credentials: creds[platform] });
            } else {
                sendResponse({ ok: false, error: `Unknown platform: ${platform}` });
            }
        });
        return true;  // 异步 sendResponse
    }

    // 4. 查询所有平台的凭证状态摘要（调试用）
    if (message.type === 'AC_GET_ALL_STATUS') {
        loadCredentials().then(creds => {
            const summary: Record<string, any> = {};
            for (const [p, c] of Object.entries(creds)) {
                summary[p] = {
                    hasToken: !!c.bearerToken,
                    tokenPreview: c.bearerToken ? c.bearerToken.substring(0, 20) + '...' : null,
                    apiEndpoint: c.apiEndpoint,
                    lastCapturedAt: c.lastCapturedAt ? new Date(c.lastCapturedAt).toISOString() : null,
                    captureCount: c.captureCount,
                };
            }
            sendResponse({ ok: true, summary, hookStatus: hookStatusMap });
        });
        return true;  // 异步 sendResponse
    }


    return false;
});

// ── 全局 webRequest 拦截：被动捕获 Bearer Token ──
// 这是对 injection.ts fetch hook 的补充：即使 injection 没有捕获到，
// webRequest 也能从请求头中拿到 Bearer Token。

const AI_PLATFORM_URL_PATTERNS = [
    'https://chatgpt.com/backend-api/*',
    'https://chat.openai.com/backend-api/*',
    'https://gemini.google.com/*',
    'https://grok.com/rest/*',
];

chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        const headers = details.requestHeaders || [];
        const authHeader = headers.find(h => h.name.toLowerCase() === 'authorization');
        const csrfHeader = headers.find(h => h.name.toLowerCase() === 'x-csrf-token' || h.name.toLowerCase() === 'x-goog-authuser');
        const authValue = authHeader?.value || csrfHeader?.value;

        const url = details.url;
        let platform: PlatformType | null = null;

        if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) {
            platform = 'chatgpt';
        } else if (url.includes('gemini.google.com')) {
            platform = 'gemini';
        } else if (url.includes('grok.com') || url.includes('x.com')) {
            platform = 'grok';
        }

        if (platform) {
            // 即使 authValue 为空，也调用更新，以记录活跃心跳
            updatePlatformCredentials(platform, authValue || null, url, {});
            if (authValue) {
                console.log(`%c[aiClaw-BG] 🌐 WebRequest captured Auth for ${platform}`, 'color: #60a5fa');
            }
        }

        return { requestHeaders: headers } as chrome.webRequest.BlockingResponse;
    },
    { urls: AI_PLATFORM_URL_PATTERNS },
    ['requestHeaders']
);

// ── tab 关闭时清理 hook 状态 ──

chrome.tabs.onRemoved.addListener((tabId) => {
    delete hookStatusMap[tabId];
});

// ── LocalBridge WebSocket 客户端 ──

async function queryAITabsStatus(): Promise<QueryAITabsStatusResponsePayload> {
    // 1. 查询凭证获取登录状态
    const creds = await loadCredentials();
  
    // 2. 查询所有 AI 平台的 tabs
    const chatgptTabs = await chrome.tabs.query({
        url: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
    });
    const geminiTabs = await chrome.tabs.query({
        url: ['https://gemini.google.com/*'],
    });
    const grokTabs = await chrome.tabs.query({
        url: ['https://grok.com/*', 'https://x.com/i/grok*'],
    });

    const allTabs: AITabInfo[] = [];

    for (const tab of chatgptTabs) {
        if (tab.id && tab.url) {
            allTabs.push({ tabId: tab.id, url: tab.url, platform: 'chatgpt', active: tab.active || false });
        }
    }
    for (const tab of geminiTabs) {
        if (tab.id && tab.url) {
            allTabs.push({ tabId: tab.id, url: tab.url, platform: 'gemini', active: tab.active || false });
        }
    }
    for (const tab of grokTabs) {
        if (tab.id && tab.url) {
            allTabs.push({ tabId: tab.id, url: tab.url, platform: 'grok', active: tab.active || false });
        }
    }

    const activeTab = allTabs.find(t => t.active) || null;

    return {
        hasAITabs: allTabs.length > 0,
        platforms: {
            chatgpt: { 
                hasTab: chatgptTabs.length > 0, 
                isLoggedIn: !!creds.chatgpt.bearerToken || (creds.chatgpt.captureCount > 0 && (Date.now() - creds.chatgpt.lastCapturedAt < 3600000))
            },
            gemini: { 
                hasTab: geminiTabs.length > 0, 
                isLoggedIn: !!creds.gemini.bearerToken || (creds.gemini.captureCount > 0 && (Date.now() - creds.gemini.lastCapturedAt < 3600000))
            },
            grok: { 
                hasTab: grokTabs.length > 0, 
                isLoggedIn: !!creds.grok.bearerToken || (creds.grok.captureCount > 0 && (Date.now() - creds.grok.lastCapturedAt < 3600000))
            },
        },
        activeAITabId: activeTab?.tabId || null,
        activeAIUrl: activeTab?.url || null,
        tabs: allTabs,
    };
}

const localBridge = new LocalBridgeSocket();
localBridge.queryAITabsHandler = queryAITabsStatus;


// ── 启动日志 ──

console.log(
    '%c[aiClaw-BG] 🚀 Background service worker started.',
    'color: #60a5fa; font-weight: bold; font-size: 13px;'
);
