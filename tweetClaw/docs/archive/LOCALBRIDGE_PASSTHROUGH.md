# localBridge Handler 透传：规范与重构历史

> 合并自：`HANDLER_PASSTHROUGH_SPEC.md` + `HANDLER_PASSTHROUGH_REFACTOR.md`
> 创建日期：2026-05-28
> 状态：**已完成** — 规范已落地，所有 XHS 端点均已按透传规范实现

---

## 一、核心原则

**localBridge 是纯粹的消息总线，不感知业务逻辑。**

Go 层的职责仅限于：
1. **路由分发** — 将 HTTP 请求映射到对应的 messageType
2. **协议转换** — HTTP ↔ WebSocket 消息格式转换
3. **连接管理** — 维护与扩展端的 WebSocket 连接

Go 层**禁止**：
- 提取参数后重新构建 payload
- 注入默认值（如 `count=20`）
- 业务校验（如必填校验、枚举值校验）
- 业务逻辑判断（如根据某字段决定 action 类型）

---

## 二、透传规则

### 2.1 GET 端点

将所有 query 参数原样转为 `map[string]interface{}` 透传。

```go
func (h *Handler) exampleGet(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        jsonErr(w, 405, "method_not_allowed")
        return
    }
    id := newID("http_example")
    payload := queryToMap(r)  // 透传所有 query 参数
    h.bridge(w, r, "tweetClaw", id,
        buildRawMsg(id, "command.example", "tweetClaw", payload),
        8000,
        func(data []byte) { writeRawPayload(w, data) })
}
```

### 2.2 POST 端点

将 request body 读为 `json.RawMessage` 原样透传。

```go
func (h *Handler) examplePost(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        jsonErr(w, 405, "method_not_allowed")
        return
    }
    body, err := readRawBody(r)  // 透传整个 body
    if err != nil {
        jsonErr(w, 400, err.Error())
        return
    }
    id := newID("http_example")
    h.bridge(w, r, "tweetClaw", id,
        buildRawMsgFromBytes(id, "command.example", "tweetClaw", body),
        8000,
        func(data []byte) { writeRawPayload(w, data) })
}
```

### 2.3 路由注入 action（唯一允许的"逻辑"）

当端点语义本身决定 action 时（如 `/like` vs `/unlike`），由路由注入 action 字段，其余参数透传。

```go
func (h *Handler) execAction(w http.ResponseWriter, r *http.Request, action string) {
    body, _ := readRawBody(r)
    payload := mergeAction(body, action)  // 仅注入 action，其余透传
    id := newID("http_exec")
    h.bridge(w, r, "tweetClaw", id,
        buildRawMsg(id, "request.exec_action", "tweetClaw", payload),
        15000,
        func(data []byte) { writeRawPayload(w, data) })
}
```

这是唯一允许 Go 层"修改" payload 的情况，因为 action 是端点语义的一部分，而非业务逻辑。

---

## 三、工具函数

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

---

## 四、职责分层

| 层级 | 职责 | 示例 |
|------|------|------|
| **Go handler** | 路由 → messageType 映射、协议转换 | `/api/v1/xhs/feed` → `command.xhs_feed` |
| **扩展 content script** | 参数校验、默认值、业务逻辑 | `note_id` 必填校验、`count` 默认 20 |
| **Python 客户端** | 用户友好的默认值、参数组装 | `count=20` 作为函数默认参数 |

### 4.1 扩展端承接的逻辑

| 逻辑类型 | 处理方式 |
|----------|----------|
| 必填校验 | 检查参数，返回 `{ success: false, error: 'xxx is required' }` |
| 默认值 | `const count = Number(payload.count) \|\| 20` |
| 枚举校验 | 检查参数值是否在允许范围内 |
| 条件逻辑 | 根据参数决定调用哪个 API |

### 4.2 Python 客户端承接的逻辑

