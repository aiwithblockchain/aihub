# MCP 实施任务拆解与开发排期建议

## 1. 文档目标

本文档用于把前面三份偏策略和方案层的文档，进一步落成一份可执行的实施计划。

重点回答 4 个问题：

1. 第一阶段到底先做什么
2. 每一项工作应该拆成哪些具体任务
3. 各任务之间的依赖关系是什么
4. 怎样安排开发顺序，才能在不破坏现有 `LocalBridgeMac` 的前提下，最快做出一个可用的 MCP 版本

本文档默认遵循前面已经确认的核心原则：

- 不破坏现有 LocalBridge 逻辑
- 不重构现有执行内核
- MCP 作为新增适配层接入
- 先做最小闭环，再做产品化，再补能力覆盖

---

## 2. 实施目标定义

## 2.1 第一阶段目标

第一阶段的目标不是“做完整 xmcp”，而是：

> **做出一个可被标准 MCP Client 连接、能够稳定暴露首批 X 读写能力、且不影响现有 LocalBridge 的独立 MCP Server。**

这意味着第一阶段完成后，应该满足：

- MCP Client 能连接到服务
- MCP Client 能发现一组工具
- 至少 1 组环境工具 + 1 组读工具 + 1 组写工具可以真实跑通
- 调用失败时有统一错误返回
- LocalBridge 原有 UI / REST / WS / Go bridge 不受影响

---

## 2.2 第二阶段目标

第二阶段在第一阶段基础上补足：

- 更多首批工具
- 返回结构统一
- 错误模型统一
- 路由策略清晰
- 配置化
- 只读模式 / 工具白名单 / 审计日志

---

## 2.3 第三阶段目标

第三阶段主要面向 xmcp 靠拢：

- 扩展 Twitter/X 能力覆盖
- 增强 Agent 友好度
- 增强治理与调试能力
- 提升“产品化”程度

---

## 3. 总体实施策略

## 3.1 推荐策略：四步走

### 第一步：先让 MCP server 跑起来
不要一开始就追求完整工具集，先证明接入模型成立。

### 第二步：打通最小能力闭环
先选少量高价值 tools，完成读写端到端调用。

### 第三步：做标准化和治理
把“能跑”提升为“能稳定被上游使用”。

### 第四步：补能力覆盖
在结构稳定后，再逐步向 xmcp 覆盖面逼近。

---

## 3.2 为什么不建议一开始就做大而全

因为你当前最重要的不是“功能清单丰富”，而是：

- MCP 入口模型是否顺畅
- LocalBridge 是否能被平滑复用
- 上游 Agent 是否容易理解这些 tools
- 新层是否会影响老系统

所以开发顺序必须是：

> **先验证接入模型，再扩展能力面。**

---

## 4. 建议的里程碑拆分

建议将实施过程拆为 5 个里程碑。

---

# Milestone 0：准备阶段

## 目标
完成开发边界、目录结构、运行形态和最小技术选型确认。

## 交付物
- MCP 实现目录结构
- MCP server 运行方式说明
- 配置文件草案
- 与 LocalBridge 的通信边界说明

## 任务清单

### 任务 0.1：确定 MCP server 的实现形态
建议确认：
- 独立本地进程
- 通过现有 LocalBridge REST API 调用能力

输出：
- 一页实现说明

### 任务 0.2：确定代码存放位置
建议新建独立目录，例如：
- `LocalBridgeMCP/`
- 或 `mcp/`

内部建议分层：
- `Server`
- `Config`
- `Tools`
- `Adapters`
- `Schemas`
- `Errors`
- `Logging`

### 任务 0.3：确定 MCP server 的启动方式
例如：
- 手动启动
- 跟随 App 启动
- 独立 CLI 启动

建议第一阶段优先：
- 独立启动

### 任务 0.4：明确与 LocalBridge 的依赖关系
需要明确：
- LocalBridge 未启动时，MCP 怎么报错
- REST 端口从哪里读取
- 是否依赖用户已登录 X
- 是否依赖至少一个 tweetClaw 实例在线

## 验收标准
- 有清晰目录与运行边界
- 明确第一阶段不需要改动哪些旧代码

---

