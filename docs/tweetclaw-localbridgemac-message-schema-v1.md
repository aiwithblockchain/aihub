# TweetClaw <-> LocalBridgeMac Message Schema v1

## 文档定位

这份文档不是实现说明，而是协议常量表。

它的用途只有一个：

- 让负责 `tweetClaw` 的 AI
- 和负责 `LocalBridgeMac` 的 AI
- 使用完全一致的消息结构

如果实现代码与本文件冲突，以本文件为准。

如果业务说明文档与本文件冲突：

- 字段名
- 可空规则
- 消息类型字符串
- 错误码

以上四项一律以本文件为准。

## 弱算力 AI 的使用规则

如果你是负责执行的 AI，请把这份文档当成“抄写标准”，不要当成“设计参考”。

你需要做的事情只有：

- 照抄字段名
- 照抄消息类型
- 照抄可空规则
- 照抄错误码

你不需要做的事情：

- 不要优化命名
- 不要新增字段
- 不要重命名 `id`
- 不要把 `payload` 改成 `data`
- 不要把 `response.error` 改成别的名字

如果你的代码与本文件不一致，优先改代码，不要改文档。

## 适用范围

本文件只覆盖第一阶段协议：

- 建立 WebSocket 连接
- 完成 hello 握手
- 完成应用层 heartbeat
- 完成 `query_x_tabs_status` 请求与响应
- 完成错误响应

本文件不覆盖：

- 点赞
- 转发
- 发推
- 多客户端路由
- 鉴权
- 多应用频道

## 协议版本

- 协议名：`aihub-localbridge`
- 协议版本：`v1`

建议常量：

### TypeScript

```ts
export const PROTOCOL_NAME = 'aihub-localbridge';
export const PROTOCOL_VERSION = 'v1';
```

### Swift

```swift
let protocolName = "aihub-localbridge"
let protocolVersion = "v1"
```

## 命名规则

### 消息类型命名

统一使用以下格式：

- `client.xxx`
- `server.xxx`
- `request.xxx`
- `response.xxx`

本阶段禁止新增自定义前缀。

### JSON 字段命名

统一使用 `camelCase`。

例如：

- `heartbeatIntervalMs`
- `activeXTabId`

禁止混用：

- `snake_case`
- `PascalCase`

## 消息总原则

### 原则 1

每条消息都必须带完整外层字段。

禁止发送裸 payload。

### 原则 2

所有消息都必须是 UTF-8 JSON 文本帧。

本阶段不要使用二进制帧。

### 原则 3

所有请求和响应都必须使用同一个 `id`。

例如：

- 请求 `id = req_001`
- 对应响应也必须 `id = req_001`

### 原则 4

本阶段所有时间都使用毫秒时间戳。

例如：

- `1710000000000`

## 通用消息外层

每条消息都必须符合以下结构：

```json
{
  "id": "req_001",
  "type": "request.query_x_tabs_status",
  "source": "LocalBridgeMac",
  "target": "tweetClaw",
  "timestamp": 1710000000200,
  "payload": {}
}
```

## 通用字段定义

### `id`

- 类型：`string`
- 必填：是
- 可空：否
- 规则：同一条 request-response 链路中保持一致

推荐格式：

- `msg_hello_001`
- `ping_001`
- `req_001`

### `type`

- 类型：`string`
- 必填：是
- 可空：否
- 规则：必须来自本文定义的常量

### `source`

- 类型：`string`
- 必填：是
- 可空：否

本阶段允许值只有两个：

- `tweetClaw`
- `LocalBridgeMac`

### `target`

- 类型：`string`
- 必填：是
- 可空：否

本阶段允许值只有两个：

- `tweetClaw`
- `LocalBridgeMac`

### `timestamp`

- 类型：`number`
- 必填：是
- 可空：否
- 规则：毫秒时间戳

### `payload`

- 类型：`object`
- 必填：是
- 可空：否
- 规则：即使没有业务字段，也必须传空对象 `{}`

## v1 明确不存在的字段

为了防止执行 AI 自己脑补，这里明确写死：

本阶段顶层消息中不存在以下字段：

- `requestId`
- `messageId`
- `event`
- `data`

不要把这些字段加到顶层。

本阶段顶层只允许这 6 个字段：

