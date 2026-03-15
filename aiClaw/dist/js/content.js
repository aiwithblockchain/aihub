/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

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
/*!**************************************!*\
  !*** ./src/content/main_entrance.ts ***!
  \**************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _capture_consts__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../capture/consts */ "./src/capture/consts.ts");
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

// ── 1. 注入 injection.js 到页面 MAIN world ──
(function injectScript() {
    // 防止重复注入
    if (document.getElementById('ac_injection'))
        return;
    const script = document.createElement('script');
    script.id = 'ac_injection';
    script.src = chrome.runtime.getURL('js/injection.js');
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => {
        script.remove(); // 注入后清理 DOM 中的 <script> 标签
        console.log('[aiClaw-CS] ✅ injection.js loaded into MAIN world');
    };
    script.onerror = (err) => {
        console.error('[aiClaw-CS] ❌ Failed to inject injection.js:', err);
    };
})();
// ── 2. 平台检测 ──
function detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com'))
        return 'ChatGPT';
    if (hostname.includes('gemini.google.com'))
        return 'Gemini';
    if (hostname.includes('grok.com') || hostname.includes('x.com'))
        return 'Grok';
    return 'Unknown';
}
// ── 3. 监听 injection.ts 通过 window.postMessage 发来的消息 ──
window.addEventListener('message', (event) => {
    // 安全检查：只处理来自 aiClaw injection 的消息
    if (event.data?.source !== _capture_consts__WEBPACK_IMPORTED_MODULE_0__.INJECTION_SOURCE)
        return;
    // 3a. 凭证捕获消息 → 转发给 background
    if (event.data.type === 'CREDENTIALS_CAPTURED') {
        chrome.runtime.sendMessage({
            type: _capture_consts__WEBPACK_IMPORTED_MODULE_0__.MsgType.CAPTURED_CREDENTIALS,
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
    if (message.type === _capture_consts__WEBPACK_IMPORTED_MODULE_0__.MsgType.PING) {
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
console.log(`%c[aiClaw-CS] ✅ Content script active on ${platform}`, 'color: #4ade80; font-weight: bold; font-size: 13px; background: #1a1a2e; padding: 4px 8px; border-radius: 4px;');
console.log(`[aiClaw-CS] URL: ${window.location.href}`);

})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianMvY29udGVudC5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sa0RBQWtEO0FBQ3pEO0FBQ087QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLDBCQUEwQjtBQUMzQjtBQUNPO0FBQ1A7QUFDQTtBQUNPO0FBQ1A7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ087QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7VUMvREE7VUFDQTs7VUFFQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTs7VUFFQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBOztVQUVBO1VBQ0E7VUFDQTs7Ozs7V0M1QkE7V0FDQTtXQUNBO1dBQ0E7V0FDQSx5Q0FBeUMsd0NBQXdDO1dBQ2pGO1dBQ0E7V0FDQSxFOzs7OztXQ1BBLHdGOzs7OztXQ0FBO1dBQ0E7V0FDQTtXQUNBLHVEQUF1RCxpQkFBaUI7V0FDeEU7V0FDQSxnREFBZ0QsYUFBYTtXQUM3RCxFOzs7Ozs7Ozs7Ozs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUM4RDtBQUM5RDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHlCQUF5QjtBQUN6QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwrQkFBK0IsNkRBQWdCO0FBQy9DO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0JBQWtCLG9EQUFPO0FBQ3pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsMkRBQTJEO0FBQzNEO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0EsQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBLHlCQUF5QixvREFBTztBQUNoQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBLENBQUM7QUFDRDtBQUNBO0FBQ0Esd0RBQXdELFNBQVMsb0JBQW9CLG1CQUFtQixpQkFBaUIscUJBQXFCLGtCQUFrQixtQkFBbUI7QUFDbkwsZ0NBQWdDLHFCQUFxQiIsInNvdXJjZXMiOlsid2VicGFjazovL2FpQ2xhdy8uL3NyYy9jYXB0dXJlL2NvbnN0cy50cyIsIndlYnBhY2s6Ly9haUNsYXcvd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vYWlDbGF3L3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly9haUNsYXcvd2VicGFjay9ydW50aW1lL2hhc093blByb3BlcnR5IHNob3J0aGFuZCIsIndlYnBhY2s6Ly9haUNsYXcvd2VicGFjay9ydW50aW1lL21ha2UgbmFtZXNwYWNlIG9iamVjdCIsIndlYnBhY2s6Ly9haUNsYXcvLi9zcmMvY29udGVudC9tYWluX2VudHJhbmNlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogY29uc3RzLnRzIC0gYWlDbGF3IOW4uOmHj+WumuS5iVxuICpcbiAqIOWumuS5ieWtmOWCqOmUruWQjeOAgea2iOaBr+exu+Wei+OAgeW5s+WPsOebuOWFs+W4uOmHj+OAglxuICovXG4vLyDilIDilIAgY2hyb21lLnN0b3JhZ2UubG9jYWwg5Lit5L2/55So55qE6ZSu5ZCNIOKUgOKUgFxuZXhwb3J0IGNvbnN0IFNUT1JBR0VfS0VZX0NSRURFTlRJQUxTID0gJ2FjX2NyZWRlbnRpYWxzJzsgLy8g5a2Y5YKo5ZCE5bmz5Y+w5Yet6K+BXG4vLyDilIDilIAg5omp5bGV5YaF6YOo5raI5oGv57G75Z6LIOKUgOKUgFxuZXhwb3J0IHZhciBNc2dUeXBlO1xuKGZ1bmN0aW9uIChNc2dUeXBlKSB7XG4gICAgTXNnVHlwZVtcIlBJTkdcIl0gPSBcIkFDX1BJTkdcIjtcbiAgICBNc2dUeXBlW1wiQ0FQVFVSRURfQ1JFREVOVElBTFNcIl0gPSBcIkFDX0NBUFRVUkVEX0NSRURFTlRJQUxTXCI7XG4gICAgTXNnVHlwZVtcIkVYRUNVVEVfVEFTS1wiXSA9IFwiQUNfRVhFQ1VURV9UQVNLXCI7XG4gICAgTXNnVHlwZVtcIlRBU0tfUkVTVUxUXCJdID0gXCJBQ19UQVNLX1JFU1VMVFwiO1xuICAgIE1zZ1R5cGVbXCJBQ19TRU5EX1RFU1RfTUVTU0FHRVwiXSA9IFwiQUNfU0VORF9URVNUX01FU1NBR0VcIjtcbn0pKE1zZ1R5cGUgfHwgKE1zZ1R5cGUgPSB7fSkpO1xuLy8g4pSA4pSAIGluamVjdGlvbiDihpIgY29udGVudCDnmoQgcG9zdE1lc3NhZ2Ugc291cmNlIOagh+ivhiDilIDilIBcbmV4cG9ydCBjb25zdCBJTkpFQ1RJT05fU09VUkNFID0gJ2FpY2xhdy1pbmplY3Rpb24nO1xuLy8g4pSA4pSAIOW5s+WPsCBVUkwg5Yy56YWN6KeE5YiZIOKUgOKUgFxuLy8g55So5LqOIGluamVjdGlvbi50cyDliKTmlq3lvZPliY3mi6bmiKrliLDnmoQgZmV0Y2gg6K+35rGC5bGe5LqO5ZOq5Liq5bmz5Y+w55qEIEFQSVxuZXhwb3J0IGNvbnN0IFBMQVRGT1JNX0FQSV9QQVRURVJOUyA9IHtcbiAgICBjaGF0Z3B0OiBbXG4gICAgICAgIC9jaGF0Z3B0XFwuY29tXFwvYmFja2VuZC1hcGlcXC8vLFxuICAgICAgICAvY2hhdFxcLm9wZW5haVxcLmNvbVxcL2JhY2tlbmQtYXBpXFwvLyxcbiAgICBdLFxuICAgIGdlbWluaTogW1xuICAgICAgICAvZ2VtaW5pXFwuZ29vZ2xlXFwuY29tXFwvX1xcL0JhcmRDaGF0VWlcXC8vLFxuICAgICAgICAvZ2VtaW5pXFwuZ29vZ2xlXFwuY29tXFwvYXBwXFwvX1xcL0JhcmRDaGF0VWlcXC8vLFxuICAgICAgICAvYWxrYWxpbWFrZXJzdWl0ZS1wYVxcLmNsaWVudHM2XFwuZ29vZ2xlXFwuY29tXFwvLyxcbiAgICBdLFxuICAgIGdyb2s6IFtcbiAgICAgICAgL2dyb2tcXC5jb21cXC9yZXN0XFwvYXBwLWNoYXRcXC8vLFxuICAgICAgICAveFxcLmNvbVxcL2lcXC9hcGlcXC8yXFwvZ3Jva1xcLy8sXG4gICAgXSxcbn07XG4vKipcbiAqIOajgOa1i+S4gOS4quivt+axgiBVUkwg5piv5ZCm5piv5oiR5Lus6ZyA6KaB5YWz5rOo55qEIEFJIOW5s+WPsCBBUEkg6LCD55So44CCXG4gKiDlpoLmnpzljLnphY3vvIzov5Tlm57lubPlj7DlkI3np7DvvJvlkKbliJnov5Tlm54gbnVsbOOAglxuICovXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0UGxhdGZvcm1Gcm9tVXJsKHVybCkge1xuICAgIGZvciAoY29uc3QgW3BsYXRmb3JtLCBwYXR0ZXJuc10gb2YgT2JqZWN0LmVudHJpZXMoUExBVEZPUk1fQVBJX1BBVFRFUk5TKSkge1xuICAgICAgICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgcGF0dGVybnMpIHtcbiAgICAgICAgICAgIGlmIChwYXR0ZXJuLnRlc3QodXJsKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBwbGF0Zm9ybTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cbi8qKlxuICog5qC55o2uIGhvc3RuYW1lIOajgOa1i+W9k+WJjemhtemdouaJgOWcqOeahOW5s+WPsOOAglxuICovXG5leHBvcnQgZnVuY3Rpb24gZGV0ZWN0UGxhdGZvcm1Gcm9tSG9zdG5hbWUoaG9zdG5hbWUpIHtcbiAgICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoJ2NoYXRncHQuY29tJykgfHwgaG9zdG5hbWUuaW5jbHVkZXMoJ2NoYXQub3BlbmFpLmNvbScpKSB7XG4gICAgICAgIHJldHVybiAnY2hhdGdwdCc7XG4gICAgfVxuICAgIGlmIChob3N0bmFtZS5pbmNsdWRlcygnZ2VtaW5pLmdvb2dsZS5jb20nKSkge1xuICAgICAgICByZXR1cm4gJ2dlbWluaSc7XG4gICAgfVxuICAgIGlmIChob3N0bmFtZS5pbmNsdWRlcygnZ3Jvay5jb20nKSB8fCBob3N0bmFtZS5pbmNsdWRlcygneC5jb20nKSkge1xuICAgICAgICByZXR1cm4gJ2dyb2snO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn1cbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0aWYgKCEobW9kdWxlSWQgaW4gX193ZWJwYWNrX21vZHVsZXNfXykpIHtcblx0XHRkZWxldGUgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0XHR2YXIgZSA9IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIgKyBtb2R1bGVJZCArIFwiJ1wiKTtcblx0XHRlLmNvZGUgPSAnTU9EVUxFX05PVF9GT1VORCc7XG5cdFx0dGhyb3cgZTtcblx0fVxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCIvKipcbiAqIG1haW5fZW50cmFuY2UudHMgLSBhaUNsYXcgQ29udGVudCBTY3JpcHQgKFBoYXNlIDEpXG4gKlxuICog6IGM6LSj77yaXG4gKiAgIDEuIOWwhiBpbmplY3Rpb24uanMg5rOo5YWl6aG16Z2i55qEIE1BSU4gd29ybGTvvIjkvb/lhbbog70gaG9vayBmZXRjaO+8iVxuICogICAyLiDkuK3nu6cgaW5qZWN0aW9uIOKGkiBiYWNrZ3JvdW5kIOeahOa2iOaBr++8iOWHreivgeaNleiOt+aVsOaNru+8iVxuICogICAzLiDlk43lupQgYmFja2dyb3VuZCDlj5HmnaXnmoQgUElORyDmtojmga9cbiAqXG4gKiDmnrbmnoTlsYLnuqfvvJpMYXllciAy77yISVNPTEFURUQgd29ybGTvvIlcbiAqIOmAmuS/oeaWueW8j++8mlxuICogICAtIGluamVjdGlvbiDihpQgY29udGVudO+8mndpbmRvdy5wb3N0TWVzc2FnZVxuICogICAtIGNvbnRlbnQg4oaUIGJhY2tncm91bmTvvJpjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZVxuICovXG5pbXBvcnQgeyBJTkpFQ1RJT05fU09VUkNFLCBNc2dUeXBlIH0gZnJvbSAnLi4vY2FwdHVyZS9jb25zdHMnO1xuLy8g4pSA4pSAIDEuIOazqOWFpSBpbmplY3Rpb24uanMg5Yiw6aG16Z2iIE1BSU4gd29ybGQg4pSA4pSAXG4oZnVuY3Rpb24gaW5qZWN0U2NyaXB0KCkge1xuICAgIC8vIOmYsuatoumHjeWkjeazqOWFpVxuICAgIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWNfaW5qZWN0aW9uJykpXG4gICAgICAgIHJldHVybjtcbiAgICBjb25zdCBzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtcbiAgICBzY3JpcHQuaWQgPSAnYWNfaW5qZWN0aW9uJztcbiAgICBzY3JpcHQuc3JjID0gY2hyb21lLnJ1bnRpbWUuZ2V0VVJMKCdqcy9pbmplY3Rpb24uanMnKTtcbiAgICAoZG9jdW1lbnQuaGVhZCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpLmFwcGVuZENoaWxkKHNjcmlwdCk7XG4gICAgc2NyaXB0Lm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgc2NyaXB0LnJlbW92ZSgpOyAvLyDms6jlhaXlkI7muIXnkIYgRE9NIOS4reeahCA8c2NyaXB0PiDmoIfnrb5cbiAgICAgICAgY29uc29sZS5sb2coJ1thaUNsYXctQ1NdIOKchSBpbmplY3Rpb24uanMgbG9hZGVkIGludG8gTUFJTiB3b3JsZCcpO1xuICAgIH07XG4gICAgc2NyaXB0Lm9uZXJyb3IgPSAoZXJyKSA9PiB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1thaUNsYXctQ1NdIOKdjCBGYWlsZWQgdG8gaW5qZWN0IGluamVjdGlvbi5qczonLCBlcnIpO1xuICAgIH07XG59KSgpO1xuLy8g4pSA4pSAIDIuIOW5s+WPsOajgOa1iyDilIDilIBcbmZ1bmN0aW9uIGRldGVjdFBsYXRmb3JtKCkge1xuICAgIGNvbnN0IGhvc3RuYW1lID0gd2luZG93LmxvY2F0aW9uLmhvc3RuYW1lO1xuICAgIGlmIChob3N0bmFtZS5pbmNsdWRlcygnY2hhdGdwdC5jb20nKSB8fCBob3N0bmFtZS5pbmNsdWRlcygnY2hhdC5vcGVuYWkuY29tJykpXG4gICAgICAgIHJldHVybiAnQ2hhdEdQVCc7XG4gICAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKCdnZW1pbmkuZ29vZ2xlLmNvbScpKVxuICAgICAgICByZXR1cm4gJ0dlbWluaSc7XG4gICAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKCdncm9rLmNvbScpIHx8IGhvc3RuYW1lLmluY2x1ZGVzKCd4LmNvbScpKVxuICAgICAgICByZXR1cm4gJ0dyb2snO1xuICAgIHJldHVybiAnVW5rbm93bic7XG59XG4vLyDilIDilIAgMy4g55uR5ZCsIGluamVjdGlvbi50cyDpgJrov4cgd2luZG93LnBvc3RNZXNzYWdlIOWPkeadpeeahOa2iOaBryDilIDilIBcbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgKGV2ZW50KSA9PiB7XG4gICAgLy8g5a6J5YWo5qOA5p+l77ya5Y+q5aSE55CG5p2l6IeqIGFpQ2xhdyBpbmplY3Rpb24g55qE5raI5oGvXG4gICAgaWYgKGV2ZW50LmRhdGE/LnNvdXJjZSAhPT0gSU5KRUNUSU9OX1NPVVJDRSlcbiAgICAgICAgcmV0dXJuO1xuICAgIC8vIDNhLiDlh63or4HmjZXojrfmtojmga8g4oaSIOi9rOWPkee7mSBiYWNrZ3JvdW5kXG4gICAgaWYgKGV2ZW50LmRhdGEudHlwZSA9PT0gJ0NSRURFTlRJQUxTX0NBUFRVUkVEJykge1xuICAgICAgICBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgICB0eXBlOiBNc2dUeXBlLkNBUFRVUkVEX0NSRURFTlRJQUxTLFxuICAgICAgICAgICAgcGxhdGZvcm06IGV2ZW50LmRhdGEucGxhdGZvcm0sXG4gICAgICAgICAgICBhcGlVcmw6IGV2ZW50LmRhdGEuYXBpVXJsLFxuICAgICAgICAgICAgbWV0aG9kOiBldmVudC5kYXRhLm1ldGhvZCxcbiAgICAgICAgICAgIGJlYXJlclRva2VuOiBldmVudC5kYXRhLmJlYXJlclRva2VuIHx8IG51bGwsXG4gICAgICAgICAgICByZXF1ZXN0SGVhZGVyczogZXZlbnQuZGF0YS5yZXF1ZXN0SGVhZGVycyB8fCB7fSxcbiAgICAgICAgICAgIHJlcXVlc3RCb2R5OiBldmVudC5kYXRhLnJlcXVlc3RCb2R5IHx8IG51bGwsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IGV2ZW50LmRhdGEudGltZXN0YW1wIHx8IERhdGUubm93KCksXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvLyAzYi4gSG9vayDnirbmgIHkuIrmiqUg4oaSIOi9rOWPkee7mSBiYWNrZ3JvdW5kXG4gICAgaWYgKGV2ZW50LmRhdGEudHlwZSA9PT0gJ0hPT0tfU1RBVFVTX1JFUE9SVCcpIHtcbiAgICAgICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgdHlwZTogJ0FDX0hPT0tfU1RBVFVTJyxcbiAgICAgICAgICAgIHN0YXR1czogZXZlbnQuZGF0YS5zdGF0dXMsXG4gICAgICAgIH0pO1xuICAgIH1cbn0pO1xuLy8g4pSA4pSAIDQuIOWTjeW6lCBiYWNrZ3JvdW5kIOWPkeadpeeahOa2iOaBryDilIDilIBcbmNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICAvLyBQSU5H77yaYmFja2dyb3VuZCDmo4Dmn6UgY29udGVudCBzY3JpcHQg5piv5ZCm5a2Y5rS7XG4gICAgaWYgKG1lc3NhZ2UudHlwZSA9PT0gTXNnVHlwZS5QSU5HKSB7XG4gICAgICAgIHNlbmRSZXNwb25zZSh7XG4gICAgICAgICAgICBvazogdHJ1ZSxcbiAgICAgICAgICAgIHVybDogd2luZG93LmxvY2F0aW9uLmhyZWYsXG4gICAgICAgICAgICBwbGF0Zm9ybTogZGV0ZWN0UGxhdGZvcm0oKSxcbiAgICAgICAgICAgIGNvbnRleHQ6ICdDT05URU5UX1NDUklQVCcsXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufSk7XG4vLyDilIDilIAgNS4g5ZCv5Yqo5pel5b+XIOKUgOKUgFxuY29uc3QgcGxhdGZvcm0gPSBkZXRlY3RQbGF0Zm9ybSgpO1xuY29uc29sZS5sb2coYCVjW2FpQ2xhdy1DU10g4pyFIENvbnRlbnQgc2NyaXB0IGFjdGl2ZSBvbiAke3BsYXRmb3JtfWAsICdjb2xvcjogIzRhZGU4MDsgZm9udC13ZWlnaHQ6IGJvbGQ7IGZvbnQtc2l6ZTogMTNweDsgYmFja2dyb3VuZDogIzFhMWEyZTsgcGFkZGluZzogNHB4IDhweDsgYm9yZGVyLXJhZGl1czogNHB4OycpO1xuY29uc29sZS5sb2coYFthaUNsYXctQ1NdIFVSTDogJHt3aW5kb3cubG9jYXRpb24uaHJlZn1gKTtcbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==