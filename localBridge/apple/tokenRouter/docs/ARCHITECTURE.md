# TokenRouter 系统架构文档

## 项目概述

TokenRouter 是一个多 AI 模型协调工作平台，旨在通过统一的接口调用不同的大语言模型（Claude、Gemini、Codex 等），并支持多角色 AI Agent 协同完成复杂任务。

## 核心设计理念

- **Provider 抽象**: 通过协议抽象统一不同 AI 服务的调用方式
- **角色分工**: 支持 PM、Developer、QA 等不同角色的 AI Agent 协作
- **流式响应**: 所有 Provider 均支持流式输出，提供实时反馈
- **统一配置**: 所有 HTTP Provider 使用 `base_url + api_key` 配置，兼容 CC Switch 等代理工具
- **安全存储**: 使用 macOS Keychain 安全存储 API Keys 和配置
- **可扩展性**: 易于添加新的 AI Provider 和角色类型

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Console Window   │  │ Settings Window  │                │
│  │  - Sidebar       │  │  - API Keys      │                │
│  │  - Workspace     │  │  - Preferences   │                │
│  │  - Chat View     │  └──────────────────┘                │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     ViewModel Layer                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ConsoleChatViewModel                                  │  │
│  │  - 消息管理                                            │  │
│  │  - 流式响应缓冲                                        │  │
│  │  - Provider 调度                                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Provider Layer                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ AIProviderProtocol                                    │  │
│  │  - stream(request: AIRequest)                         │  │
│  │  → AsyncThrowingStream<AIStreamEvent, Error>         │  │
│  └──────────────────────────────────────────────────────┘  │
│           │                  │                  │           │
│           ▼                  ▼                  ▼           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Anthropic    │  │ Gemini CLI   │  │ Codex App    │    │
│  │ HTTP Provider│  │ Provider     │  │ Server       │    │
│  │              │  │              │  │ Provider     │    │
│  │ - SSE Stream │  │ - Process    │  │ - JSON-RPC   │    │
│  │ - REST API   │  │ - JSONL      │  │ - stdin/out  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Infrastructure Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Keychain     │  │ SSE Parser   │  │ HTTP Client  │    │
│  │ Token Store  │  │              │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 核心模块

### 1. Provider 抽象层

#### AIProviderProtocol
定义统一的 AI 服务接口：

```swift
protocol AIProviderProtocol: Sendable {
    var id: ProviderID { get }
    var displayName: String { get }
    func stream(request: AIRequest) -> AsyncThrowingStream<AIStreamEvent, Error>
}
```

#### 支持的 Provider

| Provider | 类型 | 协议 | 用途 |
|---------|------|------|------|
| AnthropicHTTPProvider | HTTP API | REST + SSE | Claude 模型调用 |
| GeminiCLIProvider | CLI | Process + JSONL | Gemini 命令行工具 |
| CodexAppServerProvider | App Server | JSON-RPC | Codex 本地服务 |

### 2. 数据模型层

#### AIRole - 角色系统
```swift
enum AIRole {
    case pm         // 项目经理 - 需求分析、任务分配
    case developer  // 开发人员 - 代码实现
    case qa         // 质量保证 - 测试验收
}
```

#### AIType - 调用类型
```swift
enum AIType {
    case web  // Web 界面（模拟）
    case api  // HTTP API 调用
    case cli  // 命令行工具
}
```

#### AIAgent - Agent 实体
```swift
struct AIAgent {
    let id: String
    let name: String
    let role: AIRole
    let type: AIType
    var status: AIAgentStatus
    var messages: [AIMessage]
    var model: String?  // 例如: "claude-sonnet-4-20250514"
}
```

### 3. 流式响应处理

#### AIStreamEvent
```swift
enum AIStreamEvent {
    case start(messageID: UUID)           // 开始响应
    case delta(messageID: UUID, text: String)  // 增量文本
    case finish(messageID: UUID)          // 完成响应
    case log(String)                      // 日志信息
}
```

#### 缓冲优化
- 使用 `pendingDeltaBuffer` 缓冲增量文本
- 每 40ms 刷新一次 UI，避免过度渲染
- 支持取消和错误处理

### 4. UI 组件层

#### 主要视图控制器

| 控制器 | 职责 |
|--------|------|
| AIConsoleWindowController | 主窗口管理 |
| ConsoleSidebarViewController | 侧边栏导航 |
| ConsoleWorkspaceViewController | 工作空间路由 |
| ConsoleChatViewController | 聊天界面 |
| AISettingsViewController | 设置界面 |

#### 工作空间类型

- **PM Workspace**: 项目管理视图，任务分配
- **Dev Workspace**: 开发视图，代码实现
- **QA Workspace**: 测试视图，质量验收
- **Message Flow**: 消息流视图，跨 Agent 通信
- **AI Config**: AI 配置视图，模型参数设置

## 技术实现细节

### 1. HTTP Provider 实现（以 Anthropic 为例）

```swift
// 1. 从 Keychain 读取 Provider 配置
let configJSON = try keychain.load(key: KeychainTokenStore.anthropicConfig)
let config = try JSONDecoder().decode(ProviderConfig.self, from: configJSON.data(using: .utf8)!)

// 2. 构建 HTTP 请求（使用配置的 base_url）
let endpoint = "\(config.baseURL)/messages"
var urlRequest = URLRequest(url: URL(string: endpoint)!)
urlRequest.setValue(config.apiKey, forHTTPHeaderField: "x-api-key")
urlRequest.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

// 3. 解析 SSE 流
for try await event in sseClient.stream(request: urlRequest) {
    if eventType == "content_block_delta" {
        let text = json["delta"]["text"]
        continuation.yield(.delta(messageID: messageID, text: text))
    }
}
```