# Milestone 1：MCP Server 最小启动版本

## 目标
做出一个可被 MCP Client 连接的空壳服务。

## 交付物
- MCP server 进程可启动
- MCP client 能连接
- 可以列出至少 1 个测试 tool

## 任务清单

### 任务 1.1：初始化 MCP server 项目骨架
包括：
- 入口文件
- 配置读取
- 日志初始化
- tool registry 骨架

### 任务 1.2：实现服务级健康检查
至少要能检查：
- 配置是否有效
- LocalBridge base URL 是否可访问

### 任务 1.3：实现一个测试用工具
例如：
- `ping_localbridge`
- 或 `get_localbridge_status`

该工具只用于验证：
- tool 注册机制正确
- MCP 调用链工作正常

### 任务 1.4：接通 MCP client 测试
使用目标 MCP 客户端做验证：
- 能识别服务
- 能列出 tool
- 能调用测试 tool

## 验收标准
- MCP server 可启动
- MCP client 能发现服务
- 至少 1 个 tool 可调用

---

# Milestone 2：Read-only 能力首发

## 目标
优先发布第一批只读 tools，低风险验证上游可用性。

## 推荐首发 tools
- `list_x_instances`
- `get_x_status`
- `get_x_basic_info`
- `get_home_timeline`
- `get_tweet`
- `search_tweets`

## 交付物
- 读工具 schema
- REST adapter 初版
- 统一返回结构初版
- 初版错误映射

## 任务清单

### 任务 2.1：实现 REST adapter 基类
职责：
- 统一发起 LocalBridge REST 请求
- 统一处理超时
- 统一解析 HTTP 错误
- 提供基础日志

### 任务 2.2：实现统一结果包装器
将现有 REST 返回包装为：
- `success`
- `data`
- `error`
- `meta`

### 任务 2.3：实现统一错误映射器
至少支持：
- `INVALID_ARGUMENT`
- `LOCALBRIDGE_NOT_READY`
- `TIMEOUT`
- `UPSTREAM_EXECUTION_FAILED`
- `NO_ACTIVE_X_TAB`
- `X_NOT_LOGGED_IN`

### 任务 2.4：实现只读 tools
建议顺序：
1. `list_x_instances`
2. `get_x_status`
3. `get_x_basic_info`
4. `get_tweet`
5. `get_home_timeline`
6. `search_tweets`

### 任务 2.5：实现基础 summary 抽取
注意：只做轻量摘要，不要重型解析。
例如：
- `get_x_basic_info` 提取 screenName
- `get_tweet` 提取 tweetId / text / author
- `search_tweets` 提取 tweetCount / nextCursor

### 任务 2.6：完成首轮客户端联调
验证：
- Claude Desktop
- Cursor
- 或你的目标上游产品

## 验收标准
- 至少 6 个只读 tools 能稳定调用
- 统一返回结构可用
- LocalBridge 现有功能不受影响

---

# Milestone 3：核心写操作闭环

## 目标
让 MCP 层具备“真正可执行”的最小互动能力。

## 推荐首发写 tools
- `create_tweet`
- `reply_tweet`
- `like_tweet`
- `retweet_tweet`

## 交付物
- 写工具 schema
- 写操作风险标记
- 只读模式
- 基础工具白名单

## 任务清单

### 任务 3.1：实现写操作工具基类
职责：
- 复用 REST adapter
- 执行写操作前做策略检查
- 统一写操作错误返回

### 任务 3.2：实现 `readOnlyMode`
逻辑：
- 开启后所有写工具直接拒绝
- 返回 `ACTION_NOT_ALLOWED`

### 任务 3.3：实现 `enabledTools` 白名单
逻辑：
- 配置中未启用的工具不注册，或调用时拒绝

### 任务 3.4：实现首批写工具
建议顺序：
1. `like_tweet`
2. `retweet_tweet`
3. `reply_tweet`
4. `create_tweet`

这个顺序更稳，因为：
- 点赞/转推输入简单
- 回复次之
- 发推风险最高，放最后验证

### 任务 3.5：为写工具补充 meta
返回建议增加：
- `sideEffect: true`
- `riskLevel`
- `usedDefaultRouting`

