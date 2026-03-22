/**
 * background.ts - aiClaw Background Service Worker
 *
 * 职责：
 *   1. 接收并存储从 content script 转发来的凭证数据
 *   2. 提供凭证查询接口
 *   3. 管理 hook 状态
 *   4. 任务调度：将 localBridge 下发的任务转发给对应平台的 content script
 *
 * 架构层级：Layer 3（Service Worker）
 *
 * 注意：Manifest V3 已完全移除 blocking webRequest。
 * 凭证捕获依赖 injection.ts 的 fetch hook（MAIN world），通过 content script 中继。
 * 原有的 webRequest 补充监听器已移除，injection.ts 的覆盖已足够。
 */

import { STORAGE_KEY_CREDENTIALS, MsgType } from '../capture/consts';
import type { PlatformType } from '../capture/consts';
import {
    loadCredentials,
    saveCredentials,
    updatePlatformCredentials,
    defaultAllCredentials,
} from '../storage/credentials-store';
import { LocalBridgeSocket } from '../bridge/local-bridge-socket';
import type { AITabInfo, QueryAITabsStatusResponsePayload, NavigateToPlatformPayload, NavigateResultPayload } from '../bridge/ws-protocol';

// ── hook 状态 ──

interface HookStatusMap {
    [tabId: number]: {
        fetch: boolean;
        xhr: boolean;
        lastReport: number;
    };
}

let hookStatusMap: HookStatusMap = {};

// ── 扩展安装/更新事件 ──

chrome.runtime.onInstalled.addListener(async () => {
    console.log(
        '%c[aiClaw-BG] 🚀 Extension installed/updated.',
        'color: #60a5fa; font-weight: bold; font-size: 13px;'
    );

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
        localBridge.reconnectWithNewPort(message.host || '127.0.0.1', message.port);
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
        return;
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

    // 3. 查询某平台的凭证
    if (message.type === 'AC_GET_CREDENTIALS') {
        const platform = message.platform as PlatformType;
        loadCredentials().then(creds => {
            if (platform && creds[platform]) {
                sendResponse({ ok: true, credentials: creds[platform] });
            } else {
                sendResponse({ ok: false, error: `Unknown platform: ${platform}` });
            }
        });
        return true;
    }

    // 4. 查询所有平台凭证状态摘要（调试用）
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
        return true;
    }

    return false;
});

// ── tab 关闭时清理 hook 状态 ──

chrome.tabs.onRemoved.addListener((tabId) => {
    delete hookStatusMap[tabId];
});

// ── 任务执行调度器 ──

async function executeTask(task: any): Promise<any> {
    const platform = task.platform as PlatformType;
    const startTime = Date.now();

    const creds = await loadCredentials();
    const platformCreds = creds[platform];

    if (!platformCreds) {
        return {
            taskId: task.taskId,
            success: false,
            platform,
            error: `Unknown platform: ${platform}`,
            executedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime,
        };
    }

    let tabQueryPatterns: string[] = [];
    if (platform === 'chatgpt') {
        tabQueryPatterns = ['https://chatgpt.com/*', 'https://chat.openai.com/*'];
    } else if (platform === 'gemini') {
        tabQueryPatterns = ['https://gemini.google.com/*'];
    } else if (platform === 'grok') {
        tabQueryPatterns = ['https://grok.com/*', 'https://x.com/i/grok*'];
    }

    const tabs = await chrome.tabs.query({ url: tabQueryPatterns });

    if (tabs.length === 0 || !tabs[0].id) {
        return {
            taskId: task.taskId,
            success: false,
            platform,
            error: `No open tab found for platform: ${platform}. Please open ${platform} in a browser tab first.`,
            executedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime,
        };
    }

    const targetTab = tabs.find(t => t.active) || tabs[0];
    const tabId = targetTab.id!;

    console.log(`[aiClaw-BG] 📤 Dispatching task ${task.taskId} to tab ${tabId} (${platform})`);

    const credentials = {
        bearerToken: platformCreds.bearerToken,
        apiEndpoint: platformCreds.apiEndpoint,
        extraHeaders: platformCreds.lastCapturedHeaders || {},
    };

    return new Promise((resolve) => {
        chrome.tabs.sendMessage(
            tabId,
            { type: MsgType.EXECUTE_TASK, task, credentials },
            (response) => {
                if (chrome.runtime.lastError) {
                    resolve({
                        taskId: task.taskId,
                        success: false,
                        platform,
                        error: `Failed to send message to tab: ${chrome.runtime.lastError.message}`,
                        executedAt: new Date().toISOString(),
                        durationMs: Date.now() - startTime,
                    });
                    return;
                }
                if (response && response.result) {
                    resolve(response.result);
                } else {
                    resolve({
                        taskId: task.taskId,
                        success: false,
                        platform,
                        error: 'Content script returned no result',
                        executedAt: new Date().toISOString(),
                        durationMs: Date.now() - startTime,
                    });
                }
            }
        );
    });
}

