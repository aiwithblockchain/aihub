# LocalBridge 的 MCP 增量改造方案设计

## 1. 文档目标

本方案用于回答一个明确问题：

> 在完全不破坏 `LocalBridgeMac` 现有功能和逻辑的前提下，如何为其新增一层 MCP 能力，使其对上游产品呈现出接近 xmcp 的架构与调用方式。

本方案强调四个原则：

- 不改现有核心逻辑
- 不替换现有执行链路
- MCP 作为新增适配层接入
- 优先快速形成最小可用版本，再逐步补齐能力

---

## 2. 改造目标

## 2.1 最终目标

将 `LocalBridgeMac` 演进为一个：

> **以 LocalBridge 为能力内核、以 MCP Server 为标准接入层的本地 X/Twitter Agent Bridge。**

使上游 MCP Client 能够通过标准 MCP tools 调用现有 X 能力，而不需要理解 LocalBridge 内部的 WebSocket、Go bridge、REST API 或浏览器扩展细节。

---

## 2.2 本阶段目标

本阶段不追求一次性做成完整 xmcp，而是先完成：

### 目标 A：建立 MCP 接入面
提供一个可被标准 MCP Client 连接的 MCP server。

### 目标 B：映射第一批核心 X tools
优先暴露一组最有价值的读写能力。

### 目标 C：保持现有 LocalBridge 完全不受影响
原有：
- App UI
- Go bridge
- WebSocket 通信
- REST API
- tweetClaw / aiClaw 行为

都继续照常工作。

### 目标 D：为后续补能力留出结构空间
让未来增加更多 Twitter 能力时，不需要推倒重来。

---

## 3. 非目标

为了避免过度设计，本阶段明确不做以下事情：

- 不重构 LocalBridge 现有业务逻辑
- 不替换现有 REST/WS 协议
- 不重写 Go bridge
- 不一次性补齐 xmcp 的全部 Twitter 能力
- 不引入与当前目标无关的复杂工作流引擎
- 不提前做过度抽象的通用插件体系

这很重要，因为你的核心要求是增量、稳定、低侵入。

---

## 4. 推荐总体架构

## 4.1 总体思路

采用 **Adapter 模式**：

`MCP Client -> MCP Adapter Layer -> LocalBridge Existing APIs -> bridge/extension -> X`

MCP 层不直接操作浏览器，不直接管理 session，不直接理解底层桥接协议，而是复用现有执行面。

---

## 4.2 分层设计

### 第 1 层：Existing Core Layer（保留不动）
包括：
- `LocalBridgeMac`
- `LocalBridgeGoManager`
- `LocalBridgeWebSocketServer`
- 当前 REST API
- 当前实例管理逻辑
- 当前 tweetClaw / aiClaw 通信逻辑

责任：
- 执行真实动作
- 管理连接、实例、tab、session
- 与 X 环境交互

### 第 2 层：MCP Adapter Layer（新增）
新增一个独立层，负责：
- 对外提供 MCP server
- 声明 tools schema
- 接收 MCP tool calls
- 参数校验与标准化
- 路由到现有 LocalBridge 能力
- 标准化返回结果
- 进行错误映射

### 第 3 层：MCP Clients（外部）
包括：
- Claude Desktop
- Cursor
- Cherry Studio
- 你未来自己的上游产品
- 其他支持 MCP 的 Agent 客户端

---

## 4.3 为什么不建议直接把 MCP 写进现有核心类

不建议把 MCP 逻辑硬塞进：
- `LocalBridgeWebSocketServer.swift`
- `LocalBridgeGoManager.swift`
- 现有 REST handler 逻辑

原因：

### 1）会破坏边界
这些类当前的职责已经明确，直接混入 MCP 语义会污染原结构。

### 2）会增加回归风险
你强调不能破坏原逻辑，越少改旧代码越安全。

### 3）后续维护会更难
MCP 本质上是接入协议层，不应和底层执行面耦合得太深。

所以最优方式是：

> **MCP 独立成一个新模块，只依赖现有能力，不反向侵入现有核心。**

---

## 5. 建议实现形态

## 5.1 两种候选形态

### 方案 A：MCP Server 内嵌在 LocalBridgeMac 进程内
特点：
- 启动 App 时一起启动 MCP server
- 可直接复用应用内状态
- 进程内通信成本低

优点：
- 状态共享简单
- 调用链短
- 本地产品体验统一

