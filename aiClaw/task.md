# Phase 1 任务书：凭证捕获链路

> **目标**：实现 aiClaw 的三层拦截链路（injection → content → background），使扩展能在用户正常使用 ChatGPT / Gemini / Grok 时，被动捕获 API 请求的 Bearer Token、API 端点 URL 等凭证信息，并存入 `chrome.storage.local`。
>
> **技术架构参考文档**：`/Users/wesley/aiwithblockchain/aihub/aiClaw/doc/ARCHITECTURE.md`
>
> **参考工程**：`/Users/wesley/aiwithblockchain/aihub/tweetClaw`（已验证的同架构项目）

---

## 前置状态确认

在开始之前，请先确认当前项目状态是正确的。运行以下命令：

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw
npm run build:d
```

**期望**：编译成功，`dist/js/` 下有 `background.js` 和 `content.js`。如果失败，请先排查问题后再继续。

---

## 任务 1：创建 `src/capture/consts.ts`（常量定义）

### 目标

创建常量文件，定义 aiClaw 内部通信所需的存储键名、消息类型枚举，以及需要监控的三个平台的 URL 匹配模式。

### 操作

1. 创建目录 `src/capture/`（如果不存在）：

```bash
mkdir -p /Users/wesley/aiwithblockchain/aihub/aiClaw/src/capture
```

2. 创建文件 `src/capture/consts.ts`，完整内容如下：

```typescript
/**
 * consts.ts - aiClaw 常量定义
 *
 * 定义存储键名、消息类型、平台相关常量。
 */

// ── chrome.storage.local 中使用的键名 ──
export const STORAGE_KEY_CREDENTIALS = 'ac_credentials';  // 存储各平台凭证

// ── 扩展内部消息类型 ──
export enum MsgType {
    PING = 'AC_PING',
    CAPTURED_CREDENTIALS = 'AC_CAPTURED_CREDENTIALS',
    EXECUTE_TASK = 'AC_EXECUTE_TASK',
    TASK_RESULT = 'AC_TASK_RESULT',
}

// ── 平台类型 ──
export type PlatformType = 'chatgpt' | 'gemini' | 'grok';

// ── injection → content 的 postMessage source 标识 ──
export const INJECTION_SOURCE = 'aiclaw-injection';

// ── 平台 URL 匹配规则 ──
// 用于 injection.ts 判断当前拦截到的 fetch 请求属于哪个平台的 API
export const PLATFORM_API_PATTERNS: Record<PlatformType, RegExp[]> = {
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
 * 检测一个请求 URL 是否是我们需要关注的 AI 平台 API 调用。
 * 如果匹配，返回平台名称；否则返回 null。
 */
export function detectPlatformFromUrl(url: string): PlatformType | null {
    for (const [platform, patterns] of Object.entries(PLATFORM_API_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(url)) {
                return platform as PlatformType;
            }
        }
    }
    return null;
}

/**
 * 根据 hostname 检测当前页面所在的平台。
 */
export function detectPlatformFromHostname(hostname: string): PlatformType | null {
    if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
        return 'chatgpt';
    }
    if (hostname.includes('gemini.google.com')) {
        return 'gemini';
    }
    if (hostname.includes('grok.com') || hostname.includes('x.com')) {
        return 'grok';
    }
    return null;
}
```

### 自我验收

运行以下命令确认文件已正确创建且无语法错误：

```bash
# 确认文件存在
test -f /Users/wesley/aiwithblockchain/aihub/aiClaw/src/capture/consts.ts && echo "✅ consts.ts exists" || echo "❌ consts.ts missing"

