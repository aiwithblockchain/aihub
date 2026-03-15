/**
 * main_entrance.ts - aiClaw Content Script
 *
 * 此脚本会被自动注入到 ChatGPT、Gemini、Grok 的网页中。
 * 当前任务：打印一条日志，证明 content script 已成功注入。
 */

// 识别当前所在的 AI 平台
function detectPlatform(): string {
    const hostname = window.location.hostname;

    if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
        return 'ChatGPT';
    }
    if (hostname.includes('gemini.google.com')) {
        return 'Gemini';
    }
    if (hostname.includes('grok.com') || hostname.includes('x.com')) {
        return 'Grok';
    }

    return 'Unknown';
}

const platform = detectPlatform();
const timestamp = new Date().toISOString();

console.log(
    `%c[aiClaw] ✅ Content script successfully injected into ${platform} at ${timestamp}`,
    'color: #4ade80; font-weight: bold; font-size: 14px; background: #1a1a2e; padding: 4px 8px; border-radius: 4px;'
);

console.log(`[aiClaw] Platform: ${platform}`);
console.log(`[aiClaw] URL: ${window.location.href}`);
console.log(`[aiClaw] Document readyState: ${document.readyState}`);
