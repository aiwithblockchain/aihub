/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/bridge/local-bridge-socket.ts"
/*!*******************************************!*\
  !*** ./src/bridge/local-bridge-socket.ts ***!
  \*******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LocalBridgeSocket: () => (/* binding */ LocalBridgeSocket)
/* harmony export */ });
/* harmony import */ var _ws_protocol__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ws-protocol */ "./src/bridge/ws-protocol.ts");

class LocalBridgeSocket {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.heartbeatInterval = null;
        this.serverInfo = null;
        this.lastPongTimestamp = 0;
        this.queryAITabsHandler = null;
        this.WS_URL = 'ws://127.0.0.1:8766/ws'; // Default
        this.isConnecting = false;
        this.connect();
    }
    reconnectWithNewPort(port) {
        console.log(`[aiClaw] reconnecting to new port: ${port}`);
        this.WS_URL = `ws://127.0.0.1:${port}/ws`;
        this.isConnecting = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.onclose = null; // prevent standard reconnect loop
            this.ws.close();
            this.ws = null;
        }
        this.reconnectAttempts = 0;
        this.connect();
    }
    async connect() {
        if (this.isConnecting)
            return;
        if (this.ws &&
            (this.ws.readyState === WebSocket.CONNECTING ||
                this.ws.readyState === WebSocket.OPEN)) {
            return;
        }
        // Check dynamic port
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const res = await chrome.storage.local.get('wsPort');
                if (res.wsPort) {
                    this.WS_URL = `ws://127.0.0.1:${res.wsPort}/ws`;
                }
            }
        }
        catch (e) {
            console.warn('[aiClaw] failed to get dynamic port', e);
        }
        this.isConnecting = true;
        console.log(`[aiClaw] websocket connecting to ${this.WS_URL}...`);
        try {
            this.ws = new WebSocket(this.WS_URL);
            this.ws.onopen = () => {
                console.log('[aiClaw] websocket open');
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.lastPongTimestamp = Date.now();
                this.sendHello();
            };
            this.ws.onclose = () => {
                console.log('[aiClaw] websocket closed');
                this.isConnecting = false;
                this.stopHeartbeat();
                this.scheduleReconnect();
            };
            this.ws.onerror = () => {
                // Use regular log to stay silent in Chrome extension error list
                console.log('[aiClaw] connection notice: server offline');
                this.isConnecting = false;
            };
            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };
        }
        catch (e) {
            console.log('[aiClaw] initialization notice:', e);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            return;
        const delay = this.getReconnectDelay();
        console.log(`[aiClaw] websocket reconnect scheduled in ${delay}ms`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.reconnectAttempts++;
            this.connect();
        }, delay);
    }
    getReconnectDelay() {
        switch (this.reconnectAttempts) {
            case 0: return 1000;
            case 1: return 2000;
            case 2: return 5000;
            default: return 10000;
        }
    }
    sendHello() {
        const hello = {
            id: `hello_${Date.now()}`,
            type: _ws_protocol__WEBPACK_IMPORTED_MODULE_0__.MESSAGE_TYPES.CLIENT_HELLO,
            source: 'aiClaw',
            target: 'LocalBridgeMac',
            timestamp: Date.now(),
            payload: {
                protocolName: _ws_protocol__WEBPACK_IMPORTED_MODULE_0__.PROTOCOL_NAME,
                protocolVersion: _ws_protocol__WEBPACK_IMPORTED_MODULE_0__.PROTOCOL_VERSION,
                clientName: 'aiClaw',
                clientVersion: '0.1.0',
                browser: 'chrome',
                capabilities: ['query_ai_tabs_status'],
            },
        };
        this.send(hello);
    }
    handleMessage(data) {
        try {
            const msg = JSON.parse(data);
            console.log(`[aiClaw] received message: ${msg.type}`);
            switch (msg.type) {
                case _ws_protocol__WEBPACK_IMPORTED_MODULE_0__.MESSAGE_TYPES.SERVER_HELLO_ACK:
                    this.handleHelloAck(msg);
                    break;
                case _ws_protocol__WEBPACK_IMPORTED_MODULE_0__.MESSAGE_TYPES.PONG:
                    console.log('[aiClaw] received pong');
                    this.lastPongTimestamp = Date.now();
                    break;
                case _ws_protocol__WEBPACK_IMPORTED_MODULE_0__.MESSAGE_TYPES.REQUEST_QUERY_AI_TABS_STATUS:
                    this.handleQueryAITabsStatus(msg);
                    break;
                default:
                    console.warn(`[aiClaw] unknown message type: ${msg.type}`);
            }
        }
        catch (e) {
            console.error('[aiClaw] failed to parse message:', e);
        }
    }
    handleHelloAck(msg) {
        console.log('[aiClaw] received server.hello_ack');
        this.serverInfo = msg.payload;
        this.startHeartbeat(msg.payload.heartbeatIntervalMs || 20000);
    }
    async handleQueryAITabsStatus(req) {
        console.log('[aiClaw] handling request.query_ai_tabs_status');
        if (!this.queryAITabsHandler) {
            console.error('[aiClaw] no handler for query_ai_tabs_status');
            return;
        }
        try {
            const result = await this.queryAITabsHandler();
            const resp = {
                id: req.id,
                type: _ws_protocol__WEBPACK_IMPORTED_MODULE_0__.MESSAGE_TYPES.RESPONSE_QUERY_AI_TABS_STATUS,
                source: 'aiClaw',
                target: 'LocalBridgeMac',
                timestamp: Date.now(),
                payload: result,
            };
            this.send(resp);
        }
        catch (e) {
            const errResp = {
                id: req.id,
                type: _ws_protocol__WEBPACK_IMPORTED_MODULE_0__.MESSAGE_TYPES.RESPONSE_ERROR,
                source: 'aiClaw',
                target: 'LocalBridgeMac',
                timestamp: Date.now(),
                payload: {
                    code: 'INTERNAL_ERROR',
                    message: e instanceof Error ? e.message : String(e),
                    details: null,
                },
            };
            this.send(errResp);
        }
    }
    startHeartbeat(interval) {
        this.stopHeartbeat();
        console.log(`[aiClaw] starting heartbeat every ${interval}ms`);
        this.heartbeatInterval = setInterval(() => {
            // Check for timeout (60 seconds)
            const now = Date.now();
            if (this.lastPongTimestamp > 0 && now - this.lastPongTimestamp > 60000) {
                console.error('[aiClaw] pong timeout, closing socket');
                this.ws?.close();
                return;
            }
            this.sendPing();
        }, interval);
    }
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    sendPing() {
        const ping = {
            id: `ping_${Date.now()}`,
            type: _ws_protocol__WEBPACK_IMPORTED_MODULE_0__.MESSAGE_TYPES.PING,
            source: 'aiClaw',
            target: 'LocalBridgeMac',
            timestamp: Date.now(),
            payload: {
                heartbeatIntervalMs: 20000,
            },
        };
        this.send(ping);
    }
    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
            console.log(`[aiClaw] sent message: ${msg.type}`);
        }
        else {
            console.warn(`[aiClaw] cannot send message, socket status: ${this.ws?.readyState}`);
        }
    }
}


/***/ },

/***/ "./src/bridge/ws-protocol.ts"
/*!***********************************!*\
  !*** ./src/bridge/ws-protocol.ts ***!
  \***********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ERROR_CODES: () => (/* binding */ ERROR_CODES),
/* harmony export */   MESSAGE_TYPES: () => (/* binding */ MESSAGE_TYPES),
/* harmony export */   PROTOCOL_NAME: () => (/* binding */ PROTOCOL_NAME),
/* harmony export */   PROTOCOL_VERSION: () => (/* binding */ PROTOCOL_VERSION)
/* harmony export */ });
const PROTOCOL_NAME = 'aihub-localbridge';
const PROTOCOL_VERSION = 'v1';
const MESSAGE_TYPES = {
    CLIENT_HELLO: 'client.hello',
    SERVER_HELLO_ACK: 'server.hello_ack',
    PING: 'ping',
    PONG: 'pong',
    REQUEST_QUERY_AI_TABS_STATUS: 'request.query_ai_tabs_status',
    RESPONSE_QUERY_AI_TABS_STATUS: 'response.query_ai_tabs_status',
    RESPONSE_ERROR: 'response.error',
};
const ERROR_CODES = {
    INVALID_JSON: 'INVALID_JSON',
    INVALID_MESSAGE_SHAPE: 'INVALID_MESSAGE_SHAPE',
    UNSUPPORTED_MESSAGE_TYPE: 'UNSUPPORTED_MESSAGE_TYPE',
    PROTOCOL_VERSION_MISMATCH: 'PROTOCOL_VERSION_MISMATCH',
    NOT_CONNECTED: 'NOT_CONNECTED',
    REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
};


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
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!****************************************!*\
  !*** ./src/service_work/background.ts ***!
  \****************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   clearPlatformCredentials: () => (/* binding */ clearPlatformCredentials)
