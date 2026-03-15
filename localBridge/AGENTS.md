# AGENTS.md for `localBridge/`

本文件适用于 `localBridge/` 目录及其所有子目录。

## 作用范围

当你在 `localBridge/` 下执行以下任务时，必须遵守本文件：

- 设计新的 HTTP / REST API
- 修改已有 REST endpoint
- 把本地能力通过 HTTP 暴露给 `clawbot`
- 评审 API 是否符合 REST 规范
- 编写或更新 API 文档

如果任务与 REST API 无关，例如纯 UI、纯本地 WebSocket、纯平台构建配置，则本文件只提供参考，不是强制流程。

## 强制先读

任何涉及 REST API 的任务，开始编码前必须先阅读：

1. `localBridge/API_DESIGN_RULES.md`

如需外部依据，再阅读：

2. `localBridge/rest-api-governance/references/microsoft-rest-summary.md`

如果你的执行环境支持本地 skill，再同时使用：

3. `localBridge/rest-api-governance/SKILL.md`

## 最高优先级规则

### 1. 以资源建模为先

URI 必须围绕资源，而不是动作。

允许：

- `/api/v1/channels`
- `/api/v1/tasks/{taskId}`

禁止：

- `/api/v1/create-channel`
- `/api/v1/run-task`

### 2. 集合必须使用复数名词

允许：

- `/channels`
- `/tasks`
- `/messages`

禁止：

- `/channel`
- `/task`
- `/message`

### 3. HTTP 方法必须符合语义

- `GET`：读取
- `POST`：创建或提交非幂等请求
- `PUT`：整体替换
- `PATCH`：部分更新
- `DELETE`：删除

不要因为实现方便就乱用 `POST`。

### 4. 状态码必须正确

不要无论成功失败都返回 `200`。

至少要正确区分：

- `200`
- `201`
- `204`
- `400`
- `404`
- `409`
- `500`

### 5. 错误结构必须统一

如果返回错误，必须符合 `API_DESIGN_RULES.md` 中定义的错误响应结构。

### 6. API 前缀固定

所有对外 REST API 统一使用：

```text
/api/v1/
```

不要自己发明：

- `/v1/api/`
- `/rest/v1/`
- header 版本控制

## 设计前必须回答的问题

在新增或修改任何 REST API 之前，必须先明确回答：

1. 这个 endpoint 对应的资源是什么。
2. URI 为什么是这个名字。
3. 为什么选择这个 HTTP 方法。
4. 成功时返回什么状态码。
5. 失败时返回什么状态码。
6. 错误响应结构是什么。
7. 是否需要分页、筛选、排序。
8. 是否会破坏已有兼容性。

如果以上任意一点说不清楚，不要开始编码。

## 实现时的最低输出要求

当你设计、修改或评审一个 `localBridge` REST API 时，输出中必须明确写出：

1. 资源模型
2. URI
3. HTTP 方法
4. 请求体
5. 响应体
6. 状态码
7. 为什么符合 `API_DESIGN_RULES.md`

不要只给代码，不给解释。

## 文档同步要求

任何 REST API 改动都必须同步更新至少一项：

- OpenAPI / Swagger
- `docs/` 下的接口文档
- `localBridge/` 下的 API 设计文档

禁止“只改代码，不补文档”。

## 评审要求

如果任务是 review，优先按下面顺序找问题：

1. URI 是否不是资源导向
2. HTTP 方法是否错误
3. 状态码是否错误
4. 错误结构是否不统一
5. 分页 / 筛选 / 版本策略是否缺失

## 一句话要求

在 `localBridge/` 下，任何对外 HTTP 接口都必须先过 `API_DESIGN_RULES.md`，再进入实现。
