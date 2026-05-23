export const XHS_API_ENDPOINTS = {
  FEED: '/api/sns/web/v1/feed',
  HOMEFEED: '/api/sns/web/v1/homefeed',
  NOTE_DETAIL: '/api/sns/web/v1/note/',
  USER_ME: '/api/sns/web/v2/user/me',
  USER_INFO: '/api/sns/web/v1/user/otherinfo',
  USER_POSTED: '/api/sns/web/v1/user_posted',
  SEARCH_NOTES: '/api/sns/web/v1/search/notes',
  COMMENT_PAGE: '/api/sns/web/v2/comment/page',
  LIKE: '/api/sns/web/v1/note/like',
  COLLECT: '/api/sns/web/v1/note/collect',
  FOLLOW: '/api/sns/web/v1/user/follow',
  COMMENT_POST: '/api/sns/web/v2/comment/post',
} as const;

// XHS_CREATOR_ENDPOINTS 暂缓定义，待抓包验证后添加

export const XHS_MSG_TYPE = {
  EXECUTE_ACTION: 'XHS_EXECUTE_ACTION',
  FETCH_NOTE: 'XHS_FETCH_NOTE',
  FETCH_CURRENT_USER: 'XHS_FETCH_CURRENT_USER',
  FETCH_HOMEFEED: 'XHS_FETCH_HOMEFEED',
  FETCH_FEED: 'XHS_FETCH_FEED',
  SEARCH_NOTES: 'XHS_SEARCH_NOTES',
  FETCH_USER_NOTES: 'XHS_FETCH_USER_NOTES',
  FETCH_COMMENTS: 'XHS_FETCH_COMMENTS',
} as const;

export const XHS_STORAGE_KEYS = {
  USER_ID: 'xhs_user_id',
} as const;

export const XHS_HEADERS = {
  CONTENT_TYPE: 'application/json;charset=UTF-8',
  REFERER: 'https://www.xiaohongshu.com/',
} as const;
