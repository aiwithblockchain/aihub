# LocalBridgeMCP 首版目录树与文件职责草案

## 1. 文档目标

本文档用于把 `LocalBridgeMCP` 的首版工程结构进一步细化到“文件级”。

相比上一份《LocalBridgeMCP 项目初始化方案》，这份文档更具体，目标是让你可以直接按清单创建文件并开始编码。

本文档会明确：

- 首版推荐目录树
- 每个文件的职责
- 哪些文件是第一阶段必须实现
- 哪些文件可以先做占位
- 每个文件建议先写什么
- 文件之间的依赖关系

目标是：

> **把 LocalBridgeMCP 从“有方案”推进到“可以照着文件清单开工”。**

---

## 2. 首版工程定位

首版 `LocalBridgeMCP` 不追求大而全，而是服务于一个明确目标：

> **尽快做出一个可运行、可注册 tools、可调用 LocalBridge REST API、并能跑通首批核心 X tools 的 MCP 服务。**

因此，首版目录树应该服务于以下优先事项：

1. MCP server 可启动
2. 配置可读取
3. LocalBridge REST 可调用
4. 至少一个 tool 可用
5. 易于继续扩展更多 tools

---

## 3. 推荐首版目录树

推荐目录结构如下：

```text
LocalBridgeMCP/
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md
├── src/
│   ├── index.ts
│   ├── config/
│   │   ├── types.ts
│   │   ├── defaults.ts
│   │   └── config.ts
│   ├── server/
│   │   ├── createServer.ts
│   │   └── registerTools.ts
│   ├── adapters/
│   │   ├── localBridgeClient.ts
│   │   └── xApiAdapter.ts
│   ├── tools/
│   │   ├── context/
│   │   │   ├── listXInstances.ts
│   │   │   ├── getXStatus.ts
│   │   │   └── getXBasicInfo.ts
│   │   ├── read/
│   │   │   ├── getTweet.ts
│   │   │   ├── getHomeTimeline.ts
│   │   │   ├── searchTweets.ts
│   │   │   ├── getTweetReplies.ts
│   │   │   ├── getUserProfile.ts
│   │   │   └── getUserTweets.ts
│   │   └── write/
│   │       ├── likeTweet.ts
│   │       ├── retweetTweet.ts
│   │       ├── replyTweet.ts
│   │       ├── createTweet.ts
│   │       ├── unlikeTweet.ts
│   │       ├── unretweetTweet.ts
│   │       ├── bookmarkTweet.ts
│   │       ├── unbookmarkTweet.ts
│   │       └── deleteMyTweet.ts
│   ├── schemas/
│   │   ├── common.ts
│   │   ├── contextSchemas.ts
│   │   ├── readSchemas.ts
│   │   └── writeSchemas.ts
│   ├── errors/
│   │   ├── codes.ts
│   │   ├── McpToolError.ts
│   │   └── mapError.ts
│   ├── logging/
│   │   ├── logger.ts
│   │   └── auditLogger.ts
│   └── utils/
│       ├── buildMeta.ts
│       ├── extractSummary.ts
│       └── toolResult.ts
└── scripts/
    └── dev.sh
```

---

## 4. 文件分级建议

为了便于实施，建议把这些文件分成 3 个等级。

## 4.1 P0：第一阶段必须实现
这些文件不做，项目无法进入可运行状态。

- `package.json`
- `tsconfig.json`
- `.gitignore`
- `README.md`
- `src/index.ts`
- `src/config/types.ts`
- `src/config/defaults.ts`
- `src/config/config.ts`
- `src/server/createServer.ts`
- `src/server/registerTools.ts`
- `src/adapters/localBridgeClient.ts`
- `src/adapters/xApiAdapter.ts`
- `src/errors/codes.ts`
- `src/errors/McpToolError.ts`
- `src/errors/mapError.ts`
- `src/logging/logger.ts`
- `src/schemas/common.ts`
- `src/schemas/contextSchemas.ts`
- `src/utils/buildMeta.ts`
- `src/utils/toolResult.ts`
- `src/tools/context/listXInstances.ts`

---

## 4.2 P1：首批核心能力建议实现
这些文件做完，项目就具备最小可用 MCP 能力层。

- `src/tools/context/getXStatus.ts`
- `src/tools/context/getXBasicInfo.ts`
- `src/tools/read/getTweet.ts`
- `src/tools/read/getHomeTimeline.ts`
- `src/tools/read/searchTweets.ts`
- `src/tools/write/likeTweet.ts`
- `src/tools/write/createTweet.ts`
- `src/schemas/readSchemas.ts`
- `src/schemas/writeSchemas.ts`
- `src/utils/extractSummary.ts`

---

## 4.3 P2：第二阶段补齐
这些文件可以先占位，等首版稳定后再做。