# 确认包含关键导出
grep -c "export" /Users/wesley/aiwithblockchain/aihub/aiClaw/src/capture/consts.ts
```

**期望**：文件存在，grep 输出应 ≥ 6（至少 6 个 export 语句）。

**验收通过后，进入任务 2。**

---

## 任务 2：创建 `src/capture/injection.ts`（MAIN world fetch hook）

### 目标

创建 injection 脚本，它会运行在页面的 MAIN world（与页面 JS 共享上下文），负责：
1. Hook `window.fetch`，拦截 AI 平台的 API 请求
2. 从请求头中提取 `Authorization: Bearer xxx`
3. 通过 `window.postMessage` 将捕获的信息发送给 content script

### 重要概念说明

- **MAIN world**：injection.ts 编译后的 `injection.js` 会被注入到页面的主 JS 执行环境中。这意味着它能访问页面的 `window.fetch`，从而拦截页面发出的真实 API 请求。
- **ISOLATED world**：content script（main_entrance.ts）运行在独立的 JS 环境中，**无法直接访问**页面的 `window.fetch`。
- injection.ts 和 content script 之间通过 `window.postMessage` 通信。

### 操作

创建文件 `src/capture/injection.ts`，完整内容如下：

```typescript
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

            if (hdrs instanceof Headers) {
                auth = hdrs.get('authorization') || hdrs.get('Authorization');
            } else if (Array.isArray(hdrs)) {
                const pair = hdrs.find((h: any) =>
                    (typeof h[0] === 'string') && h[0].toLowerCase() === 'authorization'
                );
                if (pair) auth = pair[1];
            } else if (typeof hdrs === 'object') {
                auth = hdrs['authorization'] || hdrs['Authorization'] || null;
            }

            return (auth && auth.startsWith('Bearer ')) ? auth : null;
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
        if ((window as any).__ac_fetch_patched) return;

        const originalFetch = window.fetch;
        if (!originalFetch) {
            console.warn(`${TAG} ❌ Native fetch not found!`);
            return;
        }

        window.fetch = async function (...args: any[]) {
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
                return originalFetch.apply(this, args as any);
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
            } catch {}

            // 发送给 content script
            postCapture(platform, url, method, bearer, headers, body);

            // 放行原始请求，不干扰正常功能
            try {
                return await originalFetch.apply(this, args as any);
            } catch (e) {
                console.error(`${TAG} Fetch error [${platform}]:`, e);
                throw e;
            }
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
                this._ac_url = url;
                this._ac_method = method;
                this._ac_platform = detectPlatform(url);
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
```

### 自我验收

```bash
# 确认文件存在
test -f /Users/wesley/aiwithblockchain/aihub/aiClaw/src/capture/injection.ts && echo "✅ injection.ts exists" || echo "❌ injection.ts missing"

# 确认包含关键函数
grep -c "patchFetch\|patchXHR\|postCapture\|detectPlatform\|extractBearer" /Users/wesley/aiwithblockchain/aihub/aiClaw/src/capture/injection.ts
```

**期望**：文件存在，grep 输出应 ≥ 10（这些关键函数名在定义和调用处都会出现）。

**验收通过后，进入任务 3。**

---

## 任务 3：更新 `webpack.config.js`，添加 injection 入口

### 目标

在 webpack 配置中增加 `injection` 入口点，使其编译后输出到 `dist/js/injection.js`。

### 操作

打开 `/Users/wesley/aiwithblockchain/aihub/aiClaw/webpack.config.js`，将整个文件内容**替换**为以下内容：

```javascript
const path = require('path');

