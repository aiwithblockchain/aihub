# aiClaw 技术架构文档

> 版本：v2.0  
> 更新日期：2026-03-16  
> 状态：**核心链路已调通，ChatGPT DOM 方案验证中**

---

## 1. 项目定位

aiClaw 是一个 Chrome 浏览器扩展（Manifest V3），其核心使命是：

> **在用户已登录的浏览器环境中，通过任务调度自动化地与 ChatGPT、Gemini、Grok 三个 AI 平台进行交互，让这三个浏览器端的 AI 为用户完成分配的工作任务。**

它是 **aiHub** 生态中的浏览器端执行器，通过 WebSocket 与 `localBridge` 服务保持长连接，从任务中心领取并执行任务。

---

## 2. 核心技术决策

### 2.1 交互方式：DOM 操作（模拟用户行为）

**当前采用方案：DOM 操作 ✅**

我们在开发过程中完整评估并实际尝试了两种方案，最终确认采用 DOM 操作：

| 维度 | 方案 A：DOM 操作 ✅ 采用 | 方案 B：API 拦截 ❌ 放弃 |
|------|------------------------|------------------------|
| 实现思路 | 找输入框 → 填内容 → 点发送按钮 → MutationObserver 等待回复 | 拦截 fetch/XHR → 捕获凭证 → 直接调 API |
| 风控对抗 | ✅ 完全走真实用户操作路径，不触发风控 | ❌ ChatGPT 有 `proof-token`、`turnstile-token` 等浏览器端运算生成的风控 token，无法在扩展环境中复现 |
| React 兼容 | ✅ 通过 `nativeInputValueSetter` + 触发合成事件解决 React 感知问题 | ✅ 不依赖 DOM，无此问题 |
| 回复提取 | ✅ 用 `MutationObserver` 监听 `[data-testid="stop-button"]` 出现/消失精确判断完成 | ✅ 结构化 JSON/SSE，可精确检测 `[DONE]` 结束标记（但因风控无法走到这一步） |
| 选择器稳定性 | ✅ 使用 `data-testid` 属性（专为测试设计，比 class 名稳定）| — |
| 实际验证 | ✅ 已实现，待端到端验证 | ❌ 实际调试中 ChatGPT 始终返回 403，`proof-token`/`turnstile-token` 无法绕过 |

**放弃 API 拦截的关键原因（实战记录）：**

ChatGPT 的 conversation 接口（`/backend-api/f/conversation`）要求以下 token 同时存在：
- `openai-sentinel-chat-requirements-token`：每次请求前动态获取
- `openai-sentinel-proof-token`：浏览器端 JS 运算（PoW）生成，无法离线复现
- `openai-sentinel-turnstile-token`：Cloudflare Turnstile 人机验证 token，需要完整浏览器环境生成

即使 `injection.ts` 捕获到了用户真实请求中的这些 token，它们也是一次性的，我们构造的请求会触发 `"Unusual activity has been detected"` 的 403 拒绝。

**结论**：DOM 操作方案绕过了所有风控，是唯一可行的自动化路径。

### 2.2 injection.ts 的角色调整

`injection.ts` 的 fetch hook **保留**，但其职责从"为任务执行提供凭证"转变为**纯被动监控**：

- 继续捕获 Bearer Token 和请求头，用于**平台登录状态判定**（`isLoggedIn` 检测）
- 不再为任务执行提供 API 凭证（DOM 方案不需要）
- 继续上报 hook 状态，用于调试和健康监控

### 2.3 技术栈

沿用 tweetClaw 的技术栈，保持一致性：

- **语言**：TypeScript
- **构建**：Webpack 5 + ts-loader
- **扩展标准**：Chrome Manifest V3
- **测试**：Vitest
- **源码目录**：`src/` → 编译输出到 `dist/js/`
- **安装目录**：`dist/`（浏览器加载此目录）

---

## 3. 系统架构