- `src/tools/read/getTweetReplies.ts`
- `src/tools/read/getUserProfile.ts`
- `src/tools/read/getUserTweets.ts`
- `src/tools/write/retweetTweet.ts`
- `src/tools/write/replyTweet.ts`
- `src/tools/write/unlikeTweet.ts`
- `src/tools/write/unretweetTweet.ts`
- `src/tools/write/bookmarkTweet.ts`
- `src/tools/write/unbookmarkTweet.ts`
- `src/tools/write/deleteMyTweet.ts`
- `src/logging/auditLogger.ts`
- `scripts/dev.sh`

---

## 5. 顶层文件职责

# 5.1 `package.json`

## 职责
项目依赖和 npm scripts 管理。

## 第一版必须具备
- 项目名称
- 版本号
- `dev` script
- `build` script
- `start` script
- `typecheck` script

## 建议先写的内容
先只满足开发和运行，不要在第一版引入太多附加工具链。

---

# 5.2 `tsconfig.json`

## 职责
TypeScript 编译配置。

## 第一版必须具备
- `rootDir: src`
- `outDir: dist`
- `strict: true`
- Node 可运行的模块配置

## 建议先写的内容
先用一套朴素、严格、稳定的配置。

---

# 5.3 `.gitignore`

## 职责
忽略依赖、构建产物和本地临时文件。

## 第一版必须具备
- `node_modules/`
- `dist/`
- `.env`
- `.DS_Store`
- `*.log`

---

# 5.4 `README.md`

## 职责
为未来自己和协作者说明这个项目是什么、怎么跑。

## 第一版建议包含
- 项目目的
- 依赖 LocalBridgeMac 的前提条件
- 本地启动方法
- 配置说明

---

## 6. `src/` 根入口文件职责

# 6.1 `src/index.ts`

## 职责
项目总入口。

## 负责内容
- 读取配置
- 初始化 logger
- 创建 LocalBridge client
- 创建 X adapter
- 创建 MCP server
- 注册 tools
- 启动服务

## 第一版建议只做装配
不要在这里写：
- tool 逻辑
- HTTP 请求逻辑
- 错误映射细节

`index.ts` 应当尽量短，像“启动器”。

---

## 7. `config/` 目录职责

# 7.1 `src/config/types.ts`

## 职责
配置类型定义。

## 建议字段
- `localbridgeBaseUrl`
- `enabledTools`
- `readOnlyMode`
- `defaultInstanceId`
- `requestTimeoutMs`
- `debugLogging`
- `exposeRawPayload`

## 第一版必须实现
是。

---

# 7.2 `src/config/defaults.ts`

## 职责
配置默认值集中定义。

## 建议默认值
- `localbridgeBaseUrl = http://127.0.0.1:10088`
- `readOnlyMode = false`
- `requestTimeoutMs = 30000`
- `debugLogging = true`
- `exposeRawPayload = true`

## 第一版必须实现
是。

---

# 7.3 `src/config/config.ts`

## 职责
配置加载与合并。

## 第一版建议能力
- 读取默认值
- 合并本地配置文件
- 做基础校验
- 输出统一 config

## 第一版必须实现
是。

## 建议先别做
- 复杂多环境配置
- 远程配置
- 过度灵活的配置优先级系统

---

## 8. `server/` 目录职责

# 8.1 `src/server/createServer.ts`

## 职责
创建 MCP server 实例。

## 负责内容
- server 初始化
- 注入 config、logger、adapter
- 暴露 server 对象

## 第一版必须实现
是。

---

# 8.2 `src/server/registerTools.ts`

## 职责
集中注册 MCP tools。

## 负责内容
- 导入 tool 实现
- 根据 `enabledTools` 决定是否注册
- 对 server 执行 tool 挂载

## 第一版必须实现
是。

## 为什么要单独拆出来
因为 tools 会越来越多，集中注册比散落在入口文件里更容易维护。

---

## 9. `adapters/` 目录职责

这是首版最关键的一层。

# 9.1 `src/adapters/localBridgeClient.ts`

## 职责
最底层 HTTP 通信层。

## 负责内容
- GET 请求
- POST 请求
- DELETE 请求
- 超时控制
- HTTP 错误转内部错误

## 不负责内容
- tweet 语义
- tool 语义
- summary 提取

## 第一版必须实现
是。

## 建议提供的方法
- `get(path, options?)`
- `post(path, body, options?)`
- `delete(path, body?, options?)`

---

# 9.2 `src/adapters/xApiAdapter.ts`

## 职责
X 域能力适配层。

## 负责内容
把 REST endpoint 抽象成方法，例如：
- `listInstances()`
- `getXStatus()`
- `getXBasicInfo()`
- `getTweet(tweetId, options)`
- `searchTweets(query, options)`
- `likeTweet(tweetId, options)`
- `createTweet(text, options)`

