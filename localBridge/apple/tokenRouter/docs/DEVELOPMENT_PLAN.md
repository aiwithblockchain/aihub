# TokenRouter 开发计划

**方案**：核心技术优先（方案 A）
**开始日期**：2026-03-19
**策略**：先验证核心技术可行性，再完善 UI 和扩展功能

---

## 阶段 1：Provider 配置系统 + Keychain 存储 ✅

**目标**：实现配置化的 Provider 系统，支持 base_url + api_key 配置

### 任务清单
- [x] 创建 `ProviderConfig` 模型
- [x] 实现 `KeychainTokenStore` 的实际存储逻辑
- [x] 更新 `AnthropicHTTPProvider` 使用配置化的 base_url
- [x] 编写验证测试脚本

### 验证点
✅ 能从 Keychain 读写 Provider 配置（JSON 格式）
✅ AnthropicHTTPProvider 能使用配置的 base_url 和 api_key
✅ 支持直连模式和 CC Switch 代理模式

### 已完成文件
- [Providers/ProviderConfig.swift](localBridge/apple/tokenRouter/Providers/ProviderConfig.swift) - 配置模型
- [Providers/KeychainTokenStore.swift](localBridge/apple/tokenRouter/Providers/KeychainTokenStore.swift) - 存储逻辑
- [Providers/AnthropicHTTPProvider.swift](localBridge/apple/tokenRouter/Providers/AnthropicHTTPProvider.swift) - 重构完成
- [Tests/ProviderConfigTests.swift](localBridge/apple/tokenRouter/Tests/ProviderConfigTests.swift) - 验证脚本

---

## 阶段 2：最小化 API 调用验证

**目标**：验证端到端的 API 调用流程

### 任务清单
- [ ] 创建测试工具（命令行或简单 UI）
- [ ] 配置真实的 Anthropic API Key
- [ ] 发送测试消息，验证流式响应
- [ ] 测试 CC Switch 代理模式

### 验证点
✅ 直连模式：能成功调用 Claude API 并接收流式响应
✅ 代理模式：通过 CC Switch 调用成功

### 涉及文件
- `Tests/ProviderTests.swift` (新建)
- 或创建临时测试脚本

---

## 阶段 3：设置界面集成

**目标**：在 UI 中实现 Provider 配置管理

### 任务清单
- [ ] 重构 `SettingsModelViewController` 为 Provider 配置界面
- [ ] 实现添加 Provider 表单（base_url, api_key, model）
- [ ] 实现编辑/删除 Provider 功能
- [ ] 实现 Provider 列表展示
- [ ] 添加"测试连接"功能

### 验证点
✅ 能在 UI 中添加、编辑、删除 Provider 配置
✅ 配置能正确保存到 Keychain 并读取
✅ 测试连接功能正常工作

### 涉及文件
- `AISettingsViewController.swift` (重构)
- 新建 Provider 配置相关的 ViewController

---

## 阶段 4：多 Provider 支持

**目标**：支持多种 AI Provider，验证架构扩展性

### 任务清单
- [ ] 实现 `OpenAIProvider`（验证通用性）
- [ ] 完善 `GeminiCLIProvider`（验证 CLI 模式）
- [ ] 完善 `CodexAppServerProvider`（验证 JSON-RPC 模式）
- [ ] 在聊天界面支持选择 Provider
- [ ] 实现 Provider 切换逻辑

### 验证点
✅ 能使用不同 Provider 进行对话
✅ CLI 和 JSON-RPC 模式正常工作
✅ Provider 切换流畅无错误

### 涉及文件
- `Providers/OpenAIProvider.swift` (新建)
- `Providers/GeminiCLIProvider.swift` (完善)
- `Providers/CodexAppServerProvider.swift` (完善)
- `ConsoleChatViewController.swift` (更新)

---

## 阶段 5：完善和优化

**目标**：提升用户体验和系统稳定性

### 任务清单
- [ ] 完善错误处理和用户提示
- [ ] 实现配置导入/导出功能
- [ ] 添加使用量统计
- [ ] 性能优化（缓存、连接池等）
- [ ] 添加日志系统
- [ ] 编写用户文档

### 验证点
✅ 错误提示清晰友好
✅ 配置可以导入导出
✅ 性能满足要求

---

## 技术债务和未来规划

- [ ] 支持多轮对话上下文管理
- [ ] Agent 间消息路由和协作机制
- [ ] 任务状态持久化
- [ ] 插件系统，支持自定义 Provider
- [ ] 分布式部署，支持远程 Agent

---

## 当前状态

**当前阶段**：阶段 1 完成 ✅ + 阶段 3 部分完成 ✅
**进度**：60% → 已完成核心配置系统和设置界面

**已完成**：
1. ✅ Provider 配置系统（ProviderConfig 模型）
2. ✅ Keychain 存储逻辑（完整的 CRUD 操作）
3. ✅ AnthropicHTTPProvider 重构（支持配置化 base_url）
4. ✅ 设置界面 Provider 配置管理
5. ✅ Provider 列表展示
6. ✅ 添加/编辑/删除 Provider 功能
7. ✅ Provider 配置卡片组件
8. ✅ Provider 编辑表单

**下一步行动**：
现在可以在 Xcode 中打开项目，运行应用，通过设置界面添加 Provider 配置，然后进入阶段 2 进行 API 调用验证。
