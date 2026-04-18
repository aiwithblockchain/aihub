# TASK: 读取小红书首页 Feed 内容

## 需求目标

实现一个新的小红书读取能力：根据 `cursor_score` 主动读取首页推荐流内容。

规则如下：

- 当 `cursor_score` 为空字符串时，读取首页首批内容
- 当 `cursor_score` 不为空时，基于该游标继续请求下一批数据

该能力用于远程按需读取小红书首页推荐内容，不依赖被动拦截。

---

## 已确认的真实接口

根据抓包，首页推荐流真实接口为：

```http
POST https://edith.xiaohongshu.com/api/sns/web/v1/homefeed
```

请求示例：

```json
{
  "cursor_score": "",
  "num": 35,
  "refresh_type": 1,
  "note_index": 35,
  "unread_begin_note_id": "",
  "unread_end_note_id": "",
  "unread_note_count": 0,
  "category": "homefeed_recommend",
  "search_key": "",
  "need_num": 10,
  "image_formats": ["jpg", "webp", "avif"],
  "need_filter_image": false
}
```

响应关键字段：

```json
{
  "code": 0,
  "data": {
    "cursor_score": "1.7764983969650025E9",
    "items": [ ... ]
  }
}
```

说明：

- `data.items` 是内容列表
- `data.cursor_score` 是下一页游标

---

## 设计原则

1. **只做主动读取，不做被动上报**
2. **以真实抓包接口为准，不猜 API**
3. **先透传原始返回，再考虑二次抽取结构**
4. **保持现有 content 调用链路一致**
5. **保留后续升级到 inject/页面签名链路的空间**

---

## 建议协议设计

### LocalBridge 请求

```json
{
  "type": "command.query_xhs_homefeed",
  "id": "req_xxx",
  "source": "LocalBridge",
  "target": "tweetClaw",
  "timestamp": 1234567890,
  "payload": {
    "cursor_score": ""
  }
}
```

### 成功响应

```json
{
  "type": "response.query_xhs_homefeed",
  "id": "req_xxx",
  "source": "tweetClaw",
  "target": "LocalBridge",
  "timestamp": 1234567890,
  "payload": {
    "code": 0,
    "data": {
      "cursor_score": "next_cursor",
      "items": [ ... ]
    }
  }
}
```

### 失败响应

沿用统一错误响应：

```json
{
  "type": "response.error",
  "payload": {
    "code": "INTERNAL_ERROR",
    "message": "..."
  }
}
```

---

## 扩展内部消息设计

建议新增内部消息：

```ts
XHS_FETCH_HOMEFEED
```

content script 收到后调用：

```ts
fetchXhsHomefeed(cursorScore)
```

---

## 代码修改计划

### 1. `src/platforms/xiaohongshu/xhs-consts.ts`

新增或修正：

- 新增 `HOMEFEED: '/api/sns/web/v1/homefeed'`
- 新增 `FETCH_HOMEFEED: 'XHS_FETCH_HOMEFEED'`

说明：
- 当前已有 `FEED: '/api/sns/web/v1/feed'`
- 但抓包确认真实首页推荐流应使用 `/api/sns/web/v1/homefeed`
- 先保留原常量，避免误伤其他逻辑；新增 `HOMEFEED` 更安全

---

### 2. `src/platforms/xiaohongshu/xhs-api.ts`

新增函数：

```ts
fetchXhsHomefeed(cursorScore?: string)
```

行为：

- POST 到 `/api/sns/web/v1/homefeed`
- 复用当前 XHS headers（含 `x-s` / `x-t`）
- 请求体中：
  - `cursor_score` 为空时表示首页首批
  - 非空时表示翻页

初版先按抓包固定以下参数：

```json
{
  "cursor_score": cursorScore || "",
  "num": 35,
  "refresh_type": 1,
  "note_index": 35,
  "unread_begin_note_id": "",
  "unread_end_note_id": "",
  "unread_note_count": 0,
  "category": "homefeed_recommend",
  "search_key": "",
  "need_num": 10,
  "image_formats": ["jpg", "webp", "avif"],
  "need_filter_image": false
}
```

初版先直接返回原始 JSON。

---

### 3. `src/content/xhs-main-entrance.ts`

新增分支：

- 监听 `XHS_FETCH_HOMEFEED`
- 调用 `fetchXhsHomefeed(message.cursor_score)`
- 将原始响应通过 `sendResponse` 返回

---

### 4. `src/service_work/background.ts`

新增 handler：

```ts
queryXhsHomefeed(payload)
```

行为：

- 查找当前小红书 tab
- `chrome.tabs.sendMessage()` 给 content script
- 发送：

```ts
{
  type: 'XHS_FETCH_HOMEFEED',
  cursor_score: payload?.cursor_score || ''
}
```

- 成功时返回原始 feed 数据
- 失败时抛出统一错误

并将 handler 注册到 LocalBridge socket。

---

### 5. `src/bridge/ws-protocol.ts`

新增协议类型：

- `command.query_xhs_homefeed`
- `response.query_xhs_homefeed`

新增请求 payload 类型，例如：

```ts
export interface QueryXhsHomefeedRequestPayload {
  cursor_score?: string;
}
```

---

### 6. `src/bridge/local-bridge-socket.ts`

新增：

- `queryXhsHomefeedHandler`
- switch case 处理 `command.query_xhs_homefeed`
- `handleQueryXhsHomefeed(req)`

响应结构仿照：

- `handleQueryXBasicInfo`
- `handleQueryXhsAccountInfo`

---

### 7. `test_websocket_server.py`

新增自动测试命令：

```json
{
  "type": "command.query_xhs_homefeed",
  "payload": {
    "cursor_score": ""
  }
}
```

建议：
- 第一条测首页首批 feed
- 后续如有需要，再追加第二条带 `cursor_score` 的翻页测试

---

## 实现阶段建议

### 第一阶段：先打通首屏读取
目标：
- `cursor_score = ""` 时能正常返回首页推荐流

验收标准：
- `2.log` 中出现 `response.query_xhs_homefeed`
- 返回中包含：
  - `code: 0`
  - `data.items`
  - `data.cursor_score`

### 第二阶段：再验证翻页
目标：
- 将第一阶段返回的 `data.cursor_score` 回传
- 能拿到下一批内容

验收标准：
- 返回的 `items` 与首批不同
- 新的 `cursor_score` 继续可用

---

## 风险点

1. `homefeed` 属于高风控接口
   - 可能依赖动态签名链路
   - 当前先按抓包参数实现，不保证长期稳定

2. `num` / `need_num` / `note_index` / `refresh_type` 语义尚未完全穷尽
   - 初版先固定为抓包值
   - 后续若出现异常，再做参数研究

3. 可能需要更多请求头
   - 当前先复用现有 `x-s` / `x-t` 方案
   - 如果失败，再结合 inject 补强

---

## 成功标准

1. 能通过 WebSocket 主动读取小红书首页推荐内容
2. `cursor_score` 为空时返回首批 feed
3. `cursor_score` 非空时返回后续 feed
4. 返回结果至少包含：
   - `items`
   - `cursor_score`
5. 不影响现有 `query_xhs_account_info` 能力
