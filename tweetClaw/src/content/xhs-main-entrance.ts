import { XHS_MSG_TYPE } from '../platforms/xiaohongshu/xhs-consts';
import { performXhsAction, fetchXhsNote, fetchXhsCurrentUser, fetchXhsHomefeed } from '../platforms/xiaohongshu/xhs-api';

/**
 * 小红书内容脚本入口
 * 职责:
 * 1. 注入 xhs-injection.js 到页面上下文
 * 2. 中继 injection → background 的消息（架构保留，暂不处理数据）
 * 3. 执行远程控制命令
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
    const endpoint = String(event.data.endpoint || '');
    const method = String(event.data.method || '').toUpperCase();

    if (endpoint === '/api/sns/web/v1/homefeed' && method === 'POST') {
      const headers = event.data.headers || {};
      const requestBody = event.data.requestBody || {};

      chrome.storage.local.set({
        xhs_xs_sign: headers['x-s'] || null,
        xhs_xt: headers['x-t'] || null,
        xhs_xs_common: headers['x-s-common'] || null,
        xhs_x_rap_param: headers['x-rap-param'] || null,
        xhs_x_b3_traceid: headers['x-b3-traceid'] || null,
        xhs_x_xray_traceid: headers['x-xray-traceid'] || null,
        xhs_xy_direction: headers['xy-direction'] ?? null,
        xhs_homefeed_template: {
          num: requestBody.num,
          note_index: requestBody.note_index,
          need_num: requestBody.need_num,
          image_formats: requestBody.image_formats,
          need_filter_image: requestBody.need_filter_image,
          category: requestBody.category,
          search_key: requestBody.search_key,
          unread_begin_note_id: requestBody.unread_begin_note_id,
          unread_end_note_id: requestBody.unread_end_note_id,
          unread_note_count: requestBody.unread_note_count,
          refresh_type: requestBody.refresh_type,
          captured_at: Date.now(),
          captured_from_url: window.location.href,
          captured_method: method,
          captured_endpoint: endpoint,
        },
      }).catch(() => {});
    }

    // 架构保留：未来需要时在这里处理拦截的数据
    // chrome.runtime.sendMessage({ type: 'XHS_CAPTURED_DATA', ...event.data });
  }
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'XHS_PING') {
    sendResponse({ ok: true, url: window.location.href, context: 'XHS_CONTENT_SCRIPT' });
    return true;
  }

  if (message.type === 'XHS_EXECUTE_ACTION') {
    (async () => {
      try {
        const result = await performXhsAction(message.action, {
          note_id: message.note_id,
          user_id: message.user_id,
          content: message.content,
        });
        sendResponse({ success: true, data: result });
      } catch (e: any) {
        console.error('[XhsClaw-CS] action failed:', e);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === 'XHS_FETCH_NOTE') {
    (async () => {
      try {
        const data = await fetchXhsNote(message.note_id);
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.FETCH_HOMEFEED) {
    (async () => {
      try {
        const data = await fetchXhsHomefeed(String(message.cursor_score || ''));
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.FETCH_CURRENT_USER) {
    (async () => {
      try {
        const data = await fetchXhsCurrentUser();
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  return false;
});

console.log('[XhsClaw-CS] Active.');
