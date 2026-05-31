export const XHS_API_ENDPOINTS = {
  FEED: '/api/sns/web/v1/feed',
  HOMEFEED: '/api/sns/web/v1/homefeed',
  NOTE_DETAIL: '/api/sns/web/v1/note/',
  USER_ME: '/api/sns/web/v2/user/me',
  USER_INFO: '/api/sns/web/v1/user/otherinfo',
  USER_POSTED: '/api/sns/web/v1/user_posted',
  SEARCH_NOTES: '/api/sns/web/v1/search/notes',
  SEARCH_FILTER: '/api/sns/web/v1/search/filter',
  SEARCH_USERS: '/api/sns/web/v1/intimacy/intimacy_list/search',
  COMMENT_PAGE: '/api/sns/web/v2/comment/page',
  COMMENT_SUB_PAGE: '/api/sns/web/v2/comment/sub/page',
  LIKE: '/api/sns/web/v1/note/like',
  DISLIKE: '/api/sns/web/v1/note/dislike',
  COLLECT: '/api/sns/web/v1/note/collect',
  FOLLOW: '/api/sns/web/v1/user/follow',
  UNFOLLOW: '/api/sns/web/v1/user/unfollow',
  COMMENT_POST: '/api/sns/web/v1/comment/post',
  COMMENT_DELETE: '/api/sns/web/v1/comment/delete',
  INTIMACY_LIST: '/api/sns/web/v1/intimacy/intimacy_list',
  SEARCH_TOPIC: '/web_api/sns/v1/search/topic',
  NOTIFICATIONS_MENTIONS: '/api/sns/web/v1/you/mentions',  NOTIFICATIONS_LIKES: '/api/sns/web/v1/you/likes',
  UNREAD_COUNT: '/api/sns/web/unread_count',
  CREATOR_PUBLISHED_NOTES: '/api/galaxy/creator/note/user/posted',
} as const;

// XHS_CREATOR_ENDPOINTS 暂缓定义，待抓包验证后添加

export const XHS_MSG_TYPE = {
  EXECUTE_ACTION: 'XHS_EXECUTE_ACTION',
  FETCH_NOTE: 'XHS_FETCH_NOTE',
  FETCH_CURRENT_USER: 'XHS_FETCH_CURRENT_USER',
  FETCH_HOMEFEED: 'XHS_FETCH_HOMEFEED',
  FETCH_FEED: 'XHS_FETCH_FEED',
  SEARCH_NOTES: 'XHS_SEARCH_NOTES',
  SEARCH_FILTER: 'XHS_SEARCH_FILTER',
  FETCH_USER_NOTES: 'XHS_FETCH_USER_NOTES',
  FETCH_COMMENTS: 'XHS_FETCH_COMMENTS',
  PUBLISH_IMAGE_NOTE: 'XHS_PUBLISH_IMAGE_NOTE',
  PUBLISH_VIDEO_NOTE: 'XHS_PUBLISH_VIDEO_NOTE',
  CHECK_SIGN_HEALTH: 'XHS_CHECK_SIGN_HEALTH',
  FETCH_NOTE_COMMENTS: 'XHS_FETCH_NOTE_COMMENTS',
  FETCH_USER_INFO: 'XHS_FETCH_USER_INFO',
  SEARCH_TOPICS: 'XHS_SEARCH_TOPICS',
  FETCH_NOTIFICATIONS: 'XHS_FETCH_NOTIFICATIONS',
  FETCH_PUBLISHED_NOTES: 'XHS_FETCH_PUBLISHED_NOTES',
  POST_COMMENT: 'XHS_POST_COMMENT',
  SEARCH_USERS: 'XHS_SEARCH_USERS',
  GET_INTIMACY_LIST: 'XHS_GET_INTIMACY_LIST',
  LIKE_NOTE: 'XHS_LIKE_NOTE',
  UNLIKE_NOTE: 'XHS_UNLIKE_NOTE',
  FOLLOW_USER: 'XHS_FOLLOW_USER',
  UNFOLLOW_USER: 'XHS_UNFOLLOW_USER',
  DELETE_COMMENT: 'XHS_DELETE_COMMENT',
} as const;

export const XHS_STORAGE_KEYS = {
  USER_ID: 'xhs_user_id',
} as const;

export const XHS_HEADERS = {
  CONTENT_TYPE: 'application/json;charset=UTF-8',
  REFERER: 'https://www.xiaohongshu.com/',
} as const;
