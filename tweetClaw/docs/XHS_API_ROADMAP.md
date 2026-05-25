# 小红书 API 能力清单与开发计划

> 目标：为 AI 自动化运营小红书构建完整的基础 API 能力层  
> 创建日期：2026-05-25  
> 状态：规划中

---

## 一、架构定位

tweetClaw 是一个 Chrome 扩展，通过 WebSocket 连接 localBridge（Go 服务），localBridge 对外暴露 REST API，供上层 AI 智能体调用。

```
AI 智能体 / MCP 工具
       ↓ REST API
  localBridge (Go)
       ↓ WebSocket (messageType + payload)
   tweetClaw (Chrome 扩展)
       ↓ 页面 context / content script
  小红书页面 (XHS APIs)
```

每个 XHS 功能对应一个 `messageType`，例如：

```
request.xhs_get_self_info        → 获取自己的账号信息
request.xhs_get_note_comments    → 获取笔记评论
request.xhs_post_comment         → 发布评论
```

localBridge 通过 `pluginInvoke` 通用端点或预制快捷端点调用，payload 完全透传，tweetClaw 处理后返回原始 JSON。

---

## 二、Spider_XHS 已实现 API 清单（参考基准）

### 2.1 用户信息

| # | 功能 | HTTP | 路径 |
|---|------|------|------|
| 1 | 获取他人用户信息 | GET | `/api/sns/web/v1/user/otherinfo` |
| 2 | 获取自己用户信息 | GET | `/api/sns/web/v1/user/selfinfo` |
| 3 | 获取自己用户信息 v2 | GET | `/api/sns/web/v2/user/me` |

### 2.2 笔记

| # | 功能 | HTTP | 路径 |
|---|------|------|------|
| 4 | 获取笔记详情 | POST | `/api/sns/web/v1/feed` |
| 5 | 获取用户发布的笔记列表 | GET | `/api/sns/web/v1/user_posted` |
| 6 | 获取用户点赞的笔记 | GET | `/api/sns/web/v1/note/like/page` |
| 7 | 获取用户收藏的笔记 | GET | `/api/sns/web/v2/note/collect/page` |
| 8 | 获取已发布笔记列表（creator 域） | GET | `/api/galaxy/creator/note/user/posted` |
| 9 | 获取主页推荐 feed | POST | `/api/sns/web/v1/homefeed` |
| 10 | 获取主页频道列表 | GET | `/api/sns/web/v1/homefeed/category` |

### 2.3 搜索

| # | 功能 | HTTP | 路径 |
|---|------|------|------|
| 11 | 搜索笔记 | POST | `/api/sns/web/v1/search/notes` |
| 12 | 搜索用户 | POST | `/api/sns/web/v1/search/usersearch` |
| 13 | 搜索关键词推荐 | GET | `/api/sns/web/v1/search/recommend` |
| 14 | 搜索话题 | POST | `/web_api/sns/v1/search/topic` |
| 15 | 搜索地点 POI | POST | `/web_api/sns/v1/local/poi/creator/search` |

### 2.4 评论

| # | 功能 | HTTP | 路径 |
|---|------|------|------|
| 16 | 获取笔记一级评论 | GET | `/api/sns/web/v2/comment/page` |
| 17 | 获取笔记二级评论 | GET | `/api/sns/web/v2/comment/sub/page` |

### 2.5 消息通知

| # | 功能 | HTTP | 路径 |
|---|------|------|------|
| 18 | 获取未读消息数 | GET | `/api/sns/web/unread_count` |
| 19 | 获取评论和@提醒 | GET | `/api/sns/web/v1/you/mentions` |
| 20 | 获取赞和收藏通知 | GET | `/api/sns/web/v1/you/likes` |
| 21 | 获取新增关注通知 | GET | `/api/sns/web/v1/you/connections` |

### 2.6 发布（tweetClaw 已实现 ✅）

