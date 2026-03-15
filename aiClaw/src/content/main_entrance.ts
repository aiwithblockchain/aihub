/**
 * main_entrance.ts - aiClaw Content Script (Phase 1)
 *
 * 职责：
 *   1. 将 injection.js 注入页面的 MAIN world（使其能 hook fetch）
 *   2. 中继 injection → background 的消息（凭证捕获数据）
 *   3. 响应 background 发来的 PING 消息
 *
 * 架构层级：Layer 2（ISOLATED world）
 * 通信方式：
 *   - injection ↔ content：window.postMessage
 *   - content ↔ background：chrome.runtime.sendMessage
 */

import { INJECTION_SOURCE, MsgType } from '../capture/consts';
import { ChatGptAdapter } from '../adapters/chatgpt-adapter';
import type { Credentials } from '../adapters/base-adapter';
import type { ExecuteTaskPayload, ExecuteTaskResultPayload } from '../bridge/ws-protocol';

// ── 1. 注入 injection.js 到页面 MAIN world ──

(function injectScript() {
    // 防止重复注入
    if (document.getElementById('ac_injection')) return;

    const script = document.createElement('script');
    script.id = 'ac_injection';
    script.src = chrome.runtime.getURL('js/injection.js');
    (document.head || document.documentElement).appendChild(script);

    script.onload = () => {
        script.remove();  // 注入后清理 DOM 中的 <script> 标签
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

// ── Adapter 工厂：根据平台名称返回对应的 adapter 实例 ──
function getAdapter(platform: string) {
    if (platform === 'chatgpt' || platform === 'ChatGPT') return new ChatGptAdapter();
    // gemini / grok adapter 待后续 Phase 4 实现
    return null;
}

// ── 3. 监听 injection.ts 通过 window.postMessage 发来的消息 ──
window.addEventListener('message', (event) => {
    // 安全检查：只处理来自 aiClaw injection 的消息
    if (event.data?.source !== INJECTION_SOURCE) return;

    try {
        // 3a. 凭证捕获消息 (支持新旧两种 type 标识)
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

        // 3b. Hook 状态上报
        if (event.data.type === 'HOOK_STATUS_REPORT') {
            chrome.runtime.sendMessage({
                type: 'AC_HOOK_STATUS',
                status: event.data.status,
            });
        }
    } catch (e) {
        // 如果插件重载导致 Context Invalidated，忽略报错，等待页面下次刷新
        // console.warn('[aiClaw-CS] Failed to forward message to background:', e);
    }
});

// ── 4. 响应 background 发来的消息 ──

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // PING：background 检查 content script 是否存活
    if (message.type === MsgType.PING) {
        sendResponse({
            ok: true,
            url: window.location.href,
            platform: detectPlatform(),
            context: 'CONTENT_SCRIPT',
        });
        return true;
    }

    // EXECUTE_TASK：background 下发任务，在此 content script 中执行 API 调用
    if (message.type === MsgType.EXECUTE_TASK) {
        const task = message.task as ExecuteTaskPayload;
        const credentials = message.credentials as Credentials;
        const startTime = Date.now();

        const adapter = getAdapter(task.platform);
        if (!adapter) {
            const result: ExecuteTaskResultPayload = {
                taskId: task.taskId,
                success: false,
                platform: task.platform,
                error: `No adapter available for platform: ${task.platform}`,
                executedAt: new Date().toISOString(),
                durationMs: Date.now() - startTime,
            };
            sendResponse({ ok: false, result });
            return true;
        }

        adapter.sendMessage(
            {
                prompt: task.payload.prompt,
                conversationId: task.payload.conversationId,
                model: task.payload.model,
            },
            credentials
        ).then((adapterResult) => {
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

        return true; // 必须返回 true，表示 sendResponse 会异步调用
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
