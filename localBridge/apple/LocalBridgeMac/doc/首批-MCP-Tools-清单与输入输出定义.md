# 首批 MCP Tools 清单与输入输出定义

## 1. 文档目标

本文档定义 `LocalBridgeMac` 在第一阶段新增 MCP 能力时，建议优先暴露的首批 tools，以及每个 tool 的：

- tool 名称
- tool 目标
- 输入参数
- 返回结构
- 错误码
- 路由规则
- 风险等级

目标不是一次性覆盖全部 Twitter/X 能力，而是先建立一组：

> **足够形成完整读写闭环、又足够稳定、并且便于上游产品和 Agent 使用的最小可用 MCP 工具集。**

---

## 2. 设计原则

首批 tool 设计遵循以下原则：

### 2.1 不暴露底层实现细节
上游只看到能力语义，不看到：
- WebSocket messageType
- Go bridge 内部命令
- LocalBridge 内部模块划分

### 2.2 优先暴露已验证能力
首批 tools 只选你当前已经具备真实能力、且适合 MCP 化的接口。

### 2.3 保留原始 payload
考虑到你当前很多 X 能力本身就是 raw GraphQL passthrough，第一阶段不强制做重解析。

### 2.4 参数统一
同类工具尽量共用字段命名和路由方式。

### 2.5 错误统一
MCP 层对外暴露稳定错误码，而不是直接透出内部错误文本。

---

## 3. 首批 Tool 范围

建议第一阶段共暴露 12 个 tools，分为三类。

## 3.1 环境与上下文类
1. `list_x_instances`
2. `get_x_status`
3. `get_x_basic_info`

## 3.2 内容读取类
4. `get_home_timeline`
5. `get_tweet`
6. `get_tweet_replies`
7. `get_user_profile`
8. `search_tweets`
9. `get_user_tweets`

## 3.3 内容写入与互动类
10. `create_tweet`
11. `reply_tweet`
12. `like_tweet`
13. `retweet_tweet`

如果你希望首批再多一点，可以第二批立即补上：
- `unlike_tweet`
- `unretweet_tweet`
- `bookmark_tweet`
- `unbookmark_tweet`
- `delete_my_tweet`

但从“先落地最小闭环”的角度，前 13 个已经足够。

---

## 4. 通用输入模型

为了统一 MCP 层的调用方式，建议定义一组通用上下文字段。

## 4.1 通用上下文字段

### `instanceId`
- 类型：`string`
- 必填：否
- 说明：指定使用哪个 tweetClaw 实例执行操作

### `tabId`
- 类型：`number`
- 必填：否
- 说明：指定使用哪个 X tab 执行操作

### `timeoutMs`
- 类型：`number`
- 必填：否
- 说明：当前 tool 调用超时，覆盖默认超时配置

---

## 4.2 通用路由规则

所有 tools 建议遵循相同路由顺序：

1. 如果显式传入 `instanceId`，优先按 `instanceId` 路由
2. 如果显式传入 `tabId`，按 `tabId` 路由
3. 如果未指定，优先使用 active X tab
4. 如果没有 active X tab，则尝试默认实例
5. 如果仍无法确定上下文，则返回错误，不做危险猜测

---

## 5. 通用输出模型

建议所有 tools 统一返回以下外层结构：

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "instanceId": "optional-instance-id",
    "tabId": 123456789,
    "usedDefaultRouting": false,
    "source": "localbridge-rest",
    "toolVersion": "v1"
  }
}
```

失败时：

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "tweetId is required"
  },
  "meta": {
    "instanceId": null,
    "tabId": null,
    "usedDefaultRouting": false,
    "source": "localbridge-rest",
    "toolVersion": "v1"
  }
}
```

---

## 5.1 `data` 字段建议

第一阶段建议：

```json
{
  "raw": {},
  "summary": {}
}
```

其中：
- `raw`：保留 LocalBridge/GraphQL 原始返回
- `summary`：可选，MCP 层做轻量摘要

如果第一阶段不想加摘要，也可以先只返回：

```json
{
  "raw": {}
}
```

---

## 6. 通用错误码

建议首批统一支持以下错误码：

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

## 7. Tool 详细定义

# 7.1 `list_x_instances`

## 目标
列出当前可用的 tweetClaw 实例，供上游选择账号或执行上下文。

## 风险等级
- `read-only`

## 输入参数
无必填参数。

可选参数：
- `timeoutMs`

