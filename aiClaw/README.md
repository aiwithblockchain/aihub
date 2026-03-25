# AiClaw - 通用 AI 平台交互插件

> **重要提示：** AiClaw 是支持 LocalBridge AI Hub 的通用浏览器扩展，专为与主流 AI 对话平台（ChatGPT、Gemini、Grok）交互而设计。

---

## 项目概述

AiClaw 是一个 Chrome 浏览器扩展，作为"浏览器端 AI 代理集线器"，让外部 AI 能够通过 [LocalBridge Hub](../localBridge/) 与 ChatGPT、Google Gemini 和 xAI Grok 进行自动化交互。它利用用户已登录的浏览器会话，无需 API Key，直接与 AI 平台的网页界面交互。

---

## 设计目标

### 核心理念

**让 AI 控制 AI —— 通过浏览器实现 AI 平台的自动化协作**

```
┌─────────────────────────────────────────────────────────────┐
│                         外部 AI                              │
│                    (OpenClaw, Claude, etc.)                  │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   LocalBridge Hub                            │
│                   (本地 WebSocket 服务)                       │
└────────────────────────┬────────────────────────────────────┘
                         │ WebSocket
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      AiClaw                                  │
│                   (Chrome 浏览器扩展)                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Content Script                                       │  │
│  │  - 注入到 AI 平台页面                                  │  │
│  │  - 监听 DOM 变化                                       │  │
│  │  - 模拟用户输入和点击                                  │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│  ┌──────────────────▼───────────────────────────────────┐  │
│  │  Background Service Worker                            │  │
│  │  - 管理 WebSocket 连接                                 │  │
│  │  - 处理任务队列                                        │  │
│  │  - 平台适配器路由                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Platform Adapters                                    │  │
│  │  - ChatGPT Adapter: DOM 操作 + ProseMirror           │  │
│  │  - Gemini Adapter: DOM 操作 + 响应捕获                │  │
│  │  - Grok Adapter: DOM 操作 + 响应捕获                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              AI 平台网站                                      │
│   ChatGPT (chatgpt.com) | Gemini (gemini.google.com)       │
│   Grok (grok.com, x.com/i/grok)                             │
└─────────────────────────────────────────────────────────────┘
```

### 为什么需要 AiClaw？

**传统方式的问题：**
- **官方 API**：需要 API Key、有限流限制、成本高
- **截图 + 视觉识别**：慢、不准确、成本高
- **手动操作**：无法自动化、效率低

**AiClaw 的优势：**
- **无需 API Key**：使用浏览器会话，利用用户已登录的账号
- **真实用户体验**：模拟真实用户操作，不受 API 限制
- **多平台支持**：同时支持 ChatGPT、Gemini、Grok 三大平台
- **自动化协作**：让外部 AI 能够调度和协调多个 AI 平台
- **本地运行**：所有数据在本地处理，保护隐私

---

## 核心功能

### 支持的 AI 平台

- **ChatGPT**：OpenAI 的对话 AI（chatgpt.com, chat.openai.com）
- **Google Gemini**：Google 的对话 AI（gemini.google.com）
- **xAI Grok**：xAI 的对话 AI（grok.com, x.com/i/grok）

### 主要操作

#### 查询类操作

- **查询标签页状态**：检查哪些 AI 平台的标签页已打开
- **获取平台信息**：查询当前会话状态、可用性

#### 导航类操作

- **打开 AI 平台**：自动打开指定 AI 平台的标签页
- **切换标签页**：在不同 AI 平台之间切换

#### 交互类操作

- **发送消息**：向 AI 平台发送提示词（Prompt）
- **获取响应**：捕获 AI 平台的回复内容
- **等待完成**：监听 AI 生成状态，等待响应完成

---

## 技术架构

### 技术栈

- **语言**：TypeScript
- **构建工具**：Webpack 5
- **扩展框架**：Chrome Extension Manifest V3
- **WebSocket 客户端**：原生 WebSocket API
- **依赖库**：
  - `webextension-polyfill`：跨浏览器兼容性

### 目录结构

