# LocalBridgeMCP 首版 src/index.ts / config / server 骨架草案

## 1. 文档目标

本文档继续把 `LocalBridgeMCP` 往“可直接编码”的方向推进，聚焦首版最核心的启动骨架：

- `src/index.ts`
- `src/config/types.ts`
- `src/config/defaults.ts`
- `src/config/config.ts`
- `src/server/createServer.ts`
- `src/server/registerTools.ts`

这几个文件共同决定了三件事：

1. `LocalBridgeMCP` 能不能启动
2. MCP server 能不能装配起来
3. 首批 tools 能不能被注册进去

所以这份文档的目标是：

> **给出一套接近代码实现层的骨架设计，让你创建 `LocalBridgeMCP` 后，先把“启动与装配层”搭起来。**

---

## 2. 首版骨架的设计原则

在进入文件设计之前，先明确首版骨架遵循的原则。

### 原则 1：入口文件只负责装配
`src/index.ts` 不应该堆满业务逻辑，只负责：
- 读配置
- 初始化 logger
- 初始化 adapter
- 创建 server
- 注册 tools
- 启动服务

### 原则 2：配置层独立
配置的默认值、类型、加载逻辑要拆开，避免未来变成一个大杂烩文件。

### 原则 3：server 层只关心 MCP
`createServer.ts` 和 `registerTools.ts` 不负责 LocalBridge 业务细节，它们只关心：
- MCP server 怎么创建
- tools 怎么注册

### 原则 4：装配优先于抽象
第一阶段不追求“通用依赖注入框架”，只要结构清晰、职责明确即可。

### 原则 5：可逐步扩展
首版要能自然支持你后面继续补：
- 更多 tools
- readOnlyMode
- enabledTools
- routing meta
- audit logging

---

## 3. 首版装配关系

先用一句话概括这 6 个文件之间的关系：

```text
index.ts
  -> loadConfig()
  -> createLogger()
  -> create LocalBridge client
  -> create X adapter
  -> create MCP server
  -> register tools
  -> start MCP server
```

建议的依赖方向：

```text
config/*  ---> index.ts
server/*  ---> index.ts
server/registerTools.ts ---> tools/*
tools/* ---> adapters/*
```

注意：
- `server/*` 不应反向依赖具体业务 tool 实现细节之外的逻辑
- `config/*` 不应依赖 server
- `index.ts` 是总装配点

---

## 4. `src/config/types.ts` 草案

## 4.1 文件职责

这个文件只做一件事：

> 定义 `LocalBridgeMCP` 的配置结构类型。

它不负责：
- 默认值
- 读取文件
- 环境变量
- 运行逻辑

---

## 4.2 建议配置类型

建议首版定义一个主配置类型，例如：

```ts
export interface LocalBridgeMcpConfig {
  localbridgeBaseUrl: string;
  enabledTools: string[] | null;
  readOnlyMode: boolean;
  defaultInstanceId: string | null;
  requestTimeoutMs: number;
  debugLogging: boolean;
  exposeRawPayload: boolean;
}
```

---

## 4.3 字段设计说明

### `localbridgeBaseUrl`
- 类型：`string`
- 作用：MCP 层访问 LocalBridge REST API 的根地址
- 建议默认值：`http://127.0.0.1:10088`

### `enabledTools`
- 类型：`string[] | null`
- 作用：白名单控制暴露哪些 tools
- `null` 可表示“默认全部启用”

### `readOnlyMode`
- 类型：`boolean`
- 作用：统一控制写工具是否允许执行

### `defaultInstanceId`
- 类型：`string | null`
- 作用：当调用方未指定实例时，作为默认路由候选

### `requestTimeoutMs`
- 类型：`number`
- 作用：REST 调用默认超时

### `debugLogging`
- 类型：`boolean`
- 作用：控制是否输出 debug 级日志

### `exposeRawPayload`
- 类型：`boolean`
- 作用：控制 MCP 返回中是否包含 raw payload

---

## 4.4 第一版是否需要更多配置

不建议第一版就在 `types.ts` 里加入太多字段，例如：
- 多环境 profile
- route policy enum
- audit backend 类型
- storage 配置

原因很简单：
- 你的第一版目标是启动和首条链路
- 配置过早膨胀只会增加复杂度

---

## 5. `src/config/defaults.ts` 草案