缺点：
- App 与 MCP 生命周期耦合
- 代码边界相对不如独立进程清晰

---

### 方案 B：MCP Server 作为独立本地进程
特点：
- MCP server 独立运行
- 通过现有 REST API 调用 LocalBridge
- LocalBridge 继续作为能力提供方

优点：
- 边界最清晰
- 对现有工程侵入最小
- 更接近 xmcp 的独立服务形态
- 后续更容易单独发布或调试

缺点：
- 需要处理本地服务依赖关系
- 需要考虑 LocalBridge 未启动时的错误体验

---

## 5.2 推荐选择

**推荐优先采用方案 B：独立 MCP Server 进程。**

原因最符合你的约束：

- 不破坏现有逻辑
- 最大限度复用已有 REST 能力
- MCP 层可以独立迭代
- 便于未来演进为更产品化的服务
- 更容易做版本边界与灰度控制

简化理解：

> `LocalBridgeMac` 继续做“能力引擎”，新增一个 `LocalBridge MCP Server` 做“标准协议外壳”。

---

## 6. MCP Adapter 的职责设计

MCP 适配层建议只做六件事：

### 1）Tool 注册
向 MCP Client 暴露有哪些 tools。

### 2）Schema 管理
定义每个 tool 的：
- 名称
- 描述
- 输入参数
- 输出说明

### 3）参数标准化
例如支持：
- `instanceId`
- `tabId`
- `tweetId`
- `screenName`
- `userId`
- `cursor`
- `count`

### 4）调用路由
把 MCP tool call 转成：
- 本地 REST 调用
- 或必要时调用 LocalBridge 内部接口

### 5）错误转换
把内部错误转成更稳定的 MCP 层错误语义。

### 6）结果包装
把现有返回包装成更适合 MCP Client 和 LLM 消费的结构。

---

## 7. 首批 MCP Tools 设计

本阶段目标是先形成“最小可用的 xmcp 风格能力集”。

## 7.1 Tool 分组

### A. 环境与上下文类
用于帮助上游 Agent 建立操作上下文。

1. `list_x_instances`
- 作用：返回当前可用 tweetClaw 实例
- 用途：多账号/多实例路由

2. `get_x_status`
- 作用：返回 X tabs、活动 tab、登录状态
- 用途：确认环境是否可操作

3. `get_x_basic_info`
- 作用：获取当前账号基本信息
- 用途：识别当前账号身份

---

### B. 内容读取类
用于研究、搜索、分析和发现内容。

4. `get_home_timeline`
- 作用：读取首页时间线

5. `get_tweet`
- 作用：读取单条推文详情

6. `get_tweet_replies`
- 作用：读取推文回复

7. `get_user_profile`
- 作用：读取用户资料

8. `search_tweets`
- 作用：按关键词搜索推文

9. `get_user_tweets`
- 作用：读取某个用户的推文列表

---

### C. 内容写入与互动类
用于完成最基础的写操作闭环。

10. `create_tweet`
- 作用：发布推文

11. `reply_tweet`
- 作用：回复推文

12. `like_tweet`
- 作用：点赞

13. `unlike_tweet`
- 作用：取消点赞

14. `retweet_tweet`
- 作用：转推

15. `unretweet_tweet`
- 作用：取消转推

16. `bookmark_tweet`
- 作用：收藏

17. `unbookmark_tweet`
- 作用：取消收藏

18. `delete_my_tweet`
- 作用：删除自己发布的推文

---

## 7.2 为什么首批工具这样选

因为这组工具已经能支持非常典型的 Agent 工作流：

- 感知当前环境
- 识别账号身份
- 搜索主题
- 阅读时间线和详情
- 选择目标内容
- 完成互动或发布

这是一个足够完整的最小闭环。

---

## 8. Tool 输入输出规范建议

## 8.1 输入参数规范

建议在 MCP 层统一参数风格。

### 通用上下文字段
- `instanceId`：可选，指定实例
- `tabId`：可选，指定 tab
- `timeoutMs`：可选，覆盖默认超时

### 读操作常见字段
- `tweetId`
- `screenName`
- `userId`
- `query`
- `cursor`
- `count`

### 写操作常见字段
- `text`
- `tweetId`
- `mediaIds`（后续扩展）
- `replyToTweetId`（如后续统一抽象）

---

## 8.2 输出结构规范