```
aiClaw/
├── README.md                    # 本文件
├── package.json                 # 项目配置
├── tsconfig.json                # TypeScript 配置
├── webpack.config.js            # Webpack 构建配置
│
├── src/                         # 源代码目录
│   ├── service_work/            # Background Service Worker
│   │   └── background.ts        # 管理 WebSocket 连接和任务队列
│   │
│   ├── content/                 # Content Script
│   │   ├── main_entrance.ts     # 主入口，注入到 AI 平台页面
│   │   └── composer-spy.ts      # 监听输入框和响应
│   │
│   ├── popup/                   # 扩展弹窗 UI
│   │   └── popup.ts             # 显示连接状态和调试信息
│   │
│   ├── adapters/                # 平台适配器
│   │   ├── base-adapter.ts      # 适配器基类
│   │   ├── chatgpt-adapter.ts   # ChatGPT 平台适配器
│   │   ├── gemini-adapter.ts    # Gemini 平台适配器
│   │   └── grok-adapter.ts      # Grok 平台适配器
│   │
│   ├── bridge/                  # WebSocket 桥接
│   │   ├── local-bridge-socket.ts  # WebSocket 连接管理
│   │   ├── ws-protocol.ts       # 协议定义
│   │   └── instance-id.ts       # 实例 ID 管理
│   │
│   ├── capture/                 # 数据捕获
│   │   ├── injection.ts         # 注入脚本
│   │   └── consts.ts            # 常量定义
│   │
│   ├── storage/                 # 数据存储
│   │   └── credentials-store.ts # 凭证存储
│   │
│   └── utils/                   # 工具函数
│       └── sse-parser.ts        # SSE 解析器
│
└── dist/                        # 构建输出目录
    ├── manifest.json            # 扩展清单文件
    ├── js/                      # 编译后的 JavaScript
    ├── popup.html               # 弹窗 HTML
    └── images/                  # 图标和图片
```

---

## 平台适配器详解

### ChatGPT Adapter

**技术方案：** DOM 操作 + ProseMirror

**关键实现：**
- 输入框是 ProseMirror contenteditable div（`#prompt-textarea`）
- 使用 `document.execCommand('insertText')` 输入文本
- 发送/停止按钮是同一个按钮，通过 `data-testid` 属性切换
  - 空闲状态：`[data-testid="send-button"]`
  - 生成中：`[data-testid="stop-button"]`
- 响应提取：查询 `[data-message-author-role="assistant"]` 获取最后一条消息

**时序流程：**
```
1. focus() 输入框
2. 输入文本 → 发送按钮出现
3. 点击发送 → data-testid 切换为 stop-button
4. 等待生成完成 → data-testid 切换回 send-button
5. 提取 assistant 消息
```

### Gemini Adapter

**技术方案：** DOM 操作 + 响应捕获

**关键实现：**
- 输入框：`rich-textarea` 组件
- 发送按钮：动态查询可点击的按钮元素
- 响应捕获：监听 DOM 变化，提取生成的内容

### Grok Adapter

**技术方案：** DOM 操作 + 响应捕获

**关键实现：**
- 支持两个入口：grok.com 和 x.com/i/grok
- 输入框和按钮的 DOM 结构与 ChatGPT 类似
- 响应提取：监听消息容器的变化

---

## 安装和使用

### 前置条件

1. **Chrome 浏览器**（或基于 Chromium 的浏览器）
2. **LocalBridge Hub**：必须先安装并运行 [LocalBridge](../localBridge/)
3. **AI 平台账号**：需要在浏览器中登录 ChatGPT、Gemini 或 Grok

### 构建扩展

```bash
# 安装依赖
npm install

# 开发模式构建
npm run build:d

# 生产模式构建
npm run build:r
```

### 加载到浏览器

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `aiClaw/dist/` 目录

### 连接到 LocalBridge

1. 确保 LocalBridge Hub 正在运行（默认端口：8765）
2. 点击浏览器工具栏中的 AiClaw 图标
3. 在弹窗中查看连接状态
4. 如果显示"已连接"，则可以开始使用

---

## WebSocket 协议

### 连接信息

- **默认地址**：`ws://127.0.0.1:8765/`
- **协议名称**：`aihub-localbridge`
- **协议版本**：`v1`
- **数据格式**：JSON

### 消息类型

#### 握手消息

**客户端 Hello：**
```json
{
  "id": "msg_123",
  "type": "client.hello",
  "source": "aiClaw",
  "target": "LocalBridgeMac",
  "timestamp": 1234567890,
  "payload": {
    "clientVersion": "0.2.9",
    "protocolVersion": "v1",
    "instanceId": "aiClaw_abc123"
  }
}
```

