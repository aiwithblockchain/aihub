/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/adapters/base-adapter.ts"
/*!**************************************!*\
  !*** ./src/adapters/base-adapter.ts ***!
  \**************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BasePlatformAdapter: () => (/* binding */ BasePlatformAdapter)
/* harmony export */ });
// src/adapters/base-adapter.ts
class BasePlatformAdapter {
}


/***/ },

/***/ "./src/adapters/chatgpt-adapter.ts"
/*!*****************************************!*\
  !*** ./src/adapters/chatgpt-adapter.ts ***!
  \*****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ChatGptAdapter: () => (/* binding */ ChatGptAdapter)
/* harmony export */ });
/* harmony import */ var _base_adapter__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./base-adapter */ "./src/adapters/base-adapter.ts");
/* harmony import */ var _utils_sse_parser__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/sse-parser */ "./src/utils/sse-parser.ts");
/* harmony import */ var _service_work_background__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../service_work/background */ "./src/service_work/background.ts");



class ChatGptAdapter extends _base_adapter__WEBPACK_IMPORTED_MODULE_0__.BasePlatformAdapter {
    constructor() {
        super(...arguments);
        this.platform = 'chatgpt';
    }
    isTargetApiUrl(url) {
        return url.includes('chatgpt.com/backend-api/conversation');
    }
    extractCredentials(url, requestHeaders, responseBody) {
        const credentials = {};
        if (requestHeaders['authorization']) {
            credentials.bearerToken = requestHeaders['authorization'];
        }
        credentials.apiEndpoint = url;
        return credentials;
    }
    async sendMessage(request, credentials) {
        if (!credentials.bearerToken) {
            return {
                success: false,
                error: 'Bearer token not found',
                content: '',
            };
        }
        if (!credentials.apiEndpoint) {
            return {
                success: false,
                error: 'API endpoint not found',
                content: '',
            };
        }
        const headers = {
            ...credentials.extraHeaders,
            'Content-Type': 'application/json',
            Authorization: credentials.bearerToken,
        };
        const body = {
            action: 'next',
            messages: [
                {
                    author: { role: 'user' },
                    content: { content_type: 'text', parts: [request.prompt] },
                },
            ],
            parent_message_id: request.parentMessageId || this.generateUuid(),
            model: request.model || 'text-davinci-002-render-sha',
            conversation_id: request.conversationId,
        };
        try {
            const response = await fetch(credentials.apiEndpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            if (response.status === 401) {
                await (0,_service_work_background__WEBPACK_IMPORTED_MODULE_2__.clearPlatformCredentials)('chatgpt');
                return {
                    success: false,
                    error: 'API request failed with status 401: Unauthorized. Credentials have been cleared.',
                    content: '',
                };
            }
            if (!response.ok) {
                return {
                    success: false,
                    error: `API request failed with status ${response.status}`,
                    content: '',
                    rawResponse: await response.text(),
                };
            }
            const sseParser = new _utils_sse_parser__WEBPACK_IMPORTED_MODULE_1__.SseParser();
            let fullContent = '';
            let conversationId;
            let messageId;
            await sseParser.parse(response, (data) => {
                if (data.message?.content?.parts) {
                    fullContent = data.message.content.parts[0];
                }
                if (data.conversation_id) {
                    conversationId = data.conversation_id;
                }
                if (data.message?.id) {
                    messageId = data.message.id;
                }
            });
            return {
                success: true,
                content: fullContent,
                conversationId,
                messageId,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                content: '',
            };
        }
    }
    generateUuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }
}


/***/ },

/***/ "./src/capture/consts.ts"
/*!*******************************!*\
  !*** ./src/capture/consts.ts ***!
  \*******************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   INJECTION_SOURCE: () => (/* binding */ INJECTION_SOURCE),
/* harmony export */   MsgType: () => (/* binding */ MsgType),
/* harmony export */   PLATFORM_API_PATTERNS: () => (/* binding */ PLATFORM_API_PATTERNS),
/* harmony export */   STORAGE_KEY_CREDENTIALS: () => (/* binding */ STORAGE_KEY_CREDENTIALS),
/* harmony export */   detectPlatformFromHostname: () => (/* binding */ detectPlatformFromHostname),
/* harmony export */   detectPlatformFromUrl: () => (/* binding */ detectPlatformFromUrl)
/* harmony export */ });
/**
 * consts.ts - aiClaw 常量定义
 *
 * 定义存储键名、消息类型、平台相关常量。
 */
// ── chrome.storage.local 中使用的键名 ──
const STORAGE_KEY_CREDENTIALS = 'ac_credentials'; // 存储各平台凭证
// ── 扩展内部消息类型 ──
var MsgType;
(function (MsgType) {
    MsgType["PING"] = "AC_PING";
    MsgType["CAPTURED_CREDENTIALS"] = "AC_CAPTURED_CREDENTIALS";
    MsgType["EXECUTE_TASK"] = "AC_EXECUTE_TASK";
    MsgType["TASK_RESULT"] = "AC_TASK_RESULT";
    MsgType["AC_SEND_TEST_MESSAGE"] = "AC_SEND_TEST_MESSAGE";
})(MsgType || (MsgType = {}));
// ── injection → content 的 postMessage source 标识 ──
const INJECTION_SOURCE = 'aiclaw-injection';
// ── 平台 URL 匹配规则 ──
// 用于 injection.ts 判断当前拦截到的 fetch 请求属于哪个平台的 API
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
 * 检测一个请求 URL 是否是我们需要关注的 AI 平台 API 调用。
 * 如果匹配，返回平台名称；否则返回 null。
 */
function detectPlatformFromUrl(url) {
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
 * 根据 hostname 检测当前页面所在的平台。
 */
function detectPlatformFromHostname(hostname) {
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


/***/ },

/***/ "./src/service_work/background.ts"
/*!****************************************!*\
  !*** ./src/service_work/background.ts ***!
  \****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   clearPlatformCredentials: () => (/* binding */ clearPlatformCredentials)
/* harmony export */ });
/* harmony import */ var _capture_consts__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../capture/consts */ "./src/capture/consts.ts");
/* harmony import */ var _adapters_chatgpt_adapter__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../adapters/chatgpt-adapter */ "./src/adapters/chatgpt-adapter.ts");
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