### 任务 3.6：做首轮写工具联调
验证：
- 单实例
- 多实例
- 指定 instanceId
- 默认路由
- LocalBridge 未就绪时失败路径

## 验收标准
- 至少 4 个写工具可稳定执行
- 只读模式有效
- 工具白名单有效
- 错误返回一致

---

# Milestone 4：产品化与治理增强

## 目标
让 MCP 层从“能跑”变成“适合接入上游产品”。

## 交付物
- 更完整配置
- 审计日志
- 更清晰路由策略
- 文档增强

## 任务清单

### 任务 4.1：实现配置模块完善
建议配置项：
- `localbridgeBaseUrl`
- `enabledTools`
- `readOnlyMode`
- `defaultInstanceId`
- `allowDestructiveTools`
- `requestTimeoutMs`
- `debugLogging`
- `exposeRawPayload`

### 任务 4.2：实现审计日志
记录：
- 调用时间
- tool 名称
- 参数摘要
- 命中实例
- 成功/失败
- 错误码

### 任务 4.3：实现更清晰的路由策略输出
在 `meta` 中增加：
- `resolvedInstanceId`
- `resolvedTabId`
- `usedDefaultRouting`
- `routingSource`

### 任务 4.4：统一 tool 描述与文档
补齐：
- 每个 tool 的清晰说明
- 副作用说明
- 参数说明
- 适用场景

### 任务 4.5：补第二批工具
建议第二批优先：
- `unlike_tweet`
- `unretweet_tweet`
- `bookmark_tweet`
- `unbookmark_tweet`
- `delete_my_tweet`

## 验收标准
- 配置可控
- 日志可追踪
- 路由可解释
- 第二批工具可接入

---

# Milestone 5：能力扩展与 xmcp 对齐

## 目标
在架构稳定后，逐步补齐与 xmcp 的差距。

## 优先扩展建议

### 读能力
- `get_user_tweets`
- `get_user_profile`
- `get_tweet_replies`
- mentions timeline
- notifications
- bookmarks read
- followers/following

### 写能力
- quote tweet
- follow/unfollow
- media upload
- post with media

### Agent 友好能力
- 结构化摘要增强
- 更强的 summary 提取
- 高层复合工具

## 验收标准
- 工具覆盖明显扩展
- 上游可完成更多工作流
- 产品形态明显向 xmcp 靠拢

---

## 5. 任务优先级建议

这里给出一个更实际的优先级排序。

## P0：必须先做
这些任务不做，整个 MCP 项目无法成立。

- MCP server 项目骨架
- 配置读取
- REST adapter
- tool registry
- 统一返回结构
- 统一错误映射
- `list_x_instances`
- `get_x_status`
- `get_x_basic_info`
- `get_tweet`
- `search_tweets`

---

## P1：最小互动闭环
这些任务做完，MCP 才真正有“写能力”价值。

- `like_tweet`
- `retweet_tweet`
- `reply_tweet`
- `create_tweet`
- `readOnlyMode`
- `enabledTools`

---

## P2：产品化必要补足
这些任务决定是否适合上游长期接入。

- 审计日志
- 默认实例策略
- 更清晰 meta
- 更完整 tool 描述
- 第二批对偶工具

---

## P3：能力扩展
这些任务决定你何时更接近 xmcp。

- 更多 timeline
- 更多社交关系操作
- media upload
- content management tools

---

## 6. 建议开发顺序

如果由你或团队来推进，我建议按以下顺序开发。

### Week / Sprint 1
- 完成 Milestone 0
- 完成 Milestone 1
- 让 MCP server 跑起来

### Week / Sprint 2
- 完成 Read-only tools 首发
- 跑通 `list_x_instances`、`get_x_status`、`get_tweet`、`search_tweets`

### Week / Sprint 3
- 完成写操作闭环
- 实现 `like_tweet`、`retweet_tweet`、`reply_tweet`、`create_tweet`
- 接入 `readOnlyMode`

### Week / Sprint 4
- 做产品化增强
- 审计日志
- 白名单
- 更完整 meta
- 第二批工具

### Week / Sprint 5+
- 按优先级补能力覆盖
- 对标 xmcp 逐步扩展

