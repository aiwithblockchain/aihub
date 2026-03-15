# aiClaw 技术架构文档

> 版本：v1.0  
> 更新日期：2026-03-15 (已更新进展)  
> 状态：**核心链路已调通**

---

## 1. 项目定位

aiClaw 是一个 Chrome 浏览器扩展（Manifest V3），其核心使命是：

> **在用户已登录的浏览器环境中，通过任务调度自动化地与 ChatGPT、Gemini、Grok 三个 AI 平台进行交互，让这三个浏览器端的 AI 为用户完成分配的工作任务。**

它是 **aiHub** 生态中的浏览器端执行器，通过 WebSocket 与 `localBridge` 服务保持长连接，从任务中心领取并执行任务。

---

## 2. 核心技术决策

### 2.1 交互方式：API 拦截（而非 DOM 操作）

**最终确认方案：API 拦截 + 模拟 API 调用**

我们评估了两种与 AI 平台交互的方案：

| 维度 | 方案 A：DOM 操作 | 方案 B：API 拦截 ✅ 采用 |
|------|-----------------|------------------------|
| 实现思路 | 找输入框 → 填内容 → 点发送按钮 | 拦截 fetch/XHR → 捕获凭证 → 直接调 API |
| 稳定性 | ❌ 极差。ChatGPT/Gemini 几乎每周更新 DOM 结构，CSS 选择器频繁失效 | ✅ 优秀。API 端点和请求格式变化频率远低于 DOM |
| React 兼容 | ❌ 直接设 `textarea.value` React 无法感知，需 hack React Fiber 内部事件链 | ✅ 不依赖 DOM，无此问题 |
| 回复提取 | ❌ 困难。需轮询/MutationObserver 观察 DOM 变化，无法精确判断流式输出结束 | ✅ 结构化 JSON/SSE，可精确检测 `[DONE]` 结束标记 |
| 多平台维护 | ❌ 三套 DOM 选择器 × 频繁变化 = 巨大维护负担 | ✅ 三套 API 适配器，变化频率低 |
| 已验证 | 无 | ✅ tweetClaw 已用此方案稳定运行对 X 平台的 API 拦截 |

**结论**：采用方案 B，复用 tweetClaw 已验证的 `injection.ts → content script → background` 拦截链路架构。

### 2.2 技术栈

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
│  │  • 凭证存储中心（chrome.storage.local）                        │    │
│  │  • 任务调度器：按平台分发任务                                   │    │
│  │  • 全局 webRequest 拦截器：被动捕获 Bearer Token               │    │
│  └──────────────────────┬──────────────────────────────────────┘    │
│                          │ chrome.runtime.sendMessage              │
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
│  │ │捕获凭证   │ │ │ │捕获凭证   │ │ │ │捕获凭证   │ │               │
│  │ └────┬─────┘ │ │ └────┬─────┘ │ │ └────┬─────┘ │               │
│  │      │ postMsg│ │      │ postMsg│ │      │ postMsg│              │
│  │ ┌────▼─────┐ │ │ ┌────▼─────┐ │ │ ┌────▼─────┐ │               │
│  │ │content.ts│ │ │ │content.ts│ │ │ │content.ts│ │               │
│  │ │(ISOLATED)│ │ │ │(ISOLATED)│ │ │ │(ISOLATED)│ │               │
│  │ │          │ │ │ │          │ │ │ │          │ │               │
│  │ │中继消息    │ │ │ │中继消息    │ │ │ │中继消息    │ │               │
│  │ │执行API调用│ │ │ │执行API调用│ │ │ │执行API调用│ │               │
│  │ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │               │
│  └──────────────┘ └──────────────┘ └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 三层执行环境

aiClaw 的代码运行在三个隔离的执行环境中，各有不同的职责和权限：

| 层级 | 文件 | Chrome 术语 | 运行环境 | 核心职责 |
|------|------|------------|----------|----------|
| **Layer 1** | `injection.ts` | MAIN world | 与目标网页共享 JS 上下文 | Hook `window.fetch`/`XMLHttpRequest`，被动捕获凭证和 API 格式 |
| **Layer 2** | `main_entrance.ts` | Content Script (ISOLATED world) | 注入但与页面 JS 隔离 | 1. 注入 injection.js 到页面；2. 中继 injection ↔ background 的消息；3. **执行 API 调用**（发送消息、接收回复） |
| **Layer 3** | `background.ts` | Service Worker | 扩展后台 | 1. WebSocket ↔ localBridge；2. 凭证存储；3. 任务调度；4. webRequest 拦截 |