**服务端 Hello Ack：**
```json
{
  "id": "msg_124",
  "type": "server.hello_ack",
  "source": "LocalBridgeMac",
  "target": "aiClaw",
  "timestamp": 1234567891,
  "payload": {
    "serverVersion": "1.0.0",
    "accepted": true
  }
}
```

#### 查询标签页状态

**请求：**
```json
{
  "id": "msg_125",
  "type": "request.query_ai_tabs_status",
  "source": "LocalBridgeMac",
  "target": "aiClaw",
  "timestamp": 1234567892,
  "payload": {}
}
```

**响应：**
```json
{
  "id": "msg_126",
  "type": "response.query_ai_tabs_status",
  "source": "aiClaw",
  "target": "LocalBridgeMac",
  "timestamp": 1234567893,
  "payload": {
    "tabs": [
      {
        "tabId": 123,
        "url": "https://chatgpt.com/",
        "platform": "chatgpt",
        "active": true
      },
      {
        "tabId": 456,
        "url": "https://gemini.google.com/",
        "platform": "gemini",
        "active": false
      }
    ]
  }
}
```

#### 执行任务

**请求：**
```json
{
  "id": "msg_127",
  "type": "request.execute_task",
  "source": "LocalBridgeMac",
  "target": "aiClaw",
  "timestamp": 1234567894,
  "payload": {
    "taskId": "task_001",
    "platform": "chatgpt",
    "action": "send_message",
    "params": {
      "message": "What is the capital of France?"
    }
  }
}
```

**响应：**
```json
{
  "id": "msg_128",
  "type": "response.execute_task_result",
  "source": "aiClaw",
  "target": "LocalBridgeMac",
  "timestamp": 1234567900,
  "payload": {
    "taskId": "task_001",
    "status": "success",
    "result": {
      "response": "The capital of France is Paris.",
      "platform": "chatgpt",
      "timestamp": 1234567900
    }
  }
}
```

#### 导航到平台

**请求：**
```json
{
  "id": "msg_129",
  "type": "request.navigate_to_platform",
  "source": "LocalBridgeMac",
  "target": "aiClaw",
  "timestamp": 1234567895,
  "payload": {
    "platform": "gemini",
    "url": "https://gemini.google.com/"
  }
}
```

**响应：**
```json
{
  "id": "msg_130",
  "type": "response.navigate_result",
  "source": "aiClaw",
  "target": "LocalBridgeMac",
  "timestamp": 1234567896,
  "payload": {
    "success": true,
    "tabId": 789,
    "url": "https://gemini.google.com/"
  }
}
```

#### 错误响应

```json
{
  "id": "msg_131",
  "type": "response.error",
  "source": "aiClaw",
  "target": "LocalBridgeMac",
  "timestamp": 1234567897,
  "payload": {
    "error": {
      "code": "PLATFORM_NOT_AVAILABLE",
      "message": "ChatGPT tab is not open or not logged in"
    }
  }
}
```

---

## 支持的任务类型

### 标签页管理

- `query_ai_tabs_status`：查询所有 AI 平台标签页的状态
- `navigate_to_platform`：打开或切换到指定 AI 平台

### 消息交互

- `send_message`：向 AI 平台发送消息
  - 参数：`platform`（chatgpt/gemini/grok）、`message`（消息内容）
  - 返回：AI 平台的响应内容

---

## 开发指南

### 本地开发

```bash
# 安装依赖
npm install

# 开发模式构建（带 source map）
npm run build:d

# 监听文件变化（需要手动刷新扩展）
npm run build:d -- --watch

# 运行测试
npm test
```

### 调试技巧

1. **查看 Service Worker 日志**：
   - 访问 `chrome://extensions/`
   - 找到 AiClaw，点击"Service Worker"
   - 在 DevTools 中查看日志

2. **查看 Content Script 日志**：
   - 打开 AI 平台页面
   - 按 F12 打开 DevTools
   - 在 Console 中查看日志

3. **查看扩展弹窗**：
   - 点击工具栏中的 AiClaw 图标
   - 查看连接状态和最近的任务

### 添加新平台支持

1. **创建平台适配器**：在 `src/adapters/` 中创建新的适配器类
2. **继承基类**：继承 `BasePlatformAdapter` 并实现必要的方法
3. **注册适配器**：在 `background.ts` 中注册新的适配器
4. **更新 manifest.json**：添加新平台的 URL 匹配规则
5. **测试**：在新平台上测试发送消息和获取响应