- `id`
- `type`
- `source`
- `target`
- `timestamp`
- `payload`

## 消息类型常量表

本阶段唯一允许的消息类型如下：

| type | 发送方 | 接收方 | 用途 |
|---|---|---|---|
| `client.hello` | `tweetClaw` | `LocalBridgeMac` | 客户端上线自报身份 |
| `server.hello_ack` | `LocalBridgeMac` | `tweetClaw` | 服务端确认连接参数 |
| `ping` | `tweetClaw` | `LocalBridgeMac` | 应用层心跳 |
| `pong` | `LocalBridgeMac` | `tweetClaw` | 心跳应答 |
| `request.query_x_tabs_status` | `LocalBridgeMac` | `tweetClaw` | 请求查询 X 页面基础状态 |
| `response.query_x_tabs_status` | `tweetClaw` | `LocalBridgeMac` | 返回 X 页面基础状态 |
| `response.error` | 任意一方 | 任意一方 | 返回错误信息 |

## 可复用数据结构

### XTabInfo

```json
{
  "tabId": 123,
  "url": "https://x.com/home",
  "active": true
}
```

字段定义：

- `tabId`
  - 类型：`number`
  - 必填：是
  - 可空：否
- `url`
  - 类型：`string`
  - 必填：是
  - 可空：否
- `active`
  - 类型：`boolean`
  - 必填：是
  - 可空：否

本阶段不要增加：

- `title`
- `favIconUrl`
- `windowId`
- `status`

## 各消息详细定义

### 1. `client.hello`

发送时机：

- `tweetClaw` WebSocket 连接建立成功后立即发送

完整示例：

```json
{
  "id": "msg_hello_001",
  "type": "client.hello",
  "source": "tweetClaw",
  "target": "LocalBridgeMac",
  "timestamp": 1710000000000,
  "payload": {
    "protocolName": "aihub-localbridge",
    "protocolVersion": "v1",
    "clientName": "tweetClaw",
    "clientVersion": "0.3.17",
    "browser": "chrome",
    "capabilities": [
      "query_x_tabs_status"
    ]
  }
}
```

`payload` 字段定义：

- `protocolName`
  - 类型：`string`
  - 必填：是
  - 固定值：`aihub-localbridge`
- `protocolVersion`
  - 类型：`string`
  - 必填：是
  - 固定值：`v1`
- `clientName`
  - 类型：`string`
  - 必填：是
  - 固定值：`tweetClaw`
- `clientVersion`
  - 类型：`string`
  - 必填：是
- `browser`
  - 类型：`string`
  - 必填：是
  - 本阶段固定值：`chrome`
- `capabilities`
  - 类型：`string[]`
  - 必填：是
  - 最小值：`["query_x_tabs_status"]`

### 2. `server.hello_ack`

发送时机：

- `LocalBridgeMac` 收到合法的 `client.hello` 后立即发送

完整示例：

```json
{
  "id": "msg_hello_001",
  "type": "server.hello_ack",
  "source": "LocalBridgeMac",
  "target": "tweetClaw",
  "timestamp": 1710000000100,
  "payload": {
    "protocolName": "aihub-localbridge",
    "protocolVersion": "v1",
    "serverName": "LocalBridgeMac",
    "serverVersion": "0.1.0",
    "heartbeatIntervalMs": 20000
  }
}
```

`payload` 字段定义：

- `protocolName`
  - 类型：`string`
  - 必填：是
  - 固定值：`aihub-localbridge`
- `protocolVersion`
  - 类型：`string`
  - 必填：是
  - 固定值：`v1`
- `serverName`
  - 类型：`string`
  - 必填：是
  - 固定值：`LocalBridgeMac`
- `serverVersion`
  - 类型：`string`
  - 必填：是
- `heartbeatIntervalMs`
  - 类型：`number`
  - 必填：是
  - 本阶段固定值：`20000`

### 3. `ping`

发送时机：

- `tweetClaw` 在连接稳定后每 20 秒发送一次

完整示例：

```json
{
  "id": "ping_001",
  "type": "ping",
  "source": "tweetClaw",
  "target": "LocalBridgeMac",
  "timestamp": 1710000000200,
  "payload": {
    "heartbeatIntervalMs": 20000
  }
}
```

`payload` 字段定义：

