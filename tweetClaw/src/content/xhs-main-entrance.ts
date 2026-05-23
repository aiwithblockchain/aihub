import { XHS_MSG_TYPE } from '../platforms/xiaohongshu/xhs-consts';
import { performXhsAction } from '../platforms/xiaohongshu/xhs-api';

/**
 * 小红书 Content Script 入口
 *
 * 职责：
 * 1. 注入签名 inject script 到 Page Context
 * 2. 桥接 Background ↔ Page Context 的签名请求
 * 3. 接收来自 Background 的业务指令，通过签名后发送 API 请求
 *
 * 架构：
 *   Background  ──chrome.tabs.sendMessage──▶  Content Script (本文件)
 *   Content Script  ──window.postMessage──▶  Inject Script (Page Context)
 *   Inject Script  ──调用 window._webmsxyw──▶  签名结果
 *   Inject Script  ──window.postMessage──▶  Content Script
 *   Content Script  ──sendResponse──▶  Background
 */

const TAG = '[XhsClaw-CS]';

// ── 注入签名脚本到 Page Context ──────────────────────────────────────────────

function injectSignScript() {
  const scriptUrl = chrome.runtime.getURL('js/xhs-sign-inject.js');
  const script = document.createElement('script');
  script.src = scriptUrl;
  script.onload = () => {
    console.log(`${TAG} Sign inject script loaded into page context`);
    script.remove(); // 注入后移除 <script> 标签，代码已在 page context 中运行
  };
  script.onerror = (e) => {
    console.error(`${TAG} Failed to inject sign script`, e);
  };
  (document.head || document.documentElement).appendChild(script);
}

injectSignScript();

// ── 签名桥接：Content Script ↔ Page Context ──────────────────────────────────

interface PendingSign {
  resolve: (result: { 'x-s': string; 'x-t': string; 'x-s-common'?: string }) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingSigns = new Map<string, PendingSign>();

// 监听来自 inject script 的签名响应
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || msg.type !== 'XHS_SIGN_RESPONSE') return;

  const pending = pendingSigns.get(msg.msgId);
  if (!pending) return;

  pendingSigns.delete(msg.msgId);
  clearTimeout(pending.timer);

  if (msg.success && msg.result) {
    console.log(`${TAG} Sign response received: msgId=${msg.msgId}`);
    pending.resolve(msg.result);
  } else {
    console.error(`${TAG} Sign failed: msgId=${msg.msgId}, error=${msg.error}`);
    pending.reject(new Error(msg.error || 'Sign failed'));
  }
});

/**
 * 请求页面签名
 */
