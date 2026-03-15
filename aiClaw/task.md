# 任务：将 aiClaw 的 WebSocket 通信机制对齐 tweetClaw

> **目标**：aiClaw 当前 `background.ts` 中有一个自行发明的 `WebSocketClient` 类，它没有使用 `aihub-localbridge` 协议，没有 hello 握手，没有应用层心跳，日志格式也不统一。本次任务要将其**替换**为与 tweetClaw 完全一致的 WebSocket 通信架构。
>
> **参考实现**：
> - 协议文件：`/Users/wesley/aiwithblockchain/aihub/tweetClaw/src/bridge/ws-protocol.ts`
> - Socket 实现：`/Users/wesley/aiwithblockchain/aihub/tweetClaw/src/bridge/local-bridge-socket.ts`
> - 协议文档：`/Users/wesley/aiwithblockchain/aihub/docs/tweetclaw-localbridgemac-message-schema-v1.md`
>
> **核心原则**：aiClaw 的 WebSocket 层必须与 tweetClaw **使用完全一致的协议、消息格式、重连策略、心跳策略**，只改 `source` 标识从 `tweetClaw` 变为 `aiClaw`。

---

## 当前问题分析

aiClaw 的 `background.ts`（第 287~430 行）中包含一个内联的 `WebSocketClient` 类。它有以下问题：

| 问题 | aiClaw 当前状态 | tweetClaw 正确做法 |
|------|----------------|------------------|
| 协议 | 无协议，直接 JSON.parse 裸消息 | `aihub-localbridge` v1 协议 |
| 握手 | 无 hello 握手 | 连接后立即发 `client.hello`，等待 `server.hello_ack` |
| 心跳 | 无心跳 | 每 20s 发 `ping`，等 `pong`，60s 无回应关闭重连 |
| 重连 | 指数退避 1s→2s→4s→...→30s（合理但不一致） | 固定梯度：1s→2s→5s→10s |
| 日志 | `console.error` 报 WebSocket error（污染扩展错误列表） | `console.log` 静默处理（不污染错误列表） |
| 文件结构 | 内联在 `background.ts` | 独立文件 `bridge/ws-protocol.ts` + `bridge/local-bridge-socket.ts` |
| 连接 URL | `ws://localhost:8765/ws/aiclaw`（加了路径后缀） | `ws://127.0.0.1:8765/ws`（统一端点） |
| 消息格式 | 无统一 BaseMessage 外层 | 所有消息都有 `{id, type, source, target, timestamp, payload}` 6 字段 |

---

## 任务 1：创建 `src/bridge/ws-protocol.ts`

### 目标

从 tweetClaw 复制协议定义文件，修改 `source`/`target` 类型以同时支持 `aiClaw`。

### 操作

创建文件 `src/bridge/ws-protocol.ts`，完整内容如下：

```typescript
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
```

### 与 tweetClaw 原版的差异说明（给 AI 参考，不需要操作）

- `MessageSource`/`MessageTarget` 中把 `tweetClaw` 替换为 `aiClaw`
- `ClientHelloPayload` 中 `clientName` 从 `'tweetClaw'` 改为 `'aiClaw'`
- 业务消息类型从 `query_x_tabs_status` 改为 `query_ai_tabs_status`（因为 aiClaw 查询的是 AI 平台的 tab，不是 X 的 tab）
- `XTabInfo` 改为 `AITabInfo`，新增 `platform` 字段
- `QueryXTabsStatusResponsePayload` 改为 `QueryAITabsStatusResponsePayload`，结构适配 AI 平台
- **协议名、协议版本、消息外层结构、心跳机制、错误码——全部保持一致**

### 自我验收

```bash
test -f /Users/wesley/aiwithblockchain/aihub/aiClaw/src/bridge/ws-protocol.ts && echo "✅ ws-protocol.ts exists" || echo "❌ missing"
grep "aihub-localbridge" /Users/wesley/aiwithblockchain/aihub/aiClaw/src/bridge/ws-protocol.ts && echo "✅ protocol name correct" || echo "❌"
grep "client.hello" /Users/wesley/aiwithblockchain/aihub/aiClaw/src/bridge/ws-protocol.ts && echo "✅ message types present" || echo "❌"
```

