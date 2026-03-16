/**
 * main_entrance.ts - aiClaw Content Script
 *
 * 职责：
 *   1. 将 injection.js 注入页面的 MAIN world（使其能 hook fetch，用于凭证捕获）
 *   2. 中继 injection → background 的消息（凭证捕获数据）
 *   3. 响应 background 发来的 PING 和 EXECUTE_TASK 消息
 *
 * 架构层级：Layer 2（ISOLATED world）
 */

import { INJECTION_SOURCE, MsgType } from '../capture/consts';
import { ChatGptAdapter } from '../adapters/chatgpt-adapter';
import type { ExecuteTaskPayload, ExecuteTaskResultPayload } from '../bridge/ws-protocol';

// ── 1. 注入 injection.js 到页面 MAIN world ──

(function injectScript() {
    if (document.getElementById('ac_injection')) return;

    const script = document.createElement('script');
    script.id = 'ac_injection';
    script.src = chrome.runtime.getURL('js/injection.js');
    (document.head || document.documentElement).appendChild(script);

    script.onload = () => {
        script.remove();
        console.log('[aiClaw-CS] ✅ injection.js loaded into MAIN world');
    };

    script.onerror = (err) => {
        console.error('[aiClaw-CS] ❌ Failed to inject injection.js:', err);
    };
})();

// ── 2. 平台检测 ──

function detectPlatform(): string {
    const hostname = window.location.hostname;
    if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) return 'ChatGPT';
    if (hostname.includes('gemini.google.com')) return 'Gemini';
    if (hostname.includes('grok.com') || hostname.includes('x.com')) return 'Grok';
    return 'Unknown';
}

// ── Adapter 工厂 ──
function getAdapter(platform: string) {
    if (platform === 'chatgpt' || platform === 'ChatGPT') return new ChatGptAdapter();
    return null;
}

// ── 3. 监听 injection.ts 通过 window.postMessage 发来的消息 ──

window.addEventListener('message', (event) => {
    if (event.data?.source !== INJECTION_SOURCE) return;

    try {
        if (event.data.type === 'CREDENTIALS_CAPTURED' || event.data.type === 'AC_CAPTURED_CREDENTIALS') {
            chrome.runtime.sendMessage({
                type: MsgType.CAPTURED_CREDENTIALS,
                platform: event.data.platform,
                apiUrl: event.data.apiUrl,
                method: event.data.method,
                bearerToken: event.data.bearerToken || null,
                requestHeaders: event.data.requestHeaders || {},
                requestBody: event.data.requestBody || null,
                timestamp: event.data.timestamp || Date.now(),
            });
        }

        if (event.data.type === 'HOOK_STATUS_REPORT') {
            chrome.runtime.sendMessage({
                type: 'AC_HOOK_STATUS',
                status: event.data.status,
            });
        }
    } catch (e) {
        // Context invalidated after extension reload, ignore
    }
});

// ── 4. 响应 background 发来的消息 ──

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // PING
    if (message.type === MsgType.PING) {
        sendResponse({
            ok: true,
            url: window.location.href,
            platform: detectPlatform(),
            context: 'CONTENT_SCRIPT',
        });
        return true;
    }

    // EXECUTE_TASK：DOM 操作方案，不再需要 credentials
    if (message.type === MsgType.EXECUTE_TASK) {
        const task = message.task as ExecuteTaskPayload;
        const startTime = Date.now();

        const adapter = getAdapter(task.platform);
        if (!adapter) {
            const result: ExecuteTaskResultPayload = {
                taskId: task.taskId,
                success: false,
                platform: task.platform,
                error: `No adapter for platform: ${task.platform}`,
                executedAt: new Date().toISOString(),
                durationMs: Date.now() - startTime,
            };
            sendResponse({ ok: false, result });
            return true;
        }

        const actionPromise = task.action === 'new_conversation'
            ? adapter.createNewConversation({
                model: task.payload.model,
            })
            : adapter.sendMessage(
                {
                    prompt: task.payload.prompt ?? '',
                    conversationId: task.payload.conversationId,
                    model: task.payload.model,
                },
                {}  // DOM 方案不使用凭证
            );

        actionPromise.then((adapterResult) => {
            const result: ExecuteTaskResultPayload = {
                taskId: task.taskId,
                success: adapterResult.success,
                platform: task.platform,
                content: adapterResult.content,
                conversationId: adapterResult.conversationId,
                error: adapterResult.error,
                executedAt: new Date().toISOString(),
                durationMs: Date.now() - startTime,
            };
            sendResponse({ ok: adapterResult.success, result });
        }).catch((err) => {
            const result: ExecuteTaskResultPayload = {
                taskId: task.taskId,
                success: false,
                platform: task.platform,
                error: err instanceof Error ? err.message : String(err),
                executedAt: new Date().toISOString(),
                durationMs: Date.now() - startTime,
            };
            sendResponse({ ok: false, result });
        });

        return true; // 异步 sendResponse 必须返回 true
    }

    return false;
});

// ── 5. 启动日志 ──

const platform = detectPlatform();
console.log(
    `%c[aiClaw-CS] ✅ Content script active on ${platform}`,
    'color: #4ade80; font-weight: bold; font-size: 13px; background: #1a1a2e; padding: 4px 8px; border-radius: 4px;'
);
console.log(`[aiClaw-CS] URL: ${window.location.href}`);