---

## 测试

### 手动测试

1. 确保 LocalBridge Hub 正在运行
2. 加载 AiClaw 扩展到浏览器
3. 在浏览器中登录 AI 平台（ChatGPT、Gemini 或 Grok）
4. 打开 AI 平台的标签页
5. 通过 LocalBridge REST API 发送测试任务

### 自动化测试

```bash
# 运行单元测试
npm test
```

---

## 版本历史

- **v0.2.9**（当前版本）：
  - 完善 WebSocket 连接管理
  - 优化平台适配器
  - 改进错误处理
  - 更新 UI

- **v0.2.x**：
  - 实现三大平台的基础支持
  - 添加任务队列管理
  - 集成 LocalBridge Hub

- **v0.1.x**：
  - 初始版本
  - 基础的 DOM 操作和消息捕获

---

## 限制和注意事项

### 当前限制

1. **仅支持 Chrome**：基于 Manifest V3，暂不支持 Firefox
2. **需要登录**：必须在浏览器中登录 AI 平台账号
3. **单会话**：一个浏览器实例只能连接一个 LocalBridge Hub
4. **本地运行**：不支持远程连接，仅限 localhost
5. **DOM 依赖**：依赖 AI 平台的 DOM 结构，平台更新可能导致失效

### 使用注意事项

1. **遵守平台规则**：不要用于违反 AI 平台服务条款的行为
2. **频率限制**：注意请求频率，避免触发平台的反滥用机制
3. **数据隐私**：所有数据在本地处理，不会上传到云端
4. **账号安全**：建议使用测试账号进行开发和测试
5. **稳定性**：AI 平台的 DOM 结构可能随时变化，需要及时更新适配器

---

## 故障排查

### 连接失败

**问题**：AiClaw 无法连接到 LocalBridge Hub

**解决方案**：
1. 确认 LocalBridge Hub 正在运行
2. 检查端口配置（默认 8765）
3. 查看 Service Worker 日志中的错误信息
4. 尝试重启浏览器和 LocalBridge Hub

### 任务执行失败

**问题**：发送消息后没有响应或返回错误

**解决方案**：
1. 确认已在浏览器中登录 AI 平台账号
2. 检查 AI 平台页面是否正常加载
3. 查看 Content Script 日志中的错误
4. 尝试手动在 AI 平台页面发送消息，确认功能可用
5. 检查平台适配器是否需要更新（AI 平台可能更新了 DOM 结构）

### 标签页状态异常

**问题**：查询标签页状态返回空或错误信息

**解决方案**：
1. 确认 AI 平台标签页已打开
2. 刷新 AI 平台页面
3. 检查 Content Script 是否正确注入
4. 查看浏览器控制台是否有错误

### 响应捕获失败

**问题**：无法获取 AI 平台的响应内容

**解决方案**：
1. 检查 AI 平台是否正常生成响应
2. 查看 Content Script 日志，确认 DOM 监听是否正常
3. 手动测试：在 AI 平台页面发送消息，观察 DOM 变化
4. 更新平台适配器以匹配最新的 DOM 结构

---

## 相关项目

- **[LocalBridge](../localBridge/)**：AI Hub 核心服务
- **[TweetClaw](../tweetClaw/)**：Twitter/X AI 交互插件
- **[clawBotCli](../localBridge/clawBotCli/)**：REST API 测试工具

---

## 与 TweetClaw 的区别

| 特性 | AiClaw | TweetClaw |
|------|--------|-----------|
| **目标平台** | AI 对话平台（ChatGPT、Gemini、Grok） | Twitter/X 社交平台 |
| **交互方式** | DOM 操作 + 响应捕获 | GraphQL API 拦截 |
| **数据格式** | 文本对话内容 | 结构化 JSON 数据 |
| **主要用途** | AI 协作和自动化 | 社交媒体数据获取和操作 |
| **技术复杂度** | 中等（DOM 操作） | 高（API 拦截和解析） |

---

## 贡献指南

当前处于内部开发阶段，暂不接受外部贡献。未来会开放源代码和贡献流程。

---

## 许可证

详见项目根目录的 [LICENSE](../LICENSE) 文件。

---

## 联系方式

- **项目仓库**：（待公开）
- **问题反馈**：（待公开）

---

*最后更新：2026-03-25*
*版本：v0.2.9*