**期望**：全部 ✅。验收通过后进入任务 2。

---

## 任务 2：创建 `src/bridge/local-bridge-socket.ts`

### 目标

从 tweetClaw 的 `local-bridge-socket.ts` 复制 WebSocket 客户端实现，修改为 aiClaw 的版本。

### 操作

创建文件 `src/bridge/local-bridge-socket.ts`，完整内容如下：

```typescript
import {
  BaseMessage,
  ClientHelloPayload,
  MESSAGE_TYPES,
  PROTOCOL_NAME,
  PROTOCOL_VERSION,
  ServerHelloAckPayload,
} from './ws-protocol';

export class LocalBridgeSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private heartbeatInterval: any = null;
  private serverInfo: ServerHelloAckPayload | null = null;
  private lastPongTimestamp = 0;

  public queryAITabsHandler: (() => Promise<any>) | null = null;

  private readonly WS_URL = 'ws://127.0.0.1:8765/ws';

  constructor() {
    this.connect();
  }

  private isConnecting = false;

  public connect() {
    if (this.isConnecting) return;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.CONNECTING ||
        this.ws.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    this.isConnecting = true;
    console.log('[aiClaw] websocket connecting...');

    try {
      this.ws = new WebSocket(this.WS_URL);

      this.ws.onopen = () => {
        console.log('[aiClaw] websocket open');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.lastPongTimestamp = Date.now();
        this.sendHello();
      };

      this.ws.onclose = () => {
        console.log('[aiClaw] websocket closed');
        this.isConnecting = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Use regular log to stay silent in Chrome extension error list
        console.log('[aiClaw] connection notice: server offline');
        this.isConnecting = false;
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } catch (e) {
      console.log('[aiClaw] initialization notice:', e);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    const delay = this.getReconnectDelay();
    console.log(`[aiClaw] websocket reconnect scheduled in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private getReconnectDelay(): number {
    switch (this.reconnectAttempts) {
      case 0: return 1000;
      case 1: return 2000;
      case 2: return 5000;
      default: return 10000;
    }
  }

  private sendHello() {
    const hello: BaseMessage<ClientHelloPayload> = {
      id: `hello_${Date.now()}`,
      type: MESSAGE_TYPES.CLIENT_HELLO,
      source: 'aiClaw',
      target: 'LocalBridgeMac',
      timestamp: Date.now(),
      payload: {
        protocolName: PROTOCOL_NAME,
        protocolVersion: PROTOCOL_VERSION,
        clientName: 'aiClaw',
        clientVersion: '0.1.0',
        browser: 'chrome',
        capabilities: ['query_ai_tabs_status'],
      },
    };
    this.send(hello);
  }

  private handleMessage(data: string) {
    try {
      const msg = JSON.parse(data) as BaseMessage;
      console.log(`[aiClaw] received message: ${msg.type}`);

      switch (msg.type) {
        case MESSAGE_TYPES.SERVER_HELLO_ACK:
          this.handleHelloAck(msg as BaseMessage<ServerHelloAckPayload>);
          break;
        case MESSAGE_TYPES.PONG:
          console.log('[aiClaw] received pong');
          this.lastPongTimestamp = Date.now();
          break;
        case MESSAGE_TYPES.REQUEST_QUERY_AI_TABS_STATUS:
          this.handleQueryAITabsStatus(msg);
          break;
        default:
          console.warn(`[aiClaw] unknown message type: ${msg.type}`);
      }
    } catch (e) {
      console.error('[aiClaw] failed to parse message:', e);
    }
  }

  private handleHelloAck(msg: BaseMessage<ServerHelloAckPayload>) {
    console.log('[aiClaw] received server.hello_ack');
    this.serverInfo = msg.payload;
    this.startHeartbeat(msg.payload.heartbeatIntervalMs || 20000);
  }

  private async handleQueryAITabsStatus(req: BaseMessage) {
    console.log('[aiClaw] handling request.query_ai_tabs_status');
    if (!this.queryAITabsHandler) {
      console.error('[aiClaw] no handler for query_ai_tabs_status');
      return;
    }

    try {
      const result = await this.queryAITabsHandler();
      const resp: BaseMessage = {
        id: req.id,
        type: MESSAGE_TYPES.RESPONSE_QUERY_AI_TABS_STATUS,
        source: 'aiClaw',
        target: 'LocalBridgeMac',
        timestamp: Date.now(),
        payload: result,
      };
      this.send(resp);
    } catch (e) {
      const errResp: BaseMessage = {
        id: req.id,
        type: MESSAGE_TYPES.RESPONSE_ERROR,
        source: 'aiClaw',
        target: 'LocalBridgeMac',
        timestamp: Date.now(),
        payload: {
          code: 'INTERNAL_ERROR',
          message: e instanceof Error ? e.message : String(e),
          details: null,
        },
      };
      this.send(errResp);
    }
  }

  private startHeartbeat(interval: number) {
    this.stopHeartbeat();
    console.log(`[aiClaw] starting heartbeat every ${interval}ms`);
    this.heartbeatInterval = setInterval(() => {
      // Check for timeout (60 seconds)
      const now = Date.now();
      if (this.lastPongTimestamp > 0 && now - this.lastPongTimestamp > 60000) {
        console.error('[aiClaw] pong timeout, closing socket');
        this.ws?.close();
        return;
      }
      this.sendPing();
    }, interval);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendPing() {
    const ping: BaseMessage = {
      id: `ping_${Date.now()}`,
      type: MESSAGE_TYPES.PING,
      source: 'aiClaw',
      target: 'LocalBridgeMac',
      timestamp: Date.now(),
      payload: {
        heartbeatIntervalMs: 20000,
      },
    };
    this.send(ping);
  }

  public send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      console.log(`[aiClaw] sent message: ${msg.type}`);
    } else {
      console.warn(
        `[aiClaw] cannot send message, socket status: ${this.ws?.readyState}`
      );
    }
  }
}
```

### 与 tweetClaw 原版的差异说明（给 AI 参考，不需要操作）

- 所有 `'tweetClaw'` 替换为 `'aiClaw'`
- `queryXTabsHandler` → `queryAITabsHandler`
- `handleQueryXTabsStatus` → `handleQueryAITabsStatus`
- `REQUEST_QUERY_X_TABS_STATUS` → `REQUEST_QUERY_AI_TABS_STATUS`
- `RESPONSE_QUERY_X_TABS_STATUS` → `RESPONSE_QUERY_AI_TABS_STATUS`
- 日志前缀从 `[tweetClaw]` 改为 `[aiClaw]`
- **连接地址、重连策略、心跳策略、错误处理——全部保持一致**

### 自我验收

```bash
test -f /Users/wesley/aiwithblockchain/aihub/aiClaw/src/bridge/local-bridge-socket.ts && echo "✅ file exists" || echo "❌ missing"
grep "ws://127.0.0.1:8765/ws" /Users/wesley/aiwithblockchain/aihub/aiClaw/src/bridge/local-bridge-socket.ts && echo "✅ correct URL" || echo "❌"
grep "sendHello" /Users/wesley/aiwithblockchain/aihub/aiClaw/src/bridge/local-bridge-socket.ts && echo "✅ hello handshake" || echo "❌"
grep "sendPing" /Users/wesley/aiwithblockchain/aihub/aiClaw/src/bridge/local-bridge-socket.ts && echo "✅ heartbeat" || echo "❌"
grep "getReconnectDelay" /Users/wesley/aiwithblockchain/aihub/aiClaw/src/bridge/local-bridge-socket.ts && echo "✅ reconnect delay" || echo "❌"
grep "'aiClaw'" /Users/wesley/aiwithblockchain/aihub/aiClaw/src/bridge/local-bridge-socket.ts | head -1 && echo "✅ source is aiClaw" || echo "❌"
```

**期望**：全部 ✅。验收通过后进入任务 3。

---

## 任务 3：修改 `src/service_work/background.ts`

### 目标

1. **删除**旧的内联 `WebSocketClient` 类（第 287~421 行的全部内容）
2. **删除**旧的 `chrome.alarms` keep-alive（第 424~430 行）
3. **导入**新的 `LocalBridgeSocket`
4. **初始化** `LocalBridgeSocket` 并注册 `queryAITabsHandler`
5. **实现** `queryAITabsStatus()` 函数

### 具体操作

#### 3a. 删除旧代码

打开 `src/service_work/background.ts`，**删除**以下代码段（从第 287 行到第 430 行）：

删除范围包括：
- `// ── WebSocket 客户端 ──` 注释
- `const LOCALBRIDGE_URL = ...`
- 整个 `class WebSocketClient { ... }`
- `const wsClient = new WebSocketClient();`
- `wsClient.connect();`
- `// ── Service Worker Keep-alive ──`
- `chrome.alarms.create(...)` 和 `chrome.alarms.onAlarm.addListener(...)`

