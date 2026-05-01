# Quote Tweet（引用转发）能力接入方案

## 背景

手动抓包验证：在 X/Twitter 网页端执行 Quote Tweet 时，实际走的是 `CreateTweet` GraphQL mutation，关键参数为 `attachment_url`（值为被引用推文的 URL）。这说明 **quote tweet 不是独立的 mutation，而是 `CreateTweet` 的一种变体**。

当前 tweetClaw 的写操作链路里，`CreateTweet` 已支持普通发推和 reply 两种场景，但 **没有把 `attachment_url` 暴露给上层调用方**。因此 quote tweet 的能力在底层已经具备，只是中间各层没有打通。

## 方案选择

| 方案 | 说明 | 结论 |
|------|------|------|
| 新建独立端点（如 `POST /api/v1/x/quotes`） | 语义清晰，但新增端点需要 Go handler + 文档 + Python client 全链路配合 | 非必要 |
| 仅更新文档，声称现有 API 组合可用 | 实际上当前 `POST /api/v1/x/tweets` 的请求体不支持传 `attachment_url` | 不可行 |
| **扩展现有 `POST /api/v1/x/tweets`** | 新增可选字段 `attachmentUrl`，不传时行为不变（普通发推），传时即为 quote tweet | **采用** |

采用方案三，改动最小，且与 X 的实际 GraphQL 行为一致。

---

## 全链路修改点

从调用方到最终执行，共涉及 **7 个文件**、**5 个层级**：

```
调用方（clawBotCli / REST client）
    ↓
localBridge Go REST API  （接收 HTTP 请求，转成 WS 消息）
    ↓
tweetClaw Background SW  （通过 WS 接收 action，转发给 Content Script）
    ↓
tweetClaw Content Script （构造 GraphQL mutation，调用 X API）
    ↓
Twitter/X GraphQL         （CreateTweet with attachment_url）
```

---

### Layer 1：tweetClaw Background SW（消息转发层）

**文件 1：** `tweetClaw/src/service_work/background.ts`

Background SW 通过 WS 接收 `ExecActionRequest`，再转发给 Content Script。当前 `ExecActionPayload` 接口和 `execAction` 转发逻辑中缺少 `attachmentUrl`，导致 quote tweet 的 `attachmentUrl` 在 Background SW → Content Script 这一步丢失。

**修改位置 1：** `ExecActionPayload` 接口（约第 29–36 行）

```typescript
interface ExecActionPayload {
    action: string;
    tweetId?: string;
    userId?: string;
    tabId?: number;
    text?: string;
    media_ids?: string[];
    attachmentUrl?: string;  // 新增
}
```

**修改位置 2：** `execAction` 函数（约第 916–945 行）

```typescript
const { action, tweetId, userId, tabId, text, media_ids, attachmentUrl } = payload;
console.log(`[TweetClaw-BG] execAction: ${action}`, { tweetId, userId, tabId, media_ids, attachmentUrl });
// ...
const result = await chrome.tabs.sendMessage(targetTabId, {
    type: MsgType.EXECUTE_ACTION,
    action,
    tweetId,
    userId,
    text,
    media_ids,
    attachmentUrl  // 新增
});
```

> 注：这是全链路中最容易被遗漏的一环。Background SW 只透传它知道的字段，`attachmentUrl` 如果不加到这里，即使 REST API 和 Content Script 都已支持，quote tweet 依然无法工作。

---

### Layer 2：tweetClaw Content Script（最终执行层）

**文件 2：** `tweetClaw/src/content/main_entrance.ts`

在 `EXECUTE_ACTION` 的 `switch (message.action)` 中新增 `quote_tweet` case。与普通发推共用 `CreateTweet` operation，但构造 `vars` 时加入 `attachment_url`。

**新增代码位置：** 约第 195 行（`reply_tweet` case 之后）

```typescript
case 'quote_tweet':
    // 引用转发：本质上是 CreateTweet + attachment_url
    op = 'CreateTweet';
    vars = {
        tweet_text: message.text || '',
        attachment_url: message.attachmentUrl || '',
        media: {
            media_entities: (message.media_ids || []).map((id: string) => ({ media_id: id, tagged_users: [] })),
            possibly_sensitive: false
        },
        semantic_annotation_ids: [],
        broadcast: true,
        disallowed_reply_options: null
    };
    break;
```

