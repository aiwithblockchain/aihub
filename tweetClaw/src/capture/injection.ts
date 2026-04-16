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

        // Extract features from request body for per-operation caching
        let features: Record<string, boolean> | null = null;
        try {
            if (requestBody && typeof requestBody === 'object' && requestBody.features) {
                features = requestBody.features;
            }
        } catch (e) {}

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
            features: features,            // ← 提取的 features（如果有）
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

    function base64ToBlob(base64: string, mimeType: string): Blob {
        const byteString = atob(base64);
        const buffer = new ArrayBuffer(byteString.length);
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < byteString.length; i++) {
            bytes[i] = byteString.charCodeAt(i);
        }
        return new Blob([buffer], { type: mimeType });
    }

    function dispatchUploadProxyResponse(detail: Record<string, any>) {
        document.dispatchEvent(new CustomEvent('tweetclaw:upload-proxy-response', { detail }));
    }

    function sendAppendViaXHR(requestId: string, payload: any) {
        const chunkBlob = base64ToBlob(payload.chunkBase64, payload.mimeType);
        const formData = new FormData();
        formData.append('command', payload.command || 'APPEND');
        formData.append('media_id', payload.mediaId);
        formData.append('segment_index', String(payload.segmentIndex));
        formData.append('media', chunkBlob, `chunk-${payload.segmentIndex}`);

        const xhr = new XMLHttpRequest();
        const startedAt = Date.now();
        let lastUploadProgressAt = startedAt;
        let lastUploadLoaded = 0;
        let stallTimer: number | null = null;
        xhr.open(payload.method || 'POST', payload.url, true);
        xhr.withCredentials = true;
        xhr.timeout = 120000;

        const headers = payload.headers || {};
        Object.entries(headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, String(value));
        });

        const clearStallTimer = () => {
            if (stallTimer !== null) {
                window.clearInterval(stallTimer);
                stallTimer = null;
            }
        };

        stallTimer = window.setInterval(() => {
            console.log(
                `${TAG} Upload proxy XHR stall check: requestId=${requestId}, readyState=${xhr.readyState}, status=${xhr.status}, elapsedMs=${Date.now() - startedAt}, sinceLastUploadProgressMs=${Date.now() - lastUploadProgressAt}, lastUploadLoaded=${lastUploadLoaded}, online=${navigator.onLine}, visibility=${document.visibilityState}`
            );
        }, 5000);

        xhr.upload.onprogress = (progressEvent) => {
            if (!progressEvent.lengthComputable) return;
            lastUploadProgressAt = Date.now();
            lastUploadLoaded = progressEvent.loaded;
            console.log(`${TAG} Upload proxy XHR progress: requestId=${requestId}, loaded=${progressEvent.loaded}, total=${progressEvent.total}, elapsedMs=${Date.now() - startedAt}`);
        };

        xhr.upload.onloadstart = () => {
            console.log(`${TAG} Upload proxy XHR upload loadstart: requestId=${requestId}, elapsedMs=${Date.now() - startedAt}`);
        };

        xhr.upload.onloadend = () => {
            console.log(`${TAG} Upload proxy XHR upload loadend: requestId=${requestId}, elapsedMs=${Date.now() - startedAt}`);
        };

        xhr.onprogress = (progressEvent) => {
            console.log(
                `${TAG} Upload proxy XHR download progress: requestId=${requestId}, lengthComputable=${progressEvent.lengthComputable}, loaded=${progressEvent.loaded}, total=${progressEvent.total}, elapsedMs=${Date.now() - startedAt}`
            );
        };

        xhr.onreadystatechange = () => {
            console.log(`${TAG} Upload proxy XHR readyState: requestId=${requestId}, readyState=${xhr.readyState}, status=${xhr.status}, elapsedMs=${Date.now() - startedAt}`);
            if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
                console.log(`${TAG} Upload proxy XHR headers received: requestId=${requestId}, status=${xhr.status}, statusText=${xhr.statusText}`);
            }
        };

        xhr.onload = () => {
            clearStallTimer();
            console.log(`${TAG} Upload proxy XHR load: requestId=${requestId}, status=${xhr.status}, statusText=${xhr.statusText}, elapsedMs=${Date.now() - startedAt}, responseURL=${xhr.responseURL}`);
            const text = xhr.responseText || '';
            const responseHeaders = xhr.getAllResponseHeaders();
            console.log(`${TAG} Upload proxy XHR response headers: requestId=${requestId}, headers=${responseHeaders || '<empty>'}`);
            let json: any = null;
            try {
                json = text ? JSON.parse(text) : null;
            } catch {
                json = null;
            }
            dispatchUploadProxyResponse({
                requestId,
                ok: xhr.status >= 200 && xhr.status < 300,
                status: xhr.status,
                text,
                json
            });
        };

        xhr.onerror = () => {
            clearStallTimer();
            console.error(`${TAG} Upload proxy XHR error: requestId=${requestId}, status=${xhr.status}, statusText=${xhr.statusText}, readyState=${xhr.readyState}, elapsedMs=${Date.now() - startedAt}, online=${navigator.onLine}, responseURL=${xhr.responseURL || '<empty>'}`);
            dispatchUploadProxyResponse({
                requestId,
                ok: false,
                status: xhr.status || 0,
                error: 'XMLHttpRequest error'
            });
        };

        xhr.onabort = () => {
            clearStallTimer();
            console.error(`${TAG} Upload proxy XHR abort: requestId=${requestId}, readyState=${xhr.readyState}, elapsedMs=${Date.now() - startedAt}`);
            dispatchUploadProxyResponse({
                requestId,
                ok: false,
                status: xhr.status || 0,
                error: 'XMLHttpRequest aborted'
            });
        };

        xhr.ontimeout = () => {
            clearStallTimer();
            console.error(`${TAG} Upload proxy XHR timeout: requestId=${requestId}, readyState=${xhr.readyState}, elapsedMs=${Date.now() - startedAt}, timeoutMs=${xhr.timeout}`);
            dispatchUploadProxyResponse({
                requestId,
                ok: false,
                status: xhr.status || 0,
                error: 'XMLHttpRequest timed out'
            });
        };

        console.log(`${TAG} Upload proxy XHR send: requestId=${requestId}, segmentIndex=${payload.segmentIndex}, chunkBase64Length=${payload.chunkBase64?.length || 0}, chunkBlobSize=${chunkBlob.size}, mimeType=${payload.mimeType}, online=${navigator.onLine}, userAgent=${navigator.userAgent}`);
        xhr.send(formData);
    }

    document.addEventListener('tweetclaw:upload-proxy-request', async (event) => {
        const detail = (event as CustomEvent).detail || {};
        const requestId = detail.requestId;
        const payload = detail.payload || {};
        console.log(`${TAG} Upload proxy request received: requestId=${requestId}, kind=${payload.kind}, method=${payload.method}, url=${payload.url}`);

        try {
            if (payload.kind === 'append') {
                sendAppendViaXHR(requestId, payload);
                return;
            }

            let response: Response;
            response = await fetch(payload.url, {
                method: payload.method || 'GET',
                headers: payload.headers || {},
                credentials: 'include'
            });
            console.log(`${TAG} Upload proxy fetch completed: requestId=${requestId}, ok=${response.ok}, status=${response.status}`);

            const text = await response.text();
            let json: any = null;
            try {
                json = text ? JSON.parse(text) : null;
            } catch {
                json = null;
            }

            dispatchUploadProxyResponse({
                requestId,
                ok: response.ok,
                status: response.status,
                text,
                json
            });
        } catch (e: any) {
            console.error(`${TAG} Upload proxy fetch failed: requestId=${requestId}, error=${e?.message || String(e)}`, e);
            dispatchUploadProxyResponse({
                requestId,
                ok: false,
                status: 0,
                error: e?.message || String(e)
            });
        }
    });

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
