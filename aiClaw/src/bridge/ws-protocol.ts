export const PROTOCOL_NAME = 'aihub-localbridge';
export const PROTOCOL_VERSION = 'v1';

export type MessageType =
  | 'client.hello'
  | 'server.hello_ack'
  | 'ping'
  | 'pong'
  | 'request.query_ai_tabs_status'
  | 'response.query_ai_tabs_status'
  | 'response.error';

export const MESSAGE_TYPES: Record<string, MessageType> = {
  CLIENT_HELLO: 'client.hello',
  SERVER_HELLO_ACK: 'server.hello_ack',
  PING: 'ping',
  PONG: 'pong',
  REQUEST_QUERY_AI_TABS_STATUS: 'request.query_ai_tabs_status',
  RESPONSE_QUERY_AI_TABS_STATUS: 'response.query_ai_tabs_status',
  RESPONSE_ERROR: 'response.error',
};

export type MessageSource = 'aiClaw' | 'LocalBridgeMac';
export type MessageTarget = 'aiClaw' | 'LocalBridgeMac';

export interface AITabInfo {
  tabId: number;
  url: string;
  platform: 'chatgpt' | 'gemini' | 'grok';
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
  clientName: 'aiClaw';
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

export interface QueryAITabsStatusResponsePayload {
  hasAITabs: boolean;
  platforms: {
    chatgpt: boolean;
    gemini: boolean;
    grok: boolean;
  };
  activeAITabId: number | null;
  activeAIUrl: string | null;
  tabs: AITabInfo[];
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