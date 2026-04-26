# MCP 技术选型与项目结构建议

## 1. 文档目标

本文档用于回答 `LocalBridgeMac` 在新增 MCP 能力时最关键的工程决策问题：

1. MCP server 应该用什么技术栈实现
2. 是否继续使用 Swift，还是拆成独立服务
3. 新增代码应如何组织，才能与现有工程低侵入共存
4. 怎样的技术选型最符合你当前“增量扩展、不破坏原逻辑、逐步向 xmcp 靠拢”的目标

这份文档不讨论产品目标本身，而聚焦于：

> **如何以最小风险、最低耦合、最高演进弹性，把 MCP 这一层真正落到工程结构上。**

---

## 2. 选型前提

在讨论技术栈之前，先明确你的约束条件。

## 2.1 已知约束

### 约束 1：不能破坏现有 LocalBridgeMac
这意味着：
- 不应大规模改造现有 Swift App 工程
- 不应把 MCP 逻辑深度耦合进现有核心类
- 不应为了 MCP 重写现有 REST / WS / bridge 链路

### 约束 2：当前已有能力内核已经成立
这意味着：
- MCP 层不需要重新发明执行面
- 可以优先复用现有 LocalBridge REST API
- 新增层重点在“协议适配”和“工具暴露”

### 约束 3：目标形态接近 xmcp
这意味着：
- 需要一个更标准、更独立的 MCP 服务层
- 上游产品应该感知的是 MCP tools，而不是桌面 App 内部对象
- 技术选型应优先考虑 MCP 生态和对接便利性

### 约束 4：后续还会持续补能力
这意味着：
- 选型必须利于未来继续加 tool
- 需要良好的 schema 定义与工具注册体验
- 不能选择“首版方便、后续痛苦”的方案

---

## 3. 技术选型的核心结论

## 3.1 总体推荐

**推荐方案：将 MCP server 做成一个独立进程，不内嵌到现有 Swift App 中。**

也就是说：

> **保留 `LocalBridgeMac` 作为能力引擎，新增一个独立的 LocalBridge MCP Server 作为标准协议层。**

这是最符合你当前目标的总体方向。

---

## 3.2 语言层面的推荐顺序

如果从工程效率、MCP 生态、后续扩展性三个维度综合判断，我建议优先级如下：

### 第一推荐：TypeScript / Node.js
### 第二推荐：Python
### 第三推荐：Go
### 最不推荐作为第一选择：Swift 直接实现 MCP 层

下面分别解释。

---

## 4. 各技术方案对比

# 4.1 方案 A：继续用 Swift 实现 MCP server

## 方案描述
在现有 macOS 项目体系内，继续使用 Swift 编写 MCP server，可能有两种形式：

- 直接内嵌到 `LocalBridgeMac` App
- 或用 Swift 再写一个独立本地服务

---

## 优点

### 1）语言统一
你当前核心工程已经是 Swift，团队上下文一致。

### 2）如果内嵌，状态共享最直接
若与 App 同进程，可以更方便访问内部状态。

### 3）理论上部署更集中
对于纯本地产品，有时看起来更“统一”。

---

## 缺点

### 1）MCP 生态不占优势
目前 MCP 相关生态、示例、工具库、社区经验，通常更多集中在：
- TypeScript
- Python

Swift 做 MCP 并不是不行，但会明显缺少现成生态支持。

### 2）容易和现有 App 耦合过深
如果 MCP 层继续写进 Swift 主工程，很容易出现：
- Server 逻辑混进 App 逻辑
- 协议层污染现有结构
- 测试和调试边界不清

### 3）上手成本和演进成本可能更高
尤其在以下方面：
- Tool schema 组织
- 开发迭代速度
- MCP 兼容验证
- 文本/JSON/schema 类 glue code 编写效率

### 4）不利于形成“xmcp 式独立服务”心智
你想靠近 xmcp 的架构和调用方式，从形态上讲，独立服务会更自然。

