# Quote Tweet（引用转发）能力技术说明

## 概述

本次改造为现有 `POST /api/v1/x/tweets` 写入链路补充了 Quote Tweet 能力。

在 X/Twitter 网页端，引用转发并不是独立的 mutation，而是复用 `CreateTweet` GraphQL mutation，并通过 `variables.attachment_url` 指定被引用推文的 URL。因此，本方案没有新增独立 REST 端点，而是在现有发推接口上扩展一个可选字段：`attachmentUrl`。

- 不传 `attachmentUrl`：行为保持为普通发推
- 传 `attachmentUrl`：行为变为 quote tweet

该方案已经完成端到端验证，最终创建出的推文响应中 `legacy.is_quote_status == true`。

---

## 实现原理

全链路如下：

```text
调用方（clawBotCli / REST client）
    ↓
localBridge Go REST API
    ↓
WebSocket request.exec_action
    ↓
tweetClaw Background Service Worker
    ↓
tweetClaw Content Script
    ↓
X/Twitter GraphQL CreateTweet
```

Quote Tweet 生效的关键在于两点：

1. 上游调用方能够传入 `attachmentUrl`
2. 最终 Content Script 在调用 `CreateTweet` 时，将其映射为 `attachment_url`

---

## 接口语义

### REST 接口

继续复用现有端点：

```http
POST /api/v1/x/tweets
Content-Type: application/json
```

请求体示例：

### 普通发推

```json
{
  "text": "Hello World"
}
```

### Quote Tweet

```json
{
  "text": "Interesting point!",
  "attachmentUrl": "https://x.com/NASA/status/2049875191166013673"
}
```

### 字段说明

- `text`：要发布的推文正文
- `attachmentUrl`：被引用推文的 URL；存在时表示本次请求是 quote tweet
- `media_ids`：可选，附加媒体 ID 列表
- `tabId` / `instanceId`：可选，用于路由到指定实例或标签页

---

## 关键实现点

### 1. tweetClaw Background SW

文件：`tweetClaw/src/service_work/background.ts`

Background SW 负责接收 WebSocket `ExecActionRequest` 并转发给 Content Script。这里新增了 `attachmentUrl` 的透传支持，避免字段在 Background → Content Script 过程中丢失。

关键点：

- `ExecActionPayload` 增加 `attachmentUrl?: string`
- `execAction()` 从 payload 中解构 `attachmentUrl`
- `chrome.tabs.sendMessage(...)` 时附带 `attachmentUrl`

这是整个链路中最容易遗漏的一层。如果这里只转发旧字段，即使其他层都支持 quote tweet，最终也只会发成普通 tweet。

### 2. tweetClaw Content Script

文件：`tweetClaw/src/content/main_entrance.ts`

在 `EXECUTE_ACTION` 的 `switch (message.action)` 中新增 `quote_tweet` 分支。该分支复用 `CreateTweet`，但在 variables 中补充：

```json
{
  "tweet_text": "...",
  "attachment_url": "https://x.com/.../status/..."
}
```

也就是说：

- `post_tweet` → 普通发推
- `reply_tweet` → 回复推文
- `quote_tweet` → `CreateTweet + attachment_url`

### 3. tweetClaw WebSocket 协议

文件：`tweetClaw/src/bridge/ws-protocol.ts`

更新 `ExecActionRequestPayload`：

- `action` 联合类型增加 `quote_tweet`
- payload 增加 `attachmentUrl?: string`

这保证了本地 bridge 与扩展之间的消息协议具备 quote tweet 的表达能力。

### 4. localBridge Go 类型定义

文件：`localBridge/go-lib/pkg/types/preset_payload.go`

`ExecActionRequest` 新增：

```go
AttachmentURL *string `json:"attachmentUrl,omitempty"`
```

这样 Go 服务端就能正确反序列化来自 REST 请求体的 `attachmentUrl`。

### 5. localBridge REST Handler

文件：`localBridge/go-lib/pkg/restapi/handler.go`

