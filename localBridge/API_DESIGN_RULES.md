# LocalBridge REST API Design Rules

## 目的

本文件是 `localBridge/` 下所有对外 REST API 的权威设计规范。

适用对象：

- 面向 `clawbot` 的 REST API
- `AIHub` / `LocalBridge` 对外暴露的 HTTP 接口
- 任何新增、修改、重构的 `localBridge` HTTP API

如果实现代码、临时想法、历史接口习惯与本文件冲突，以本文件为准。

## 上位依据

本规范参考微软的 RESTful Web API 设计最佳做法，并结合本项目落地约束进行收敛。

主要参考：

- Microsoft Learn: RESTful Web API 设计的最佳做法  
  <https://learn.microsoft.com/zh-cn/azure/architecture/best-practices/api-design>

微软文档中对本项目最重要的原则包括：

- API 围绕资源设计，而不是围绕动作设计
- URI 优先使用名词，集合使用复数名词
- 正确使用 `GET` / `POST` / `PUT` / `PATCH` / `DELETE`
- 使用查询参数做分页和筛选
- 对破坏性变更采用明确的版本控制

## 本项目的强制规则

下面这些规则不是建议，而是必须遵守。

### 1. API 必须是资源导向

允许：

- `/api/v1/channels`
- `/api/v1/channels/{channelId}`
- `/api/v1/apps`
- `/api/v1/apps/{appId}/sessions`
- `/api/v1/tasks/{taskId}`

禁止：

- `/api/v1/create-channel`
- `/api/v1/get-session-status`
- `/api/v1/start-browser-task`

解释：

- URI 表达“资源是什么”
- HTTP 方法表达“要对资源做什么”

### 2. URI 必须使用名词

允许：

- `/channels`
- `/sessions`
- `/tasks`
- `/messages`

禁止：

- `/createTask`
- `/run`
- `/execute`
- `/queryStatus`

### 3. 集合一律使用复数名词

允许：

- `/channels`
- `/tasks`
- `/tabs`

禁止：

- `/channel`
- `/task`
- `/tab`

单个资源用 ID 表达：

- `/channels/{channelId}`
- `/tasks/{taskId}`

### 4. URI 层级不要过深

推荐最多保持在：

- `集合`
- `集合/项`
- `集合/项/子集合`

允许：

- `/apps/{appId}/sessions`
- `/channels/{channelId}/messages`

谨慎使用：

- `/apps/{appId}/sessions/{sessionId}/tasks/{taskId}/logs`

如果关系过深，优先拆成独立资源，再通过字段关联。

### 5. API 前缀固定

所有对外 REST API 统一使用：

```text
/api/v1/
```

例如：

- `/api/v1/channels`
- `/api/v1/tasks/{taskId}`

本项目当前固定采用 URI 版本控制。

不要混用：

- 查询参数版本控制
- 自定义 header 版本控制
- 媒体类型版本控制

### 6. 优先使用 JSON

请求和响应默认使用：

```http
Content-Type: application/json
Accept: application/json
```

除非有明确理由，否则不要引入 XML。

## HTTP 方法规范

### GET

用于读取资源。

允许：

- `GET /api/v1/channels`
- `GET /api/v1/channels/{channelId}`
- `GET /api/v1/tasks/{taskId}`

要求：

- 不得产生副作用
- 不得隐式创建资源

常见返回码：

- `200 OK`
- `204 No Content`
- `404 Not Found`

### POST

用于在集合下创建资源，或提交非幂等操作请求。

允许：

- `POST /api/v1/channels`
- `POST /api/v1/tasks`
- `POST /api/v1/messages`

要求：

- 客户端不要自己伪造新资源 URI
- 新资源 URI 由服务端分配

创建成功时优先：

- `201 Created`
- `Location` 响应头指向新资源 URI

### PUT

用于整体替换单个资源。

允许：

- `PUT /api/v1/channels/{channelId}`

要求：

- 语义必须幂等
- 请求体应表达完整资源或完整可替换视图

如果你只是改 1 到 2 个字段，不要优先选 `PUT`，而应考虑 `PATCH`。

### PATCH

用于部分更新资源。

允许：

- `PATCH /api/v1/tasks/{taskId}`
- `PATCH /api/v1/sessions/{sessionId}`

要求：

- 只提交变更字段
- 不能把 `PATCH` 当成任意 RPC 入口

常见返回码：

- `200 OK`
- `400 Bad Request`
- `409 Conflict`

### DELETE

用于删除资源。

允许：

- `DELETE /api/v1/channels/{channelId}`
- `DELETE /api/v1/tasks/{taskId}`

常见返回码：

- `204 No Content`
- `404 Not Found`

## 查询参数规范

### 分页

集合查询统一支持：

- `limit`
- `offset`

示例：

```http
GET /api/v1/tasks?limit=25&offset=0
```

规则：

- 默认值：`limit=25`，`offset=0`
- 服务端必须设置 `limit` 上限
- 超过上限时：
  - 要么截断到最大值
  - 要么返回 `400 Bad Request`
- 具体行为必须写入接口文档

### 筛选

筛选统一使用 query string。

允许：

