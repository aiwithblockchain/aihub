/**
 * background.ts - aiClaw Background Service Worker
 *
 * 此脚本在浏览器扩展后台运行。
 * 当前任务：打印一条日志，证明 service worker 已启动。
 */

console.log(
    '%c[aiClaw] 🚀 Background service worker started.',
    'color: #60a5fa; font-weight: bold; font-size: 13px;'
);

// 扩展安装或更新时触发
chrome.runtime.onInstalled.addListener(() => {
    console.log('[aiClaw] Extension installed or updated.');
});