> 注：`attachment_url` 的格式由调用方传入，建议为 `https://x.com/{screenName}/status/{tweetId}` 或 `https://twitter.com/{screenName}/status/{tweetId}`。Content Script 层不做格式校验，透传即可。

---

### Layer 3：tweetClaw WebSocket 协议类型

**文件 3：** `tweetClaw/src/bridge/ws-protocol.ts`

扩展 `ExecActionRequestPayload` 的 `action` 联合类型，并增加 `attachmentUrl` 字段。

**修改位置：** 约第 192–201 行

```typescript
export interface ExecActionRequestPayload {
  action: 'like' | 'retweet' | 'bookmark' | 'follow' | 'unfollow'
       | 'post_tweet' | 'reply_tweet' | 'quote_tweet' | 'unlike' | 'unretweet' | 'unbookmark'
       | 'delete_tweet';
  tweetId?: string;
  userId?: string;
  tabId?: number;
  text?: string;
  media_ids?: string[];
  attachmentUrl?: string;  // 新增：quote tweet 时被引用推文的 URL
}
```

---

### Layer 4：localBridge Go 后端 — 类型定义

**文件 4：** `localBridge/go-lib/pkg/types/preset_payload.go`

在 `ExecActionRequest` struct 中增加 `AttachmentURL` 字段。

**修改位置：** 约第 28–35 行

```go
type ExecActionRequest struct {
	Action        string   `json:"action"`
	TweetID       *string  `json:"tweetId"`
	UserID        *string  `json:"userId"`
	TabID         *int     `json:"tabId"`
	Text          *string  `json:"text"`
	MediaIDs      []string `json:"media_ids,omitempty"`
	AttachmentURL *string  `json:"attachmentUrl,omitempty"` // 新增：quote tweet 的 attachment_url
}
```

> 此 struct 在 `restapi/handler.go` 的 `execAction` 中被反序列化。由于 Go 的 `json` tag 使用 `omitempty`，不传该字段时行为完全兼容现有调用。

---

### Layer 5：localBridge Go 后端 — REST Handler

**文件 5：** `localBridge/go-lib/pkg/restapi/handler.go`

当前 `POST /api/v1/x/tweets` 的 handler 是 `tweetsDispatch`，它调用 `execAction(w, r, "post_tweet")`。`execAction` 会读取请求 body 反序列化到 `ExecActionRequest`，然后把整个 struct 通过 WS 发给 tweetClaw。

**修改方式：** 不需要改 `tweetsDispatch` 的 handler 注册逻辑。`execAction` 已经会完整透传 `ExecActionRequest` 的所有字段到 WS payload。只要 Layer 3 的 struct 增加了 `AttachmentURL`，Go 端在收到 `"attachmentUrl"` 时会自动反序列化并透传。

**唯一要做的：** 确保 `POST /api/v1/x/tweets` 的调用方可以在 body 里传 `attachmentUrl`。这在 `execAction` 中通过 `readJSON(r, &req)` 已经支持，只要 struct 有对应字段即可。

**结论：** `handler.go` **无需额外代码修改**，Layer 4 的类型更新即足够。

---

### Layer 6：clawBotCli Python 客户端 — Transport 层

**文件 6：** `localBridge/clawBotCli/clawbot/transport/x_api.py`

扩展 `create_tweet_raw`，增加可选的 `attachment_url` 参数。

**修改位置：** 约第 82–94 行

```python
def create_tweet_raw(self, text: str, media_ids: Optional[List[str]] = None,
                     attachment_url: Optional[str] = None,
                     tab_id: Optional[int] = None, instance_id: Optional[str] = None) -> Dict[Any, Any]:
    payload = {"text": text}
    params = None
    headers = None
    if media_ids:
        payload["media_ids"] = media_ids
    if attachment_url:
        payload["attachmentUrl"] = attachment_url
    if tab_id:
        payload["tabId"] = tab_id
    if instance_id:
        payload["instanceId"] = instance_id
        params = {"instanceId": instance_id}
        headers = {"X-Instance-ID": instance_id}
    return self.request_json("POST", "/api/v1/x/tweets", json=payload, params=params, headers=headers)
```

