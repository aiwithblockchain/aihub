export const PROTOCOL_NAME = 'aihub-localbridge';
export const PROTOCOL_VERSION = 'v1';

export type MessageType =
  | 'client.hello'
  | 'server.hello_ack'
  | 'ping'
  | 'pong'
  | 'request.query_x_tabs_status'
  | 'response.query_x_tabs_status'
  | 'request.query_x_basic_info'
  | 'response.query_x_basic_info'
  | 'request.query_xhs_account_info'
  | 'response.query_xhs_account_info'
  | 'command.query_xhs_account_info'
  | 'command.query_xhs_homefeed'
  | 'response.query_xhs_homefeed'
  | 'command.query_xhs_feed'
  | 'response.query_xhs_feed'
  | 'command.query_xhs_search'
  | 'response.query_xhs_search'
  | 'command.query_xhs_user_notes'
  | 'response.query_xhs_user_notes'
  | 'command.xhs_publish_image_note'
  | 'response.xhs_publish_image_note'
  | 'command.xhs_publish_video_note'
  | 'response.xhs_publish_video_note'
  | 'command.xhs_check_sign_health'
  | 'response.xhs_check_sign_health'
  | 'command.xhs_get_note_comments'
  | 'response.xhs_get_note_comments'
  | 'command.xhs_get_user_info'
  | 'response.xhs_get_user_info'
  | 'command.xhs_search_topics'
  | 'response.xhs_search_topics'
  | 'command.xhs_get_notifications'
  | 'response.xhs_get_notifications'
  | 'command.xhs_get_published_notes'
  | 'response.xhs_get_published_notes'
  | 'command.xhs_search_filter'
  | 'response.xhs_search_filter'
  | 'command.xhs_post_comment'
  | 'response.xhs_post_comment'
  | 'command.xhs_search_users'
  | 'response.xhs_search_users'
  | 'command.xhs_get_intimacy_list'
  | 'response.xhs_get_intimacy_list'
  | 'command.xhs_like_note'
  | 'response.xhs_like_note'
  | 'command.xhs_unlike_note'
  | 'response.xhs_unlike_note'
  | 'command.xhs_follow_user'
  | 'response.xhs_follow_user'
  | 'command.xhs_unfollow_user'
  | 'response.xhs_unfollow_user'
  | 'command.xhs_collect_note'
  | 'response.xhs_collect_note'
  | 'command.xhs_delete_note'
  | 'response.xhs_delete_note'
  | 'command.xhs_delete_comment'
  | 'response.xhs_delete_comment'
  | 'command.xhs_get_friend_fans'
  | 'response.xhs_get_friend_fans'
  | 'command.xhs_create_collection'
  | 'response.xhs_create_collection'
  | 'command.xhs_list_collections'
  | 'response.xhs_list_collections'
  | 'command.xhs_list_collection_notes'
  | 'response.xhs_list_collection_notes'
  | 'command.xhs_update_collection'
  | 'response.xhs_update_collection'
  | 'command.xhs_get_note_detail_stats'
  | 'response.xhs_get_note_detail_stats'
  // Instagram message types
  | 'command.ig_check_login'
  | 'response.ig_check_login'
  | 'command.ig_get_self_info'
  | 'response.ig_get_self_info'
  | 'command.ig_get_user_info'
  | 'response.ig_get_user_info'
  | 'command.ig_search_user'
  | 'response.ig_search_user'
  | 'command.ig_get_feed'
  | 'response.ig_get_feed'
  | 'command.ig_get_media'
  | 'response.ig_get_media'
  | 'command.ig_like_media'
  | 'response.ig_like_media'
  | 'command.ig_unlike_media'
  | 'response.ig_unlike_media'
  | 'command.ig_follow_user'
  | 'response.ig_follow_user'
  | 'command.ig_unfollow_user'
  | 'response.ig_unfollow_user'
  | 'command.ig_post_comment'
  | 'response.ig_post_comment'
  | 'command.ig_delete_comment'
  | 'response.ig_delete_comment'
  | 'command.ig_post_media'
  | 'response.ig_post_media'
  | 'command.ig_delete_media'
  | 'response.ig_delete_media'
  | 'command.ig_get_user_media'
  | 'response.ig_get_user_media'
  | 'command.ig_get_media_comments'
  | 'response.ig_get_media_comments'
  | 'command.ig_search'
  | 'response.ig_search'
  | 'command.ig_get_notifications'
  | 'response.ig_get_notifications'
  | 'command.ig_get_followers'
  | 'response.ig_get_followers'
  | 'command.ig_get_following'
  | 'response.ig_get_following'
  | 'command.query_x_basic_info'
  | 'request.open_tab'
  | 'response.open_tab'
  | 'request.close_tab'
  | 'response.close_tab'
  | 'request.navigate_tab'
  | 'response.navigate_tab'
  | 'request.exec_action'
  | 'response.exec_action'
  | 'request.query_home_timeline'
  | 'response.query_home_timeline'
  | 'request.query_tweet_replies'
  | 'response.query_tweet_replies'
  | 'request.query_tweet_detail'
  | 'response.query_tweet_detail'
  | 'request.query_user_profile'
  | 'response.query_user_profile'
  | 'request.query_search_timeline'
  | 'response.query_search_timeline'
  | 'request.query_user_tweets'
  | 'response.query_user_tweets'
  | 'request.query_followers'
  | 'response.query_followers'
  | 'request.query_following'
  | 'response.query_following'
  | 'request.query_blue_verified_followers'
  | 'response.query_blue_verified_followers'
  | 'request.start_task'
  | 'request.cancel_task'
  | 'event.task_progress'
  | 'event.task_failed'
  | 'event.task_completed'
  | 'event.task_cancelled'
  | 'response.error';