---

## 结论

### 是否可行
可行。

### 是否推荐作为第一阶段首选
**不推荐。**

原因不是 Swift 做不到，而是：

> **Swift 更适合继续承载现有 LocalBridge 内核，不适合作为第一阶段 MCP 适配层的最优选择。**

---

# 4.2 方案 B：独立 TypeScript / Node.js MCP server

## 方案描述
新增一个独立的 Node.js/TypeScript 项目，负责：
- 提供 MCP server
- 注册 tools
- 调用现有 LocalBridge REST API
- 做参数/错误/结果适配

---

## 优点

### 1）最贴近 MCP 生态
Node/TypeScript 通常是 MCP 相关实践里最自然的选择之一，原因包括：
- 生态成熟
- 示例多
- schema 定义与 JSON 操作高效
- tool 注册写起来快
- 与 LLM / Agent 周边集成更顺手

### 2）开发速度快
你当前要做的是一个“协议适配层”，这类工作通常包含很多：
- JSON schema
- HTTP 调用
- 配置
- 错误映射
- 文本描述
- 轻量数据整理

这些任务 TypeScript 的开发效率通常非常高。

### 3）和现有 Swift 工程天然低耦合
MCP server 只通过 REST 调 LocalBridge，边界非常清晰：
- Swift 不用大改
- Node 项目可独立演进
- 出问题时更容易定位层次

### 4）更适合未来继续扩展
后续你还会补：
- 更多 tools
- 更多 schema
- 更多配置和治理能力
- 可能的 resources/prompts

TypeScript 会非常适合这类持续扩展。

### 5）更接近 xmcp 的“独立适配器”形态
从产品感知上更像：
- 现有能力引擎在底层
- 标准协议层独立在上层

---

## 缺点

### 1）新增一个技术栈
如果团队主要是 Swift，会增加少量上下文切换。

### 2）需要处理多进程开发体验
例如：
- LocalBridgeMac 要启动
- MCP server 也要启动
- 联调时需要管理两个进程

### 3）本地分发方式需要考虑
如果将来给用户一体化安装，可能需要考虑如何打包或启动 Node 服务。

不过这通常是第二阶段以后再考虑的问题。

---

## 结论

### 是否可行
非常可行。

### 是否推荐
**最推荐。**

如果你问我：
> 站在“最快落地 + 最小侵入 + 最像 xmcp + 后续最好扩展”的角度，选什么？

我的答案是：

> **独立 TypeScript MCP server + 复用 LocalBridge REST API。**

---

# 4.3 方案 C：独立 Python MCP server

## 方案描述
新增一个独立 Python 项目，承担和 TypeScript 方案相同的职责。

---

## 优点

### 1）同样拥有不错的 MCP / AI 生态
Python 在 AI 周边工程里的生态也非常成熟。

### 2）快速开发能力强
如果团队更偏 Python，这也是很高效的方案。

### 3）处理数据和轻量转换很方便
对 raw payload 做轻量提取、数据整理、日志处理都很顺手。

---

## 缺点

### 1）在前端/桌面周边集成场景里，不一定比 TS 更自然
因为你现在的目标更偏“本地 agent bridge + 协议服务”，TypeScript 往往更贴近工具型服务的工程风格。

### 2）如果上游工具链偏 Node，生态协同感略弱
这不是硬伤，但从工程感觉上，Node 通常会更像“协议层/工具层”的第一选择。

---

## 结论

### 是否可行
可行。

### 是否推荐
**推荐，但次于 TypeScript。**

如果你的团队对 Python 更熟，而对 TypeScript 不熟，那 Python 完全可以成为现实选择。

---

# 4.4 方案 D：独立 Go MCP server

## 方案描述
新增一个独立 Go 项目，承担 MCP server 职责。

---

## 优点

### 1）和现有 Go bridge 有语言亲近性
如果你未来想让某些桥接逻辑和 MCP 层更靠近，Go 在系统服务方面有优势。

