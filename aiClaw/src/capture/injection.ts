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
    let lastCaptureTime: number = 0;

    console.log(`${TAG} Initializing in MAIN world...`);

    // ── 平台 API 匹配规则（与 consts.ts 保持一致，但 injection 运行在 MAIN world，无法 import） ──
    const PLATFORM_API_PATTERNS: Record<string, RegExp[]> = {
        chatgpt: [
            /chatgpt\.com\/backend-api\/(conversation|me|accounts\/check)/,
            /chat\.openai\.com\/backend-api\/(conversation|me|accounts\/check)/,
        ],
        gemini: [
            /gemini\.google\.com\/_\/BardChatUi\//,
            /gemini\.google\.com\/app\/_\/BardChatUi\//,
            /alkalimakersuite-pa\.clients6\.google\.com\//,
        ],
        grok: [
            /grok\.com\/rest\/app-chat\//,
            /grok\.com\/rest\/user-settings\//,
            /x\.com\/i\/api\/2\/grok\//,
        ],
    };

    /**
     * 检测 URL 是否属于我们监控的 AI 平台 API
     */
    function detectPlatform(url: string): string | null {
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
    function extractBearer(initArg: any): string | null {
        try {
            const hdrs = initArg?.headers;
            if (!hdrs) return null;
            let auth: string | null = null;
            let csrf: string | null = null;

            if (hdrs instanceof Headers) {
                auth = hdrs.get('authorization') || hdrs.get('Authorization');
                csrf = hdrs.get('x-csrf-token') || hdrs.get('x-goog-authuser');
            } else if (Array.isArray(hdrs)) {
                const aPair = hdrs.find((h: any) => h[0]?.toLowerCase() === 'authorization');
                if (aPair) auth = aPair[1];
                const cPair = hdrs.find((h: any) => h[0]?.toLowerCase() === 'x-csrf-token' || h[0]?.toLowerCase() === 'x-goog-authuser');
                if (cPair) csrf = cPair[1];
            } else if (typeof hdrs === 'object') {
                auth = hdrs['authorization'] || hdrs['Authorization'] || null;
                csrf = hdrs['x-csrf-token'] || hdrs['X-CSRF-Token'] || hdrs['x-goog-authuser'] || null;
            }

            // 如果有 Authorization，直接返回（不管是 Bearer 还是其他的）
            if (auth) return auth;
            // 如果没有 Authorization 但有 CSRF 或 Google AuthUser，返回一个占位符表示“已感知到鉴权头”
            if (csrf) return `Captured-${csrf.substring(0, 8)}`;
            
            return null;
        } catch {
            return null;
        }
    }

    /**
     * 从 fetch 的 init 参数中提取所有请求头（用于记录完整的请求格式）
     */
    function extractHeaders(initArg: any): Record<string, string> {
        const result: Record<string, string> = {};
        try {
            const hdrs = initArg?.headers;
            if (!hdrs) return result;

            if (hdrs instanceof Headers) {
                hdrs.forEach((value: string, key: string) => {
                    result[key] = value;
                });
            } else if (Array.isArray(hdrs)) {
                for (const [key, value] of hdrs) {
                    result[key] = value;
                }
            } else if (typeof hdrs === 'object') {
                Object.assign(result, hdrs);
            }
        } catch {}
        return result;
    }

    /**
     * 将捕获的信息通过 postMessage 发送给 content script
     */
    function postCapture(
        platform: string,
        apiUrl: string,
        method: string,
        bearerToken: string | null,
        requestHeaders: Record<string, string>,
        requestBody: any
    ) {
        lastCaptureTime = Date.now();

        console.log(
            `%c${TAG} 📡 Captured %c${platform}%c API call: ${method} ${apiUrl.substring(0, 80)}...`,
            'color: #718096',
            'color: #4ade80; font-weight: bold',
            'color: #718096'
        );

        if (bearerToken) {
            console.log(
                `%c${TAG} 🔑 Bearer token captured for ${platform} (${bearerToken.substring(0, 20)}...)`,
                'color: #fbbf24; font-weight: bold'
            );
        }

        window.postMessage({
            source: 'aiclaw-injection',
            type: 'AC_CAPTURED_CREDENTIALS',
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
        if ((window as any).__ac_fetch_patched) return;

        const originalFetch = window.fetch;
        if (!originalFetch) {
            console.warn(`${TAG} ❌ Native fetch not found!`);
            return;
        }

        window.fetch = async function (...args: any[]) {
            const reqArg = args[0];
            const initArg = args[1];

            // 1. 提取 URL 并转换为绝对路径
            let url = '';
            try {
                const rawUrl = typeof reqArg === 'string'
                    ? reqArg
                    : (reqArg instanceof Request ? reqArg.url : String(reqArg));
                url = new URL(rawUrl, window.location.href).href;
            } catch (e) {
                console.warn(`${TAG} Failed to parse fetch URL:`, e);
                try {
                    url = typeof reqArg === 'string' ? reqArg : (reqArg instanceof Request ? reqArg.url : String(reqArg));
                } catch {}
            }

            // 2. 执行捕获逻辑（包裹在 try 块中以防崩溃导致页面挂掉）
            let platform: string | null = null;
            try {
                platform = detectPlatform(url);
                if (platform) {
                    const method = initArg?.method || 'GET';
                    const bearer = extractBearer(initArg);
                    const headers = extractHeaders(initArg);
                    let body = initArg?.body || null;
                    if (typeof body === 'string') {
                        try { body = JSON.parse(body); } catch {}
                    }
                    postCapture(platform, url, method, bearer, headers, body);
                }
            } catch (e) {
                console.error(`${TAG} Error during fetch capture (prevented crash):`, e);
            }

            // 3. 无论捕获是否成功，必须放行原始请求
            return originalFetch.apply(this, args as any);
        };

        (window as any).__ac_fetch_patched = true;
        (window as any).__ac_original_fetch = originalFetch;
        console.log(`%c${TAG} ✅ Fetch hook installed`, 'color: #4ade80');
    }

    // ── Hook XMLHttpRequest（某些平台可能使用 XHR）──

    function patchXHR() {
        if ((window as any).__ac_xhr_patched) return;

        const OriginalXHR = window.XMLHttpRequest;
        if (!OriginalXHR) {
            console.warn(`${TAG} ❌ Native XMLHttpRequest not found!`);
            return;
        }

        class ACXHRInterceptor extends OriginalXHR {
            private _ac_url: string = '';
            private _ac_platform: string | null = null;
            private _ac_method: string = 'GET';

            open(method: string, url: string, ...rest: any[]) {
                try {
                    this._ac_url = new URL(url, window.location.href).href;
                } catch {
                    this._ac_url = url;
                }
                this._ac_method = method;
                this._ac_platform = detectPlatform(this._ac_url);
                return (super.open as any).apply(this, [method, url, ...rest]);
            }

            send(body?: any) {
                const platform = this._ac_platform;
                const url = this._ac_url;
                const method = this._ac_method;

                if (platform && url) {
                    this.addEventListener('load', () => {
                        try {
                            let parsedBody = body;
                            try {
                                if (typeof body === 'string') parsedBody = JSON.parse(body);
                            } catch {}
                            // XHR 中 bearer 不容易从 header 获取，传 null
                            postCapture(platform, url, method, null, {}, parsedBody);
                        } catch {}
                    });
                }
                return super.send(body);
            }
        }

        (window as any).XMLHttpRequest = ACXHRInterceptor;
        (window as any).__ac_xhr_patched = true;
        console.log(`%c${TAG} ✅ XHR hook installed`, 'color: #4ade80');
    }

    // ── 健康日志（每 15 秒打印一次状态）──

    function printHealthLog() {
        const fetchOk = !!(window as any).__ac_fetch_patched;
        const xhrOk = !!(window as any).__ac_xhr_patched;
        const lastAgo = lastCaptureTime
            ? `${Math.round((Date.now() - lastCaptureTime) / 1000)}s ago`
            : 'Never';

        console.groupCollapsed(
            `%c${TAG} Pulse - ${new Date().toLocaleTimeString()}`,
            'color: #60a5fa'
        );
        console.log(`Fetch Hook: %c${fetchOk ? 'ACTIVE' : 'OFFLINE'}`, fetchOk ? 'color:#4ade80' : 'color:#f87171');
        console.log(`XHR Hook:   %c${xhrOk ? 'ACTIVE' : 'OFFLINE'}`, xhrOk ? 'color:#4ade80' : 'color:#f87171');
        console.log(`Last Capture: ${lastAgo}`);
        console.groupEnd();
    }

    // ── 上报 hook 状态给 content script ──

    function reportHookStatus() {
        const fetchOk = !!(window as any).__ac_fetch_patched;
        const xhrOk = !!(window as any).__ac_xhr_patched;
        window.postMessage({
            source: 'aiclaw-injection',
            type: 'HOOK_STATUS_REPORT',
            status: { fetch: fetchOk, xhr: xhrOk },
        }, '*');

        // 自我修复：如果 hook 被覆盖，重新安装
        if (!fetchOk || window.fetch === (window as any).__ac_original_fetch) patchFetch();
        if (!xhrOk || window.XMLHttpRequest === (window as any).__ac_original_xhr) patchXHR();
    }

    // ── 启动 ──

    patchFetch();
    patchXHR();

    setInterval(printHealthLog, 15000);
    setInterval(reportHookStatus, 3000);

    printHealthLog();
})();
