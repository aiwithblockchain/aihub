# aiClaw 当前任务：打通 ChatGPT 端到端任务执行链路

> 文档版本：v1.0  
> 创建日期：2026-03-15  
> 面向执行者：AI 编程助手（算力有限，请严格按步骤执行，每步均有自检方法）

---

## 背景与目标

aiClaw 是一个 Chrome 扩展（Manifest V3），通过 WebSocket 从本地服务（localBridge）接收任务，自动在 ChatGPT 等 AI 平台的标签页中执行交互，并将结果回传。

**当前状态：**
- ✅ 凭证捕获链路已完整（injection → content → background）
- ✅ WebSocket 与 localBridge 的连接和状态查询已完成
- ✅ `chatgpt-adapter.ts` 和 `sse-parser.ts` 已写完
- ❌ **任务执行链路尚未打通**：background 收到任务后，无法将其发到 content script 执行，也无法将结果回传给 localBridge

**本次任务目标：** 打通从 localBridge 下发任务 → background 调度 → content script 执行 → 结果回传的完整链路，并在 ChatGPT 平台上完成端到端验证。

---

## 文件目录参考

```
src/
├── adapters/
│   ├── base-adapter.ts          ← 已完成，无需修改
│   ├── chatgpt-adapter.ts       ← 已完成，但有循环依赖需修复（见任务1）
│   ├── gemini-adapter.ts        ← 暂不处理
│   └── grok-adapter.ts          ← 暂不处理
├── bridge/
│   ├── local-bridge-socket.ts   ← 需要新增任务消息处理（见任务3）
│   └── ws-protocol.ts           ← 需要新增任务相关类型（见任务2）
├── capture/
│   ├── consts.ts                ← 已完成，无需修改
│   └── injection.ts             ← 已完成，无需修改
├── content/
│   └── main_entrance.ts         ← 需要新增任务执行逻辑（见任务4）
├── service_work/
│   └── background.ts            ← 需要新增任务调度逻辑（见任务5）
├── storage/
│   └── credentials-store.ts     ← 【新文件】需要创建（见任务1）
└── utils/
    └── sse-parser.ts            ← 已完成，无需修改
```

---

## 任务列表

> **执行规则：** 请严格按任务编号顺序执行，每个任务完成后，先通过自检项确认无误，再进行下一个任务。

---

### 任务 1：创建 `credentials-store.ts`，修复循环依赖

**问题原因：**  
`chatgpt-adapter.ts` 当前直接 import 了 `background.ts` 中的 `clearPlatformCredentials` 函数。`background.ts` 是 Service Worker，不应被其他模块 import，这会导致编译或运行时异常。

**解决方案：** 将凭证读写逻辑抽取到独立模块 `src/storage/credentials-store.ts`，由 `background.ts` 和 `chatgpt-adapter.ts` 分别 import 这个模块。

#### 步骤 1.1：创建 `src/storage/credentials-store.ts`

创建新文件，路径：`src/storage/credentials-store.ts`

写入以下完整内容：

```typescript
/**
 * credentials-store.ts - 凭证读写工具模块
 *
 * 从 background.ts 中抽取，避免 adapter 直接依赖 Service Worker。
 * 所有凭证的读写操作都通过此模块进行。
 */

import { STORAGE_KEY_CREDENTIALS } from '../capture/consts';
import type { PlatformType } from '../capture/consts';

export interface PlatformCredentials {
    bearerToken: string | null;
    apiEndpoint: string | null;
    lastCapturedHeaders: Record<string, string>;
    lastCapturedAt: number;
    captureCount: number;
}

export interface AllCredentials {
    chatgpt: PlatformCredentials;
    gemini: PlatformCredentials;
    grok: PlatformCredentials;
}

export function emptyCredentials(): PlatformCredentials {
    return {
        bearerToken: null,
        apiEndpoint: null,
        lastCapturedHeaders: {},
        lastCapturedAt: 0,
        captureCount: 0,
    };
}

export function defaultAllCredentials(): AllCredentials {
    return {
        chatgpt: emptyCredentials(),
        gemini: emptyCredentials(),
        grok: emptyCredentials(),
    };
}

export async function loadCredentials(): Promise<AllCredentials> {
    const res = await chrome.storage.local.get(STORAGE_KEY_CREDENTIALS);
    const creds = res[STORAGE_KEY_CREDENTIALS];
    if (creds && typeof creds === 'object' && 'chatgpt' in creds && 'gemini' in creds && 'grok' in creds) {
        return creds as AllCredentials;
    }
    return defaultAllCredentials();
}

export async function saveCredentials(creds: AllCredentials): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY_CREDENTIALS]: creds });
}

export async function clearPlatformCredentials(platform: PlatformType): Promise<void> {
    const creds = await loadCredentials();
    creds[platform].bearerToken = null;
    creds[platform].apiEndpoint = null;
    await saveCredentials(creds);
    console.log(`[aiClaw] 🗑️ Cleared credentials for ${platform}`);
}

export async function updatePlatformCredentials(
    platform: PlatformType,
    bearerToken: string | null,
    apiUrl: string | null,
    headers: Record<string, string>
): Promise<void> {
    const creds = await loadCredentials();
    const pc = creds[platform];

    pc.lastCapturedAt = Date.now();
    pc.captureCount += 1;

    if (bearerToken) pc.bearerToken = bearerToken;
    if (apiUrl) pc.apiEndpoint = apiUrl;
    if (Object.keys(headers).length > 0) pc.lastCapturedHeaders = headers;

    creds[platform] = pc;
    await saveCredentials(creds);
}
```

