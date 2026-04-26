# LocalBridgeMCP 首个可运行链路：list_x_instances 实现草案

## 1. 文档目标

本文档聚焦 `LocalBridgeMCP` 的第一条真实可运行链路：

> **通过 MCP 暴露 `list_x_instances` tool，并将其路由到 LocalBridge 现有的 `GET /api/v1/x/instances` REST API。**

这条链路的意义不是功能复杂，而是它最适合作为首个端到端验证目标，因为它同时覆盖了：

- MCP server 启动
- tool 注册
- config 加载
- logger 注入
- LocalBridge HTTP 调用
- adapter 封装
- 统一结果包装
- MCP client 侧可发现与可调用

也就是说，只要这条链路跑通，就说明：

> **你的 LocalBridgeMCP 架构方向是成立的。**

---

## 2. 为什么首个 tool 选 `list_x_instances`

相比 `create_tweet`、`get_tweet`、`search_tweets`，`list_x_instances` 有几个明显优势：

### 2.1 低风险
它是读操作，没有副作用。

### 2.2 参数最简单
基本不需要复杂输入。

### 2.3 最能验证底层复用策略
它直接验证：
- MCP 是否能转发到 LocalBridge
- LocalBridge REST 是否能被平滑复用
- 统一响应包装是否可行

### 2.4 多实例场景天然相关
你的系统核心之一就是实例管理，所以它很适合作为第一个“上下文类 tool”。

---

## 3. 首个链路的目标调用关系

这条链路建议明确为：

```text
MCP Client
  -> LocalBridgeMCP tool: list_x_instances
  -> XApiAdapter.listInstances()
  -> LocalBridgeClient.get('/api/v1/x/instances')
  -> LocalBridge REST API
  -> 返回实例列表
  -> MCP 统一结果包装
```

这里最关键的设计原则是：

> **tool 不直接拼 REST URL；tool 只依赖 adapter。**

---

## 4. 本链路涉及的最小文件清单

为了让 `list_x_instances` 跑通，建议至少实现这些文件：

- `src/index.ts`
- `src/config/types.ts`
- `src/config/defaults.ts`
- `src/config/config.ts`
- `src/logging/logger.ts`
- `src/server/createServer.ts`
- `src/server/registerTools.ts`
- `src/adapters/localBridgeClient.ts`
- `src/adapters/xApiAdapter.ts`
- `src/errors/codes.ts`
- `src/errors/McpToolError.ts`
- `src/errors/mapError.ts`
- `src/schemas/common.ts`
- `src/schemas/contextSchemas.ts`
- `src/utils/buildMeta.ts`
- `src/utils/toolResult.ts`
- `src/tools/context/listXInstances.ts`

这就是首个“最小可运行包”。

---

## 5. `localBridgeClient.ts` 实现草案

## 5.1 文件职责

`localBridgeClient.ts` 是最底层 HTTP client，负责：

- 持有 base URL
- 发起 GET 请求
- 统一处理超时
- 统一处理 HTTP 层错误
- 返回解析后的 JSON

它不负责：
- 实例语义
- tool 语义
- MCP 语义

---

## 5.2 推荐构造参数

建议构造参数为：

```ts
interface LocalBridgeClientOptions {
  baseUrl: string;
  timeoutMs: number;
  logger: Logger;
}
```

---

## 5.3 推荐类接口

第一版建议最少提供：

```ts
class LocalBridgeClient {
  constructor(options: LocalBridgeClientOptions) {}

  async get<T>(path: string): Promise<T> {}
}
```

后面再补：
- `post`
- `delete`

但首条链路只需要 `get`。

---

## 5.4 `get()` 方法建议逻辑

建议 `get()` 做这些事：

1. 拼接完整 URL
2. 设置超时控制
3. 发起请求
4. 检查 HTTP status
5. 解析 JSON
6. 返回泛型结果
7. 把底层异常映射成内部错误

---

## 5.5 接近实现的骨架示意