**为什么 API 调用在 Content Script 中执行？**
- Content Script 与目标页面共享同一 Origin（如 `https://chatgpt.com`），因此 `fetch()` 调用时浏览器会**自动附带该域名下的 Cookie**（包含登录态）。
- Service Worker 无法自动携带目标域名的 Cookie。
- 这与 tweetClaw 的架构一致：写操作（`performMutation`）也是在 content script 中执行的。

---

## 4. 数据流

### 4.1 凭证捕获流程（被动）

当用户正常使用 AI 平台时，aiClaw 在后台自动捕获所需凭证：

```
用户正常使用 ChatGPT
        │
        ▼
ChatGPT 页面发起 fetch("https://chatgpt.com/backend-api/conversation", {...})
        │
        ▼
injection.ts 的 fetch hook 拦截
  ├── 提取 Authorization header 中的 Bearer Token
  ├── 记录 API 端点 URL 格式
  ├── 解析响应体（用于推断请求格式）
  └── window.postMessage({source: 'aiclaw-injection', ...})
        │
        ▼
main_entrance.ts 监听 window message
  └── chrome.runtime.sendMessage({type: 'CAPTURED_CREDENTIALS', ...})
        │
        ▼
background.ts 接收并存储
  ├── chrome.storage.local.set({ chatgpt_bearer: "Bearer xxx", ... })
  └── **活跃状态判定**：除了存储 Token，还记录 `lastCapturedAt`。
      如果 1 小时内有匹配的 API 流量，即使没抓到 Token（如 Gemini），也判定为 `isLoggedIn: true`。
```

### 4.2 任务执行流程（主动）

当 localBridge 推送任务时，aiClaw 执行 AI 交互：

```
localBridge WebSocket 推送任务
  {platform: "chatgpt", prompt: "请帮我翻译以下内容...", taskId: "abc123"}
        │
        ▼
background.ts 接收任务
  ├── 从 chrome.storage.local 读取 chatgpt 的凭证
  ├── 查找已打开的 chatgpt.com 标签页
  └── chrome.tabs.sendMessage(tabId, {type: 'EXECUTE_TASK', ...})
        │
        ▼
main_entrance.ts 接收指令
  ├── 使用已捕获的凭证构造 API 请求
  ├── fetch("https://chatgpt.com/backend-api/conversation", {
  │       method: "POST",
  │       headers: { "Authorization": "Bearer xxx", ... },
  │       body: JSON.stringify({
  │           model: "...",
  │           messages: [{role: "user", content: "请帮我翻译..."}],
  │           ...
  │       })
  │   })
  ├── 解析 SSE 流式响应，拼接完整回复
  └── chrome.runtime.sendMessage({type: 'TASK_RESULT', taskId: "abc123", result: "..."})
        │
        ▼
background.ts 将结果通过 WebSocket 回传给 localBridge
```

---

## 5. 三大 AI 平台适配细节

### 5.1 ChatGPT

| 项目 | 详情 |
|------|------|
| **域名** | `chatgpt.com`、`chat.openai.com` |
| **API 端点** | `POST https://chatgpt.com/backend-api/conversation` |
| **认证方式** | `Authorization: Bearer <access_token>`（从 fetch hook 捕获） + 浏览器自动携带 Cookie |
| **响应格式** | **SSE (Server-Sent Events)** 流式返回 |
| **流结束标记** | `data: [DONE]` |
| **请求体核心字段** | `model`, `messages` (含 `role` + `content`), `parent_message_id`, `conversation_id` |
| **需要拦截的关键请求** | 用户发送消息时的 conversation 请求（提取 Bearer Token、请求格式参考） |
| **特殊注意** | 每次对话需要 `parent_message_id`（UUID），新对话需生成，续对话需从上一条回复中获取 |

### 5.2 Gemini