| # | 功能 | HTTP | 路径 | 状态 |
|---|------|------|------|------|
| 22 | 获取 COS 上传凭证 | GET | `/api/media/v1/upload/creator/permit` | ✅ |
| 23 | 上传图片到 COS | PUT | `/spectrum/{fileId}` | ✅ |
| 24 | 发布图文笔记 | POST | `/web_api/sns/v2/note` | ✅ |
| 25 | 发布视频笔记 | POST | `/web_api/sns/v2/note` | 待实现 |

### 2.7 Spider_XHS 未实现的写操作（AI 运营必需）

Spider_XHS 定位是爬虫，只实现了读取和发布。以下写操作需要 tweetClaw 自行实现，全部需要 x-rap-param，复用现有 Hook 方案。

| # | 功能 | 重要性 |
|---|------|--------|
| W1 | 发布评论（他人笔记） | ⭐⭐⭐ |
| W2 | 回复评论（自己笔记） | ⭐⭐⭐ |
| W3 | 点赞笔记 | ⭐⭐⭐ |
| W4 | 关注用户 | ⭐⭐⭐ |
| W5 | 删除评论 | ⭐⭐ |
| W6 | 取消点赞 | ⭐⭐ |
| W7 | 取消关注 | ⭐⭐ |
| W8 | 收藏笔记 | ⭐⭐ |
| W9 | 私信用户 | ⭐⭐ |
| W10 | 删除笔记 | ⭐ |

---

## 三、开发计划

每个功能在 tweetClaw 里的实现路径固定：

```
1. 抓包确认请求体格式（主要工作量）
2. content script 新增函数，复用 requestSign() / requestRapParam()
3. background.ts 新增消息类型处理
4. 在 localBridge preset_payload.go 新增对应 Request 结构体
5. handler.go 新增预制端点（或直接用通用 pluginInvoke 端点）
```

签名和 x-rap-param 完全复用现有方案，每个 API 预计工时 **0.5～1 小时**。

---

### 阶段一：读取 API（感知层）

让 AI 能"看到"账号状态和平台内容，是写操作的前提。读取 API 不需要 x-rap-param。

**对应 messageType 命名规范：** `request.xhs_<动词>_<对象>`

| 优先级 | messageType | 功能 | 参考 # | 预计工时 |
|--------|------------|------|--------|---------|
| P0 | `request.xhs_get_self_info` | 获取自己账号信息 | #3 | 0.5h |
| P0 | `request.xhs_get_published_notes` | 获取已发布笔记列表 | #8 | 0.5h |
| P0 | `request.xhs_get_note_detail` | 获取笔记详情 | #4 | 0.5h |
| P0 | `request.xhs_get_note_comments` | 获取笔记评论（含二级） | #16 #17 | 1h |
| P0 | `request.xhs_get_notifications` | 获取未读消息和通知 | #18 #19 #20 | 1h |
| P1 | `request.xhs_search_notes` | 搜索笔记 | #11 | 0.5h |
| P1 | `request.xhs_search_topics` | 搜索话题 | #14 | 0.5h |
| P1 | `request.xhs_get_user_info` | 获取他人用户信息 | #1 | 0.5h |
| P2 | `request.xhs_search_users` | 搜索用户 | #12 | 0.5h |
| P2 | `request.xhs_get_homefeed` | 获取主页推荐 feed | #9 | 0.5h |

**阶段一总工时预估：约 6 小时**

---

### 阶段二：写操作 API（执行层）

AI 运营的核心动作，全部需要 x-rap-param，复用现有 Hook 方案。

| 优先级 | messageType | 功能 | 参考 # | 预计工时 |
|--------|------------|------|--------|---------|
| P0 | `request.xhs_reply_comment` | 回复评论 | W2 | 1h |
| P0 | `request.xhs_post_comment` | 发布评论 | W1 | 1h |
| P0 | `request.xhs_like_note` | 点赞笔记 | W3 | 0.5h |
| P1 | `request.xhs_follow_user` | 关注用户 | W4 | 0.5h |
| P1 | `request.xhs_delete_comment` | 删除评论 | W5 | 0.5h |
| P2 | `request.xhs_unlike_note` | 取消点赞 | W6 | 0.5h |
| P2 | `request.xhs_unfollow_user` | 取消关注 | W7 | 0.5h |
| P2 | `request.xhs_collect_note` | 收藏笔记 | W8 | 0.5h |
| P3 | `request.xhs_send_dm` | 私信用户 | W9 | 2h |
| P3 | `request.xhs_delete_note` | 删除笔记 | W10 | 1h |

