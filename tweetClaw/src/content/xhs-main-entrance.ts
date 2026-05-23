import { XHS_MSG_TYPE } from '../platforms/xiaohongshu/xhs-consts';
import {
  performXhsAction,
  fetchXhsCurrentUser,
  fetchXhsHomefeed,
  fetchXhsFeed,
  searchXhsNotes,
  fetchXhsUserNotes,
  fetchXhsComments,
} from '../platforms/xiaohongshu/xhs-api';

/**
 * 小红书 Content Script 入口
 *
 * 职责：
 * 1. 接收来自 Background 的业务指令，调用对应 API 并返回结果
 *
 * 已移除（架构重构）：
 * - xhs-injection.js 注入逻辑 → 签名改为本地生成，不再需要拦截页面请求
 * - window.message 签名头缓存逻辑 → 同上
 * - XHS_UPLOAD_IMAGE / XHS_CREATE_NOTE → creator 接口待抓包验证后重新实现
 *
 * 参见开发计划：docs/XHS_DEVELOPMENT_PLAN.md
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // ── 基础 ──────────────────────────────────────────────────────────────────

  if (message.type === 'XHS_PING') {
    sendResponse({ ok: true, url: window.location.href, context: 'XHS_CONTENT_SCRIPT' });
    return true;
  }

  if (message.type === 'XHS_SCROLL_PAGE') {
    window.scrollBy(0, message.pixels || 800);
    sendResponse({ ok: true });
    return true;
  }

  // ── 互动操作 ──────────────────────────────────────────────────────────────

  if (message.type === XHS_MSG_TYPE.EXECUTE_ACTION) {
    (async () => {
      try {
        const result = await performXhsAction(message.action, {
          note_id: message.note_id,
          user_id: message.user_id,
          content: message.content,
          at_users: message.at_users,
        });
        sendResponse({ success: true, data: result });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // ── 读取操作 ──────────────────────────────────────────────────────────────

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

  if (message.type === XHS_MSG_TYPE.FETCH_FEED) {
    (async () => {
      try {
        const data = await fetchXhsFeed(String(message.note_id || ''));
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.SEARCH_NOTES) {
    (async () => {
      try {
        const data = await searchXhsNotes(
          String(message.keyword || ''),
          String(message.cursor || ''),
          Number(message.page_size || 20),
        );
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.FETCH_USER_NOTES) {
    (async () => {
      try {
        const data = await fetchXhsUserNotes(
          String(message.user_id || ''),
          String(message.cursor || ''),
        );
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === XHS_MSG_TYPE.FETCH_COMMENTS) {
    (async () => {
      try {
        const data = await fetchXhsComments(
          String(message.note_id || ''),
          String(message.cursor || ''),
        );
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // FETCH_NOTE 仍保留（通过 note_id 直接 GET）
  if (message.type === XHS_MSG_TYPE.FETCH_NOTE) {
    (async () => {
      try {
        // fetchXhsFeed 作为 note 详情获取的主路径
        const data = await fetchXhsFeed(String(message.note_id || ''));
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