// ── LocalBridge WebSocket 客户端 ──

async function queryAITabsStatus(): Promise<QueryAITabsStatusResponsePayload> {
    const creds = await loadCredentials();

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
                isLoggedIn: !!creds.chatgpt.bearerToken || (creds.chatgpt.captureCount > 0 && (Date.now() - creds.chatgpt.lastCapturedAt < 3600000)),
            },
            gemini: {
                hasTab: geminiTabs.length > 0,
                isLoggedIn: !!creds.gemini.bearerToken || (creds.gemini.captureCount > 0 && (Date.now() - creds.gemini.lastCapturedAt < 3600000)),
            },
            grok: {
                hasTab: grokTabs.length > 0,
                isLoggedIn: !!creds.grok.bearerToken || (creds.grok.captureCount > 0 && (Date.now() - creds.grok.lastCapturedAt < 3600000)),
            },
        },
        activeAITabId: activeTab?.tabId || null,
        activeAIUrl: activeTab?.url || null,
        tabs: allTabs,
    };
}

// ── 页面跳转处理器 ──

async function navigateToPlatform(payload: NavigateToPlatformPayload): Promise<NavigateResultPayload> {
    const platform = payload.platform;

    // 定义平台首页 URL
    const platformUrls: Record<string, string> = {
        chatgpt: 'https://chatgpt.com/',
        gemini: 'https://gemini.google.com/app',
        grok: 'https://grok.com/',
    };

    const targetUrl = platformUrls[platform];
    if (!targetUrl) {
        return {
            success: false,
            platform,
            tabsNavigated: 0,
            error: `Unknown platform: ${platform}`,
        };
    }

    // 查询所有匹配平台的 tabs
    let tabQueryPatterns: string[] = [];
    if (platform === 'chatgpt') {
        tabQueryPatterns = ['https://chatgpt.com/*', 'https://chat.openai.com/*'];
    } else if (platform === 'gemini') {
        tabQueryPatterns = ['https://gemini.google.com/*'];
    } else if (platform === 'grok') {
        tabQueryPatterns = ['https://grok.com/*', 'https://x.com/i/grok*'];
    }

    const tabs = await chrome.tabs.query({ url: tabQueryPatterns });

    if (tabs.length === 0) {
        return {
            success: false,
            platform,
            tabsNavigated: 0,
            error: `No open tabs found for platform: ${platform}`,
        };
    }

    // 让所有匹配的 tabs 跳转到首页
    let navigatedCount = 0;
    for (const tab of tabs) {
        if (tab.id) {
            try {
                await chrome.tabs.update(tab.id, { url: targetUrl });
                navigatedCount++;
            } catch (err) {
                console.error(`[aiClaw-BG] Failed to navigate tab ${tab.id}:`, err);
            }
        }
    }

    return {
        success: navigatedCount > 0,
        platform,
        tabsNavigated: navigatedCount,
        error: navigatedCount === 0 ? 'Failed to navigate any tabs' : undefined,
    };
}

const localBridge = new LocalBridgeSocket();
localBridge.queryAITabsHandler = queryAITabsStatus;
localBridge.executeTaskHandler = executeTask;
localBridge.navigateToPlatformHandler = navigateToPlatform;

// ── 启动日志 ──

console.log(
    '%c[aiClaw-BG] 🚀 Background service worker started.',
    'color: #60a5fa; font-weight: bold; font-size: 13px;'
);