```http
GET /api/v1/tasks?status=running&channelId=ch_123
```

禁止：

- 用路径表达普通筛选条件
- 用 POST 代替简单筛选查询

### 排序

排序统一使用：

- `sort`
- `order`

示例：

```http
GET /api/v1/tasks?sort=createdAt&order=desc
```

规则：

- `sort` 表示排序字段
- `order` 只能是 `asc` 或 `desc`

## 状态码规范

最少要正确使用以下状态码：

- `200 OK`：读取成功、更新成功、普通成功响应
- `201 Created`：创建成功
- `202 Accepted`：请求已接受，但异步处理尚未完成
- `204 No Content`：删除成功或无响应体成功
- `400 Bad Request`：参数错误、请求体格式错误、业务前置校验不通过
- `401 Unauthorized`：需要认证但未认证
- `403 Forbidden`：已认证但无权限
- `404 Not Found`：资源不存在
- `405 Method Not Allowed`：方法不被支持
- `409 Conflict`：状态冲突
- `422 Unprocessable Entity`：请求格式正确，但语义上无法处理
- `500 Internal Server Error`：服务端内部异常

禁止：

- 无论成功失败都返回 `200`
- 用 `500` 代替客户端错误
- 用 `404` 掩盖参数错误

## 响应结构规范

### 成功响应

资源型成功响应优先直接返回资源表示，而不是包一层过深的 envelope。

允许：

```json
{
  "id": "task_123",
  "status": "running",
  "channelId": "channel_001"
}
```

集合响应建议包含列表和分页信息：

```json
{
  "items": [
    {
      "id": "task_123",
      "status": "running"
    }
  ],
  "limit": 25,
  "offset": 0,
  "total": 1
}
```

### 错误响应

错误响应统一结构：

```json
{
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "limit must be <= 100",
    "details": null
  }
}
```

规则：

- `code`：稳定的机器可读错误码
- `message`：给人看的短错误描述
- `details`：可选的结构化补充信息

不要返回：

- 只有纯文本错误
- 后端堆栈
- 不可解析的 HTML 错误页

## 资源建模规则

### 资源必须对应清晰业务实体

对本项目，优先考虑以下资源：

- `apps`
- `channels`
- `sessions`
- `tasks`
- `messages`
- `tabs`

如果一个 endpoint 不能映射到清晰资源，先暂停设计，重新建模。

### 动作型能力优先收敛为任务资源

对于“让 clawbot 执行一个动作”这种需求，不要优先设计成：

- `POST /api/v1/run`
- `POST /api/v1/execute-like`

优先设计成任务资源：

- `POST /api/v1/tasks`
- `GET /api/v1/tasks/{taskId}`

这样更符合 REST，也更适合异步执行和结果查询。

## LocalBridge 场景专用规则

### 1. 浏览器状态查询是资源查询，不是 RPC

允许：

- `GET /api/v1/tabs`
- `GET /api/v1/sessions/current`

不推荐：

- `POST /api/v1/get-browser-status`

### 2. 应用通道优先抽象为 channel 资源

允许：

- `POST /api/v1/channels`
- `GET /api/v1/channels/{channelId}`
- `POST /api/v1/channels/{channelId}/messages`

### 3. 异步执行优先抽象为 task 资源

例如：

- 创建一个“查询当前 X 页面状态”的任务
- 创建一个“点赞某条推文”的任务
- 创建一个“发推”的任务

都优先抽象为：

- `POST /api/v1/tasks`

然后：

- `GET /api/v1/tasks/{taskId}` 查看状态
- `GET /api/v1/tasks/{taskId}/result` 查看结果

### 4. 本地服务无鉴权不等于接口可以随意设计

即使当前默认只监听本地、无鉴权，也必须保持：

- 资源命名稳定
- 状态码正确
- 请求体和响应体可预测
- 错误结构统一

## 新增 API 时的强制检查清单

任何 AI 或开发者在新增/修改 REST API 前，必须逐项回答：

1. 这个 endpoint 对应的资源是什么。
2. URI 是否使用了名词而不是动词。
3. 集合是否使用了复数名词。
4. HTTP 方法是否符合语义。
5. 如果是创建，是否返回 `201 Created` 和 `Location`。
6. 如果是部分更新，为什么使用 `PATCH`。
7. 是否支持 `limit` / `offset`。
8. 错误响应是否符合统一结构。
9. 是否会引入破坏性变更。
10. 是否需要写入或更新接口文档。

如果其中任意一项答不清楚，不要开始编码。

## 文档与实现要求

任何 REST API 改动，至少必须同步更新以下内容之一：

- OpenAPI / Swagger 文档
- `docs/` 下的接口说明
- 或当前模块下的 API 设计文档

禁止“代码先行、文档缺失”。

## 什么时候必须引用本规范

以下任务必须先读本文件，再动手：

- 设计新的 clawbot-facing API
- 修改已有 REST endpoint
- 评审 API 是否符合 REST 规范
- 为 `localBridge` 新增 HTTP server
- 把 WebSocket 能力外露成 HTTP 接口

## 一句话要求

在 `localBridge` 中，对外接口要看起来像稳定的资源型 HTTP API，而不是随手拼出的 RPC。
