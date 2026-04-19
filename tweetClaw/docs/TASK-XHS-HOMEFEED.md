# TASK: 读取小红书首页 Feed 内容

## 需求目标

实现一个新的小红书读取能力：根据 `cursor_score` 主动读取首页推荐流内容。

规则如下：

- 当 `cursor_score` 为空字符串时，读取首页首批内容
- 当 `cursor_score` 不为空时，基于该游标继续请求下一批数据

该能力用于远程按需读取小红书首页推荐内容，不依赖被动拦截。

---

## 当前实现状态（已验证成功）

已通过真实页面抓包 + MockLocalBridge 端到端验证：

- `command.query_xhs_account_info` 成功
- `command.query_xhs_homefeed` 首页首屏成功
- `command.query_xhs_homefeed` 第二页成功
- `tweetClaw/2.log` 中已出现连续两次 `response.query_xhs_homefeed` 且 `code = 0`

当前最终方案已经升级为“自动预热 + 主动请求”：

1. background 接到 `command.query_xhs_homefeed`
2. 自动查找或创建小红书 tab
3. 自动导航到 `https://www.xiaohongshu.com/explore?channel_id=homefeed_recommend`
4. 如果最近捕获的动态参数不新鲜，则自动 refresh 页面
5. 等待页面真实 `POST /api/sns/web/v1/homefeed` 请求被 inject/content 捕获
6. content script 将最新动态头与模板写入 `chrome.storage.local`
7. background 再调用 content script 的 `fetchXhsHomefeed(cursor_score)`
8. 返回 `response.query_xhs_homefeed`

其中具体实施细节已单独沉淀在：

- `docs/XHS-HOMEFEED-WARMUP-PLAN.md`
- `docs/XHS-MULTI-CONTEXT-STRATEGY.md`

这意味着：

- 不再依赖人工先刷新页面
- inject 仍然保留为被动采集架构
- 主动业务请求仍由 content script 执行，但依赖页面实时生成的动态参数

---

## 已确认的真实接口

根据抓包，首页推荐流真实接口为：

```http
POST https://edith.xiaohongshu.com/api/sns/web/v1/homefeed
```

此外还存在一个相关但不同的接口：

```http
GET https://edith.xiaohongshu.com/api/sns/web/v1/homefeed/category
```

该接口只用于频道/分类信息，不应与首页内容流请求混淆。

---

## 已验证成功的真实请求模板

### 首屏请求模板

```json
{
  "cursor_score": "",
  "num": 35,
  "refresh_type": 1,
  "note_index": 0,
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

### 翻页请求模板

```json
{
  "cursor_score": "<上一页返回的 cursor_score>",
  "num": 35,
  "refresh_type": 3,
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

### 响应关键字段

```json
{
  "code": 0,
  "data": {
    "cursor_score": "1.7765702079650025E9",
    "items": [ ... ]
  }
}
```

说明：

- `data.items` 是内容列表
- `data.cursor_score` 是下一页游标

---

## 关键动态头策略（最终结论）

### 必须来自页面真实请求捕获，不允许硬编码默认值

以下字段属于高动态值：

- `x-s`
- `x-t`
- `x-s-common`
- `x-rap-param`

结论：

- 这些值不能像 Twitter GraphQL 的 queryId 一样写死在代码里长期使用
- 必须来自页面真实请求的最新捕获值
- 如果缺失，应直接报错并提示用户刷新小红书首页，而不是继续发起高风险请求

### 可使用最近一次捕获值的字段

- `x-b3-traceid`
- `x-xray-traceid`

### 可提供稳定默认值，同时允许页面覆盖的字段

- `xy-direction`
  - 当前已验证的稳定值为：`98`

---

## 设计原则（修正版）

1. **主动读取依赖页面真实动态参数，不直接猜测签名头**
2. **inject 负责被动采集，不负责主动裸 fetch homefeed**
3. **content script 可以执行主动请求，但前提是先拿到页面真实动态头与模板**
4. **以真实抓包接口和真实成功请求模板为准，不猜 API**
5. **先透传原始返回，再考虑二次抽取结构**
6. **动态头按风险分级管理，不把所有字段都按 Twitter queryId 处理**

---

## 当前扩展内部实现

### inject（页面注入脚本）

职责：

- 监听真实页面发出的 homefeed 请求
- 被动捕获关键头：
  - `x-s`
  - `x-t`
  - `x-s-common`
  - `x-rap-param`
  - `x-b3-traceid`
  - `x-xray-traceid`
  - `xy-direction`
- 捕获请求模板：
  - `num`
  - `need_num`
  - `refresh_type`
  - `note_index`
  - `image_formats`
  - `need_filter_image`
  - `category`
  - `search_key`

### content script

职责：

- 接收 inject 捕获结果
- 将关键动态头和模板写入 `chrome.storage.local`
- 在收到 `XHS_FETCH_HOMEFEED` 后执行主动请求

### 主动请求策略

- 发请求前先检查高动态头是否齐全
- 若缺失，则直接抛错：提示先刷新小红书首页
- 若齐全，则按真实模板发起请求

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

## 当前代码修改结果摘要

### `src/platforms/xiaohongshu/xhs-injection.ts`

- 启用了对真实 `HOMEFEED` 请求的被动拦截能力
- 仅做观察/采集，不做 inject 主动发请求
- 调试日志现已受 `window.__XHS_CLAW_DEBUG__` 控制，默认不输出大量 JSON

### `src/content/xhs-main-entrance.ts`

- 捕获真实 `POST /api/sns/web/v1/homefeed` 的关键动态头与模板
- 写入本地 `chrome.storage.local`

### `src/platforms/xiaohongshu/xhs-api.ts`

- 请求头已扩展为完整关键集合
- 高动态头缺失时直接报错
- `xy-direction` 提供稳定默认值 `98`
- 首屏 / 翻页 body 已按真实成功模板对齐

---

## 关键教训

### 1. 问题根因不是“content 环境不能发请求”

真正根因是：

- content 如果没有页面真实生成的动态头，就会 406
- content 如果先拿到页面真实动态头与模板，是可以成功请求的

### 2. inject 主动裸 fetch 不是正确解法

已验证：

- 单纯把请求搬到 inject/page 环境执行，并不会自动获得全部动态头
- 真正有效的是“复用真实页面请求链路生成出来的动态参数”

### 3. XHS 动态头不能等同于 Twitter GraphQL queryId

- queryId 更像接口版本标识，可默认内置并随页面变化更新
- XHS 的 `x-s / x-t / x-s-common / x-rap-param` 明显更动态，不能硬编码长期使用

---

## 后续建议

1. 若继续稳定化，可增加动态头过期检测（例如基于 `captured_at`）
2. 若后续希望统一架构，可单独评估“inject 执行版本”，但不要回到裸 fetch 方案
3. 若功能已稳定，可继续收敛调试日志，避免控制台噪声
4. 可将这一成功策略推广到其它 XHS 高风控接口
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
