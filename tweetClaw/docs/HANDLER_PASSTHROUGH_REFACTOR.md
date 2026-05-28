# handler.go 透传重构任务

> 创建日期：2026-05-28  
> 状态：待实现

---

## 一、问题描述

当前 `localBridge/go-lib/pkg/restapi/handler.go` 中的预制端点（`/api/v1/x/` 和 `/api/v1/xhs/`）存在以下问题：

1. **参数提取后重新构建 payload**：Go 从 query string / request body 中读取参数，再重新拼装成 `map[string]interface{}` 或强类型结构体传给扩展。
2. **注入默认值**：如 `count` 默认为 20、`page_size` 默认为 20，由 Go 层决定。
3. **业务校验**：如 `xhsNotifications` 强制要求 `type` 只能是 `mentions` 或 `likes`；`userTweets` / `followers` 要求 `userId` 必填。
4. **业务逻辑判断**：如 `tweetsDispatch` 根据 `attachmentURL` 是否存在决定 action 是 `post_tweet` 还是 `quote_tweet`。

这些逻辑本不属于 Go 层，违背了 localBridge 的定位——**纯粹的消息总线，不感知业务**。

---

## 二、可行性评估

**结论：所有端点均可实现完全透传，无例外。**

分析各类情况：

| 情况 | 是否可透传 | 说明 |
|------|-----------|------|
| GET 带 query 参数 | ✅ | 将 `r.URL.Query()` 转为 `map[string]string` 透传 |
| POST 带 JSON body | ✅ | 将 body 读为 `json.RawMessage` 原样透传 |
| 路由决定 messageType | ✅ | 路由→messageType 映射保留在 Go，这是路由职责而非业务逻辑 |
| 路由决定 action 字段（like/unlike 等） | ✅ | action 由路由注入 payload，调用方无需关心，这是端点语义的一部分 |
| `tweetsDispatch` 中 action 判断 | ✅ | 将判断逻辑移到扩展端；或调用方直接传 `action` 字段，Go 原样透传 |
| 图片上传（大附件分批传输） | ⚠️ 例外 | 图片数据需要在 Go 层做分批处理，不参与本次重构 |

**唯一例外：** `xhsPublish` 中的图片上传涉及大附件（COS 上传流程），保持现状不变。

---

## 三、重构方案

### 3.1 统一透传规则

**GET 端点**：将所有 query 参数转为 `map[string]interface{}` 透传。

```go
// 重构后的标准 GET handler 模式
func (h *Handler) xhsFoo(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        jsonErr(w, 405, "method_not_allowed")
        return
    }
    id := newID("http_xhs_foo")
    payload := queryToMap(r)  // 新增工具函数
    h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "command.xhs_foo", "tweetClaw", payload), 8000,
        func(data []byte) { writeRawPayload(w, data) })
}
```

**POST 端点**：将 body 读为 `json.RawMessage` 透传。

```go
// 重构后的标准 POST handler 模式
func (h *Handler) xhsBar(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        jsonErr(w, 405, "method_not_allowed")
        return
    }
    body, err := readRawBody(r)  // 新增工具函数
    if err != nil {
        jsonErr(w, 400, err.Error())
        return
    }
    id := newID("http_xhs_bar")
    h.bridge(w, r, "tweetClaw", id, buildRawMsgFromBytes(id, "command.xhs_bar", "tweetClaw", body), 8000,
        func(data []byte) { writeRawPayload(w, data) })
}
```

**新增两个工具函数：**

```go
// queryToMap 将 URL query string 转为 map，供 GET 端点透传
func queryToMap(r *http.Request) map[string]interface{} {
    m := make(map[string]interface{})
    for k, v := range r.URL.Query() {
        if len(v) == 1 {
            m[k] = v[0]
        } else {
            m[k] = v
        }
    }
    return m
}

// readRawBody 读取 request body 为 json.RawMessage，供 POST 端点透传
func readRawBody(r *http.Request) (json.RawMessage, error) {
    data, err := io.ReadAll(r.Body)
    if err != nil {
        return nil, err
    }
    if len(data) == 0 {
        return json.RawMessage("{}"), nil
    }
    return json.RawMessage(data), nil
}
```

### 3.2 特殊处理：路由注入 action

`execAction` 系列端点（like/unlike/follow 等）由路由决定 action，这是端点语义，保留此逻辑，但透传其余字段：

```go
func (h *Handler) execAction(w http.ResponseWriter, r *http.Request, action string) {
    body, _ := readRawBody(r)
    // 将 action 注入到透传的 body 中
    payload := mergeAction(body, action)  // 新增工具函数
    id := newID("http_exec")
    h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "request.exec_action", "tweetClaw", payload), 15000,
        func(data []byte) { writeRawPayload(w, data) })
}

// mergeAction 将 action 字段注入到已有 JSON payload 中
func mergeAction(body json.RawMessage, action string) map[string]interface{} {
    var m map[string]interface{}
    _ = json.Unmarshal(body, &m)
    if m == nil {
        m = make(map[string]interface{})
    }
    m["action"] = action
    return m
}
```

### 3.3 保持不变的端点

以下端点无需修改：