### 2）部署和运行性能好
Go 做本地服务非常稳。

### 3）单文件分发体验好
后续如果想做独立二进制，Go 也很有吸引力。

---

## 缺点

### 1）MCP 工具层开发体验未必比 TS/Python 更顺手
尤其在：
- schema 定义
- 文本配置
- 工具描述迭代
- 轻量数据塑形

### 2）首版开发效率可能不如 TS/Python
你当前第一优先是快速验证模型，而不是追求运行时最优。

### 3）容易让职责边界变得暧昧
现有系统里已经有 Go bridge，如果 MCP 再用 Go，团队后续可能会不自觉地让 MCP 和 bridge 边界混起来。

---

## 结论

### 是否可行
可行。

### 是否推荐
**作为后续优化路线可以考虑，但不建议作为第一阶段首选。**

---

## 5. 最终技术选型建议

## 5.1 推荐技术路线

### 推荐路线
- `LocalBridgeMac`：继续保持 Swift，作为能力引擎
- `LocalBridge MCP Server`：使用 TypeScript 实现独立 MCP 服务
- MCP 与 LocalBridge 之间：优先通过现有 REST API 通信

也就是：

> **Swift 负责能力，TypeScript 负责协议适配。**

这是目前最平衡的方案。

---

## 5.2 为什么这是最适合你的方案

因为它同时满足四件事：

### 1）最小侵入
不需要大改现有 Swift 工程。

### 2）最快落地
MCP schema、tool registry、HTTP adapter 这些在 TS 里开发效率高。

### 3）最贴近 xmcp 形态
MCP 层是独立服务，而不是 App 内部特性。

### 4）最好演进
未来补 tool、补治理、补 resources/prompts 都更顺畅。

---

## 6. 项目结构建议

下面给出推荐的仓库结构方向。

## 6.1 推荐目录结构

在 `localBridge/apple/LocalBridgeMac` 同级或其下新增一个独立 MCP 目录。

### 推荐结构方案 A：放在 `LocalBridgeMac` 内部子目录

```text
localBridge/apple/LocalBridgeMac/
├── ...现有 Swift 工程文件
├── doc/
├── mcp-server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── server/
│   │   ├── config/
│   │   ├── tools/
│   │   ├── adapters/
│   │   ├── schemas/
│   │   ├── errors/
│   │   ├── logging/
│   │   └── utils/
│   └── README.md
```

### 优点
- 与当前工程靠得近
- 文档和代码在同一上下文里
- 方便本地一体化开发

### 缺点
- 目录上会让 Swift 工程和 Node 工程混在一个层级

---

### 推荐结构方案 B：放在 `apple/` 下的并列目录

```text
localBridge/apple/
├── LocalBridgeMac/
│   ├── ...现有 Swift 工程
│   └── doc/
└── LocalBridgeMCP/
    ├── package.json
    ├── tsconfig.json
    ├── src/
    └── README.md
```

### 优点
- 工程边界更清晰
- 更像两个协作项目
- 后续独立发布更方便

### 缺点
- 与现有文档引用稍微分散一些

---

## 6.2 我的推荐

**更推荐方案 B：并列目录。**

原因：
- 结构最清晰
- 最符合“能力引擎”和“协议层”分离
- 后续独立构建、独立发布、独立测试都更自然

如果你当前更希望先快速试验，也可以先用方案 A，跑通后再拆分。

---

## 7. MCP 项目内部结构建议

如果使用 TypeScript，我建议内部这样分层。

## 7.1 `src/index.ts`
职责：
- 入口文件
- 启动 server
- 装配 config、adapter、tools

---

## 7.2 `src/config/`
职责：
- 配置定义
- 默认值
- 配置文件读取
- 环境变量支持

建议包含：
- `config.ts`
- `types.ts`
- `defaults.ts`

---