这里是本次修复的关键补丁点。

最初实现中，`POST /api/v1/x/tweets` 固定转发：

```go
h.execAction(w, r, "post_tweet")
```

这会导致即使请求体中已经包含 `attachmentUrl`，后续链路仍然按普通发推处理，因此只会创建普通 tweet，而不会创建 quote tweet。

修复后的行为是：

- 先读取请求体到 `types.ExecActionRequest`
- 如果 `AttachmentURL` 非空，则将 `Action` 设为 `quote_tweet`
- 否则将 `Action` 设为 `post_tweet`
- 再通过 `request.exec_action` 发往 tweetClaw

因此，`attachmentUrl` 不仅要被透传，还必须在 REST 入口处参与 action 决策。

### 6. clawBotCli Python Transport

文件：`localBridge/clawBotCli/clawbot/transport/x_api.py`

`create_tweet_raw(...)` 增加可选参数：

```python
attachment_url: Optional[str] = None
```

当该值存在时，请求体中增加：

```python
payload["attachmentUrl"] = attachment_url
```

### 7. clawBotCli Python Service

文件：`localBridge/clawBotCli/clawbot/services/x_actions.py`

`create_tweet(...)` 增加 `attachment_url` 参数，并透传到 Transport 层。这样 Python 调用方可以直接通过：

```python
client.x.actions.create_tweet(
    text="Interesting point!",
    attachment_url="https://x.com/NASA/status/2049875191166013673",
    instance_id=instance_id,
)
```

发起 quote tweet。

### 8. Python 测试脚本

文件：`localBridge/clawBotCli/tests/test_write_apis.py`

测试脚本新增了 quote 测试能力：

- `--action quote`
- `--quote-url <tweet-url>`

同时测试逻辑不再只校验“是否成功创建 tweet”，而是进一步检查响应中的：

```python
legacy.is_quote_status == True
```

这样可以避免“请求成功但实际上发成普通 tweet”的误判。

### 9. API 文档与镜像目录同步

已同步更新以下文档/镜像内容：

- `localBridge/apple/LocalBridgeMac/api_docs.json`
- `TweetPilot/resources/tweetpilot-home/clawbot/clawbot/transport/x_api.py`
- `TweetPilot/resources/tweetpilot-home/clawbot/clawbot/services/x_actions.py`
- `TweetPilot/resources/tweetpilot-home/clawbot/README.md`

其中 README 已补充：

- `create_tweet(..., attachment_url=...)` 的 quote tweet 用法
- `attachment_url` 不传时为普通发推，传入时为 quote tweet

---

## 兼容性说明

本次改动保持向后兼容：

- 普通发推调用方式不变
- 现有 `POST /api/v1/x/tweets` 调用方无需修改即可继续工作
- 只有在显式传入 `attachmentUrl` 时，才会切换为 quote tweet 行为

因此本改造属于对现有发推能力的非破坏性扩展。

---

## 验证结果

端到端验证已经完成，测试命令示例：

```bash
python3 tests/test_write_apis.py --action quote --quote-url "https://x.com/NASA/status/2049875191166013673" --yes
```

验证通过后，返回的 `create_tweet` 响应中可确认：

- tweet 创建成功
- `legacy.is_quote_status == true`

说明该请求已经被正确识别并执行为 quote tweet，而不是普通发推。

---

## 参考：X GraphQL 请求特征

Quote Tweet 的底层 GraphQL 请求特征如下：

```json
{
  "variables": {
    "tweet_text": "...",
    "attachment_url": "https://x.com/.../status/...",
    "media": {
      "media_entities": [],
      "possibly_sensitive": false
    },
    "semantic_annotation_ids": [],
    "disallowed_reply_options": null
  },
  "queryId": "...",
  "features": { ... }
}
```

成功响应中的典型标志：

```json
{
  "legacy": {
    "is_quote_status": true,
    "quoted_status_id_str": "..."
  }
}
```