## 第一版必须实现
是。

## 为什么必须有这层
因为 tool 层不应该直接拼 URL，否则后续改 endpoint 很痛苦。

---

## 10. `errors/` 目录职责

# 10.1 `src/errors/codes.ts`

## 职责
统一错误码定义。

## 第一版建议包含
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

## 第一版必须实现
是。

---

# 10.2 `src/errors/McpToolError.ts`

## 职责
定义 MCP 层内部统一错误对象。

## 第一版建议字段
- `code`
- `message`
- `details?`

## 第一版必须实现
是。

---

# 10.3 `src/errors/mapError.ts`

## 职责
将：
- HTTP 错误
- 配置错误
- 参数错误
- LocalBridge 错误

映射成 MCP 统一错误。

## 第一版必须实现
是。

---

## 11. `logging/` 目录职责

# 11.1 `src/logging/logger.ts`

## 职责
基础日志输出。

## 第一版建议能力
- `info`
- `warn`
- `error`
- `debug`

## 第一版必须实现
是。

## 建议原则
第一版先简单，重点是能看懂调用链。

---

# 11.2 `src/logging/auditLogger.ts`

## 职责
写操作审计日志。

## 第一版必须实现
否，可先占位。

## 何时补
当开始做：
- `create_tweet`
- `reply_tweet`
- `delete_my_tweet`
- 更复杂治理能力

---

## 12. `schemas/` 目录职责

# 12.1 `src/schemas/common.ts`

## 职责
定义通用 schema 片段。

## 建议内容
- `instanceId`
- `tabId`
- `timeoutMs`
- 通用结果结构

## 第一版必须实现
是。

---

# 12.2 `src/schemas/contextSchemas.ts`

## 职责
定义 context 类 tools 的输入 schema。

## 第一版必须实现
是。

## 首批覆盖
- `list_x_instances`
- `get_x_status`
- `get_x_basic_info`

---

# 12.3 `src/schemas/readSchemas.ts`

## 职责
定义 read 类 tools 的输入 schema。

## 第一版必须实现
建议尽早实现。

## 首批覆盖
- `get_tweet`
- `get_home_timeline`
- `search_tweets`

---

# 12.4 `src/schemas/writeSchemas.ts`

## 职责
定义 write 类 tools 的输入 schema。

## 第一版必须实现
建议在写工具落地前实现。

## 首批覆盖
- `like_tweet`
- `create_tweet`

---

## 13. `utils/` 目录职责

# 13.1 `src/utils/buildMeta.ts`

## 职责
统一生成 MCP tool 结果里的 `meta`。

## 建议字段
- `instanceId`
- `tabId`
- `usedDefaultRouting`
- `source`
- `toolVersion`

## 第一版必须实现
是。

---

# 13.2 `src/utils/extractSummary.ts`

## 职责
从原始返回里做轻量摘要。

## 第一版必须实现
否，但建议在首批 read tools 完成后尽快补。

## 建议首批支持
- basic info summary
- tweet summary
- search summary

---

# 13.3 `src/utils/toolResult.ts`

## 职责
统一包装 tool 返回结果。

## 建议提供方法
- `successResult(data, meta)`
- `errorResult(error, meta)`

## 第一版必须实现
是。

这是减少重复代码的关键小工具。

---

## 14. `tools/` 目录职责

原则：**一个 tool 一个文件。**

这样最利于：
- 单独测试
- 单独注册
- 单独迭代
- 以后做 tool 白名单

---

# 14.1 `src/tools/context/listXInstances.ts`

## 职责
实现 `list_x_instances`。

## 第一版必须实现
是。

## 原因
这是最适合拿来打通第一条调用链的 tool：
- 读操作
- 低风险
- 参数简单
- 容易验证成功

## 应先写什么
- schema 引用
- 调 adapter 的 `listInstances()`
- 返回统一结果

---

# 14.2 `src/tools/context/getXStatus.ts`

## 职责
实现 `get_x_status`。

## 第一版优先级
高。

---

# 14.3 `src/tools/context/getXBasicInfo.ts`

## 职责
实现 `get_x_basic_info`。

## 第一版优先级
高。

---

# 14.4 `src/tools/read/getTweet.ts`

## 职责
实现 `get_tweet`。

## 第一版优先级
高。

---

# 14.5 `src/tools/read/getHomeTimeline.ts`

## 职责
实现 `get_home_timeline`。

## 第一版优先级
中高。

---

# 14.6 `src/tools/read/searchTweets.ts`

## 职责
实现 `search_tweets`。

## 第一版优先级
高。

---

# 14.7 `src/tools/read/getTweetReplies.ts`

## 职责
实现 `get_tweet_replies`。

## 第一版优先级
第二阶段。

---

# 14.8 `src/tools/read/getUserProfile.ts`