let hookStatusMap = {};
// ── 默认空凭证 ──
function emptyCredentials() {
    return {
        bearerToken: null,
        apiEndpoint: null,
        lastCapturedHeaders: {},
        lastCapturedAt: 0,
        captureCount: 0,
    };
}
function defaultAllCredentials() {
    return {
        chatgpt: emptyCredentials(),
        gemini: emptyCredentials(),
        grok: emptyCredentials(),
    };
}
// ── 凭证存储操作 ──
async function loadCredentials() {
    const res = await chrome.storage.local.get(_capture_consts__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEY_CREDENTIALS);
    const creds = res[_capture_consts__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEY_CREDENTIALS];
    if (creds && typeof creds === 'object' && 'chatgpt' in creds && 'gemini' in creds && 'grok' in creds) {
        return creds;
    }
    return defaultAllCredentials();
}
async function saveCredentials(creds) {
    await chrome.storage.local.set({ [_capture_consts__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEY_CREDENTIALS]: creds });
}
async function updatePlatformCredentials(platform, bearerToken, apiUrl, headers) {
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
    console.log(`%c[aiClaw-BG] 🔐 Credentials updated for %c${platform}%c | Token: ${tokenPreview} | Count: ${pc.captureCount}`, 'color: #718096', 'color: #4ade80; font-weight: bold', 'color: #718096');
}
async function clearPlatformCredentials(platform) {
    const creds = await loadCredentials();
    creds[platform].bearerToken = null;
    creds[platform].apiEndpoint = null;
    await saveCredentials(creds);
    console.log(`[aiClaw-BG] 🗑️ Cleared credentials for ${platform}`);
}
// ── 扩展安装/更新事件 ──
chrome.runtime.onInstalled.addListener(async () => {
    console.log('%c[aiClaw-BG] 🚀 Extension installed/updated.', 'color: #60a5fa; font-weight: bold; font-size: 13px;');
    // 初始化凭证存储（如果不存在）
    const existing = await chrome.storage.local.get(_capture_consts__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEY_CREDENTIALS);
    if (!existing[_capture_consts__WEBPACK_IMPORTED_MODULE_0__.STORAGE_KEY_CREDENTIALS]) {
        await saveCredentials(defaultAllCredentials());
        console.log('[aiClaw-BG] 📦 Credential store initialized.');
    }
});
// ── 消息中枢 ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 1. 凭证捕获消息（来自 content script 中继）
    if (message.type === _capture_consts__WEBPACK_IMPORTED_MODULE_0__.MsgType.CAPTURED_CREDENTIALS) {
        const { platform, bearerToken, apiUrl, requestHeaders } = message;
        if (platform && (platform === 'chatgpt' || platform === 'gemini' || platform === 'grok')) {
            updatePlatformCredentials(platform, bearerToken || null, apiUrl || null, requestHeaders || {});
        }
        return; // 无需 sendResponse
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
        const platform = message.platform;
        loadCredentials().then(creds => {
            if (platform && creds[platform]) {
                sendResponse({ ok: true, credentials: creds[platform] });
            }
            else {
                sendResponse({ ok: false, error: `Unknown platform: ${platform}` });
            }
        });
        return true; // 异步 sendResponse
    }
    // 4. 查询所有平台的凭证状态摘要（调试用）
    if (message.type === 'AC_GET_ALL_STATUS') {
        loadCredentials().then(creds => {
            const summary = {};
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
        return true; // 异步 sendResponse
    }
    if (message.type === _capture_consts__WEBPACK_IMPORTED_MODULE_0__.MsgType.AC_SEND_TEST_MESSAGE) {
        console.log('[aiClaw-BG] Received test message request');
        loadCredentials().then(async (creds) => {
            const chatGptCreds = creds.chatgpt;
            if (chatGptCreds && chatGptCreds.bearerToken && chatGptCreds.apiEndpoint) {
                const adapter = new _adapters_chatgpt_adapter__WEBPACK_IMPORTED_MODULE_1__.ChatGptAdapter();
                const response = await adapter.sendMessage({ prompt: 'Hello, this is a test message.' }, chatGptCreds);
                console.log('[aiClaw-BG] Test message response:', response);
                sendResponse({ ok: true, response });
            }
            else {
                sendResponse({ ok: false, error: 'ChatGPT credentials not found' });
            }
        });
        return true;
    }
    if (message.type === _capture_consts__WEBPACK_IMPORTED_MODULE_0__.MsgType.TASK_RESULT) {
        wsClient.sendResult(message.result);
        wsClient.isExecutingTask = false;
        wsClient.executeNextTask();
        return; // No response needed
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
chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
    const headers = details.requestHeaders || [];
    const authHeader = headers.find(h => h.name.toLowerCase() === 'authorization');
    if (authHeader?.value?.startsWith('Bearer ')) {
        const url = details.url;
        let platform = null;
        if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) {
            platform = 'chatgpt';
        }
        else if (url.includes('gemini.google.com')) {
            platform = 'gemini';
        }
        else if (url.includes('grok.com') || url.includes('x.com')) {
            platform = 'grok';
        }
        if (platform) {
            updatePlatformCredentials(platform, authHeader.value, url, {});
            console.log(`%c[aiClaw-BG] 🌐 WebRequest captured Bearer for ${platform}`, 'color: #60a5fa');
        }
    }
    return { requestHeaders: headers };
}, { urls: AI_PLATFORM_URL_PATTERNS }, ['requestHeaders']);
// ── tab 关闭时清理 hook 状态 ──
chrome.tabs.onRemoved.addListener((tabId) => {
    delete hookStatusMap[tabId];
});
// ── WebSocket 客户端 ──
const LOCALBRIDGE_URL = 'ws://localhost:8765/ws/aiclaw';
class WebSocketClient {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.taskQueue = [];
        this.isExecutingTask = false;
        this.lastUsedTabIndex = new Map();
    }
    connect() {
        this.ws = new WebSocket(LOCALBRIDGE_URL);
        this.ws.onopen = () => {
            console.log('[aiClaw-BG] 🔌 WebSocket connected to localBridge');
            this.reconnectAttempts = 0;
            this.executeNextTask(); // Start executing tasks if any were queued while disconnected
        };
        this.ws.onmessage = (event) => {
            try {
                const task = JSON.parse(event.data);
                console.log('[aiClaw-BG] 📩 Received task from localBridge:', task);
                this.enqueueTask(task);
            }
            catch (e) {
                console.error('[aiClaw-BG] ❌ Error parsing task from localBridge:', e);
            }
        };
        this.ws.onclose = () => {
            console.log('[aiClaw-BG] 🔌 WebSocket disconnected from localBridge');
            this.reconnect();
        };
        this.ws.onerror = (err) => {
            console.error('[aiClaw-BG] ❌ WebSocket error:', err);
            // onclose will be called next, which will handle reconnect
        };
    }
    reconnect() {
        if (this.reconnectAttempts >= 30) {
            console.error('[aiClaw-BG] ❌ Too many reconnect attempts, giving up.');
            return;
        }
        const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts));
        this.reconnectAttempts++;
        console.log(`[aiClaw-BG] 🔌 Reconnecting WebSocket in ${delay / 1000}s...`);
        setTimeout(() => this.connect(), delay);
    }
    enqueueTask(task) {
        this.taskQueue.push(task);
        this.executeNextTask();
    }
    executeNextTask() {
        if (this.isExecutingTask || this.taskQueue.length === 0) {
            return;
        }
        this.isExecutingTask = true;
        const task = this.taskQueue.shift();
        this.dispatchTask(task);
    }
    getPlatformUrlPatterns(platform) {
        switch (platform) {
            case 'chatgpt':
                return ['https://chat.openai.com/*', 'https://chatgpt.com/*'];
            case 'gemini':
                return ['https://gemini.google.com/*'];
            case 'grok':
                return ['https://grok.com/*', 'https://x.com/i/grok*'];
        }
    }
    async dispatchTask(task) {
        if (!task.platform || !task.payload?.prompt) {
            console.error('[aiClaw-BG] ❌ Invalid task received:', task);
            this.isExecutingTask = false;
            this.executeNextTask();
            return;
        }
        const platform = task.platform;
        const urlPatterns = this.getPlatformUrlPatterns(platform);
        let tabs = [];
        for (const pattern of urlPatterns) {
            const matchingTabs = await chrome.tabs.query({ url: pattern });
            tabs = tabs.concat(matchingTabs);
        }
        if (tabs.length === 0) {
            console.error(`[aiClaw-BG] ❌ No active tab found for platform: ${platform}`);
            this.sendResult({ taskId: task.taskId, success: false, error: `No active tab found for platform: ${platform}` });
            this.isExecutingTask = false;
            this.executeNextTask();
            return;
        }
        const lastIndex = this.lastUsedTabIndex.get(platform) || -1;
        const nextIndex = (lastIndex + 1) % tabs.length;
        const tab = tabs[nextIndex];
        this.lastUsedTabIndex.set(platform, nextIndex);
        const tabId = tab.id;
        if (tabId) {
            try {
                await chrome.tabs.sendMessage(tabId, {
                    type: _capture_consts__WEBPACK_IMPORTED_MODULE_0__.MsgType.EXECUTE_TASK,
                    task: task,
                });
            }
            catch (e) {
                console.error(`[aiClaw-BG] ❌ Error sending task to tab ${tabId}:`, e);
                this.sendResult({ taskId: task.taskId, success: false, error: `Failed to send task to content script: ${e.message}` });
                this.isExecutingTask = false;
                this.executeNextTask();
            }
        }
    }
    sendResult(result) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(result));
        }
    }
}
const wsClient = new WebSocketClient();
wsClient.connect();
// ── Service Worker Keep-alive ──
chrome.alarms.create('keep-alive', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keep-alive') {
        // console.log('[aiClaw-BG] Keep-alive alarm triggered');
    }
});
// ── 启动日志 ──
console.log('%c[aiClaw-BG] 🚀 Background service worker started.', 'color: #60a5fa; font-weight: bold; font-size: 13px;');


/***/ },

/***/ "./src/utils/sse-parser.ts"
/*!*********************************!*\
  !*** ./src/utils/sse-parser.ts ***!
  \*********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SseParser: () => (/* binding */ SseParser)
/* harmony export */ });
// src/utils/sse-parser.ts
/**
 * A utility class for parsing Server-Sent Events (SSE) streams.
 * It handles the low-level details of reading from a ReadableStream,
 * decoding chunks, and parsing SSE message events.
 */
class SseParser {
    /**
     * Parses an SSE stream from a fetch response.
     *
     * @param response The fetch Response object.
     * @param onMessage A callback function that will be invoked for each SSE message event.
     * @returns A promise that resolves when the stream is fully consumed.
     */
    async parse(response, onMessage) {
        if (!response.body) {
            throw new Error('Response body is null');
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                if (buffer.length > 0) {
                    this.processBuffer(buffer, onMessage);
                }
                break;
            }
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            const lastNewline = buffer.lastIndexOf('\n');
            if (lastNewline !== -1) {
                const processable = buffer.substring(0, lastNewline);
                this.processBuffer(processable, onMessage);
                buffer = buffer.substring(lastNewline + 1);
            }
        }
    }
    processBuffer(buffer, onMessage) {
        const lines = buffer.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const dataStr = line.substring(6);
                if (dataStr === '[DONE]') {
                    return; // End of stream
                }
                try {
                    const data = JSON.parse(dataStr);
                    onMessage(data);
                }
                catch (e) {
                    // Ignore parsing errors for non-JSON data
                }
            }
        }
    }
}


