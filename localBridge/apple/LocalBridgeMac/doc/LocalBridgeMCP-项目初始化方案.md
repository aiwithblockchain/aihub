# LocalBridgeMCP 项目初始化方案

## 1. 文档目标

本文档用于把前面的方案进一步落到“可以开始创建项目”的层面，帮助你快速初始化一个独立的 `LocalBridgeMCP` 工程。

这份文档重点回答：

1. `LocalBridgeMCP` 项目应该放在哪里
2. 初始目录结构应该如何设计
3. `package.json` 应该如何配置
4. TypeScript 基础配置应该如何设置
5. 第一批源码文件应该有哪些
6. 每个文件的职责是什么
7. 初始化完成后，第一步应该先开发什么

目标不是一次性把全部实现写完，而是：

> **给出一套可以直接照着搭项目骨架的初始化方案，让 `LocalBridgeMCP` 从 0 到可开发状态。**

---

## 2. 推荐项目位置

结合前一份《MCP 技术选型与项目结构建议》，推荐将 `LocalBridgeMCP` 放在 `localBridge/apple/` 下，与 `LocalBridgeMac` 并列。

推荐目录形态：

```text
localBridge/apple/
├── LocalBridgeMac/
│   ├── ...现有 Swift 工程
│   └── doc/
└── LocalBridgeMCP/
    ├── package.json
    ├── tsconfig.json
    ├── .gitignore
    ├── README.md
    ├── src/
    └── scripts/
```

---

## 2.1 为什么推荐并列目录

原因有 4 个：

### 1）边界清晰
- `LocalBridgeMac`：能力引擎
- `LocalBridgeMCP`：MCP 协议适配层

### 2）最符合你的增量目标
不需要把 Node/TS 代码混入 Swift 工程内部。

### 3）便于独立开发与调试
可以单独：
- 安装依赖
- 运行服务
- 做构建
- 做测试

### 4）利于后续独立发布
未来如果要把 `LocalBridgeMCP` 作为单独组件分发，这种结构最自然。

---

## 3. 推荐初始化目标

第一阶段初始化目标很简单：

> **搭建一个可运行的 TypeScript MCP server 项目骨架，具备配置、日志、adapter、tool 注册和首批工具目录结构。**

初始化完成后，不要求立刻实现全部 tools，但至少应具备：

- 能跑 `npm install`
- 能跑开发模式
- 有清晰目录结构
- 有统一配置入口
- 有 MCP server 入口文件
- 有 adapter 和 tool 的最小骨架

---

## 4. 推荐目录结构

下面是一版适合第一阶段的目录树。

```text
LocalBridgeMCP/
├── package.json
├── package-lock.json
├── tsconfig.json
├── .gitignore
├── README.md
├── src/
│   ├── index.ts
│   ├── config/
│   │   ├── config.ts
│   │   ├── defaults.ts
│   │   └── types.ts
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
│   │   │   └── searchTweets.ts
│   │   └── write/
│   │       ├── likeTweet.ts
│   │       └── createTweet.ts
│   ├── schemas/
│   │   ├── common.ts
│   │   ├── contextSchemas.ts
│   │   ├── readSchemas.ts
│   │   └── writeSchemas.ts
│   ├── errors/
│   │   ├── codes.ts
│   │   ├── mapError.ts
│   │   └── McpToolError.ts
│   ├── logging/
│   │   ├── logger.ts
│   │   └── auditLogger.ts
│   └── utils/
│       ├── buildMeta.ts
│       └── extractSummary.ts
└── scripts/
    └── dev.sh
```

---

## 4.1 目录结构设计原则

### 1）先分层，再分功能
因为 MCP 层的核心是：
- server
- adapter
- tools
- errors
- config

### 2）tool 目录按语义分组
这样后续扩展更自然：
- context
- read
- write

### 3）adapter 独立成层
这是保持低侵入的关键。

### 4）工具实现与 schema 分离
避免一个文件既写业务逻辑又写大段 schema，后续维护会更轻松。

---

## 5. `package.json` 建议

下面是一版适合第一阶段的依赖思路。

## 5.1 推荐脚本

