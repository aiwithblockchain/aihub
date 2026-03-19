# CC Switch 机制详解

## 核心机制：环境变量劫持

CC Switch 通过修改 Claude Code 配置文件中的环境变量，将 IDE 插件的 API 请求重定向到代理服务器。

### 配置文件位置

```
~/.claude/settings.json
```

### 配置示例

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-6b5c75e5936bdf29226a90ac11ba1ec46248eee8b7af7ca01cf609fa9e355e10",
    "ANTHROPIC_BASE_URL": "https://api.lycloud.top"
  }
}
```

## 完整的流量走向和交互过程

### 1. 原始状态（未使用 cc switch）

```
VSCode 插件 (Claude Code Extension)
    ↓
读取默认配置
    ↓
ANTHROPIC_AUTH_TOKEN = 你的官方 API Key
ANTHROPIC_BASE_URL = https://api.anthropic.com
    ↓
发起 HTTPS 请求
    ↓
POST https://api.anthropic.com/v1/messages
Header: x-api-key: sk-ant-xxxxx
    ↓
Anthropic 官方服务器验证并响应
```

### 2. 使用 cc switch 后的状态

```
VSCode 插件 (Claude Code Extension)
    ↓
读取配置文件 ~/.claude/settings.json
    ↓
发现环境变量覆盖：
  ANTHROPIC_AUTH_TOKEN = sk-6b5c75e5...（cc switch 配置的代理 Key）
  ANTHROPIC_BASE_URL = https://api.lycloud.top（代理服务器地址）
    ↓
插件内部的 HTTP 客户端使用这些环境变量
    ↓
发起 HTTPS 请求（插件代码不变，只是目标地址变了）
    ↓
POST https://api.lycloud.top/v1/messages
Header: x-api-key: sk-6b5c75e5...
    ↓
代理服务器 (api.lycloud.top) 接收请求
    ↓
代理服务器根据你的 Key 查找对应的真实 API Key
    ↓
代理服务器转发请求到 Anthropic 官方
    ↓
POST https://api.anthropic.com/v1/messages
Header: x-api-key: sk-ant-真实的官方Key
    ↓
Anthropic 官方服务器响应
    ↓
代理服务器接收响应
    ↓
代理服务器返回给 VSCode 插件
    ↓
VSCode 插件显示结果给用户
```

## 关键技术细节

### 1. 插件如何读取配置

VSCode 的 Claude Code 插件在启动时会：
- 读取 `~/.claude/settings.json` 中的 `env` 字段
- 将这些环境变量注入到插件的运行环境中
- 插件内部的 Anthropic SDK 客户端会自动读取这些环境变量

### 2. 为什么插件不需要修改代码

因为 Anthropic 官方 SDK 的设计就支持这种配置方式：

```typescript
// 插件内部的代码（伪代码）
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN,  // 从环境变量读取
  baseURL: process.env.ANTHROPIC_BASE_URL    // 从环境变量读取
});

// 发起请求
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  messages: [...]
});
```

### 3. cc switch 做了什么

`cc switch` 命令实际上是：
1. 管理多个 Provider 配置（存储在 cc switch 的数据库中）
2. 当你执行 `cc switch <provider-name>` 时
3. 它会修改 `~/.claude/settings.json` 文件
4. 将选中的 Provider 的 `API Key` 和 `Base URL` 写入 `env` 字段
5. VSCode 插件检测到配置文件变化后重新加载配置

### 4. 网络层面的实际交互

```
你的电脑 (VSCode)
    ↓ TLS 加密连接
代理服务器 (api.lycloud.top:443)
    ↓ TLS 加密连接
