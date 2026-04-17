/**
 * 从 URL 中提取笔记 ID
 */
export function extractNoteId(url: string): string | null {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\/explore\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * 从 URL 中提取用户 ID
 */
export function extractUserId(url: string): string | null {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\/user\/profile\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * 构建笔记 URL
 */
export function buildNoteUrl(noteId: string): string {
  return `https://www.xiaohongshu.com/explore/${noteId}`;
}

/**
 * 构建用户主页 URL
 */
export function buildUserUrl(userId: string): string {
  return `https://www.xiaohongshu.com/user/profile/${userId}`;
}