```ts
export class LocalBridgeClient {
  constructor(private readonly options: LocalBridgeClientOptions) {}

  async get<T>(path: string): Promise<T> {
    const url = new URL(path, this.options.baseUrl).toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      this.options.logger.debug('LocalBridge GET request', { url });

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`LocalBridge GET failed: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
```

这只是示意结构，真正实现时建议把错误进一步收敛到 `mapError.ts`。

---

## 6. `xApiAdapter.ts` 实现草案

## 6.1 文件职责

`xApiAdapter.ts` 负责把 LocalBridge 的 REST endpoint 提升为“X 能力方法”。

对于 `list_x_instances`，它应该提供：

```ts
listInstances(): Promise<...>
```

---

## 6.2 为什么必须有这一层

因为如果 tool 直接写：

```ts
client.get('/api/v1/x/instances')
```

那么以后每个 tool 都会：
- 到处拼路径
- 到处知道底层 REST 细节
- 到处处理不同 endpoint 约定

适配层存在的意义就是隔离这些细节。

---

## 6.3 推荐实例类型

建议先定义一个最小实例类型，例如：

```ts
export interface XInstance {
  clientName: string;
  instanceId: string;
  instanceName?: string | null;
  clientVersion?: string;
  capabilities?: string[];
  connectedAt?: string;
  lastSeenAt?: string;
  isTemporary?: boolean;
}
```

返回值则可以是：

```ts
Promise<XInstance[]>
```

---

## 6.4 推荐 `listInstances()` 结构

```ts
export class XApiAdapter {
  constructor(private readonly deps: XApiAdapterDeps) {}

  async listInstances(): Promise<XInstance[]> {
    return this.deps.client.get<XInstance[]>('/api/v1/x/instances');
  }
}
```

如果你想加日志，也可以在这里做轻量记录。

---

## 7. `schemas/contextSchemas.ts` 实现草案

## 7.1 `list_x_instances` 的输入特点

这个 tool 没有必填业务参数，所以 schema 非常简单。

第一版可以支持一个可选参数：
- `timeoutMs`

但为了最小化，也可以第一版直接无参数。

---

## 7.2 推荐 schema 方向

如果使用 `zod`，可以定义：

```ts
export const listXInstancesInputSchema = z.object({
  timeoutMs: z.number().int().positive().optional(),
});
```

如果你想第一版更简单，也可以：

```ts
export const listXInstancesInputSchema = z.object({}).strict();
```

我的建议是：

> 第一版允许 `timeoutMs` 可选，但不强求支持更多参数。

---

## 8. `utils/buildMeta.ts` 实现草案

## 8.1 本 tool 的 meta 特点

`list_x_instances` 本身没有具体实例路由，因此 meta 可以先很简单。

建议至少包含：

```ts
{
  source: 'localbridge-rest',
  toolVersion: 'v1',
  usedDefaultRouting: false,
  instanceId: null,
  tabId: null
}
```

---

## 8.2 建议封装方式

建议提供一个函数：

```ts
export function buildMeta(partial?: Partial<ToolMeta>): ToolMeta
```

这样以后所有 tool 都能复用。

---

## 9. `utils/toolResult.ts` 实现草案

## 9.1 作用

统一成功和失败的返回结构。

建议提供两个函数：

```ts
successResult(data, meta)
errorResult(error, meta)
```

---

## 9.2 对 `list_x_instances` 的成功结构建议

```json
{
  "success": true,
  "data": {
    "instances": [
      {
        "clientName": "tweetClaw",
        "instanceId": "a1b2c3",
        "instanceName": "mac-pro-main",
        "clientVersion": "0.3.17",
        "capabilities": ["query_x_tabs_status"],
        "connectedAt": "2025-01-01T10:00:00Z",
        "lastSeenAt": "2025-01-01T10:05:00Z",
        "isTemporary": false
      }
    ]
  },
  "error": null,
  "meta": {
    "source": "localbridge-rest",
    "toolVersion": "v1",
    "usedDefaultRouting": false,
    "instanceId": null,
    "tabId": null
  }
}
```

---

## 10. `listXInstances.ts` 实现草案

## 10.1 文件职责

这个文件实现真正的 MCP tool 注册逻辑。

推荐模式：

```ts
export function registerListXInstancesTool(server, deps): void
```

---

## 10.2 这个文件应该做什么

它应负责：

1. 定义 tool 名称
2. 定义 tool 描述
3. 定义输入 schema
4. 在 handler 里调用 `xApiAdapter.listInstances()`
5. 用 `toolResult` 包装返回
6. 捕获错误并映射成 MCP 错误

---

## 10.3 推荐 tool 名称

```text
list_x_instances
```

原因：
- 语义清晰
- 与已有文档一致
- 便于未来形成一致的 `x_*` / `tweet_*` 工具命名体系

---

## 10.4 推荐 tool 描述

英文版建议：

> List all currently connected tweetClaw X instances available through LocalBridge. Use this tool to inspect which browser/account execution contexts are online before selecting an instance for read or write operations.

如果你未来要中文内部文档，也可以同步保留中文说明，但对 MCP tool 描述本身，我建议偏英文。

---

## 10.5 推荐 handler 逻辑

```text
handler(input)
  -> parse input schema
  -> call deps.xApiAdapter.listInstances()
  -> build meta
  -> return successResult({ instances }, meta)
