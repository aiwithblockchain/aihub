# LocalBridge 架构设计文档

> **重要提示：** AI 开始工作前必须先阅读本文档，以快速理解项目设计目标和当前进展。

---

## 项目概述

LocalBridge 是一个跨平台的本地 Hub 软件，运行在 Mac 和 Windows 上，作为 AI 与本地应用之间的桥梁。它的核心功能是将本地应用（通过 WebSocket 协议连接）的能力转换为标准的 REST API，供外部 AI（如 OpenClaw）调用。

---

## 设计目标

### 核心理念

**LocalBridge = WebSocket Hub + REST API Gateway**

```
┌─────────────────────────────────────────────────────────────┐
│                         外部 AI                              │
│                    (OpenClaw, Claude, etc.)                  │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
                         │ (HTTP/JSON)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      LocalBridge Hub                         │
│                   (Mac / Windows 本地软件)                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  REST API Server (端口: 10088)                        │  │
│  │  - 接收外部 AI 的 HTTP 请求                            │  │
│  │  - 遵循 REST 设计规范 (见 API_DESIGN_RULES.md)        │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│                     │ 驱动转换层                              │
│                     │ (WebSocket ↔ REST 协议转换)            │
│                     │                                        │
│  ┌──────────────────▼───────────────────────────────────┐  │
│  │  WebSocket Server                                     │  │
│  │  - 管理与本地应用的 WebSocket 连接                      │  │
│  │  - 维护连接状态和消息路由                               │  │
│  └──────────────────┬───────────────────────────────────┘  │
└────────────────────┬┴───────────────────────────────────────┘
                     │ WebSocket
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  aiClaw      │ │ tweetClaw    │ │  其他应用     │
│ (浏览器插件)  │ │ (浏览器插件)  │ │  (未来支持)   │
└──────────────┘ └──────────────┘ └──────────────┘
```

### 关键特性

1. **协议转换**：将 WebSocket 双向通信转换为标准的 REST API
2. **驱动机制**：通过导入驱动定义 WebSocket ↔ REST API 的映射关系
3. **跨平台**：支持 Mac 和 Windows
4. **可扩展**：任何遵循规范的应用都可以接入

---

## 当前开发阶段

### ✅ 已完成

- **Mac 平台 Hub 软件**：LocalBridgeMac 应用
- **官方浏览器插件**：
  - [aiClaw](../aiClaw/)：通用 AI 浏览器交互插件
  - [tweetClaw](../tweetClaw/)：Twitter/X 专用交互插件
- **WebSocket 通信**：Hub 与浏览器插件的双向通信
- **REST API 基础框架**：HTTP 服务器和路由
- **测试工具**：[clawBotCli](clawBotCli/) - Python 测试客户端

### 🚧 当前阶段

**打通自有生态**：确保 LocalBridge Hub 与官方浏览器插件（aiClaw、tweetClaw）完全集成和稳定运行。

### 📋 未来计划

1. **驱动导入机制**：允许用户导入第三方应用的驱动
2. **Windows 平台支持**：开发 Windows 版本的 Hub 软件
3. **第三方应用接入**：开放协议规范，支持社区开发的应用接入

---

## 目录结构

```
localBridge/
├── ARCHITECTURE.md              # 本文件 - 架构设计文档
├── API_DESIGN_RULES.md          # REST API 设计规范（强制遵守）
├── AGENTS.md                    # AI Agent 工作规范
│
├── apple/                       # Mac 平台实现
│   └── tokenRouter/             # ⚠️ AI Token 路由工具（实验性）
│                                # 用于 AI Hub 功能的 token 管理和路由
│                                # 注意：该工程未来可能被移除或重构
│
├── windows/                     # Windows 平台实现（待开发）
│
├── clawBotCli/                  # Python 测试工具
│   ├── tests/                   # API 测试脚本
│   └── utils/                   # 测试工具库
│
├── go-lib/                      # Go 共享库
├── android/                     # Android 支持（未来）
└── rest-api-governance/         # API 治理文档
```

---

## 核心概念

### 1. 浏览器插件（本地应用）

**官方插件：**

- **[aiClaw](../aiClaw/)**：通用浏览器交互插件
  - 目的：让 AI 与任意网站交互，无需截图或读取完整 DOM
  - 功能：提供结构化的页面数据和交互能力

- **[tweetClaw](../tweetClaw/)**：Twitter/X 专用插件
  - 目的：让 AI 直接操作 Twitter，获取原始 GraphQL 数据
  - 功能：发推、点赞、转发、搜索、获取用户信息等

**为什么需要浏览器插件？**

传统方式让 AI 与网站交互需要：
- 截图 → 视觉识别 → 操作（慢、不准确、成本高）
- 读取完整 DOM → 解析 → 操作（数据量大、噪音多）

浏览器插件方式：
- 直接提供结构化数据（JSON）
- 精确的交互能力（API 调用）
- 低延迟、低成本

### 2. WebSocket 通信

浏览器插件通过 WebSocket 与 LocalBridge Hub 保持长连接：

```javascript
// 浏览器插件连接到 Hub
const ws = new WebSocket('ws://localhost:10088/ws');

// 发送消息到 Hub
ws.send(JSON.stringify({
  type: 'response',
  taskId: 'task_123',
  data: { /* 结构化数据 */ }
}));

// 接收来自 Hub 的任务
ws.onmessage = (event) => {
  const task = JSON.parse(event.data);
  // 执行任务并返回结果
};
```

### 3. REST API 服务

LocalBridge Hub 将 WebSocket 能力暴露为 REST API：