function requestSign(url: string, data: string): Promise<{ 'x-s': string; 'x-t': string; 'x-s-common'?: string }> {
  return new Promise((resolve, reject) => {
    const msgId = `sign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const timer = setTimeout(() => {
      pendingSigns.delete(msgId);
      reject(new Error('Sign request timed out (8s). Is xiaohongshu.com page fully loaded?'));
    }, 8000);

    pendingSigns.set(msgId, { resolve, reject, timer });

    window.postMessage({
      type: 'XHS_SIGN_REQUEST',
      msgId,
      url,
      data,
    }, '*');

    console.log(`${TAG} Sign request sent: msgId=${msgId}, url=${url}`);
  });
}

// ── 带签名的 API 请求 ────────────────────────────────────────────────────────

const EDITH = 'https://edith.xiaohongshu.com';

async function signedFetch(apiPath: string, method: 'GET' | 'POST', body?: string): Promise<any> {
  const bodyStr = body || '';

  // 1. 请求签名（包含 x-s, x-t, x-s-common）
  const signHeaders = await requestSign(apiPath, bodyStr);
  console.log(`${TAG} Got sign headers for ${apiPath}: x-s=${signHeaders['x-s']?.slice(0, 20)}..., x-s-common=${signHeaders['x-s-common'] ? 'present' : 'MISSING'}`);

  // 2. 组装完整请求头
  const headers: Record<string, string> = {
    'accept': 'application/json, text/plain, */*',
    'referer': 'https://www.xiaohongshu.com/',
    'x-s': signHeaders['x-s'],
    'x-t': signHeaders['x-t'],
  };

  // x-s-common 是必需的
  if (signHeaders['x-s-common']) {
    headers['x-s-common'] = signHeaders['x-s-common'];
  }

  // 只有 POST 请求才需要 content-type
  if (method === 'POST') {
    headers['content-type'] = 'application/json;charset=UTF-8';
  }

  // 3. 发起请求
  const url = `${EDITH}${apiPath}`;
  const fetchOptions: RequestInit = {
    method,
    headers,
    credentials: 'include',
  };
  if (method === 'POST' && bodyStr) {
    fetchOptions.body = bodyStr;
  }

  console.log(`${TAG} Fetching: ${method} ${url}`);
  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json();
}

// ── 业务 API 函数 ─────────────────────────────────────────────────────────────

async function fetchCurrentUser(): Promise<any> {
  return signedFetch('/api/sns/web/v2/user/me', 'GET');
}

async function fetchZones(): Promise<any> {
  return signedFetch('/api/sns/web/v1/zones', 'GET');
}

async function fetchHomefeed(cursorScore: string = ''): Promise<any> {
  const isFirstPage = !cursorScore.trim();
  const body = {
    cursor_score: cursorScore,
    num: 35,
    refresh_type: isFirstPage ? 1 : 3,
    note_index: isFirstPage ? 0 : 35,
    unread_begin_note_id: '',
    unread_end_note_id: '',
    unread_note_count: 0,
    category: 'homefeed_recommend',
    search_key: '',
    need_num: 10,
    image_formats: ['jpg', 'webp', 'avif'],
    need_filter_image: false,
  };
  return signedFetch('/api/sns/web/v1/homefeed', 'POST', JSON.stringify(body));
}

async function fetchFeed(noteId: string): Promise<any> {
  const body = {
    source_note_id: noteId,
    image_formats: ['jpg', 'webp', 'avif'],
    extra: { need_body_topic: 1 },
  };
  return signedFetch('/api/sns/web/v1/feed', 'POST', JSON.stringify(body));
}

async function searchNotes(keyword: string, cursor: string = '', pageSize: number = 20): Promise<any> {
  const body: any = {
    keyword,
    page: 1,
    page_size: pageSize,
    search_id: '',
    sort: 'general',
    note_type: 0,
  };
  if (cursor) body.cursor = cursor;
  return signedFetch('/api/sns/web/v1/search/notes', 'POST', JSON.stringify(body));
}

async function fetchUserNotes(userId: string, cursor: string = ''): Promise<any> {
  const params = new URLSearchParams({
    user_id: userId,
    cursor,
    num: '30',
    image_formats: 'jpg,webp,avif',
  });
  return signedFetch(`/api/sns/web/v1/user_posted?${params}`, 'GET');
}

async function fetchComments(noteId: string, cursor: string = ''): Promise<any> {
  const params = new URLSearchParams({
    note_id: noteId,
    cursor,
    top_comment_id: '',
    image_formats: 'jpg,webp,avif',
  });
  return signedFetch(`/api/sns/web/v2/comment/page?${params}`, 'GET');
}

// ── 消息处理 ──────────────────────────────────────────────────────────────────

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

  // ── 签名测试（用于验证签名链路是否通畅）────────────────────────────────────

  if (message.type === 'XHS_SIGN_TEST') {
    (async () => {
      try {
        const result = await requestSign(
          message.url || '/api/sns/web/v1/homefeed',
          message.data || '',
        );
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
        const data = await fetchCurrentUser();
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
        const data = await fetchHomefeed(String(message.cursor_score || ''));
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
        const data = await fetchFeed(String(message.note_id || ''));
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
        const data = await searchNotes(
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
        const data = await fetchUserNotes(
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
        const data = await fetchComments(
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

  if (message.type === XHS_MSG_TYPE.FETCH_NOTE) {
    (async () => {
      try {
        const data = await fetchFeed(String(message.note_id || ''));
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // ── 互动操作（暂保留直接 fetch，后续接入签名） ──────────────────────────────

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

  return false;
});

console.log(`${TAG} Active. Sign inject script injected into page context.`);