module.exports = (env, argv) => {
    const mode = argv.mode || 'development';

    return {
        mode,
        devtool: mode === 'development' ? 'inline-source-map' : false,
        entry: {
            background: path.resolve(__dirname, 'src/service_work/background.ts'),
            content: path.resolve(__dirname, 'src/content/main_entrance.ts'),
            injection: path.resolve(__dirname, 'src/capture/injection.ts'),
        },
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'js/[name].js',
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
            ],
        },
        resolve: {
            extensions: ['.ts', '.js'],
        },
    };
};
```

**变更说明**：唯一的改动是在 `entry` 中增加了一行：

```javascript
injection: path.resolve(__dirname, 'src/capture/injection.ts'),
```

### 自我验收

```bash
# 确认 webpack.config.js 包含 injection 入口
grep "injection" /Users/wesley/aiwithblockchain/aihub/aiClaw/webpack.config.js
```

**期望**：输出包含 `injection: path.resolve(__dirname, 'src/capture/injection.ts')`。

**验收通过后，进入任务 4。**

---

## 任务 4：更新 `dist/manifest.json`，添加 `web_accessible_resources` 和 `webRequest` 权限

### 目标

1. 添加 `web_accessible_resources` 配置，允许 content script 将 `js/injection.js` 注入到页面中。
2. 添加 `webRequest` 权限，允许 background 拦截网络请求。
3. 将 content_scripts 的 `run_at` 从 `document_idle` 改为 `document_start`，确保 injection 脚本能在页面加载早期注入，以尽早 hook fetch。

### 操作

打开 `/Users/wesley/aiwithblockchain/aihub/aiClaw/dist/manifest.json`，将整个文件内容**替换**为以下内容：

```json
{
  "manifest_version": 3,
  "name": "aiClaw",
  "version": "0.1.0",
  "description": "aiClaw: Browser agent hub for ChatGPT, Gemini, and Grok.",
  "background": {
    "service_worker": "js/background.js"
  },
  "icons": {
    "16": "images/logo_16.png",
    "48": "images/logo_48.png",
    "128": "images/logo_128.png"
  },
  "content_scripts": [
    {
      "matches": [
        "https://chatgpt.com/*",
        "https://chat.openai.com/*"
      ],
      "js": [
        "js/content.js"
      ],
      "run_at": "document_start"
    },
    {
      "matches": [
        "https://gemini.google.com/*"
      ],
      "js": [
        "js/content.js"
      ],
      "run_at": "document_start"
    },
    {
      "matches": [
        "https://grok.com/*",
        "https://x.com/i/grok*"
      ],
      "js": [
        "js/content.js"
      ],
      "run_at": "document_start"
    }
  ],
  "permissions": [
    "storage",
    "tabs",
    "activeTab",
    "webRequest"
  ],
  "host_permissions": [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://gemini.google.com/*",
    "https://grok.com/*",
    "https://x.com/i/grok*",
    "ws://localhost/*",
    "ws://127.0.0.1/*"
  ],
  "web_accessible_resources": [
    {
      "resources": [
        "js/injection.js"
      ],
      "matches": [
        "https://chatgpt.com/*",
        "https://chat.openai.com/*",
        "https://gemini.google.com/*",
        "https://grok.com/*",
        "https://x.com/*"
      ]
    }
  ]
}
```

**变更说明（共 3 处改动）**：

1. 所有 `content_scripts` 的 `run_at` 从 `"document_idle"` 改为 `"document_start"`
2. `permissions` 数组中新增 `"webRequest"`
3. 新增整个 `web_accessible_resources` 字段，允许 `injection.js` 在匹配的域名中被访问

### 自我验收

```bash
# 确认包含 web_accessible_resources
grep "web_accessible_resources" /Users/wesley/aiwithblockchain/aihub/aiClaw/dist/manifest.json

# 确认包含 injection.js
grep "injection.js" /Users/wesley/aiwithblockchain/aihub/aiClaw/dist/manifest.json

# 确认包含 webRequest 权限
grep "webRequest" /Users/wesley/aiwithblockchain/aihub/aiClaw/dist/manifest.json

# 确认 run_at 是 document_start
grep "document_start" /Users/wesley/aiwithblockchain/aihub/aiClaw/dist/manifest.json
```

**期望**：所有 4 个 grep 都有输出。

**验收通过后，进入任务 5。**

---

## 任务 5：重写 `src/content/main_entrance.ts`（注入 injection.js + 消息中继）

### 目标

重写 content script，新增两个核心职责：
1. 将 `injection.js` 注入到页面的 MAIN world 中
2. 监听 injection.ts 通过 `window.postMessage` 发来的消息，并转发给 background

同时保留之前的平台检测和启动日志。

### 操作

打开 `/Users/wesley/aiwithblockchain/aihub/aiClaw/src/content/main_entrance.ts`，将整个文件内容**替换**为以下内容：

```typescript
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
```

### 自我验收

```bash
# 确认文件包含 injection 注入逻辑
grep "ac_injection" /Users/wesley/aiwithblockchain/aihub/aiClaw/src/content/main_entrance.ts

# 确认文件包含 postMessage 监听
grep "addEventListener.*message" /Users/wesley/aiwithblockchain/aihub/aiClaw/src/content/main_entrance.ts

# 确认文件导入了 consts
grep "import.*consts" /Users/wesley/aiwithblockchain/aihub/aiClaw/src/content/main_entrance.ts
```

**期望**：所有 3 个 grep 都有输出。

**验收通过后，进入任务 6。**

---

## 任务 6：重写 `src/service_work/background.ts`（凭证存储 + 状态管理）

### 目标

重写 background service worker，新增以下核心功能：
1. 接收 content script 转发的凭证捕获消息，存入 `chrome.storage.local`
2. 提供凭证查询接口
3. 监听 webRequest 被动捕获 Bearer Token（全局级别，作为 injection 的补充）
4. 记录每个平台的 hook 状态

### 操作

打开 `/Users/wesley/aiwithblockchain/aihub/aiClaw/src/service_work/background.ts`，将整个文件内容**替换**为以下内容：

```typescript
/**
 * background.ts - aiClaw Background Service Worker (Phase 1)
 *
 * 职责：
 *   1. 接收并存储从 content script 转发来的凭证数据
 *   2. 提供凭证查询接口（供未来的任务执行模块使用）
 *   3. 通过 webRequest 被动捕获 Bearer Token（全局补充拦截）
 *   4. 管理 hook 状态
 *
 * 架构层级：Layer 3（Service Worker）
 */