#### 步骤 1.2：修改 `chatgpt-adapter.ts`，替换 import

找到文件顶部的这一行：

```typescript
import { clearPlatformCredentials } from '../service_work/background';
```

替换为：

```typescript
import { clearPlatformCredentials } from '../storage/credentials-store';
```

#### 步骤 1.3：修改 `background.ts`，改用新模块

在 `background.ts` 文件顶部，找到所有内联定义的凭证相关代码块（`PlatformCredentials` interface、`AllCredentials` interface、`emptyCredentials()`、`defaultAllCredentials()`、`loadCredentials()`、`saveCredentials()`、`updatePlatformCredentials()`、`clearPlatformCredentials()` 这些函数和类型），**全部删除**。

然后在文件顶部 import 区域添加：

```typescript
import {
    loadCredentials,
    saveCredentials,
    updatePlatformCredentials,
    clearPlatformCredentials,
    defaultAllCredentials,
} from '../storage/credentials-store';
```

> **注意：** `background.ts` 中所有调用这些函数的地方（如 `updatePlatformCredentials()`、`loadCredentials()` 等）保持不变，因为函数签名相同。

#### 自检：任务 1 完成确认

- [ ] `src/storage/credentials-store.ts` 文件存在
- [ ] `chatgpt-adapter.ts` 中已不包含 `from '../service_work/background'` 这行 import
- [ ] `background.ts` 中已不包含 `PlatformCredentials` interface 的内联定义
- [ ] `background.ts` 顶部已有 `from '../storage/credentials-store'` 的 import
- [ ] 用编辑器或 `grep` 搜索 `from '../service_work/background'`，结果中不应出现 `chatgpt-adapter.ts`

---

### 任务 2：扩展 `ws-protocol.ts`，新增任务相关消息类型

**目的：** 定义 localBridge 下发任务、aiClaw 回传结果的消息协议类型，供后续步骤使用。

#### 步骤 2.1：在 `ws-protocol.ts` 中新增消息类型

打开 `src/bridge/ws-protocol.ts`，找到 `MessageType` 类型定义：

```typescript
export type MessageType =
  | 'client.hello'
  | 'server.hello_ack'
  | 'ping'
  | 'pong'
  | 'request.query_ai_tabs_status'
  | 'response.query_ai_tabs_status'
  | 'response.error';
```

替换为（新增最后两行）：

```typescript
export type MessageType =
  | 'client.hello'
  | 'server.hello_ack'
  | 'ping'
  | 'pong'
  | 'request.query_ai_tabs_status'
  | 'response.query_ai_tabs_status'
  | 'request.execute_task'
  | 'response.execute_task_result'
  | 'response.error';
```

#### 步骤 2.2：在 `ws-protocol.ts` 中新增 MESSAGE_TYPES 常量

找到 `MESSAGE_TYPES` 对象：

```typescript
export const MESSAGE_TYPES: Record<string, MessageType> = {
  CLIENT_HELLO: 'client.hello',
  SERVER_HELLO_ACK: 'server.hello_ack',
  PING: 'ping',
  PONG: 'pong',
  REQUEST_QUERY_AI_TABS_STATUS: 'request.query_ai_tabs_status',
  RESPONSE_QUERY_AI_TABS_STATUS: 'response.query_ai_tabs_status',
  RESPONSE_ERROR: 'response.error',
};
```