- `heartbeatIntervalMs`
  - 类型：`number`
  - 必填：是
  - 固定值：`20000`

### 4. `pong`

发送时机：

- `LocalBridgeMac` 收到 `ping` 后立即发送

完整示例：

```json
{
  "id": "ping_001",
  "type": "pong",
  "source": "LocalBridgeMac",
  "target": "tweetClaw",
  "timestamp": 1710000000201,
  "payload": {}
}
```

`payload`：

- 固定为空对象：`{}`

### 5. `request.query_x_tabs_status`

发送时机：

- `LocalBridgeMac` 用户点击按钮后发送

完整示例：

```json
{
  "id": "req_001",
  "type": "request.query_x_tabs_status",
  "source": "LocalBridgeMac",
  "target": "tweetClaw",
  "timestamp": 1710000000300,
  "payload": {}
}
```

`payload`：

- 固定为空对象：`{}`

### 6. `response.query_x_tabs_status`

发送时机：

- `tweetClaw` 收到 `request.query_x_tabs_status` 并处理成功后发送

完整示例：

```json
{
  "id": "req_001",
  "type": "response.query_x_tabs_status",
  "source": "tweetClaw",
  "target": "LocalBridgeMac",
  "timestamp": 1710000000350,
  "payload": {
    "hasXTabs": true,
    "isLoggedIn": true,
    "activeXTabId": 123,
    "activeXUrl": "https://x.com/home",
    "tabs": [
      {
        "tabId": 123,
        "url": "https://x.com/home",
        "active": true
      },
      {
        "tabId": 124,
        "url": "https://x.com/explore",
        "active": false
      }
    ]
  }
}
```

`payload` 字段定义：

- `hasXTabs`
  - 类型：`boolean`
  - 必填：是
  - 可空：否
- `isLoggedIn`
  - 类型：`boolean`
  - 必填：是
  - 可空：否
- `activeXTabId`
  - 类型：`number | null`
  - 必填：是
  - 可空：是
- `activeXUrl`
  - 类型：`string | null`
  - 必填：是
  - 可空：是
- `tabs`
  - 类型：`XTabInfo[]`
  - 必填：是
  - 可空：否

### 7. `response.error`

发送时机：

- 任意请求处理失败时
- 收到未知消息类型时
- JSON 解码失败时也可以主动发送

完整示例：

```json
{
  "id": "req_001",
  "type": "response.error",
  "source": "tweetClaw",
  "target": "LocalBridgeMac",
  "timestamp": 1710000000350,
  "payload": {
    "code": "UNSUPPORTED_MESSAGE_TYPE",
    "message": "Unsupported type: request.unknown",
    "details": null
  }
}
```

`payload` 字段定义：

- `code`
  - 类型：`string`
  - 必填：是
  - 可空：否
- `message`
  - 类型：`string`
  - 必填：是
  - 可空：否
- `details`
  - 类型：`object | null`
  - 必填：是
  - 可空：是

## 错误码常量表

本阶段只允许使用以下错误码：

| code | 含义 | 谁可以发送 |
|---|---|---|
| `INVALID_JSON` | 收到的文本不是合法 JSON | 双方都可以 |
| `INVALID_MESSAGE_SHAPE` | 缺少必要字段或字段类型错误 | 双方都可以 |
| `UNSUPPORTED_MESSAGE_TYPE` | 不支持的 `type` | 双方都可以 |
| `PROTOCOL_VERSION_MISMATCH` | 协议版本不匹配 | 双方都可以 |
| `NOT_CONNECTED` | 当前没有有效连接 | `LocalBridgeMac` |
| `REQUEST_TIMEOUT` | 请求超时未收到响应 | `LocalBridgeMac` |
| `INTERNAL_ERROR` | 内部异常 | 双方都可以 |

本阶段禁止新增自定义错误码。

## 可空规则

弱算力 AI 最容易在“字段是否缺省”上犯错，所以这里单独写死。

### 禁止省略的字段

以下字段任何时候都不能省略：

- `id`
- `type`
- `source`
- `target`
- `timestamp`
- `payload`

### 可以为 `null` 的字段

本阶段只有以下字段允许为 `null`：

- `response.query_x_tabs_status.payload.activeXTabId`
- `response.query_x_tabs_status.payload.activeXUrl`
- `response.error.payload.details`