catch error
  -> mapError(error)
  -> return errorResult(mappedError, meta)
```

---

## 10.6 接近实现的结构示意

```ts
export function registerListXInstancesTool(server: McpServer, deps: AppDeps): void {
  server.registerTool(
    'list_x_instances',
    {
      description: 'List all currently connected tweetClaw X instances available through LocalBridge.',
      inputSchema: listXInstancesInputSchema,
    },
    async (input) => {
      const meta = buildMeta();

      try {
        const parsed = listXInstancesInputSchema.parse(input ?? {});
        const instances = await deps.xApiAdapter.listInstances();

        return successResult(
          {
            instances,
          },
          meta,
        );
      } catch (error) {
        const mapped = mapError(error);
        return errorResult(mapped, meta);
      }
    },
  );
}
```

注意：这只是骨架思路，不代表 SDK 的最终精确签名必须一模一样。

---

## 11. `registerTools.ts` 中如何接入

`registerTools.ts` 第一版应至少注册这个 tool：

```ts
import { registerListXInstancesTool } from '../tools/context/listXInstances';

export function registerTools(server: McpServer, deps: AppDeps): void {
  registerListXInstancesTool(server, deps);
}
```

如果你同时已经实现了 `enabledTools` 白名单逻辑，可以在这里过滤。

---

## 12. `index.ts` 中如何把链路接起来

这条链路在入口装配中的关键点是：

1. 创建 `LocalBridgeClient`
2. 创建 `XApiAdapter`
3. 组装 `deps`
4. `createServer(deps)`
5. `registerTools(server, deps)`
6. 启动 server

也就是说，`list_x_instances` 的成功，本质上依赖的是：

> **入口装配层 + adapter 层 + tool 注册层 三者一起成立。**

---

## 13. 首个链路的调试建议

建议你把第一条链路的调试目标压缩成下面 4 个检查点。

### 检查点 1：LocalBridge REST 自身可用
先确认：

```bash
curl http://127.0.0.1:10088/api/v1/x/instances
```

返回正常。

### 检查点 2：LocalBridgeClient 单独可访问该接口
哪怕在本地临时日志里打印结果，也要先证明 client 层通。

### 检查点 3：MCP server 能列出 `list_x_instances`
说明 tool 注册链路通了。

### 检查点 4：MCP client 调用后能拿到统一结构结果
说明端到端成立。

---

## 14. 首个链路的最小验收标准

如果你要判断“这条链路是否做完”，建议用下面标准：

### 功能层
- MCP client 能看到 `list_x_instances`
- 调用后能返回实例数组

### 结构层
- 返回有统一 `success/data/error/meta`
- `instances` 放在 `data.instances`

### 错误层
- LocalBridge 未启动时能明确失败
- 超时时能明确失败

### 架构层
- tool 未直接依赖 REST 路径字符串之外的底层实现
- tool 通过 adapter 调用
- `index.ts` 只负责装配

---

## 15. 这条链路跑通后应该立即做什么

一旦 `list_x_instances` 跑通，最合理的下一步顺序是：

1. `get_x_status`
2. `get_x_basic_info`
3. `get_tweet`
4. `search_tweets`
5. `like_tweet`
6. `create_tweet`

原因是：
- 继续从 context/read 工具扩展最自然
- 写操作放后面更稳

---

## 16. 不建议在这条链路里提前加入的复杂度

为了保持第一条链路的推进速度，不建议一开始就加：

- 审计日志
- 复杂 summary 提取
- 默认实例路由
- 多 endpoint 抽象层
- 批量工具自动注册
- 复杂测试框架

第一条链路只需要证明：

> **“MCP tool -> adapter -> LocalBridge REST” 这个方向可以稳定成立。**

---

## 17. 最终建议

如果你准备正式开始写 `LocalBridgeMCP`，请把第一个真实目标固定为：

> **实现并跑通 `list_x_instances`，而不是一开始就追求多个复杂 tools。**

这是最正确的节奏，因为它：
- 技术风险最低
- 架构验证价值最高
- 对现有 LocalBridge 零侵入
- 最快给你一个真正“活着”的 MCP 服务

---

## 18. 一句话总结

> `list_x_instances` 是 LocalBridgeMCP 最适合作为首个端到端验证目标的 tool：它应通过 `listXInstances.ts -> XApiAdapter.listInstances() -> LocalBridgeClient.get('/api/v1/x/instances')` 这条最小链路打通 MCP、adapter 与现有 LocalBridge REST 能力，并用统一结果结构证明整个外挂式 MCP 架构已经成立。
