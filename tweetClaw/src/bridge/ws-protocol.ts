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
  | 'request.query_tweet'
  | 'response.query_tweet'
  | 'request.query_tweet_replies'
  | 'response.query_tweet_replies'
  | 'request.query_tweet_detail'
  | 'response.query_tweet_detail'
  | 'request.query_user_profile'
  | 'response.query_user_profile'
  | 'request.query_search_timeline'
  | 'response.query_search_timeline'
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
  REQUEST_QUERY_TWEET: 'request.query_tweet',
  RESPONSE_QUERY_TWEET: 'response.query_tweet',
  REQUEST_QUERY_TWEET_REPLIES: 'request.query_tweet_replies',
  RESPONSE_QUERY_TWEET_REPLIES: 'response.query_tweet_replies',
  REQUEST_QUERY_TWEET_DETAIL: 'request.query_tweet_detail',
  RESPONSE_QUERY_TWEET_DETAIL: 'response.query_tweet_detail',
  REQUEST_QUERY_USER_PROFILE: 'request.query_user_profile',
  RESPONSE_QUERY_USER_PROFILE: 'response.query_user_profile',
  REQUEST_QUERY_SEARCH_TIMELINE: 'request.query_search_timeline',
  RESPONSE_QUERY_SEARCH_TIMELINE: 'response.query_search_timeline',
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
       | 'post_tweet' | 'reply_tweet' | 'unlike' | 'unretweet' | 'unbookmark'
       | 'delete_tweet';
  tweetId?: string;
  userId?: string;
  tabId?: number;
  text?: string;    // 新增：发推文 / 回复时的文字内容
  media_ids?: string[];  // 新增：媒体 ID 列表
}

export interface QueryTweetDetailRequestPayload {
  tweetId: string;
  tabId?: number;
}

export interface QueryTweetRequestPayload {
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