import { STORAGE_KEY_CREDENTIALS, MsgType } from '../capture/consts';
import type { PlatformType } from '../capture/consts';

// ── 凭证数据结构 ──

interface PlatformCredentials {
    bearerToken: string | null;
    apiEndpoint: string | null;
    lastCapturedHeaders: Record<string, string>;
    lastCapturedAt: number;       // 时间戳
    captureCount: number;         // 累计捕获次数
}

interface AllCredentials {
    chatgpt: PlatformCredentials;
    gemini: PlatformCredentials;
    grok: PlatformCredentials;
}

// ── hook 状态 ──

interface HookStatusMap {
    [tabId: number]: {
        fetch: boolean;
        xhr: boolean;
        lastReport: number;
    };
}

let hookStatusMap: HookStatusMap = {};

// ── 默认空凭证 ──

function emptyCredentials(): PlatformCredentials {
    return {
        bearerToken: null,
        apiEndpoint: null,
        lastCapturedHeaders: {},
        lastCapturedAt: 0,
        captureCount: 0,
    };
}

function defaultAllCredentials(): AllCredentials {
    return {
        chatgpt: emptyCredentials(),
        gemini: emptyCredentials(),
        grok: emptyCredentials(),
    };
}

// ── 凭证存储操作 ──

async function loadCredentials(): Promise<AllCredentials> {
    const res = await chrome.storage.local.get(STORAGE_KEY_CREDENTIALS);
    return res[STORAGE_KEY_CREDENTIALS] || defaultAllCredentials();
}

async function saveCredentials(creds: AllCredentials): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY_CREDENTIALS]: creds });
}

async function updatePlatformCredentials(
    platform: PlatformType,
    bearerToken: string | null,
    apiUrl: string | null,
    headers: Record<string, string>
): Promise<void> {
    const creds = await loadCredentials();
    const pc = creds[platform];

    // 只有新值非空时才更新（防止覆盖已有值）
    if (bearerToken) {
        pc.bearerToken = bearerToken;
    }
    if (apiUrl) {
        pc.apiEndpoint = apiUrl;
    }
    if (Object.keys(headers).length > 0) {
        pc.lastCapturedHeaders = headers;
    }

    pc.lastCapturedAt = Date.now();
    pc.captureCount += 1;

    creds[platform] = pc;
    await saveCredentials(creds);

    // 打印日志
    const tokenPreview = pc.bearerToken
        ? `${pc.bearerToken.substring(0, 25)}...`
        : 'null';
    console.log(
        `%c[aiClaw-BG] 🔐 Credentials updated for %c${platform}%c | Token: ${tokenPreview} | Count: ${pc.captureCount}`,
        'color: #718096',
        'color: #4ade80; font-weight: bold',
        'color: #718096'
    );
}

// ── 扩展安装/更新事件 ──

chrome.runtime.onInstalled.addListener(async () => {
    console.log(
        '%c[aiClaw-BG] 🚀 Extension installed/updated.',
        'color: #60a5fa; font-weight: bold; font-size: 13px;'
    );

    // 初始化凭证存储（如果不存在）
    const existing = await chrome.storage.local.get(STORAGE_KEY_CREDENTIALS);
    if (!existing[STORAGE_KEY_CREDENTIALS]) {
        await saveCredentials(defaultAllCredentials());
        console.log('[aiClaw-BG] 📦 Credential store initialized.');
    }
});