建议 `package.json` 至少包含这些 scripts：

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  }
}
```

---

## 5.2 推荐依赖方向

### 运行时依赖
建议至少包括：
- MCP server SDK
- HTTP client
- schema/validation 工具
- 日志工具（可选）

可选组合示意：
- MCP SDK
- `zod`
- `axios` 或原生 `fetch`
- `pino`（如果你要更正式的日志）

### 开发依赖
建议至少包括：
- `typescript`
- `tsx`
- `@types/node`
- `eslint`（可选但推荐）

---

## 5.3 依赖选择建议

### 参数校验
推荐使用统一 schema 工具，而不要手写大量 if/else 校验。

理由：
- tool schema 更清晰
- 错误更稳定
- 和 MCP tool 定义更契合

### HTTP 客户端
如果你追求最简，可直接用 Node 原生 `fetch`。  
如果你更想统一拦截、超时、错误处理，也可以用 `axios`。

我的建议：

> 第一阶段优先选最简单、最稳定的一套，不要因为 HTTP 客户端本身增加太多工程复杂度。

---

## 6. `tsconfig.json` 建议

第一阶段建议保持简单、严格、易调试。

推荐方向：

- `target`：现代 Node 可支持的 ES 版本
- `module`：符合当前 Node/TS 运行模式
- `rootDir`：`src`
- `outDir`：`dist`
- `strict`：开启
- `esModuleInterop`：开启
- `resolveJsonModule`：开启
- `skipLibCheck`：开启

目标原则：
- 类型尽量严格
- 构建尽量简单
- 不做花哨配置

---

## 7. `.gitignore` 建议

既然你前面打开过 `.gitignore`，这里明确建议 `LocalBridgeMCP` 至少忽略：

```gitignore
node_modules/
dist/
.env
.DS_Store
*.log
coverage/
```

如果后续有本地调试配置，也建议忽略：
- `.local/`
- `tmp/`
- `debug-output/`

原则是：
- 不提交依赖
- 不提交构建产物
- 不提交本地敏感配置
- 不提交临时日志

---

## 8. README 初始内容建议

`README.md` 第一版不需要写很长，但建议至少包含：

### 8.1 项目目的
说明这是：
- LocalBridge 的 MCP 适配层
- 通过现有 LocalBridge REST API 暴露 X 能力

### 8.2 运行前提
例如：
- LocalBridgeMac 已运行
- LocalBridge REST API 已可访问
- tweetClaw 实例在线
- X 已登录

### 8.3 本地启动方式
例如：
- 安装依赖
- 启动 dev server
- 连接 MCP client

### 8.4 配置说明
说明：
- LocalBridge base URL
- enabled tools
- readOnly mode

这会极大降低后续自己回看时的理解成本。

---

## 9. 首批源码文件职责说明

下面把最核心的文件逐个说明。

---

# 9.1 `src/index.ts`

## 职责
项目入口。

负责：
- 读取配置
- 初始化 logger
- 创建 adapter
- 创建 MCP server
- 注册 tools
- 启动服务

## 原则
不要把业务逻辑都写在这里。  
它应只负责装配，不负责实现。

---

# 9.2 `src/config/types.ts`

## 职责
定义配置类型。

建议包含：
- `localbridgeBaseUrl`
- `enabledTools`
- `readOnlyMode`
- `defaultInstanceId`
- `requestTimeoutMs`
- `debugLogging`
- `exposeRawPayload`

---

# 9.3 `src/config/defaults.ts`

## 职责
定义默认配置值。

建议初始默认值示例：
- `localbridgeBaseUrl = http://127.0.0.1:10088`
- `readOnlyMode = false`
- `requestTimeoutMs = 30000`
- `debugLogging = true`
- `exposeRawPayload = true`

---

# 9.4 `src/config/config.ts`

## 职责
读取并合并配置。

建议能力：
- 读取默认值
- 合并本地配置文件
- 基本校验
- 导出统一 config 对象

第一阶段不一定要做复杂多来源配置，先支持：
- 默认值
- 本地 JSON 配置文件

就够用了。

---

# 9.5 `src/server/createServer.ts`

## 职责
创建 MCP server 实例。

负责：
- 初始化 server
- 注入 logger、config、adapter
- 提供 server 对象给入口文件

---

# 9.6 `src/server/registerTools.ts`

## 职责
集中注册所有 tools。

好处：
- 清楚看到当前暴露了哪些工具
- 更方便按 `enabledTools` 做过滤
- 新增 tool 时修改点明确

---

# 9.7 `src/adapters/localBridgeClient.ts`

## 职责
封装对 LocalBridge REST API 的基础 HTTP 调用。

建议职责尽量纯粹：
- `GET`
- `POST`
- `DELETE`
- 超时
- HTTP 错误处理
- 原始响应返回

它不应该理解“tweet”“timeline”这些业务语义，只负责通信。

---

# 9.8 `src/adapters/xApiAdapter.ts`

## 职责
在基础 HTTP client 之上，封装 X 域能力调用。

例如提供：
- `listInstances()`
- `getXStatus()`
- `getXBasicInfo()`
- `getTweet()`
- `searchTweets()`
- `createTweet()`
- `likeTweet()`

这样 tool 层就不需要直接拼 URL 和 body。

这是很重要的中间层。

---

# 9.9 `src/tools/...`

## 职责
每个 tool 一个文件，负责：
- 输入参数校验
- 调用 adapter
- 结果包装
- meta 填充
- 错误转换

建议一个文件只做一个 tool，避免后续不断膨胀。

---

# 9.10 `src/schemas/common.ts`

## 职责
放通用 schema 片段，例如：
- `instanceId`
- `tabId`
- `timeoutMs`
- 通用返回结构

这样能避免多个 tool 重复定义。

---

# 9.11 `src/errors/codes.ts`

## 职责
定义统一错误码常量。

建议先支持：
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

---

# 9.12 `src/errors/mapError.ts`

## 职责
把：
- HTTP 错误
- adapter 错误
- schema 错误
- 上游执行错误