如果不是按周排，也可以按“先后关系”理解。

---

## 7. 建议的模块任务拆解

下面给出更工程化的模块拆解。

## 7.1 Config 模块

### 任务
- 定义配置结构
- 支持默认值
- 支持读取本地配置文件
- 支持 readOnlyMode / enabledTools

### 验收
- 配置缺失时有默认值
- 配置错误时能清晰报错

---

## 7.2 Server 模块

### 任务
- 初始化 MCP server
- 注册 tools
- 挂载日志
- 注入 adapter / config

### 验收
- 服务能启动
- tools 能正确注册

---

## 7.3 Adapter 模块

### 任务
- 统一发 REST 请求
- 超时控制
- HTTP 响应处理
- 错误转换

### 验收
- 支持 GET / POST / DELETE
- 超时和异常路径清晰

---

## 7.4 Tools 模块

### 任务
- 每个 tool 单独实现
- 校验参数
- 调用 adapter
- 包装结果

### 验收
- 单个 tool 可独立测试
- 参数缺失时返回一致错误

---

## 7.5 Errors 模块

### 任务
- 定义统一错误码
- 实现内部错误 -> MCP 错误映射

### 验收
- 同类错误输出一致

---

## 7.6 Logging / Audit 模块

### 任务
- 调用日志
- 错误日志
- 审计日志

### 验收
- 能追踪一次完整 tool 调用

---

## 8. 风险点与规避建议

## 风险 1：过早绑定太多旧代码细节

### 表现
MCP 层直接依赖大量旧类，而不是优先通过 REST adapter。

### 风险
- 耦合增加
- 后续难维护
- 容易破坏原逻辑

### 建议
第一阶段优先 REST 适配，不够用时再小范围补内部暴露点。

---

## 风险 2：首批工具选太多

### 表现
一开始就把十几二十个工具全做。

### 风险
- 开发节奏变慢
- 排查问题困难
- 联调成本高

### 建议
先做最小闭环：
- `list_x_instances`
- `get_x_status`
- `get_tweet`
- `search_tweets`
- `like_tweet`
- `create_tweet`

---

## 风险 3：过度解析 raw payload

### 表现
第一版就试图完全结构化 Twitter 所有复杂 GraphQL 数据。

### 风险
- 工程量暴涨
- 与当前低侵入目标冲突

### 建议
第一版坚持：
- `raw` 必保留
- `summary` 只做轻量抽取

---

## 风险 4：多实例默认路由不透明

### 表现
用户没指定实例时，系统悄悄猜测并执行了写操作。

### 风险
- 误操作
- 调试困难

### 建议
- 显式优先
- 默认回退清晰
- `meta` 里返回最终路由
- 无法确定时宁可报错

---

## 9. 推荐的第一阶段“最小上线包”

如果你想尽快得到一个可展示、可测试、可继续演进的版本，我建议第一阶段上线包只包含：

### 基础能力
- MCP server 启动
- 配置读取
- REST adapter
- 错误映射
- 统一输出结构

### 只读 tools
- `list_x_instances`
- `get_x_status`
- `get_x_basic_info`
- `get_tweet`
- `search_tweets`

### 写 tools
- `like_tweet`
- `create_tweet`

### 治理能力
- `readOnlyMode`
- `enabledTools`

### 日志
- 基础调用日志

这已经足够形成一个“真实可用的 MCP Preview”。

---

## 10. 最终建议

从实施角度看，最关键的不是把任务列得很大，而是：

1. 先让 MCP server 跑起来
2. 先打通少量高价值 tools
3. 先验证上游使用体验
4. 再补标准化和治理
5. 最后逐步补能力覆盖

对你的项目而言，正确节奏应该是：

> **以最小侵入方式先做出一个可运行、可调用、可验证的 MCP 版本，然后用它作为基座继续向 xmcp 级别演进。**

---

## 11. 一句话总结

> 建议将 LocalBridge 的 MCP 建设拆为 5 个里程碑：准备、启动、只读首发、写操作闭环、产品化增强与能力扩展，先用最小上线包验证架构和调用链，再按优先级逐步补齐治理、标准化和 Twitter/X 能力覆盖。