#### 3b. 删除旧代码中对 wsClient 的引用

在消息中枢部分（约第 207~231 行），**删除**以下两段代码：

删除这段（约第 207~224 行的 `AC_SEND_TEST_MESSAGE` 处理器）：
```typescript
    if (message.type === MsgType.AC_SEND_TEST_MESSAGE) {
        console.log('[aiClaw-BG] Received test message request');
        loadCredentials().then(async (creds) => {
            const chatGptCreds = creds.chatgpt;
            if (chatGptCreds && chatGptCreds.bearerToken && chatGptCreds.apiEndpoint) {
                const adapter = new ChatGptAdapter();
                const response = await adapter.sendMessage(
                    { prompt: 'Hello, this is a test message.' },
                    chatGptCreds
                );
                console.log('[aiClaw-BG] Test message response:', response);
                sendResponse({ ok: true, response });
            } else {
                sendResponse({ ok: false, error: 'ChatGPT credentials not found' });
            }
        });
        return true;
    }
```

删除这段（约第 226~231 行的 `TASK_RESULT` 处理器，因为它引用了旧的 `wsClient`）：
```typescript
    if (message.type === MsgType.TASK_RESULT) {
        wsClient.sendResult(message.result);
        wsClient.isExecutingTask = false;
        wsClient.executeNextTask();
        return; // No response needed
    }
```

