# TODO — aihub/tweetClaw & localBridge 待办事项

---

## [高优先级] QueryID 自动更新机制

**背景：**
推特的 GraphQL API 使用动态 queryId（URL 路径中的哈希值，如 `CreateTweet: zkcFc6F-RKRgWN8HUkJfZg`）。这些 queryId 不定期会被推特更新，一旦失效，对应操作就会报错。

当前 `defaultQueryKeyMap`（`tweetClaw/src/capture/consts.ts`）中的 queryId 是静态硬编码的，存在以下问题：
1. 推特更新后需要手动更新代码并重新发布扩展
2. 旧版本扩展用户在推特更新后会持续失败

**期望方案：** 实现一套 queryId 远程配置/自动更新机制，具体方向包括：

### 方案 A（简单）：远程配置文件
- 在某个可控的服务端（如 GitHub raw / CloudFlare Workers）维护一个 `queryid_map.json`
- tweetClaw 扩展定时（如每天一次）拉取最新的 map，覆盖本地 storage
- 如果拉取失败，fallback 到 `defaultQueryKeyMap` 硬编码值
- LocalBridgeMac 提供一个手动触发"强制更新 queryId"的按钮

### 方案 B（智能）：自动 harvest + 上报
- 当 tweetClaw 在浏览器中检测到新的 queryId（与本地不同），自动上报到中央服务
- 中央服务聚合多用户上报，动态更新 `queryid_map.json`
- 其他用户的扩展通过方案 A 的拉取机制获取更新

### 当前 QueryID 状态汇总（全部已确认）

| Operation | QueryID | 确认时间 | 状态 |
|-----------|---------|----------|------|
| `CreateTweet` | `zkcFc6F-RKRgWN8HUkJfZg` | 2025-05 | ✅ 已写入 map |
| `DeleteTweet` | `nxpZCY2K-I6QoFHAHeojFQ` | 2025-05 | ✅ 已写入 map |
| `DeleteRetweet` | `ZyZigVsNiFO6v1dEks1eWg` | 2025-05 | ✅ 已写入 map |
| `UnfavoriteTweet` | `ZYKSe-w7KEslx3JhSIk5LA` | 已有 | ✅ 已写入 map |
| `DeleteBookmark` | `Wlmlj2-xzyS1GN3a6cj-mQ` | 已有 | ✅ 已写入 map |
| `FavoriteTweet` | `lI07N6Otwv1PhnEgXILM7A` | 已有 | ✅ 已写入 map |
| `CreateRetweet` | `mbRO74GrOvSfRcJnlMapnQ` | 已有 | ✅ 已写入 map |
| `CreateBookmark` | `aoDbu3RHznuiSkQ9aNM67Q` | 已有 | ✅ 已写入 map |
| `CreateFriendship` | `66v9_S_vThhArew_99v9_v9` | 已有 | ✅ 已写入 map |
| `DestroyFriendship` | `Opv7_p8AunMhJvD8X8c9rw` | 已有 | ✅ 已写入 map |
| `UserByScreenName` | `ck5KkZ8t5cOmoLssopN99Q` | 已有 | ✅ 已写入 map |

**当前状态：所有已实现功能的 queryId 均已确认，无待获取项。**

### 后续行动
- [ ] 设计远程配置文件格式（JSON schema）
- [ ] 实现定时拉取逻辑（扩展侧）
- [ ] LocalBridgeMac UI 增加"QueryID 状态"面板（显示各操作 queryId 和更新时间）

---

## [低优先级] 功能扩展

### 媒体推文支持（图片/视频）
- 需要先实现 `media_upload` 接口（上传图片获取 media_id）
- 发推 API 中 `media.media_entities` 支持传入 media_id 数组
- 依赖：POST `https://upload.twitter.com/1.1/media/upload.json`

### 私信（DM）支持
- 发送 DM：`CreateDMMessage` GraphQL mutation
- 读取 DM：`DMInbox` / `DMTimeline`
- 较为复杂，涉及对话 ID 管理

### 粉丝/关注列表 API
- `GET /api/v1/x/followers?userId=xxx`：读取某人的粉丝列表
- `GET /api/v1/x/following?userId=xxx`：读取某人的关注列表

### 搜索 API 支持 query 参数传入
- 当前 `GET /api/v1/x/search` 只读取已缓存的搜索结果
- 未来考虑支持直接传入关键词，自动 navigate 并等待结果

---

## [架构] 值得考虑的改进

### HTTP 请求解析升级
当前 LocalBridgeMac 的 HTTP server 使用原始字符串 `contains` 做路由匹配，存在路由冲突风险（如 `GET /api/v1/x/tweets` 和 `GET /api/v1/x/status` 都包含 `/api/v1/x/`）。考虑在未来实现一个更健壮的 HTTP 路由解析器（按 method + path 精确匹配）。

### WebSocket 协议版本管理
随着消息类型不断增加（目前已有 20+ 种），考虑引入协议版本协商机制，使服务端能优雅降级处理旧版客户端。