| 项目 | 详情 |
|------|------|
| **域名** | `gemini.google.com` |
| **API 端点** | 需通过 fetch hook 实际捕获确认（预估为内部 RPC 端点） |
| **认证方式** | 基于 Google 账号 Cookie（`__Secure-1PSID` 等），浏览器自动携带 |
| **响应格式** | 自定义 JSON（非标准 SSE，可能为 Google 私有的流式协议） |
| **特殊注意** | Gemini 的 API 格式与公开的 Gemini API（`generativelanguage.googleapis.com`）不同，浏览器端使用的是 Google 内部 BFF 接口，需要实际抓包确认 |

### 5.3 Grok

| 项目 | 详情 |
|------|------|
| **域名** | `grok.com`、`x.com/i/grok` |
| **API 端点** | 需通过 fetch hook 实际捕获确认（预估为 `/rest/app-chat/conversations/...` 或类似路径） |
| **认证方式** | 基于 X (Twitter) 账号 Cookie，浏览器自动携带；可能还需 Bearer Token |
| **响应格式** | **SSE 流式返回**（与 ChatGPT 类似） |
| **特殊注意** | Grok 的浏览器端 API 与 xAI 公开 API（`api.x.ai`）不同，需实际抓包确认 |

### 5.4 平台适配策略

由于 Gemini 和 Grok 的浏览器端私有 API 格式尚未完全确认，我们采用以下渐进策略：

1. **Phase 1**：先实现 ChatGPT 的完整链路（凭证捕获 → 发送消息 → 接收回复），作为验证架构可行性的 PoC。
2. **Phase 2**：通过 injection.ts 的 fetch hook，实际抓包 Gemini 和 Grok 的请求/响应格式，记录到文档中。
3. **Phase 3**：基于已确认的 API 格式，分别实现 Gemini 和 Grok 的适配器。

---

## 6. 目录结构设计

```
aiClaw/
├── doc/                          ← 技术文档（你正在读的文件所在目录）
│   └── ARCHITECTURE.md
│
├── src/
│   ├── content/
│   │   └── main_entrance.ts      ← Layer 2: Content Script 入口
│   │
│   ├── service_work/
│   │   └── background.ts         ← Layer 3: Background Service Worker
│   │
│   ├── capture/                  ← 拦截层（参考 tweetClaw）
│   │   ├── injection.ts          ← Layer 1: MAIN world fetch/XHR hook
│   │   └── consts.ts             ← 监控的 API 操作名常量
│   │
│   ├── adapters/                 ← 平台适配器（核心业务逻辑）
│   │   ├── base-adapter.ts       ← 抽象基类：定义 sendMessage / parseResponse 接口
│   │   ├── chatgpt-adapter.ts    ← ChatGPT 平台适配器
│   │   ├── gemini-adapter.ts     ← Gemini 平台适配器
│   │   └── grok-adapter.ts       ← Grok 平台适配器
│   │
│   ├── types/                    ← TypeScript 类型定义
│   │   ├── task.ts               ← 任务相关类型（Task, TaskResult, ...）
│   │   └── platform.ts           ← 平台相关类型（PlatformType, Credentials, ...）
│   │
│   └── utils/                    ← 工具函数
│       ├── sse-parser.ts         ← SSE 流解析器（ChatGPT/Grok 共用）
│       └── platform-detector.ts  ← 基于 hostname 判断当前平台
│
├── dist/                         ← 浏览器加载目录（编译产物 + 静态资源）
│   ├── manifest.json
│   ├── images/
│   ├── vendor/
│   └── js/                       ← webpack 编译输出
│       ├── background.js
│       ├── content.js
│       └── injection.js
│
├── tests/
│   └── unit/
│
├── package.json
├── tsconfig.json
├── webpack.config.js
├── vitest.config.ts
├── bump_version.sh
├── zip.sh
└── README.md
```

---

## 7. 关键接口定义

### 7.1 平台适配器接口

