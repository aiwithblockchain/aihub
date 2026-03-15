/******/ (() => { // webpackBootstrap
/*!**********************************!*\
  !*** ./src/capture/injection.ts ***!
  \**********************************/
/**
 * injection.ts - aiClaw MAIN World Fetch Hook
 *
 * 此脚本注入到 AI 平台页面的 MAIN JS 上下文中。
 * 职责：
 *   1. Hook window.fetch，拦截 AI 平台的 API 请求
 *   2. 从请求头中提取 Bearer Token
 *   3. 记录 API 端点 URL
 *   4. 通过 window.postMessage 将凭证信息发送给 content script
 *
 * 架构参考：tweetClaw/src/capture/injection.ts
 */
(function () {
    const TAG = '🔌 [aiClaw-Inject]';
    let lastCaptureTime = 0;
    console.log(`${TAG} Initializing in MAIN world...`);
    // ── 平台 API 匹配规则（与 consts.ts 保持一致，但 injection 运行在 MAIN world，无法 import） ──
    const PLATFORM_API_PATTERNS = {
        chatgpt: [
            /chatgpt\.com\/backend-api\//,
            /chat\.openai\.com\/backend-api\//,
        ],
        gemini: [
            /gemini\.google\.com\/_\/BardChatUi\//,
            /gemini\.google\.com\/app\/_\/BardChatUi\//,
            /alkalimakersuite-pa\.clients6\.google\.com\//,
        ],
        grok: [
            /grok\.com\/rest\/app-chat\//,
            /x\.com\/i\/api\/2\/grok\//,
        ],
    };
    /**
     * 检测 URL 是否属于我们监控的 AI 平台 API
     */
    function detectPlatform(url) {
        for (const [platform, patterns] of Object.entries(PLATFORM_API_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(url)) {
                    return platform;
                }
            }
        }
        return null;
    }
    /**
     * 从 fetch 的 init 参数中提取 Authorization Bearer Token
     */
    function extractBearer(initArg) {
        try {
            const hdrs = initArg?.headers;
            if (!hdrs)
                return null;
            let auth = null;
            if (hdrs instanceof Headers) {
                auth = hdrs.get('authorization') || hdrs.get('Authorization');
            }
            else if (Array.isArray(hdrs)) {
                const pair = hdrs.find((h) => (typeof h[0] === 'string') && h[0].toLowerCase() === 'authorization');
                if (pair)
                    auth = pair[1];
            }
            else if (typeof hdrs === 'object') {
                auth = hdrs['authorization'] || hdrs['Authorization'] || null;
            }
            return (auth && auth.startsWith('Bearer ')) ? auth : null;
        }
        catch {
            return null;
        }
    }
    /**
     * 从 fetch 的 init 参数中提取所有请求头（用于记录完整的请求格式）
     */
    function extractHeaders(initArg) {
        const result = {};
        try {
            const hdrs = initArg?.headers;
            if (!hdrs)
                return result;
            if (hdrs instanceof Headers) {
                hdrs.forEach((value, key) => {
                    result[key] = value;
                });
            }
            else if (Array.isArray(hdrs)) {
                for (const [key, value] of hdrs) {
                    result[key] = value;
                }
            }
            else if (typeof hdrs === 'object') {
                Object.assign(result, hdrs);
            }
        }
        catch { }
        return result;
    }
    /**
     * 将捕获的信息通过 postMessage 发送给 content script
     */
    function postCapture(platform, apiUrl, method, bearerToken, requestHeaders, requestBody) {
        lastCaptureTime = Date.now();
        console.log(`%c${TAG} 📡 Captured %c${platform}%c API call: ${method} ${apiUrl.substring(0, 80)}...`, 'color: #718096', 'color: #4ade80; font-weight: bold', 'color: #718096');
        if (bearerToken) {
            console.log(`%c${TAG} 🔑 Bearer token captured for ${platform} (${bearerToken.substring(0, 20)}...)`, 'color: #fbbf24; font-weight: bold');
        }
        window.postMessage({
            source: 'aiclaw-injection',
            type: 'CREDENTIALS_CAPTURED',
            platform,
            apiUrl,
            method,
            bearerToken: bearerToken || null,
            requestHeaders,
            requestBody,
            timestamp: Date.now(),
        }, '*');
    }
    // ── Hook window.fetch ──
    function patchFetch() {
        if (window.__ac_fetch_patched)
            return;
        const originalFetch = window.fetch;
        if (!originalFetch) {
            console.warn(`${TAG} ❌ Native fetch not found!`);
            return;
        }
        window.fetch = async function (...args) {
            const reqArg = args[0];
            const initArg = args[1];
            // 提取 URL
            const url = typeof reqArg === 'string'
                ? reqArg
                : (reqArg instanceof Request ? reqArg.url : String(reqArg));
            // 检测是否是我们关心的平台 API
            const platform = detectPlatform(url);
            if (!platform) {
                // 不是目标 API，直接放行
                return originalFetch.apply(this, args);
            }
            // 提取凭证信息
            const method = initArg?.method || 'GET';
            const bearer = extractBearer(initArg);
            const headers = extractHeaders(initArg);
            let body = initArg?.body || null;
            // 尝试解析 body
            try {
                if (typeof body === 'string') {
                    body = JSON.parse(body);
                }
            }
            catch { }
            // 发送给 content script
            postCapture(platform, url, method, bearer, headers, body);
            // 放行原始请求，不干扰正常功能
            try {
                return await originalFetch.apply(this, args);
            }
            catch (e) {
                console.error(`${TAG} Fetch error [${platform}]:`, e);
                throw e;
            }
        };
        window.__ac_fetch_patched = true;
        window.__ac_original_fetch = originalFetch;
        console.log(`%c${TAG} ✅ Fetch hook installed`, 'color: #4ade80');
    }
    // ── Hook XMLHttpRequest（某些平台可能使用 XHR）──
    function patchXHR() {
        if (window.__ac_xhr_patched)
            return;
        const OriginalXHR = window.XMLHttpRequest;
        if (!OriginalXHR) {
            console.warn(`${TAG} ❌ Native XMLHttpRequest not found!`);
            return;
        }
        class ACXHRInterceptor extends OriginalXHR {
            constructor() {
                super(...arguments);
                this._ac_url = '';
                this._ac_platform = null;
                this._ac_method = 'GET';
            }
            open(method, url, ...rest) {
                this._ac_url = url;
                this._ac_method = method;
                this._ac_platform = detectPlatform(url);
                return super.open.apply(this, [method, url, ...rest]);
            }
            send(body) {
                const platform = this._ac_platform;
                const url = this._ac_url;
                const method = this._ac_method;
                if (platform && url) {
                    this.addEventListener('load', () => {
                        try {
                            let parsedBody = body;
                            try {
                                if (typeof body === 'string')
                                    parsedBody = JSON.parse(body);
                            }
                            catch { }
                            // XHR 中 bearer 不容易从 header 获取，传 null
                            postCapture(platform, url, method, null, {}, parsedBody);
                        }
                        catch { }
                    });
                }
                return super.send(body);
            }
        }
        window.XMLHttpRequest = ACXHRInterceptor;
        window.__ac_xhr_patched = true;
        console.log(`%c${TAG} ✅ XHR hook installed`, 'color: #4ade80');
    }
    // ── 健康日志（每 15 秒打印一次状态）──
    function printHealthLog() {
        const fetchOk = !!window.__ac_fetch_patched;
        const xhrOk = !!window.__ac_xhr_patched;
        const lastAgo = lastCaptureTime
            ? `${Math.round((Date.now() - lastCaptureTime) / 1000)}s ago`
            : 'Never';
        console.groupCollapsed(`%c${TAG} Pulse - ${new Date().toLocaleTimeString()}`, 'color: #60a5fa');
        console.log(`Fetch Hook: %c${fetchOk ? 'ACTIVE' : 'OFFLINE'}`, fetchOk ? 'color:#4ade80' : 'color:#f87171');
        console.log(`XHR Hook:   %c${xhrOk ? 'ACTIVE' : 'OFFLINE'}`, xhrOk ? 'color:#4ade80' : 'color:#f87171');
        console.log(`Last Capture: ${lastAgo}`);
        console.groupEnd();
    }
    // ── 上报 hook 状态给 content script ──
    function reportHookStatus() {
        const fetchOk = !!window.__ac_fetch_patched;
        const xhrOk = !!window.__ac_xhr_patched;
        window.postMessage({
            source: 'aiclaw-injection',
            type: 'HOOK_STATUS_REPORT',
            status: { fetch: fetchOk, xhr: xhrOk },
        }, '*');
        // 自我修复：如果 hook 被覆盖，重新安装
        if (!fetchOk || window.fetch === window.__ac_original_fetch)
            patchFetch();
        if (!xhrOk || window.XMLHttpRequest === window.__ac_original_xhr)
            patchXHR();
    }
    // ── 启动 ──
    patchFetch();
    patchXHR();
    setInterval(printHealthLog, 15000);
    setInterval(reportHookStatus, 3000);
    printHealthLog();
})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianMvaW5qZWN0aW9uLmpzIiwibWFwcGluZ3MiOiI7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxtQkFBbUIsS0FBSztBQUN4QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjtBQUNqQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx5QkFBeUIsS0FBSyxnQkFBZ0IsU0FBUyxlQUFlLFFBQVEsRUFBRSx3QkFBd0IseUNBQXlDO0FBQ2pKO0FBQ0EsNkJBQTZCLEtBQUssK0JBQStCLFVBQVUsR0FBRyw2QkFBNkIsd0JBQXdCO0FBQ25JO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw0QkFBNEIsS0FBSztBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlDQUFpQyxLQUFLLGVBQWUsU0FBUztBQUM5RDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EseUJBQXlCLEtBQUs7QUFDOUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSw0QkFBNEIsS0FBSztBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsdUVBQXVFO0FBQ3ZFO0FBQ0E7QUFDQSxxQkFBcUI7QUFDckI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EseUJBQXlCLEtBQUs7QUFDOUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCLGtEQUFrRDtBQUNuRTtBQUNBLG9DQUFvQyxLQUFLLFVBQVUsZ0NBQWdDO0FBQ25GLHFDQUFxQywrQkFBK0I7QUFDcEUscUNBQXFDLDZCQUE2QjtBQUNsRSxxQ0FBcUMsUUFBUTtBQUM3QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQkFBc0IsNEJBQTRCO0FBQ2xELFNBQVM7QUFDVDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vYWlDbGF3Ly4vc3JjL2NhcHR1cmUvaW5qZWN0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogaW5qZWN0aW9uLnRzIC0gYWlDbGF3IE1BSU4gV29ybGQgRmV0Y2ggSG9va1xuICpcbiAqIOatpOiEmuacrOazqOWFpeWIsCBBSSDlubPlj7DpobXpnaLnmoQgTUFJTiBKUyDkuIrkuIvmlofkuK3jgIJcbiAqIOiBjOi0o++8mlxuICogICAxLiBIb29rIHdpbmRvdy5mZXRjaO+8jOaLpuaIqiBBSSDlubPlj7DnmoQgQVBJIOivt+axglxuICogICAyLiDku47or7fmsYLlpLTkuK3mj5Dlj5YgQmVhcmVyIFRva2VuXG4gKiAgIDMuIOiusOW9lSBBUEkg56uv54K5IFVSTFxuICogICA0LiDpgJrov4cgd2luZG93LnBvc3RNZXNzYWdlIOWwhuWHreivgeS/oeaBr+WPkemAgee7mSBjb250ZW50IHNjcmlwdFxuICpcbiAqIOaetuaehOWPguiAg++8mnR3ZWV0Q2xhdy9zcmMvY2FwdHVyZS9pbmplY3Rpb24udHNcbiAqL1xuKGZ1bmN0aW9uICgpIHtcbiAgICBjb25zdCBUQUcgPSAn8J+UjCBbYWlDbGF3LUluamVjdF0nO1xuICAgIGxldCBsYXN0Q2FwdHVyZVRpbWUgPSAwO1xuICAgIGNvbnNvbGUubG9nKGAke1RBR30gSW5pdGlhbGl6aW5nIGluIE1BSU4gd29ybGQuLi5gKTtcbiAgICAvLyDilIDilIAg5bmz5Y+wIEFQSSDljLnphY3op4TliJnvvIjkuI4gY29uc3RzLnRzIOS/neaMgeS4gOiHtO+8jOS9hiBpbmplY3Rpb24g6L+Q6KGM5ZyoIE1BSU4gd29ybGTvvIzml6Dms5UgaW1wb3J077yJIOKUgOKUgFxuICAgIGNvbnN0IFBMQVRGT1JNX0FQSV9QQVRURVJOUyA9IHtcbiAgICAgICAgY2hhdGdwdDogW1xuICAgICAgICAgICAgL2NoYXRncHRcXC5jb21cXC9iYWNrZW5kLWFwaVxcLy8sXG4gICAgICAgICAgICAvY2hhdFxcLm9wZW5haVxcLmNvbVxcL2JhY2tlbmQtYXBpXFwvLyxcbiAgICAgICAgXSxcbiAgICAgICAgZ2VtaW5pOiBbXG4gICAgICAgICAgICAvZ2VtaW5pXFwuZ29vZ2xlXFwuY29tXFwvX1xcL0JhcmRDaGF0VWlcXC8vLFxuICAgICAgICAgICAgL2dlbWluaVxcLmdvb2dsZVxcLmNvbVxcL2FwcFxcL19cXC9CYXJkQ2hhdFVpXFwvLyxcbiAgICAgICAgICAgIC9hbGthbGltYWtlcnN1aXRlLXBhXFwuY2xpZW50czZcXC5nb29nbGVcXC5jb21cXC8vLFxuICAgICAgICBdLFxuICAgICAgICBncm9rOiBbXG4gICAgICAgICAgICAvZ3Jva1xcLmNvbVxcL3Jlc3RcXC9hcHAtY2hhdFxcLy8sXG4gICAgICAgICAgICAveFxcLmNvbVxcL2lcXC9hcGlcXC8yXFwvZ3Jva1xcLy8sXG4gICAgICAgIF0sXG4gICAgfTtcbiAgICAvKipcbiAgICAgKiDmo4DmtYsgVVJMIOaYr+WQpuWxnuS6juaIkeS7rOebkeaOp+eahCBBSSDlubPlj7AgQVBJXG4gICAgICovXG4gICAgZnVuY3Rpb24gZGV0ZWN0UGxhdGZvcm0odXJsKSB7XG4gICAgICAgIGZvciAoY29uc3QgW3BsYXRmb3JtLCBwYXR0ZXJuc10gb2YgT2JqZWN0LmVudHJpZXMoUExBVEZPUk1fQVBJX1BBVFRFUk5TKSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIHBhdHRlcm5zKSB7XG4gICAgICAgICAgICAgICAgaWYgKHBhdHRlcm4udGVzdCh1cmwpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwbGF0Zm9ybTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIOS7jiBmZXRjaCDnmoQgaW5pdCDlj4LmlbDkuK3mj5Dlj5YgQXV0aG9yaXphdGlvbiBCZWFyZXIgVG9rZW5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBleHRyYWN0QmVhcmVyKGluaXRBcmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGhkcnMgPSBpbml0QXJnPy5oZWFkZXJzO1xuICAgICAgICAgICAgaWYgKCFoZHJzKVxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgbGV0IGF1dGggPSBudWxsO1xuICAgICAgICAgICAgaWYgKGhkcnMgaW5zdGFuY2VvZiBIZWFkZXJzKSB7XG4gICAgICAgICAgICAgICAgYXV0aCA9IGhkcnMuZ2V0KCdhdXRob3JpemF0aW9uJykgfHwgaGRycy5nZXQoJ0F1dGhvcml6YXRpb24nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaGRycykpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYWlyID0gaGRycy5maW5kKChoKSA9PiAodHlwZW9mIGhbMF0gPT09ICdzdHJpbmcnKSAmJiBoWzBdLnRvTG93ZXJDYXNlKCkgPT09ICdhdXRob3JpemF0aW9uJyk7XG4gICAgICAgICAgICAgICAgaWYgKHBhaXIpXG4gICAgICAgICAgICAgICAgICAgIGF1dGggPSBwYWlyWzFdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodHlwZW9mIGhkcnMgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgYXV0aCA9IGhkcnNbJ2F1dGhvcml6YXRpb24nXSB8fCBoZHJzWydBdXRob3JpemF0aW9uJ10gfHwgbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiAoYXV0aCAmJiBhdXRoLnN0YXJ0c1dpdGgoJ0JlYXJlciAnKSkgPyBhdXRoIDogbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiDku44gZmV0Y2gg55qEIGluaXQg5Y+C5pWw5Lit5o+Q5Y+W5omA5pyJ6K+35rGC5aS077yI55So5LqO6K6w5b2V5a6M5pW055qE6K+35rGC5qC85byP77yJXG4gICAgICovXG4gICAgZnVuY3Rpb24gZXh0cmFjdEhlYWRlcnMoaW5pdEFyZykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB7fTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGhkcnMgPSBpbml0QXJnPy5oZWFkZXJzO1xuICAgICAgICAgICAgaWYgKCFoZHJzKVxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICBpZiAoaGRycyBpbnN0YW5jZW9mIEhlYWRlcnMpIHtcbiAgICAgICAgICAgICAgICBoZHJzLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaGRycykpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBoZHJzKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdFtrZXldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodHlwZW9mIGhkcnMgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgT2JqZWN0LmFzc2lnbihyZXN1bHQsIGhkcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoIHsgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICAvKipcbiAgICAgKiDlsIbmjZXojrfnmoTkv6Hmga/pgJrov4cgcG9zdE1lc3NhZ2Ug5Y+R6YCB57uZIGNvbnRlbnQgc2NyaXB0XG4gICAgICovXG4gICAgZnVuY3Rpb24gcG9zdENhcHR1cmUocGxhdGZvcm0sIGFwaVVybCwgbWV0aG9kLCBiZWFyZXJUb2tlbiwgcmVxdWVzdEhlYWRlcnMsIHJlcXVlc3RCb2R5KSB7XG4gICAgICAgIGxhc3RDYXB0dXJlVGltZSA9IERhdGUubm93KCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGAlYyR7VEFHfSDwn5OhIENhcHR1cmVkICVjJHtwbGF0Zm9ybX0lYyBBUEkgY2FsbDogJHttZXRob2R9ICR7YXBpVXJsLnN1YnN0cmluZygwLCA4MCl9Li4uYCwgJ2NvbG9yOiAjNzE4MDk2JywgJ2NvbG9yOiAjNGFkZTgwOyBmb250LXdlaWdodDogYm9sZCcsICdjb2xvcjogIzcxODA5NicpO1xuICAgICAgICBpZiAoYmVhcmVyVG9rZW4pIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGAlYyR7VEFHfSDwn5SRIEJlYXJlciB0b2tlbiBjYXB0dXJlZCBmb3IgJHtwbGF0Zm9ybX0gKCR7YmVhcmVyVG9rZW4uc3Vic3RyaW5nKDAsIDIwKX0uLi4pYCwgJ2NvbG9yOiAjZmJiZjI0OyBmb250LXdlaWdodDogYm9sZCcpO1xuICAgICAgICB9XG4gICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZSh7XG4gICAgICAgICAgICBzb3VyY2U6ICdhaWNsYXctaW5qZWN0aW9uJyxcbiAgICAgICAgICAgIHR5cGU6ICdDUkVERU5USUFMU19DQVBUVVJFRCcsXG4gICAgICAgICAgICBwbGF0Zm9ybSxcbiAgICAgICAgICAgIGFwaVVybCxcbiAgICAgICAgICAgIG1ldGhvZCxcbiAgICAgICAgICAgIGJlYXJlclRva2VuOiBiZWFyZXJUb2tlbiB8fCBudWxsLFxuICAgICAgICAgICAgcmVxdWVzdEhlYWRlcnMsXG4gICAgICAgICAgICByZXF1ZXN0Qm9keSxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgICAgfSwgJyonKTtcbiAgICB9XG4gICAgLy8g4pSA4pSAIEhvb2sgd2luZG93LmZldGNoIOKUgOKUgFxuICAgIGZ1bmN0aW9uIHBhdGNoRmV0Y2goKSB7XG4gICAgICAgIGlmICh3aW5kb3cuX19hY19mZXRjaF9wYXRjaGVkKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBjb25zdCBvcmlnaW5hbEZldGNoID0gd2luZG93LmZldGNoO1xuICAgICAgICBpZiAoIW9yaWdpbmFsRmV0Y2gpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgJHtUQUd9IOKdjCBOYXRpdmUgZmV0Y2ggbm90IGZvdW5kIWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHdpbmRvdy5mZXRjaCA9IGFzeW5jIGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICAgICAgICBjb25zdCByZXFBcmcgPSBhcmdzWzBdO1xuICAgICAgICAgICAgY29uc3QgaW5pdEFyZyA9IGFyZ3NbMV07XG4gICAgICAgICAgICAvLyDmj5Dlj5YgVVJMXG4gICAgICAgICAgICBjb25zdCB1cmwgPSB0eXBlb2YgcmVxQXJnID09PSAnc3RyaW5nJ1xuICAgICAgICAgICAgICAgID8gcmVxQXJnXG4gICAgICAgICAgICAgICAgOiAocmVxQXJnIGluc3RhbmNlb2YgUmVxdWVzdCA/IHJlcUFyZy51cmwgOiBTdHJpbmcocmVxQXJnKSk7XG4gICAgICAgICAgICAvLyDmo4DmtYvmmK/lkKbmmK/miJHku6zlhbPlv4PnmoTlubPlj7AgQVBJXG4gICAgICAgICAgICBjb25zdCBwbGF0Zm9ybSA9IGRldGVjdFBsYXRmb3JtKHVybCk7XG4gICAgICAgICAgICBpZiAoIXBsYXRmb3JtKSB7XG4gICAgICAgICAgICAgICAgLy8g5LiN5piv55uu5qCHIEFQSe+8jOebtOaOpeaUvuihjFxuICAgICAgICAgICAgICAgIHJldHVybiBvcmlnaW5hbEZldGNoLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8g5o+Q5Y+W5Yet6K+B5L+h5oGvXG4gICAgICAgICAgICBjb25zdCBtZXRob2QgPSBpbml0QXJnPy5tZXRob2QgfHwgJ0dFVCc7XG4gICAgICAgICAgICBjb25zdCBiZWFyZXIgPSBleHRyYWN0QmVhcmVyKGluaXRBcmcpO1xuICAgICAgICAgICAgY29uc3QgaGVhZGVycyA9IGV4dHJhY3RIZWFkZXJzKGluaXRBcmcpO1xuICAgICAgICAgICAgbGV0IGJvZHkgPSBpbml0QXJnPy5ib2R5IHx8IG51bGw7XG4gICAgICAgICAgICAvLyDlsJ3or5Xop6PmnpAgYm9keVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGJvZHkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIGJvZHkgPSBKU09OLnBhcnNlKGJvZHkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIHsgfVxuICAgICAgICAgICAgLy8g5Y+R6YCB57uZIGNvbnRlbnQgc2NyaXB0XG4gICAgICAgICAgICBwb3N0Q2FwdHVyZShwbGF0Zm9ybSwgdXJsLCBtZXRob2QsIGJlYXJlciwgaGVhZGVycywgYm9keSk7XG4gICAgICAgICAgICAvLyDmlL7ooYzljp/lp4vor7fmsYLvvIzkuI3lubLmibDmraPluLjlip/og71cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IG9yaWdpbmFsRmV0Y2guYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYCR7VEFHfSBGZXRjaCBlcnJvciBbJHtwbGF0Zm9ybX1dOmAsIGUpO1xuICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHdpbmRvdy5fX2FjX2ZldGNoX3BhdGNoZWQgPSB0cnVlO1xuICAgICAgICB3aW5kb3cuX19hY19vcmlnaW5hbF9mZXRjaCA9IG9yaWdpbmFsRmV0Y2g7XG4gICAgICAgIGNvbnNvbGUubG9nKGAlYyR7VEFHfSDinIUgRmV0Y2ggaG9vayBpbnN0YWxsZWRgLCAnY29sb3I6ICM0YWRlODAnKTtcbiAgICB9XG4gICAgLy8g4pSA4pSAIEhvb2sgWE1MSHR0cFJlcXVlc3TvvIjmn5DkupvlubPlj7Dlj6/og73kvb/nlKggWEhS77yJ4pSA4pSAXG4gICAgZnVuY3Rpb24gcGF0Y2hYSFIoKSB7XG4gICAgICAgIGlmICh3aW5kb3cuX19hY194aHJfcGF0Y2hlZClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgY29uc3QgT3JpZ2luYWxYSFIgPSB3aW5kb3cuWE1MSHR0cFJlcXVlc3Q7XG4gICAgICAgIGlmICghT3JpZ2luYWxYSFIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgJHtUQUd9IOKdjCBOYXRpdmUgWE1MSHR0cFJlcXVlc3Qgbm90IGZvdW5kIWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNsYXNzIEFDWEhSSW50ZXJjZXB0b3IgZXh0ZW5kcyBPcmlnaW5hbFhIUiB7XG4gICAgICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgICAgICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FjX3VybCA9ICcnO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FjX3BsYXRmb3JtID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLl9hY19tZXRob2QgPSAnR0VUJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG9wZW4obWV0aG9kLCB1cmwsIC4uLnJlc3QpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9hY191cmwgPSB1cmw7XG4gICAgICAgICAgICAgICAgdGhpcy5fYWNfbWV0aG9kID0gbWV0aG9kO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FjX3BsYXRmb3JtID0gZGV0ZWN0UGxhdGZvcm0odXJsKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VwZXIub3Blbi5hcHBseSh0aGlzLCBbbWV0aG9kLCB1cmwsIC4uLnJlc3RdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNlbmQoYm9keSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBsYXRmb3JtID0gdGhpcy5fYWNfcGxhdGZvcm07XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsID0gdGhpcy5fYWNfdXJsO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1ldGhvZCA9IHRoaXMuX2FjX21ldGhvZDtcbiAgICAgICAgICAgICAgICBpZiAocGxhdGZvcm0gJiYgdXJsKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHBhcnNlZEJvZHkgPSBib2R5O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYm9keSA9PT0gJ3N0cmluZycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJzZWRCb2R5ID0gSlNPTi5wYXJzZShib2R5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggeyB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gWEhSIOS4rSBiZWFyZXIg5LiN5a655piT5LuOIGhlYWRlciDojrflj5bvvIzkvKAgbnVsbFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvc3RDYXB0dXJlKHBsYXRmb3JtLCB1cmwsIG1ldGhvZCwgbnVsbCwge30sIHBhcnNlZEJvZHkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2F0Y2ggeyB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gc3VwZXIuc2VuZChib2R5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB3aW5kb3cuWE1MSHR0cFJlcXVlc3QgPSBBQ1hIUkludGVyY2VwdG9yO1xuICAgICAgICB3aW5kb3cuX19hY194aHJfcGF0Y2hlZCA9IHRydWU7XG4gICAgICAgIGNvbnNvbGUubG9nKGAlYyR7VEFHfSDinIUgWEhSIGhvb2sgaW5zdGFsbGVkYCwgJ2NvbG9yOiAjNGFkZTgwJyk7XG4gICAgfVxuICAgIC8vIOKUgOKUgCDlgaXlurfml6Xlv5fvvIjmr48gMTUg56eS5omT5Y2w5LiA5qyh54q25oCB77yJ4pSA4pSAXG4gICAgZnVuY3Rpb24gcHJpbnRIZWFsdGhMb2coKSB7XG4gICAgICAgIGNvbnN0IGZldGNoT2sgPSAhIXdpbmRvdy5fX2FjX2ZldGNoX3BhdGNoZWQ7XG4gICAgICAgIGNvbnN0IHhock9rID0gISF3aW5kb3cuX19hY194aHJfcGF0Y2hlZDtcbiAgICAgICAgY29uc3QgbGFzdEFnbyA9IGxhc3RDYXB0dXJlVGltZVxuICAgICAgICAgICAgPyBgJHtNYXRoLnJvdW5kKChEYXRlLm5vdygpIC0gbGFzdENhcHR1cmVUaW1lKSAvIDEwMDApfXMgYWdvYFxuICAgICAgICAgICAgOiAnTmV2ZXInO1xuICAgICAgICBjb25zb2xlLmdyb3VwQ29sbGFwc2VkKGAlYyR7VEFHfSBQdWxzZSAtICR7bmV3IERhdGUoKS50b0xvY2FsZVRpbWVTdHJpbmcoKX1gLCAnY29sb3I6ICM2MGE1ZmEnKTtcbiAgICAgICAgY29uc29sZS5sb2coYEZldGNoIEhvb2s6ICVjJHtmZXRjaE9rID8gJ0FDVElWRScgOiAnT0ZGTElORSd9YCwgZmV0Y2hPayA/ICdjb2xvcjojNGFkZTgwJyA6ICdjb2xvcjojZjg3MTcxJyk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBYSFIgSG9vazogICAlYyR7eGhyT2sgPyAnQUNUSVZFJyA6ICdPRkZMSU5FJ31gLCB4aHJPayA/ICdjb2xvcjojNGFkZTgwJyA6ICdjb2xvcjojZjg3MTcxJyk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBMYXN0IENhcHR1cmU6ICR7bGFzdEFnb31gKTtcbiAgICAgICAgY29uc29sZS5ncm91cEVuZCgpO1xuICAgIH1cbiAgICAvLyDilIDilIAg5LiK5oqlIGhvb2sg54q25oCB57uZIGNvbnRlbnQgc2NyaXB0IOKUgOKUgFxuICAgIGZ1bmN0aW9uIHJlcG9ydEhvb2tTdGF0dXMoKSB7XG4gICAgICAgIGNvbnN0IGZldGNoT2sgPSAhIXdpbmRvdy5fX2FjX2ZldGNoX3BhdGNoZWQ7XG4gICAgICAgIGNvbnN0IHhock9rID0gISF3aW5kb3cuX19hY194aHJfcGF0Y2hlZDtcbiAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKHtcbiAgICAgICAgICAgIHNvdXJjZTogJ2FpY2xhdy1pbmplY3Rpb24nLFxuICAgICAgICAgICAgdHlwZTogJ0hPT0tfU1RBVFVTX1JFUE9SVCcsXG4gICAgICAgICAgICBzdGF0dXM6IHsgZmV0Y2g6IGZldGNoT2ssIHhocjogeGhyT2sgfSxcbiAgICAgICAgfSwgJyonKTtcbiAgICAgICAgLy8g6Ieq5oiR5L+u5aSN77ya5aaC5p6cIGhvb2sg6KKr6KaG55uW77yM6YeN5paw5a6J6KOFXG4gICAgICAgIGlmICghZmV0Y2hPayB8fCB3aW5kb3cuZmV0Y2ggPT09IHdpbmRvdy5fX2FjX29yaWdpbmFsX2ZldGNoKVxuICAgICAgICAgICAgcGF0Y2hGZXRjaCgpO1xuICAgICAgICBpZiAoIXhock9rIHx8IHdpbmRvdy5YTUxIdHRwUmVxdWVzdCA9PT0gd2luZG93Ll9fYWNfb3JpZ2luYWxfeGhyKVxuICAgICAgICAgICAgcGF0Y2hYSFIoKTtcbiAgICB9XG4gICAgLy8g4pSA4pSAIOWQr+WKqCDilIDilIBcbiAgICBwYXRjaEZldGNoKCk7XG4gICAgcGF0Y2hYSFIoKTtcbiAgICBzZXRJbnRlcnZhbChwcmludEhlYWx0aExvZywgMTUwMDApO1xuICAgIHNldEludGVydmFsKHJlcG9ydEhvb2tTdGF0dXMsIDMwMDApO1xuICAgIHByaW50SGVhbHRoTG9nKCk7XG59KSgpO1xuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9