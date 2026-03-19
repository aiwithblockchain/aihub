# TokenRouter 架构设计

## 核心理念

TokenRouter 的设计理念是**作为一个通用的 AI API 客户端**，类似于 Claude Code 这样的 IDE 插件。

### 设计原则

1. **协议优先，不关心后端**
   - TokenRouter 只需要知道如何调用标准的 AI API
   - 不关心后端是直连 API、代理服务、还是网关
   - 用户配置什么，就调用什么

2. **简单配置**
   - 用户只需要提供：API Key + Base URL
   - 就像 Claude Code 插件一样简单
   - 不需要为每个服务单独配置

3. **不穷举模型**
   - 不为每个 AI 服务单独实现
   - 支持标准的 API 格式（Anthropic、OpenAI 兼容）
   - 新的服务只要兼容标准协议，就能直接使用

## 工作原理

### 类比：Claude Code 插件

Claude Code 可以嵌入到任何 IDE（VSCode、Cursor、Windsurf 等）：

```
用户配置：
  ANTHROPIC_AUTH_TOKEN=sk-xxx
  ANTHROPIC_BASE_URL=https://api.example.com

Claude Code 插件：
  ├─ 读取配置
  ├─ 使用标准 HTTP API 调用
  └─ 不关心后端是什么
     ├─ 可能是 Anthropic 官方 API
     ├─ 可能是 CC Switch 配置的代理
     ├─ 可能是 Sub2API 网关
     └─ 可能是任何兼容的服务
```

### TokenRouter 的工作方式

TokenRouter 应该采用完全相同的方式：

```
用户配置：
  Provider 名称: My Claude
  API Key: sk-xxx
  Base URL: https://api.example.com
  模型: claude-sonnet-4

TokenRouter：
  ├─ 读取用户配置
  ├─ 使用标准 HTTP API 调用
  └─ 不关心后端是什么
     ├─ 直连 Anthropic API ✓
     ├─ 通过 CC Switch 代理 ✓
     ├─ 通过 Sub2API 网关 ✓
     ├─ 通过 OpenRouter ✓
     └─ 任何兼容的服务 ✓
```

## 支持的 API 格式

### 1. Anthropic Messages API

**端点格式：**
```
POST {BASE_URL}/v1/messages
```

**认证方式：**
```
x-api-key: {API_KEY}
anthropic-version: 2023-06-01
```

**请求格式：**
```json
{
  "model": "claude-sonnet-4",
  "max_tokens": 4096,
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "stream": true
}
```

### 2. OpenAI Compatible API

**端点格式：**
```
POST {BASE_URL}/v1/chat/completions
```

**认证方式：**
```
Authorization: Bearer {API_KEY}
```

**请求格式：**
```json
{
  "model": "gpt-4",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "stream": true
}
```

## 实现策略

### Provider 类型

TokenRouter 支持两种 Provider 类型：

1. **Anthropic 格式** - 使用 Anthropic Messages API
2. **OpenAI 兼容格式** - 使用 OpenAI Chat Completions API

用户选择类型后，TokenRouter 会使用对应的 API 格式。

### 配置示例

**直连 Anthropic：**
```
类型: Anthropic
Base URL: https://api.anthropic.com/v1
API Key: sk-ant-xxxxx
模型: claude-sonnet-4
```

**通过 CC Switch 代理：**
```
类型: Anthropic
Base URL: https://api.lycloud.top
API Key: sk-xxxxx (CC Switch 配置的 Key)
模型: claude-sonnet-4
```

**使用 DeepSeek：**
```
类型: OpenAI 兼容
Base URL: https://api.deepseek.com
API Key: sk-xxxxx
模型: deepseek-reasoner
```

**使用阿里通义千问：**
```
类型: OpenAI 兼容
Base URL: https://dashscope.aliyuncs.com/compatible-mode/v1
API Key: sk-xxxxx
模型: qwen-plus
```

## 与 CC Switch 的关系

### CC Switch 的作用

CC Switch 是一个**配置管理工具**，它：
1. 存储多个 Provider 配置
2. 允许用户快速切换配置
3. 自动更新 AI CLI 工具的配置文件

### TokenRouter 的定位

TokenRouter 是一个**独立的 AI 客户端**，它：
1. 不依赖 CC Switch
2. 用户直接在 TokenRouter 中配置 Provider
3. 如果用户使用 CC Switch，可以把 CC Switch 配置的端点填入 TokenRouter

**关键点：TokenRouter 不需要读取 CC Switch 的数据库，用户只需要把配置复制过来即可。**

## 设计优势

1. **简单** - 用户只需要填写 API Key 和 Base URL
2. **灵活** - 支持任何兼容的 API 服务
3. **可扩展** - 新的服务只要兼容标准协议就能使用
4. **独立** - 不依赖任何第三方工具
5. **通用** - 像 Claude Code 插件一样，可以适配任何后端

## 总结

TokenRouter 的核心理念是：

> **作为一个通用的 AI API 客户端，遵循标准协议，不关心后端实现。**

就像 Claude Code 插件可以嵌入到任何 IDE 一样，TokenRouter 可以连接到任何兼容的 AI 服务。
