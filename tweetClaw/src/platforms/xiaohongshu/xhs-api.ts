import { XHS_API_ENDPOINTS, XHS_HEADERS, XHS_STORAGE_KEYS } from './xhs-consts';
import { XhsAction } from './types';

const DYNAMIC_HOMEFEED_HEADER_KEYS = [
  XHS_STORAGE_KEYS.XS_SIGN,
  XHS_STORAGE_KEYS.XT,
  XHS_STORAGE_KEYS.XS_COMMON,
  XHS_STORAGE_KEYS.RAP_PARAM,
] as const;

const OPTIONAL_HOMEFEED_HEADER_KEYS = [
  XHS_STORAGE_KEYS.B3_TRACEID,
  XHS_STORAGE_KEYS.XRAY_TRACEID,
  XHS_STORAGE_KEYS.XY_DIRECTION,
] as const;

/**
 * 获取小红书请求头
 *
 * 说明：
 * - x-s / x-t / x-s-common / x-rap-param 属于高动态值，不提供代码硬编码默认值，必须来自页面真实请求捕获。
 * - x-b3-traceid / x-xray-traceid / xy-direction 可使用最近一次捕获值；其中 xy-direction 在缺失时允许使用稳定默认值 98。
 */
async function getXhsHeaders(): Promise<Record<string, string>> {
  const stored = await chrome.storage.local.get([
    ...DYNAMIC_HOMEFEED_HEADER_KEYS,
    ...OPTIONAL_HOMEFEED_HEADER_KEYS,
  ]);

  const headers: Record<string, string> = {
    'content-type': XHS_HEADERS.CONTENT_TYPE,
    referer: XHS_HEADERS.REFERER,
    accept: 'application/json, text/plain, */*',
  };

  if (stored[XHS_STORAGE_KEYS.XS_SIGN]) {
    headers['x-s'] = String(stored[XHS_STORAGE_KEYS.XS_SIGN]);
  }
  if (stored[XHS_STORAGE_KEYS.XT]) {
    headers['x-t'] = String(stored[XHS_STORAGE_KEYS.XT]);
  }
  if (stored[XHS_STORAGE_KEYS.XS_COMMON]) {
    headers['x-s-common'] = String(stored[XHS_STORAGE_KEYS.XS_COMMON]);
  }
  if (stored[XHS_STORAGE_KEYS.RAP_PARAM]) {
    headers['x-rap-param'] = String(stored[XHS_STORAGE_KEYS.RAP_PARAM]);
  }
  if (stored[XHS_STORAGE_KEYS.B3_TRACEID]) {
    headers['x-b3-traceid'] = String(stored[XHS_STORAGE_KEYS.B3_TRACEID]);
  }
  if (stored[XHS_STORAGE_KEYS.XRAY_TRACEID]) {
    headers['x-xray-traceid'] = String(stored[XHS_STORAGE_KEYS.XRAY_TRACEID]);
  }
  if (stored[XHS_STORAGE_KEYS.XY_DIRECTION] !== undefined && stored[XHS_STORAGE_KEYS.XY_DIRECTION] !== null) {
    headers['xy-direction'] = String(stored[XHS_STORAGE_KEYS.XY_DIRECTION]);
  } else {
    headers['xy-direction'] = '98';
  }

  return headers;
}

/**
 * 获取无需 body 的小红书请求头
 */
async function getXhsGetHeaders(): Promise<Record<string, string>> {
  const headers = await getXhsHeaders();
  delete headers['content-type'];
  delete headers['x-rap-param'];
  delete headers['x-b3-traceid'];
  delete headers['x-xray-traceid'];
  delete headers['xy-direction'];
  return headers;
}

async function getHomefeedTemplate(): Promise<any> {
  const stored = await chrome.storage.local.get([XHS_STORAGE_KEYS.HOMEFEED_TEMPLATE]);
  return stored[XHS_STORAGE_KEYS.HOMEFEED_TEMPLATE] || null;
}

async function ensureHomefeedDynamicHeaders(): Promise<void> {
  const stored = await chrome.storage.local.get([...DYNAMIC_HOMEFEED_HEADER_KEYS]);
  const missingKeys = DYNAMIC_HOMEFEED_HEADER_KEYS.filter((key) => !stored[key]);

  if (missingKeys.length > 0) {
    throw new Error(`Missing captured Xiaohongshu dynamic headers: ${missingKeys.join(', ')}. Refresh Xiaohongshu home page first.`);
  }
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
  const headers = await getXhsGetHeaders();

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
 * 获取首页推荐流
 */
export async function fetchXhsHomefeed(cursorScore: string = ''): Promise<any> {
  await ensureHomefeedDynamicHeaders();

  const url = `https://edith.xiaohongshu.com${XHS_API_ENDPOINTS.HOMEFEED}`;
  const headers = await getXhsHeaders();
  const template = await getHomefeedTemplate();
  const isFirstPage = !String(cursorScore || '').trim();

  const body = {
    cursor_score: cursorScore,
    num: typeof template?.num === 'number' ? template.num : 35,
    refresh_type: isFirstPage ? 1 : 3,
    note_index: isFirstPage ? 0 : 35,
    unread_begin_note_id: typeof template?.unread_begin_note_id === 'string' ? template.unread_begin_note_id : '',
    unread_end_note_id: typeof template?.unread_end_note_id === 'string' ? template.unread_end_note_id : '',
    unread_note_count: typeof template?.unread_note_count === 'number' ? template.unread_note_count : 0,
    category: typeof template?.category === 'string' ? template.category : 'homefeed_recommend',
    search_key: typeof template?.search_key === 'string' ? template.search_key : '',
    need_num: typeof template?.need_num === 'number' ? template.need_num : 10,
    image_formats: Array.isArray(template?.image_formats) && template.image_formats.length > 0 ? template.image_formats : ['jpg', 'webp', 'avif'],
    need_filter_image: typeof template?.need_filter_image === 'boolean' ? template.need_filter_image : false,
  };

  console.log('[XhsAPI] homefeed request', {
    cursorScore,
    hasXs: Boolean(headers['x-s']),
    hasXt: Boolean(headers['x-t']),
    hasXsCommon: Boolean(headers['x-s-common']),
    hasRapParam: Boolean(headers['x-rap-param']),
    hasB3TraceId: Boolean(headers['x-b3-traceid']),
    hasXrayTraceId: Boolean(headers['x-xray-traceid']),
    hasXyDirection: Boolean(headers['xy-direction']),
    body,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch homefeed: ${response.status} ${text}`);
  }

  return response.json();
}

/**
 * 获取当前登录账号资料
 */
export async function fetchXhsCurrentUser(): Promise<any> {
  const url = 'https://edith.xiaohongshu.com/api/sns/web/v2/user/me';
  const headers = await getXhsGetHeaders();

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch current user: ${response.status} ${text}`);
  }

  return response.json();
}