// ── 消息中枢 ──

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // 1. 凭证捕获消息（来自 content script 中继）
    if (message.type === MsgType.CAPTURED_CREDENTIALS) {
        const { platform, bearerToken, apiUrl, requestHeaders } = message;

        if (platform && (platform === 'chatgpt' || platform === 'gemini' || platform === 'grok')) {
            updatePlatformCredentials(
                platform as PlatformType,
                bearerToken || null,
                apiUrl || null,
                requestHeaders || {}
            );
        }
        return;  // 无需 sendResponse
    }

    // 2. Hook 状态上报
    if (message.type === 'AC_HOOK_STATUS') {
        const tabId = sender.tab?.id;
        if (tabId) {
            hookStatusMap[tabId] = {
                fetch: message.status?.fetch || false,
                xhr: message.status?.xhr || false,
                lastReport: Date.now(),
            };
        }
        return;
    }

    // 3. 查询某平台的凭证（供未来任务执行模块使用）
    if (message.type === 'AC_GET_CREDENTIALS') {
        const platform = message.platform as PlatformType;
        loadCredentials().then(creds => {
            if (platform && creds[platform]) {
                sendResponse({ ok: true, credentials: creds[platform] });
            } else {
                sendResponse({ ok: false, error: `Unknown platform: ${platform}` });
            }
        });
        return true;  // 异步 sendResponse
    }

    // 4. 查询所有平台的凭证状态摘要（调试用）
    if (message.type === 'AC_GET_ALL_STATUS') {
        loadCredentials().then(creds => {
            const summary: Record<string, any> = {};
            for (const [p, c] of Object.entries(creds)) {
                summary[p] = {
                    hasToken: !!c.bearerToken,
                    tokenPreview: c.bearerToken ? c.bearerToken.substring(0, 20) + '...' : null,
                    apiEndpoint: c.apiEndpoint,
                    lastCapturedAt: c.lastCapturedAt ? new Date(c.lastCapturedAt).toISOString() : null,
                    captureCount: c.captureCount,
                };
            }
            sendResponse({ ok: true, summary, hookStatus: hookStatusMap });
        });
        return true;  // 异步 sendResponse
    }

    return false;
});

// ── 全局 webRequest 拦截：被动捕获 Bearer Token ──
// 这是对 injection.ts fetch hook 的补充：即使 injection 没有捕获到，
// webRequest 也能从请求头中拿到 Bearer Token。

const AI_PLATFORM_URL_PATTERNS = [
    'https://chatgpt.com/backend-api/*',
    'https://chat.openai.com/backend-api/*',
    'https://gemini.google.com/*',
    'https://grok.com/rest/*',
];

chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        const headers = details.requestHeaders || [];
        const authHeader = headers.find(
            h => h.name.toLowerCase() === 'authorization'
        );

        if (authHeader?.value?.startsWith('Bearer ')) {
            const url = details.url;
            let platform: PlatformType | null = null;

            if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) {
                platform = 'chatgpt';
            } else if (url.includes('gemini.google.com')) {
                platform = 'gemini';
            } else if (url.includes('grok.com') || url.includes('x.com')) {
                platform = 'grok';
            }

            if (platform) {
                updatePlatformCredentials(platform, authHeader.value, url, {});
                console.log(
                    `%c[aiClaw-BG] 🌐 WebRequest captured Bearer for ${platform}`,
                    'color: #60a5fa'
                );
            }
        }

        return { requestHeaders: headers } as chrome.webRequest.BlockingResponse;
    },
    { urls: AI_PLATFORM_URL_PATTERNS },
    ['requestHeaders']
);

// ── tab 关闭时清理 hook 状态 ──

chrome.tabs.onRemoved.addListener((tabId) => {
    delete hookStatusMap[tabId];
});

// ── 启动日志 ──

console.log(
    '%c[aiClaw-BG] 🚀 Background service worker started.',
    'color: #60a5fa; font-weight: bold; font-size: 13px;'
);
```

### 自我验收

```bash
# 确认文件包含凭证存储逻辑
grep "updatePlatformCredentials" /Users/wesley/aiwithblockchain/aihub/aiClaw/src/service_work/background.ts

# 确认文件包含 CAPTURED_CREDENTIALS 消息处理
grep "CAPTURED_CREDENTIALS" /Users/wesley/aiwithblockchain/aihub/aiClaw/src/service_work/background.ts

# 确认文件包含 webRequest 拦截
grep "webRequest" /Users/wesley/aiwithblockchain/aihub/aiClaw/src/service_work/background.ts

# 确认文件导入了 consts
grep "import.*consts" /Users/wesley/aiwithblockchain/aihub/aiClaw/src/service_work/background.ts
```

**期望**：所有 4 个 grep 都有输出。

**验收通过后，进入任务 7。**

---

## 任务 7：编译并验证

### 目标

确保所有新增和修改的代码能通过 webpack 编译，且编译产物正确。

### 操作

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw
npm run build:d
```