/* harmony export */ });
/* harmony import */ var _capture_consts__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../capture/consts */ "./src/capture/consts.ts");
/* harmony import */ var _bridge_local_bridge_socket__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../bridge/local-bridge-socket */ "./src/bridge/local-bridge-socket.ts");
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
    // 0. WebSocket port update
    if (message.type === 'WS_PORT_CHANGED') {
        localBridge.reconnectWithNewPort(message.port);
        if (sendResponse)
            sendResponse({ ok: true });
        return;
    }
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
// ── LocalBridge WebSocket 客户端 ──
async function queryAITabsStatus() {
    // 查询所有 AI 平台的 tabs
    const chatgptTabs = await chrome.tabs.query({
        url: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
    });
    const geminiTabs = await chrome.tabs.query({
        url: ['https://gemini.google.com/*'],
    });
    const grokTabs = await chrome.tabs.query({
        url: ['https://grok.com/*', 'https://x.com/i/grok*'],
    });
    const allTabs = [];
    for (const tab of chatgptTabs) {
        if (tab.id && tab.url) {
            allTabs.push({ tabId: tab.id, url: tab.url, platform: 'chatgpt', active: tab.active || false });
        }
    }
    for (const tab of geminiTabs) {
        if (tab.id && tab.url) {
            allTabs.push({ tabId: tab.id, url: tab.url, platform: 'gemini', active: tab.active || false });
        }
    }
    for (const tab of grokTabs) {
        if (tab.id && tab.url) {
            allTabs.push({ tabId: tab.id, url: tab.url, platform: 'grok', active: tab.active || false });
        }
    }
    const activeTab = allTabs.find(t => t.active) || null;
    return {
        hasAITabs: allTabs.length > 0,
        platforms: {
            chatgpt: chatgptTabs.length > 0,
            gemini: geminiTabs.length > 0,
            grok: grokTabs.length > 0,
        },
        activeAITabId: activeTab?.tabId || null,
        activeAIUrl: activeTab?.url || null,
        tabs: allTabs,
    };
}
const localBridge = new _bridge_local_bridge_socket__WEBPACK_IMPORTED_MODULE_1__.LocalBridgeSocket();
localBridge.queryAITabsHandler = queryAITabsStatus;
// ── 启动日志 ──
console.log('%c[aiClaw-BG] 🚀 Background service worker started.', 'color: #60a5fa; font-weight: bold; font-size: 13px;');

})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianMvYmFja2dyb3VuZC5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBZ0Y7QUFDekU7QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0RBQWdEO0FBQ2hEO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsMERBQTBELEtBQUs7QUFDL0Qsd0NBQXdDLEtBQUs7QUFDN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esb0NBQW9DO0FBQ3BDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esb0RBQW9ELFdBQVc7QUFDL0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx3REFBd0QsWUFBWTtBQUNwRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlFQUFpRSxNQUFNO0FBQ3ZFO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx5QkFBeUIsV0FBVztBQUNwQyxrQkFBa0IsdURBQWE7QUFDL0I7QUFDQTtBQUNBO0FBQ0E7QUFDQSw4QkFBOEIsdURBQWE7QUFDM0MsaUNBQWlDLDBEQUFnQjtBQUNqRDtBQUNBO0FBQ0E7QUFDQTtBQUNBLGFBQWE7QUFDYjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzREFBc0QsU0FBUztBQUMvRDtBQUNBLHFCQUFxQix1REFBYTtBQUNsQztBQUNBO0FBQ0EscUJBQXFCLHVEQUFhO0FBQ2xDO0FBQ0E7QUFDQTtBQUNBLHFCQUFxQix1REFBYTtBQUNsQztBQUNBO0FBQ0E7QUFDQSxtRUFBbUUsU0FBUztBQUM1RTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQkFBc0IsdURBQWE7QUFDbkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQkFBc0IsdURBQWE7QUFDbkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EseURBQXlELFNBQVM7QUFDbEU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHdCQUF3QixXQUFXO0FBQ25DLGtCQUFrQix1REFBYTtBQUMvQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsYUFBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGtEQUFrRCxTQUFTO0FBQzNEO0FBQ0E7QUFDQSx5RUFBeUUsb0JBQW9CO0FBQzdGO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDL05PO0FBQ0E7QUFDQTtBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLGtEQUFrRDtBQUN6RDtBQUNPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQywwQkFBMEI7QUFDM0I7QUFDTztBQUNQO0FBQ0E7QUFDTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ087QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7O1VDL0RBO1VBQ0E7O1VBRUE7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7O1VBRUE7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTs7VUFFQTtVQUNBO1VBQ0E7Ozs7O1dDNUJBO1dBQ0E7V0FDQTtXQUNBO1dBQ0EseUNBQXlDLHdDQUF3QztXQUNqRjtXQUNBO1dBQ0EsRTs7Ozs7V0NQQSx3Rjs7Ozs7V0NBQTtXQUNBO1dBQ0E7V0FDQSx1REFBdUQsaUJBQWlCO1dBQ3hFO1dBQ0EsZ0RBQWdELGFBQWE7V0FDN0QsRTs7Ozs7Ozs7Ozs7Ozs7OztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDcUU7QUFDSDtBQUNsRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwrQkFBK0I7QUFDL0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwrQ0FBK0Msb0VBQXVCO0FBQ3RFLHNCQUFzQixvRUFBdUI7QUFDN0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EscUNBQXFDLENBQUMsb0VBQXVCLFVBQVU7QUFDdkU7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGFBQWEsZ0NBQWdDO0FBQzdDO0FBQ0EsOERBQThELFNBQVMsY0FBYyxjQUFjLFdBQVcsZ0JBQWdCLHNDQUFzQztBQUNwSztBQUNPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQSwyREFBMkQsU0FBUztBQUNwRTtBQUNBO0FBQ0E7QUFDQSxrRkFBa0YsbUJBQW1CLGdCQUFnQjtBQUNySDtBQUNBLG9EQUFvRCxvRUFBdUI7QUFDM0Usa0JBQWtCLG9FQUF1QjtBQUN6QztBQUNBO0FBQ0E7QUFDQSxDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsMkJBQTJCLFVBQVU7QUFDckM7QUFDQTtBQUNBO0FBQ0EseUJBQXlCLG9EQUFPO0FBQ2hDLGdCQUFnQixnREFBZ0Q7QUFDaEU7QUFDQSx5R0FBeUc7QUFDekc7QUFDQSxnQkFBZ0I7QUFDaEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsK0JBQStCLHdDQUF3QztBQUN2RTtBQUNBO0FBQ0EsK0JBQStCLHVDQUF1QyxTQUFTLEdBQUc7QUFDbEY7QUFDQSxTQUFTO0FBQ1QscUJBQXFCO0FBQ3JCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwyQkFBMkIsOENBQThDO0FBQ3pFLFNBQVM7QUFDVCxxQkFBcUI7QUFDckI7QUFDQTtBQUNBLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHlFQUF5RTtBQUN6RSwyRUFBMkUsU0FBUztBQUNwRjtBQUNBO0FBQ0EsYUFBYTtBQUNiLENBQUMsSUFBSSxnQ0FBZ0M7QUFDckM7QUFDQTtBQUNBO0FBQ0EsQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBLDJCQUEyQiwrRUFBK0U7QUFDMUc7QUFDQTtBQUNBO0FBQ0E7QUFDQSwyQkFBMkIsOEVBQThFO0FBQ3pHO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsMkJBQTJCLDRFQUE0RTtBQUN2RztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHdCQUF3QiwwRUFBaUI7QUFDekM7QUFDQTtBQUNBLG9GQUFvRixtQkFBbUIsZ0JBQWdCIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vYWlDbGF3Ly4vc3JjL2JyaWRnZS9sb2NhbC1icmlkZ2Utc29ja2V0LnRzIiwid2VicGFjazovL2FpQ2xhdy8uL3NyYy9icmlkZ2Uvd3MtcHJvdG9jb2wudHMiLCJ3ZWJwYWNrOi8vYWlDbGF3Ly4vc3JjL2NhcHR1cmUvY29uc3RzLnRzIiwid2VicGFjazovL2FpQ2xhdy93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9haUNsYXcvd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL2FpQ2xhdy93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL2FpQ2xhdy93ZWJwYWNrL3J1bnRpbWUvbWFrZSBuYW1lc3BhY2Ugb2JqZWN0Iiwid2VicGFjazovL2FpQ2xhdy8uL3NyYy9zZXJ2aWNlX3dvcmsvYmFja2dyb3VuZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBNRVNTQUdFX1RZUEVTLCBQUk9UT0NPTF9OQU1FLCBQUk9UT0NPTF9WRVJTSU9OLCB9IGZyb20gJy4vd3MtcHJvdG9jb2wnO1xuZXhwb3J0IGNsYXNzIExvY2FsQnJpZGdlU29ja2V0IHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy53cyA9IG51bGw7XG4gICAgICAgIHRoaXMucmVjb25uZWN0QXR0ZW1wdHMgPSAwO1xuICAgICAgICB0aGlzLnJlY29ubmVjdFRpbWVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5oZWFydGJlYXRJbnRlcnZhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuc2VydmVySW5mbyA9IG51bGw7XG4gICAgICAgIHRoaXMubGFzdFBvbmdUaW1lc3RhbXAgPSAwO1xuICAgICAgICB0aGlzLnF1ZXJ5QUlUYWJzSGFuZGxlciA9IG51bGw7XG4gICAgICAgIHRoaXMuV1NfVVJMID0gJ3dzOi8vMTI3LjAuMC4xOjg3NjYvd3MnOyAvLyBEZWZhdWx0XG4gICAgICAgIHRoaXMuaXNDb25uZWN0aW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuY29ubmVjdCgpO1xuICAgIH1cbiAgICByZWNvbm5lY3RXaXRoTmV3UG9ydChwb3J0KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbYWlDbGF3XSByZWNvbm5lY3RpbmcgdG8gbmV3IHBvcnQ6ICR7cG9ydH1gKTtcbiAgICAgICAgdGhpcy5XU19VUkwgPSBgd3M6Ly8xMjcuMC4wLjE6JHtwb3J0fS93c2A7XG4gICAgICAgIHRoaXMuaXNDb25uZWN0aW5nID0gZmFsc2U7XG4gICAgICAgIGlmICh0aGlzLnJlY29ubmVjdFRpbWVyKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5yZWNvbm5lY3RUaW1lcik7XG4gICAgICAgICAgICB0aGlzLnJlY29ubmVjdFRpbWVyID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy53cykge1xuICAgICAgICAgICAgdGhpcy53cy5vbmNsb3NlID0gbnVsbDsgLy8gcHJldmVudCBzdGFuZGFyZCByZWNvbm5lY3QgbG9vcFxuICAgICAgICAgICAgdGhpcy53cy5jbG9zZSgpO1xuICAgICAgICAgICAgdGhpcy53cyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZWNvbm5lY3RBdHRlbXB0cyA9IDA7XG4gICAgICAgIHRoaXMuY29ubmVjdCgpO1xuICAgIH1cbiAgICBhc3luYyBjb25uZWN0KCkge1xuICAgICAgICBpZiAodGhpcy5pc0Nvbm5lY3RpbmcpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGlmICh0aGlzLndzICYmXG4gICAgICAgICAgICAodGhpcy53cy5yZWFkeVN0YXRlID09PSBXZWJTb2NrZXQuQ09OTkVDVElORyB8fFxuICAgICAgICAgICAgICAgIHRoaXMud3MucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0Lk9QRU4pKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ2hlY2sgZHluYW1pYyBwb3J0XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGNocm9tZSAhPT0gJ3VuZGVmaW5lZCcgJiYgY2hyb21lLnN0b3JhZ2UpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoJ3dzUG9ydCcpO1xuICAgICAgICAgICAgICAgIGlmIChyZXMud3NQb3J0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuV1NfVVJMID0gYHdzOi8vMTI3LjAuMC4xOiR7cmVzLndzUG9ydH0vd3NgO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCdbYWlDbGF3XSBmYWlsZWQgdG8gZ2V0IGR5bmFtaWMgcG9ydCcsIGUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuaXNDb25uZWN0aW5nID0gdHJ1ZTtcbiAgICAgICAgY29uc29sZS5sb2coYFthaUNsYXddIHdlYnNvY2tldCBjb25uZWN0aW5nIHRvICR7dGhpcy5XU19VUkx9Li4uYCk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLndzID0gbmV3IFdlYlNvY2tldCh0aGlzLldTX1VSTCk7XG4gICAgICAgICAgICB0aGlzLndzLm9ub3BlbiA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW2FpQ2xhd10gd2Vic29ja2V0IG9wZW4nKTtcbiAgICAgICAgICAgICAgICB0aGlzLmlzQ29ubmVjdGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMucmVjb25uZWN0QXR0ZW1wdHMgPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMubGFzdFBvbmdUaW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2VuZEhlbGxvKCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy53cy5vbmNsb3NlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbYWlDbGF3XSB3ZWJzb2NrZXQgY2xvc2VkJyk7XG4gICAgICAgICAgICAgICAgdGhpcy5pc0Nvbm5lY3RpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0aGlzLnN0b3BIZWFydGJlYXQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNjaGVkdWxlUmVjb25uZWN0KCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy53cy5vbmVycm9yID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIFVzZSByZWd1bGFyIGxvZyB0byBzdGF5IHNpbGVudCBpbiBDaHJvbWUgZXh0ZW5zaW9uIGVycm9yIGxpc3RcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW2FpQ2xhd10gY29ubmVjdGlvbiBub3RpY2U6IHNlcnZlciBvZmZsaW5lJyk7XG4gICAgICAgICAgICAgICAgdGhpcy5pc0Nvbm5lY3RpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLndzLm9ubWVzc2FnZSA9IChldmVudCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlTWVzc2FnZShldmVudC5kYXRhKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbYWlDbGF3XSBpbml0aWFsaXphdGlvbiBub3RpY2U6JywgZSk7XG4gICAgICAgICAgICB0aGlzLmlzQ29ubmVjdGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5zY2hlZHVsZVJlY29ubmVjdCgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHNjaGVkdWxlUmVjb25uZWN0KCkge1xuICAgICAgICBpZiAodGhpcy5yZWNvbm5lY3RUaW1lcilcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgY29uc3QgZGVsYXkgPSB0aGlzLmdldFJlY29ubmVjdERlbGF5KCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbYWlDbGF3XSB3ZWJzb2NrZXQgcmVjb25uZWN0IHNjaGVkdWxlZCBpbiAke2RlbGF5fW1zYCk7XG4gICAgICAgIHRoaXMucmVjb25uZWN0VGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVjb25uZWN0VGltZXIgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5yZWNvbm5lY3RBdHRlbXB0cysrO1xuICAgICAgICAgICAgdGhpcy5jb25uZWN0KCk7XG4gICAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gICAgZ2V0UmVjb25uZWN0RGVsYXkoKSB7XG4gICAgICAgIHN3aXRjaCAodGhpcy5yZWNvbm5lY3RBdHRlbXB0cykge1xuICAgICAgICAgICAgY2FzZSAwOiByZXR1cm4gMTAwMDtcbiAgICAgICAgICAgIGNhc2UgMTogcmV0dXJuIDIwMDA7XG4gICAgICAgICAgICBjYXNlIDI6IHJldHVybiA1MDAwO1xuICAgICAgICAgICAgZGVmYXVsdDogcmV0dXJuIDEwMDAwO1xuICAgICAgICB9XG4gICAgfVxuICAgIHNlbmRIZWxsbygpIHtcbiAgICAgICAgY29uc3QgaGVsbG8gPSB7XG4gICAgICAgICAgICBpZDogYGhlbGxvXyR7RGF0ZS5ub3coKX1gLFxuICAgICAgICAgICAgdHlwZTogTUVTU0FHRV9UWVBFUy5DTElFTlRfSEVMTE8sXG4gICAgICAgICAgICBzb3VyY2U6ICdhaUNsYXcnLFxuICAgICAgICAgICAgdGFyZ2V0OiAnTG9jYWxCcmlkZ2VNYWMnLFxuICAgICAgICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgICAgICAgcGF5bG9hZDoge1xuICAgICAgICAgICAgICAgIHByb3RvY29sTmFtZTogUFJPVE9DT0xfTkFNRSxcbiAgICAgICAgICAgICAgICBwcm90b2NvbFZlcnNpb246IFBST1RPQ09MX1ZFUlNJT04sXG4gICAgICAgICAgICAgICAgY2xpZW50TmFtZTogJ2FpQ2xhdycsXG4gICAgICAgICAgICAgICAgY2xpZW50VmVyc2lvbjogJzAuMS4wJyxcbiAgICAgICAgICAgICAgICBicm93c2VyOiAnY2hyb21lJyxcbiAgICAgICAgICAgICAgICBjYXBhYmlsaXRpZXM6IFsncXVlcnlfYWlfdGFic19zdGF0dXMnXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuc2VuZChoZWxsbyk7XG4gICAgfVxuICAgIGhhbmRsZU1lc3NhZ2UoZGF0YSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbXNnID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbYWlDbGF3XSByZWNlaXZlZCBtZXNzYWdlOiAke21zZy50eXBlfWApO1xuICAgICAgICAgICAgc3dpdGNoIChtc2cudHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgTUVTU0FHRV9UWVBFUy5TRVJWRVJfSEVMTE9fQUNLOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZUhlbGxvQWNrKG1zZyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgTUVTU0FHRV9UWVBFUy5QT05HOlxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW2FpQ2xhd10gcmVjZWl2ZWQgcG9uZycpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmxhc3RQb25nVGltZXN0YW1wID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBNRVNTQUdFX1RZUEVTLlJFUVVFU1RfUVVFUllfQUlfVEFCU19TVEFUVVM6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlUXVlcnlBSVRhYnNTdGF0dXMobXNnKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBbYWlDbGF3XSB1bmtub3duIG1lc3NhZ2UgdHlwZTogJHttc2cudHlwZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW2FpQ2xhd10gZmFpbGVkIHRvIHBhcnNlIG1lc3NhZ2U6JywgZSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaGFuZGxlSGVsbG9BY2sobXNnKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbYWlDbGF3XSByZWNlaXZlZCBzZXJ2ZXIuaGVsbG9fYWNrJyk7XG4gICAgICAgIHRoaXMuc2VydmVySW5mbyA9IG1zZy5wYXlsb2FkO1xuICAgICAgICB0aGlzLnN0YXJ0SGVhcnRiZWF0KG1zZy5wYXlsb2FkLmhlYXJ0YmVhdEludGVydmFsTXMgfHwgMjAwMDApO1xuICAgIH1cbiAgICBhc3luYyBoYW5kbGVRdWVyeUFJVGFic1N0YXR1cyhyZXEpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1thaUNsYXddIGhhbmRsaW5nIHJlcXVlc3QucXVlcnlfYWlfdGFic19zdGF0dXMnKTtcbiAgICAgICAgaWYgKCF0aGlzLnF1ZXJ5QUlUYWJzSGFuZGxlcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW2FpQ2xhd10gbm8gaGFuZGxlciBmb3IgcXVlcnlfYWlfdGFic19zdGF0dXMnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5xdWVyeUFJVGFic0hhbmRsZXIoKTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3AgPSB7XG4gICAgICAgICAgICAgICAgaWQ6IHJlcS5pZCxcbiAgICAgICAgICAgICAgICB0eXBlOiBNRVNTQUdFX1RZUEVTLlJFU1BPTlNFX1FVRVJZX0FJX1RBQlNfU1RBVFVTLFxuICAgICAgICAgICAgICAgIHNvdXJjZTogJ2FpQ2xhdycsXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiAnTG9jYWxCcmlkZ2VNYWMnLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgICAgICBwYXlsb2FkOiByZXN1bHQsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy5zZW5kKHJlc3ApO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zdCBlcnJSZXNwID0ge1xuICAgICAgICAgICAgICAgIGlkOiByZXEuaWQsXG4gICAgICAgICAgICAgICAgdHlwZTogTUVTU0FHRV9UWVBFUy5SRVNQT05TRV9FUlJPUixcbiAgICAgICAgICAgICAgICBzb3VyY2U6ICdhaUNsYXcnLFxuICAgICAgICAgICAgICAgIHRhcmdldDogJ0xvY2FsQnJpZGdlTWFjJyxcbiAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICAgICAgICAgICAgcGF5bG9hZDoge1xuICAgICAgICAgICAgICAgICAgICBjb2RlOiAnSU5URVJOQUxfRVJST1InLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSksXG4gICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IG51bGwsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLnNlbmQoZXJyUmVzcCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgc3RhcnRIZWFydGJlYXQoaW50ZXJ2YWwpIHtcbiAgICAgICAgdGhpcy5zdG9wSGVhcnRiZWF0KCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbYWlDbGF3XSBzdGFydGluZyBoZWFydGJlYXQgZXZlcnkgJHtpbnRlcnZhbH1tc2ApO1xuICAgICAgICB0aGlzLmhlYXJ0YmVhdEludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIHRpbWVvdXQgKDYwIHNlY29uZHMpXG4gICAgICAgICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgaWYgKHRoaXMubGFzdFBvbmdUaW1lc3RhbXAgPiAwICYmIG5vdyAtIHRoaXMubGFzdFBvbmdUaW1lc3RhbXAgPiA2MDAwMCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1thaUNsYXddIHBvbmcgdGltZW91dCwgY2xvc2luZyBzb2NrZXQnKTtcbiAgICAgICAgICAgICAgICB0aGlzLndzPy5jbG9zZSgpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc2VuZFBpbmcoKTtcbiAgICAgICAgfSwgaW50ZXJ2YWwpO1xuICAgIH1cbiAgICBzdG9wSGVhcnRiZWF0KCkge1xuICAgICAgICBpZiAodGhpcy5oZWFydGJlYXRJbnRlcnZhbCkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmhlYXJ0YmVhdEludGVydmFsKTtcbiAgICAgICAgICAgIHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWwgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuICAgIHNlbmRQaW5nKCkge1xuICAgICAgICBjb25zdCBwaW5nID0ge1xuICAgICAgICAgICAgaWQ6IGBwaW5nXyR7RGF0ZS5ub3coKX1gLFxuICAgICAgICAgICAgdHlwZTogTUVTU0FHRV9UWVBFUy5QSU5HLFxuICAgICAgICAgICAgc291cmNlOiAnYWlDbGF3JyxcbiAgICAgICAgICAgIHRhcmdldDogJ0xvY2FsQnJpZGdlTWFjJyxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgIHBheWxvYWQ6IHtcbiAgICAgICAgICAgICAgICBoZWFydGJlYXRJbnRlcnZhbE1zOiAyMDAwMCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuc2VuZChwaW5nKTtcbiAgICB9XG4gICAgc2VuZChtc2cpIHtcbiAgICAgICAgaWYgKHRoaXMud3MgJiYgdGhpcy53cy5yZWFkeVN0YXRlID09PSBXZWJTb2NrZXQuT1BFTikge1xuICAgICAgICAgICAgdGhpcy53cy5zZW5kKEpTT04uc3RyaW5naWZ5KG1zZykpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFthaUNsYXddIHNlbnQgbWVzc2FnZTogJHttc2cudHlwZX1gKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgW2FpQ2xhd10gY2Fubm90IHNlbmQgbWVzc2FnZSwgc29ja2V0IHN0YXR1czogJHt0aGlzLndzPy5yZWFkeVN0YXRlfWApO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwiZXhwb3J0IGNvbnN0IFBST1RPQ09MX05BTUUgPSAnYWlodWItbG9jYWxicmlkZ2UnO1xuZXhwb3J0IGNvbnN0IFBST1RPQ09MX1ZFUlNJT04gPSAndjEnO1xuZXhwb3J0IGNvbnN0IE1FU1NBR0VfVFlQRVMgPSB7XG4gICAgQ0xJRU5UX0hFTExPOiAnY2xpZW50LmhlbGxvJyxcbiAgICBTRVJWRVJfSEVMTE9fQUNLOiAnc2VydmVyLmhlbGxvX2FjaycsXG4gICAgUElORzogJ3BpbmcnLFxuICAgIFBPTkc6ICdwb25nJyxcbiAgICBSRVFVRVNUX1FVRVJZX0FJX1RBQlNfU1RBVFVTOiAncmVxdWVzdC5xdWVyeV9haV90YWJzX3N0YXR1cycsXG4gICAgUkVTUE9OU0VfUVVFUllfQUlfVEFCU19TVEFUVVM6ICdyZXNwb25zZS5xdWVyeV9haV90YWJzX3N0YXR1cycsXG4gICAgUkVTUE9OU0VfRVJST1I6ICdyZXNwb25zZS5lcnJvcicsXG59O1xuZXhwb3J0IGNvbnN0IEVSUk9SX0NPREVTID0ge1xuICAgIElOVkFMSURfSlNPTjogJ0lOVkFMSURfSlNPTicsXG4gICAgSU5WQUxJRF9NRVNTQUdFX1NIQVBFOiAnSU5WQUxJRF9NRVNTQUdFX1NIQVBFJyxcbiAgICBVTlNVUFBPUlRFRF9NRVNTQUdFX1RZUEU6ICdVTlNVUFBPUlRFRF9NRVNTQUdFX1RZUEUnLFxuICAgIFBST1RPQ09MX1ZFUlNJT05fTUlTTUFUQ0g6ICdQUk9UT0NPTF9WRVJTSU9OX01JU01BVENIJyxcbiAgICBOT1RfQ09OTkVDVEVEOiAnTk9UX0NPTk5FQ1RFRCcsXG4gICAgUkVRVUVTVF9USU1FT1VUOiAnUkVRVUVTVF9USU1FT1VUJyxcbiAgICBJTlRFUk5BTF9FUlJPUjogJ0lOVEVSTkFMX0VSUk9SJyxcbn07XG4iLCIvKipcbiAqIGNvbnN0cy50cyAtIGFpQ2xhdyDluLjph4/lrprkuYlcbiAqXG4gKiDlrprkuYnlrZjlgqjplK7lkI3jgIHmtojmga/nsbvlnovjgIHlubPlj7Dnm7jlhbPluLjph4/jgIJcbiAqL1xuLy8g4pSA4pSAIGNocm9tZS5zdG9yYWdlLmxvY2FsIOS4reS9v+eUqOeahOmUruWQjSDilIDilIBcbmV4cG9ydCBjb25zdCBTVE9SQUdFX0tFWV9DUkVERU5USUFMUyA9ICdhY19jcmVkZW50aWFscyc7IC8vIOWtmOWCqOWQhOW5s+WPsOWHreivgVxuLy8g4pSA4pSAIOaJqeWxleWGhemDqOa2iOaBr+exu+WeiyDilIDilIBcbmV4cG9ydCB2YXIgTXNnVHlwZTtcbihmdW5jdGlvbiAoTXNnVHlwZSkge1xuICAgIE1zZ1R5cGVbXCJQSU5HXCJdID0gXCJBQ19QSU5HXCI7XG4gICAgTXNnVHlwZVtcIkNBUFRVUkVEX0NSRURFTlRJQUxTXCJdID0gXCJBQ19DQVBUVVJFRF9DUkVERU5USUFMU1wiO1xuICAgIE1zZ1R5cGVbXCJFWEVDVVRFX1RBU0tcIl0gPSBcIkFDX0VYRUNVVEVfVEFTS1wiO1xuICAgIE1zZ1R5cGVbXCJUQVNLX1JFU1VMVFwiXSA9IFwiQUNfVEFTS19SRVNVTFRcIjtcbiAgICBNc2dUeXBlW1wiQUNfU0VORF9URVNUX01FU1NBR0VcIl0gPSBcIkFDX1NFTkRfVEVTVF9NRVNTQUdFXCI7XG59KShNc2dUeXBlIHx8IChNc2dUeXBlID0ge30pKTtcbi8vIOKUgOKUgCBpbmplY3Rpb24g4oaSIGNvbnRlbnQg55qEIHBvc3RNZXNzYWdlIHNvdXJjZSDmoIfor4Yg4pSA4pSAXG5leHBvcnQgY29uc3QgSU5KRUNUSU9OX1NPVVJDRSA9ICdhaWNsYXctaW5qZWN0aW9uJztcbi8vIOKUgOKUgCDlubPlj7AgVVJMIOWMuemFjeinhOWImSDilIDilIBcbi8vIOeUqOS6jiBpbmplY3Rpb24udHMg5Yik5pat5b2T5YmN5oum5oiq5Yiw55qEIGZldGNoIOivt+axguWxnuS6juWTquS4quW5s+WPsOeahCBBUElcbmV4cG9ydCBjb25zdCBQTEFURk9STV9BUElfUEFUVEVSTlMgPSB7XG4gICAgY2hhdGdwdDogW1xuICAgICAgICAvY2hhdGdwdFxcLmNvbVxcL2JhY2tlbmQtYXBpXFwvLyxcbiAgICAgICAgL2NoYXRcXC5vcGVuYWlcXC5jb21cXC9iYWNrZW5kLWFwaVxcLy8sXG4gICAgXSxcbiAgICBnZW1pbmk6IFtcbiAgICAgICAgL2dlbWluaVxcLmdvb2dsZVxcLmNvbVxcL19cXC9CYXJkQ2hhdFVpXFwvLyxcbiAgICAgICAgL2dlbWluaVxcLmdvb2dsZVxcLmNvbVxcL2FwcFxcL19cXC9CYXJkQ2hhdFVpXFwvLyxcbiAgICAgICAgL2Fsa2FsaW1ha2Vyc3VpdGUtcGFcXC5jbGllbnRzNlxcLmdvb2dsZVxcLmNvbVxcLy8sXG4gICAgXSxcbiAgICBncm9rOiBbXG4gICAgICAgIC9ncm9rXFwuY29tXFwvcmVzdFxcL2FwcC1jaGF0XFwvLyxcbiAgICAgICAgL3hcXC5jb21cXC9pXFwvYXBpXFwvMlxcL2dyb2tcXC8vLFxuICAgIF0sXG59O1xuLyoqXG4gKiDmo4DmtYvkuIDkuKror7fmsYIgVVJMIOaYr+WQpuaYr+aIkeS7rOmcgOimgeWFs+azqOeahCBBSSDlubPlj7AgQVBJIOiwg+eUqOOAglxuICog5aaC5p6c5Yy56YWN77yM6L+U5Zue5bmz5Y+w5ZCN56ew77yb5ZCm5YiZ6L+U5ZueIG51bGzjgIJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRldGVjdFBsYXRmb3JtRnJvbVVybCh1cmwpIHtcbiAgICBmb3IgKGNvbnN0IFtwbGF0Zm9ybSwgcGF0dGVybnNdIG9mIE9iamVjdC5lbnRyaWVzKFBMQVRGT1JNX0FQSV9QQVRURVJOUykpIHtcbiAgICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIHBhdHRlcm5zKSB7XG4gICAgICAgICAgICBpZiAocGF0dGVybi50ZXN0KHVybCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcGxhdGZvcm07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG4vKipcbiAqIOagueaNriBob3N0bmFtZSDmo4DmtYvlvZPliY3pobXpnaLmiYDlnKjnmoTlubPlj7DjgIJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRldGVjdFBsYXRmb3JtRnJvbUhvc3RuYW1lKGhvc3RuYW1lKSB7XG4gICAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKCdjaGF0Z3B0LmNvbScpIHx8IGhvc3RuYW1lLmluY2x1ZGVzKCdjaGF0Lm9wZW5haS5jb20nKSkge1xuICAgICAgICByZXR1cm4gJ2NoYXRncHQnO1xuICAgIH1cbiAgICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoJ2dlbWluaS5nb29nbGUuY29tJykpIHtcbiAgICAgICAgcmV0dXJuICdnZW1pbmknO1xuICAgIH1cbiAgICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoJ2dyb2suY29tJykgfHwgaG9zdG5hbWUuaW5jbHVkZXMoJ3guY29tJykpIHtcbiAgICAgICAgcmV0dXJuICdncm9rJztcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG4iLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdGlmICghKG1vZHVsZUlkIGluIF9fd2VicGFja19tb2R1bGVzX18pKSB7XG5cdFx0ZGVsZXRlIF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdFx0dmFyIGUgPSBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiICsgbW9kdWxlSWQgKyBcIidcIik7XG5cdFx0ZS5jb2RlID0gJ01PRFVMRV9OT1RfRk9VTkQnO1xuXHRcdHRocm93IGU7XG5cdH1cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiLyoqXG4gKiBiYWNrZ3JvdW5kLnRzIC0gYWlDbGF3IEJhY2tncm91bmQgU2VydmljZSBXb3JrZXIgKFBoYXNlIDEpXG4gKlxuICog6IGM6LSj77yaXG4gKiAgIDEuIOaOpeaUtuW5tuWtmOWCqOS7jiBjb250ZW50IHNjcmlwdCDovazlj5HmnaXnmoTlh63or4HmlbDmja5cbiAqICAgMi4g5o+Q5L6b5Yet6K+B5p+l6K+i5o6l5Y+j77yI5L6b5pyq5p2l55qE5Lu75Yqh5omn6KGM5qih5Z2X5L2/55So77yJXG4gKiAgIDMuIOmAmui/hyB3ZWJSZXF1ZXN0IOiiq+WKqOaNleiOtyBCZWFyZXIgVG9rZW7vvIjlhajlsYDooaXlhYXmi6bmiKrvvIlcbiAqICAgNC4g566h55CGIGhvb2sg54q25oCBXG4gKlxuICog5p625p6E5bGC57qn77yaTGF5ZXIgM++8iFNlcnZpY2UgV29ya2Vy77yJXG4gKi9cbmltcG9ydCB7IFNUT1JBR0VfS0VZX0NSRURFTlRJQUxTLCBNc2dUeXBlIH0gZnJvbSAnLi4vY2FwdHVyZS9jb25zdHMnO1xuaW1wb3J0IHsgTG9jYWxCcmlkZ2VTb2NrZXQgfSBmcm9tICcuLi9icmlkZ2UvbG9jYWwtYnJpZGdlLXNvY2tldCc7XG5sZXQgaG9va1N0YXR1c01hcCA9IHt9O1xuLy8g4pSA4pSAIOm7mOiupOepuuWHreivgSDilIDilIBcbmZ1bmN0aW9uIGVtcHR5Q3JlZGVudGlhbHMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgYmVhcmVyVG9rZW46IG51bGwsXG4gICAgICAgIGFwaUVuZHBvaW50OiBudWxsLFxuICAgICAgICBsYXN0Q2FwdHVyZWRIZWFkZXJzOiB7fSxcbiAgICAgICAgbGFzdENhcHR1cmVkQXQ6IDAsXG4gICAgICAgIGNhcHR1cmVDb3VudDogMCxcbiAgICB9O1xufVxuZnVuY3Rpb24gZGVmYXVsdEFsbENyZWRlbnRpYWxzKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIGNoYXRncHQ6IGVtcHR5Q3JlZGVudGlhbHMoKSxcbiAgICAgICAgZ2VtaW5pOiBlbXB0eUNyZWRlbnRpYWxzKCksXG4gICAgICAgIGdyb2s6IGVtcHR5Q3JlZGVudGlhbHMoKSxcbiAgICB9O1xufVxuLy8g4pSA4pSAIOWHreivgeWtmOWCqOaTjeS9nCDilIDilIBcbmFzeW5jIGZ1bmN0aW9uIGxvYWRDcmVkZW50aWFscygpIHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoU1RPUkFHRV9LRVlfQ1JFREVOVElBTFMpO1xuICAgIGNvbnN0IGNyZWRzID0gcmVzW1NUT1JBR0VfS0VZX0NSRURFTlRJQUxTXTtcbiAgICBpZiAoY3JlZHMgJiYgdHlwZW9mIGNyZWRzID09PSAnb2JqZWN0JyAmJiAnY2hhdGdwdCcgaW4gY3JlZHMgJiYgJ2dlbWluaScgaW4gY3JlZHMgJiYgJ2dyb2snIGluIGNyZWRzKSB7XG4gICAgICAgIHJldHVybiBjcmVkcztcbiAgICB9XG4gICAgcmV0dXJuIGRlZmF1bHRBbGxDcmVkZW50aWFscygpO1xufVxuYXN5bmMgZnVuY3Rpb24gc2F2ZUNyZWRlbnRpYWxzKGNyZWRzKSB7XG4gICAgYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHsgW1NUT1JBR0VfS0VZX0NSRURFTlRJQUxTXTogY3JlZHMgfSk7XG59XG5hc3luYyBmdW5jdGlvbiB1cGRhdGVQbGF0Zm9ybUNyZWRlbnRpYWxzKHBsYXRmb3JtLCBiZWFyZXJUb2tlbiwgYXBpVXJsLCBoZWFkZXJzKSB7XG4gICAgY29uc3QgY3JlZHMgPSBhd2FpdCBsb2FkQ3JlZGVudGlhbHMoKTtcbiAgICBjb25zdCBwYyA9IGNyZWRzW3BsYXRmb3JtXTtcbiAgICAvLyDlj6rmnInmlrDlgLzpnZ7nqbrml7bmiY3mm7TmlrDvvIjpmLLmraLopobnm5blt7LmnInlgLzvvIlcbiAgICBpZiAoYmVhcmVyVG9rZW4pIHtcbiAgICAgICAgcGMuYmVhcmVyVG9rZW4gPSBiZWFyZXJUb2tlbjtcbiAgICB9XG4gICAgaWYgKGFwaVVybCkge1xuICAgICAgICBwYy5hcGlFbmRwb2ludCA9IGFwaVVybDtcbiAgICB9XG4gICAgaWYgKE9iamVjdC5rZXlzKGhlYWRlcnMpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgcGMubGFzdENhcHR1cmVkSGVhZGVycyA9IGhlYWRlcnM7XG4gICAgfVxuICAgIHBjLmxhc3RDYXB0dXJlZEF0ID0gRGF0ZS5ub3coKTtcbiAgICBwYy5jYXB0dXJlQ291bnQgKz0gMTtcbiAgICBjcmVkc1twbGF0Zm9ybV0gPSBwYztcbiAgICBhd2FpdCBzYXZlQ3JlZGVudGlhbHMoY3JlZHMpO1xuICAgIC8vIOaJk+WNsOaXpeW/l1xuICAgIGNvbnN0IHRva2VuUHJldmlldyA9IHBjLmJlYXJlclRva2VuXG4gICAgICAgID8gYCR7cGMuYmVhcmVyVG9rZW4uc3Vic3RyaW5nKDAsIDI1KX0uLi5gXG4gICAgICAgIDogJ251bGwnO1xuICAgIGNvbnNvbGUubG9nKGAlY1thaUNsYXctQkddIPCflJAgQ3JlZGVudGlhbHMgdXBkYXRlZCBmb3IgJWMke3BsYXRmb3JtfSVjIHwgVG9rZW46ICR7dG9rZW5QcmV2aWV3fSB8IENvdW50OiAke3BjLmNhcHR1cmVDb3VudH1gLCAnY29sb3I6ICM3MTgwOTYnLCAnY29sb3I6ICM0YWRlODA7IGZvbnQtd2VpZ2h0OiBib2xkJywgJ2NvbG9yOiAjNzE4MDk2Jyk7XG59XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2xlYXJQbGF0Zm9ybUNyZWRlbnRpYWxzKHBsYXRmb3JtKSB7XG4gICAgY29uc3QgY3JlZHMgPSBhd2FpdCBsb2FkQ3JlZGVudGlhbHMoKTtcbiAgICBjcmVkc1twbGF0Zm9ybV0uYmVhcmVyVG9rZW4gPSBudWxsO1xuICAgIGNyZWRzW3BsYXRmb3JtXS5hcGlFbmRwb2ludCA9IG51bGw7XG4gICAgYXdhaXQgc2F2ZUNyZWRlbnRpYWxzKGNyZWRzKTtcbiAgICBjb25zb2xlLmxvZyhgW2FpQ2xhdy1CR10g8J+Xke+4jyBDbGVhcmVkIGNyZWRlbnRpYWxzIGZvciAke3BsYXRmb3JtfWApO1xufVxuLy8g4pSA4pSAIOaJqeWxleWuieijhS/mm7TmlrDkuovku7Yg4pSA4pSAXG5jaHJvbWUucnVudGltZS5vbkluc3RhbGxlZC5hZGRMaXN0ZW5lcihhc3luYyAoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJyVjW2FpQ2xhdy1CR10g8J+agCBFeHRlbnNpb24gaW5zdGFsbGVkL3VwZGF0ZWQuJywgJ2NvbG9yOiAjNjBhNWZhOyBmb250LXdlaWdodDogYm9sZDsgZm9udC1zaXplOiAxM3B4OycpO1xuICAgIC8vIOWIneWni+WMluWHreivgeWtmOWCqO+8iOWmguaenOS4jeWtmOWcqO+8iVxuICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KFNUT1JBR0VfS0VZX0NSRURFTlRJQUxTKTtcbiAgICBpZiAoIWV4aXN0aW5nW1NUT1JBR0VfS0VZX0NSRURFTlRJQUxTXSkge1xuICAgICAgICBhd2FpdCBzYXZlQ3JlZGVudGlhbHMoZGVmYXVsdEFsbENyZWRlbnRpYWxzKCkpO1xuICAgICAgICBjb25zb2xlLmxvZygnW2FpQ2xhdy1CR10g8J+TpiBDcmVkZW50aWFsIHN0b3JlIGluaXRpYWxpemVkLicpO1xuICAgIH1cbn0pO1xuLy8g4pSA4pSAIOa2iOaBr+S4reaeoiDilIDilIBcbmNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICAvLyAwLiBXZWJTb2NrZXQgcG9ydCB1cGRhdGVcbiAgICBpZiAobWVzc2FnZS50eXBlID09PSAnV1NfUE9SVF9DSEFOR0VEJykge1xuICAgICAgICBsb2NhbEJyaWRnZS5yZWNvbm5lY3RXaXRoTmV3UG9ydChtZXNzYWdlLnBvcnQpO1xuICAgICAgICBpZiAoc2VuZFJlc3BvbnNlKVxuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IHRydWUgfSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gMS4g5Yet6K+B5o2V6I635raI5oGv77yI5p2l6IeqIGNvbnRlbnQgc2NyaXB0IOS4ree7p++8iVxuICAgIGlmIChtZXNzYWdlLnR5cGUgPT09IE1zZ1R5cGUuQ0FQVFVSRURfQ1JFREVOVElBTFMpIHtcbiAgICAgICAgY29uc3QgeyBwbGF0Zm9ybSwgYmVhcmVyVG9rZW4sIGFwaVVybCwgcmVxdWVzdEhlYWRlcnMgfSA9IG1lc3NhZ2U7XG4gICAgICAgIGlmIChwbGF0Zm9ybSAmJiAocGxhdGZvcm0gPT09ICdjaGF0Z3B0JyB8fCBwbGF0Zm9ybSA9PT0gJ2dlbWluaScgfHwgcGxhdGZvcm0gPT09ICdncm9rJykpIHtcbiAgICAgICAgICAgIHVwZGF0ZVBsYXRmb3JtQ3JlZGVudGlhbHMocGxhdGZvcm0sIGJlYXJlclRva2VuIHx8IG51bGwsIGFwaVVybCB8fCBudWxsLCByZXF1ZXN0SGVhZGVycyB8fCB7fSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuOyAvLyDml6DpnIAgc2VuZFJlc3BvbnNlXG4gICAgfVxuICAgIC8vIDIuIEhvb2sg54q25oCB5LiK5oqlXG4gICAgaWYgKG1lc3NhZ2UudHlwZSA9PT0gJ0FDX0hPT0tfU1RBVFVTJykge1xuICAgICAgICBjb25zdCB0YWJJZCA9IHNlbmRlci50YWI/LmlkO1xuICAgICAgICBpZiAodGFiSWQpIHtcbiAgICAgICAgICAgIGhvb2tTdGF0dXNNYXBbdGFiSWRdID0ge1xuICAgICAgICAgICAgICAgIGZldGNoOiBtZXNzYWdlLnN0YXR1cz8uZmV0Y2ggfHwgZmFsc2UsXG4gICAgICAgICAgICAgICAgeGhyOiBtZXNzYWdlLnN0YXR1cz8ueGhyIHx8IGZhbHNlLFxuICAgICAgICAgICAgICAgIGxhc3RSZXBvcnQ6IERhdGUubm93KCksXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gMy4g5p+l6K+i5p+Q5bmz5Y+w55qE5Yet6K+B77yI5L6b5pyq5p2l5Lu75Yqh5omn6KGM5qih5Z2X5L2/55So77yJXG4gICAgaWYgKG1lc3NhZ2UudHlwZSA9PT0gJ0FDX0dFVF9DUkVERU5USUFMUycpIHtcbiAgICAgICAgY29uc3QgcGxhdGZvcm0gPSBtZXNzYWdlLnBsYXRmb3JtO1xuICAgICAgICBsb2FkQ3JlZGVudGlhbHMoKS50aGVuKGNyZWRzID0+IHtcbiAgICAgICAgICAgIGlmIChwbGF0Zm9ybSAmJiBjcmVkc1twbGF0Zm9ybV0pIHtcbiAgICAgICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBvazogdHJ1ZSwgY3JlZGVudGlhbHM6IGNyZWRzW3BsYXRmb3JtXSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IG9rOiBmYWxzZSwgZXJyb3I6IGBVbmtub3duIHBsYXRmb3JtOiAke3BsYXRmb3JtfWAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTsgLy8g5byC5q2lIHNlbmRSZXNwb25zZVxuICAgIH1cbiAgICAvLyA0LiDmn6Xor6LmiYDmnInlubPlj7DnmoTlh63or4HnirbmgIHmkZjopoHvvIjosIPor5XnlKjvvIlcbiAgICBpZiAobWVzc2FnZS50eXBlID09PSAnQUNfR0VUX0FMTF9TVEFUVVMnKSB7XG4gICAgICAgIGxvYWRDcmVkZW50aWFscygpLnRoZW4oY3JlZHMgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc3VtbWFyeSA9IHt9O1xuICAgICAgICAgICAgZm9yIChjb25zdCBbcCwgY10gb2YgT2JqZWN0LmVudHJpZXMoY3JlZHMpKSB7XG4gICAgICAgICAgICAgICAgc3VtbWFyeVtwXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgaGFzVG9rZW46ICEhYy5iZWFyZXJUb2tlbixcbiAgICAgICAgICAgICAgICAgICAgdG9rZW5QcmV2aWV3OiBjLmJlYXJlclRva2VuID8gYy5iZWFyZXJUb2tlbi5zdWJzdHJpbmcoMCwgMjApICsgJy4uLicgOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBhcGlFbmRwb2ludDogYy5hcGlFbmRwb2ludCxcbiAgICAgICAgICAgICAgICAgICAgbGFzdENhcHR1cmVkQXQ6IGMubGFzdENhcHR1cmVkQXQgPyBuZXcgRGF0ZShjLmxhc3RDYXB0dXJlZEF0KS50b0lTT1N0cmluZygpIDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgY2FwdHVyZUNvdW50OiBjLmNhcHR1cmVDb3VudCxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IHRydWUsIHN1bW1hcnksIGhvb2tTdGF0dXM6IGhvb2tTdGF0dXNNYXAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTsgLy8g5byC5q2lIHNlbmRSZXNwb25zZVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59KTtcbi8vIOKUgOKUgCDlhajlsYAgd2ViUmVxdWVzdCDmi6bmiKrvvJrooqvliqjmjZXojrcgQmVhcmVyIFRva2VuIOKUgOKUgFxuLy8g6L+Z5piv5a+5IGluamVjdGlvbi50cyBmZXRjaCBob29rIOeahOihpeWFhe+8muWNs+S9vyBpbmplY3Rpb24g5rKh5pyJ5o2V6I635Yiw77yMXG4vLyB3ZWJSZXF1ZXN0IOS5n+iDveS7juivt+axguWktOS4reaLv+WIsCBCZWFyZXIgVG9rZW7jgIJcbmNvbnN0IEFJX1BMQVRGT1JNX1VSTF9QQVRURVJOUyA9IFtcbiAgICAnaHR0cHM6Ly9jaGF0Z3B0LmNvbS9iYWNrZW5kLWFwaS8qJyxcbiAgICAnaHR0cHM6Ly9jaGF0Lm9wZW5haS5jb20vYmFja2VuZC1hcGkvKicsXG4gICAgJ2h0dHBzOi8vZ2VtaW5pLmdvb2dsZS5jb20vKicsXG4gICAgJ2h0dHBzOi8vZ3Jvay5jb20vcmVzdC8qJyxcbl07XG5jaHJvbWUud2ViUmVxdWVzdC5vbkJlZm9yZVNlbmRIZWFkZXJzLmFkZExpc3RlbmVyKChkZXRhaWxzKSA9PiB7XG4gICAgY29uc3QgaGVhZGVycyA9IGRldGFpbHMucmVxdWVzdEhlYWRlcnMgfHwgW107XG4gICAgY29uc3QgYXV0aEhlYWRlciA9IGhlYWRlcnMuZmluZChoID0+IGgubmFtZS50b0xvd2VyQ2FzZSgpID09PSAnYXV0aG9yaXphdGlvbicpO1xuICAgIGlmIChhdXRoSGVhZGVyPy52YWx1ZT8uc3RhcnRzV2l0aCgnQmVhcmVyICcpKSB7XG4gICAgICAgIGNvbnN0IHVybCA9IGRldGFpbHMudXJsO1xuICAgICAgICBsZXQgcGxhdGZvcm0gPSBudWxsO1xuICAgICAgICBpZiAodXJsLmluY2x1ZGVzKCdjaGF0Z3B0LmNvbScpIHx8IHVybC5pbmNsdWRlcygnY2hhdC5vcGVuYWkuY29tJykpIHtcbiAgICAgICAgICAgIHBsYXRmb3JtID0gJ2NoYXRncHQnO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHVybC5pbmNsdWRlcygnZ2VtaW5pLmdvb2dsZS5jb20nKSkge1xuICAgICAgICAgICAgcGxhdGZvcm0gPSAnZ2VtaW5pJztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh1cmwuaW5jbHVkZXMoJ2dyb2suY29tJykgfHwgdXJsLmluY2x1ZGVzKCd4LmNvbScpKSB7XG4gICAgICAgICAgICBwbGF0Zm9ybSA9ICdncm9rJztcbiAgICAgICAgfVxuICAgICAgICBpZiAocGxhdGZvcm0pIHtcbiAgICAgICAgICAgIHVwZGF0ZVBsYXRmb3JtQ3JlZGVudGlhbHMocGxhdGZvcm0sIGF1dGhIZWFkZXIudmFsdWUsIHVybCwge30pO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYCVjW2FpQ2xhdy1CR10g8J+MkCBXZWJSZXF1ZXN0IGNhcHR1cmVkIEJlYXJlciBmb3IgJHtwbGF0Zm9ybX1gLCAnY29sb3I6ICM2MGE1ZmEnKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyByZXF1ZXN0SGVhZGVyczogaGVhZGVycyB9O1xufSwgeyB1cmxzOiBBSV9QTEFURk9STV9VUkxfUEFUVEVSTlMgfSwgWydyZXF1ZXN0SGVhZGVycyddKTtcbi8vIOKUgOKUgCB0YWIg5YWz6Zet5pe25riF55CGIGhvb2sg54q25oCBIOKUgOKUgFxuY2hyb21lLnRhYnMub25SZW1vdmVkLmFkZExpc3RlbmVyKCh0YWJJZCkgPT4ge1xuICAgIGRlbGV0ZSBob29rU3RhdHVzTWFwW3RhYklkXTtcbn0pO1xuLy8g4pSA4pSAIExvY2FsQnJpZGdlIFdlYlNvY2tldCDlrqLmiLfnq68g4pSA4pSAXG5hc3luYyBmdW5jdGlvbiBxdWVyeUFJVGFic1N0YXR1cygpIHtcbiAgICAvLyDmn6Xor6LmiYDmnIkgQUkg5bmz5Y+w55qEIHRhYnNcbiAgICBjb25zdCBjaGF0Z3B0VGFicyA9IGF3YWl0IGNocm9tZS50YWJzLnF1ZXJ5KHtcbiAgICAgICAgdXJsOiBbJ2h0dHBzOi8vY2hhdGdwdC5jb20vKicsICdodHRwczovL2NoYXQub3BlbmFpLmNvbS8qJ10sXG4gICAgfSk7XG4gICAgY29uc3QgZ2VtaW5pVGFicyA9IGF3YWl0IGNocm9tZS50YWJzLnF1ZXJ5KHtcbiAgICAgICAgdXJsOiBbJ2h0dHBzOi8vZ2VtaW5pLmdvb2dsZS5jb20vKiddLFxuICAgIH0pO1xuICAgIGNvbnN0IGdyb2tUYWJzID0gYXdhaXQgY2hyb21lLnRhYnMucXVlcnkoe1xuICAgICAgICB1cmw6IFsnaHR0cHM6Ly9ncm9rLmNvbS8qJywgJ2h0dHBzOi8veC5jb20vaS9ncm9rKiddLFxuICAgIH0pO1xuICAgIGNvbnN0IGFsbFRhYnMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IHRhYiBvZiBjaGF0Z3B0VGFicykge1xuICAgICAgICBpZiAodGFiLmlkICYmIHRhYi51cmwpIHtcbiAgICAgICAgICAgIGFsbFRhYnMucHVzaCh7IHRhYklkOiB0YWIuaWQsIHVybDogdGFiLnVybCwgcGxhdGZvcm06ICdjaGF0Z3B0JywgYWN0aXZlOiB0YWIuYWN0aXZlIHx8IGZhbHNlIH0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFiIG9mIGdlbWluaVRhYnMpIHtcbiAgICAgICAgaWYgKHRhYi5pZCAmJiB0YWIudXJsKSB7XG4gICAgICAgICAgICBhbGxUYWJzLnB1c2goeyB0YWJJZDogdGFiLmlkLCB1cmw6IHRhYi51cmwsIHBsYXRmb3JtOiAnZ2VtaW5pJywgYWN0aXZlOiB0YWIuYWN0aXZlIHx8IGZhbHNlIH0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFiIG9mIGdyb2tUYWJzKSB7XG4gICAgICAgIGlmICh0YWIuaWQgJiYgdGFiLnVybCkge1xuICAgICAgICAgICAgYWxsVGFicy5wdXNoKHsgdGFiSWQ6IHRhYi5pZCwgdXJsOiB0YWIudXJsLCBwbGF0Zm9ybTogJ2dyb2snLCBhY3RpdmU6IHRhYi5hY3RpdmUgfHwgZmFsc2UgfSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgYWN0aXZlVGFiID0gYWxsVGFicy5maW5kKHQgPT4gdC5hY3RpdmUpIHx8IG51bGw7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgaGFzQUlUYWJzOiBhbGxUYWJzLmxlbmd0aCA+IDAsXG4gICAgICAgIHBsYXRmb3Jtczoge1xuICAgICAgICAgICAgY2hhdGdwdDogY2hhdGdwdFRhYnMubGVuZ3RoID4gMCxcbiAgICAgICAgICAgIGdlbWluaTogZ2VtaW5pVGFicy5sZW5ndGggPiAwLFxuICAgICAgICAgICAgZ3JvazogZ3Jva1RhYnMubGVuZ3RoID4gMCxcbiAgICAgICAgfSxcbiAgICAgICAgYWN0aXZlQUlUYWJJZDogYWN0aXZlVGFiPy50YWJJZCB8fCBudWxsLFxuICAgICAgICBhY3RpdmVBSVVybDogYWN0aXZlVGFiPy51cmwgfHwgbnVsbCxcbiAgICAgICAgdGFiczogYWxsVGFicyxcbiAgICB9O1xufVxuY29uc3QgbG9jYWxCcmlkZ2UgPSBuZXcgTG9jYWxCcmlkZ2VTb2NrZXQoKTtcbmxvY2FsQnJpZGdlLnF1ZXJ5QUlUYWJzSGFuZGxlciA9IHF1ZXJ5QUlUYWJzU3RhdHVzO1xuLy8g4pSA4pSAIOWQr+WKqOaXpeW/lyDilIDilIBcbmNvbnNvbGUubG9nKCclY1thaUNsYXctQkddIPCfmoAgQmFja2dyb3VuZCBzZXJ2aWNlIHdvcmtlciBzdGFydGVkLicsICdjb2xvcjogIzYwYTVmYTsgZm9udC13ZWlnaHQ6IGJvbGQ7IGZvbnQtc2l6ZTogMTNweDsnKTtcbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==