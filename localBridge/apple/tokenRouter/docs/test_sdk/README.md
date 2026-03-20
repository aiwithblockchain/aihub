# Claude SDK 测试项目

这是一个简单的 TypeScript 项目，用于测试 Claude Agent SDK 的基本功能。

## 功能

发送消息给 Claude 并获取回应。

## 配置方式

根据 [Claude Agent SDK 官方文档](https://platform.claude.com/docs/en/agent-sdk/typescript)，SDK 通过环境变量读取配置：

1. 复制 `.env.example` 为 `.env`：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填入你的配置：
```
ANTHROPIC_API_KEY=your-api-key
ANTHROPIC_BASE_URL=https://api.lycloud.top  # 可选，用于第三方 API 代理
```

## 安装步骤

安装依赖：
```bash
npm install
```

## 使用方法

### 使用默认消息
```bash
npm start
```

### 发送自定义消息
```bash
npm start "你的消息内容"
```

例如：
```bash
npm start "请用中文解释什么是人工智能"
```

## 项目结构

- [agent.ts](agent.ts) - 主程序文件，实现消息发送和接收
- [package.json](package.json) - 项目配置和依赖
- `.api-config.json` - API 配置文件（需要自己创建，已在 .gitignore 中）

## 技术说明

- 使用 Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- 支持自定义 API Base URL（适配第三方 API 代理）
- 自动从环境变量或配置文件加载 API 配置