替换为（新增最后两行）：

```typescript
export const MESSAGE_TYPES: Record<string, MessageType> = {
  CLIENT_HELLO: 'client.hello',
  SERVER_HELLO_ACK: 'server.hello_ack',
  PING: 'ping',
  PONG: 'pong',
  REQUEST_QUERY_AI_TABS_STATUS: 'request.query_ai_tabs_status',
  RESPONSE_QUERY_AI_TABS_STATUS: 'response.query_ai_tabs_status',
  REQUEST_EXECUTE_TASK: 'request.execute_task',
  RESPONSE_EXECUTE_TASK_RESULT: 'response.execute_task_result',
  RESPONSE_ERROR: 'response.error',
};
```

#### 步骤 2.3：在 `ws-protocol.ts` 末尾追加新增接口定义

在文件末尾（`ERROR_CODES` 对象之后）追加以下内容：

```typescript
// ── 任务执行相关接口 ──

export interface ExecuteTaskPayload {
  taskId: string;                // 任务唯一 ID
  platform: 'chatgpt' | 'gemini' | 'grok';  // 目标平台
  action: 'send_message';        // 动作类型
  payload: {
    prompt: string;              // Prompt 文本
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
```

#### 自检：任务 2 完成确认

- [ ] `ws-protocol.ts` 中 `MessageType` 包含 `'request.execute_task'` 和 `'response.execute_task_result'`
- [ ] `MESSAGE_TYPES` 对象包含 `REQUEST_EXECUTE_TASK` 和 `RESPONSE_EXECUTE_TASK_RESULT` 两个键
- [ ] 文件末尾存在 `ExecuteTaskPayload` 和 `ExecuteTaskResultPayload` 两个 interface
- [ ] `ExecuteTaskPayload` 有 `taskId`、`platform`、`action`、`payload` 四个必填字段

---

### 任务 3：在 `local-bridge-socket.ts` 中处理任务下发消息

**目的：** 当 localBridge 发来 `request.execute_task` 消息时，调用 background 注入的 handler 来执行任务并回传结果。

#### 步骤 3.1：新增 `executeTaskHandler` 属性

打开 `src/bridge/local-bridge-socket.ts`，找到：

```typescript
public queryAITabsHandler: (() => Promise<any>) | null = null;
```

在其**正下方**追加一行：

```typescript
public executeTaskHandler: ((task: any) => Promise<any>) | null = null;
```

#### 步骤 3.2：在 `handleMessage` 的 switch 中新增 case

找到 `handleMessage` 方法中的 switch 语句，找到：

```typescript
        case MESSAGE_TYPES.REQUEST_QUERY_AI_TABS_STATUS:
          this.handleQueryAITabsStatus(msg);
          break;
```

在其**正下方**追加：

```typescript
        case MESSAGE_TYPES.REQUEST_EXECUTE_TASK:
          this.handleExecuteTask(msg);
          break;
```

#### 步骤 3.3：新增 `handleExecuteTask` 方法

找到 `handleQueryAITabsStatus` 方法（完整方法体），在该方法**正下方**，追加新方法：

```typescript
  private async handleExecuteTask(req: BaseMessage) {
    console.log('[aiClaw] handling request.execute_task, taskId:', req.payload?.taskId);
    if (!this.executeTaskHandler) {
      console.error('[aiClaw] no handler registered for execute_task');
      const errResp: BaseMessage = {
        id: req.id,
        type: MESSAGE_TYPES.RESPONSE_ERROR,
        source: 'aiClaw',
        target: 'LocalBridgeMac',
        timestamp: Date.now(),
        payload: {
          code: 'NOT_CONNECTED',
          message: 'executeTaskHandler is not registered',
          details: null,
        },
      };
      this.send(errResp);
      return;
    }

    try {
      const result = await this.executeTaskHandler(req.payload);
      const resp: BaseMessage = {
        id: req.id,
        type: MESSAGE_TYPES.RESPONSE_EXECUTE_TASK_RESULT,
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
```

#### 自检：任务 3 完成确认

- [ ] `LocalBridgeSocket` 类有 `executeTaskHandler` 属性（类型为 `((task: any) => Promise<any>) | null`）
- [ ] `handleMessage` 的 switch 中有 `MESSAGE_TYPES.REQUEST_EXECUTE_TASK` 的 case
- [ ] 类中存在 `handleExecuteTask` 私有方法
- [ ] `handleExecuteTask` 方法在 handler 为 null 时会发送 `RESPONSE_ERROR` 消息而不是静默失败

