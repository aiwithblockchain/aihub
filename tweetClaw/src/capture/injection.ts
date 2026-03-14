import { watchedOps, isGuestHandle } from './consts';

/**
 * TweetClaw Injected Sensor (v4.8 - URL + Bearer Fix)
 *
 * 关键修正：
 *  - postSignal 现在传 apiUrl（被拦截的真实 API 端点），不再传页面 URL
 *  - 从 fetch 请求头中提取 bearer token 一并发出，供 background 存储
 */
(function () {
    const TAG = '🛡️ [TweetClaw-Page]';
    let lastHitTime: number = 0;
    let lastSendTime: number = 0;
    let hookAnomalies: string[] = [];

    console.log(`${TAG} System initializing...`);

    function isIdentityOp(url: string): string | null {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('authenticateduserquery')) return 'AuthenticatedUserQuery';
        if (lowerUrl.includes('viewer')) return 'Viewer';
        if (lowerUrl.includes('accountuserquery')) return 'AccountUserQuery';
        if (lowerUrl.includes('accountsettings')) return 'AccountSettings';
        if (lowerUrl.includes('/account/settings.json')) return 'settings.json';
        if (lowerUrl.includes('/account/verify_credentials.json')) return 'VerifyCredentials';
        return null;
    }

    function isTargetUrl(url: string): string | null {
        const idOp = isIdentityOp(url);
        if (idOp) return idOp;
        
        const lowerUrl = url.toLowerCase();
        for (const op of watchedOps) {
            const lowerOp = op.toLowerCase();
            // 匹配 /OpName 或 =OpName
            if (lowerUrl.includes(`/${lowerOp}`) || lowerUrl.includes(`=${lowerOp}`)) return op;
        }
        return null;
    }

    /**
     * @param type   operationName (e.g. 'HomeTimeline')
     * @param apiUrl 被拦截的真实 API 端点（含 queryId 的 graphql URL 或 REST URL）
     * @param data   响应体 JSON
     */
    function postSignal(
        type: string,
        apiUrl: string,
        data: any,
        method: string = 'POST',
        requestBody?: any,
        bearerToken?: string | null
    ) {
        lastHitTime = Date.now();

        try {
            const biteSize = new TextEncoder().encode(JSON.stringify(data)).length;
            console.log(
                `%c${TAG} 📡 Intercepted: %c${type}%c (${biteSize} bytes)`,
                'color: #718096', 'color: #1DA1F2; font-weight: bold', 'color: #718096'
            );
        } catch (e) {}

        const isId = ['AuthenticatedUserQuery', 'Viewer', 'AccountSettings', 'settings.json', 'VerifyCredentials'].includes(type);
        if (isId) {
            try {
                const screen_name =
                    data.data?.viewer?.user_results?.result?.legacy?.screen_name ||
                    data.data?.authenticated_user_info?.screen_name ||
                    data.screen_name;
                if (screen_name) {
                    const guest = isGuestHandle(screen_name);
                    const color = guest ? '#FFAD1F' : '#1DA1F2';
                    const prefix = guest ? '⚠️ [Guest Detect]' : '✅ [Account Detect]';
                    console.log(`%c${TAG} ${prefix} @${screen_name} via ${type}`, `color: ${color}; font-weight: bold;`);
                }
            } catch (e) {}
        }

        lastSendTime = Date.now();
        window.postMessage({
            source: 'tweetclaw-injection',
            type: 'SIGNAL_CAPTURED',
            op: type,
            apiUrl,                        // ← 真实 API 端点 URL（含 queryId）
            pageUrl: window.location.href, // ← 当前页面 URL
            method,
            requestBody,
            bearerToken: bearerToken || null,
            data
        }, '*');
    }

    /** 从 fetch RequestInit headers 中提取 Authorization Bearer */
    function extractBearer(initArg: any): string | null {
        try {
            const hdrs = initArg?.headers;
            if (!hdrs) return null;
            let auth: string | null = null;
            if (hdrs instanceof Headers) {
                auth = hdrs.get('authorization');
            } else if (typeof hdrs === 'object') {
                auth = hdrs['authorization'] || hdrs['Authorization'] || null;
            }
            return (auth && auth.startsWith('Bearer ')) ? auth : null;
        } catch {
            return null;
        }
    }

    function patchFetch() {
        if ((window as any).__tc_fetch_patched) return;
        const orgFetch = window.fetch;
        if (!orgFetch) {
            hookAnomalies.push('Native fetch missing');
            return;
        }
        window.fetch = async function (...args: any[]) {
            const reqArg = args[0];
            const initArg = args[1];
            const url = typeof reqArg === 'string'
                ? reqArg
                : (reqArg instanceof Request ? reqArg.url : String(reqArg));
            const method = initArg?.method || 'GET';
            const body = initArg?.body;
            const targetOp = isTargetUrl(url);

            if (!targetOp) {
                // 如果是 graphql 且包含 operation，但没匹配上，打个日志参考
                if (url.includes('/graphql/')) {
                    console.debug(`${TAG} Ignored GQL: ${url}`);
                }
                return orgFetch.apply(this, args as any);
            }

            const bearer = extractBearer(initArg);

            try {
                const response = await orgFetch.apply(this, args as any);
                const clone = response.clone();
                clone.json().then(json => {
                    let parsedBody = body;
                    try { if (typeof body === 'string') parsedBody = JSON.parse(body); } catch (e) {}
                    postSignal(targetOp, url, json, method, parsedBody, bearer);
                }).catch(err => {
                    console.warn(`${TAG} JSON Parse Fail [${targetOp}]:`, err);
                });
                return response;
            } catch (e) { 
                console.error(`${TAG} Fetch Error [${targetOp}]:`, e);
                throw e; 
            }
        };
        (window as any).__tc_fetch_patched = true;
        (window as any).__tc_original_fetch = orgFetch;
    }

    function patchXHR() {
        if ((window as any).__tc_xhr_patched) return;
        const OrgXHR = window.XMLHttpRequest;
        if (!OrgXHR) {
            hookAnomalies.push('Native XMLHttpRequest missing');
            return;
        }
        class TCXHRInterceptor extends OrgXHR {
            private _tc_url: string = '';
            private _tc_op: string | null = null;
            private _tc_method: string = 'GET';
            open(m: string, u: string, ...rest: any[]) {
                this._tc_url = u;
                this._tc_method = m;
                this._tc_op = isTargetUrl(u);
                return (super.open as any).apply(this, [m, u, ...rest]);
            }
            send(b?: any) {
                const op = this._tc_op;
                const url = this._tc_url;
                const method = this._tc_method;
                if (op && url) {
                    this.addEventListener('load', () => {
                        try {
                            if (this.responseText) {
                                let parsedBody = b;
                                try { if (typeof b === 'string') parsedBody = JSON.parse(b); } catch (e) {}
                                // XHR: bearer not easily captured from headers here; pass null
                                postSignal(op, url, JSON.parse(this.responseText), method, parsedBody, null);
                            }
                        } catch (e) {}
                    });
                }
                return super.send(b);
            }
        }
        (window as any).XMLHttpRequest = TCXHRInterceptor;
        (window as any).__tc_xhr_patched = true;
        (window as any).__tc_original_xhr = OrgXHR;
    }

    function printHealthLog() {
        const isFetchActive = !!(window as any).__tc_fetch_patched;
        const isXHRActive = !!(window as any).__tc_xhr_patched;
        const now = Date.now();
        const hitAgo = lastHitTime ? `${Math.round((now - lastHitTime) / 1000)}s ago` : 'Never';
        const sendAgo = lastSendTime ? `${Math.round((now - lastSendTime) / 1000)}s ago` : 'Never';

        console.groupCollapsed(`%c${TAG} System Pulse - ${new Date().toLocaleTimeString()}`, 'color: #1DA1F2');
        console.log(`Inject Status: %cALIVE`, 'color: #48BB78; font-weight: bold');
        console.log(`Fetch Hook:    %c${isFetchActive ? 'ACTIVE' : 'OFFLINE'}`, isFetchActive ? 'color: #48BB78' : 'color: #F56565');
        console.log(`XHR Hook:      %c${isXHRActive ? 'ACTIVE' : 'OFFLINE'}`, isXHRActive ? 'color: #48BB78' : 'color: #F56565');
        console.log(`Last API Hit:   ${hitAgo}`);
        console.log(`Last BG Send:   ${sendAgo}`);
        if (hookAnomalies.length > 0) {
            console.error(`Anomalies:     ${hookAnomalies.join(', ')}`);
        } else {
            console.log(`Anomalies:     %cNONE`, 'color: #48BB78');
        }
        console.groupEnd();
    }

    patchFetch();
    patchXHR();

    setInterval(printHealthLog, 10000);

    // Watchdog: report hook status + self-heal
    setInterval(() => {
        const f = window.fetch && (window as any).__tc_fetch_patched;
        const x = (window as any).__tc_xhr_patched;
        window.postMessage({
            source: 'tweetclaw-injection',
            type: 'HOOK_STATUS_REPORT',
            status: { fetch: !!f, xhr: !!x }
        }, '*');
        if (!f || window.fetch === (window as any).__tc_original_fetch) patchFetch();
        if (!x || window.XMLHttpRequest === (window as any).__tc_original_xhr) patchXHR();
    }, 2000);

    printHealthLog();
})();