建议 MCP 层统一返回结构：

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "instanceId": "...",
    "tabId": 123,
    "source": "localbridge-rest",
    "toolVersion": "v1"
  }
}
```

失败时：

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "X_NOT_LOGGED_IN",
    "message": "No logged-in X session is available"
  },
  "meta": {
    "source": "localbridge-rest",
    "toolVersion": "v1"
  }
}
```

---

## 8.3 是否保留原始 Twitter payload

建议：**保留。**

原因：
- 你当前很多能力本身就是 raw GraphQL passthrough
- 上游 Agent 可能需要完整字段
- 这样对现有逻辑改动最小

推荐做法：
- `data.raw` 保留原始返回
- 可选增加 `data.summary`
- 不强迫底层先做复杂解析

这是最符合你“先低侵入落地”的方式。

---

## 9. 路由与实例选择设计

## 9.1 为什么这件事重要

你的系统天然支持：
- 多实例
- 多 tab
- 多账号上下文

而 MCP Client 往往不知道这些细节。

所以 MCP 层必须定义清晰的路由策略。

---

## 9.2 推荐路由策略

### 第一优先：显式指定
如果 tool call 传了：
- `instanceId`
- 或 `tabId`

则严格按指定路由。

### 第二优先：默认活动上下文
如果未指定：
- 优先使用当前 active X tab
- 再根据 tab 对应实例执行

### 第三优先：默认实例
如果没有明确 active tab 但存在默认实例：
- 使用默认实例

### 第四优先：失败返回
如果上下文不明确：
- 不做危险猜测
- 返回清晰错误

例如：
- `NO_ACTIVE_X_TAB`
- `INSTANCE_REQUIRED`
- `INSTANCE_NOT_FOUND`

---

## 9.3 建议 MCP 层增加的 meta 信息

返回结果里建议带上：
- 最终命中的 `instanceId`
- 最终命中的 `tabId`
- 是否使用了默认路由
- LocalBridge endpoint

这样方便调试，也利于上游系统追踪。

---

## 10. 错误模型设计

建议 MCP 层不要直接把所有内部错误原样抛给上游，而是统一映射为稳定错误码。

建议首批错误码：

- `INVALID_ARGUMENT`
- `INSTANCE_NOT_FOUND`
- `TAB_NOT_FOUND`
- `NO_ACTIVE_X_TAB`
- `X_NOT_LOGGED_IN`
- `LOCALBRIDGE_NOT_READY`
- `TIMEOUT`
- `UPSTREAM_EXECUTION_FAILED`
- `ACTION_NOT_ALLOWED`
- `UNSUPPORTED_OPERATION`

这样做的价值：
- 对上游更稳定
- 更适合 Agent 编排
- 后续可扩展审计和治理

---

## 11. 配置设计建议

MCP server 建议提供独立配置，避免侵入现有 LocalBridge 配置语义。

建议配置项：

- `localbridgeBaseUrl`
- `enabledTools`
- `readOnlyMode`
- `defaultInstanceId`
- `allowDestructiveTools`
- `requestTimeoutMs`
- `debugLogging`
- `exposeRawPayload`

这样可以做到：
- 不改老配置结构
- MCP 层单独演进
- 后续上游部署更灵活

---

## 12. 安全与治理设计

## 12.1 第一阶段必须做的治理

即使先做本地产品，也建议从第一版开始做最基础治理：

### 1）只读模式
一个开关禁用所有写操作。

### 2）危险写操作开关
如：
- `delete_my_tweet`
- 未来的 block / mute / unfollow

默认可关闭。

### 3）Tool 白名单
允许只暴露部分工具。

### 4）审计日志
至少记录：
- 时间
- tool 名称
- 参数摘要
- 命中实例
- 成功/失败

---

## 12.2 为什么不建议第一版做交互式确认

MCP 场景里，交互式确认会让自动化 Agent 流程变复杂。  
第一阶段更适合的方式是：

- 配置层面控制风险
- 通过只读模式和白名单治理
- 把确认机制留到后续需要时再增加

---

## 13. 建议的代码组织方式

在不破坏现有工程的前提下，建议 MCP 相关逻辑独立组织。

例如可新增一个独立目录/模块：

- `doc/`：文档
- `mcp/` 或 `LocalBridgeMCP/`：MCP server 相关代码
  - `Server`
  - `Tools`
  - `Schemas`
  - `Adapters`
  - `Errors`
  - `Config`

