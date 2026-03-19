export const PROTOCOL_NAME = 'aihub-localbridge';
export const PROTOCOL_VERSION = 'v1';

export type MessageType =
  | 'client.hello'
  | 'server.hello_ack'
  | 'ping'
  | 'pong'
  | 'request.query_ai_tabs_status'
  | 'response.query_ai_tabs_status'
  | 'request.execute_task'
  | 'response.execute_task_result'
  | 'request.navigate_to_platform'
  | 'response.navigate_result'
  | 'response.error';

export const MESSAGE_TYPES: Record<string, MessageType> = {
  CLIENT_HELLO: 'client.hello',
  SERVER_HELLO_ACK: 'server.hello_ack',
  PING: 'ping',
  PONG: 'pong',
  REQUEST_QUERY_AI_TABS_STATUS: 'request.query_ai_tabs_status',
  RESPONSE_QUERY_AI_TABS_STATUS: 'response.query_ai_tabs_status',
  REQUEST_EXECUTE_TASK: 'request.execute_task',
  RESPONSE_EXECUTE_TASK_RESULT: 'response.execute_task_result',
  REQUEST_NAVIGATE_TO_PLATFORM: 'request.navigate_to_platform',
  RESPONSE_NAVIGATE_RESULT: 'response.navigate_result',
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
  instanceId?: string;   // 新增：Profile 级别的稳定唯一 ID
  incognito?: boolean;   // 新增：是否无痕模式
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
    chatgpt: { hasTab: boolean; isLoggedIn: boolean };
    gemini: { hasTab: boolean; isLoggedIn: boolean };
    grok: { hasTab: boolean; isLoggedIn: boolean };
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

// ── 任务执行相关接口 ──

export interface ExecuteTaskPayload {
  taskId: string;                // 任务唯一 ID
  platform: 'chatgpt' | 'gemini' | 'grok';  // 目标平台
  action: 'send_message' | 'new_conversation';        // 动作类型
  payload: {
    prompt?: string;             // Prompt 文本
    conversationId?: string;     // 可选：续对话 ID
    model?: string;              // 可选：指定模型
  };
  priority?: number;
  timeout?: number;              // 超时时间 ms，默认 60000
}

export interface ExecuteTaskResultPayload {
  taskId: string;
  success: boolean;
  platform: 'chatgpt' | 'gemini' | 'grok';
  content?: string;              // AI 回复文本（success=true 时有值）
  conversationId?: string;       // 对话 ID（方便后续续对话）
  error?: string;                // 错误信息（success=false 时有值）
  executedAt: string;            // ISO 8601 时间戳
  durationMs: number;            // 执行耗时（毫秒）
}

// ── 页面跳转相关接口 ──

export interface NavigateToPlatformPayload {
  platform: 'chatgpt' | 'gemini' | 'grok';  // 目标平台
}

export interface NavigateResultPayload {
  success: boolean;
  platform: 'chatgpt' | 'gemini' | 'grok';
  tabsNavigated: number;         // 成功跳转的 tab 数量
  error?: string;                // 错误信息（success=false 时有值）
}