| 端点 | 原因 |
|------|------|
| `xStatus` | 无参数，空 payload，已是透传 |
| `xBasicInfo` | 无参数，空 payload，已是透传 |
| `xhsAccountInfo` | 无参数，空 payload，已是透传 |
| `xhsPublishedNotes` | 无参数，空 payload，已是透传 |
| `xhsPublish` | 图片上传涉及大附件分批处理，例外 |
| `pluginInvoke` | 通用端点，本身已是完全透传 |
| `instances` | 本地查询，不走 bridge |
| `openTab` / `closeTab` / `navigateTab` | Tab 管理，非业务数据端点 |

---

## 四、需要修改的端点清单

### 4.1 Twitter 端点（`/api/v1/x/`）

| 端点 handler | 当前问题 | 修改方式 |
|---|---|---|
| `tweetsDispatch` (GET) | 提取 `tweetId` 重新构建 | `queryToMap` 透传 |
| `tweetsDispatch` (POST) | 解析 body，**判断 action 类型** | 移除判断，调用方直接传 `action` 字段，`readRawBody` 透传 |
| `tweetResourceDispatch` | 解析 URL path 提取 `tweetId` | 保持路径解析，但参数部分改为 `queryToMap` |
| `userProfile` | 提取 `screenName` 重新构建 | `queryToMap` 透传 |
| `searchTimeline` | 提取参数，**注入 count 默认值 20** | `queryToMap` 透传，默认值由扩展处理 |
| `userTweets` | 提取参数，必填校验，count 默认值 | `queryToMap` 透传，校验移到扩展 |
| `followers` | 同上 | 同上 |
| `following` | 同上 | 同上 |
| `blueVerifiedFollowers` | 同上 | 同上 |
| `execAction` | body 透传，action 由路由注入 | `mergeAction` 注入 action，其余透传 |

### 4.2 XHS 端点（`/api/v1/xhs/`）

| 端点 handler | 当前问题 | 修改方式 |
|---|---|---|
| `xhsHomefeed` | 提取 `cursor_score` 重新构建 | `queryToMap` 透传 |
| `xhsFeed` | 提取 `note_id`，必填校验 | `queryToMap` 透传，校验移到扩展 |
| `xhsSearch` | 解析 body，**注入 page_size 默认值 20** | `readRawBody` 透传，默认值由扩展处理 |
| `xhsUserNotes` | 提取参数，必填校验 | `queryToMap` 透传 |
| `xhsComments` | 提取参数，必填校验 | `queryToMap` 透传 |
| `xhsUserInfo` | 提取 `user_id`，必填校验 | `queryToMap` 透传 |
| `xhsTopics` | 提取 `keyword`，必填校验 | `queryToMap` 透传 |
| `xhsNotifications` | 提取参数，**业务校验 type 枚举值** | `queryToMap` 透传，校验移到扩展 |
| `xhsSearchFilter` | 提取参数，必填校验 | `queryToMap` 透传 |

---

## 五、扩展端需要同步修改的内容

Go 移除校验后，扩展的 content script 需要承接这些逻辑：

| 功能 | 当前在 Go 处理 | 迁移到扩展后的处理位置 |
|---|---|---|
| `note_id` / `user_id` / `keyword` 必填校验 | Go 返回 400 | content script 中各 fetch 函数检查参数，返回 `{ success: false, error: '...' }` |
| `count` / `page_size` 默认值 | Go 注入 20 | content script 中 `const count = Number(payload.count) \|\| 20` |
| `type` 枚举值校验（mentions/likes） | Go 返回 400 | content script 中检查 |
| `tweetsDispatch` action 判断 | Go 根据 attachmentURL 决定 | 调用方直接传 `action` 字段，或扩展端判断 |

---

## 六、Python 客户端需要同步修改的内容

Go 移除默认值注入后，Python 客户端需要明确传参：

| 方法 | 当前行为 | 修改后 |
|---|---|---|
| `search_timeline(query, count=None)` | Go 默认 count=20 | Python 默认 `count=20`，明确传给服务端 |
| `get_user_tweets(user_id, count=None)` | Go 默认 count=20 | Python 默认 `count=20` |
| `get_followers(user_id, count=None)` | Go 默认 count=20 | Python 默认 `count=20` |
| `get_following(user_id, count=None)` | Go 默认 count=20 | Python 默认 `count=20` |
| `xhs_search(keyword, page_size=None)` | Go 默认 page_size=20 | Python 默认 `page_size=20` |
| `post_tweet(text, attachment_url=None)` | Go 判断 action 类型 | Python 根据参数决定传 `action: "post_tweet"` 或 `"quote_tweet"` |

---

## 七、实现步骤

```
1. handler.go：新增 queryToMap / readRawBody / mergeAction 三个工具函数
2. handler.go：按第四节清单逐一修改各 handler
3. tweetClaw content script：承接必填校验 + 默认值处理
4. Python clawBotCli：补全默认参数，确保行为不变
5. 验证：运行现有测试脚本，确保所有 API 行为与重构前一致
```

---

## 八、不在本次重构范围内

- `xhsPublish`（图片上传大附件流程）
- `openTab` / `closeTab` / `navigateTab`（Tab 管理，非数据端点）
- `pluginInvoke` 通用端点（已是透传）
- `instances`（本地查询）
- aiClaw 相关端点（`sendMessage` / `newConversation` 等，涉及任务管理，逻辑较重，单独评估）