## 7.3 `src/server/`
职责：
- MCP server 初始化
- tool 注册
- 生命周期管理

建议包含：
- `createServer.ts`
- `registerTools.ts`

---

## 7.4 `src/adapters/`
职责：
- 与 LocalBridge 通信
- HTTP 请求封装
- endpoint 映射
- 结果原始获取

建议包含：
- `localBridgeClient.ts`
- `xApiAdapter.ts`

这是整个低侵入方案的关键模块。

---

## 7.5 `src/tools/`
职责：
- 每个 MCP tool 独立实现
- 参数校验
- 调用 adapter
- 返回结果包装

建议按领域分目录：

```text
tools/
├── context/
│   ├── listXInstances.ts
│   ├── getXStatus.ts
│   └── getXBasicInfo.ts
├── read/
│   ├── getHomeTimeline.ts
│   ├── getTweet.ts
│   ├── getTweetReplies.ts
│   ├── getUserProfile.ts
│   ├── searchTweets.ts
│   └── getUserTweets.ts
└── write/
    ├── createTweet.ts
    ├── replyTweet.ts
    ├── likeTweet.ts
    └── retweetTweet.ts
```

---

## 7.6 `src/schemas/`
职责：
- tool 输入 schema
- 输出结构定义
- 可复用的参数片段

建议包含：
- `common.ts`
- `contextSchemas.ts`
- `readSchemas.ts`
- `writeSchemas.ts`

---

## 7.7 `src/errors/`
职责：
- 统一错误码定义
- 错误映射
- 业务错误包装

建议包含：
- `codes.ts`
- `mapError.ts`
- `McpToolError.ts`

---

## 7.8 `src/logging/`
职责：
- 基础日志
- 调用日志
- 审计日志

建议包含：
- `logger.ts`
- `auditLogger.ts`

---

## 7.9 `src/utils/`
职责：
- 小型通用方法
- summary 提取
- meta 构建

建议包含：
- `buildMeta.ts`
- `extractSummary.ts`

---

## 8. 与现有 LocalBridgeMac 的接口边界建议

## 8.1 第一阶段只通过 REST 接口交互

推荐原则：

> **MCP 层第一阶段只依赖 LocalBridge 已有 REST API，不直接依赖 Swift 内部对象。**

这样做的好处：
- 最低耦合
- 最低回归风险
- 最容易单独调试
- 最接近 xmcp 的适配器思想

---

## 8.2 什么时候才考虑直接调用内部能力

只有在以下情况下，才建议给 Swift 层新增专用接口：

- REST API 无法覆盖 MCP 必需能力
- 某些上下文信息无法通过 REST 获取
- 性能问题已经成为瓶颈
- 某类治理能力必须由内核层提供

即使如此，也应优先：
- 补最小 REST endpoint
- 而不是让 MCP 直接耦合进现有 Swift 内部类

---

## 9. 配置与部署结构建议

## 9.1 MCP 配置独立管理

建议 MCP server 拥有自己的配置文件，不要直接复用 App 的用户配置语义。

例如：

```json
{
  "localbridgeBaseUrl": "http://127.0.0.1:10088",
  "enabledTools": [
    "list_x_instances",
    "get_x_status",
    "get_tweet",
    "search_tweets",
    "create_tweet"
  ],
  "readOnlyMode": false,
  "defaultInstanceId": null,
  "requestTimeoutMs": 30000,
  "debugLogging": true,
  "exposeRawPayload": true
}
```

这样可以：
- 保持 MCP 层独立
- 减少对现有配置系统的干扰
- 后续部署更灵活

---

## 9.2 启动方式建议

第一阶段推荐：

### 开发环境
- 手动先启动 LocalBridgeMac
- 再启动 MCP server

### 生产/演示环境
后续可以再考虑：
- 脚本统一启动
- App 内部增加“启动 MCP”按钮
- 包装成本地后台服务

第一阶段不建议过早追求一体化启动。

