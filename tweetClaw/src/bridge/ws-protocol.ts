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
  | 'request.open_tab'
  | 'response.open_tab'
  | 'request.close_tab'
  | 'response.close_tab'
  | 'request.navigate_tab'
  | 'response.navigate_tab'
  | 'request.exec_action'
  | 'response.exec_action'
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
  REQUEST_OPEN_TAB: 'request.open_tab',
  RESPONSE_OPEN_TAB: 'response.open_tab',
  REQUEST_CLOSE_TAB: 'request.close_tab',
  RESPONSE_CLOSE_TAB: 'response.close_tab',
  REQUEST_NAVIGATE_TAB: 'request.navigate_tab',
  RESPONSE_NAVIGATE_TAB: 'response.navigate_tab',
  REQUEST_EXEC_ACTION: 'request.exec_action',
  RESPONSE_EXEC_ACTION: 'response.exec_action',
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
  action: 'like' | 'retweet' | 'bookmark' | 'follow' | 'unfollow';
  tweetId?: string;
  userId?: string;
  tabId?: number;
}

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
