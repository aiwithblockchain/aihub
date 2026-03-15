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

// ── 3. 监听 injection.ts 通过 window.postMessage 发来的消息 ──

window.addEventListener('message', (event) => {
    // 安全检查：只处理来自 aiClaw injection 的消息
    if (event.data?.source !== INJECTION_SOURCE) return;

    // 3a. 凭证捕获消息 → 转发给 background
    if (event.data.type === 'CREDENTIALS_CAPTURED') {
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

    // 3b. Hook 状态上报 → 转发给 background
    if (event.data.type === 'HOOK_STATUS_REPORT') {
        chrome.runtime.sendMessage({
            type: 'AC_HOOK_STATUS',
            status: event.data.status,
        });
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

    return false;
});

// ── 5. 启动日志 ──

const platform = detectPlatform();
console.log(
    `%c[aiClaw-CS] ✅ Content script active on ${platform}`,
    'color: #4ade80; font-weight: bold; font-size: 13px; background: #1a1a2e; padding: 4px 8px; border-radius: 4px;'
);
console.log(`[aiClaw-CS] URL: ${window.location.href}`);