## 返回数据建议

```json
{
  "success": true,
  "data": {
    "instances": [
      {
        "instanceId": "a1b2c3",
        "instanceName": "mac-pro-main",
        "clientName": "tweetClaw",
        "clientVersion": "0.3.17",
        "capabilities": ["query_x_tabs_status", "query_x_basic_info"],
        "connectedAt": "2025-01-01T10:00:00Z",
        "lastSeenAt": "2025-01-01T10:05:00Z",
        "isTemporary": false
      }
    ]
  },
  "error": null,
  "meta": {
    "source": "localbridge-rest",
    "toolVersion": "v1"
  }
}
```

## 对应现有能力
- `GET /api/v1/x/instances`

## 典型错误
- `LOCALBRIDGE_NOT_READY`
- `TIMEOUT`

---

# 7.2 `get_x_status`

## 目标
获取当前 X 浏览器环境状态，包括 tab、活动页、登录状态。

## 风险等级
- `read-only`

## 输入参数
可选参数：
- `instanceId`
- `tabId`
- `timeoutMs`

## 返回数据建议

```json
{
  "success": true,
  "data": {
    "tabs": [
      {
        "tabId": 123456789,
        "url": "https://x.com/home",
        "active": true
      }
    ],
    "activeXUrl": "https://x.com/home",
    "hasXTabs": true,
    "isLoggedIn": true,
    "activeXTabId": 123456789,
    "raw": {}
  }
}
```

## 对应现有能力
- `GET /api/v1/x/status`

## 典型错误
- `LOCALBRIDGE_NOT_READY`
- `TIMEOUT`

---

# 7.3 `get_x_basic_info`

## 目标
读取当前登录账号的基础信息，帮助 Agent 确认当前身份。

## 风险等级
- `read-only`

## 输入参数
可选参数：
- `instanceId`
- `tabId`
- `timeoutMs`

## 返回数据建议

```json
{
  "success": true,
  "data": {
    "raw": {},
    "summary": {
      "userId": "1234567890",
      "screenName": "your_handle",
      "name": "your_name",
      "followersCount": 5,
      "friendsCount": 12,
      "isBlueVerified": false
    }
  }
}
```

## 对应现有能力
- `GET /api/v1/x/basic_info`

## 典型错误
- `X_NOT_LOGGED_IN`
- `NO_ACTIVE_X_TAB`
- `TIMEOUT`

---

# 7.4 `get_home_timeline`

## 目标
获取首页时间线原始内容，供搜索、分析、筛选互动对象。

## 风险等级
- `read-only`

## 输入参数
可选参数：
- `instanceId`
- `tabId`
- `timeoutMs`

## 返回数据建议

```json
{
  "success": true,
  "data": {
    "raw": {},
    "summary": {
      "tweetCount": 20,
      "authors": ["user_a", "user_b"]
    }
  }
}
```

## 对应现有能力
- `GET /api/v1/x/timeline`

## 典型错误
- `X_NOT_LOGGED_IN`
- `NO_ACTIVE_X_TAB`
- `TIMEOUT`

---

# 7.5 `get_tweet`

## 目标
读取单条推文详情。

## 风险等级
- `read-only`

## 输入参数
### 必填
- `tweetId: string`

### 可选
- `instanceId`
- `tabId`
- `timeoutMs`

## 返回数据建议

```json
{
  "success": true,
  "data": {
    "raw": {},
    "summary": {
      "tweetId": "1234567890",
      "authorScreenName": "username",
      "text": "Hello World",
      "favoriteCount": 10,
      "retweetCount": 5
    }
  }
}
```

## 对应现有能力
- `GET /api/v1/x/tweets?tweetId=...`

## 典型错误
- `INVALID_ARGUMENT`
- `X_NOT_LOGGED_IN`
- `TIMEOUT`

---

# 7.6 `get_tweet_replies`

## 目标
读取某条推文的回复列表，支持分页。

## 风险等级
- `read-only`

## 输入参数
### 必填
- `tweetId: string`

### 可选
- `cursor: string`
- `instanceId`
- `tabId`
- `timeoutMs`

## 返回数据建议

```json
{
  "success": true,
  "data": {
    "raw": {},
    "summary": {
      "replyCount": 20,
      "nextCursor": "DAABCgABFxxx=="
    }
  }
}
```

## 对应现有能力
- `GET /api/v1/x/tweets/{tweetId}/replies`