映射成统一 MCP tool 错误。

---

# 9.13 `src/logging/logger.ts`

## 职责
基础日志输出。

第一阶段建议日志要足够简单，但至少包含：
- 服务启动
- tool 调用
- 调用成功/失败
- 错误码

---

# 9.14 `src/logging/auditLogger.ts`

## 职责
后续做审计日志时用。  
第一阶段可以先有最小骨架，即使先不完全实现。

---

# 9.15 `src/utils/buildMeta.ts`

## 职责
统一构建 tool 返回里的 `meta` 对象。

例如：
- `instanceId`
- `tabId`
- `usedDefaultRouting`
- `source`
- `toolVersion`

---

# 9.16 `src/utils/extractSummary.ts`

## 职责
做轻量摘要提取。

第一阶段建议只做简单提取，不做深层解析。

例如：
- 从 basic info 提取 screen name
- 从 tweet 提取 text / author
- 从 search 提取 next cursor

---

## 10. 推荐首批实现文件顺序

为了尽快开工，建议按这个顺序创建文件。

### 第 1 批：项目骨架
1. `package.json`
2. `tsconfig.json`
3. `.gitignore`
4. `README.md`
5. `src/index.ts`

### 第 2 批：基础运行层
6. `src/config/types.ts`
7. `src/config/defaults.ts`
8. `src/config/config.ts`
9. `src/logging/logger.ts`
10. `src/server/createServer.ts`
11. `src/server/registerTools.ts`

### 第 3 批：适配层
12. `src/adapters/localBridgeClient.ts`
13. `src/adapters/xApiAdapter.ts`
14. `src/errors/codes.ts`
15. `src/errors/McpToolError.ts`
16. `src/errors/mapError.ts`

### 第 4 批：首个测试 tool
17. `src/tools/context/listXInstances.ts`
18. `src/schemas/common.ts`
19. `src/schemas/contextSchemas.ts`
20. `src/utils/buildMeta.ts`

### 第 5 批：扩展首批核心 tools
21. `getXStatus.ts`
22. `getXBasicInfo.ts`
23. `getTweet.ts`
24. `searchTweets.ts`
25. `likeTweet.ts`
26. `createTweet.ts`

这个顺序能让你尽快看到成果，而不是长时间停留在“搭框架”。

---

## 11. 推荐初始化后的第一个可运行目标

初始化后，第一个可运行目标不应该是“全部 tool 完成”，而应该是：

> **MCP server 能启动，并且 `list_x_instances` 能正常调用 LocalBridge 返回结果。**

为什么是它？

因为它具备这些优点：
- 读操作，风险低
- 输入简单
- 可验证 REST adapter
- 可验证 tool registry
- 可验证返回包装
- 可验证 MCP client 联调

这是最好的“第一个通路”。

---

## 12. 推荐初始化后第二阶段目标

在 `list_x_instances` 成功后，建议依次做：

1. `get_x_status`
2. `get_x_basic_info`
3. `get_tweet`
4. `search_tweets`
5. `like_tweet`
6. `create_tweet`

这样可以按从低风险到高风险逐步推进。

---

## 13. 初始化时不建议做的事情

为了避免过度设计，初始化阶段不建议做：

### 1）不先做复杂插件架构
当前还不需要“通用 provider system”。

### 2）不先做所有 tools
先做首批高价值 tools 即可。

### 3）不先做过重测试框架
可以先保留最小测试计划，等首个 tool 跑通再补更多自动化测试。

### 4）不先做复杂发布系统
当前最重要的是本地开发可跑通。

### 5）不先做深度 GraphQL 解析器
第一阶段坚持 raw payload + 轻量 summary。

---

## 14. 推荐的开工顺序总结

如果你今天就开始创建项目，我建议实际顺序是：

### Step 1
创建 `LocalBridgeMCP/` 目录

### Step 2
创建：
- `package.json`
- `tsconfig.json`
- `.gitignore`
- `README.md`

### Step 3
创建 `src/` 基础目录结构

### Step 4
写 `config`、`logger`、`server` 最小骨架

### Step 5
写 `localBridgeClient` 与 `xApiAdapter`

### Step 6
先实现 `list_x_instances`

### Step 7
让 MCP client 实际连上它

这条路径最短，也最符合“先验证模型”的目标。

---

## 15. 最终建议

从初始化角度看，你当前最应该追求的是：

- 边界清晰
- 结构简洁
- 最快开工
- 易于逐步扩展

所以最佳初始化策略不是一上来做复杂工程，而是：

> **先搭一个独立、清晰、轻量的 TypeScript MCP 项目骨架，围绕 LocalBridge REST API 建立 adapter 和首批 tool 注册能力，再从一个最简单的读工具开始验证整个调用链。**

---

## 16. 一句话总结

> `LocalBridgeMCP` 最适合初始化为一个与 `LocalBridgeMac` 并列的独立 TypeScript 项目，具备清晰的 config / server / adapter / tools / schemas / errors / logging 分层，并以 `list_x_instances` 作为第一个跑通的 MCP tool，从而用最小成本把方案推进到真正可开发状态。