### 3.1 整体架构图

```
                        ┌──────────────────────┐
                        │     localBridge      │
                        │  (WebSocket Server)  │
                        │                      │
                        │  任务中心 → 下发任务   │
                        │  ← 接收执行结果       │
                        └──────────┬───────────┘
                                   │ WebSocket
                                   │
┌──────────────────────────────────▼───────────────────────────────────┐
│                     aiClaw 浏览器扩展                                │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              background.ts (Service Worker)                  │    │
│  │                                                              │    │
│  │  • WebSocket 客户端 ↔ localBridge 保持连接                     │    │
│  │  • 凭证存储中心（chrome.storage.local）→ 用于登录状态检测        │    │
│  │  • 任务调度器：按平台分发任务到对应标签页                        │    │
│  └──────────────────────┬──────────────────────────────────────┘    │
│                          │ chrome.tabs.sendMessage                 │
│          ┌───────────────┼───────────────┐                         │
│          │               │               │                         │
│          ▼               ▼               ▼                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│  │  ChatGPT Tab │ │  Gemini Tab  │ │   Grok Tab   │               │
│  │              │ │              │ │              │               │
│  │ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │               │
│  │ │injection │ │ │ │injection │ │ │ │injection │ │               │
│  │ │(MAIN)    │ │ │ │(MAIN)    │ │ │ │(MAIN)    │ │               │
│  │ │          │ │ │ │          │ │ │ │          │ │               │
│  │ │hook fetch│ │ │ │hook fetch│ │ │ │hook fetch│ │               │
│  │ │被动捕获   │ │ │ │被动捕获   │ │ │ │被动捕获   │ │               │
│  │ │登录状态   │ │ │ │登录状态   │ │ │ │登录状态   │ │               │
│  │ └────┬─────┘ │ │ └────┬─────┘ │ │ └────┬─────┘ │               │
│  │      │ postMsg│ │      │ postMsg│ │      │ postMsg│              │
│  │ ┌────▼─────┐ │ │ ┌────▼─────┐ │ │ ┌────▼─────┐ │               │
│  │ │content.ts│ │ │ │content.ts│ │ │ │content.ts│ │               │
│  │ │(ISOLATED)│ │ │ │(ISOLATED)│ │ │ │(ISOLATED)│ │               │
│  │ │          │ │ │ │          │ │ │ │          │ │               │
│  │ │中继消息    │ │ │ │中继消息    │ │ │ │中继消息    │ │               │
│  │ │          │ │ │ │          │ │ │ │          │ │               │
│  │ │ DOM 操作  │ │ │ │ DOM 操作  │ │ │ │ DOM 操作  │ │               │
│  │ │填入prompt │ │ │ │填入prompt │ │ │ │填入prompt │ │               │
│  │ │点击发送   │ │ │ │点击发送   │ │ │ │点击发送   │ │               │
│  │ │等待回复   │ │ │ │等待回复   │ │ │ │等待回复   │ │               │
│  │ │提取文本   │ │ │ │提取文本   │ │ │ │提取文本   │ │               │
│  │ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │               │
│  └──────────────┘ └──────────────┘ └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 三层执行环境

aiClaw 的代码运行在三个隔离的执行环境中，各有不同的职责和权限：

| 层级 | 文件 | Chrome 术语 | 运行环境 | 核心职责 |
|------|------|------------|----------|----------|
| **Layer 1** | `injection.ts` | MAIN world | 与目标网页共享 JS 上下文 | Hook `window.fetch`/`XMLHttpRequest`，**被动**捕获登录状态信号，不再为任务执行提供凭证 |
| **Layer 2** | `main_entrance.ts` | Content Script (ISOLATED world) | 注入但与页面 JS 隔离 | 1. 注入 injection.js；2. 中继消息；3. **执行 DOM 操作**（填 prompt、点发送、等回复、提取文本） |
| **Layer 3** | `background.ts` | Service Worker | 扩展后台 | 1. WebSocket ↔ localBridge；2. 登录状态存储；3. 任务调度（转发到对应标签页） |

**为什么任务执行在 Content Script 中？**
- Content Script 可以直接访问页面 DOM，background Service Worker 不能。
- DOM 操作必须在目标页面的 content script 中进行。

---

## 4. 数据流

### 4.1 登录状态捕获流程（被动，injection.ts 职责）

当用户正常使用 AI 平台时，aiClaw 在后台自动判断登录状态：

```
用户正常使用 ChatGPT（发一条消息）
        │
        ▼