## 职责
实现 `get_user_profile`。

## 第一版优先级
第二阶段。

---

# 14.9 `src/tools/read/getUserTweets.ts`

## 职责
实现 `get_user_tweets`。

## 第一版优先级
第二阶段。

---

# 14.10 `src/tools/write/likeTweet.ts`

## 职责
实现 `like_tweet`。

## 第一版优先级
很高。

## 原因
比 `create_tweet` 风险更低、参数更简单，适合作为首个写工具。

---

# 14.11 `src/tools/write/createTweet.ts`

## 职责
实现 `create_tweet`。

## 第一版优先级
很高，但可略晚于 `like_tweet`。

---

# 14.12 `src/tools/write/retweetTweet.ts`

## 职责
实现 `retweet_tweet`。

## 第一版优先级
第二批高优先。

---

# 14.13 `src/tools/write/replyTweet.ts`

## 职责
实现 `reply_tweet`。

## 第一版优先级
第二批高优先。

---

# 14.14 其余 write 工具文件

包括：
- `unlikeTweet.ts`
- `unretweetTweet.ts`
- `bookmarkTweet.ts`
- `unbookmarkTweet.ts`
- `deleteMyTweet.ts`

## 第一版优先级
可以先占位，后续逐步补齐。

---

## 15. 文件创建顺序建议

如果你马上开始建工程，我建议按下面顺序创建文件。

## 第一轮：先让项目能启动
1. `package.json`
2. `tsconfig.json`
3. `.gitignore`
4. `README.md`
5. `src/index.ts`
6. `src/config/types.ts`
7. `src/config/defaults.ts`
8. `src/config/config.ts`
9. `src/logging/logger.ts`
10. `src/server/createServer.ts`
11. `src/server/registerTools.ts`

目标：MCP 服务骨架跑起来。

---

## 第二轮：打通 LocalBridge 通信
12. `src/errors/codes.ts`
13. `src/errors/McpToolError.ts`
14. `src/errors/mapError.ts`
15. `src/adapters/localBridgeClient.ts`
16. `src/adapters/xApiAdapter.ts`

目标：能访问现有 LocalBridge REST API。

---

## 第三轮：打通第一个 tool
17. `src/schemas/common.ts`
18. `src/schemas/contextSchemas.ts`
19. `src/utils/buildMeta.ts`
20. `src/utils/toolResult.ts`
21. `src/tools/context/listXInstances.ts`

目标：`list_x_instances` 可用。

---

## 第四轮：补首批只读 tools
22. `getXStatus.ts`
23. `getXBasicInfo.ts`
24. `readSchemas.ts`
25. `getTweet.ts`
26. `searchTweets.ts`
27. `getHomeTimeline.ts`
28. `extractSummary.ts`

目标：首批读工具成型。

---

## 第五轮：补首批写 tools
29. `writeSchemas.ts`
30. `likeTweet.ts`
31. `createTweet.ts`

目标：最小互动闭环完成。

---

## 16. 第一阶段建议的“占位文件策略”

为了避免一开始创建过多空实现，可以采用下面的策略：

### 必须真实实现
- 所有 P0 文件
- 首个 P1 工具链所需文件

### 可以先创建占位
- 第二阶段 read tools
- 第二阶段 write tools
- `auditLogger.ts`
- `scripts/dev.sh`

### 不建议过早创建的文件
如果短期不用，就先别建：
- 复杂测试目录
- provider 抽象层
- resources / prompts 目录
- 多环境配置系统

原则是：

> **只创建短期内真的会写内容的文件。**

---

## 17. 编码前的最终建议

在真正开始写代码前，我建议你把首版目标再压缩成一句话：

> 先让 `LocalBridgeMCP` 作为独立 TypeScript 项目启动起来，并跑通 `list_x_instances` 这个 MCP tool。

只要这个目标完成，后续所有扩展都会顺畅很多。

如果一开始就想把：
- 全部 tools
- 全部治理
- 全部 summary
- 全部配置体系

一起做，项目很容易变慢。

---

## 18. 最终建议

首版目录树最重要的价值，不是“看起来完整”，而是：

- 足够清晰
- 足够轻量
- 足够低侵入
- 足够支持后续增长

因此最佳做法是：

> **围绕 `config / server / adapters / tools / schemas / errors / logging / utils` 八个核心目录搭建首版结构，优先实现 P0 文件和 `list_x_instances` 首条通路，再逐步把首批 read/write tools 填进去。**

---

## 19. 一句话总结

> `LocalBridgeMCP` 首版最合理的文件级结构，是以清晰分层的小型 TypeScript 工具服务为核心，先实现 P0 基础文件和 `list_x_instances` 所需最小链路，再按 read tools、write tools、治理能力的顺序逐步把工程从骨架推进到可用产品。