---

### Layer 7：clawBotCli Python 客户端 — Service 层

**文件 7：** `localBridge/clawBotCli/clawbot/services/x_actions.py`

扩展 `create_tweet` 方法，透传 `attachment_url`。

**修改位置：** 约第 14–22 行

```python
def create_tweet(self, text: str, media_ids: Optional[List[str]] = None,
                 attachment_url: Optional[str] = None,
                 tab_id: Optional[int] = None, instance_id: Optional[str] = None):
    raw = self.transport.create_tweet_raw(
        text=text, media_ids=media_ids, attachment_url=attachment_url,
        tab_id=tab_id, instance_id=instance_id
    )
    target_id = None
    data = raw.get("data", {}) if isinstance(raw, dict) else {}
    if isinstance(data, dict) and "data" in data:
        data = data["data"]
    if isinstance(data, dict):
        target_id = data.get("create_tweet", {}).get("tweet_results", {}).get("result", {}).get("rest_id")
    return build_action_result("create_tweet", raw, target_id=target_id)
```

---

## 额外工作一：更新 `api_docs.json`

**文件：** `localBridge/apple/LocalBridgeMac/api_docs.json`

找到 `id: "create_tweet"` 的条目（当前约第 131–144 行），做以下修改：

1. **描述更新：** 在 description 中说明支持 quote tweet。
2. **request_body 更新：** 展示 `attachmentUrl` 的使用方式。
3. **新增示例：** 增加 quote tweet 的 curl 示例。

**修改后的 JSON 片段示例：**

```json
{
  "id": "create_tweet",
  "name": "Create Tweet",
  "name_zh": "发布推文",
  "summary": "Publish a new tweet or quote tweet, returns raw Twitter GraphQL response.",
  "summary_zh": "发布新推文或引用转发推文，返回推特原始 GraphQL 响应。",
  "method": "POST",
  "path": "/api/v1/x/tweets",
  "description": "Calls Twitter's CreateTweet GraphQL mutation to publish a new tweet. The request body needs to provide the text field (tweet content). Optional fields include media_ids (list of uploaded media IDs) and attachmentUrl (URL of the tweet to quote). When attachmentUrl is provided, the tweet becomes a quote tweet. Returns the raw Twitter GraphQL response, including data.create_tweet.tweet_results.result, which contains the rest_id and complete data of the newly created tweet. AI needs to parse rest_id from the response to get the new tweet's ID.",
  "description_zh": "调用推特 CreateTweet GraphQL mutation 发布新推文。请求体需提供 text 字段（推文内容）。可选字段包括 media_ids（已上传媒体的 ID 列表）和 attachmentUrl（被引用推文的 URL）。提供 attachmentUrl 时，该推文会成为引用转发（quote tweet）。返回推特 GraphQL 原始响应，包含 data.create_tweet.tweet_results.result，其中包含新创建推文的 rest_id 和完整数据。AI 需要从响应中解析 rest_id 来获取新推文的 ID。",
  "request_body": "{\n  \"text\": \"Hello World from my Bot!\"\n}",
  "curl": "curl -X POST http://127.0.0.1:10088/api/v1/x/tweets \\\n     -H \"Content-Type: application/json\" \\\n     -d '{\"text\": \"Hello World\"}'",
  "curl_quote": "curl -X POST http://127.0.0.1:10088/api/v1/x/tweets \\\n     -H \"Content-Type: application/json\" \\\n     -d '{\"text\": \"Interesting point!\", \"attachmentUrl\": \"https://x.com/elonmusk/status/1234567890\"}'",
  "response": "{\"data\":{\"create_tweet\":{\"tweet_results\":{\"result\":{\"__typename\":\"Tweet\",\"rest_id\":\"1234567890123456789\",...}}}}}}"
}
```

> 如果 `api_docs.json` 的 schema 不支持额外字段（如 `curl_quote`），可以把 quote 示例合并到 `curl` 字段的 description 中，或者在 `description` 里用文字说明。

---

## 额外工作二：更新 Python 测试脚本