## 5.1 文件职责

这个文件负责：

> 定义默认配置值。

它不负责读取外部配置，只负责输出一个默认对象。

---

## 5.2 建议内容

建议定义：

```ts
import type { LocalBridgeMcpConfig } from './types';

export const defaultConfig: LocalBridgeMcpConfig = {
  localbridgeBaseUrl: 'http://127.0.0.1:10088',
  enabledTools: null,
  readOnlyMode: false,
  defaultInstanceId: null,
  requestTimeoutMs: 30000,
  debugLogging: true,
  exposeRawPayload: true,
};
```

---

## 5.3 默认值设计理由

### `enabledTools: null`
表示默认不做工具限制，便于开发阶段快速联调。

### `readOnlyMode: false`
开发阶段默认关闭只读模式，方便验证写工具。

### `requestTimeoutMs: 30000`
作为比较稳妥的默认值，后续再按实际链路调整。

### `debugLogging: true`
第一阶段建议默认开，方便排障。

### `exposeRawPayload: true`
符合你当前“尽量保留现有 raw 返回”的策略。

---

## 6. `src/config/config.ts` 草案

## 6.1 文件职责

这个文件负责：

> 将默认配置与外部配置合并，并导出最终运行配置。

第一版建议它保持简单。

---

## 6.2 第一版建议能力

建议第一版 `config.ts` 只支持：

1. 读取 `defaultConfig`
2. 可选读取一个本地 JSON 配置文件
3. 做最基础的结构校验
4. 输出最终 `config`

不要第一版就做：
- 多配置源优先级系统
- 复杂环境变量覆盖矩阵
- 热更新配置

---

## 6.3 推荐函数设计

建议导出一个函数：

```ts
export function loadConfig(): LocalBridgeMcpConfig
```

如果你想提前留扩展空间，也可以：

```ts
export function loadConfig(configPath?: string): LocalBridgeMcpConfig
```

---

## 6.4 推荐逻辑结构

可以按这个顺序：

```text
loadConfig()
  -> 读取默认配置
  -> 查找本地配置文件（如果存在）
  -> 合并覆盖项
  -> 做最小校验
  -> 返回最终 config
```

---

## 6.5 第一版建议的最小校验

至少校验：
- `localbridgeBaseUrl` 非空
- `requestTimeoutMs > 0`
- `enabledTools` 是数组或 null

这类校验已经足够支持首版。

---

## 6.6 一个接近实现的结构草案

```ts
import fs from 'node:fs';
import path from 'node:path';
import type { LocalBridgeMcpConfig } from './types';
import { defaultConfig } from './defaults';

const DEFAULT_CONFIG_FILE = 'localbridge-mcp.config.json';

export function loadConfig(configPath?: string): LocalBridgeMcpConfig {
  const resolvedPath = configPath ?? path.resolve(process.cwd(), DEFAULT_CONFIG_FILE);

  let fileConfig: Partial<LocalBridgeMcpConfig> = {};

  if (fs.existsSync(resolvedPath)) {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    fileConfig = JSON.parse(raw) as Partial<LocalBridgeMcpConfig>;
  }

  const config: LocalBridgeMcpConfig = {
    ...defaultConfig,
    ...fileConfig,
  };

  validateConfig(config);
  return config;
}

function validateConfig(config: LocalBridgeMcpConfig): void {
  if (!config.localbridgeBaseUrl) {
    throw new Error('localbridgeBaseUrl is required');
  }

  if (config.requestTimeoutMs <= 0) {
    throw new Error('requestTimeoutMs must be greater than 0');
  }

  if (config.enabledTools !== null && !Array.isArray(config.enabledTools)) {
    throw new Error('enabledTools must be an array or null');
  }
}
```

这里不是要求你逐字照抄，而是说明：
- 第一版逻辑完全可以很朴素
- 重点是清楚，不是复杂

---

## 7. `src/server/createServer.ts` 草案

## 7.1 文件职责

这个文件负责：

> 创建 MCP server 实例，并返回给入口层继续注册 tools 与启动。

它不负责：
- tool 具体实现
- LocalBridge 业务逻辑
- 启动时的配置读取

---

## 7.2 首版推荐设计

建议让 `createServer.ts` 暴露一个创建函数，例如：