### 自我验收

1. **编译必须成功**，exit code 为 0，无 error 输出（warning 可以忽略）。

2. 检查编译产物：

```bash
echo "--- 检查编译产物 ---"
test -f dist/js/background.js && echo "✅ background.js exists" || echo "❌ background.js missing"
test -f dist/js/content.js && echo "✅ content.js exists" || echo "❌ content.js missing"
test -f dist/js/injection.js && echo "✅ injection.js exists" || echo "❌ injection.js missing"
```

**期望**：三个文件都显示 ✅。

3. 检查关键代码是否在编译产物中：

```bash
echo "--- 检查 injection.js 中的关键字符串 ---"
grep -c "aiclaw-injection" dist/js/injection.js && echo "✅ injection source tag found" || echo "❌ injection source tag missing"
grep -c "__ac_fetch_patched" dist/js/injection.js && echo "✅ fetch hook flag found" || echo "❌ fetch hook flag missing"

echo "--- 检查 content.js 中的关键字符串 ---"
grep -c "ac_injection" dist/js/content.js && echo "✅ injection loading logic found" || echo "❌ injection loading logic missing"
grep -c "CREDENTIALS_CAPTURED" dist/js/content.js && echo "✅ credential relay found" || echo "❌ credential relay missing"

echo "--- 检查 background.js 中的关键字符串 ---"
grep -c "ac_credentials" dist/js/background.js && echo "✅ credential storage key found" || echo "❌ credential storage key missing"
grep -c "webRequest" dist/js/background.js && echo "✅ webRequest logic found" || echo "❌ webRequest logic missing"
```

**期望**：所有项目都显示 ✅。

4. 检查 `dist/manifest.json` 是否完整：

```bash
echo "--- 检查 manifest.json ---"
grep -c "web_accessible_resources" dist/manifest.json && echo "✅ web_accessible_resources found" || echo "❌ missing"
grep -c "webRequest" dist/manifest.json && echo "✅ webRequest permission found" || echo "❌ missing"
grep -c "document_start" dist/manifest.json && echo "✅ document_start found" || echo "❌ missing"
```

**期望**：所有项目都显示 ✅。

**如果编译失败**，请仔细阅读错误信息：
- 如果是 TypeScript 类型错误，检查 `import` 路径是否正确
- 如果是 "Module not found"，检查文件是否在正确的路径
- 修复错误后重新运行 `npm run build:d`

**验收通过后，进入任务 8。**

---

## 任务 8：总体自检

### 目标

对 Phase 1 的全部工作做一次完整自检，确认一切就绪。

### 自检步骤

#### 8.1 文件完整性检查

运行以下命令，确认所有必要文件都存在：

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw

echo "=== 源码文件 ==="
test -f src/capture/consts.ts && echo "✅ src/capture/consts.ts" || echo "❌ src/capture/consts.ts"
test -f src/capture/injection.ts && echo "✅ src/capture/injection.ts" || echo "❌ src/capture/injection.ts"
test -f src/content/main_entrance.ts && echo "✅ src/content/main_entrance.ts" || echo "❌ src/content/main_entrance.ts"
test -f src/service_work/background.ts && echo "✅ src/service_work/background.ts" || echo "❌ src/service_work/background.ts"

echo ""
echo "=== 配置文件 ==="
test -f webpack.config.js && echo "✅ webpack.config.js" || echo "❌ webpack.config.js"
test -f dist/manifest.json && echo "✅ dist/manifest.json" || echo "❌ dist/manifest.json"
test -f package.json && echo "✅ package.json" || echo "❌ package.json"
test -f tsconfig.json && echo "✅ tsconfig.json" || echo "❌ tsconfig.json"

echo ""
echo "=== 编译产物 ==="
test -f dist/js/background.js && echo "✅ dist/js/background.js" || echo "❌ dist/js/background.js"
test -f dist/js/content.js && echo "✅ dist/js/content.js" || echo "❌ dist/js/content.js"
test -f dist/js/injection.js && echo "✅ dist/js/injection.js" || echo "❌ dist/js/injection.js"
```

**期望**：所有 11 项都显示 ✅。

#### 8.2 编译验证

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw
npm run build:d 2>&1 | tail -5
```

**期望**：最后几行应包含 `successfully` 或 `compiled` 字样，exit code 为 0。

#### 8.3 三层架构通信链路逻辑检查

逐个验证三层的关键代码路径是否衔接正确：

