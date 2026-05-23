import { XHS_API_ENDPOINTS, XHS_HEADERS } from './xhs-consts';
import { XhsAction } from './types';

const EDITH = 'https://edith.xiaohongshu.com';

// ── 互动操作 ───────────────────────────────────────────────────────────────────
//
// 注意：互动操作目前仍使用无签名的占位头，会返回 461。
// 后续需要改为从 Content Script 的 signedFetch 走，
// 或者在这里接受外部传入的签名头。
//
// 读取类 API（homefeed / feed / search 等）已迁移到
// xhs-main-entrance.ts 的 signedFetch 中，不再经过本文件。
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