```ts
export function createServer(deps: CreateServerDeps) {
  // return MCP server instance
}
```

其中 `deps` 可以包含：
- `config`
- `logger`
- `xApiAdapter`

---

## 7.3 为什么要传 `deps`

原因很简单：
- 避免 server 文件自己到处 import 运行时状态
- 后续注册 tool 时更容易把依赖传进去
- 有利于测试和替换

这已经足够构成“轻量依赖注入”，没必要做复杂容器。

---

## 7.4 推荐类型草案

```ts
import type { LocalBridgeMcpConfig } from '../config/types';
import type { XApiAdapter } from '../adapters/xApiAdapter';
import type { Logger } from '../logging/logger';

export interface AppDeps {
  config: LocalBridgeMcpConfig;
  logger: Logger;
  xApiAdapter: XApiAdapter;
}

export function createServer(deps: AppDeps) {
  // MCP server 初始化
}
```

这里的关键不是名字，而是模式：
- 把运行依赖集中成一个 `deps`
- 后续 tools 也可以复用这套依赖结构

---

## 7.5 文件内部职责建议

`createServer.ts` 内部建议做这几件事：

1. 创建 MCP server 对象
2. 设置 server 基本元信息
3. 返回 server

它**不应该**在这里：
- 注册全部 tools
- 启动监听
- 写 LocalBridge adapter 逻辑

那些逻辑应留给别的文件。

---

## 8. `src/server/registerTools.ts` 草案

## 8.1 文件职责

这个文件负责：

> 把所有 MCP tools 统一注册到 server 上。

这是后续增长最关键的一个文件。

---

## 8.2 推荐函数签名

建议定义：

```ts
export function registerTools(server: unknown, deps: AppDeps): void
```

后续你可以把 `unknown` 换成 MCP SDK 的实际 server 类型。

如果你想更清晰，也可以：

```ts
export function registerTools(server: McpServer, deps: AppDeps): void
```

---

## 8.3 这个文件应该做什么

建议内部流程是：

```text
registerTools()
  -> 导入所有 tool 定义/实现
  -> 根据 enabledTools 过滤
  -> 逐个注册到 server
```

---

## 8.4 推荐的注册模式

建议不要在这个文件里直接写一大坨匿名逻辑，而是采用：

- 每个 tool 文件导出 `registerXxxTool(deps)`
- `registerTools.ts` 只负责调用它们

例如：

```ts
import { registerListXInstancesTool } from '../tools/context/listXInstances';
import { registerGetXStatusTool } from '../tools/context/getXStatus';

export function registerTools(server: McpServer, deps: AppDeps): void {
  registerListXInstancesTool(server, deps);
  registerGetXStatusTool(server, deps);
}
```

---

## 8.5 如何处理 `enabledTools`

建议第一版就把过滤逻辑放在 `registerTools.ts` 或 tool 注册辅助函数里。

例如思路：

```text
if enabledTools is null -> 全部注册
if enabledTools contains toolName -> 注册
else -> 跳过
```

这样做的好处：
- 控制点集中
- 将来加工具不容易忘记白名单逻辑

---

## 9. `src/index.ts` 草案

## 9.1 文件职责

`index.ts` 是总装配入口。

它的目标只有一个：

> 把 config、logger、adapter、server、tools 连接起来，并启动应用。

---

## 9.2 推荐启动流程

建议 `index.ts` 的执行顺序如下：

```text
main()
  -> loadConfig()
  -> createLogger(config)
  -> create LocalBridge client
  -> create XApiAdapter
  -> createServer(deps)
  -> registerTools(server, deps)
  -> start server
```

---

## 9.3 建议的骨架草案

下面给一版接近实现的结构：

```ts
import { loadConfig } from './config/config';
import { createServer } from './server/createServer';
import { registerTools } from './server/registerTools';
import { createLogger } from './logging/logger';
import { LocalBridgeClient } from './adapters/localBridgeClient';
import { XApiAdapter } from './adapters/xApiAdapter';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ debug: config.debugLogging });

  logger.info('Starting LocalBridgeMCP...');

  const localBridgeClient = new LocalBridgeClient({
    baseUrl: config.localbridgeBaseUrl,
    timeoutMs: config.requestTimeoutMs,
    logger,
  });

  const xApiAdapter = new XApiAdapter({
    client: localBridgeClient,
    logger,
    config,
  });

  const deps = {
    config,
    logger,
    xApiAdapter,
  };

  const server = createServer(deps);
  registerTools(server, deps);

  await server.connect();
  logger.info('LocalBridgeMCP started successfully.');
}

main().catch((error) => {
  console.error('[LocalBridgeMCP] Failed to start:', error);
  process.exit(1);
});
```