## 典型错误
- `INVALID_ARGUMENT`
- `TIMEOUT`

---

# 7.7 `get_user_profile`

## 目标
按用户名读取用户资料。

## 风险等级
- `read-only`

## 输入参数
### 必填
- `screenName: string`

### 可选
- `instanceId`
- `tabId`
- `timeoutMs`

## 返回数据建议

```json
{
  "success": true,
  "data": {
    "raw": {},
    "summary": {
      "screenName": "elonmusk",
      "name": "Elon Musk",
      "followersCount": 12345,
      "verified": true
    }
  }
}
```

## 对应现有能力
- `GET /api/v1/x/users?screenName=...`

## 典型错误
- `INVALID_ARGUMENT`
- `TIMEOUT`

---

# 7.8 `search_tweets`

## 目标
根据关键词搜索推文，支持分页。

## 风险等级
- `read-only`

## 输入参数
### 必填
- `query: string`

### 可选
- `cursor: string`
- `count: number`
- `instanceId`
- `tabId`
- `timeoutMs`

## 返回数据建议

```json
{
  "success": true,
  "data": {
    "raw": {},
    "summary": {
      "query": "open claw",
      "tweetCount": 20,
      "nextCursor": "DAACCgACHEGU..."
    }
  }
}
```

## 对应现有能力
- `GET /api/v1/x/search`

## 典型错误
- `INVALID_ARGUMENT`
- `TIMEOUT`

---

# 7.9 `get_user_tweets`

## 目标
读取某个用户的推文列表，支持分页。

## 风险等级
- `read-only`

## 输入参数
### 必填
- `userId: string`

### 可选
- `cursor: string`
- `count: number`
- `instanceId`
- `tabId`
- `timeoutMs`

## 返回数据建议

```json
{
  "success": true,
  "data": {
    "raw": {},
    "summary": {
      "userId": "44196397",
      "tweetCount": 20,
      "nextCursor": "DAABCgABFxxx=="
    }
  }
}
```

## 对应现有能力
- `GET /api/v1/x/user_tweets`

## 典型错误
- `INVALID_ARGUMENT`
- `TIMEOUT`

---

# 7.10 `create_tweet`

## 目标
发布一条新推文。

## 风险等级
- `safe-write`

## 输入参数
### 必填
- `text: string`

### 可选
- `instanceId`
- `tabId`
- `timeoutMs`

## 返回数据建议

```json
{
  "success": true,
  "data": {
    "raw": {},
    "summary": {
      "tweetId": "1234567890123456789",
      "text": "Hello World",
      "published": true
    }
  }
}
```

## 对应现有能力
- `POST /api/v1/x/tweets`

## 典型错误
- `INVALID_ARGUMENT`
- `ACTION_NOT_ALLOWED`
- `X_NOT_LOGGED_IN`
- `TIMEOUT`

## 备注
如果启用了 `readOnlyMode`，该 tool 必须直接拒绝执行。

---

# 7.11 `reply_tweet`

## 目标
回复某条推文。

## 风险等级
- `safe-write`

## 输入参数
### 必填
- `tweetId: string`
- `text: string`

### 可选
- `instanceId`
- `tabId`
- `timeoutMs`

## 返回数据建议

```json
{
  "success": true,
  "data": {
    "raw": {},
    "summary": {
      "replyToTweetId": "1234567890",
      "tweetId": "1234567890999999999",
      "published": true
    }
  }
}
```

## 对应现有能力
- `POST /api/v1/x/replies`

## 典型错误
- `INVALID_ARGUMENT`
- `ACTION_NOT_ALLOWED`
- `X_NOT_LOGGED_IN`
- `TIMEOUT`

---

# 7.12 `like_tweet`

## 目标
点赞指定推文。

## 风险等级
- `safe-write`

## 输入参数
### 必填
- `tweetId: string`

### 可选
- `instanceId`
- `tabId`
- `timeoutMs`

## 返回数据建议

```json
{
  "success": true,
  "data": {
    "raw": {},
    "summary": {
      "tweetId": "1234567890123456789",
      "liked": true
    }
  }
}
```

## 对应现有能力
- `POST /api/v1/x/likes`

## 典型错误
- `INVALID_ARGUMENT`
- `ACTION_NOT_ALLOWED`
- `TIMEOUT`

---

# 7.13 `retweet_tweet`

## 目标
转推指定推文。

## 风险等级
- `safe-write`

## 输入参数
### 必填
- `tweetId: string`