export const MESSAGE_TYPES: Record<string, MessageType> = {
  CLIENT_HELLO: 'client.hello',
  SERVER_HELLO_ACK: 'server.hello_ack',
  PING: 'ping',
  PONG: 'pong',
  REQUEST_QUERY_X_TABS_STATUS: 'request.query_x_tabs_status',
  RESPONSE_QUERY_X_TABS_STATUS: 'response.query_x_tabs_status',
  REQUEST_QUERY_X_BASIC_INFO: 'request.query_x_basic_info',
  RESPONSE_QUERY_X_BASIC_INFO: 'response.query_x_basic_info',
  COMMAND_QUERY_XHS_ACCOUNT_INFO: 'command.query_xhs_account_info',
  RESPONSE_QUERY_XHS_ACCOUNT_INFO: 'response.query_xhs_account_info',
  COMMAND_QUERY_XHS_HOMEFEED: 'command.query_xhs_homefeed',
  RESPONSE_QUERY_XHS_HOMEFEED: 'response.query_xhs_homefeed',
  COMMAND_QUERY_XHS_FEED: 'command.query_xhs_feed',
  RESPONSE_QUERY_XHS_FEED: 'response.query_xhs_feed',
  COMMAND_QUERY_XHS_SEARCH: 'command.query_xhs_search',
  RESPONSE_QUERY_XHS_SEARCH: 'response.query_xhs_search',
  COMMAND_QUERY_XHS_USER_NOTES: 'command.query_xhs_user_notes',
  RESPONSE_QUERY_XHS_USER_NOTES: 'response.query_xhs_user_notes',
  COMMAND_XHS_PUBLISH_IMAGE_NOTE: 'command.xhs_publish_image_note',
  RESPONSE_XHS_PUBLISH_IMAGE_NOTE: 'response.xhs_publish_image_note',
  COMMAND_XHS_PUBLISH_VIDEO_NOTE: 'command.xhs_publish_video_note',
  RESPONSE_XHS_PUBLISH_VIDEO_NOTE: 'response.xhs_publish_video_note',
  COMMAND_XHS_CHECK_SIGN_HEALTH: 'command.xhs_check_sign_health',
  RESPONSE_XHS_CHECK_SIGN_HEALTH: 'response.xhs_check_sign_health',
  COMMAND_XHS_GET_NOTE_COMMENTS: 'command.xhs_get_note_comments',
  RESPONSE_XHS_GET_NOTE_COMMENTS: 'response.xhs_get_note_comments',
  COMMAND_XHS_GET_USER_INFO: 'command.xhs_get_user_info',
  RESPONSE_XHS_GET_USER_INFO: 'response.xhs_get_user_info',
  COMMAND_XHS_SEARCH_TOPICS: 'command.xhs_search_topics',
  RESPONSE_XHS_SEARCH_TOPICS: 'response.xhs_search_topics',
  COMMAND_XHS_GET_NOTIFICATIONS: 'command.xhs_get_notifications',
  RESPONSE_XHS_GET_NOTIFICATIONS: 'response.xhs_get_notifications',
  COMMAND_XHS_GET_PUBLISHED_NOTES: 'command.xhs_get_published_notes',
  RESPONSE_XHS_GET_PUBLISHED_NOTES: 'response.xhs_get_published_notes',
  COMMAND_XHS_SEARCH_FILTER: 'command.xhs_search_filter',
  RESPONSE_XHS_SEARCH_FILTER: 'response.xhs_search_filter',
  COMMAND_XHS_POST_COMMENT: 'command.xhs_post_comment',
  RESPONSE_XHS_POST_COMMENT: 'response.xhs_post_comment',
  COMMAND_XHS_SEARCH_USERS: 'command.xhs_search_users',
  RESPONSE_XHS_SEARCH_USERS: 'response.xhs_search_users',
  COMMAND_XHS_GET_INTIMACY_LIST: 'command.xhs_get_intimacy_list',
  RESPONSE_XHS_GET_INTIMACY_LIST: 'response.xhs_get_intimacy_list',
  COMMAND_XHS_LIKE_NOTE: 'command.xhs_like_note',
  RESPONSE_XHS_LIKE_NOTE: 'response.xhs_like_note',
  COMMAND_XHS_UNLIKE_NOTE: 'command.xhs_unlike_note',
  RESPONSE_XHS_UNLIKE_NOTE: 'response.xhs_unlike_note',
  COMMAND_XHS_FOLLOW_USER: 'command.xhs_follow_user',
  RESPONSE_XHS_FOLLOW_USER: 'response.xhs_follow_user',
  COMMAND_XHS_UNFOLLOW_USER: 'command.xhs_unfollow_user',
  RESPONSE_XHS_UNFOLLOW_USER: 'response.xhs_unfollow_user',
  COMMAND_XHS_COLLECT_NOTE: 'command.xhs_collect_note',
  RESPONSE_XHS_COLLECT_NOTE: 'response.xhs_collect_note',
  COMMAND_XHS_DELETE_NOTE: 'command.xhs_delete_note',
  RESPONSE_XHS_DELETE_NOTE: 'response.xhs_delete_note',
  COMMAND_XHS_DELETE_COMMENT: 'command.xhs_delete_comment',
  RESPONSE_XHS_DELETE_COMMENT: 'response.xhs_delete_comment',
  COMMAND_XHS_GET_FRIEND_FANS: 'command.xhs_get_friend_fans',
  RESPONSE_XHS_GET_FRIEND_FANS: 'response.xhs_get_friend_fans',
  COMMAND_XHS_CREATE_COLLECTION: 'command.xhs_create_collection',
  RESPONSE_XHS_CREATE_COLLECTION: 'response.xhs_create_collection',
  COMMAND_XHS_LIST_COLLECTIONS: 'command.xhs_list_collections',
  RESPONSE_XHS_LIST_COLLECTIONS: 'response.xhs_list_collections',
  COMMAND_XHS_LIST_COLLECTION_NOTES: 'command.xhs_list_collection_notes',
  RESPONSE_XHS_LIST_COLLECTION_NOTES: 'response.xhs_list_collection_notes',
  COMMAND_XHS_UPDATE_COLLECTION: 'command.xhs_update_collection',
  RESPONSE_XHS_UPDATE_COLLECTION: 'response.xhs_update_collection',
  COMMAND_XHS_GET_NOTE_DETAIL_STATS: 'command.xhs_get_note_detail_stats',
  RESPONSE_XHS_GET_NOTE_DETAIL_STATS: 'response.xhs_get_note_detail_stats',
  // Instagram message types
  COMMAND_IG_CHECK_LOGIN: 'command.ig_check_login',
  RESPONSE_IG_CHECK_LOGIN: 'response.ig_check_login',
  COMMAND_IG_GET_SELF_INFO: 'command.ig_get_self_info',
  RESPONSE_IG_GET_SELF_INFO: 'response.ig_get_self_info',
  COMMAND_IG_GET_USER_INFO: 'command.ig_get_user_info',
  RESPONSE_IG_GET_USER_INFO: 'response.ig_get_user_info',
  COMMAND_IG_SEARCH_USER: 'command.ig_search_user',
  RESPONSE_IG_SEARCH_USER: 'response.ig_search_user',
  COMMAND_IG_GET_FEED: 'command.ig_get_feed',
  RESPONSE_IG_GET_FEED: 'response.ig_get_feed',
  COMMAND_IG_GET_MEDIA: 'command.ig_get_media',
  RESPONSE_IG_GET_MEDIA: 'response.ig_get_media',
  COMMAND_IG_LIKE_MEDIA: 'command.ig_like_media',
  RESPONSE_IG_LIKE_MEDIA: 'response.ig_like_media',
  COMMAND_IG_UNLIKE_MEDIA: 'command.ig_unlike_media',
  RESPONSE_IG_UNLIKE_MEDIA: 'response.ig_unlike_media',
  COMMAND_IG_FOLLOW_USER: 'command.ig_follow_user',
  RESPONSE_IG_FOLLOW_USER: 'response.ig_follow_user',
  COMMAND_IG_UNFOLLOW_USER: 'command.ig_unfollow_user',
  RESPONSE_IG_UNFOLLOW_USER: 'response.ig_unfollow_user',
  COMMAND_IG_POST_COMMENT: 'command.ig_post_comment',
  RESPONSE_IG_POST_COMMENT: 'response.ig_post_comment',
  COMMAND_IG_DELETE_COMMENT: 'command.ig_delete_comment',
  RESPONSE_IG_DELETE_COMMENT: 'response.ig_delete_comment',
  COMMAND_IG_POST_MEDIA: 'command.ig_post_media',
  RESPONSE_IG_POST_MEDIA: 'response.ig_post_media',
  COMMAND_IG_DELETE_MEDIA: 'command.ig_delete_media',
  RESPONSE_IG_DELETE_MEDIA: 'response.ig_delete_media',
  COMMAND_IG_GET_USER_MEDIA: 'command.ig_get_user_media',
  RESPONSE_IG_GET_USER_MEDIA: 'response.ig_get_user_media',
  COMMAND_IG_GET_MEDIA_COMMENTS: 'command.ig_get_media_comments',
  RESPONSE_IG_GET_MEDIA_COMMENTS: 'response.ig_get_media_comments',
  COMMAND_IG_SEARCH: 'command.ig_search',
  RESPONSE_IG_SEARCH: 'response.ig_search',
  COMMAND_IG_GET_NOTIFICATIONS: 'command.ig_get_notifications',
  RESPONSE_IG_GET_NOTIFICATIONS: 'response.ig_get_notifications',
  COMMAND_IG_GET_FOLLOWERS: 'command.ig_get_followers',
  RESPONSE_IG_GET_FOLLOWERS: 'response.ig_get_followers',
  COMMAND_IG_GET_FOLLOWING: 'command.ig_get_following',
  RESPONSE_IG_GET_FOLLOWING: 'response.ig_get_following',
  COMMAND_QUERY_X_BASIC_INFO: 'command.query_x_basic_info',
  REQUEST_OPEN_TAB: 'request.open_tab',
  RESPONSE_OPEN_TAB: 'response.open_tab',
  REQUEST_CLOSE_TAB: 'request.close_tab',
  RESPONSE_CLOSE_TAB: 'response.close_tab',
  REQUEST_NAVIGATE_TAB: 'request.navigate_tab',
  RESPONSE_NAVIGATE_TAB: 'response.navigate_tab',
  REQUEST_EXEC_ACTION: 'request.exec_action',
  RESPONSE_EXEC_ACTION: 'response.exec_action',
  REQUEST_QUERY_HOME_TIMELINE: 'request.query_home_timeline',
  RESPONSE_QUERY_HOME_TIMELINE: 'response.query_home_timeline',
  REQUEST_QUERY_TWEET_REPLIES: 'request.query_tweet_replies',
  RESPONSE_QUERY_TWEET_REPLIES: 'response.query_tweet_replies',
  REQUEST_QUERY_TWEET_DETAIL: 'request.query_tweet_detail',
  RESPONSE_QUERY_TWEET_DETAIL: 'response.query_tweet_detail',
  REQUEST_QUERY_USER_PROFILE: 'request.query_user_profile',
  RESPONSE_QUERY_USER_PROFILE: 'response.query_user_profile',
  REQUEST_QUERY_SEARCH_TIMELINE: 'request.query_search_timeline',
  RESPONSE_QUERY_SEARCH_TIMELINE: 'response.query_search_timeline',
  REQUEST_QUERY_USER_TWEETS: 'request.query_user_tweets',
  RESPONSE_QUERY_USER_TWEETS: 'response.query_user_tweets',
  REQUEST_QUERY_FOLLOWERS: 'request.query_followers',
  RESPONSE_QUERY_FOLLOWERS: 'response.query_followers',
  REQUEST_QUERY_FOLLOWING: 'request.query_following',
  RESPONSE_QUERY_FOLLOWING: 'response.query_following',
  REQUEST_QUERY_BLUE_VERIFIED_FOLLOWERS: 'request.query_blue_verified_followers',
  RESPONSE_QUERY_BLUE_VERIFIED_FOLLOWERS: 'response.query_blue_verified_followers',
  REQUEST_START_TASK: 'request.start_task',
  REQUEST_CANCEL_TASK: 'request.cancel_task',
  EVENT_TASK_PROGRESS: 'event.task_progress',
  EVENT_TASK_FAILED: 'event.task_failed',
  EVENT_TASK_COMPLETED: 'event.task_completed',
  EVENT_TASK_CANCELLED: 'event.task_cancelled',
  RESPONSE_ERROR: 'response.error',
};