#### 3c. 删除旧的 import

删除文件顶部这一行（约第 15 行）：
```typescript
import { ChatGptAdapter } from '../adapters/chatgpt-adapter';
```

#### 3d. 添加新的 import 和初始化代码

在文件顶部的 import 区域（约第 13~14 行之后），添加：

```typescript
import { LocalBridgeSocket } from '../bridge/local-bridge-socket';
import type { AITabInfo, QueryAITabsStatusResponsePayload } from '../bridge/ws-protocol';
```

#### 3e. 在文件末尾（`// ── 启动日志 ──` 之前），添加以下代码

```typescript
// ── LocalBridge WebSocket 客户端 ──

async function queryAITabsStatus(): Promise<QueryAITabsStatusResponsePayload> {
    // 查询所有 AI 平台的 tabs
    const chatgptTabs = await chrome.tabs.query({
        url: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
    });
    const geminiTabs = await chrome.tabs.query({
        url: ['https://gemini.google.com/*'],
    });
    const grokTabs = await chrome.tabs.query({
        url: ['https://grok.com/*', 'https://x.com/i/grok*'],
    });

    const allTabs: AITabInfo[] = [];

    for (const tab of chatgptTabs) {
        if (tab.id && tab.url) {
            allTabs.push({ tabId: tab.id, url: tab.url, platform: 'chatgpt', active: tab.active || false });
        }
    }
    for (const tab of geminiTabs) {
        if (tab.id && tab.url) {
            allTabs.push({ tabId: tab.id, url: tab.url, platform: 'gemini', active: tab.active || false });
        }
    }
    for (const tab of grokTabs) {
        if (tab.id && tab.url) {
            allTabs.push({ tabId: tab.id, url: tab.url, platform: 'grok', active: tab.active || false });
        }
    }

    const activeTab = allTabs.find(t => t.active) || null;

    return {
        hasAITabs: allTabs.length > 0,
        platforms: {
            chatgpt: chatgptTabs.length > 0,
            gemini: geminiTabs.length > 0,
            grok: grokTabs.length > 0,
        },
        activeAITabId: activeTab?.tabId || null,
        activeAIUrl: activeTab?.url || null,
        tabs: allTabs,
    };
}

const localBridge = new LocalBridgeSocket();
localBridge.queryAITabsHandler = queryAITabsStatus;
```