---

## 10. 测试结构建议

## 10.1 测试分层

建议至少分三层测试：

### A. Adapter 测试
验证：
- REST 调用是否正确
- 超时是否正确
- 错误映射是否正确

### B. Tool 测试
验证：
- 参数校验
- schema 定义
- 返回结构

### C. 端到端联调测试
验证：
- MCP client -> MCP server -> LocalBridge -> X 整条链路

---

## 10.2 为什么测试应主要放在 MCP 项目内部

因为你的目标是：
- 不破坏现有 LocalBridge
- MCP 作为新层独立迭代

所以测试应优先验证：
- 新层自身是否稳定
- 新层与旧层接口是否稳定

而不是反过来去大改旧工程测试结构。

---

## 11. `.gitignore` 与工程管理建议

既然你当前 IDE 打开了 `.gitignore`，这里顺带给出建议。

如果新增 `LocalBridgeMCP` 或 `mcp-server`，建议确保忽略以下内容：

### Node/TS 项目常见忽略项
- `node_modules/`
- `dist/`
- `.env`
- `.DS_Store`
- 日志文件
- 本地调试输出目录

如果放在仓库内，应避免把本地依赖和构建产物提交进去。

---

## 12. 推荐的实际落地方案

结合你的目标，我给出一个最务实的推荐版本：

## 12.1 推荐方案

### 工程结构
在 `localBridge/apple/` 下新增并列目录：
- `LocalBridgeMac/`
- `LocalBridgeMCP/`

### 技术栈
- `LocalBridgeMac`：Swift
- `LocalBridgeMCP`：TypeScript

### 调用方式
- `LocalBridgeMCP` 通过 HTTP 调用 `LocalBridgeMac` 现有 REST API

### 第一阶段功能
只实现：
- tool registry
- 统一 schema
- REST adapter
- 首批 6~10 个核心 tools
- 错误映射
- 只读模式
- 工具白名单

---

## 12.2 为什么这是最佳平衡点

因为它在四个目标之间达成了平衡：

### 对现有工程最安全
几乎不需要改旧逻辑。

### 对 MCP 最友好
独立项目更符合 MCP 服务形态。

### 对后续扩展最有利
未来继续补 tool 不会被旧 App 工程拖住。

### 对 xmcp 对齐最自然
它在结构上已经是“能力引擎 + MCP 适配层”的模式。

---

## 13. 不推荐的路线

这里也明确列出几条当前不推荐的路线。

### 路线 1：直接把 MCP 深度写进 LocalBridgeMac 主工程
问题：
- 耦合高
- 回归风险大
- 后续维护困难

### 路线 2：第一阶段就绕过 REST，直接绑定内部 Swift 类
问题：
- 打破边界
- 侵入性强
- 不利于测试和替换

### 路线 3：第一阶段就做复杂通用插件框架
问题：
- 过度设计
- 与“先落地最小 MCP”目标冲突

### 路线 4：第一阶段就追求完整 xmcp 能力覆盖
问题：
- 战线过长
- 难以快速验证正确方向

---

## 14. 最终结论

如果目标是：
- 不破坏 LocalBridgeMac
- 快速增加 MCP 能力
- 架构上接近 xmcp
- 后续还要持续补能力

那么最合理的技术选型是：

> **将 MCP 层做成独立 TypeScript 项目，与 `LocalBridgeMac` 并列存在，通过现有 REST API 与 LocalBridge 通信。**

这条路线既尊重你当前已有系统，也为未来扩展留出了最好的工程空间。

---

## 15. 一句话总结

> 最推荐的工程方案是保留 Swift 的 `LocalBridgeMac` 作为能力内核，在其旁边新增一个独立的 TypeScript MCP server 项目作为协议适配层，通过清晰的 REST 边界低侵入接入现有能力，并用独立目录、独立配置、独立测试和独立发布方式逐步把产品演进成 xmcp 风格架构。