### 可选
- `instanceId`
- `tabId`
- `timeoutMs`

## 返回数据建议

```json
{
  "success": true,
  "data": {
    "raw": {},
    "summary": {
      "tweetId": "1234567890123456789",
      "retweeted": true
    }
  }
}
```

## 对应现有能力
- `POST /api/v1/x/retweets`

## 典型错误
- `INVALID_ARGUMENT`
- `ACTION_NOT_ALLOWED`
- `TIMEOUT`

---

## 8. 第二批建议 Tools

当第一阶段跑通后，建议马上补这几类，成本低、闭环完整度提升大：

### 8.1 对偶互动类
- `unlike_tweet`
- `unretweet_tweet`
- `bookmark_tweet`
- `unbookmark_tweet`

### 8.2 内容管理类
- `delete_my_tweet`

### 8.3 环境操作类
- `open_x_tab`
- `navigate_x_tab`

这些能明显增强 Agent 自主性。

---

## 9. Tool 命名规范建议

建议统一采用：

- 动词 + 对象
- 全小写
- 下划线分隔
- 不带内部实现术语

示例：
- `get_home_timeline`
- `search_tweets`
- `create_tweet`
- `reply_tweet`

不建议：
- `query_x_status_raw`
- `exec_action_post_tweet`
- `send_query_search_timeline`

原因是 MCP 面向上游产品和 Agent，命名应强调可理解性，而不是内部实现路径。

---

## 10. Tool 描述风格建议

每个 tool 描述建议遵循统一模板：

### 模板
- 这个 tool 做什么
- 适合什么场景
- 输入需要什么上下文
- 会不会产生副作用

### 示例
`create_tweet`
> Publish a new post to X using the current logged-in account. Use this when the user explicitly wants to post content. This tool creates a real public tweet.

`get_home_timeline`
> Read the current home timeline from X for the active account. Use this to inspect recent tweets before deciding whether to reply, like, or retweet.

这样会更利于 LLM 正确选 tool。

---

## 11. 与现有 REST API 的映射表

| MCP Tool | LocalBridge REST API |
|---|---|
| `list_x_instances` | `GET /api/v1/x/instances` |
| `get_x_status` | `GET /api/v1/x/status` |
| `get_x_basic_info` | `GET /api/v1/x/basic_info` |
| `get_home_timeline` | `GET /api/v1/x/timeline` |
| `get_tweet` | `GET /api/v1/x/tweets?tweetId=...` |
| `get_tweet_replies` | `GET /api/v1/x/tweets/{tweetId}/replies` |
| `get_user_profile` | `GET /api/v1/x/users` |
| `search_tweets` | `GET /api/v1/x/search` |
| `get_user_tweets` | `GET /api/v1/x/user_tweets` |
| `create_tweet` | `POST /api/v1/x/tweets` |
| `reply_tweet` | `POST /api/v1/x/replies` |
| `like_tweet` | `POST /api/v1/x/likes` |
| `retweet_tweet` | `POST /api/v1/x/retweets` |

---

## 12. 第一阶段验收标准

如果首批 MCP tools 完成，建议按以下标准验收：

### 可发现性
- MCP client 能列出全部首批 tools
- tool 名称和描述清晰

### 可调用性
- 每个读工具都能成功返回
- 每个写工具都能完成真实动作

### 稳定性
- 错误返回统一
- 超时行为明确
- 路由行为清晰

### 低侵入
- LocalBridge 现有功能不受影响
- 原 REST/API/UI/WS 行为不变

### 可扩展
- 新增第二批 tool 时不需要推倒 schema 设计

---

## 13. 最终建议

第一阶段不要追求把所有 Twitter/X 能力都塞进 MCP。  
最正确的落地顺序是：

1. 先把首批核心 tools 跑通
2. 统一输入输出与错误模型
3. 验证上游 Agent 的使用体验
4. 再逐步扩展更多读写能力

对于你的产品来说，真正重要的不是“首批工具数量多”，而是：

> **首批工具足够稳定、足够清晰、足够符合 MCP 与 Agent 的使用习惯。**

---

## 14. 一句话总结

> 第一阶段建议优先暴露 13 个核心 MCP tools，覆盖环境感知、内容读取、内容写入三类能力，并统一参数、返回结构、错误码和路由规则，使 LocalBridge 能以最小侵入方式形成一个可被上游产品真实消费的 xmcp 风格 MCP 能力层。