export type MessageSource = 'tweetClaw' | 'LocalBridgeMac';
export type MessageTarget = 'tweetClaw' | 'LocalBridgeMac';

export interface XTabInfo {
  tabId: number;
  url: string;
  active: boolean;
}

export interface BaseMessage<T = any> {
  id: string;
  type: MessageType | string;
  source: MessageSource | string;
  target: MessageTarget | string;
  timestamp: number;
  payload: T;
}

export interface ClientHelloPayload {
    protocolName: typeof PROTOCOL_NAME;
    protocolVersion: typeof PROTOCOL_VERSION;
    clientName: 'tweetClaw';
    clientVersion: string;
    browser: 'chrome';
    capabilities: string[];
    instanceId?: string;   // Profile 级别的稳定唯一 ID
    instanceName?: string; // 用户自定义的显示名称
    incognito?: boolean;   // 是否无痕模式
}


export interface ServerHelloAckPayload {
  protocolName: typeof PROTOCOL_NAME;
  protocolVersion: typeof PROTOCOL_VERSION;
  serverName: 'LocalBridgeMac';
  serverVersion: string;
  heartbeatIntervalMs: number;
}

export interface PingPayload {
  heartbeatIntervalMs: number;
  // A41: 账号状态随 ping 上报，null = 尚未采集过
  accounts?: Array<{
    platform: 'twitter' | 'instagram' | 'xiaohongshu';
    status: 'logged_in' | 'logged_out';
    tabId: number | null;
    lastCheckedAt: number;
    account?: {
      username?: string | null;
      userId?: string | null;
      displayName?: string | null;
      avatarUrl?: string | null;
    };
    error?: string;
  }> | null;
}

