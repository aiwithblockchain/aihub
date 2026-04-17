import { XHS_MSG_TYPE } from '../platforms/xiaohongshu/xhs-consts';

/**
 * 小红书内容脚本入口
 * 职责:
 * 1. 注入 xhs-injection.js 到页面上下文
 * 2. 中继 injection → background 的消息
 * 3. 执行写操作(如点赞、收藏等)
 */

(function inject() {
  if (document.getElementById('xhs_injection')) return;
  const script = document.createElement('script');
  script.id = 'xhs_injection';
  script.src = chrome.runtime.getURL('js/xhs-injection.js');
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();
})();

window.addEventListener('message', (event) => {
  if (event.data?.source !== 'xhsclaw-injection') return;

  if (event.data.type === XHS_MSG_TYPE.SIGNAL_CAPTURED) {
    const headers = event.data.headers;
    if (headers?.['x-s']) {
      chrome.storage.local.set({
        xhs_xs_sign: headers['x-s'],
        xhs_xt: headers['x-t'],
      }).catch(() => {});
    }

    chrome.runtime.sendMessage({
      type: 'XHS_CAPTURED_DATA',
      endpoint: event.data.endpoint,
      apiUrl: event.data.apiUrl,
      pageUrl: event.data.pageUrl,
      method: event.data.method,
      requestBody: event.data.requestBody,
      headers: event.data.headers,
      data: event.data.data,
      timestamp: event.data.timestamp,
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'XHS_PING') {
    sendResponse({ ok: true, url: window.location.href, context: 'XHS_CONTENT_SCRIPT' });
    return true;
  }

  return false;
});

console.log('[XhsClaw-CS] Active.');
