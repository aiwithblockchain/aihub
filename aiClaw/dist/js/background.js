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
        this.WS_URL = 'ws://127.0.0.1:8765/ws';
        this.isConnecting = false;
        this.connect();
    }
    connect() {
        if (this.isConnecting)
            return;
        if (this.ws &&
            (this.ws.readyState === WebSocket.CONNECTING ||
                this.ws.readyState === WebSocket.OPEN)) {
            return;
        }
        this.isConnecting = true;
        console.log('[aiClaw] websocket connecting...');
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QUFpQjtBQUN6QztBQUNBO0FBQ0Esb0ZBQW9GLG1CQUFtQixnQkFBZ0IiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9haUNsYXcvLi9zcmMvYnJpZGdlL2xvY2FsLWJyaWRnZS1zb2NrZXQudHMiLCJ3ZWJwYWNrOi8vYWlDbGF3Ly4vc3JjL2JyaWRnZS93cy1wcm90b2NvbC50cyIsIndlYnBhY2s6Ly9haUNsYXcvLi9zcmMvY2FwdHVyZS9jb25zdHMudHMiLCJ3ZWJwYWNrOi8vYWlDbGF3L3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL2FpQ2xhdy93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vYWlDbGF3L3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vYWlDbGF3L3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vYWlDbGF3Ly4vc3JjL3NlcnZpY2Vfd29yay9iYWNrZ3JvdW5kLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE1FU1NBR0VfVFlQRVMsIFBST1RPQ09MX05BTUUsIFBST1RPQ09MX1ZFUlNJT04sIH0gZnJvbSAnLi93cy1wcm90b2NvbCc7XG5leHBvcnQgY2xhc3MgTG9jYWxCcmlkZ2VTb2NrZXQge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLndzID0gbnVsbDtcbiAgICAgICAgdGhpcy5yZWNvbm5lY3RBdHRlbXB0cyA9IDA7XG4gICAgICAgIHRoaXMucmVjb25uZWN0VGltZXIgPSBudWxsO1xuICAgICAgICB0aGlzLmhlYXJ0YmVhdEludGVydmFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5zZXJ2ZXJJbmZvID0gbnVsbDtcbiAgICAgICAgdGhpcy5sYXN0UG9uZ1RpbWVzdGFtcCA9IDA7XG4gICAgICAgIHRoaXMucXVlcnlBSVRhYnNIYW5kbGVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5XU19VUkwgPSAnd3M6Ly8xMjcuMC4wLjE6ODc2NS93cyc7XG4gICAgICAgIHRoaXMuaXNDb25uZWN0aW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuY29ubmVjdCgpO1xuICAgIH1cbiAgICBjb25uZWN0KCkge1xuICAgICAgICBpZiAodGhpcy5pc0Nvbm5lY3RpbmcpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGlmICh0aGlzLndzICYmXG4gICAgICAgICAgICAodGhpcy53cy5yZWFkeVN0YXRlID09PSBXZWJTb2NrZXQuQ09OTkVDVElORyB8fFxuICAgICAgICAgICAgICAgIHRoaXMud3MucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0Lk9QRU4pKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5pc0Nvbm5lY3RpbmcgPSB0cnVlO1xuICAgICAgICBjb25zb2xlLmxvZygnW2FpQ2xhd10gd2Vic29ja2V0IGNvbm5lY3RpbmcuLi4nKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoaXMud3MgPSBuZXcgV2ViU29ja2V0KHRoaXMuV1NfVVJMKTtcbiAgICAgICAgICAgIHRoaXMud3Mub25vcGVuID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbYWlDbGF3XSB3ZWJzb2NrZXQgb3BlbicpO1xuICAgICAgICAgICAgICAgIHRoaXMuaXNDb25uZWN0aW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWNvbm5lY3RBdHRlbXB0cyA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5sYXN0UG9uZ1RpbWVzdGFtcCA9IERhdGUubm93KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZW5kSGVsbG8oKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLndzLm9uY2xvc2UgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1thaUNsYXddIHdlYnNvY2tldCBjbG9zZWQnKTtcbiAgICAgICAgICAgICAgICB0aGlzLmlzQ29ubmVjdGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMuc3RvcEhlYXJ0YmVhdCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2NoZWR1bGVSZWNvbm5lY3QoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLndzLm9uZXJyb3IgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gVXNlIHJlZ3VsYXIgbG9nIHRvIHN0YXkgc2lsZW50IGluIENocm9tZSBleHRlbnNpb24gZXJyb3IgbGlzdFxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbYWlDbGF3XSBjb25uZWN0aW9uIG5vdGljZTogc2VydmVyIG9mZmxpbmUnKTtcbiAgICAgICAgICAgICAgICB0aGlzLmlzQ29ubmVjdGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHRoaXMud3Mub25tZXNzYWdlID0gKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVNZXNzYWdlKGV2ZW50LmRhdGEpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1thaUNsYXddIGluaXRpYWxpemF0aW9uIG5vdGljZTonLCBlKTtcbiAgICAgICAgICAgIHRoaXMuaXNDb25uZWN0aW5nID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLnNjaGVkdWxlUmVjb25uZWN0KCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgc2NoZWR1bGVSZWNvbm5lY3QoKSB7XG4gICAgICAgIGlmICh0aGlzLnJlY29ubmVjdFRpbWVyKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBjb25zdCBkZWxheSA9IHRoaXMuZ2V0UmVjb25uZWN0RGVsYXkoKTtcbiAgICAgICAgY29uc29sZS5sb2coYFthaUNsYXddIHdlYnNvY2tldCByZWNvbm5lY3Qgc2NoZWR1bGVkIGluICR7ZGVsYXl9bXNgKTtcbiAgICAgICAgdGhpcy5yZWNvbm5lY3RUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5yZWNvbm5lY3RUaW1lciA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLnJlY29ubmVjdEF0dGVtcHRzKys7XG4gICAgICAgICAgICB0aGlzLmNvbm5lY3QoKTtcbiAgICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgICBnZXRSZWNvbm5lY3REZWxheSgpIHtcbiAgICAgICAgc3dpdGNoICh0aGlzLnJlY29ubmVjdEF0dGVtcHRzKSB7XG4gICAgICAgICAgICBjYXNlIDA6IHJldHVybiAxMDAwO1xuICAgICAgICAgICAgY2FzZSAxOiByZXR1cm4gMjAwMDtcbiAgICAgICAgICAgIGNhc2UgMjogcmV0dXJuIDUwMDA7XG4gICAgICAgICAgICBkZWZhdWx0OiByZXR1cm4gMTAwMDA7XG4gICAgICAgIH1cbiAgICB9XG4gICAgc2VuZEhlbGxvKCkge1xuICAgICAgICBjb25zdCBoZWxsbyA9IHtcbiAgICAgICAgICAgIGlkOiBgaGVsbG9fJHtEYXRlLm5vdygpfWAsXG4gICAgICAgICAgICB0eXBlOiBNRVNTQUdFX1RZUEVTLkNMSUVOVF9IRUxMTyxcbiAgICAgICAgICAgIHNvdXJjZTogJ2FpQ2xhdycsXG4gICAgICAgICAgICB0YXJnZXQ6ICdMb2NhbEJyaWRnZU1hYycsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICAgICAgICBwYXlsb2FkOiB7XG4gICAgICAgICAgICAgICAgcHJvdG9jb2xOYW1lOiBQUk9UT0NPTF9OQU1FLFxuICAgICAgICAgICAgICAgIHByb3RvY29sVmVyc2lvbjogUFJPVE9DT0xfVkVSU0lPTixcbiAgICAgICAgICAgICAgICBjbGllbnROYW1lOiAnYWlDbGF3JyxcbiAgICAgICAgICAgICAgICBjbGllbnRWZXJzaW9uOiAnMC4xLjAnLFxuICAgICAgICAgICAgICAgIGJyb3dzZXI6ICdjaHJvbWUnLFxuICAgICAgICAgICAgICAgIGNhcGFiaWxpdGllczogWydxdWVyeV9haV90YWJzX3N0YXR1cyddLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5zZW5kKGhlbGxvKTtcbiAgICB9XG4gICAgaGFuZGxlTWVzc2FnZShkYXRhKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBtc2cgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFthaUNsYXddIHJlY2VpdmVkIG1lc3NhZ2U6ICR7bXNnLnR5cGV9YCk7XG4gICAgICAgICAgICBzd2l0Y2ggKG1zZy50eXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSBNRVNTQUdFX1RZUEVTLlNFUlZFUl9IRUxMT19BQ0s6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaGFuZGxlSGVsbG9BY2sobXNnKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBNRVNTQUdFX1RZUEVTLlBPTkc6XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbYWlDbGF3XSByZWNlaXZlZCBwb25nJyk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubGFzdFBvbmdUaW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIE1FU1NBR0VfVFlQRVMuUkVRVUVTVF9RVUVSWV9BSV9UQUJTX1NUQVRVUzpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVRdWVyeUFJVGFic1N0YXR1cyhtc2cpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFthaUNsYXddIHVua25vd24gbWVzc2FnZSB0eXBlOiAke21zZy50eXBlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbYWlDbGF3XSBmYWlsZWQgdG8gcGFyc2UgbWVzc2FnZTonLCBlKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBoYW5kbGVIZWxsb0Fjayhtc2cpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1thaUNsYXddIHJlY2VpdmVkIHNlcnZlci5oZWxsb19hY2snKTtcbiAgICAgICAgdGhpcy5zZXJ2ZXJJbmZvID0gbXNnLnBheWxvYWQ7XG4gICAgICAgIHRoaXMuc3RhcnRIZWFydGJlYXQobXNnLnBheWxvYWQuaGVhcnRiZWF0SW50ZXJ2YWxNcyB8fCAyMDAwMCk7XG4gICAgfVxuICAgIGFzeW5jIGhhbmRsZVF1ZXJ5QUlUYWJzU3RhdHVzKHJlcSkge1xuICAgICAgICBjb25zb2xlLmxvZygnW2FpQ2xhd10gaGFuZGxpbmcgcmVxdWVzdC5xdWVyeV9haV90YWJzX3N0YXR1cycpO1xuICAgICAgICBpZiAoIXRoaXMucXVlcnlBSVRhYnNIYW5kbGVyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbYWlDbGF3XSBubyBoYW5kbGVyIGZvciBxdWVyeV9haV90YWJzX3N0YXR1cycpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnF1ZXJ5QUlUYWJzSGFuZGxlcigpO1xuICAgICAgICAgICAgY29uc3QgcmVzcCA9IHtcbiAgICAgICAgICAgICAgICBpZDogcmVxLmlkLFxuICAgICAgICAgICAgICAgIHR5cGU6IE1FU1NBR0VfVFlQRVMuUkVTUE9OU0VfUVVFUllfQUlfVEFCU19TVEFUVVMsXG4gICAgICAgICAgICAgICAgc291cmNlOiAnYWlDbGF3JyxcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdMb2NhbEJyaWRnZU1hYycsXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgICAgICAgICAgIHBheWxvYWQ6IHJlc3VsdCxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0aGlzLnNlbmQocmVzcCk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGVyclJlc3AgPSB7XG4gICAgICAgICAgICAgICAgaWQ6IHJlcS5pZCxcbiAgICAgICAgICAgICAgICB0eXBlOiBNRVNTQUdFX1RZUEVTLlJFU1BPTlNFX0VSUk9SLFxuICAgICAgICAgICAgICAgIHNvdXJjZTogJ2FpQ2xhdycsXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiAnTG9jYWxCcmlkZ2VNYWMnLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgICAgICBwYXlsb2FkOiB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGU6ICdJTlRFUk5BTF9FUlJPUicsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGUgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSxcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogbnVsbCxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHRoaXMuc2VuZChlcnJSZXNwKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBzdGFydEhlYXJ0YmVhdChpbnRlcnZhbCkge1xuICAgICAgICB0aGlzLnN0b3BIZWFydGJlYXQoKTtcbiAgICAgICAgY29uc29sZS5sb2coYFthaUNsYXddIHN0YXJ0aW5nIGhlYXJ0YmVhdCBldmVyeSAke2ludGVydmFsfW1zYCk7XG4gICAgICAgIHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICAvLyBDaGVjayBmb3IgdGltZW91dCAoNjAgc2Vjb25kcylcbiAgICAgICAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgICAgICAgICBpZiAodGhpcy5sYXN0UG9uZ1RpbWVzdGFtcCA+IDAgJiYgbm93IC0gdGhpcy5sYXN0UG9uZ1RpbWVzdGFtcCA+IDYwMDAwKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW2FpQ2xhd10gcG9uZyB0aW1lb3V0LCBjbG9zaW5nIHNvY2tldCcpO1xuICAgICAgICAgICAgICAgIHRoaXMud3M/LmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zZW5kUGluZygpO1xuICAgICAgICB9LCBpbnRlcnZhbCk7XG4gICAgfVxuICAgIHN0b3BIZWFydGJlYXQoKSB7XG4gICAgICAgIGlmICh0aGlzLmhlYXJ0YmVhdEludGVydmFsKSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWwpO1xuICAgICAgICAgICAgdGhpcy5oZWFydGJlYXRJbnRlcnZhbCA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG4gICAgc2VuZFBpbmcoKSB7XG4gICAgICAgIGNvbnN0IHBpbmcgPSB7XG4gICAgICAgICAgICBpZDogYHBpbmdfJHtEYXRlLm5vdygpfWAsXG4gICAgICAgICAgICB0eXBlOiBNRVNTQUdFX1RZUEVTLlBJTkcsXG4gICAgICAgICAgICBzb3VyY2U6ICdhaUNsYXcnLFxuICAgICAgICAgICAgdGFyZ2V0OiAnTG9jYWxCcmlkZ2VNYWMnLFxuICAgICAgICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgICAgICAgcGF5bG9hZDoge1xuICAgICAgICAgICAgICAgIGhlYXJ0YmVhdEludGVydmFsTXM6IDIwMDAwLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5zZW5kKHBpbmcpO1xuICAgIH1cbiAgICBzZW5kKG1zZykge1xuICAgICAgICBpZiAodGhpcy53cyAmJiB0aGlzLndzLnJlYWR5U3RhdGUgPT09IFdlYlNvY2tldC5PUEVOKSB7XG4gICAgICAgICAgICB0aGlzLndzLnNlbmQoSlNPTi5zdHJpbmdpZnkobXNnKSk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW2FpQ2xhd10gc2VudCBtZXNzYWdlOiAke21zZy50eXBlfWApO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBbYWlDbGF3XSBjYW5ub3Qgc2VuZCBtZXNzYWdlLCBzb2NrZXQgc3RhdHVzOiAke3RoaXMud3M/LnJlYWR5U3RhdGV9YCk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJleHBvcnQgY29uc3QgUFJPVE9DT0xfTkFNRSA9ICdhaWh1Yi1sb2NhbGJyaWRnZSc7XG5leHBvcnQgY29uc3QgUFJPVE9DT0xfVkVSU0lPTiA9ICd2MSc7XG5leHBvcnQgY29uc3QgTUVTU0FHRV9UWVBFUyA9IHtcbiAgICBDTElFTlRfSEVMTE86ICdjbGllbnQuaGVsbG8nLFxuICAgIFNFUlZFUl9IRUxMT19BQ0s6ICdzZXJ2ZXIuaGVsbG9fYWNrJyxcbiAgICBQSU5HOiAncGluZycsXG4gICAgUE9ORzogJ3BvbmcnLFxuICAgIFJFUVVFU1RfUVVFUllfQUlfVEFCU19TVEFUVVM6ICdyZXF1ZXN0LnF1ZXJ5X2FpX3RhYnNfc3RhdHVzJyxcbiAgICBSRVNQT05TRV9RVUVSWV9BSV9UQUJTX1NUQVRVUzogJ3Jlc3BvbnNlLnF1ZXJ5X2FpX3RhYnNfc3RhdHVzJyxcbiAgICBSRVNQT05TRV9FUlJPUjogJ3Jlc3BvbnNlLmVycm9yJyxcbn07XG5leHBvcnQgY29uc3QgRVJST1JfQ09ERVMgPSB7XG4gICAgSU5WQUxJRF9KU09OOiAnSU5WQUxJRF9KU09OJyxcbiAgICBJTlZBTElEX01FU1NBR0VfU0hBUEU6ICdJTlZBTElEX01FU1NBR0VfU0hBUEUnLFxuICAgIFVOU1VQUE9SVEVEX01FU1NBR0VfVFlQRTogJ1VOU1VQUE9SVEVEX01FU1NBR0VfVFlQRScsXG4gICAgUFJPVE9DT0xfVkVSU0lPTl9NSVNNQVRDSDogJ1BST1RPQ09MX1ZFUlNJT05fTUlTTUFUQ0gnLFxuICAgIE5PVF9DT05ORUNURUQ6ICdOT1RfQ09OTkVDVEVEJyxcbiAgICBSRVFVRVNUX1RJTUVPVVQ6ICdSRVFVRVNUX1RJTUVPVVQnLFxuICAgIElOVEVSTkFMX0VSUk9SOiAnSU5URVJOQUxfRVJST1InLFxufTtcbiIsIi8qKlxuICogY29uc3RzLnRzIC0gYWlDbGF3IOW4uOmHj+WumuS5iVxuICpcbiAqIOWumuS5ieWtmOWCqOmUruWQjeOAgea2iOaBr+exu+Wei+OAgeW5s+WPsOebuOWFs+W4uOmHj+OAglxuICovXG4vLyDilIDilIAgY2hyb21lLnN0b3JhZ2UubG9jYWwg5Lit5L2/55So55qE6ZSu5ZCNIOKUgOKUgFxuZXhwb3J0IGNvbnN0IFNUT1JBR0VfS0VZX0NSRURFTlRJQUxTID0gJ2FjX2NyZWRlbnRpYWxzJzsgLy8g5a2Y5YKo5ZCE5bmz5Y+w5Yet6K+BXG4vLyDilIDilIAg5omp5bGV5YaF6YOo5raI5oGv57G75Z6LIOKUgOKUgFxuZXhwb3J0IHZhciBNc2dUeXBlO1xuKGZ1bmN0aW9uIChNc2dUeXBlKSB7XG4gICAgTXNnVHlwZVtcIlBJTkdcIl0gPSBcIkFDX1BJTkdcIjtcbiAgICBNc2dUeXBlW1wiQ0FQVFVSRURfQ1JFREVOVElBTFNcIl0gPSBcIkFDX0NBUFRVUkVEX0NSRURFTlRJQUxTXCI7XG4gICAgTXNnVHlwZVtcIkVYRUNVVEVfVEFTS1wiXSA9IFwiQUNfRVhFQ1VURV9UQVNLXCI7XG4gICAgTXNnVHlwZVtcIlRBU0tfUkVTVUxUXCJdID0gXCJBQ19UQVNLX1JFU1VMVFwiO1xuICAgIE1zZ1R5cGVbXCJBQ19TRU5EX1RFU1RfTUVTU0FHRVwiXSA9IFwiQUNfU0VORF9URVNUX01FU1NBR0VcIjtcbn0pKE1zZ1R5cGUgfHwgKE1zZ1R5cGUgPSB7fSkpO1xuLy8g4pSA4pSAIGluamVjdGlvbiDihpIgY29udGVudCDnmoQgcG9zdE1lc3NhZ2Ugc291cmNlIOagh+ivhiDilIDilIBcbmV4cG9ydCBjb25zdCBJTkpFQ1RJT05fU09VUkNFID0gJ2FpY2xhdy1pbmplY3Rpb24nO1xuLy8g4pSA4pSAIOW5s+WPsCBVUkwg5Yy56YWN6KeE5YiZIOKUgOKUgFxuLy8g55So5LqOIGluamVjdGlvbi50cyDliKTmlq3lvZPliY3mi6bmiKrliLDnmoQgZmV0Y2gg6K+35rGC5bGe5LqO5ZOq5Liq5bmz5Y+w55qEIEFQSVxuZXhwb3J0IGNvbnN0IFBMQVRGT1JNX0FQSV9QQVRURVJOUyA9IHtcbiAgICBjaGF0Z3B0OiBbXG4gICAgICAgIC9jaGF0Z3B0XFwuY29tXFwvYmFja2VuZC1hcGlcXC8vLFxuICAgICAgICAvY2hhdFxcLm9wZW5haVxcLmNvbVxcL2JhY2tlbmQtYXBpXFwvLyxcbiAgICBdLFxuICAgIGdlbWluaTogW1xuICAgICAgICAvZ2VtaW5pXFwuZ29vZ2xlXFwuY29tXFwvX1xcL0JhcmRDaGF0VWlcXC8vLFxuICAgICAgICAvZ2VtaW5pXFwuZ29vZ2xlXFwuY29tXFwvYXBwXFwvX1xcL0JhcmRDaGF0VWlcXC8vLFxuICAgICAgICAvYWxrYWxpbWFrZXJzdWl0ZS1wYVxcLmNsaWVudHM2XFwuZ29vZ2xlXFwuY29tXFwvLyxcbiAgICBdLFxuICAgIGdyb2s6IFtcbiAgICAgICAgL2dyb2tcXC5jb21cXC9yZXN0XFwvYXBwLWNoYXRcXC8vLFxuICAgICAgICAveFxcLmNvbVxcL2lcXC9hcGlcXC8yXFwvZ3Jva1xcLy8sXG4gICAgXSxcbn07XG4vKipcbiAqIOajgOa1i+S4gOS4quivt+axgiBVUkwg5piv5ZCm5piv5oiR5Lus6ZyA6KaB5YWz5rOo55qEIEFJIOW5s+WPsCBBUEkg6LCD55So44CCXG4gKiDlpoLmnpzljLnphY3vvIzov5Tlm57lubPlj7DlkI3np7DvvJvlkKbliJnov5Tlm54gbnVsbOOAglxuICovXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0UGxhdGZvcm1Gcm9tVXJsKHVybCkge1xuICAgIGZvciAoY29uc3QgW3BsYXRmb3JtLCBwYXR0ZXJuc10gb2YgT2JqZWN0LmVudHJpZXMoUExBVEZPUk1fQVBJX1BBVFRFUk5TKSkge1xuICAgICAgICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgcGF0dGVybnMpIHtcbiAgICAgICAgICAgIGlmIChwYXR0ZXJuLnRlc3QodXJsKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBwbGF0Zm9ybTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cbi8qKlxuICog5qC55o2uIGhvc3RuYW1lIOajgOa1i+W9k+WJjemhtemdouaJgOWcqOeahOW5s+WPsOOAglxuICovXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0UGxhdGZvcm1Gcm9tSG9zdG5hbWUoaG9zdG5hbWUpIHtcbiAgICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoJ2NoYXRncHQuY29tJykgfHwgaG9zdG5hbWUuaW5jbHVkZXMoJ2NoYXQub3BlbmFpLmNvbScpKSB7XG4gICAgICAgIHJldHVybiAnY2hhdGdwdCc7XG4gICAgfVxuICAgIGlmIChob3N0bmFtZS5pbmNsdWRlcygnZ2VtaW5pLmdvb2dsZS5jb20nKSkge1xuICAgICAgICByZXR1cm4gJ2dlbWluaSc7XG4gICAgfVxuICAgIGlmIChob3N0bmFtZS5pbmNsdWRlcygnZ3Jvay5jb20nKSB8fCBob3N0bmFtZS5pbmNsdWRlcygneC5jb20nKSkge1xuICAgICAgICByZXR1cm4gJ2dyb2snO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0aWYgKCEobW9kdWxlSWQgaW4gX193ZWJwYWNrX21vZHVsZXNfXykpIHtcblx0XHRkZWxldGUgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0XHR2YXIgZSA9IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIgKyBtb2R1bGVJZCArIFwiJ1wiKTtcblx0XHRlLmNvZGUgPSAnTU9EVUxFX05PVF9GT1VORCc7XG5cdFx0dGhyb3cgZTtcblx0fVxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCIvKipcbiAqIGJhY2tncm91bmQudHMgLSBhaUNsYXcgQmFja2dyb3VuZCBTZXJ2aWNlIFdvcmtlciAoUGhhc2UgMSlcbiAqXG4gKiDogYzotKPvvJpcbiAqICAgMS4g5o6l5pS25bm25a2Y5YKo5LuOIGNvbnRlbnQgc2NyaXB0IOi9rOWPkeadpeeahOWHreivgeaVsOaNrlxuICogICAyLiDmj5Dkvpvlh63or4Hmn6Xor6LmjqXlj6PvvIjkvpvmnKrmnaXnmoTku7vliqHmiafooYzmqKHlnZfkvb/nlKjvvIlcbiAqICAgMy4g6YCa6L+HIHdlYlJlcXVlc3Qg6KKr5Yqo5o2V6I63IEJlYXJlciBUb2tlbu+8iOWFqOWxgOihpeWFheaLpuaIqu+8iVxuICogICA0LiDnrqHnkIYgaG9vayDnirbmgIFcbiAqXG4gKiDmnrbmnoTlsYLnuqfvvJpMYXllciAz77yIU2VydmljZSBXb3JrZXLvvIlcbiAqL1xuaW1wb3J0IHsgU1RPUkFHRV9LRVlfQ1JFREVOVElBTFMsIE1zZ1R5cGUgfSBmcm9tICcuLi9jYXB0dXJlL2NvbnN0cyc7XG5pbXBvcnQgeyBMb2NhbEJyaWRnZVNvY2tldCB9IGZyb20gJy4uL2JyaWRnZS9sb2NhbC1icmlkZ2Utc29ja2V0JztcbmxldCBob29rU3RhdHVzTWFwID0ge307XG4vLyDilIDilIAg6buY6K6k56m65Yet6K+BIOKUgOKUgFxuZnVuY3Rpb24gZW1wdHlDcmVkZW50aWFscygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBiZWFyZXJUb2tlbjogbnVsbCxcbiAgICAgICAgYXBpRW5kcG9pbnQ6IG51bGwsXG4gICAgICAgIGxhc3RDYXB0dXJlZEhlYWRlcnM6IHt9LFxuICAgICAgICBsYXN0Q2FwdHVyZWRBdDogMCxcbiAgICAgICAgY2FwdHVyZUNvdW50OiAwLFxuICAgIH07XG59XG5mdW5jdGlvbiBkZWZhdWx0QWxsQ3JlZGVudGlhbHMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgY2hhdGdwdDogZW1wdHlDcmVkZW50aWFscygpLFxuICAgICAgICBnZW1pbmk6IGVtcHR5Q3JlZGVudGlhbHMoKSxcbiAgICAgICAgZ3JvazogZW1wdHlDcmVkZW50aWFscygpLFxuICAgIH07XG59XG4vLyDilIDilIAg5Yet6K+B5a2Y5YKo5pON5L2cIOKUgOKUgFxuYXN5bmMgZnVuY3Rpb24gbG9hZENyZWRlbnRpYWxzKCkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChTVE9SQUdFX0tFWV9DUkVERU5USUFMUyk7XG4gICAgY29uc3QgY3JlZHMgPSByZXNbU1RPUkFHRV9LRVlfQ1JFREVOVElBTFNdO1xuICAgIGlmIChjcmVkcyAmJiB0eXBlb2YgY3JlZHMgPT09ICdvYmplY3QnICYmICdjaGF0Z3B0JyBpbiBjcmVkcyAmJiAnZ2VtaW5pJyBpbiBjcmVkcyAmJiAnZ3JvaycgaW4gY3JlZHMpIHtcbiAgICAgICAgcmV0dXJuIGNyZWRzO1xuICAgIH1cbiAgICByZXR1cm4gZGVmYXVsdEFsbENyZWRlbnRpYWxzKCk7XG59XG5hc3luYyBmdW5jdGlvbiBzYXZlQ3JlZGVudGlhbHMoY3JlZHMpIHtcbiAgICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoeyBbU1RPUkFHRV9LRVlfQ1JFREVOVElBTFNdOiBjcmVkcyB9KTtcbn1cbmFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVBsYXRmb3JtQ3JlZGVudGlhbHMocGxhdGZvcm0sIGJlYXJlclRva2VuLCBhcGlVcmwsIGhlYWRlcnMpIHtcbiAgICBjb25zdCBjcmVkcyA9IGF3YWl0IGxvYWRDcmVkZW50aWFscygpO1xuICAgIGNvbnN0IHBjID0gY3JlZHNbcGxhdGZvcm1dO1xuICAgIC8vIOWPquacieaWsOWAvOmdnuepuuaXtuaJjeabtOaWsO+8iOmYsuatouimhuebluW3suacieWAvO+8iVxuICAgIGlmIChiZWFyZXJUb2tlbikge1xuICAgICAgICBwYy5iZWFyZXJUb2tlbiA9IGJlYXJlclRva2VuO1xuICAgIH1cbiAgICBpZiAoYXBpVXJsKSB7XG4gICAgICAgIHBjLmFwaUVuZHBvaW50ID0gYXBpVXJsO1xuICAgIH1cbiAgICBpZiAoT2JqZWN0LmtleXMoaGVhZGVycykubGVuZ3RoID4gMCkge1xuICAgICAgICBwYy5sYXN0Q2FwdHVyZWRIZWFkZXJzID0gaGVhZGVycztcbiAgICB9XG4gICAgcGMubGFzdENhcHR1cmVkQXQgPSBEYXRlLm5vdygpO1xuICAgIHBjLmNhcHR1cmVDb3VudCArPSAxO1xuICAgIGNyZWRzW3BsYXRmb3JtXSA9IHBjO1xuICAgIGF3YWl0IHNhdmVDcmVkZW50aWFscyhjcmVkcyk7XG4gICAgLy8g5omT5Y2w5pel5b+XXG4gICAgY29uc3QgdG9rZW5QcmV2aWV3ID0gcGMuYmVhcmVyVG9rZW5cbiAgICAgICAgPyBgJHtwYy5iZWFyZXJUb2tlbi5zdWJzdHJpbmcoMCwgMjUpfS4uLmBcbiAgICAgICAgOiAnbnVsbCc7XG4gICAgY29uc29sZS5sb2coYCVjW2FpQ2xhdy1CR10g8J+UkCBDcmVkZW50aWFscyB1cGRhdGVkIGZvciAlYyR7cGxhdGZvcm19JWMgfCBUb2tlbjogJHt0b2tlblByZXZpZXd9IHwgQ291bnQ6ICR7cGMuY2FwdHVyZUNvdW50fWAsICdjb2xvcjogIzcxODA5NicsICdjb2xvcjogIzRhZGU4MDsgZm9udC13ZWlnaHQ6IGJvbGQnLCAnY29sb3I6ICM3MTgwOTYnKTtcbn1cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjbGVhclBsYXRmb3JtQ3JlZGVudGlhbHMocGxhdGZvcm0pIHtcbiAgICBjb25zdCBjcmVkcyA9IGF3YWl0IGxvYWRDcmVkZW50aWFscygpO1xuICAgIGNyZWRzW3BsYXRmb3JtXS5iZWFyZXJUb2tlbiA9IG51bGw7XG4gICAgY3JlZHNbcGxhdGZvcm1dLmFwaUVuZHBvaW50ID0gbnVsbDtcbiAgICBhd2FpdCBzYXZlQ3JlZGVudGlhbHMoY3JlZHMpO1xuICAgIGNvbnNvbGUubG9nKGBbYWlDbGF3LUJHXSDwn5eR77iPIENsZWFyZWQgY3JlZGVudGlhbHMgZm9yICR7cGxhdGZvcm19YCk7XG59XG4vLyDilIDilIAg5omp5bGV5a6J6KOFL+abtOaWsOS6i+S7tiDilIDilIBcbmNocm9tZS5ydW50aW1lLm9uSW5zdGFsbGVkLmFkZExpc3RlbmVyKGFzeW5jICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnJWNbYWlDbGF3LUJHXSDwn5qAIEV4dGVuc2lvbiBpbnN0YWxsZWQvdXBkYXRlZC4nLCAnY29sb3I6ICM2MGE1ZmE7IGZvbnQtd2VpZ2h0OiBib2xkOyBmb250LXNpemU6IDEzcHg7Jyk7XG4gICAgLy8g5Yid5aeL5YyW5Yet6K+B5a2Y5YKo77yI5aaC5p6c5LiN5a2Y5Zyo77yJXG4gICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoU1RPUkFHRV9LRVlfQ1JFREVOVElBTFMpO1xuICAgIGlmICghZXhpc3RpbmdbU1RPUkFHRV9LRVlfQ1JFREVOVElBTFNdKSB7XG4gICAgICAgIGF3YWl0IHNhdmVDcmVkZW50aWFscyhkZWZhdWx0QWxsQ3JlZGVudGlhbHMoKSk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbYWlDbGF3LUJHXSDwn5OmIENyZWRlbnRpYWwgc3RvcmUgaW5pdGlhbGl6ZWQuJyk7XG4gICAgfVxufSk7XG4vLyDilIDilIAg5raI5oGv5Lit5p6iIOKUgOKUgFxuY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIC8vIDEuIOWHreivgeaNleiOt+a2iOaBr++8iOadpeiHqiBjb250ZW50IHNjcmlwdCDkuK3nu6fvvIlcbiAgICBpZiAobWVzc2FnZS50eXBlID09PSBNc2dUeXBlLkNBUFRVUkVEX0NSRURFTlRJQUxTKSB7XG4gICAgICAgIGNvbnN0IHsgcGxhdGZvcm0sIGJlYXJlclRva2VuLCBhcGlVcmwsIHJlcXVlc3RIZWFkZXJzIH0gPSBtZXNzYWdlO1xuICAgICAgICBpZiAocGxhdGZvcm0gJiYgKHBsYXRmb3JtID09PSAnY2hhdGdwdCcgfHwgcGxhdGZvcm0gPT09ICdnZW1pbmknIHx8IHBsYXRmb3JtID09PSAnZ3JvaycpKSB7XG4gICAgICAgICAgICB1cGRhdGVQbGF0Zm9ybUNyZWRlbnRpYWxzKHBsYXRmb3JtLCBiZWFyZXJUb2tlbiB8fCBudWxsLCBhcGlVcmwgfHwgbnVsbCwgcmVxdWVzdEhlYWRlcnMgfHwge30pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjsgLy8g5peg6ZyAIHNlbmRSZXNwb25zZVxuICAgIH1cbiAgICAvLyAyLiBIb29rIOeKtuaAgeS4iuaKpVxuICAgIGlmIChtZXNzYWdlLnR5cGUgPT09ICdBQ19IT09LX1NUQVRVUycpIHtcbiAgICAgICAgY29uc3QgdGFiSWQgPSBzZW5kZXIudGFiPy5pZDtcbiAgICAgICAgaWYgKHRhYklkKSB7XG4gICAgICAgICAgICBob29rU3RhdHVzTWFwW3RhYklkXSA9IHtcbiAgICAgICAgICAgICAgICBmZXRjaDogbWVzc2FnZS5zdGF0dXM/LmZldGNoIHx8IGZhbHNlLFxuICAgICAgICAgICAgICAgIHhocjogbWVzc2FnZS5zdGF0dXM/LnhociB8fCBmYWxzZSxcbiAgICAgICAgICAgICAgICBsYXN0UmVwb3J0OiBEYXRlLm5vdygpLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIDMuIOafpeivouafkOW5s+WPsOeahOWHreivge+8iOS+m+acquadpeS7u+WKoeaJp+ihjOaooeWdl+S9v+eUqO+8iVxuICAgIGlmIChtZXNzYWdlLnR5cGUgPT09ICdBQ19HRVRfQ1JFREVOVElBTFMnKSB7XG4gICAgICAgIGNvbnN0IHBsYXRmb3JtID0gbWVzc2FnZS5wbGF0Zm9ybTtcbiAgICAgICAgbG9hZENyZWRlbnRpYWxzKCkudGhlbihjcmVkcyA9PiB7XG4gICAgICAgICAgICBpZiAocGxhdGZvcm0gJiYgY3JlZHNbcGxhdGZvcm1dKSB7XG4gICAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgb2s6IHRydWUsIGNyZWRlbnRpYWxzOiBjcmVkc1twbGF0Zm9ybV0gfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBvazogZmFsc2UsIGVycm9yOiBgVW5rbm93biBwbGF0Zm9ybTogJHtwbGF0Zm9ybX1gIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIOW8guatpSBzZW5kUmVzcG9uc2VcbiAgICB9XG4gICAgLy8gNC4g5p+l6K+i5omA5pyJ5bmz5Y+w55qE5Yet6K+B54q25oCB5pGY6KaB77yI6LCD6K+V55So77yJXG4gICAgaWYgKG1lc3NhZ2UudHlwZSA9PT0gJ0FDX0dFVF9BTExfU1RBVFVTJykge1xuICAgICAgICBsb2FkQ3JlZGVudGlhbHMoKS50aGVuKGNyZWRzID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHN1bW1hcnkgPSB7fTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgW3AsIGNdIG9mIE9iamVjdC5lbnRyaWVzKGNyZWRzKSkge1xuICAgICAgICAgICAgICAgIHN1bW1hcnlbcF0gPSB7XG4gICAgICAgICAgICAgICAgICAgIGhhc1Rva2VuOiAhIWMuYmVhcmVyVG9rZW4sXG4gICAgICAgICAgICAgICAgICAgIHRva2VuUHJldmlldzogYy5iZWFyZXJUb2tlbiA/IGMuYmVhcmVyVG9rZW4uc3Vic3RyaW5nKDAsIDIwKSArICcuLi4nIDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgYXBpRW5kcG9pbnQ6IGMuYXBpRW5kcG9pbnQsXG4gICAgICAgICAgICAgICAgICAgIGxhc3RDYXB0dXJlZEF0OiBjLmxhc3RDYXB0dXJlZEF0ID8gbmV3IERhdGUoYy5sYXN0Q2FwdHVyZWRBdCkudG9JU09TdHJpbmcoKSA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGNhcHR1cmVDb3VudDogYy5jYXB0dXJlQ291bnQsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IG9rOiB0cnVlLCBzdW1tYXJ5LCBob29rU3RhdHVzOiBob29rU3RhdHVzTWFwIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIOW8guatpSBzZW5kUmVzcG9uc2VcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufSk7XG4vLyDilIDilIAg5YWo5bGAIHdlYlJlcXVlc3Qg5oum5oiq77ya6KKr5Yqo5o2V6I63IEJlYXJlciBUb2tlbiDilIDilIBcbi8vIOi/meaYr+WvuSBpbmplY3Rpb24udHMgZmV0Y2ggaG9vayDnmoTooaXlhYXvvJrljbPkvb8gaW5qZWN0aW9uIOayoeacieaNleiOt+WIsO+8jFxuLy8gd2ViUmVxdWVzdCDkuZ/og73ku47or7fmsYLlpLTkuK3mi7/liLAgQmVhcmVyIFRva2Vu44CCXG5jb25zdCBBSV9QTEFURk9STV9VUkxfUEFUVEVSTlMgPSBbXG4gICAgJ2h0dHBzOi8vY2hhdGdwdC5jb20vYmFja2VuZC1hcGkvKicsXG4gICAgJ2h0dHBzOi8vY2hhdC5vcGVuYWkuY29tL2JhY2tlbmQtYXBpLyonLFxuICAgICdodHRwczovL2dlbWluaS5nb29nbGUuY29tLyonLFxuICAgICdodHRwczovL2dyb2suY29tL3Jlc3QvKicsXG5dO1xuY2hyb21lLndlYlJlcXVlc3Qub25CZWZvcmVTZW5kSGVhZGVycy5hZGRMaXN0ZW5lcigoZGV0YWlscykgPT4ge1xuICAgIGNvbnN0IGhlYWRlcnMgPSBkZXRhaWxzLnJlcXVlc3RIZWFkZXJzIHx8IFtdO1xuICAgIGNvbnN0IGF1dGhIZWFkZXIgPSBoZWFkZXJzLmZpbmQoaCA9PiBoLm5hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ2F1dGhvcml6YXRpb24nKTtcbiAgICBpZiAoYXV0aEhlYWRlcj8udmFsdWU/LnN0YXJ0c1dpdGgoJ0JlYXJlciAnKSkge1xuICAgICAgICBjb25zdCB1cmwgPSBkZXRhaWxzLnVybDtcbiAgICAgICAgbGV0IHBsYXRmb3JtID0gbnVsbDtcbiAgICAgICAgaWYgKHVybC5pbmNsdWRlcygnY2hhdGdwdC5jb20nKSB8fCB1cmwuaW5jbHVkZXMoJ2NoYXQub3BlbmFpLmNvbScpKSB7XG4gICAgICAgICAgICBwbGF0Zm9ybSA9ICdjaGF0Z3B0JztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh1cmwuaW5jbHVkZXMoJ2dlbWluaS5nb29nbGUuY29tJykpIHtcbiAgICAgICAgICAgIHBsYXRmb3JtID0gJ2dlbWluaSc7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodXJsLmluY2x1ZGVzKCdncm9rLmNvbScpIHx8IHVybC5pbmNsdWRlcygneC5jb20nKSkge1xuICAgICAgICAgICAgcGxhdGZvcm0gPSAnZ3Jvayc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBsYXRmb3JtKSB7XG4gICAgICAgICAgICB1cGRhdGVQbGF0Zm9ybUNyZWRlbnRpYWxzKHBsYXRmb3JtLCBhdXRoSGVhZGVyLnZhbHVlLCB1cmwsIHt9KTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGAlY1thaUNsYXctQkddIPCfjJAgV2ViUmVxdWVzdCBjYXB0dXJlZCBCZWFyZXIgZm9yICR7cGxhdGZvcm19YCwgJ2NvbG9yOiAjNjBhNWZhJyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHsgcmVxdWVzdEhlYWRlcnM6IGhlYWRlcnMgfTtcbn0sIHsgdXJsczogQUlfUExBVEZPUk1fVVJMX1BBVFRFUk5TIH0sIFsncmVxdWVzdEhlYWRlcnMnXSk7XG4vLyDilIDilIAgdGFiIOWFs+mXreaXtua4heeQhiBob29rIOeKtuaAgSDilIDilIBcbmNocm9tZS50YWJzLm9uUmVtb3ZlZC5hZGRMaXN0ZW5lcigodGFiSWQpID0+IHtcbiAgICBkZWxldGUgaG9va1N0YXR1c01hcFt0YWJJZF07XG59KTtcbi8vIOKUgOKUgCBMb2NhbEJyaWRnZSBXZWJTb2NrZXQg5a6i5oi356uvIOKUgOKUgFxuYXN5bmMgZnVuY3Rpb24gcXVlcnlBSVRhYnNTdGF0dXMoKSB7XG4gICAgLy8g5p+l6K+i5omA5pyJIEFJIOW5s+WPsOeahCB0YWJzXG4gICAgY29uc3QgY2hhdGdwdFRhYnMgPSBhd2FpdCBjaHJvbWUudGFicy5xdWVyeSh7XG4gICAgICAgIHVybDogWydodHRwczovL2NoYXRncHQuY29tLyonLCAnaHR0cHM6Ly9jaGF0Lm9wZW5haS5jb20vKiddLFxuICAgIH0pO1xuICAgIGNvbnN0IGdlbWluaVRhYnMgPSBhd2FpdCBjaHJvbWUudGFicy5xdWVyeSh7XG4gICAgICAgIHVybDogWydodHRwczovL2dlbWluaS5nb29nbGUuY29tLyonXSxcbiAgICB9KTtcbiAgICBjb25zdCBncm9rVGFicyA9IGF3YWl0IGNocm9tZS50YWJzLnF1ZXJ5KHtcbiAgICAgICAgdXJsOiBbJ2h0dHBzOi8vZ3Jvay5jb20vKicsICdodHRwczovL3guY29tL2kvZ3JvayonXSxcbiAgICB9KTtcbiAgICBjb25zdCBhbGxUYWJzID0gW107XG4gICAgZm9yIChjb25zdCB0YWIgb2YgY2hhdGdwdFRhYnMpIHtcbiAgICAgICAgaWYgKHRhYi5pZCAmJiB0YWIudXJsKSB7XG4gICAgICAgICAgICBhbGxUYWJzLnB1c2goeyB0YWJJZDogdGFiLmlkLCB1cmw6IHRhYi51cmwsIHBsYXRmb3JtOiAnY2hhdGdwdCcsIGFjdGl2ZTogdGFiLmFjdGl2ZSB8fCBmYWxzZSB9KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYiBvZiBnZW1pbmlUYWJzKSB7XG4gICAgICAgIGlmICh0YWIuaWQgJiYgdGFiLnVybCkge1xuICAgICAgICAgICAgYWxsVGFicy5wdXNoKHsgdGFiSWQ6IHRhYi5pZCwgdXJsOiB0YWIudXJsLCBwbGF0Zm9ybTogJ2dlbWluaScsIGFjdGl2ZTogdGFiLmFjdGl2ZSB8fCBmYWxzZSB9KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYiBvZiBncm9rVGFicykge1xuICAgICAgICBpZiAodGFiLmlkICYmIHRhYi51cmwpIHtcbiAgICAgICAgICAgIGFsbFRhYnMucHVzaCh7IHRhYklkOiB0YWIuaWQsIHVybDogdGFiLnVybCwgcGxhdGZvcm06ICdncm9rJywgYWN0aXZlOiB0YWIuYWN0aXZlIHx8IGZhbHNlIH0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGFjdGl2ZVRhYiA9IGFsbFRhYnMuZmluZCh0ID0+IHQuYWN0aXZlKSB8fCBudWxsO1xuICAgIHJldHVybiB7XG4gICAgICAgIGhhc0FJVGFiczogYWxsVGFicy5sZW5ndGggPiAwLFxuICAgICAgICBwbGF0Zm9ybXM6IHtcbiAgICAgICAgICAgIGNoYXRncHQ6IGNoYXRncHRUYWJzLmxlbmd0aCA+IDAsXG4gICAgICAgICAgICBnZW1pbmk6IGdlbWluaVRhYnMubGVuZ3RoID4gMCxcbiAgICAgICAgICAgIGdyb2s6IGdyb2tUYWJzLmxlbmd0aCA+IDAsXG4gICAgICAgIH0sXG4gICAgICAgIGFjdGl2ZUFJVGFiSWQ6IGFjdGl2ZVRhYj8udGFiSWQgfHwgbnVsbCxcbiAgICAgICAgYWN0aXZlQUlVcmw6IGFjdGl2ZVRhYj8udXJsIHx8IG51bGwsXG4gICAgICAgIHRhYnM6IGFsbFRhYnMsXG4gICAgfTtcbn1cbmNvbnN0IGxvY2FsQnJpZGdlID0gbmV3IExvY2FsQnJpZGdlU29ja2V0KCk7XG5sb2NhbEJyaWRnZS5xdWVyeUFJVGFic0hhbmRsZXIgPSBxdWVyeUFJVGFic1N0YXR1cztcbi8vIOKUgOKUgCDlkK/liqjml6Xlv5cg4pSA4pSAXG5jb25zb2xlLmxvZygnJWNbYWlDbGF3LUJHXSDwn5qAIEJhY2tncm91bmQgc2VydmljZSB3b3JrZXIgc3RhcnRlZC4nLCAnY29sb3I6ICM2MGE1ZmE7IGZvbnQtd2VpZ2h0OiBib2xkOyBmb250LXNpemU6IDEzcHg7Jyk7XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=