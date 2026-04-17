import { XHS_API_ENDPOINTS, XHS_STORAGE_KEYS } from './xhs-consts';
import { XhsAction } from './types';

/**
 * 获取小红书请求头
 */
async function getXhsHeaders(): Promise<Record<string, string>> {
  const stored = await chrome.storage.local.get([
    XHS_STORAGE_KEYS.XS_SIGN,
    'xhs_xt',
  ]);

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'referer': 'https://www.xiaohongshu.com/',
    'accept': 'application/json, text/plain, */*',
  };

  if (stored[XHS_STORAGE_KEYS.XS_SIGN]) {
    headers['x-s'] = String(stored[XHS_STORAGE_KEYS.XS_SIGN]);
  }
  if (stored.xhs_xt) {
    headers['x-t'] = String(stored.xhs_xt);
  }

  return headers;
}

/**
 * 获取 API 端点
 */
function getXhsEndpoint(action: XhsAction): string {
  const baseUrl = 'https://edith.xiaohongshu.com';

  switch (action) {
    case 'like':
    case 'unlike':
      return `${baseUrl}${XHS_API_ENDPOINTS.LIKE}`;
    case 'collect':
    case 'uncollect':
      return `${baseUrl}${XHS_API_ENDPOINTS.COLLECT}`;
    case 'follow':
    case 'unfollow':
      return `${baseUrl}${XHS_API_ENDPOINTS.FOLLOW}`;
    case 'comment':
      return `${baseUrl}${XHS_API_ENDPOINTS.COMMENT_POST}`;
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * 执行小红书操作
 */
export async function performXhsAction(
  action: XhsAction,
  params: {
    note_id?: string;
    user_id?: string;
    content?: string;
  }
): Promise<any> {
  const endpoint = getXhsEndpoint(action);
  const headers = await getXhsHeaders();

  const body = buildRequestBody(action, params);

  console.log(`[XhsAPI] ${action} request to ${endpoint}`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[XhsAPI] ${action} failed (${response.status}):`, text);
    throw new Error(`XHS API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 0 && data.success !== true) {
    console.error(`[XhsAPI] ${action} business error:`, data);
    throw new Error(data.msg || data.message || 'XHS API business error');
  }

  console.log(`[XhsAPI] ${action} success`);
  return data;
}

/**
 * 构建请求体
 */
function buildRequestBody(
  action: XhsAction,
  params: {
    note_id?: string;
    user_id?: string;
    content?: string;
  }
): any {
  switch (action) {
    case 'like':
      return {
        note_id: params.note_id,
        type: 'normal',
      };
    case 'unlike':
      return {
        note_id: params.note_id,
        type: 'normal',
      };
    case 'collect':
      return {
        note_id: params.note_id,
      };
    case 'uncollect':
      return {
        note_id: params.note_id,
      };
    case 'follow':
      return {
        target_user_id: params.user_id,
      };
    case 'unfollow':
      return {
        target_user_id: params.user_id,
      };
    case 'comment':
      return {
        note_id: params.note_id,
        content: params.content,
        at_users: [],
      };
    default:
      return {};
  }
}

/**
 * 获取笔记详情
 */
export async function fetchXhsNote(noteId: string): Promise<any> {
  const url = `https://edith.xiaohongshu.com${XHS_API_ENDPOINTS.NOTE_DETAIL}${noteId}`;
  const headers = await getXhsHeaders();

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch note: ${response.status}`);
  }

  return response.json();
}

/**
 * 获取用户资料
 */
export async function fetchXhsUser(userId: string): Promise<any> {
  const url = `https://edith.xiaohongshu.com${XHS_API_ENDPOINTS.USER_INFO}`;
  const headers = await getXhsHeaders();

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ user_id: userId }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status}`);
  }

  return response.json();
}