**文件：** `localBridge/clawBotCli/tests/test_write_apis.py`

当前 `test_write_apis.py` 的 `--action` choices 只有 `["create", "like", "retweet"]`。需要：

1. 增加 `quote` action。
2. 增加 `test_quote_tweet` 函数。
3. 增加 `--quote-url` CLI 参数。

**修改示例：**

```python
# 1. 修改 argparse choices
parser.add_argument("--action", required=True, choices=["create", "like", "retweet", "quote"], help="Action to test")

# 2. 增加参数
parser.add_argument("--quote-url", type=str, help="Tweet URL to quote (for quote action)")

# 3. 新增测试函数
def test_quote_tweet(client: ClawBotClient, text: str, quote_url: str, instance_id: Optional[str]) -> bool:
    print("\n" + "=" * 60)
    print("Testing: POST /api/v1/x/tweets (quote tweet)")
    print("=" * 60)
    print(f"Tweet text: {text}")
    print(f"Quote URL: {quote_url}")
    print(f"instance_id: {instance_id}")

    result = client.x.actions.create_tweet(text=text, attachment_url=quote_url, instance_id=instance_id)
    print_json_preview(result.raw)

    if result.success:
        print("Quote tweet created successfully")
        print(f"Created tweet ID: {result.target_id or 'unknown'}")
        return True

    print("Failed to create quote tweet")
    return False

# 4. 在 main() 中增加分支
if args.action == "quote":
    text = args.text or build_default_text()
    quote_url = args.quote_url or input("Enter tweet URL to quote: ").strip()
    if not quote_url:
        print("quote_url is required for quote action")
        return 1
    confirm_or_exit("This will post a real quote tweet to your account!", args.yes)
    passed = test_quote_tweet(client, text, quote_url, instance_id)
```

---

## 验收标准

1. 不传 `attachmentUrl` 时，`POST /api/v1/x/tweets` 行为与之前完全一致（普通发推）。
2. 传 `attachmentUrl` 时，成功创建 quote tweet，X 返回的响应中 `is_quote_status` 为 `true`。
3. Python 测试脚本 `python tests/test_write_apis.py --action quote --quote-url "https://x.com/..." --yes` 能正常执行并通过。
4. `api_docs.json` 中 Create Tweet 条目已更新，描述中包含 quote tweet 用法。

---

## 影响评估

| 项目 | 评估 |
|------|------|
| 是否破坏现有 API | 否。`attachmentUrl` 是可选字段，不传时行为不变。 |
| 是否需要 tweetClaw 扩展升级 | 是。需要更新 extension 并重新加载。 |
| 是否需要 localBridge 重新编译 | 是。Go 类型更新后需要重新编译。 |
| 是否需要 clawBotCli 重新安装 | 是。Python 包更新后需要重新安装或 pip install -e。 |
| 是否需要新 GraphQL queryId | 否。复用已有的 `CreateTweet` queryId。 |
| 截图中红箭头标注的辅助 API（FetchDraftTweets / FetchScheduledTweets / user_flow.json）是否需要实现 | 否。这些不是 quote tweet 的硬依赖，直接发 `CreateTweet` mutation 已足够。 |

---

## 参考：X GraphQL Quote Tweet 原始请求结构

从抓包 `1.log` 中提取的关键字段：

```json
{
  "variables": {
    "tweet_text": "我还是很喜欢codex的",
    "attachment_url": "https://x.com/Codex_Changelog/status/2049905403262079480",
    "media": {
      "media_entities": [],
      "possibly_sensitive": false
    },
    "semantic_annotation_ids": [],
    "disallowed_reply_options": null,
    "semantic_annotation_options": {
      "source": "Htl"
    }
  },
  "features": { ... },
  "queryId": "c50A_puUoQGK_4SXseYz3A"
}
```

响应中确认 quote 成功的标志：

```json
{
  "legacy": {
    "is_quote_status": true,
    "quoted_status_id_str": "2049905403262079480",
    "quoted_status_permalink": {
      "expanded": "https://twitter.com/Codex_Changelog/status/2049905403262079480",
      "url": "https://t.co/gmeVpUeqfr"
    }
  }
}
```