| 逻辑类型 | 处理方式 |
|----------|----------|
| 用户友好默认值 | 函数签名 `def search(query, count=20)` |
| 参数组装 | 根据参数决定传 `action: "post_tweet"` 或 `"quote_tweet"` |

---

## 五、例外情况

以下情况不适用透传规则：

| 端点 | 原因 |
|------|------|
| 图片/视频上传（`xhsPublish`） | 大附件需要分批处理，涉及 COS 上传流程 |
| Tab 管理（`openTab`/`closeTab`） | 非业务数据端点，本地操作 |
| 本地查询（`instances`） | 不走 bridge，直接返回本地状态 |
| 通用端点（`pluginInvoke`） | 已是完全透传 |

---

## 六、新增 API 检查清单

编写新 handler 前，确认以下事项：

- [ ] **是否提取参数重新构建？** → 改用 `queryToMap` 或 `readRawBody` 透传
- [ ] **是否注入默认值？** → 移到扩展端或客户端
- [ ] **是否做必填校验？** → 移到扩展端
- [ ] **是否做枚举值校验？** → 移到扩展端
- [ ] **是否有业务逻辑判断？** → 移到扩展端或客户端
- [ ] **是否仅注入路由语义的 action？** → 允许，使用 `mergeAction`

---

## 七、反模式示例

### 错误：提取参数重新构建

```go
func (h *Handler) xhsFeed(w http.ResponseWriter, r *http.Request) {
    noteId := r.URL.Query().Get("note_id")
    if noteId == "" {
        jsonErr(w, 400, "note_id is required")  // 业务校验不应在 Go 层
        return
    }
    payload := map[string]interface{}{
        "note_id": noteId,  // 重新构建 payload
    }
}
```

### 正确：透传

```go
func (h *Handler) xhsFeed(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet {
        jsonErr(w, 405, "method_not_allowed")
        return
    }
    id := newID("http_xhs_feed")
    h.bridge(w, r, "tweetClaw", id,
        buildRawMsg(id, "command.xhs_feed", "tweetClaw", queryToMap(r)),
        8000,
        func(data []byte) { writeRawPayload(w, data) })
}
```

---

## 八、重构历史（2026-05-28）

### 背景

重构前，`handler.go` 中的预制端点存在以下问题：
- 参数提取后重新构建 payload
- 注入默认值（`count=20`、`page_size=20`）
- 业务校验（必填、枚举值）
- 业务逻辑判断（`tweetsDispatch` 根据 `attachmentURL` 决定 action）

### 已完成的修改

**XHS 端点（全部已按透传规范实现）：**

| 端点 | 原问题 | 修改方式 |
|------|--------|----------|
| `xhsHomefeed` | 提取 `cursor_score` 重新构建 | `queryToMap` 透传 |
| `xhsFeed` | 提取 `note_id`，必填校验 | `queryToMap` 透传 |
| `xhsSearch` | 解析 body，注入 `page_size` 默认值 | `readRawBody` 透传 |
| `xhsUserNotes` | 提取参数，必填校验 | `queryToMap` 透传 |
| `xhsComments` | 提取参数，必填校验 | `queryToMap` 透传 |
| `xhsUserInfo` | 提取 `user_id`，必填校验 | `queryToMap` 透传 |
| `xhsTopics` | 提取 `keyword`，必填校验 | `queryToMap` 透传 |
| `xhsNotifications` | 业务校验 type 枚举值 | `queryToMap` 透传 |
| `xhsSearchFilter` | 提取参数，必填校验 | `queryToMap` 透传 |
| 所有新增 XHS 写操作端点 | 从一开始按规范实现 | `readRawBody` 透传 |

**Twitter 端点（部分，未全部完成）：**

| 端点 | 状态 |
|------|------|
| `execAction` | ✅ `mergeAction` 注入 action，其余透传 |
| `tweetsDispatch` / `userProfile` 等 | 🔲 待重构（低优先级） |

---

## 九、参考

- handler 实现：`localBridge/go-lib/pkg/restapi/handler.go`