这段不是最终代码，而是你首版 `index.ts` 的推荐结构。

---

## 9.4 为什么推荐 `main()`

原因有三个：

1. 启动流程更清楚
2. 后续如果有异步初始化更自然
3. 错误收口更统一

不要把所有初始化逻辑散落在顶层模块里。

---

## 9.5 `index.ts` 里不建议做的事情

第一版不要在 `index.ts` 里直接写：
- HTTP 调用代码
- tool schema
- 错误映射实现
- summary 提取逻辑

否则入口文件会很快失控。

---

## 10. logger 的最小骨架建议

虽然这份文档不是专门写 `logger.ts`，但这几个核心文件依赖 logger，所以这里给一个最小建议。

建议 `logger.ts` 先导出：

```ts
export interface Logger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;
}

export function createLogger(options: { debug: boolean }): Logger {
  // minimal implementation
}
```

这样 `index.ts`、`adapter`、`tools` 后续都能复用同一个 logger 接口。

---

## 11. 首版依赖对象 `AppDeps` 建议

建议尽早统一一个依赖对象类型，方便所有层共用。

例如：

```ts
export interface AppDeps {
  config: LocalBridgeMcpConfig;
  logger: Logger;
  xApiAdapter: XApiAdapter;
}
```

这个类型可以先放在：
- `server/createServer.ts`
- 或单独提成 `src/types/appDeps.ts`

### 第一版建议
如果你想尽量少文件，先放在 `createServer.ts` 也可以。  
等后续文件增多后，再抽出来。

---

## 12. 启动层的第一阶段最小验收标准

如果你把本文件提到的 6 个文件骨架搭起来，建议验收标准是：

### 验收 1：配置可加载
- 没有本地配置文件时能使用默认配置
- 配置缺失时能给出清楚错误

### 验收 2：入口能正常装配依赖
- logger 可创建
- client / adapter 可构造
- server 可创建

### 验收 3：tool 注册链路存在
- `registerTools()` 可调用
- 至少能注册一个 tool

### 验收 4：启动错误可收口
- 启动失败时能明确输出错误
- 进程能以非 0 退出

---

## 13. 第一阶段最优先的真实目标

如果你已经完成了这些骨架文件，我建议下一步目标只锁定为：

> **在 `registerTools.ts` 中成功注册 `list_x_instances`，并让 `src/index.ts` 完整启动 MCP server。**

这是整个 MCP 项目最重要的第一步，因为一旦这一步通了，后面只是不断加工具，而不是再怀疑架构方向。

---

## 14. 不建议在这一层提前引入的复杂度

为了保持节奏，这一阶段不建议引入：

### 1）复杂 DI 容器
`deps` 对象已经足够。

### 2）复杂配置来源系统
先用默认值 + 本地 JSON 文件。

### 3）复杂 server lifecycle 管理
先把启动走通，再考虑优雅关闭等增强。

### 4）复杂插件自动发现机制
先手工导入 tools，最稳定。

---

## 15. 最终建议

从真正开工的角度看，这一层最重要的不是“代码多优雅”，而是：

- `index.ts` 足够短
- `config` 足够清晰
- `server` 足够纯粹
- `deps` 足够稳定
- `registerTools()` 足够集中

所以最推荐的骨架策略是：

> **把 `src/index.ts` 做成总装配器，把 `config/*` 做成最小配置层，把 `createServer.ts` 和 `registerTools.ts` 做成纯 MCP 层，再用一个统一的 `deps` 对象把 adapter、logger 和 config 串起来。**

---

## 16. 一句话总结

> `LocalBridgeMCP` 首版最合理的启动骨架，是由一个只负责装配的 `src/index.ts`、一套简单独立的 `config/*` 文件、一个纯 MCP 的 `createServer.ts`、以及一个集中注册 tools 的 `registerTools.ts` 组成；先把这条启动与注册主链搭稳，再进入 adapter 和首个 tool 的实现阶段。