```bash
echo "=== 链路 1：injection.ts → postMessage ==="
grep "window.postMessage" src/capture/injection.ts | head -3
echo ""

echo "=== 链路 2：main_entrance.ts 监听 postMessage → chrome.runtime.sendMessage ==="
grep "addEventListener.*message" src/content/main_entrance.ts
grep "chrome.runtime.sendMessage" src/content/main_entrance.ts | head -3
echo ""

echo "=== 链路 3：background.ts 监听 chrome.runtime.onMessage → 存储凭证 ==="
grep "onMessage.addListener" src/service_work/background.ts
grep "updatePlatformCredentials" src/service_work/background.ts | head -3
echo ""

echo "=== 链路 4：postMessage source 标识一致性 ==="
echo "injection.ts 中的 source 值:"
grep "source:" src/capture/injection.ts | head -1
echo "main_entrance.ts 中的 source 检查值:"
grep "INJECTION_SOURCE" src/content/main_entrance.ts | head -1
echo "consts.ts 中 INJECTION_SOURCE 的定义:"
grep "INJECTION_SOURCE" src/capture/consts.ts
```

**期望**：
- 链路 1：能看到 `window.postMessage({source: 'aiclaw-injection', ...`
- 链路 2：能看到 `addEventListener('message'` 和 `chrome.runtime.sendMessage`
- 链路 3：能看到 `onMessage.addListener` 和 `updatePlatformCredentials`
- 链路 4：injection.ts 中的 `source: 'aiclaw-injection'` 应与 consts.ts 中的 `INJECTION_SOURCE = 'aiclaw-injection'` 一致

#### 8.4 manifest.json 关键配置检查

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw

echo "=== content_scripts 匹配域名 ==="
grep -A2 '"matches"' dist/manifest.json

echo ""
echo "=== web_accessible_resources ==="
grep -A10 "web_accessible_resources" dist/manifest.json

echo ""
echo "=== permissions ==="
grep -A6 '"permissions"' dist/manifest.json
```

**期望**：
- `matches` 中包含 `chatgpt.com`、`gemini.google.com`、`grok.com`
- `web_accessible_resources` 中包含 `js/injection.js`
- `permissions` 中包含 `storage`、`tabs`、`activeTab`、`webRequest`

#### 8.5 自检结果汇总

如果以上 8.1 ~ 8.4 全部通过，请输出以下总结：

```
═══════════════════════════════════════════
   Phase 1 自检结果：全部通过 ✅
═══════════════════════════════════════════

完成的工作：
1. ✅ src/capture/consts.ts - 常量、类型、平台匹配工具函数
2. ✅ src/capture/injection.ts - MAIN world fetch/XHR hook
3. ✅ webpack.config.js - 添加 injection 入口
4. ✅ dist/manifest.json - 添加 web_accessible_resources + webRequest + document_start
5. ✅ src/content/main_entrance.ts - 注入 injection.js + 消息中继
6. ✅ src/service_work/background.ts - 凭证存储 + webRequest 补充拦截
7. ✅ 编译通过，三个 JS 产物完整

下一步：在浏览器中加载扩展，打开 ChatGPT 并正常发一条消息，
检查 service worker console 是否出现凭证捕获日志。
```

如果有任何一项失败，请指出失败项并尝试修复后重新验证。

---

## 附录：Phase 1 完成后的项目结构

```
aiClaw/
├── doc/
│   └── ARCHITECTURE.md            ← 技术架构文档
├── src/
│   ├── capture/
│   │   ├── consts.ts              ← [新增] 常量定义
│   │   └── injection.ts           ← [新增] MAIN world fetch hook
│   ├── content/
│   │   └── main_entrance.ts       ← [重写] 注入 + 消息中继
│   └── service_work/
│       └── background.ts          ← [重写] 凭证存储 + webRequest
├── dist/
│   ├── manifest.json              ← [修改] 添加 web_accessible_resources
│   ├── images/
│   ├── vendor/
│   └── js/
│       ├── background.js          ← webpack 产物
│       ├── content.js             ← webpack 产物
│       └── injection.js           ← webpack 产物 [新增]
├── tests/
│   └── unit/
├── package.json
├── package-lock.json
├── tsconfig.json
├── vitest.config.ts
├── webpack.config.js              ← [修改] 添加 injection 入口
├── bump_version.sh
├── zip.sh
├── README.md
└── task.md
```