---

### 任务 4：在 `main_entrance.ts` 中实现任务执行逻辑

**目的：** content script 收到 background 发来的 `AC_EXECUTE_TASK` 消息后，调用对应平台的 adapter 执行 API 调用，并将结果回传。

**重要说明：** Content Script 与目标页面共享 Origin（如 `https://chatgpt.com`），所以 `fetch()` 会自动携带该域名的 Cookie（登录态）。任务必须在 content script 中执行，而不是在 background 中。

#### 步骤 4.1：在 `main_entrance.ts` 顶部新增 import

打开 `src/content/main_entrance.ts`，找到顶部 import 区域：

```typescript
import { INJECTION_SOURCE, MsgType } from '../capture/consts';
```

在其**正下方**追加：

```typescript
import { ChatGptAdapter } from '../adapters/chatgpt-adapter';
import type { Credentials } from '../adapters/base-adapter';
import type { ExecuteTaskPayload, ExecuteTaskResultPayload } from '../bridge/ws-protocol';
```

#### 步骤 4.2：新增平台 adapter 工厂函数

在 `main_entrance.ts` 中，找到 `detectPlatform()` 函数定义结束后（`}` 之后），追加以下函数：

```typescript
// ── Adapter 工厂：根据平台名称返回对应的 adapter 实例 ──
function getAdapter(platform: string) {
    if (platform === 'chatgpt') return new ChatGptAdapter();
    // gemini / grok adapter 待后续 Phase 4 实现
    return null;
}
```

#### 步骤 4.3：扩展 `chrome.runtime.onMessage` 监听器

找到现有的消息监听器：

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // PING：background 检查 content script 是否存活
    if (message.type === MsgType.PING) {
        sendResponse({
            ok: true,
            url: window.location.href,
            platform: detectPlatform(),
            context: 'CONTENT_SCRIPT',
        });
        return true;
    }

    return false;
});
```

替换为（新增 `EXECUTE_TASK` 处理分支）：

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // PING：background 检查 content script 是否存活
    if (message.type === MsgType.PING) {
        sendResponse({
            ok: true,
            url: window.location.href,
            platform: detectPlatform(),
            context: 'CONTENT_SCRIPT',
        });
        return true;
    }

    // EXECUTE_TASK：background 下发任务，在此 content script 中执行 API 调用
    if (message.type === MsgType.EXECUTE_TASK) {
        const task = message.task as ExecuteTaskPayload;
        const credentials = message.credentials as Credentials;
        const startTime = Date.now();

        const adapter = getAdapter(task.platform);
        if (!adapter) {
            const result: ExecuteTaskResultPayload = {
                taskId: task.taskId,
                success: false,
                platform: task.platform,
                error: `No adapter available for platform: ${task.platform}`,
                executedAt: new Date().toISOString(),
                durationMs: Date.now() - startTime,
            };
            sendResponse({ ok: false, result });
            return true;
        }

        adapter.sendMessage(
            {
                prompt: task.payload.prompt,
                conversationId: task.payload.conversationId,
                model: task.payload.model,
            },
            credentials
        ).then((adapterResult) => {
            const result: ExecuteTaskResultPayload = {
                taskId: task.taskId,
                success: adapterResult.success,
                platform: task.platform,
                content: adapterResult.content,
                conversationId: adapterResult.conversationId,
                error: adapterResult.error,
                executedAt: new Date().toISOString(),
                durationMs: Date.now() - startTime,
            };
            sendResponse({ ok: adapterResult.success, result });
        }).catch((err) => {
            const result: ExecuteTaskResultPayload = {
                taskId: task.taskId,
                success: false,
                platform: task.platform,
                error: err instanceof Error ? err.message : String(err),
                executedAt: new Date().toISOString(),
                durationMs: Date.now() - startTime,
            };
            sendResponse({ ok: false, result });
        });

        return true; // 必须返回 true，表示 sendResponse 会异步调用
    }

    return false;
});
```

#### 自检：任务 4 完成确认

- [ ] `main_entrance.ts` 顶部已 import `ChatGptAdapter`
- [ ] 文件中存在 `getAdapter(platform: string)` 函数
- [ ] `chrome.runtime.onMessage` 监听器中有 `MsgType.EXECUTE_TASK` 的处理分支
- [ ] `EXECUTE_TASK` 分支最后 `return true`（这是 Chrome 扩展异步 sendResponse 的必要条件，缺少会导致回调永远不触发）
- [ ] `adapter.sendMessage()` 调用后的 `.then()` 和 `.catch()` 都有 `sendResponse` 调用，确保任何情况下都有响应