### 自我验收

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw

# 确认旧代码已删除
grep -c "class WebSocketClient" src/service_work/background.ts
# 期望输出：0

grep -c "wsClient" src/service_work/background.ts
# 期望输出：0

grep -c "chrome.alarms.create" src/service_work/background.ts
# 期望输出：0

grep -c "LOCALBRIDGE_URL" src/service_work/background.ts
# 期望输出：0

grep -c "ChatGptAdapter" src/service_work/background.ts
# 期望输出：0

# 确认新代码已添加
grep "LocalBridgeSocket" src/service_work/background.ts && echo "✅ LocalBridgeSocket imported" || echo "❌"
grep "queryAITabsStatus" src/service_work/background.ts && echo "✅ queryAITabsStatus function" || echo "❌"
grep "localBridge.queryAITabsHandler" src/service_work/background.ts && echo "✅ handler registered" || echo "❌"
```

**期望**：旧代码 grep 结果全为 0，新代码全显示 ✅。验收通过后进入任务 4。

---

## 任务 4：更新 `dist/manifest.json`，添加 `alarms` 权限

### 目标

`LocalBridgeSocket` 中虽然不再直接使用 `chrome.alarms`，但 Service Worker 的 keep-alive 可能仍需要。同时确保 manifest 中有正确的权限。

### 操作

打开 `dist/manifest.json`，在 `permissions` 数组中添加 `"alarms"`。

**修改前：**
```json
  "permissions": [
    "storage",
    "tabs",
    "activeTab",
    "webRequest"
  ],
```

**修改后：**
```json
  "permissions": [
    "storage",
    "tabs",
    "activeTab",
    "webRequest",
    "alarms"
  ],
```

### 自我验收

```bash
grep '"alarms"' /Users/wesley/aiwithblockchain/aihub/aiClaw/dist/manifest.json && echo "✅ alarms permission" || echo "❌"
```

**期望**：✅。验收通过后进入任务 5。

---

## 任务 5：编译并验证

### 操作

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw
npm run build:d
```

### 自我验收

1. **编译必须成功**，exit code 为 0。

2. 检查编译产物：

```bash
echo "--- 编译产物检查 ---"
test -f dist/js/background.js && echo "✅ background.js" || echo "❌ background.js"
test -f dist/js/content.js && echo "✅ content.js" || echo "❌ content.js"
test -f dist/js/injection.js && echo "✅ injection.js" || echo "❌ injection.js"
```

3. 检查新协议代码是否在编译产物中：

```bash
echo "--- 协议代码检查 ---"
grep -c "aihub-localbridge" dist/js/background.js && echo "✅ protocol name in background.js" || echo "❌"
grep -c "client.hello" dist/js/background.js && echo "✅ hello handshake in background.js" || echo "❌"
grep -c "sendPing" dist/js/background.js && echo "✅ heartbeat in background.js" || echo "❌"
grep -c "ws://127.0.0.1:8765/ws" dist/js/background.js && echo "✅ correct URL in background.js" || echo "❌"
```

4. 确认旧代码已被清除：

```bash
echo "--- 旧代码清除检查 ---"
grep -c "ws://localhost:8765/ws/aiclaw" dist/js/background.js
# 期望输出：0
```