ChatGPT 页面发起 fetch("https://chatgpt.com/backend-api/f/conversation", {...})
        │
        ▼
injection.ts 的 fetch hook 拦截
  ├── 记录 API 流量时间戳（lastCapturedAt）
  ├── 提取 Authorization Bearer Token（存储备用）
  └── window.postMessage({source: 'aiclaw-injection', type: 'AC_CAPTURED_CREDENTIALS', ...})
        │
        ▼
main_entrance.ts 监听 window message → chrome.runtime.sendMessage
        │
        ▼
background.ts 更新存储
  └── 活跃状态判定：1 小时内有 API 流量 → isLoggedIn: true
```

### 4.2 任务执行流程（主动，DOM 操作）

```
localBridge WebSocket 推送任务
  { platform: "chatgpt", prompt: "请帮我翻译以下内容...", taskId: "abc123" }
        │
        ▼
background.ts 接收任务
  ├── 查找已打开的 chatgpt.com 标签页
  └── chrome.tabs.sendMessage(tabId, { type: 'AC_EXECUTE_TASK', task })
        │
        ▼
main_entrance.ts（运行在 chatgpt.com 页面的 content script）
  ├── 调用 ChatGptAdapter.sendMessage()
  │
  ├── [Step 1] 找到输入框
  │     document.querySelector('#prompt-textarea')
  │     等待超时: 5 秒
  │
  ├── [Step 2] 填入 prompt（React 兼容方式）
  │     nativeInputValueSetter.call(textarea, prompt)
  │     textarea.dispatchEvent(new Event('input', { bubbles: true }))
  │     sleep(300ms)  ← 等 React 处理 onChange
  │
  ├── [Step 3] 点击发送按钮
  │     document.querySelector('[data-testid="send-button"]').click()
  │
  ├── [Step 4] 等待回复完成（MutationObserver）
  │     等待 [data-testid="stop-button"] 出现（ChatGPT 开始生成）
  │     等待 [data-testid="stop-button"] 消失（ChatGPT 生成完成）
  │     超时设置: 开始等待 10s，完成等待 120s
  │
  ├── [Step 5] 提取回复文本
  │     document.querySelectorAll('[data-message-author-role="assistant"]')
  │     取最后一条的 textContent
  │
  └── sendResponse({ ok: true, result: { content: "翻译结果..." } })
        │
        ▼
background.ts 将结果通过 WebSocket 回传给 localBridge
  { taskId: "abc123", success: true, content: "翻译结果...", durationMs: 3500 }
```

---

## 5. 三大 AI 平台适配细节

### 5.1 ChatGPT ✅ 已实现（DOM 方案）

| 项目 | 详情 |
|------|------|
| **域名** | `chatgpt.com`、`chat.openai.com` |
| **交互方式** | DOM 操作 |
| **输入框选择器** | `#prompt-textarea` |
| **发送按钮选择器** | `[data-testid="send-button"]` |
| **生成中判断** | `[data-testid="stop-button"]` 存在 |
| **生成完成判断** | `[data-testid="stop-button"]` 消失 |
| **回复提取选择器** | `[data-message-author-role="assistant"]`（取最后一条） |
| **React 兼容** | 使用 `HTMLTextAreaElement.prototype` 的 `nativeInputValueSetter`，触发 `input` + `change` 合成事件 |
| **conversation ID** | 从 URL 路径 `/c/<uuid>` 提取 |
| **已放弃方案** | API 调用（`/backend-api/f/conversation`），因 `proof-token`/`turnstile-token` 风控无法绕过 |