export interface QueryXTabsStatusResponsePayload {
  hasXTabs: boolean;
  isLoggedIn: boolean;
  activeXTabId: number | null;
  activeXUrl: string | null;
  tabs: XTabInfo[];
}

export interface QueryXBasicInfoResponsePayload {
  isLoggedIn: boolean;
  name?: string;
  screenName?: string;
  twitterId?: string;
  verified?: boolean;
  updatedAt?: number;
  raw?: any;
}

export interface QueryXhsHomefeedRequestPayload {
  cursor_score?: string;
}

export interface OpenTabRequestPayload {
  path: string;
}

export interface OpenTabResponsePayload {
  success: boolean;
  tabId?: number;
  url?: string;
  error?: string;
}

export interface CloseTabRequestPayload {
  tabId: number;
}

export interface CloseTabResponsePayload {
  success: boolean;
  reason: 'success' | 'not_found' | 'failed';
  error?: string;
}

export interface NavigateTabRequestPayload {
  tabId?: number;
  path: string;
}

export interface NavigateTabResponsePayload {
  success: boolean;
  tabId: number;
  url: string;
  error?: string;
}

export interface ExecActionRequestPayload {
  action: 'like' | 'retweet' | 'bookmark' | 'follow' | 'unfollow'
       | 'post_tweet' | 'reply_tweet' | 'quote_tweet' | 'unlike' | 'unretweet' | 'unbookmark'
       | 'delete_tweet';
  tweetId?: string;
  userId?: string;
  tabId?: number;
  text?: string;    // 新增：发推文 / 回复时的文字内容
  media_ids?: string[];  // 新增：媒体 ID 列表
  attachmentUrl?: string; // 新增：quote tweet 时被引用推文的 URL
}