### 不允许通过“缺少字段”表达空值

错误示例：

```json
{
  "activeXUrlMissing": true
}
```

正确做法：

```json
{
  "activeXUrl": null
}
```

## 双方职责边界

这部分是给执行 AI 的，必须照做。

### 负责 `tweetClaw` 的 AI 只需要实现

- 创建和维护 WebSocket 客户端
- 发送 `client.hello`
- 定时发送 `ping`
- 处理 `server.hello_ack`
- 处理 `request.query_x_tabs_status`
- 返回 `response.query_x_tabs_status`
- 出错时返回 `response.error`

它不需要实现：

- macOS UI
- 按钮
- 服务器监听

### 负责 `LocalBridgeMac` 的 AI 只需要实现

- WebSocket 服务器
- 解析 `client.hello`
- 返回 `server.hello_ack`
- 处理 `ping` 并返回 `pong`
- 用户点击按钮时发送 `request.query_x_tabs_status`
- 接收并打印 `response.query_x_tabs_status`

它不需要实现：

- 浏览器 tabs 查询
- Chrome cookies 查询
- content script 注入逻辑

## 交付前的最终核对

执行 AI 在提交前，必须回答下面 6 个问题，而且答案都要明确。

1. 你发送的每条消息，顶层是否只有 6 个字段。
2. 你是否完全没有发明 `requestId` 这样的替代字段。
3. 你是否在空值场景下使用了 `null`，而不是省略字段。
4. 你是否复用了 request 的 `id` 作为 response 的 `id`。
5. 你是否只使用了本文允许的 `type` 常量。
6. 你是否只使用了本文允许的错误码。

## 弱算力 AI 的最小实现顺序

如果只给一个很弱的 AI 执行，它必须严格按这个顺序编码。

### 先做常量

先把以下字符串抄成常量，不要边写边想：

- `client.hello`
- `server.hello_ack`
- `ping`
- `pong`
- `request.query_x_tabs_status`
- `response.query_x_tabs_status`
- `response.error`

### 再做外层结构

先保证任何消息都能 encode / decode 下面 6 个字段：

- `id`
- `type`
- `source`
- `target`
- `timestamp`
- `payload`

### 再做 3 个最小联通消息

先只做这 3 个：

1. `client.hello`
2. `server.hello_ack`
3. `ping` / `pong`

它们通了之后，再做业务请求。

### 最后做业务请求

最后才做：

- `request.query_x_tabs_status`
- `response.query_x_tabs_status`

## 联调检查表

两侧 AI 交付前，都必须自查这份清单。

### tweetClaw AI 自查

- 是否所有发出的消息都带完整外层字段
- 是否 `source` 固定为 `tweetClaw`
- 是否 `target` 正确
- 是否响应沿用了原始请求 `id`
- 是否 `payload` 从不省略
- 是否 `activeXTabId` 和 `activeXUrl` 在空值时使用 `null`

### LocalBridgeMac AI 自查

- 是否所有发出的消息都带完整外层字段
- 是否 `source` 固定为 `LocalBridgeMac`
- 是否 `target` 正确
- 是否 `pong` 复用了 `ping` 的 `id`
- 是否点击按钮时发送的是 `request.query_x_tabs_status`
- 是否把错误情况转成 `response.error` 或本地日志

## 两个常见错误

### 错误 1：hello_ack 用了新的 id

错误：

- `client.hello.id = msg_hello_001`
- `server.hello_ack.id = msg_hello_ack_001`

正确：

- `server.hello_ack.id` 必须回显 `msg_hello_001`

### 错误 2：没有活跃 X 页时省略字段

错误：

```json
{
  "payload": {
    "hasXTabs": false,
    "isLoggedIn": true,
    "tabs": []
  }
}
```

正确：

```json
{
  "payload": {
    "hasXTabs": false,
    "isLoggedIn": true,
    "activeXTabId": null,
    "activeXUrl": null,
    "tabs": []
  }
}
```

## 与实施文档的关系

本文件只负责协议。

实施顺序、文件拆分、按钮放在哪里、日志怎么打，参考：

- `docs/tweetclaw-localbridgemac-websocket-v1.md`

## 一句话要求

执行 AI 不要发明字段，不要改字段名，不要新增消息类型，先严格照本文件实现，再做别的。