Anthropic 官方 (api.anthropic.com:443)
```

**重要：** 插件本身不知道中间有代理，它只是按照配置的 Base URL 发送请求。

## 为什么这个机制有效

1. **标准化的 API 协议**：Anthropic Messages API 是标准的 REST API
2. **环境变量注入**：插件支持通过环境变量配置 API 端点
3. **代理服务器兼容**：代理服务器实现了与官方 API 完全相同的接口
4. **透明转发**：代理服务器只是转发请求，不改变协议格式

## 工作流程图

```
┌─────────────────────────────────────────────────────────────┐
│                     用户执行命令                              │
│                  cc switch <provider>                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              cc switch 修改配置文件                           │
│         ~/.claude/settings.json 的 env 字段                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            VSCode 插件检测到配置变化                          │
│              重新加载环境变量                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│          插件使用新的 Base URL 和 API Key                     │
│         发送请求到代理服务器而非官方 API                       │
└─────────────────────────────────────────────────────────────┘
```

## 总结

**cc switch 的本质是通过修改配置文件中的环境变量，将 IDE 插件的 API 请求重定向到代理服务器，而插件本身完全不知道这个变化，它只是按照配置的地址发送标准的 HTTP 请求。**

这就是为什么在安装了 cc switch 之后，IDE 插件不再走原来的配置和授权，而成了一个走向其它服务的客户端——因为配置文件中的 `ANTHROPIC_BASE_URL` 已经被改成了代理服务器的地址。

## 与 TokenRouter 的关系

TokenRouter 采用完全相同的设计理念：
- 作为一个通用的 AI API 客户端
- 只需要 API Key + Base URL 配置
- 不关心后端是直连 API、代理服务、还是网关
- 支持标准的 API 格式（Anthropic、OpenAI 兼容）

用户可以在 TokenRouter 中配置任何兼容的服务端点，包括：
- Anthropic 官方 API
- 通过 CC Switch 配置的代理
- Sub2API 网关
- OpenRouter
- 任何其他兼容的服务

## TokenRouter 如何支持 CC Switch

### 问题根源

TokenRouter 最初无法使用 cc switch 的原因是：
- **官方 CLI 和 VSCode 插件**：读取 `~/.claude/settings.json` 中的环境变量（`ANTHROPIC_AUTH_TOKEN` 和 `ANTHROPIC_BASE_URL`）
- **TokenRouter**：直接从自己的配置中读取 `baseURL` 和 `apiKey`，没有读取 Claude Code 的环境变量

### 解决方案

通过添加 `ClaudeConfigReader` 工具类，TokenRouter 现在可以：

1. **读取 Claude Code 配置**
```swift
// 读取 ~/.claude/settings.json 中的环境变量
let config = ProviderConfig.fromClaudeCodeSettings()
```

2. **自动检测 CC Switch 模式**
```swift
// 检查是否配置了 CC Switch
if ClaudeConfigReader.isCCSwitchMode() {
    print("当前使用 CC Switch 代理模式")
}
```

3. **创建兼容的 Provider**
```swift
// 方式 1: 从 Claude Code 配置创建（推荐）
if let config = ProviderConfig.fromClaudeCodeSettings() {
    let provider = AnthropicHTTPProvider(config: config)
}

// 方式 2: 手动配置
let config = ProviderConfig(
    name: "Claude (CC Switch)",
    baseURL: "https://api.lycloud.top/v1",
    apiKey: "sk-6b5c75e5...",
    model: "claude-sonnet-4",
    providerType: .anthropic
)
```

### 工作流程

```
用户执行: cc switch my-provider
    ↓
CC Switch 修改 ~/.claude/settings.json
    ↓
TokenRouter 启动时调用:
ProviderConfig.fromClaudeCodeSettings()
    ↓
ClaudeConfigReader 读取环境变量:
- ANTHROPIC_AUTH_TOKEN
- ANTHROPIC_BASE_URL
    ↓
TokenRouter 使用这些配置发送请求
    ↓
请求自动路由到 CC Switch 配置的代理服务器
```

### 优势

1. **零配置**：TokenRouter 自动读取 Claude Code 的配置，无需重复配置
2. **实时同步**：每次启动时读取最新配置，与 cc switch 保持同步
3. **透明切换**：用户使用 `cc switch` 切换 Provider 后，TokenRouter 自动使用新配置
4. **完全兼容**：与官方 CLI 和 VSCode 插件使用完全相同的机制

### 实现细节

参见 [ClaudeConfigReader.swift](../Providers/ClaudeConfigReader.swift) 的实现。