export interface QueryTweetDetailRequestPayload {
  tweetId: string;
  tabId?: number;
}

export interface QueryTweetRepliesRequestPayload {
  tweetId: string;
  tabId?: number;
  cursor?: string;
}

export interface QueryUserProfileRequestPayload {
  screenName: string;
  tabId?: number;
}

export interface QuerySearchTimelineRequestPayload {
  tabId?: number;
  query?: string;   // 搜索关键词
  cursor?: string;  // 翻页游标
  count?: number;   // 结果数量（默认 20）
}

export interface QueryUserTweetsRequestPayload {
  userId: string;   // 用户 ID (如 "44196397")
  tabId?: number;
  cursor?: string;  // 翻页游标
  count?: number;   // 结果数量（默认 20）
}

export interface QueryFollowersRequestPayload {
  userId: string;   // 目标用户 ID（数字字符串，如 "44196397"）
  tabId?: number;
  cursor?: string;  // 翻页游标
  count?: number;   // 单页数量（默认 20）
}

export interface QueryFollowingRequestPayload {
  userId: string;
  tabId?: number;
  cursor?: string;
  count?: number;
}

export interface QueryBlueVerifiedFollowersRequestPayload {
  userId: string;
  tabId?: number;
  cursor?: string;
  count?: number;
}
// HomeTimeline 不需要额外参数，使用 any 或 EmptyPayload (如果定义了)