原则是：
- 新代码尽量集中
- 旧代码只做必要暴露
- 避免把 MCP 逻辑分散塞进现有类

---

## 14. 第一阶段实施步骤

## Step 1：明确 MCP server 运行形态
目标：确定独立进程方案。

输出：
- 启动方式
- 与 LocalBridge 的通信方式
- 配置文件位置

验证：
- MCP server 可单独启动
- 能检测 LocalBridge 是否可用

---

## Step 2：实现 tool registry
目标：先把第一批 tool 的 schema 定义出来。

输出：
- tool 名称
- tool 描述
- 输入 schema
- 输出 schema 约定

验证：
- MCP client 能列出 tools

---

## Step 3：实现 LocalBridge REST adapter
目标：把 MCP tool call 转成现有 REST 调用。

输出：
- 每个 tool 对应 REST endpoint 映射
- 参数转换层
- 错误转换层

验证：
- 选 3~5 个读工具完成端到端调用

---

## Step 4：接入写操作工具
目标：打通核心写能力。

建议顺序：
- `create_tweet`
- `reply_tweet`
- `like_tweet`
- `retweet_tweet`

验证：
- 每个工具都能独立完成调用
- 失败时返回统一错误

---

## Step 5：补最小治理能力
目标：确保第一版可控。

输出：
- `readOnlyMode`
- `enabledTools`
- 基础审计日志

验证：
- 禁用写工具时调用会被明确拒绝

---

## Step 6：首轮 MCP 可用性验证
目标：确认它已经具备上游接入价值。

验证清单：
- MCP client 能发现 tools
- 读工具可稳定返回
- 写工具可稳定执行
- 多实例路由行为清晰
- LocalBridge 不受影响

---

## 15. 推荐的首批里程碑

## Milestone 1：MCP Read-only Preview
范围：
- `list_x_instances`
- `get_x_status`
- `get_x_basic_info`
- `get_home_timeline`
- `get_tweet`
- `search_tweets`

价值：
- 零风险验证 MCP 接入模型
- 快速形成上游演示能力

---

## Milestone 2：MCP Interactive Core
范围增加：
- `create_tweet`
- `reply_tweet`
- `like_tweet`
- `retweet_tweet`

价值：
- 建立完整互动闭环
- 基本具备 xmcp 风格最小执行面

---

## Milestone 3：MCP Productization
范围增加：
- 错误标准化
- 配置化
- 审计日志
- tool 白名单
- 默认实例策略

价值：
- 让它更适合真实对接上游产品

---

## Milestone 4：Capability Expansion
范围增加：
- quote tweet
- follow/unfollow
- mentions
- notifications
- bookmarks read
- media upload

价值：
- 开始向 xmcp 的更完整能力覆盖逼近

---

## 16. 风险与应对

## 风险 1：MCP 层过早做太厚
问题：
- 还没验证基础路径，就开始做复杂工作流和高级抽象

应对：
- 第一版只做 adapter，不做 orchestration

## 风险 2：过度修改旧代码
问题：
- 为了“优雅”而重构现有 LocalBridge

应对：
- 旧代码只做必要暴露
- 主要新增逻辑放在新模块

## 风险 3：多实例路由混乱
问题：
- 上游不清楚命中了哪个实例

应对：
- 显式优先
- 默认回退清晰
- 返回 meta 带上最终路由信息

## 风险 4：写操作失控
问题：
- Agent 自动化导致误操作

应对：
- 只读模式
- 工具白名单
- 基础审计日志

---

## 17. 最终建议

如果要把 `LocalBridgeMac` 做成 xmcp 风格的 MCP 产品，最佳路线不是重构，而是：

> **保留 LocalBridge 作为能力引擎，新增一个独立 MCP Adapter 层，通过标准 tools 将现有 X 能力重新组织并暴露给上游。**

这个路线的优点是：
- 最符合你“不破坏现有逻辑”的要求
- 最快形成可用成果
- 最利于后续逐步补能力
- 最接近 xmcp 的产品演进方式

---

## 18. 一句话落地方案

> 第一阶段先做一个独立的本地 MCP Server，基于现有 LocalBridge REST/执行面暴露一组核心 X tools，先完成读写闭环和路由/错误/配置的最小标准化，再逐步补齐能力覆盖和产品化能力，最终向 xmcp 级别演进。
