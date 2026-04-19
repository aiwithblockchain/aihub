export const XHS_API_ENDPOINTS = {
  FEED: '/api/sns/web/v1/feed',
  HOMEFEED: '/api/sns/web/v1/homefeed',
  NOTE_DETAIL: '/api/sns/web/v1/note/',
  USER_INFO: '/api/sns/web/v1/user/otherinfo',
  USER_POSTED: '/api/sns/web/v1/user_posted',
  COMMENT_PAGE: '/api/sns/web/v2/comment/page',
  LIKE: '/api/sns/web/v1/note/like',
  COLLECT: '/api/sns/web/v1/note/collect',
  FOLLOW: '/api/sns/web/v1/user/follow',
  COMMENT_POST: '/api/sns/web/v2/comment/post',
} as const;

export const XHS_MSG_TYPE = {
  SIGNAL_CAPTURED: 'XHS_SIGNAL_CAPTURED',
  EXECUTE_ACTION: 'XHS_EXECUTE_ACTION',
  FETCH_NOTE: 'XHS_FETCH_NOTE',
  FETCH_CURRENT_USER: 'XHS_FETCH_CURRENT_USER',
  FETCH_HOMEFEED: 'XHS_FETCH_HOMEFEED',
  FETCH_FEED: 'XHS_FETCH_FEED',
} as const;

export const XHS_STORAGE_KEYS = {
  USER_ID: 'xhs_user_id',
  COOKIES: 'xhs_cookies',
  XS_SIGN: 'xhs_xs_sign',
  XT: 'xhs_xt',
  XS_COMMON: 'xhs_xs_common',
  RAP_PARAM: 'xhs_x_rap_param',
  B3_TRACEID: 'xhs_x_b3_traceid',
  XRAY_TRACEID: 'xhs_x_xray_traceid',
  XY_DIRECTION: 'xhs_xy_direction',
  HOMEFEED_TEMPLATE: 'xhs_homefeed_template',
} as const;

export const XHS_HEADERS = {
  CONTENT_TYPE: 'application/json;charset=UTF-8',
  REFERER: 'https://www.xiaohongshu.com/',
} as const;