/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/service_work/background.ts");
/******/ 	
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDRCQUE0QjtBQUM1QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7VUN6REE7VUFDQTs7VUFFQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTs7VUFFQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBOztVQUVBO1VBQ0E7VUFDQTs7Ozs7V0M1QkE7V0FDQTtXQUNBO1dBQ0E7V0FDQSx5Q0FBeUMsd0NBQXdDO1dBQ2pGO1dBQ0E7V0FDQSxFOzs7OztXQ1BBLHdGOzs7OztXQ0FBO1dBQ0E7V0FDQTtXQUNBLHVEQUF1RCxpQkFBaUI7V0FDeEU7V0FDQSxnREFBZ0QsYUFBYTtXQUM3RCxFOzs7OztVRU5BO1VBQ0E7VUFDQTtVQUNBIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vYWlDbGF3Ly4vc3JjL2FkYXB0ZXJzL2Jhc2UtYWRhcHRlci50cyIsIndlYnBhY2s6Ly9haUNsYXcvLi9zcmMvYWRhcHRlcnMvY2hhdGdwdC1hZGFwdGVyLnRzIiwid2VicGFjazovL2FpQ2xhdy8uL3NyYy9jYXB0dXJlL2NvbnN0cy50cyIsIndlYnBhY2s6Ly9haUNsYXcvLi9zcmMvc2VydmljZV93b3JrL2JhY2tncm91bmQudHMiLCJ3ZWJwYWNrOi8vYWlDbGF3Ly4vc3JjL3V0aWxzL3NzZS1wYXJzZXIudHMiLCJ3ZWJwYWNrOi8vYWlDbGF3L3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL2FpQ2xhdy93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vYWlDbGF3L3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vYWlDbGF3L3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vYWlDbGF3L3dlYnBhY2svYmVmb3JlLXN0YXJ0dXAiLCJ3ZWJwYWNrOi8vYWlDbGF3L3dlYnBhY2svc3RhcnR1cCIsIndlYnBhY2s6Ly9haUNsYXcvd2VicGFjay9hZnRlci1zdGFydHVwIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIHNyYy9hZGFwdGVycy9iYXNlLWFkYXB0ZXIudHNcbmV4cG9ydCBjbGFzcyBCYXNlUGxhdGZvcm1BZGFwdGVyIHtcbn1cbiIsImltcG9ydCB7IEJhc2VQbGF0Zm9ybUFkYXB0ZXIsIH0gZnJvbSAnLi9iYXNlLWFkYXB0ZXInO1xuaW1wb3J0IHsgU3NlUGFyc2VyIH0gZnJvbSAnLi4vdXRpbHMvc3NlLXBhcnNlcic7XG5pbXBvcnQgeyBjbGVhclBsYXRmb3JtQ3JlZGVudGlhbHMgfSBmcm9tICcuLi9zZXJ2aWNlX3dvcmsvYmFja2dyb3VuZCc7XG5leHBvcnQgY2xhc3MgQ2hhdEdwdEFkYXB0ZXIgZXh0ZW5kcyBCYXNlUGxhdGZvcm1BZGFwdGVyIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5wbGF0Zm9ybSA9ICdjaGF0Z3B0JztcbiAgICB9XG4gICAgaXNUYXJnZXRBcGlVcmwodXJsKSB7XG4gICAgICAgIHJldHVybiB1cmwuaW5jbHVkZXMoJ2NoYXRncHQuY29tL2JhY2tlbmQtYXBpL2NvbnZlcnNhdGlvbicpO1xuICAgIH1cbiAgICBleHRyYWN0Q3JlZGVudGlhbHModXJsLCByZXF1ZXN0SGVhZGVycywgcmVzcG9uc2VCb2R5KSB7XG4gICAgICAgIGNvbnN0IGNyZWRlbnRpYWxzID0ge307XG4gICAgICAgIGlmIChyZXF1ZXN0SGVhZGVyc1snYXV0aG9yaXphdGlvbiddKSB7XG4gICAgICAgICAgICBjcmVkZW50aWFscy5iZWFyZXJUb2tlbiA9IHJlcXVlc3RIZWFkZXJzWydhdXRob3JpemF0aW9uJ107XG4gICAgICAgIH1cbiAgICAgICAgY3JlZGVudGlhbHMuYXBpRW5kcG9pbnQgPSB1cmw7XG4gICAgICAgIHJldHVybiBjcmVkZW50aWFscztcbiAgICB9XG4gICAgYXN5bmMgc2VuZE1lc3NhZ2UocmVxdWVzdCwgY3JlZGVudGlhbHMpIHtcbiAgICAgICAgaWYgKCFjcmVkZW50aWFscy5iZWFyZXJUb2tlbikge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogJ0JlYXJlciB0b2tlbiBub3QgZm91bmQnLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6ICcnLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWNyZWRlbnRpYWxzLmFwaUVuZHBvaW50KSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiAnQVBJIGVuZHBvaW50IG5vdCBmb3VuZCcsXG4gICAgICAgICAgICAgICAgY29udGVudDogJycsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGhlYWRlcnMgPSB7XG4gICAgICAgICAgICAuLi5jcmVkZW50aWFscy5leHRyYUhlYWRlcnMsXG4gICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgQXV0aG9yaXphdGlvbjogY3JlZGVudGlhbHMuYmVhcmVyVG9rZW4sXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGJvZHkgPSB7XG4gICAgICAgICAgICBhY3Rpb246ICduZXh0JyxcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBhdXRob3I6IHsgcm9sZTogJ3VzZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IHsgY29udGVudF90eXBlOiAndGV4dCcsIHBhcnRzOiBbcmVxdWVzdC5wcm9tcHRdIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBwYXJlbnRfbWVzc2FnZV9pZDogcmVxdWVzdC5wYXJlbnRNZXNzYWdlSWQgfHwgdGhpcy5nZW5lcmF0ZVV1aWQoKSxcbiAgICAgICAgICAgIG1vZGVsOiByZXF1ZXN0Lm1vZGVsIHx8ICd0ZXh0LWRhdmluY2ktMDAyLXJlbmRlci1zaGEnLFxuICAgICAgICAgICAgY29udmVyc2F0aW9uX2lkOiByZXF1ZXN0LmNvbnZlcnNhdGlvbklkLFxuICAgICAgICB9O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChjcmVkZW50aWFscy5hcGlFbmRwb2ludCwge1xuICAgICAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgICAgICAgIGhlYWRlcnMsXG4gICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSksXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQwMSkge1xuICAgICAgICAgICAgICAgIGF3YWl0IGNsZWFyUGxhdGZvcm1DcmVkZW50aWFscygnY2hhdGdwdCcpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogJ0FQSSByZXF1ZXN0IGZhaWxlZCB3aXRoIHN0YXR1cyA0MDE6IFVuYXV0aG9yaXplZC4gQ3JlZGVudGlhbHMgaGF2ZSBiZWVuIGNsZWFyZWQuJyxcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDogJycsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBBUEkgcmVxdWVzdCBmYWlsZWQgd2l0aCBzdGF0dXMgJHtyZXNwb25zZS5zdGF0dXN9YCxcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDogJycsXG4gICAgICAgICAgICAgICAgICAgIHJhd1Jlc3BvbnNlOiBhd2FpdCByZXNwb25zZS50ZXh0KCksXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHNzZVBhcnNlciA9IG5ldyBTc2VQYXJzZXIoKTtcbiAgICAgICAgICAgIGxldCBmdWxsQ29udGVudCA9ICcnO1xuICAgICAgICAgICAgbGV0IGNvbnZlcnNhdGlvbklkO1xuICAgICAgICAgICAgbGV0IG1lc3NhZ2VJZDtcbiAgICAgICAgICAgIGF3YWl0IHNzZVBhcnNlci5wYXJzZShyZXNwb25zZSwgKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YS5tZXNzYWdlPy5jb250ZW50Py5wYXJ0cykge1xuICAgICAgICAgICAgICAgICAgICBmdWxsQ29udGVudCA9IGRhdGEubWVzc2FnZS5jb250ZW50LnBhcnRzWzBdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoZGF0YS5jb252ZXJzYXRpb25faWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udmVyc2F0aW9uSWQgPSBkYXRhLmNvbnZlcnNhdGlvbl9pZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGRhdGEubWVzc2FnZT8uaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZUlkID0gZGF0YS5tZXNzYWdlLmlkO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGZ1bGxDb250ZW50LFxuICAgICAgICAgICAgICAgIGNvbnZlcnNhdGlvbklkLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2VJZCxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBlcnJvci5tZXNzYWdlLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6ICcnLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBnZW5lcmF0ZVV1aWQoKSB7XG4gICAgICAgIHJldHVybiAneHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4Jy5yZXBsYWNlKC9beHldL2csIGZ1bmN0aW9uIChjKSB7XG4gICAgICAgICAgICBjb25zdCByID0gKE1hdGgucmFuZG9tKCkgKiAxNikgfCAwO1xuICAgICAgICAgICAgY29uc3QgdiA9IGMgPT09ICd4JyA/IHIgOiAociAmIDB4MykgfCAweDg7XG4gICAgICAgICAgICByZXR1cm4gdi50b1N0cmluZygxNik7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cbiIsIi8qKlxuICogY29uc3RzLnRzIC0gYWlDbGF3IOW4uOmHj+WumuS5iVxuICpcbiAqIOWumuS5ieWtmOWCqOmUruWQjeOAgea2iOaBr+exu+Wei+OAgeW5s+WPsOebuOWFs+W4uOmHj+OAglxuICovXG4vLyDilIDilIAgY2hyb21lLnN0b3JhZ2UubG9jYWwg5Lit5L2/55So55qE6ZSu5ZCNIOKUgOKUgFxuZXhwb3J0IGNvbnN0IFNUT1JBR0VfS0VZX0NSRURFTlRJQUxTID0gJ2FjX2NyZWRlbnRpYWxzJzsgLy8g5a2Y5YKo5ZCE5bmz5Y+w5Yet6K+BXG4vLyDilIDilIAg5omp5bGV5YaF6YOo5raI5oGv57G75Z6LIOKUgOKUgFxuZXhwb3J0IHZhciBNc2dUeXBlO1xuKGZ1bmN0aW9uIChNc2dUeXBlKSB7XG4gICAgTXNnVHlwZVtcIlBJTkdcIl0gPSBcIkFDX1BJTkdcIjtcbiAgICBNc2dUeXBlW1wiQ0FQVFVSRURfQ1JFREVOVElBTFNcIl0gPSBcIkFDX0NBUFRVUkVEX0NSRURFTlRJQUxTXCI7XG4gICAgTXNnVHlwZVtcIkVYRUNVVEVfVEFTS1wiXSA9IFwiQUNfRVhFQ1VURV9UQVNLXCI7XG4gICAgTXNnVHlwZVtcIlRBU0tfUkVTVUxUXCJdID0gXCJBQ19UQVNLX1JFU1VMVFwiO1xuICAgIE1zZ1R5cGVbXCJBQ19TRU5EX1RFU1RfTUVTU0FHRVwiXSA9IFwiQUNfU0VORF9URVNUX01FU1NBR0VcIjtcbn0pKE1zZ1R5cGUgfHwgKE1zZ1R5cGUgPSB7fSkpO1xuLy8g4pSA4pSAIGluamVjdGlvbiDihpIgY29udGVudCDnmoQgcG9zdE1lc3NhZ2Ugc291cmNlIOagh+ivhiDilIDilIBcbmV4cG9ydCBjb25zdCBJTkpFQ1RJT05fU09VUkNFID0gJ2FpY2xhdy1pbmplY3Rpb24nO1xuLy8g4pSA4pSAIOW5s+WPsCBVUkwg5Yy56YWN6KeE5YiZIOKUgOKUgFxuLy8g55So5LqOIGluamVjdGlvbi50cyDliKTmlq3lvZPliY3mi6bmiKrliLDnmoQgZmV0Y2gg6K+35rGC5bGe5LqO5ZOq5Liq5bmz5Y+w55qEIEFQSVxuZXhwb3J0IGNvbnN0IFBMQVRGT1JNX0FQSV9QQVRURVJOUyA9IHtcbiAgICBjaGF0Z3B0OiBbXG4gICAgICAgIC9jaGF0Z3B0XFwuY29tXFwvYmFja2VuZC1hcGlcXC8vLFxuICAgICAgICAvY2hhdFxcLm9wZW5haVxcLmNvbVxcL2JhY2tlbmQtYXBpXFwvLyxcbiAgICBdLFxuICAgIGdlbWluaTogW1xuICAgICAgICAvZ2VtaW5pXFwuZ29vZ2xlXFwuY29tXFwvX1xcL0JhcmRDaGF0VWlcXC8vLFxuICAgICAgICAvZ2VtaW5pXFwuZ29vZ2xlXFwuY29tXFwvYXBwXFwvX1xcL0JhcmRDaGF0VWlcXC8vLFxuICAgICAgICAvYWxrYWxpbWFrZXJzdWl0ZS1wYVxcLmNsaWVudHM2XFwuZ29vZ2xlXFwuY29tXFwvLyxcbiAgICBdLFxuICAgIGdyb2s6IFtcbiAgICAgICAgL2dyb2tcXC5jb21cXC9yZXN0XFwvYXBwLWNoYXRcXC8vLFxuICAgICAgICAveFxcLmNvbVxcL2lcXC9hcGlcXC8yXFwvZ3Jva1xcLy8sXG4gICAgXSxcbn07XG4vKipcbiAqIOajgOa1i+S4gOS4quivt+axgiBVUkwg5piv5ZCm5piv5oiR5Lus6ZyA6KaB5YWz5rOo55qEIEFJIOW5s+WPsCBBUEkg6LCD55So44CCXG4gKiDlpoLmnpzljLnphY3vvIzov5Tlm57lubPlj7DlkI3np7DvvJvlkKbliJnov5Tlm54gbnVsbOOAglxuICovXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0UGxhdGZvcm1Gcm9tVXJsKHVybCkge1xuICAgIGZvciAoY29uc3QgW3BsYXRmb3JtLCBwYXR0ZXJuc10gb2YgT2JqZWN0LmVudHJpZXMoUExBVEZPUk1fQVBJX1BBVFRFUk5TKSkge1xuICAgICAgICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgcGF0dGVybnMpIHtcbiAgICAgICAgICAgIGlmIChwYXR0ZXJuLnRlc3QodXJsKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBwbGF0Zm9ybTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cbi8qKlxuICog5qC55o2uIGhvc3RuYW1lIOajgOa1i+W9k+WJjemhtemdouaJgOWcqOeahOW5s+WPsOOAglxuICovXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0UGxhdGZvcm1Gcm9tSG9zdG5hbWUoaG9zdG5hbWUpIHtcbiAgICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoJ2NoYXRncHQuY29tJykgfHwgaG9zdG5hbWUuaW5jbHVkZXMoJ2NoYXQub3BlbmFpLmNvbScpKSB7XG4gICAgICAgIHJldHVybiAnY2hhdGdwdCc7XG4gICAgfVxuICAgIGlmIChob3N0bmFtZS5pbmNsdWRlcygnZ2VtaW5pLmdvb2dsZS5jb20nKSkge1xuICAgICAgICByZXR1cm4gJ2dlbWluaSc7XG4gICAgfVxuICAgIGlmIChob3N0bmFtZS5pbmNsdWRlcygnZ3Jvay5jb20nKSB8fCBob3N0bmFtZS5pbmNsdWRlcygneC5jb20nKSkge1xuICAgICAgICByZXR1cm4gJ2dyb2snO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cbiIsIi8qKlxuICogYmFja2dyb3VuZC50cyAtIGFpQ2xhdyBCYWNrZ3JvdW5kIFNlcnZpY2UgV29ya2VyIChQaGFzZSAxKVxuICpcbiAqIOiBjOi0o++8mlxuICogICAxLiDmjqXmlLblubblrZjlgqjku44gY29udGVudCBzY3JpcHQg6L2s5Y+R5p2l55qE5Yet6K+B5pWw5o2uXG4gKiAgIDIuIOaPkOS+m+WHreivgeafpeivouaOpeWPo++8iOS+m+acquadpeeahOS7u+WKoeaJp+ihjOaooeWdl+S9v+eUqO+8iVxuICogICAzLiDpgJrov4cgd2ViUmVxdWVzdCDooqvliqjmjZXojrcgQmVhcmVyIFRva2Vu77yI5YWo5bGA6KGl5YWF5oum5oiq77yJXG4gKiAgIDQuIOeuoeeQhiBob29rIOeKtuaAgVxuICpcbiAqIOaetuaehOWxgue6p++8mkxheWVyIDPvvIhTZXJ2aWNlIFdvcmtlcu+8iVxuICovXG5pbXBvcnQgeyBTVE9SQUdFX0tFWV9DUkVERU5USUFMUywgTXNnVHlwZSB9IGZyb20gJy4uL2NhcHR1cmUvY29uc3RzJztcbmltcG9ydCB7IENoYXRHcHRBZGFwdGVyIH0gZnJvbSAnLi4vYWRhcHRlcnMvY2hhdGdwdC1hZGFwdGVyJztcbmxldCBob29rU3RhdHVzTWFwID0ge307XG4vLyDilIDilIAg6buY6K6k56m65Yet6K+BIOKUgOKUgFxuZnVuY3Rpb24gZW1wdHlDcmVkZW50aWFscygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBiZWFyZXJUb2tlbjogbnVsbCxcbiAgICAgICAgYXBpRW5kcG9pbnQ6IG51bGwsXG4gICAgICAgIGxhc3RDYXB0dXJlZEhlYWRlcnM6IHt9LFxuICAgICAgICBsYXN0Q2FwdHVyZWRBdDogMCxcbiAgICAgICAgY2FwdHVyZUNvdW50OiAwLFxuICAgIH07XG59XG5mdW5jdGlvbiBkZWZhdWx0QWxsQ3JlZGVudGlhbHMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgY2hhdGdwdDogZW1wdHlDcmVkZW50aWFscygpLFxuICAgICAgICBnZW1pbmk6IGVtcHR5Q3JlZGVudGlhbHMoKSxcbiAgICAgICAgZ3JvazogZW1wdHlDcmVkZW50aWFscygpLFxuICAgIH07XG59XG4vLyDilIDilIAg5Yet6K+B5a2Y5YKo5pON5L2cIOKUgOKUgFxuYXN5bmMgZnVuY3Rpb24gbG9hZENyZWRlbnRpYWxzKCkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChTVE9SQUdFX0tFWV9DUkVERU5USUFMUyk7XG4gICAgY29uc3QgY3JlZHMgPSByZXNbU1RPUkFHRV9LRVlfQ1JFREVOVElBTFNdO1xuICAgIGlmIChjcmVkcyAmJiB0eXBlb2YgY3JlZHMgPT09ICdvYmplY3QnICYmICdjaGF0Z3B0JyBpbiBjcmVkcyAmJiAnZ2VtaW5pJyBpbiBjcmVkcyAmJiAnZ3JvaycgaW4gY3JlZHMpIHtcbiAgICAgICAgcmV0dXJuIGNyZWRzO1xuICAgIH1cbiAgICByZXR1cm4gZGVmYXVsdEFsbENyZWRlbnRpYWxzKCk7XG59XG5hc3luYyBmdW5jdGlvbiBzYXZlQ3JlZGVudGlhbHMoY3JlZHMpIHtcbiAgICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoeyBbU1RPUkFHRV9LRVlfQ1JFREVOVElBTFNdOiBjcmVkcyB9KTtcbn1cbmFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVBsYXRmb3JtQ3JlZGVudGlhbHMocGxhdGZvcm0sIGJlYXJlclRva2VuLCBhcGlVcmwsIGhlYWRlcnMpIHtcbiAgICBjb25zdCBjcmVkcyA9IGF3YWl0IGxvYWRDcmVkZW50aWFscygpO1xuICAgIGNvbnN0IHBjID0gY3JlZHNbcGxhdGZvcm1dO1xuICAgIC8vIOWPquacieaWsOWAvOmdnuepuuaXtuaJjeabtOaWsO+8iOmYsuatouimhuebluW3suacieWAvO+8iVxuICAgIGlmIChiZWFyZXJUb2tlbikge1xuICAgICAgICBwYy5iZWFyZXJUb2tlbiA9IGJlYXJlclRva2VuO1xuICAgIH1cbiAgICBpZiAoYXBpVXJsKSB7XG4gICAgICAgIHBjLmFwaUVuZHBvaW50ID0gYXBpVXJsO1xuICAgIH1cbiAgICBpZiAoT2JqZWN0LmtleXMoaGVhZGVycykubGVuZ3RoID4gMCkge1xuICAgICAgICBwYy5sYXN0Q2FwdHVyZWRIZWFkZXJzID0gaGVhZGVycztcbiAgICB9XG4gICAgcGMubGFzdENhcHR1cmVkQXQgPSBEYXRlLm5vdygpO1xuICAgIHBjLmNhcHR1cmVDb3VudCArPSAxO1xuICAgIGNyZWRzW3BsYXRmb3JtXSA9IHBjO1xuICAgIGF3YWl0IHNhdmVDcmVkZW50aWFscyhjcmVkcyk7XG4gICAgLy8g5omT5Y2w5pel5b+XXG4gICAgY29uc3QgdG9rZW5QcmV2aWV3ID0gcGMuYmVhcmVyVG9rZW5cbiAgICAgICAgPyBgJHtwYy5iZWFyZXJUb2tlbi5zdWJzdHJpbmcoMCwgMjUpfS4uLmBcbiAgICAgICAgOiAnbnVsbCc7XG4gICAgY29uc29sZS5sb2coYCVjW2FpQ2xhdy1CR10g8J+UkCBDcmVkZW50aWFscyB1cGRhdGVkIGZvciAlYyR7cGxhdGZvcm19JWMgfCBUb2tlbjogJHt0b2tlblByZXZpZXd9IHwgQ291bnQ6ICR7cGMuY2FwdHVyZUNvdW50fWAsICdjb2xvcjogIzcxODA5NicsICdjb2xvcjogIzRhZGU4MDsgZm9udC13ZWlnaHQ6IGJvbGQnLCAnY29sb3I6ICM3MTgwOTYnKTtcbn1cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjbGVhclBsYXRmb3JtQ3JlZGVudGlhbHMocGxhdGZvcm0pIHtcbiAgICBjb25zdCBjcmVkcyA9IGF3YWl0IGxvYWRDcmVkZW50aWFscygpO1xuICAgIGNyZWRzW3BsYXRmb3JtXS5iZWFyZXJUb2tlbiA9IG51bGw7XG4gICAgY3JlZHNbcGxhdGZvcm1dLmFwaUVuZHBvaW50ID0gbnVsbDtcbiAgICBhd2FpdCBzYXZlQ3JlZGVudGlhbHMoY3JlZHMpO1xuICAgIGNvbnNvbGUubG9nKGBbYWlDbGF3LUJHXSDwn5eR77iPIENsZWFyZWQgY3JlZGVudGlhbHMgZm9yICR7cGxhdGZvcm19YCk7XG59XG4vLyDilIDilIAg5omp5bGV5a6J6KOFL+abtOaWsOS6i+S7tiDilIDilIBcbmNocm9tZS5ydW50aW1lLm9uSW5zdGFsbGVkLmFkZExpc3RlbmVyKGFzeW5jICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnJWNbYWlDbGF3LUJHXSDwn5qAIEV4dGVuc2lvbiBpbnN0YWxsZWQvdXBkYXRlZC4nLCAnY29sb3I6ICM2MGE1ZmE7IGZvbnQtd2VpZ2h0OiBib2xkOyBmb250LXNpemU6IDEzcHg7Jyk7XG4gICAgLy8g5Yid5aeL5YyW5Yet6K+B5a2Y5YKo77yI5aaC5p6c5LiN5a2Y5Zyo77yJXG4gICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoU1RPUkFHRV9LRVlfQ1JFREVOVElBTFMpO1xuICAgIGlmICghZXhpc3RpbmdbU1RPUkFHRV9LRVlfQ1JFREVOVElBTFNdKSB7XG4gICAgICAgIGF3YWl0IHNhdmVDcmVkZW50aWFscyhkZWZhdWx0QWxsQ3JlZGVudGlhbHMoKSk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbYWlDbGF3LUJHXSDwn5OmIENyZWRlbnRpYWwgc3RvcmUgaW5pdGlhbGl6ZWQuJyk7XG4gICAgfVxufSk7XG4vLyDilIDilIAg5raI5oGv5Lit5p6iIOKUgOKUgFxuY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIC8vIDEuIOWHreivgeaNleiOt+a2iOaBr++8iOadpeiHqiBjb250ZW50IHNjcmlwdCDkuK3nu6fvvIlcbiAgICBpZiAobWVzc2FnZS50eXBlID09PSBNc2dUeXBlLkNBUFRVUkVEX0NSRURFTlRJQUxTKSB7XG4gICAgICAgIGNvbnN0IHsgcGxhdGZvcm0sIGJlYXJlclRva2VuLCBhcGlVcmwsIHJlcXVlc3RIZWFkZXJzIH0gPSBtZXNzYWdlO1xuICAgICAgICBpZiAocGxhdGZvcm0gJiYgKHBsYXRmb3JtID09PSAnY2hhdGdwdCcgfHwgcGxhdGZvcm0gPT09ICdnZW1pbmknIHx8IHBsYXRmb3JtID09PSAnZ3JvaycpKSB7XG4gICAgICAgICAgICB1cGRhdGVQbGF0Zm9ybUNyZWRlbnRpYWxzKHBsYXRmb3JtLCBiZWFyZXJUb2tlbiB8fCBudWxsLCBhcGlVcmwgfHwgbnVsbCwgcmVxdWVzdEhlYWRlcnMgfHwge30pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjsgLy8g5peg6ZyAIHNlbmRSZXNwb25zZVxuICAgIH1cbiAgICAvLyAyLiBIb29rIOeKtuaAgeS4iuaKpVxuICAgIGlmIChtZXNzYWdlLnR5cGUgPT09ICdBQ19IT09LX1NUQVRVUycpIHtcbiAgICAgICAgY29uc3QgdGFiSWQgPSBzZW5kZXIudGFiPy5pZDtcbiAgICAgICAgaWYgKHRhYklkKSB7XG4gICAgICAgICAgICBob29rU3RhdHVzTWFwW3RhYklkXSA9IHtcbiAgICAgICAgICAgICAgICBmZXRjaDogbWVzc2FnZS5zdGF0dXM/LmZldGNoIHx8IGZhbHNlLFxuICAgICAgICAgICAgICAgIHhocjogbWVzc2FnZS5zdGF0dXM/LnhociB8fCBmYWxzZSxcbiAgICAgICAgICAgICAgICBsYXN0UmVwb3J0OiBEYXRlLm5vdygpLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIDMuIOafpeivouafkOW5s+WPsOeahOWHreivge+8iOS+m+acquadpeS7u+WKoeaJp+ihjOaooeWdl+S9v+eUqO+8iVxuICAgIGlmIChtZXNzYWdlLnR5cGUgPT09ICdBQ19HRVRfQ1JFREVOVElBTFMnKSB7XG4gICAgICAgIGNvbnN0IHBsYXRmb3JtID0gbWVzc2FnZS5wbGF0Zm9ybTtcbiAgICAgICAgbG9hZENyZWRlbnRpYWxzKCkudGhlbihjcmVkcyA9PiB7XG4gICAgICAgICAgICBpZiAocGxhdGZvcm0gJiYgY3JlZHNbcGxhdGZvcm1dKSB7XG4gICAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IHRydWUsIGNyZWRlbnRpYWxzOiBjcmVkc1twbGF0Zm9ybV0gfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBvazogZmFsc2UsIGVycm9yOiBgVW5rbm93biBwbGF0Zm9ybTogJHtwbGF0Zm9ybX1gIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIOW8guatpSBzZW5kUmVzcG9uc2VcbiAgICB9XG4gICAgLy8gNC4g5p+l6K+i5omA5pyJ5bmz5Y+w55qE5Yet6K+B54q25oCB5pGY6KaB77yI6LCD6K+V55So77yJXG4gICAgaWYgKG1lc3NhZ2UudHlwZSA9PT0gJ0FDX0dFVF9BTExfU1RBVFVTJykge1xuICAgICAgICBsb2FkQ3JlZGVudGlhbHMoKS50aGVuKGNyZWRzID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHN1bW1hcnkgPSB7fTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgW3AsIGNdIG9mIE9iamVjdC5lbnRyaWVzKGNyZWRzKSkge1xuICAgICAgICAgICAgICAgIHN1bW1hcnlbcF0gPSB7XG4gICAgICAgICAgICAgICAgICAgIGhhc1Rva2VuOiAhIWMuYmVhcmVyVG9rZW4sXG4gICAgICAgICAgICAgICAgICAgIHRva2VuUHJldmlldzogYy5iZWFyZXJUb2tlbiA/IGMuYmVhcmVyVG9rZW4uc3Vic3RyaW5nKDAsIDIwKSArICcuLi4nIDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgYXBpRW5kcG9pbnQ6IGMuYXBpRW5kcG9pbnQsXG4gICAgICAgICAgICAgICAgICAgIGxhc3RDYXB0dXJlZEF0OiBjLmxhc3RDYXB0dXJlZEF0ID8gbmV3IERhdGUoYy5sYXN0Q2FwdHVyZWRBdCkudG9JU09TdHJpbmcoKSA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGNhcHR1cmVDb3VudDogYy5jYXB0dXJlQ291bnQsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IG9rOiB0cnVlLCBzdW1tYXJ5LCBob29rU3RhdHVzOiBob29rU3RhdHVzTWFwIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIOW8guatpSBzZW5kUmVzcG9uc2VcbiAgICB9XG4gICAgaWYgKG1lc3NhZ2UudHlwZSA9PT0gTXNnVHlwZS5BQ19TRU5EX1RFU1RfTUVTU0FHRSkge1xuICAgICAgICBjb25zb2xlLmxvZygnW2FpQ2xhdy1CR10gUmVjZWl2ZWQgdGVzdCBtZXNzYWdlIHJlcXVlc3QnKTtcbiAgICAgICAgbG9hZENyZWRlbnRpYWxzKCkudGhlbihhc3luYyAoY3JlZHMpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGNoYXRHcHRDcmVkcyA9IGNyZWRzLmNoYXRncHQ7XG4gICAgICAgICAgICBpZiAoY2hhdEdwdENyZWRzICYmIGNoYXRHcHRDcmVkcy5iZWFyZXJUb2tlbiAmJiBjaGF0R3B0Q3JlZHMuYXBpRW5kcG9pbnQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhZGFwdGVyID0gbmV3IENoYXRHcHRBZGFwdGVyKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBhZGFwdGVyLnNlbmRNZXNzYWdlKHsgcHJvbXB0OiAnSGVsbG8sIHRoaXMgaXMgYSB0ZXN0IG1lc3NhZ2UuJyB9LCBjaGF0R3B0Q3JlZHMpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbYWlDbGF3LUJHXSBUZXN0IG1lc3NhZ2UgcmVzcG9uc2U6JywgcmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IG9rOiB0cnVlLCByZXNwb25zZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IG9rOiBmYWxzZSwgZXJyb3I6ICdDaGF0R1BUIGNyZWRlbnRpYWxzIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKG1lc3NhZ2UudHlwZSA9PT0gTXNnVHlwZS5UQVNLX1JFU1VMVCkge1xuICAgICAgICB3c0NsaWVudC5zZW5kUmVzdWx0KG1lc3NhZ2UucmVzdWx0KTtcbiAgICAgICAgd3NDbGllbnQuaXNFeGVjdXRpbmdUYXNrID0gZmFsc2U7XG4gICAgICAgIHdzQ2xpZW50LmV4ZWN1dGVOZXh0VGFzaygpO1xuICAgICAgICByZXR1cm47IC8vIE5vIHJlc3BvbnNlIG5lZWRlZFxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59KTtcbi8vIOKUgOKUgCDlhajlsYAgd2ViUmVxdWVzdCDmi6bmiKrvvJrooqvliqjmjZXojrcgQmVhcmVyIFRva2VuIOKUgOKUgFxuLy8g6L+Z5piv5a+5IGluamVjdGlvbi50cyBmZXRjaCBob29rIOeahOihpeWFhe+8muWNs+S9vyBpbmplY3Rpb24g5rKh5pyJ5o2V6I635Yiw77yMXG4vLyB3ZWJSZXF1ZXN0IOS5n+iDveS7juivt+axguWktOS4reaLv+WIsCBCZWFyZXIgVG9rZW7jgIJcbmNvbnN0IEFJX1BMQVRGT1JNX1VSTF9QQVRURVJOUyA9IFtcbiAgICAnaHR0cHM6Ly9jaGF0Z3B0LmNvbS9iYWNrZW5kLWFwaS8qJyxcbiAgICAnaHR0cHM6Ly9jaGF0Lm9wZW5haS5jb20vYmFja2VuZC1hcGkvKicsXG4gICAgJ2h0dHBzOi8vZ2VtaW5pLmdvb2dsZS5jb20vKicsXG4gICAgJ2h0dHBzOi8vZ3Jvay5jb20vcmVzdC8qJyxcbl07XG5jaHJvbWUud2ViUmVxdWVzdC5vbkJlZm9yZVNlbmRIZWFkZXJzLmFkZExpc3RlbmVyKChkZXRhaWxzKSA9PiB7XG4gICAgY29uc3QgaGVhZGVycyA9IGRldGFpbHMucmVxdWVzdEhlYWRlcnMgfHwgW107XG4gICAgY29uc3QgYXV0aEhlYWRlciA9IGhlYWRlcnMuZmluZChoID0+IGgubmFtZS50b0xvd2VyQ2FzZSgpID09PSAnYXV0aG9yaXphdGlvbicpO1xuICAgIGlmIChhdXRoSGVhZGVyPy52YWx1ZT8uc3RhcnRzV2l0aCgnQmVhcmVyICcpKSB7XG4gICAgICAgIGNvbnN0IHVybCA9IGRldGFpbHMudXJsO1xuICAgICAgICBsZXQgcGxhdGZvcm0gPSBudWxsO1xuICAgICAgICBpZiAodXJsLmluY2x1ZGVzKCdjaGF0Z3B0LmNvbScpIHx8IHVybC5pbmNsdWRlcygnY2hhdC5vcGVuYWkuY29tJykpIHtcbiAgICAgICAgICAgIHBsYXRmb3JtID0gJ2NoYXRncHQnO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHVybC5pbmNsdWRlcygnZ2VtaW5pLmdvb2dsZS5jb20nKSkge1xuICAgICAgICAgICAgcGxhdGZvcm0gPSAnZ2VtaW5pJztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh1cmwuaW5jbHVkZXMoJ2dyb2suY29tJykgfHwgdXJsLmluY2x1ZGVzKCd4LmNvbScpKSB7XG4gICAgICAgICAgICBwbGF0Zm9ybSA9ICdncm9rJztcbiAgICAgICAgfVxuICAgICAgICBpZiAocGxhdGZvcm0pIHtcbiAgICAgICAgICAgIHVwZGF0ZVBsYXRmb3JtQ3JlZGVudGlhbHMocGxhdGZvcm0sIGF1dGhIZWFkZXIudmFsdWUsIHVybCwge30pO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYCVjW2FpQ2xhdy1CR10g8J+MkCBXZWJSZXF1ZXN0IGNhcHR1cmVkIEJlYXJlciBmb3IgJHtwbGF0Zm9ybX1gLCAnY29sb3I6ICM2MGE1ZmEnKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyByZXF1ZXN0SGVhZGVyczogaGVhZGVycyB9O1xufSwgeyB1cmxzOiBBSV9QTEFURk9STV9VUkxfUEFUVEVSTlMgfSwgWydyZXF1ZXN0SGVhZGVycyddKTtcbi8vIOKUgOKUgCB0YWIg5YWz6Zet5pe25riF55CGIGhvb2sg54q25oCBIOKUgOKUgFxuY2hyb21lLnRhYnMub25SZW1vdmVkLmFkZExpc3RlbmVyKCh0YWJJZCkgPT4ge1xuICAgIGRlbGV0ZSBob29rU3RhdHVzTWFwW3RhYklkXTtcbn0pO1xuLy8g4pSA4pSAIFdlYlNvY2tldCDlrqLmiLfnq68g4pSA4pSAXG5jb25zdCBMT0NBTEJSSURHRV9VUkwgPSAnd3M6Ly9sb2NhbGhvc3Q6ODc2NS93cy9haWNsYXcnO1xuY2xhc3MgV2ViU29ja2V0Q2xpZW50IHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy53cyA9IG51bGw7XG4gICAgICAgIHRoaXMucmVjb25uZWN0QXR0ZW1wdHMgPSAwO1xuICAgICAgICB0aGlzLnRhc2tRdWV1ZSA9IFtdO1xuICAgICAgICB0aGlzLmlzRXhlY3V0aW5nVGFzayA9IGZhbHNlO1xuICAgICAgICB0aGlzLmxhc3RVc2VkVGFiSW5kZXggPSBuZXcgTWFwKCk7XG4gICAgfVxuICAgIGNvbm5lY3QoKSB7XG4gICAgICAgIHRoaXMud3MgPSBuZXcgV2ViU29ja2V0KExPQ0FMQlJJREdFX1VSTCk7XG4gICAgICAgIHRoaXMud3Mub25vcGVuID0gKCkgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1thaUNsYXctQkddIPCflIwgV2ViU29ja2V0IGNvbm5lY3RlZCB0byBsb2NhbEJyaWRnZScpO1xuICAgICAgICAgICAgdGhpcy5yZWNvbm5lY3RBdHRlbXB0cyA9IDA7XG4gICAgICAgICAgICB0aGlzLmV4ZWN1dGVOZXh0VGFzaygpOyAvLyBTdGFydCBleGVjdXRpbmcgdGFza3MgaWYgYW55IHdlcmUgcXVldWVkIHdoaWxlIGRpc2Nvbm5lY3RlZFxuICAgICAgICB9O1xuICAgICAgICB0aGlzLndzLm9ubWVzc2FnZSA9IChldmVudCkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB0YXNrID0gSlNPTi5wYXJzZShldmVudC5kYXRhKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW2FpQ2xhdy1CR10g8J+TqSBSZWNlaXZlZCB0YXNrIGZyb20gbG9jYWxCcmlkZ2U6JywgdGFzayk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbnF1ZXVlVGFzayh0YXNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW2FpQ2xhdy1CR10g4p2MIEVycm9yIHBhcnNpbmcgdGFzayBmcm9tIGxvY2FsQnJpZGdlOicsIGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLndzLm9uY2xvc2UgPSAoKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW2FpQ2xhdy1CR10g8J+UjCBXZWJTb2NrZXQgZGlzY29ubmVjdGVkIGZyb20gbG9jYWxCcmlkZ2UnKTtcbiAgICAgICAgICAgIHRoaXMucmVjb25uZWN0KCk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMud3Mub25lcnJvciA9IChlcnIpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1thaUNsYXctQkddIOKdjCBXZWJTb2NrZXQgZXJyb3I6JywgZXJyKTtcbiAgICAgICAgICAgIC8vIG9uY2xvc2Ugd2lsbCBiZSBjYWxsZWQgbmV4dCwgd2hpY2ggd2lsbCBoYW5kbGUgcmVjb25uZWN0XG4gICAgICAgIH07XG4gICAgfVxuICAgIHJlY29ubmVjdCgpIHtcbiAgICAgICAgaWYgKHRoaXMucmVjb25uZWN0QXR0ZW1wdHMgPj0gMzApIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1thaUNsYXctQkddIOKdjCBUb28gbWFueSByZWNvbm5lY3QgYXR0ZW1wdHMsIGdpdmluZyB1cC4nKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBkZWxheSA9IE1hdGgubWluKDMwMDAwLCAxMDAwICogTWF0aC5wb3coMiwgdGhpcy5yZWNvbm5lY3RBdHRlbXB0cykpO1xuICAgICAgICB0aGlzLnJlY29ubmVjdEF0dGVtcHRzKys7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbYWlDbGF3LUJHXSDwn5SMIFJlY29ubmVjdGluZyBXZWJTb2NrZXQgaW4gJHtkZWxheSAvIDEwMDB9cy4uLmApO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuY29ubmVjdCgpLCBkZWxheSk7XG4gICAgfVxuICAgIGVucXVldWVUYXNrKHRhc2spIHtcbiAgICAgICAgdGhpcy50YXNrUXVldWUucHVzaCh0YXNrKTtcbiAgICAgICAgdGhpcy5leGVjdXRlTmV4dFRhc2soKTtcbiAgICB9XG4gICAgZXhlY3V0ZU5leHRUYXNrKCkge1xuICAgICAgICBpZiAodGhpcy5pc0V4ZWN1dGluZ1Rhc2sgfHwgdGhpcy50YXNrUXVldWUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5pc0V4ZWN1dGluZ1Rhc2sgPSB0cnVlO1xuICAgICAgICBjb25zdCB0YXNrID0gdGhpcy50YXNrUXVldWUuc2hpZnQoKTtcbiAgICAgICAgdGhpcy5kaXNwYXRjaFRhc2sodGFzayk7XG4gICAgfVxuICAgIGdldFBsYXRmb3JtVXJsUGF0dGVybnMocGxhdGZvcm0pIHtcbiAgICAgICAgc3dpdGNoIChwbGF0Zm9ybSkge1xuICAgICAgICAgICAgY2FzZSAnY2hhdGdwdCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIFsnaHR0cHM6Ly9jaGF0Lm9wZW5haS5jb20vKicsICdodHRwczovL2NoYXRncHQuY29tLyonXTtcbiAgICAgICAgICAgIGNhc2UgJ2dlbWluaSc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIFsnaHR0cHM6Ly9nZW1pbmkuZ29vZ2xlLmNvbS8qJ107XG4gICAgICAgICAgICBjYXNlICdncm9rJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gWydodHRwczovL2dyb2suY29tLyonLCAnaHR0cHM6Ly94LmNvbS9pL2dyb2sqJ107XG4gICAgICAgIH1cbiAgICB9XG4gICAgYXN5bmMgZGlzcGF0Y2hUYXNrKHRhc2spIHtcbiAgICAgICAgaWYgKCF0YXNrLnBsYXRmb3JtIHx8ICF0YXNrLnBheWxvYWQ/LnByb21wdCkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW2FpQ2xhdy1CR10g4p2MIEludmFsaWQgdGFzayByZWNlaXZlZDonLCB0YXNrKTtcbiAgICAgICAgICAgIHRoaXMuaXNFeGVjdXRpbmdUYXNrID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmV4ZWN1dGVOZXh0VGFzaygpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBsYXRmb3JtID0gdGFzay5wbGF0Zm9ybTtcbiAgICAgICAgY29uc3QgdXJsUGF0dGVybnMgPSB0aGlzLmdldFBsYXRmb3JtVXJsUGF0dGVybnMocGxhdGZvcm0pO1xuICAgICAgICBsZXQgdGFicyA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgdXJsUGF0dGVybnMpIHtcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoaW5nVGFicyA9IGF3YWl0IGNocm9tZS50YWJzLnF1ZXJ5KHsgdXJsOiBwYXR0ZXJuIH0pO1xuICAgICAgICAgICAgdGFicyA9IHRhYnMuY29uY2F0KG1hdGNoaW5nVGFicyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRhYnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbYWlDbGF3LUJHXSDinYwgTm8gYWN0aXZlIHRhYiBmb3VuZCBmb3IgcGxhdGZvcm06ICR7cGxhdGZvcm19YCk7XG4gICAgICAgICAgICB0aGlzLnNlbmRSZXN1bHQoeyB0YXNrSWQ6IHRhc2sudGFza0lkLCBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBObyBhY3RpdmUgdGFiIGZvdW5kIGZvciBwbGF0Zm9ybTogJHtwbGF0Zm9ybX1gIH0pO1xuICAgICAgICAgICAgdGhpcy5pc0V4ZWN1dGluZ1Rhc2sgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuZXhlY3V0ZU5leHRUYXNrKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbGFzdEluZGV4ID0gdGhpcy5sYXN0VXNlZFRhYkluZGV4LmdldChwbGF0Zm9ybSkgfHwgLTE7XG4gICAgICAgIGNvbnN0IG5leHRJbmRleCA9IChsYXN0SW5kZXggKyAxKSAlIHRhYnMubGVuZ3RoO1xuICAgICAgICBjb25zdCB0YWIgPSB0YWJzW25leHRJbmRleF07XG4gICAgICAgIHRoaXMubGFzdFVzZWRUYWJJbmRleC5zZXQocGxhdGZvcm0sIG5leHRJbmRleCk7XG4gICAgICAgIGNvbnN0IHRhYklkID0gdGFiLmlkO1xuICAgICAgICBpZiAodGFiSWQpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2UodGFiSWQsIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogTXNnVHlwZS5FWEVDVVRFX1RBU0ssXG4gICAgICAgICAgICAgICAgICAgIHRhc2s6IHRhc2ssXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFthaUNsYXctQkddIOKdjCBFcnJvciBzZW5kaW5nIHRhc2sgdG8gdGFiICR7dGFiSWR9OmAsIGUpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2VuZFJlc3VsdCh7IHRhc2tJZDogdGFzay50YXNrSWQsIHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEZhaWxlZCB0byBzZW5kIHRhc2sgdG8gY29udGVudCBzY3JpcHQ6ICR7ZS5tZXNzYWdlfWAgfSk7XG4gICAgICAgICAgICAgICAgdGhpcy5pc0V4ZWN1dGluZ1Rhc2sgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0aGlzLmV4ZWN1dGVOZXh0VGFzaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHNlbmRSZXN1bHQocmVzdWx0KSB7XG4gICAgICAgIGlmICh0aGlzLndzICYmIHRoaXMud3MucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0Lk9QRU4pIHtcbiAgICAgICAgICAgIHRoaXMud3Muc2VuZChKU09OLnN0cmluZ2lmeShyZXN1bHQpKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbmNvbnN0IHdzQ2xpZW50ID0gbmV3IFdlYlNvY2tldENsaWVudCgpO1xud3NDbGllbnQuY29ubmVjdCgpO1xuLy8g4pSA4pSAIFNlcnZpY2UgV29ya2VyIEtlZXAtYWxpdmUg4pSA4pSAXG5jaHJvbWUuYWxhcm1zLmNyZWF0ZSgna2VlcC1hbGl2ZScsIHsgcGVyaW9kSW5NaW51dGVzOiAwLjUgfSk7XG5jaHJvbWUuYWxhcm1zLm9uQWxhcm0uYWRkTGlzdGVuZXIoKGFsYXJtKSA9PiB7XG4gICAgaWYgKGFsYXJtLm5hbWUgPT09ICdrZWVwLWFsaXZlJykge1xuICAgICAgICAvLyBjb25zb2xlLmxvZygnW2FpQ2xhdy1CR10gS2VlcC1hbGl2ZSBhbGFybSB0cmlnZ2VyZWQnKTtcbiAgICB9XG59KTtcbi8vIOKUgOKUgCDlkK/liqjml6Xlv5cg4pSA4pSAXG5jb25zb2xlLmxvZygnJWNbYWlDbGF3LUJHXSDwn5qAIEJhY2tncm91bmQgc2VydmljZSB3b3JrZXIgc3RhcnRlZC4nLCAnY29sb3I6ICM2MGE1ZmE7IGZvbnQtd2VpZ2h0OiBib2xkOyBmb250LXNpemU6IDEzcHg7Jyk7XG4iLCIvLyBzcmMvdXRpbHMvc3NlLXBhcnNlci50c1xuLyoqXG4gKiBBIHV0aWxpdHkgY2xhc3MgZm9yIHBhcnNpbmcgU2VydmVyLVNlbnQgRXZlbnRzIChTU0UpIHN0cmVhbXMuXG4gKiBJdCBoYW5kbGVzIHRoZSBsb3ctbGV2ZWwgZGV0YWlscyBvZiByZWFkaW5nIGZyb20gYSBSZWFkYWJsZVN0cmVhbSxcbiAqIGRlY29kaW5nIGNodW5rcywgYW5kIHBhcnNpbmcgU1NFIG1lc3NhZ2UgZXZlbnRzLlxuICovXG5leHBvcnQgY2xhc3MgU3NlUGFyc2VyIHtcbiAgICAvKipcbiAgICAgKiBQYXJzZXMgYW4gU1NFIHN0cmVhbSBmcm9tIGEgZmV0Y2ggcmVzcG9uc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gcmVzcG9uc2UgVGhlIGZldGNoIFJlc3BvbnNlIG9iamVjdC5cbiAgICAgKiBAcGFyYW0gb25NZXNzYWdlIEEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGludm9rZWQgZm9yIGVhY2ggU1NFIG1lc3NhZ2UgZXZlbnQuXG4gICAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiB0aGUgc3RyZWFtIGlzIGZ1bGx5IGNvbnN1bWVkLlxuICAgICAqL1xuICAgIGFzeW5jIHBhcnNlKHJlc3BvbnNlLCBvbk1lc3NhZ2UpIHtcbiAgICAgICAgaWYgKCFyZXNwb25zZS5ib2R5KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Jlc3BvbnNlIGJvZHkgaXMgbnVsbCcpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlYWRlciA9IHJlc3BvbnNlLmJvZHkuZ2V0UmVhZGVyKCk7XG4gICAgICAgIGNvbnN0IGRlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoKTtcbiAgICAgICAgbGV0IGJ1ZmZlciA9ICcnO1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgY29uc3QgeyBkb25lLCB2YWx1ZSB9ID0gYXdhaXQgcmVhZGVyLnJlYWQoKTtcbiAgICAgICAgICAgIGlmIChkb25lKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJ1ZmZlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJvY2Vzc0J1ZmZlcihidWZmZXIsIG9uTWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgY2h1bmsgPSBkZWNvZGVyLmRlY29kZSh2YWx1ZSwgeyBzdHJlYW06IHRydWUgfSk7XG4gICAgICAgICAgICBidWZmZXIgKz0gY2h1bms7XG4gICAgICAgICAgICBjb25zdCBsYXN0TmV3bGluZSA9IGJ1ZmZlci5sYXN0SW5kZXhPZignXFxuJyk7XG4gICAgICAgICAgICBpZiAobGFzdE5ld2xpbmUgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJvY2Vzc2FibGUgPSBidWZmZXIuc3Vic3RyaW5nKDAsIGxhc3ROZXdsaW5lKTtcbiAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3NCdWZmZXIocHJvY2Vzc2FibGUsIG9uTWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgYnVmZmVyID0gYnVmZmVyLnN1YnN0cmluZyhsYXN0TmV3bGluZSArIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHByb2Nlc3NCdWZmZXIoYnVmZmVyLCBvbk1lc3NhZ2UpIHtcbiAgICAgICAgY29uc3QgbGluZXMgPSBidWZmZXIuc3BsaXQoJ1xcbicpO1xuICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICAgIGlmIChsaW5lLnN0YXJ0c1dpdGgoJ2RhdGE6ICcpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YVN0ciA9IGxpbmUuc3Vic3RyaW5nKDYpO1xuICAgICAgICAgICAgICAgIGlmIChkYXRhU3RyID09PSAnW0RPTkVdJykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47IC8vIEVuZCBvZiBzdHJlYW1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UoZGF0YVN0cik7XG4gICAgICAgICAgICAgICAgICAgIG9uTWVzc2FnZShkYXRhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gSWdub3JlIHBhcnNpbmcgZXJyb3JzIGZvciBub24tSlNPTiBkYXRhXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuIiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRpZiAoIShtb2R1bGVJZCBpbiBfX3dlYnBhY2tfbW9kdWxlc19fKSkge1xuXHRcdGRlbGV0ZSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRcdHZhciBlID0gbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIiArIG1vZHVsZUlkICsgXCInXCIpO1xuXHRcdGUuY29kZSA9ICdNT0RVTEVfTk9UX0ZPVU5EJztcblx0XHR0aHJvdyBlO1xuXHR9XG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiLy8gZGVmaW5lIGdldHRlciBmdW5jdGlvbnMgZm9yIGhhcm1vbnkgZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5kID0gKGV4cG9ydHMsIGRlZmluaXRpb24pID0+IHtcblx0Zm9yKHZhciBrZXkgaW4gZGVmaW5pdGlvbikge1xuXHRcdGlmKF9fd2VicGFja19yZXF1aXJlX18ubyhkZWZpbml0aW9uLCBrZXkpICYmICFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywga2V5KSkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGRlZmluaXRpb25ba2V5XSB9KTtcblx0XHR9XG5cdH1cbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsIiIsIi8vIHN0YXJ0dXBcbi8vIExvYWQgZW50cnkgbW9kdWxlIGFuZCByZXR1cm4gZXhwb3J0c1xuLy8gVGhpcyBlbnRyeSBtb2R1bGUgaXMgcmVmZXJlbmNlZCBieSBvdGhlciBtb2R1bGVzIHNvIGl0IGNhbid0IGJlIGlubGluZWRcbnZhciBfX3dlYnBhY2tfZXhwb3J0c19fID0gX193ZWJwYWNrX3JlcXVpcmVfXyhcIi4vc3JjL3NlcnZpY2Vfd29yay9iYWNrZ3JvdW5kLnRzXCIpO1xuIiwiIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9