```http
# AI 调用 REST API
POST /api/v1/tasks HTTP/1.1
Host: localhost:10088
Content-Type: application/json

{
  "type": "get_user_info",
  "params": {
    "username": "elonmusk"
  }
}

# Hub 返回结果
HTTP/1.1 201 Created
Location: /api/v1/tasks/task_123

{
  "id": "task_123",
  "status": "completed",
  "result": {
    "user": {
      "id": "44196397",
      "name": "Elon Musk",
      "followers_count": 200000000
    }
  }
}
```

### 4. 驱动机制（未来）

驱动定义了 WebSocket 消息与 REST API 的映射关系：

```yaml
# 示例驱动配置
driver:
  name: tweetClaw
  version: 1.0.0

  mappings:
    - rest_endpoint: POST /api/v1/tweets
      websocket_message:
        type: publish_tweet
        params_mapping:
          text: $.body.text
          media: $.body.media

    - rest_endpoint: GET /api/v1/users/{username}
      websocket_message:
        type: get_user_info
        params_mapping:
          username: $.path.username
```

---

## REST API 设计规范

**⚠️ 强制要求：** 所有 REST API 必须遵循 [API_DESIGN_RULES.md](API_DESIGN_RULES.md)

### 核心原则

1. **资源导向**：URI 表达资源，不是动作
   - ✅ `GET /api/v1/tasks/{taskId}`
   - ❌ `POST /api/v1/get-task-status`

2. **标准 HTTP 方法**：
   - `GET`：读取资源
   - `POST`：创建资源
   - `PATCH`：部分更新
   - `DELETE`：删除资源

3. **统一前缀**：`/api/v1/`

4. **正确的状态码**：
   - `200 OK`：成功
   - `201 Created`：创建成功
   - `400 Bad Request`：参数错误
   - `404 Not Found`：资源不存在
   - `500 Internal Server Error`：服务器错误

5. **统一的错误响应**：
   ```json
   {
     "error": {
       "code": "INVALID_ARGUMENT",
       "message": "limit must be <= 100",
       "details": null
     }
   }
   ```

---

## 测试工具

### clawBotCli

Python 测试客户端，用于测试 LocalBridge REST API。

**安装：**
```bash
cd clawBotCli
pip install -r requirements.txt
```

**使用：**
```bash
# 测试所有 API
python test_all.py

# 测试特定功能
python tests/test_status.py
python tests/test_read_apis.py
python tests/test_write_apis.py
```

**前置条件：**
1. LocalBridgeMac 应用正在运行
2. 浏览器已加载 tweetClaw 插件
3. 浏览器已登录 Twitter/X 账号

详见：[clawBotCli/README.md](clawBotCli/README.md)

---

## 开发指南

### 新增 REST API

1. **阅读规范**：先读 [API_DESIGN_RULES.md](API_DESIGN_RULES.md)
2. **设计资源模型**：确定资源名称和层级关系
3. **定义 endpoint**：URI、HTTP 方法、请求/响应格式
4. **实现协议转换**：WebSocket 消息与 REST API 的映射
5. **编写测试**：在 clawBotCli 中添加测试用例
6. **更新文档**：同步更新 API 文档

### 接入新应用

**当前阶段：** 仅支持官方插件（aiClaw、tweetClaw）

**未来支持：**
1. 定义 WebSocket 消息协议
2. 编写驱动配置文件
3. 在 Hub 中导入驱动
4. 测试协议转换
5. 发布驱动供其他用户使用

---

## 技术栈

### Mac 平台（apple/tokenRouter）
- **语言**：Swift
- **框架**：SwiftUI, Combine
- **WebSocket**：原生 URLSessionWebSocketTask
- **HTTP Server**：自定义实现

### 浏览器插件
- **语言**：TypeScript
- **构建工具**：Webpack
- **框架**：Chrome Extension Manifest V3

### 测试工具（clawBotCli）
- **语言**：Python 3.x
- **HTTP 客户端**：requests

---

## 相关文档

### 必读文档
- [API_DESIGN_RULES.md](API_DESIGN_RULES.md) - REST API 设计规范（强制）
- [AGENTS.md](AGENTS.md) - AI Agent 工作规范

### 参考文档
- [clawBotCli/README.md](clawBotCli/README.md) - 测试工具使用说明
- [rest-api-governance/](rest-api-governance/) - API 治理文档
- [../aiClaw/README.md](../aiClaw/README.md) - aiClaw 插件说明
- [../tweetClaw/README.md](../tweetClaw/README.md) - tweetClaw 插件说明

---

## 常见问题

### Q: LocalBridge 与传统 API 代理有什么区别？

A: LocalBridge 不是简单的 API 代理，而是：
- **本地运行**：无需云服务，数据不离开本地
- **协议转换**：WebSocket ↔ REST API
- **可扩展**：通过驱动机制支持任意应用
- **AI 友好**：专为 AI 调用设计的 REST API

### Q: 为什么不直接让 AI 调用 WebSocket？

A: 因为：
- REST API 更标准、更易用
- 大多数 AI 平台（OpenAI、Anthropic）只支持 HTTP 工具调用
- REST API 更容易做权限控制、日志、监控

### Q: 驱动机制什么时候可用？

A: 当前阶段专注于打通官方插件，驱动机制将在后续版本中实现。

### Q: 如何贡献代码？

A: 当前处于内部开发阶段，暂不接受外部贡献。未来会开放驱动开发和第三方应用接入。

---

## 联系方式

- **项目仓库**：（待公开）
- **问题反馈**：（待公开）

---

*最后更新：2026-03-24*
