/******/ (() => { // webpackBootstrap
/*!**************************************!*\
  !*** ./src/content/main_entrance.ts ***!
  \**************************************/
/**
 * main_entrance.ts - aiClaw Content Script
 *
 * 此脚本会被自动注入到 ChatGPT、Gemini、Grok 的网页中。
 * 当前任务：打印一条日志，证明 content script 已成功注入。
 */
// 识别当前所在的 AI 平台
function detectPlatform() {
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
console.log(`%c[aiClaw] ✅ Content script successfully injected into ${platform} at ${timestamp}`, 'color: #4ade80; font-weight: bold; font-size: 14px; background: #1a1a2e; padding: 4px 8px; border-radius: 4px;');
console.log(`[aiClaw] Platform: ${platform}`);
console.log(`[aiClaw] URL: ${window.location.href}`);
console.log(`[aiClaw] Document readyState: ${document.readyState}`);

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianMvY29udGVudC5qcyIsIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzRUFBc0UsVUFBVSxLQUFLLFVBQVUsb0JBQW9CLG1CQUFtQixpQkFBaUIscUJBQXFCLGtCQUFrQixtQkFBbUI7QUFDak4sa0NBQWtDLFNBQVM7QUFDM0MsNkJBQTZCLHFCQUFxQjtBQUNsRCw2Q0FBNkMsb0JBQW9CIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vYWlDbGF3Ly4vc3JjL2NvbnRlbnQvbWFpbl9lbnRyYW5jZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIG1haW5fZW50cmFuY2UudHMgLSBhaUNsYXcgQ29udGVudCBTY3JpcHRcbiAqXG4gKiDmraTohJrmnKzkvJrooqvoh6rliqjms6jlhaXliLAgQ2hhdEdQVOOAgUdlbWluaeOAgUdyb2sg55qE572R6aG15Lit44CCXG4gKiDlvZPliY3ku7vliqHvvJrmiZPljbDkuIDmnaHml6Xlv5fvvIzor4HmmI4gY29udGVudCBzY3JpcHQg5bey5oiQ5Yqf5rOo5YWl44CCXG4gKi9cbi8vIOivhuWIq+W9k+WJjeaJgOWcqOeahCBBSSDlubPlj7BcbmZ1bmN0aW9uIGRldGVjdFBsYXRmb3JtKCkge1xuICAgIGNvbnN0IGhvc3RuYW1lID0gd2luZG93LmxvY2F0aW9uLmhvc3RuYW1lO1xuICAgIGlmIChob3N0bmFtZS5pbmNsdWRlcygnY2hhdGdwdC5jb20nKSB8fCBob3N0bmFtZS5pbmNsdWRlcygnY2hhdC5vcGVuYWkuY29tJykpIHtcbiAgICAgICAgcmV0dXJuICdDaGF0R1BUJztcbiAgICB9XG4gICAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKCdnZW1pbmkuZ29vZ2xlLmNvbScpKSB7XG4gICAgICAgIHJldHVybiAnR2VtaW5pJztcbiAgICB9XG4gICAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKCdncm9rLmNvbScpIHx8IGhvc3RuYW1lLmluY2x1ZGVzKCd4LmNvbScpKSB7XG4gICAgICAgIHJldHVybiAnR3Jvayc7XG4gICAgfVxuICAgIHJldHVybiAnVW5rbm93bic7XG59XG5jb25zdCBwbGF0Zm9ybSA9IGRldGVjdFBsYXRmb3JtKCk7XG5jb25zdCB0aW1lc3RhbXAgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG5jb25zb2xlLmxvZyhgJWNbYWlDbGF3XSDinIUgQ29udGVudCBzY3JpcHQgc3VjY2Vzc2Z1bGx5IGluamVjdGVkIGludG8gJHtwbGF0Zm9ybX0gYXQgJHt0aW1lc3RhbXB9YCwgJ2NvbG9yOiAjNGFkZTgwOyBmb250LXdlaWdodDogYm9sZDsgZm9udC1zaXplOiAxNHB4OyBiYWNrZ3JvdW5kOiAjMWExYTJlOyBwYWRkaW5nOiA0cHggOHB4OyBib3JkZXItcmFkaXVzOiA0cHg7Jyk7XG5jb25zb2xlLmxvZyhgW2FpQ2xhd10gUGxhdGZvcm06ICR7cGxhdGZvcm19YCk7XG5jb25zb2xlLmxvZyhgW2FpQ2xhd10gVVJMOiAke3dpbmRvdy5sb2NhdGlvbi5ocmVmfWApO1xuY29uc29sZS5sb2coYFthaUNsYXddIERvY3VtZW50IHJlYWR5U3RhdGU6ICR7ZG9jdW1lbnQucmVhZHlTdGF0ZX1gKTtcbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==