```typescript
// src/adapters/base-adapter.ts

export type PlatformType = 'chatgpt' | 'gemini' | 'grok';

export interface Credentials {
    bearerToken?: string;       // Authorization header value
    cookies?: string;           // 由浏览器自动携带，通常不需手动管理
    apiEndpoint?: string;       // 已捕获的 API 端点 URL
    extraHeaders?: Record<string, string>;  // 平台特定的额外请求头
}

export interface SendMessageRequest {
    prompt: string;             // 用户 prompt 文本
    conversationId?: string;    // 续对话时传入
    parentMessageId?: string;   // ChatGPT 专用：续对话链
    model?: string;             // 指定模型（可选）
}

export interface SendMessageResponse {
    success: boolean;
    content: string;            // AI 回复的完整文本
    conversationId?: string;    // 对话 ID（用于续对话）
    messageId?: string;         // 消息 ID（用于建立父子关系）
    error?: string;             // 错误信息（如有）
    rawResponse?: any;          // 原始响应数据（调试用）
}

export abstract class BasePlatformAdapter {
    abstract readonly platform: PlatformType;

    /** 使用已捕获的凭证发送消息到 AI 平台 */
    abstract sendMessage(
        request: SendMessageRequest,
        credentials: Credentials
    ): Promise<SendMessageResponse>;

    /** 判断一个 URL 是否属于本平台需要拦截的 API */
    abstract isTargetApiUrl(url: string): boolean;

    /** 从拦截到的请求/响应中提取凭证 */
    abstract extractCredentials(
        url: string,
        requestHeaders: Record<string, string>,
        responseBody: any
    ): Partial<Credentials>;
}
```

### 7.2 任务协议

任务通过 WebSocket 从 localBridge 下发，格式定义：

```typescript
// src/types/task.ts

export interface Task {
    taskId: string;                 // 任务唯一 ID
    platform: PlatformType;         // 目标平台
    action: 'send_message';         // 动作类型（未来可扩展更多动作）
    payload: {
        prompt: string;             // Prompt 文本内容
        conversationId?: string;    // 可选：在已有对话中继续
        model?: string;             // 可选：指定模型
    };
    priority?: number;              // 优先级（可选）
    timeout?: number;               // 超时时间 ms（可选）
}

export interface TaskResult {
    taskId: string;
    success: boolean;
    platform: PlatformType;
    content?: string;               // AI 回复文本
    conversationId?: string;        // 对话 ID（方便后续续对话）
    error?: string;
    executedAt: string;             // ISO 8601 时间戳
    durationMs: number;             // 执行耗时
}
```

### 7.3 内部消息协议

扩展内部各层之间通过 `chrome.runtime.sendMessage` 和 `window.postMessage` 通信：

```typescript
// injection → content (via window.postMessage)
{
    source: 'aiclaw-injection',
    type: 'SIGNAL_CAPTURED',        // 捕获到 API 调用
    platform: PlatformType,
    apiUrl: string,
    method: string,
    bearerToken: string | null,
    requestBody: any,
    responseBody: any
}

// content → background (via chrome.runtime.sendMessage)
{
    type: 'CAPTURED_CREDENTIALS',   // 上报捕获的凭证
    platform: PlatformType,
    credentials: Partial<Credentials>
}

// background → content (via chrome.tabs.sendMessage)
{
    type: 'EXECUTE_TASK',           // 下发任务给对应平台的 tab
    task: Task
}

// content → background (via chrome.runtime.sendMessage)
{
    type: 'TASK_RESULT',            // 回传执行结果
    result: TaskResult
}
```

---

## 8. SSE 流解析方案

ChatGPT 和 Grok 均使用 SSE 流式返回，需要统一的解析方案：

```typescript
// src/utils/sse-parser.ts 设计思路

/**
 * 解析 SSE 流并拼接完整回复。
 * 
 * SSE 格式：
 *   data: {"message": {"content": {"parts": ["Hello"]}}, ...}\n\n
 *   data: {"message": {"content": {"parts": ["Hello world"]}}, ...}\n\n
 *   data: [DONE]\n\n
 * 
 * 使用 fetch + ReadableStream 逐行读取：
 *   const response = await fetch(url, options);
 *   const reader = response.body.getReader();
 *   const decoder = new TextDecoder();
 * 
 *   while (true) {
 *       const { done, value } = await reader.read();
 *       if (done) break;
 *       const chunk = decoder.decode(value, { stream: true });
 *       // 按行分割，解析每个 "data: ..." 行
 *   }
 */
```

---

## 9. 与 localBridge 的通信

### 9.1 WebSocket 连接

background.ts 作为 WebSocket 客户端连接到本地运行的 localBridge 服务：

```
ws://localhost:<port>/ws/aiclaw
```

端口和路径待根据 localBridge 的实际实现确认。

### 9.2 连接生命周期