### 5.2 Gemini（待实现，预计 DOM 方案）

| 项目 | 详情 |
|------|------|
| **域名** | `gemini.google.com` |
| **交互方式** | 待调研，预计采用 DOM 方案（理由同 ChatGPT：Google 同样有风控机制） |
| **输入框选择器** | 待确认（预估为 `rich-textarea` 或类似组件） |
| **特殊注意** | Gemini 使用富文本编辑器（非标准 textarea），React 兼容处理方式可能不同 |

### 5.3 Grok（待实现，预计 DOM 方案）

| 项目 | 详情 |
|------|------|
| **域名** | `grok.com`、`x.com/i/grok` |
| **交互方式** | 待调研，预计采用 DOM 方案 |
| **输入框选择器** | 待确认 |
| **特殊注意** | Grok 与 X (Twitter) 共享登录态，页面结构可能与 tweetClaw 有重叠 |

### 5.4 平台适配策略

统一采用 DOM 操作方案，渐进实现：

1. **Phase 1（当前）**：完成 ChatGPT DOM 方案，端到端验证完整链路。
2. **Phase 2**：在 Gemini 页面人工操作，观察 DOM 结构，确认输入框和按钮选择器，实现 `gemini-adapter.ts`。
3. **Phase 3**：同上，实现 `grok-adapter.ts`。
4. **选择器维护**：当 AI 平台更新导致选择器失效时，只需更新 adapter 中的选择器常量，核心逻辑不变。

---

## 6. 目录结构设计

```
aiClaw/
├── doc/
│   └── ARCHITECTURE.md
│
├── src/
│   ├── content/
│   │   └── main_entrance.ts      ← Layer 2: Content Script，执行 DOM 操作
│   │
│   ├── service_work/
│   │   └── background.ts         ← Layer 3: Background Service Worker
│   │
│   ├── capture/                  ← 被动监控层
│   │   ├── injection.ts          ← Layer 1: MAIN world fetch/XHR hook（仅用于登录状态捕获）
│   │   └── consts.ts             ← 消息类型、平台常量
│   │
│   ├── adapters/                 ← 平台适配器（DOM 操作封装）
│   │   ├── base-adapter.ts       ← 抽象基类：定义 sendMessage 接口
│   │   ├── chatgpt-adapter.ts    ← ChatGPT DOM 适配器 ✅ 已实现
│   │   ├── gemini-adapter.ts     ← Gemini DOM 适配器（待实现）
│   │   └── grok-adapter.ts       ← Grok DOM 适配器（待实现）
│   │
│   ├── storage/
│   │   └── credentials-store.ts  ← 登录状态存储（凭证存储，用于 isLoggedIn 判定）
│   │
│   ├── bridge/
│   │   ├── local-bridge-socket.ts ← WebSocket 客户端
│   │   └── ws-protocol.ts         ← 消息协议类型定义
│   │
│   └── utils/
│       └── sse-parser.ts         ← SSE 解析器（当前未使用，保留供未来参考）
│
├── dist/
│   ├── manifest.json
│   ├── images/
│   └── js/
│       ├── background.js
│       ├── content.js
│       └── injection.js
│
├── package.json
├── tsconfig.json
├── webpack.config.js
└── README.md
```

---

## 7. 关键接口定义

### 7.1 平台适配器接口