export interface ExecActionResponsePayload {
  ok: boolean;
  data?: any;
  error?: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details: any | null;
}

export const ERROR_CODES = {
  INVALID_JSON: 'INVALID_JSON',
  INVALID_MESSAGE_SHAPE: 'INVALID_MESSAGE_SHAPE',
  UNSUPPORTED_MESSAGE_TYPE: 'UNSUPPORTED_MESSAGE_TYPE',
  PROTOCOL_VERSION_MISMATCH: 'PROTOCOL_VERSION_MISMATCH',
  NOT_CONNECTED: 'NOT_CONNECTED',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

// ── XHS 搜索 ──────────────────────────────────────────────────────────────────

export interface XhsSearchRequestPayload {
  keyword: string;
  cursor?: string;
  page_size?: number;   // 默认 20
}

// ── XHS 用户笔记 ───────────────────────────────────────────────────────────────

export interface XhsUserNotesRequestPayload {
  user_id: string;
  cursor?: string;
}

// ── XHS 发布笔记 ───────────────────────────────────────────────────────────────

export interface XhsImageInput {
  data: string;          // Base64 编码（不含 data:image/... 前缀）
  mime_type: string;     // 'image/jpeg' | 'image/png' | 'image/webp'
}

export interface XhsPublishNoteRequestPayload {
  title: string;         // 最多 20 字
  content: string;       // 正文，不含 #标签
  tags: string[];        // 话题标签，不含 #
  images: XhsImageInput[]; // 至少 1 张
}

export interface XhsPublishNoteResponsePayload {
  success: boolean;
  note_id?: string;
  error?: string;
}
