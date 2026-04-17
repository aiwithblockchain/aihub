# 小红书集成任务卡索引

本目录包含小红书集成的所有可验收任务卡。按照顺序完成这些任务即可完成小红书平台的集成。

## 任务概览

| 任务 | 标题 | 优先级 | 预计时间 | 依赖 | 状态 |
|------|------|--------|----------|------|------|
| [TASK-001](TASK-001-platform-abstraction.md) | 平台抽象层实现 | P0 | 0.5天 | 无 | ⬜ 待开始 |
| [TASK-002](TASK-002-xhs-types.md) | 小红书类型定义 | P0 | 0.5天 | 无 | ⬜ 待开始 |
| [TASK-003](TASK-003-xhs-injection.md) | 小红书注入脚本实现 | P1 | 1.5天 | TASK-002 | ⬜ 待开始 |
| [TASK-004](TASK-004-xhs-extractor.md) | 小红书数据提取器 | P1 | 1天 | TASK-002, TASK-003 | ⬜ 待开始 |
| [TASK-005](TASK-005-xhs-api-client.md) | 小红书 API 客户端 | P2 | 2天 | TASK-002, TASK-003 | ⬜ 待开始 |
| [TASK-006](TASK-006-manifest-config.md) | Manifest 和构建配置 | P2 | 0.5天 | TASK-003 | ⬜ 待开始 |
| [TASK-007](TASK-007-background-integration.md) | Background 脚本集成 | P2 | 1天 | TASK-003, TASK-004, TASK-005 | ⬜ 待开始 |
| [TASK-008](TASK-008-e2e-testing.md) | 端到端测试 | P3 | 1天 | TASK-001 到 TASK-007 | ⬜ 待开始 |
| [TASK-009](TASK-009-documentation.md) | 文档和发布准备 | P3 | 0.5天 | TASK-008 | ⬜ 待开始 |

**总计:** 9 个任务，预计 8.5-9 天

## 开发顺序建议

### Phase 1: 基础架构 (1天)
并行开发:
- ✅ TASK-001: 平台抽象层实现
- ✅ TASK-002: 小红书类型定义

### Phase 2: 数据捕获 (2.5天)
顺序开发:
1. ✅ TASK-003: 小红书注入脚本实现
2. ✅ TASK-004: 小红书数据提取器

### Phase 3: API 和集成 (3.5天)
并行开发:
- ✅ TASK-005: 小红书 API 客户端
- ✅ TASK-006: Manifest 和构建配置

然后:
- ✅ TASK-007: Background 脚本集成

### Phase 4: 测试和发布 (1.5天)
顺序开发:
1. ✅ TASK-008: 端到端测试
2. ✅ TASK-009: 文档和发布准备

## 任务详情

### TASK-001: 平台抽象层实现
创建平台检测和路由解析的抽象层,使 tweetClaw 支持多平台。

**关键产出:**
- `src/utils/platform-detector.ts`
- 扩展 `src/utils/route-parser.ts`
- 单元测试

### TASK-002: 小红书类型定义
创建小红书平台的 TypeScript 类型定义。

**关键产出:**
- `src/platforms/xiaohongshu/types/`
- `src/platforms/xiaohongshu/xhs-consts.ts`

### TASK-003: 小红书注入脚本实现
实现页面注入脚本,拦截 API 请求并捕获数据。

**关键产出:**
- `src/platforms/xiaohongshu/xhs-injection.ts`
- `src/content/xhs-main-entrance.ts`
- Webpack 配置更新

### TASK-004: 小红书数据提取器
实现数据提取器,解析 API 响应并转换为标准化数据结构。

**关键产出:**
- `src/platforms/xiaohongshu/xhs-extractor.ts`
- 单元测试

### TASK-005: 小红书 API 客户端
实现 API 客户端,支持点赞、收藏、关注、评论等操作。

**关键产出:**
- `src/platforms/xiaohongshu/xhs-api.ts`
- `src/platforms/xiaohongshu/xhs-url-utils.ts`

### TASK-006: Manifest 和构建配置
更新 manifest.json 和 webpack 配置。

**关键产出:**
- 更新 `manifest.json`
- 更新 `webpack.config.js`
- 更新 `package.json`

### TASK-007: Background 脚本集成
扩展 background 脚本以支持小红书平台。

**关键产出:**
- 扩展 `src/service_work/background.ts`
- 数据处理和存储逻辑

### TASK-008: 端到端测试
进行完整的端到端测试,验证所有功能。

**关键产出:**
- 测试报告
- Bug 修复

### TASK-009: 文档和发布准备
完善文档,准备发布。

**关键产出:**
- 更新 README
- 使用文档
- CHANGELOG
- 发布检查清单

## 验收标准

每个任务都有明确的验收标准,包括:
- 代码实现完成
- 测试通过
- 文档完善
- 功能验证

## 使用说明

1. 按照顺序阅读每个任务卡
2. 完成任务中的所有实现内容
3. 运行验收标准中的测试
4. 确认所有验收标准都满足
5. 更新本文件中的任务状态
6. 继续下一个任务

## 状态说明

- ⬜ 待开始
- 🔄 进行中
- ✅ 已完成
- ❌ 已阻塞

## 注意事项

1. **依赖关系** - 必须按照依赖顺序完成任务
2. **并行开发** - 无依赖的任务可以并行开发
3. **测试优先** - 每个任务完成后立即测试
4. **文档同步** - 代码和文档同步更新
5. **版本控制** - 每个任务完成后提交代码

## 问题反馈

如果在开发过程中遇到问题:
1. 检查任务卡中的"注意事项"部分
2. 查看相关的测试方法
3. 参考集成计划文档
4. 在项目中提交 Issue