```typescript
// src/adapters/base-adapter.ts

export type PlatformType = 'chatgpt' | 'gemini' | 'grok';

export interface Credentials {
    bearerToken?: string;
    apiEndpoint?: string;
    extraHeaders?: Record<string, string>;
}

export interface SendMessageRequest {
    prompt: string;
    conversationId?: string;
    model?: string;
}

export interface SendMessageResponse {
    success: boolean;
    content: string;
    conversationId?: string;
    messageId?: string;
    error?: string;
    rawResponse?: any;
}

export abstract class BasePlatformAdapter {
    abstract readonly platform: PlatformType;

    /**
     * 发送消息并等待回复。
     * DOM 方案中 credentials 参数不使用，传空对象即可。
     */
    abstract sendMessage(
        request: SendMessageRequest,
        credentials: Credentials
    ): Promise<SendMessageResponse>;

    abstract isTargetApiUrl(url: string): boolean;

    abstract extractCredentials(
        url: string,
        requestHeaders: Record<string, string>,
        responseBody: any
    ): Partial<Credentials>;
}
```

### 7.2 ChatGPT DOM 适配器关键选择器（`chatgpt-adapter.ts`）

```typescript
// 选择器常量（ChatGPT 更新 DOM 时只需修改这里）
const SELECTORS = {
    INPUT:        '#prompt-textarea',                       // 输入框
    SEND_BUTTON:  '[data-testid="send-button"]',            // 发送按钮
    STOP_BUTTON:  '[data-testid="stop-button"]',            // 生成中（停止按钮）
    MSG_ASSISTANT: '[data-message-author-role="assistant"]', // 回复消息容器
};

// 超时配置
const TIMEOUTS = {
    FIND_INPUT:     5_000,   // 找输入框超时
    FIND_SEND:      3_000,   // 找发送按钮超时
    WAIT_START:    10_000,   // 等待开始生成超时
    WAIT_COMPLETE: 120_000,  // 等待完成生成超时
};
```

### 7.3 任务协议（WebSocket 消息格式）

```typescript
// localBridge → aiClaw (下发任务)
{
    type: 'request.execute_task',
    payload: {
        taskId: string,
        platform: 'chatgpt' | 'gemini' | 'grok',
        action: 'send_message',
        payload: {
            prompt: string,
            conversationId?: string,
        }
    }
}

// aiClaw → localBridge (回传结果)
{
    type: 'response.execute_task_result',
    payload: {
        taskId: string,
        success: boolean,
        platform: string,
        content?: string,         // AI 回复文本
        conversationId?: string,
        error?: string,
        executedAt: string,       // ISO 8601
        durationMs: number,
    }
}
```

### 7.4 内部消息协议（扩展内部各层通信）

```typescript
// injection → content (via window.postMessage)
{
    source: 'aiclaw-injection',
    type: 'AC_CAPTURED_CREDENTIALS',
    platform: PlatformType,
    apiUrl: string,
    bearerToken: string | null,
    requestHeaders: Record<string, string>,
}

// content → background (via chrome.runtime.sendMessage)
{ type: 'AC_CAPTURED_CREDENTIALS', platform, bearerToken, apiUrl, requestHeaders }

// background → content (via chrome.tabs.sendMessage)
{ type: 'AC_EXECUTE_TASK', task: ExecuteTaskPayload }

// content → background (via sendResponse 回调)
{ ok: boolean, result: ExecuteTaskResultPayload }
```

---

## 8. 与 localBridge 的通信

### 8.1 WebSocket 连接

```
ws://127.0.0.1:8766/ws   （aiClaw 默认端口，可通过 Settings 修改）
```

### 8.2 连接生命周期

```
扩展启动 → 尝试连接 localBridge
    ├── 连接成功 → 发送 client.hello → 接收 server.hello_ack
    │    ├── 收到 request.execute_task → 调度执行 → 返回 response.execute_task_result
    │    └── 心跳保活 ping/pong（20s 间隔）
    │
    └── 连接失败 → 指数退避重连（1s → 2s → 5s → 10s）
```

### 8.3 Service Worker 保活

Manifest V3 的 Service Worker 约 30 秒空闲后会被挂起，通过以下机制保活：
- `chrome.alarms` API 每 25 秒触发唤醒
- 唤醒后检测 WebSocket 状态并重连