**期望**：所有 ✅，旧 URL 的 grep 为 0。验收通过后进入任务 6。

---

## 任务 6：总体自检

### 6.1 文件完整性

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw

echo "=== bridge 文件 ==="
test -f src/bridge/ws-protocol.ts && echo "✅ ws-protocol.ts" || echo "❌"
test -f src/bridge/local-bridge-socket.ts && echo "✅ local-bridge-socket.ts" || echo "❌"

echo ""
echo "=== 编译产物 ==="
test -f dist/js/background.js && echo "✅ background.js" || echo "❌"
test -f dist/js/content.js && echo "✅ content.js" || echo "❌"
test -f dist/js/injection.js && echo "✅ injection.js" || echo "❌"
```

### 6.2 协议一致性检查

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw

echo "=== 协议名 ==="
grep "PROTOCOL_NAME" src/bridge/ws-protocol.ts | head -1
# 期望：aihub-localbridge

echo ""
echo "=== 协议版本 ==="
grep "PROTOCOL_VERSION" src/bridge/ws-protocol.ts | head -1
# 期望：v1

echo ""
echo "=== WebSocket URL ==="
grep "WS_URL" src/bridge/local-bridge-socket.ts
# 期望：ws://127.0.0.1:8765/ws

echo ""
echo "=== 重连策略 ==="
grep -A5 "getReconnectDelay" src/bridge/local-bridge-socket.ts
# 期望：1000, 2000, 5000, 10000

echo ""
echo "=== 心跳超时 ==="
grep "60000" src/bridge/local-bridge-socket.ts
# 期望：pong timeout 60s

echo ""
echo "=== 日志风格 ==="
grep "console.error.*WebSocket" src/bridge/local-bridge-socket.ts | wc -l
# 期望：0（onerror 应该用 console.log 而不是 console.error）

echo ""
echo "=== source 标识 ==="
grep "source:" src/bridge/local-bridge-socket.ts | head -3
# 期望：所有 source 都是 'aiClaw'
```

### 6.3 与 tweetClaw 架构一致性对照

```bash
echo "=== tweetClaw bridge 文件 ==="
ls -la /Users/wesley/aiwithblockchain/aihub/tweetClaw/src/bridge/

echo ""
echo "=== aiClaw bridge 文件 ==="
ls -la /Users/wesley/aiwithblockchain/aihub/aiClaw/src/bridge/

echo ""
echo "=== tweetClaw 初始化方式 ==="
grep "LocalBridgeSocket" /Users/wesley/aiwithblockchain/aihub/tweetClaw/src/service_work/background.ts

echo ""
echo "=== aiClaw 初始化方式 ==="
grep "LocalBridgeSocket" /Users/wesley/aiwithblockchain/aihub/aiClaw/src/service_work/background.ts
```

### 6.4 自检结果汇总

如果以上全部通过，请输出：

```
═══════════════════════════════════════════
   WebSocket 协议同步：全部通过 ✅
═══════════════════════════════════════════

完成的工作：
1. ✅ 创建 src/bridge/ws-protocol.ts — aihub-localbridge v1 协议定义
2. ✅ 创建 src/bridge/local-bridge-socket.ts — WebSocket 客户端（含 hello 握手、心跳、重连）
3. ✅ 重写 background.ts 的 WebSocket 部分 — 删除旧版，集成 LocalBridgeSocket
4. ✅ 更新 manifest.json — 添加 alarms 权限
5. ✅ 编译通过

协议对齐情况：
- 协议名：aihub-localbridge ✅
- 协议版本：v1 ✅
- 握手：client.hello → server.hello_ack ✅
- 心跳：ping(20s) → pong, 60s 超时关闭 ✅
- 重连：1s → 2s → 5s → 10s ✅
- 日志：onerror 用 console.log 不污染错误列表 ✅
- 消息格式：统一 {id, type, source, target, timestamp, payload} ✅
```

如果有任何一项失败，请指出失败项并尝试修复后重新验证。
