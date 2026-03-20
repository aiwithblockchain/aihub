# Claude Code 配置验证测试

## 目的

验证 cc-switch 如何让 Claude Code 插件"认为"有 API key 可用。

## 原理

1. **cc-switch 运行时**:
   - 读取当前激活的 provider 配置(从 `~/.cc-switch/cc-switch.db`)
   - 将配置写入 `~/.claude/settings.json`
   - 写入 `ANTHROPIC_AUTH_TOKEN` 或 `ANTHROPIC_API_KEY`

2. **Claude Code 插件**:
   - 启动时读取 `~/.claude/settings.json`
   - 检查是否存在 token 字段
   - 如果存在,认为"有 API key 可用"
   - 发送请求到 `ANTHROPIC_BASE_URL`

3. **cc-switch 关闭后**:
   - 配置文件可能被清空或包含无效 token
   - Claude Code 检测不到有效 token
   - 提示用户配置 API key 或登录

## 运行测试

```bash
cd /Users/wesley/aiwithblockchain/aihub/localBridge/apple/tokenRouter/docs/test_go
go run main.go
```

## 测试场景

### 场景 1: cc-switch 运行中
- 配置文件存在且包含 token
- 程序成功读取配置并发送请求
- 模拟 Claude Code 的正常工作流程

### 场景 2: cc-switch 关闭
- 配置文件可能不存在或 token 无效
- 程序无法读取有效配置
- 模拟 Claude Code 提示"需要配置"的情况

## 代码说明

`main.go` 模拟了 Claude Code 插件的核心逻辑:
1. 读取 `~/.claude/settings.json`
2. 解析 JSON 获取 token 和 base URL
3. 构造 HTTP 请求
4. 发送到 Anthropic API
5. 显示响应结果

## 验证结论

cc-switch 通过**文件系统**而非网络代理让 Claude Code 工作:
- 写入配置文件 → Claude Code 读取 → 认为有 key 可用
- 这就是为什么关掉 cc-switch 后 Claude Code 会失效