```
扩展启动 → 尝试连接 localBridge
    ├── 连接成功 → 开始监听任务
    │    ├── 收到任务 → 调度执行 → 返回结果
    │    └── 心跳保活（防止 Service Worker 休眠）
    │
    └── 连接失败 → 定时重连（指数退避：1s → 2s → 4s → ... → 30s 封顶）
```

### 9.3 Service Worker 休眠问题

Manifest V3 的 Service Worker 会在空闲约 30 秒后被浏览器挂起。为保持 WebSocket 连接，需要使用以下策略：

- **chrome.alarms API**：每 25 秒触发一次 alarm，唤醒 Service Worker
- **心跳消息**：在 alarm 回调中向 localBridge 发送 ping，保持连接活跃
- **reconnect on wake**：如果 Service Worker 被杀后重新启动，检测并重新建立 WebSocket 连接

---

## 10. 开发路线图

### Phase 0 — 工程骨架搭建 ✅ 已完成
- [x] 目录结构
- [x] TypeScript + Webpack 编译链路
- [x] `dist/manifest.json` 配置
- [x] Content script 三平台注入验证

### Phase 1 — 凭证捕获链路 ✅ 已完成
- [x] 实现 `injection.ts`：fetch hook，识别并拦截三个平台的 API 请求
- [x] 增强鉴权头支持：支持 `Authorization` (Bearer), `x-csrf-token` (Grok), `x-goog-authuser` (Gemini)
- [x] 实现 `main_entrance.ts` 中的消息中继，增加 try-catch 提高稳定性
- [x] 实现 `background.ts` 中的凭证存储与**心跳活跃判定逻辑**
- [x] 验证：三大平台均能正确上报 `isLoggedIn` 状态（哪怕是 Cookie 鉴权平台）

### Phase 2 — ChatGPT 适配器 🏗️ 进行中
- [ ] 实现 `chatgpt-adapter.ts`：构造 conversation 请求 + 解析 SSE 响应
- [ ] 实现 `sse-parser.ts`：通用 SSE 流解析
- [ ] 端到端验证：通过 background 手动发送一条消息给 ChatGPT 并收到回复

### Phase 3 — WebSocket ↔ localBridge 🏗️ 部分完成
- [x] 实现 `background.ts` 中的 WebSocket 客户端，支持多端口动态重连
- [x] 实现 `query_ai_tabs_status` 协议，支持 Mac App 远程查询插件状态
- [ ] 实现任务调度逻辑（按 `platform` 字段分发到对应标签页）
- [x] 实现 Service Worker 保活机制（Alarm 唤醒）
- [x] 端到端验证：Mac App 成功显示 AIClaw 各平台登录与标签状态 (For Human 面板)

### Phase 4 — Gemini & Grok 适配器
- [ ] 抓包分析 Gemini 浏览器端 API 格式
- [ ] 抓包分析 Grok 浏览器端 API 格式
- [ ] 实现 `gemini-adapter.ts` 和 `grok-adapter.ts`
- [ ] 三平台全量端到端验证

### Phase 5 — 健壮性与生产化
- [ ] 错误处理与重试机制
- [ ] 凭证过期检测与刷新
- [ ] 多 tab 管理（同一平台多个标签页的竞争控制）
- [ ] 任务队列与并发控制
- [ ] 日志与调试面板

---

## 附录 A：tweetClaw 参考架构映射

aiClaw 的架构直接映射自 tweetClaw，以下是关键组件的对应关系：

| tweetClaw 组件 | aiClaw 对应组件 | 职责映射 |
|---------------|----------------|---------|
| `src/capture/injection.ts` | `src/capture/injection.ts` | fetch/XHR hook，捕获 API 凭证 |
| `src/capture/consts.ts` (watchedOps) | `src/capture/consts.ts` | 需要监控的 API 操作名列表 |
| `src/content/main_entrance.ts` | `src/content/main_entrance.ts` | 消息中继 + API 调用执行 |
| `src/service_work/background.ts` | `src/service_work/background.ts` | 状态管理 + 任务调度 |
| `src/capture/extractor.ts` | `src/adapters/*.ts` | 响应数据的解析与提取 |
| 无对应 | `src/utils/sse-parser.ts` | SSE 流解析（aiClaw 新增） |
| 无对应 | WebSocket ↔ localBridge | 任务领取（aiClaw 新增） |
