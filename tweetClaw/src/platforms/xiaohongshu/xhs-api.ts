import { XHS_API_ENDPOINTS, XHS_HEADERS } from './xhs-consts';
import { XhsAction } from './types';

const EDITH = 'https://edith.xiaohongshu.com';

// ── 签名头占位 ─────────────────────────────────────────────────────────────────
//
// TODO Step 1: 用 signXhsRequest()（Offscreen Document + Spider_XHS JS）替换此函数。
//
// 当前仅返回基础请求头（无签名），调用 API 会返回 401/461。
// 这是架构清理阶段的占位实现，不应在生产中使用。
//
async function getHeaders(method: 'GET' | 'POST'): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    accept: 'application/json, text/plain, */*',
    referer: XHS_HEADERS.REFERER,
  };
  if (method === 'POST') {
    headers['content-type'] = XHS_HEADERS.CONTENT_TYPE;
  }
  return headers;
}

// ── 互动操作 ───────────────────────────────────────────────────────────────────

/**
 * 执行小红书互动操作（点赞 / 收藏 / 关注 / 评论）
 */
export async function performXhsAction(
  action: XhsAction,
  params: {
    note_id?: string;
    user_id?: string;
    content?: string;
    at_users?: string[];
  }
): Promise<any> {
  const endpoint = getActionEndpoint(action);
  const body = buildActionBody(action, params);
  const headers = await getHeaders('POST');

  const response = await fetch(`${EDITH}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`XHS ${action} failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  if (data.code !== 0 && data.success !== true) {
    throw new Error(data.msg || data.message || `XHS ${action} business error`);
  }

  return data;
}

function getActionEndpoint(action: XhsAction): string {
  switch (action) {
    case 'like':
    case 'unlike':
      return XHS_API_ENDPOINTS.LIKE;
    case 'collect':
    case 'uncollect':
      return XHS_API_ENDPOINTS.COLLECT;
    case 'follow':
    case 'unfollow':
      return XHS_API_ENDPOINTS.FOLLOW;
    case 'comment':
      return XHS_API_ENDPOINTS.COMMENT_POST;
    default:
      throw new Error(`Unknown XHS action: ${action}`);
  }
}

function buildActionBody(action: XhsAction, params: { note_id?: string; user_id?: string; content?: string; at_users?: string[] }): any {
  switch (action) {
    case 'like':
    case 'unlike':
      return { note_id: params.note_id, type: 'normal' };
    case 'collect':
    case 'uncollect':
      return { note_id: params.note_id };
    case 'follow':
    case 'unfollow':
      return { target_user_id: params.user_id };
    case 'comment':
      return {
        note_id: params.note_id,
        content: params.content,
        at_users: params.at_users || [],
      };
    default:
      return {};
  }
}

// ── 读取接口 ───────────────────────────────────────────────────────────────────

/**
 * 获取当前登录用户信息
 */
export async function fetchXhsCurrentUser(): Promise<any> {
  const headers = await getHeaders('GET');
  const response = await fetch(`${EDITH}${XHS_API_ENDPOINTS.USER_ME}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch current user: ${response.status}`);
  }
  return response.json();
}

/**
 * 获取首页推荐流
 */
export async function fetchXhsHomefeed(cursorScore: string = ''): Promise<any> {
  const headers = await getHeaders('POST');
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

  const response = await fetch(`${EDITH}${XHS_API_ENDPOINTS.HOMEFEED}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch homefeed: ${response.status}`);
  }
  return response.json();
}

/**
 * 获取笔记详情（feed 接口）
 */
export async function fetchXhsFeed(noteId: string): Promise<any> {
  const headers = await getHeaders('POST');
  const body = {
    source_note_id: noteId,
    image_formats: ['jpg', 'webp', 'avif'],
    extra: { need_body_topic: '1' },
    xsec_source: 'pc_feed',
    xsec_token: '',
  };

  const response = await fetch(`${EDITH}${XHS_API_ENDPOINTS.FEED}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status}`);
  }
  return response.json();
}

/**
 * 搜索笔记
 */
export async function searchXhsNotes(keyword: string, cursor: string = '', pageSize: number = 20): Promise<any> {
  const headers = await getHeaders('POST');
  const body: any = {
    keyword,
    page: 1,
    page_size: pageSize,
    search_id: '',
    sort: 'general',
    note_type: 0,
  };
  if (cursor) body.cursor = cursor;

  const response = await fetch(`${EDITH}${XHS_API_ENDPOINTS.SEARCH_NOTES}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to search notes: ${response.status}`);
  }
  return response.json();
}

/**
 * 获取用户发布的笔记列表
 */
export async function fetchXhsUserNotes(userId: string, cursor: string = ''): Promise<any> {
  const params = new URLSearchParams({
    user_id: userId,
    cursor,
    num: '30',
    image_formats: 'jpg,webp,avif',
  });

  const headers = await getHeaders('GET');
  const response = await fetch(`${EDITH}${XHS_API_ENDPOINTS.USER_POSTED}?${params}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user notes: ${response.status}`);
  }
  return response.json();
}

/**
 * 获取笔记评论列表
 */
export async function fetchXhsComments(noteId: string, cursor: string = ''): Promise<any> {
  const params = new URLSearchParams({
    note_id: noteId,
    cursor,
    top_comment_id: '',
    image_formats: 'jpg,webp,avif',
  });

  const headers = await getHeaders('GET');
  const response = await fetch(`${EDITH}${XHS_API_ENDPOINTS.COMMENT_PAGE}?${params}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch comments: ${response.status}`);
  }
  return response.json();
}

// ── Creator 接口（待实现）─────────────────────────────────────────────────────
//
// uploadXhsImage() / createXhsNote() 等 creator 接口待抓包验证后添加。
// 见计划文档 docs/XHS_DEVELOPMENT_PLAN.md Step 6 & 7。