---

### 任务 5：在 `background.ts` 中实现任务调度逻辑

**目的：** background 接收来自 `local-bridge-socket` 的任务，找到对应平台的标签页，将任务转发给该标签页的 content script 执行，并将结果回传给 localBridge。

#### 步骤 5.1：在 `background.ts` 中新增 `executeTask` 函数

打开 `src/service_work/background.ts`，找到 `queryAITabsStatus` 函数（`async function queryAITabsStatus()`），在该函数**正上方**插入以下新函数：

```typescript
// ── 任务执行调度器 ──

async function executeTask(task: any): Promise<any> {
    const platform = task.platform as PlatformType;
    const startTime = Date.now();

    // 1. 读取凭证
    const creds = await loadCredentials();
    const platformCreds = creds[platform];

    if (!platformCreds) {
        return {
            taskId: task.taskId,
            success: false,
            platform,
            error: `Unknown platform: ${platform}`,
            executedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime,
        };
    }

    // 2. 查找该平台已打开的标签页
    let tabQueryPatterns: string[] = [];
    if (platform === 'chatgpt') {
        tabQueryPatterns = ['https://chatgpt.com/*', 'https://chat.openai.com/*'];
    } else if (platform === 'gemini') {
        tabQueryPatterns = ['https://gemini.google.com/*'];
    } else if (platform === 'grok') {
        tabQueryPatterns = ['https://grok.com/*', 'https://x.com/i/grok*'];
    }

    const tabs = await chrome.tabs.query({ url: tabQueryPatterns });

    if (tabs.length === 0 || !tabs[0].id) {
        return {
            taskId: task.taskId,
            success: false,
            platform,
            error: `No open tab found for platform: ${platform}. Please open ${platform} in a browser tab first.`,
            executedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime,
        };
    }

    // 3. 选择标签页（优先选中激活的标签，否则选第一个）
    const targetTab = tabs.find(t => t.active) || tabs[0];
    const tabId = targetTab.id!;

    console.log(`[aiClaw-BG] 📤 Dispatching task ${task.taskId} to tab ${tabId} (${platform})`);

    // 4. 将凭证和任务一起发给 content script 执行
    //    Content script 与目标页面同源，fetch 会自动携带 Cookie
    const credentials = {
        bearerToken: platformCreds.bearerToken,
        apiEndpoint: platformCreds.apiEndpoint,
        extraHeaders: platformCreds.lastCapturedHeaders || {},
    };

    return new Promise((resolve) => {
        chrome.tabs.sendMessage(
            tabId,
            {
                type: MsgType.EXECUTE_TASK,
                task,
                credentials,
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    resolve({
                        taskId: task.taskId,
                        success: false,
                        platform,
                        error: `Failed to send message to tab: ${chrome.runtime.lastError.message}`,
                        executedAt: new Date().toISOString(),
                        durationMs: Date.now() - startTime,
                    });
                    return;
                }

                if (response && response.result) {
                    resolve(response.result);
                } else {
                    resolve({
                        taskId: task.taskId,
                        success: false,
                        platform,
                        error: 'Content script returned no result',
                        executedAt: new Date().toISOString(),
                        durationMs: Date.now() - startTime,
                    });
                }
            }
        );
    });
}
```

#### 步骤 5.2：注册 `executeTaskHandler`

找到文件末尾的这两行：

```typescript
const localBridge = new LocalBridgeSocket();
localBridge.queryAITabsHandler = queryAITabsStatus;
```

替换为：

```typescript
const localBridge = new LocalBridgeSocket();
localBridge.queryAITabsHandler = queryAITabsStatus;
localBridge.executeTaskHandler = executeTask;
```

#### 步骤 5.3：确认 `background.ts` 顶部已 import `MsgType`

检查 `background.ts` 顶部是否已有：

```typescript
import { STORAGE_KEY_CREDENTIALS, MsgType } from '../capture/consts';
```

如果已有，无需改动。如果没有 `MsgType`，则将现有 import 修改为包含 `MsgType`。

#### 自检：任务 5 完成确认

