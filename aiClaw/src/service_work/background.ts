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
import { ChatGptAdapter } from '../adapters/chatgpt-adapter';

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

    // 只有新值非空时才更新（防止覆盖已有值）
    if (bearerToken) {
        pc.bearerToken = bearerToken;
    }
    if (apiUrl) {
        pc.apiEndpoint = apiUrl;
    }
    if (Object.keys(headers).length > 0) {
        pc.lastCapturedHeaders = headers;
    }

    pc.lastCapturedAt = Date.now();
    pc.captureCount += 1;

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

    if (message.type === MsgType.AC_SEND_TEST_MESSAGE) {
        console.log('[aiClaw-BG] Received test message request');
        loadCredentials().then(async (creds) => {
            const chatGptCreds = creds.chatgpt;
            if (chatGptCreds && chatGptCreds.bearerToken && chatGptCreds.apiEndpoint) {
                const adapter = new ChatGptAdapter();
                const response = await adapter.sendMessage(
                    { prompt: 'Hello, this is a test message.' },
                    chatGptCreds
                );
                console.log('[aiClaw-BG] Test message response:', response);
                sendResponse({ ok: true, response });
            } else {
                sendResponse({ ok: false, error: 'ChatGPT credentials not found' });
            }
        });
        return true;
    }

    if (message.type === MsgType.TASK_RESULT) {
        wsClient.sendResult(message.result);
        wsClient.isExecutingTask = false;
        wsClient.executeNextTask();
        return; // No response needed
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
        const authHeader = headers.find(
            h => h.name.toLowerCase() === 'authorization'
        );

        if (authHeader?.value?.startsWith('Bearer ')) {
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
                updatePlatformCredentials(platform, authHeader.value, url, {});
                console.log(
                    `%c[aiClaw-BG] 🌐 WebRequest captured Bearer for ${platform}`,
                    'color: #60a5fa'
                );
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

// ── WebSocket 客户端 ──

const LOCALBRIDGE_URL = 'ws://localhost:8765/ws/aiclaw';

class WebSocketClient {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private taskQueue: any[] = [];
    public isExecutingTask = false;
    private lastUsedTabIndex: Map<PlatformType, number> = new Map();

    connect() {
        this.ws = new WebSocket(LOCALBRIDGE_URL);

        this.ws.onopen = () => {
            console.log('[aiClaw-BG] 🔌 WebSocket connected to localBridge');
            this.reconnectAttempts = 0;
            this.executeNextTask(); // Start executing tasks if any were queued while disconnected
        };

        this.ws.onmessage = (event) => {
            try {
                const task = JSON.parse(event.data);
                console.log('[aiClaw-BG] 📩 Received task from localBridge:', task);
                this.enqueueTask(task);
            } catch (e) {
                console.error('[aiClaw-BG] ❌ Error parsing task from localBridge:', e);
            }
        };

        this.ws.onclose = () => {
            console.log('[aiClaw-BG] 🔌 WebSocket disconnected from localBridge');
            this.reconnect();
        };

        this.ws.onerror = (err) => {
            console.error('[aiClaw-BG] ❌ WebSocket error:', err);
            // onclose will be called next, which will handle reconnect
        };
    }

    private reconnect() {
        if (this.reconnectAttempts >= 30) {
            console.error('[aiClaw-BG] ❌ Too many reconnect attempts, giving up.');
            return;
        }

        const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts));
        this.reconnectAttempts++;

        console.log(`[aiClaw-BG] 🔌 Reconnecting WebSocket in ${delay / 1000}s...`);
        setTimeout(() => this.connect(), delay);
    }

    private enqueueTask(task: any) {
        this.taskQueue.push(task);
        this.executeNextTask();
    }

    public executeNextTask() {
        if (this.isExecutingTask || this.taskQueue.length === 0) {
            return;
        }
        this.isExecutingTask = true;
        const task = this.taskQueue.shift();
        this.dispatchTask(task);
    }

    private getPlatformUrlPatterns(platform: PlatformType): string[] {
        switch (platform) {
            case 'chatgpt':
                return ['https://chat.openai.com/*', 'https://chatgpt.com/*'];
            case 'gemini':
                return ['https://gemini.google.com/*'];
            case 'grok':
                return ['https://grok.com/*', 'https://x.com/i/grok*'];
        }
    }

    private async dispatchTask(task: any) {
        if (!task.platform || !task.payload?.prompt) {
            console.error('[aiClaw-BG] ❌ Invalid task received:', task);
            this.isExecutingTask = false;
            this.executeNextTask();
            return;
        }

        const platform = task.platform as PlatformType;
        const urlPatterns = this.getPlatformUrlPatterns(platform);

        let tabs: chrome.tabs.Tab[] = [];
        for (const pattern of urlPatterns) {
            const matchingTabs = await chrome.tabs.query({ url: pattern });
            tabs = tabs.concat(matchingTabs);
        }


        if (tabs.length === 0) {
            console.error(`[aiClaw-BG] ❌ No active tab found for platform: ${platform}`);
            this.sendResult({ taskId: task.taskId, success: false, error: `No active tab found for platform: ${platform}` });
            this.isExecutingTask = false;
            this.executeNextTask();
            return;
        }

        const lastIndex = this.lastUsedTabIndex.get(platform) || -1;
        const nextIndex = (lastIndex + 1) % tabs.length;
        const tab = tabs[nextIndex];
        this.lastUsedTabIndex.set(platform, nextIndex);

        const tabId = tab.id;
        if (tabId) {
            try {
                await chrome.tabs.sendMessage(tabId, {
                    type: MsgType.EXECUTE_TASK,
                    task: task,
                });
            } catch (e: any) {
                console.error(`[aiClaw-BG] ❌ Error sending task to tab ${tabId}:`, e);
                this.sendResult({ taskId: task.taskId, success: false, error: `Failed to send task to content script: ${e.message}` });
                this.isExecutingTask = false;
                this.executeNextTask();
            }
        }
    }

    sendResult(result: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(result));
        }
    }
}

const wsClient = new WebSocketClient();
wsClient.connect();


// ── Service Worker Keep-alive ──
chrome.alarms.create('keep-alive', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keep-alive') {
        // console.log('[aiClaw-BG] Keep-alive alarm triggered');
    }
});


// ── 启动日志 ──

console.log(
    '%c[aiClaw-BG] 🚀 Background service worker started.',
    'color: #60a5fa; font-weight: bold; font-size: 13px;'
);