**配置示例**：
- 直连：`baseURL = "https://api.anthropic.com/v1"`
- CC Switch 代理：`baseURL = "http://localhost:8080/v1"`

### 2. GeminiCLIProvider 实现

```swift
// 1. 启动子进程
process.executableURL = URL(fileURLWithPath: "/opt/homebrew/bin/gemini")
process.arguments = [request.userText, "--output-format", "stream-json"]

// 2. 异步读取 stdout
stdoutPipe.fileHandleForReading.readabilityHandler = { handle in
    let chunk = handle.availableData
    // 按行解析 JSONL
    if let text = json["text"] as? String {
        continuation.yield(.delta(messageID: messageID, text: text))
    }
}
```

### 3. CodexAppServerProvider 实现

```swift
// 1. JSON-RPC 初始化握手
sendJSON(["jsonrpc": "2.0", "method": "initialize", ...], to: stdinPipe)

// 2. 等待 initialize 响应后发送 initialized 通知
sendJSON(["jsonrpc": "2.0", "method": "initialized", ...], to: stdinPipe)

// 3. 发起对话
sendJSON(["jsonrpc": "2.0", "method": "thread/start", ...], to: stdinPipe)

// 4. 处理通知事件
if method == "delta" {
    continuation.yield(.delta(messageID: messageID, text: text))
}
```

## 安全性设计

### Provider 配置模型

所有 HTTP Provider 使用统一的配置格式：

```swift
struct ProviderConfig {
    let baseURL: String      // API 端点或代理地址
    let apiKey: String       // API Key
    let model: String?       // 可选的模型名称
}
```

#### 配置示例

**直连模式**（直接调用官方 API）：
```swift
let anthropicConfig = ProviderConfig(
    baseURL: "https://api.anthropic.com/v1",
    apiKey: "sk-ant-xxxxx",
    model: "claude-sonnet-4-20250514"
)

let openAIConfig = ProviderConfig(
    baseURL: "https://api.openai.com/v1",
    apiKey: "sk-xxxxx",
    model: "gpt-4"
)
```

**代理模式**（通过 CC Switch 等工具）：
```swift
let ccSwitchConfig = ProviderConfig(
    baseURL: "http://localhost:8080/v1",  // CC Switch 本地代理
    apiKey: "managed-by-cc-switch",       // 任意值，由代理管理
    model: nil
)
```

### Keychain 集成

```swift
class KeychainTokenStore {
    // 存储完整的 Provider 配置
    static let anthropicConfig = "com.tokenrouter.anthropic.config"
    static let geminiConfig = "com.tokenrouter.gemini.config"
    static let openAIConfig = "com.tokenrouter.openai.config"

    func save(key: String, value: String) throws
    func load(key: String) throws -> String
    func delete(key: String) throws
}
```

### CC Switch 兼容性

TokenRouter 完全兼容 [CC Switch](https://github.com/farion1231/cc-switch) 等 API 代理工具：

**优势**：
- **统一管理**：所有 API Key 由 CC Switch 集中管理
- **快速切换**：通过 CC Switch 切换 Provider 无需修改 TokenRouter 配置
- **高级功能**：支持 token 自动刷新、负载均衡、使用量统计等
- **安全性**：TokenRouter 无需存储真实 API Key

**工作原理**：
```
TokenRouter → http://localhost:8080/v1/messages → CC Switch → 真实 API
            (配置代理地址)                        (管理真实 Key)
```

### 错误处理
```swift
enum AIProviderError: Error {
    case authRequired(details: String)   // 401/403
    case rateLimited(details: String)    // 429
    case transport(details: String)      // 网络错误
    case cancelled                       // 用户取消
}
```

## 扩展指南

### 添加新的 Provider

1. 创建新的 Provider 类，实现 `AIProviderProtocol`
2. 在 `ProviderID` 枚举中添加新的 ID
3. 在 `ConsoleChatViewController.sendMessage()` 中添加路由逻辑
4. 在 `KeychainTokenStore` 中添加对应的配置 key

示例：
```swift
final class OpenAIProvider: AIProviderProtocol {
    let id: ProviderID = .openai
    let displayName: String = "OpenAI GPT"
    private let config: ProviderConfig

    init(config: ProviderConfig) {
        self.config = config
    }

    func stream(request: AIRequest) -> AsyncThrowingStream<AIStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            Task {
                // 使用配置的 base_url 和 api_key
                let endpoint = "\(config.baseURL)/chat/completions"
                var urlRequest = URLRequest(url: URL(string: endpoint)!)
                urlRequest.setValue("Bearer \(config.apiKey)", forHTTPHeaderField: "Authorization")

                // 实现流式调用逻辑
            }
        }
    }
}
```

### 添加新的角色

1. 在 `AIRole` 枚举中添加新角色
2. 定义角色的 `label`、`emoji`、`color`
3. 在工作空间中创建对应的视图控制器

## 性能优化

- **流式缓冲**: 40ms 刷新间隔，减少 UI 重绘
- **异步处理**: 使用 Swift Concurrency (async/await)
- **进程管理**: CLI Provider 正确处理 stderr，防止缓冲区阻塞
- **内存管理**: 使用 `weak self` 避免循环引用

## 未来规划

- [ ] 支持多轮对话上下文管理
- [ ] Agent 间消息路由和协作机制
- [ ] 任务状态持久化
- [ ] 支持更多 AI Provider (OpenAI, Cohere, etc.)
- [ ] 插件系统，支持自定义 Provider
- [ ] 分布式部署，支持远程 Agent

## 依赖项

- macOS 13.0+
- Swift 5.9+
- AppKit
- Foundation
- Security (Keychain)

## 许可证

[待定]

---

**文档版本**: 1.0
**最后更新**: 2026-03-19
**维护者**: wesley