---

## 9. 开发路线图

### Phase 0 — 工程骨架搭建 ✅ 已完成
- [x] 目录结构、TypeScript + Webpack 编译链路
- [x] `dist/manifest.json` 配置
- [x] Content script 三平台注入验证

### Phase 1 — 登录状态捕获链路 ✅ 已完成
- [x] `injection.ts`：fetch hook，识别三个平台的 API 请求
- [x] `main_entrance.ts` 消息中继
- [x] `background.ts` 凭证存储与心跳活跃判定
- [x] 三大平台均能正确上报 `isLoggedIn` 状态

### Phase 2 — WebSocket ↔ localBridge ✅ 已完成
- [x] `local-bridge-socket.ts` WebSocket 客户端，支持多端口动态重连
- [x] `query_ai_tabs_status` 协议
- [x] `execute_task` / `execute_task_result` 协议
- [x] Service Worker 保活机制
- [x] Mac App 成功显示 AIClaw 各平台登录与标签状态

### Phase 3 — ChatGPT DOM 适配器 🏗️ 进行中
- [x] `chatgpt-adapter.ts`：DOM 操作实现（填 prompt、点发送、等待回复、提取文本）
- [x] React 兼容处理（`nativeInputValueSetter`）
- [x] `MutationObserver` 等待回复完成逻辑
- [ ] **端到端验证**：通过 Mac App 下发任务，ChatGPT 正确回复并回传结果

### Phase 4 — Gemini & Grok DOM 适配器
- [ ] 人工操作 Gemini，观察并记录输入框、发送按钮选择器
- [ ] 实现 `gemini-adapter.ts`
- [ ] 人工操作 Grok，观察并记录选择器
- [ ] 实现 `grok-adapter.ts`
- [ ] 三平台全量端到端验证

### Phase 5 — 健壮性与生产化
- [ ] 选择器失效自动检测与告警
- [ ] 多 tab 管理（任务锁，同平台串行执行）
- [ ] 任务队列与超时重试
- [ ] 错误分类（选择器失效 vs 网络错误 vs 超时）
- [ ] 日志与调试面板

---

## 附录 A：技术决策历史

### API 拦截方案尝试记录（v1.0 → v2.0 的演进）

初始设计（v1.0）采用 API 拦截方案，参考 tweetClaw 对 X 平台的成功实践。在实际开发中遭遇以下阻碍：

1. **端点路径变化**：ChatGPT 将 `/backend-api/conversation` 迁移至 `/backend-api/f/conversation`
2. **proof-token**：浏览器端 PoW（Proof of Work）运算结果，需要完整的 V8/Chrome 环境才能生成
3. **turnstile-token**：Cloudflare Turnstile 人机验证 token，无法在扩展 fetch 调用中复现
4. **结论**：即使 injection.ts 捕获到真实用户请求中的这些 token，它们也是一次性的，复用时必定触发 403

DOM 方案完全绕开了上述所有风控机制，因为整个交互路径与真实用户操作完全一致。

### tweetClaw 参考架构映射（更新后）

| tweetClaw 组件 | aiClaw 对应组件 | 职责映射 |
|---------------|----------------|---------|
| `src/capture/injection.ts` | `src/capture/injection.ts` | fetch/XHR hook（aiClaw 仅用于状态监控） |
| `src/content/main_entrance.ts` | `src/content/main_entrance.ts` | 消息中继（aiClaw 额外执行 DOM 操作） |
| `src/service_work/background.ts` | `src/service_work/background.ts` | 状态管理 + 任务调度 |
| `src/capture/extractor.ts` | `src/adapters/*.ts` | 平台交互逻辑（aiClaw 改为 DOM 操作） |
| `performMutation()` in content | `ChatGptAdapter.sendMessage()` | 执行实际操作（tweetClaw 用 API，aiClaw 用 DOM） |