**阶段二总工时预估：约 8 小时**

---

## 四、AI 智能体应用场景（供上层参考）

tweetClaw 只提供原子 API，以下场景由上层智能体编排实现：

| 场景 | 依赖的 tweetClaw API |
|------|-------------------|
| 自动回复评论 | `get_notifications` + `reply_comment` |
| 话题互动增长 | `search_notes` + `like_note` + `follow_user` |
| 内容发布（含话题） | `search_topics` + `publish_image_note`（已有）|
| 账号数据监控 | `get_self_info` + `get_published_notes` + `get_note_detail` |
| 竞品内容分析 | `search_notes` + `get_note_detail` + `get_note_comments` |
| 私信高价值用户 | `get_note_comments` + `get_user_info` + `send_dm` |

---

## 五、实现规范

### 5.1 频率控制（写操作必须遵守）

```
单次写操作后随机等待：3～8 秒
批量操作批次间隔：30～60 秒
单日建议上限：评论 ≤ 50 条，关注 ≤ 100 人，点赞 ≤ 200 条
```

### 5.2 统一返回格式

```typescript
{ success: true, data: {...} }
{ success: false, error: 'reason', message: '...' }
```

### 5.3 localBridge 端点规范

新 XHS API 统一通过通用端点调用，无需在 handler.go 新增预制端点：

```
POST /api/v1/plugins/tweetClaw/invoke
{
  "messageType": "request.xhs_get_note_comments",
  "payload": { "noteId": "xxx", "cursor": "" }
}
```

如果某个 API 调用频率极高，可在 handler.go 新增预制快捷端点（参考现有 `/api/v1/x/` 系列）。

---

## 六、进度跟踪

| 功能 | messageType | 状态 | 完成日期 |
|------|------------|------|---------|
| 发布图文笔记 | `request.xhs_publish_image_note` | ✅ 已完成 | 2026-05 |
| 两阶段 XHR Hook | — | ✅ 已完成 | 2026-05 |
| 合成行为注入 | — | ✅ 已完成 | 2026-05 |
| 自动开 Tab | — | ✅ 已完成 | 2026-05 |
| 获取自己账号信息 | `request.xhs_get_self_info` | 🔲 待开始 | — |
| 获取已发布笔记列表 | `request.xhs_get_published_notes` | 🔲 待开始 | — |
| 获取笔记详情 | `request.xhs_get_note_detail` | 🔲 待开始 | — |
| 获取笔记评论 | `request.xhs_get_note_comments` | 🔲 待开始 | — |
| 获取消息通知 | `request.xhs_get_notifications` | 🔲 待开始 | — |
| 搜索笔记 | `request.xhs_search_notes` | 🔲 待开始 | — |
| 搜索话题 | `request.xhs_search_topics` | 🔲 待开始 | — |
| 获取他人用户信息 | `request.xhs_get_user_info` | 🔲 待开始 | — |
| 回复评论 | `request.xhs_reply_comment` | 🔲 待开始 | — |
| 发布评论 | `request.xhs_post_comment` | 🔲 待开始 | — |
| 点赞笔记 | `request.xhs_like_note` | 🔲 待开始 | — |
| 关注用户 | `request.xhs_follow_user` | 🔲 待开始 | — |
| 删除评论 | `request.xhs_delete_comment` | 🔲 待开始 | — |
| 取消点赞 | `request.xhs_unlike_note` | 🔲 待开始 | — |
| 取消关注 | `request.xhs_unfollow_user` | 🔲 待开始 | — |
| 收藏笔记 | `request.xhs_collect_note` | 🔲 待开始 | — |
| 私信用户 | `request.xhs_send_dm` | 🔲 待开始 | — |
| 删除笔记 | `request.xhs_delete_note` | 🔲 待开始 | — |