- [ ] `background.ts` 中存在 `executeTask(task: any)` 函数
- [ ] `executeTask` 函数内有 `loadCredentials()` 调用（读取凭证）
- [ ] `executeTask` 函数内有 `chrome.tabs.query()` 调用（查找标签页）
- [ ] `executeTask` 函数内有 `chrome.tabs.sendMessage()` 调用（转发给 content script）
- [ ] 文件末尾有 `localBridge.executeTaskHandler = executeTask;` 这一行
- [ ] `chrome.tabs.sendMessage` 的回调中有 `chrome.runtime.lastError` 检查，否则 Chrome 会在控制台抛出未处理错误

---

### 任务 6：验证编译通过（TypeScript 类型检查）

**目的：** 确认所有修改没有引入 TypeScript 编译错误。

#### 步骤 6.1：运行编译

在项目根目录（`/Users/wesley/aiwithblockchain/aihub/aiClaw`）执行：

```bash
npm run build
```

或者只做类型检查（不生成文件）：

```bash
npx tsc --noEmit
```

#### 步骤 6.2：处理编译错误

常见错误及处理方式：

| 错误信息 | 原因 | 处理方式 |
|---------|------|---------|
| `Cannot find module '../storage/credentials-store'` | 任务 1 未完成或路径错误 | 检查文件是否创建在 `src/storage/` 目录下 |
| `Property 'executeTaskHandler' does not exist` | 任务 3 未完成 | 检查 `local-bridge-socket.ts` 是否添加了该属性 |
| `Module '"../bridge/ws-protocol"' has no exported member 'ExecuteTaskPayload'` | 任务 2 未完成 | 检查 `ws-protocol.ts` 末尾是否有新增接口 |
| `Type 'X' is not assignable to type 'Y'` | 类型不匹配 | 检查对应的接口定义是否与使用处一致 |

#### 自检：任务 6 完成确认

- [ ] `npm run build` 或 `npx tsc --noEmit` 执行后，没有任何 error 输出
- [ ] `dist/js/` 目录下有最新的 `background.js`、`content.js`、`injection.js` 文件（若运行了 build）

---

## 完整数据流（执行后的效果）

任务完成后，完整链路如下：

```
localBridge（Mac App）
  │
  │  WebSocket: request.execute_task
  │  { taskId, platform: "chatgpt", action: "send_message", payload: { prompt: "..." } }
  ▼
background.ts（Service Worker）
  │  executeTask() 被调用
  │  1. loadCredentials() 读取 chatgpt 的 bearerToken 和 apiEndpoint
  │  2. chrome.tabs.query() 找到 chatgpt.com 的标签页
  │  3. chrome.tabs.sendMessage(tabId, { type: AC_EXECUTE_TASK, task, credentials })
  ▼
main_entrance.ts（Content Script，运行在 chatgpt.com 页面）
  │  监听到 AC_EXECUTE_TASK 消息
  │  1. getAdapter('chatgpt') → ChatGptAdapter 实例
  │  2. adapter.sendMessage({ prompt }, credentials)
  │     └── fetch("https://chatgpt.com/backend-api/conversation", { Authorization: bearerToken })
  │         浏览器自动携带 chatgpt.com 的 Cookie（登录态）
  │  3. SseParser 解析 SSE 流式响应，拼接完整回复
  │  4. sendResponse({ ok: true, result: { content: "AI 回复内容..." } })
  ▼
background.ts
  │  收到 content script 的 result
  │  通过 WebSocket 回传给 localBridge
  ▼
localBridge（Mac App）
  WebSocket: response.execute_task_result
  { taskId, success: true, content: "AI 回复内容...", durationMs: 1234 }
```

---

## 附录：关键文件内容速查

### `consts.ts` 中的 `MsgType` 枚举（已有，无需修改）

```typescript
export enum MsgType {
    PING = 'AC_PING',
    CAPTURED_CREDENTIALS = 'AC_CAPTURED_CREDENTIALS',
    EXECUTE_TASK = 'AC_EXECUTE_TASK',      // content script 接收任务用此类型
    TASK_RESULT = 'AC_TASK_RESULT',
    AC_SEND_TEST_MESSAGE = 'AC_SEND_TEST_MESSAGE',
}
```

### `chatgpt-adapter.ts` 中 `sendMessage` 的凭证要求

`ChatGptAdapter.sendMessage()` 需要 `credentials` 对象中有：
- `credentials.bearerToken`：必须，格式为 `"Bearer xxx..."`
- `credentials.apiEndpoint`：必须，格式为 `"https://chatgpt.com/backend-api/conversation"`

如果这两个字段为空，adapter 会直接返回 `success: false`。

---

*文档结束。如有疑问，请优先参考 `ARCHITECTURE.md` 了解系统全貌。*
