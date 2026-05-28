# API Test Checklist — Passthrough Refactor

本次重构将 Go localBridge 层改为纯透传，业务逻辑（参数校验、默认值）全部下沉到 content script 和 Python 客户端。以下是涉及改动的所有 API，请逐一测试。

---

## 测试环境准备

1. 启动 Go localBridge：`cd localBridge/go-lib && go run ./cmd/...`
2. 加载 tweetClaw 插件（已重新构建）
3. 打开对应平台 tab（x.com 或 xiaohongshu.com）
4. 使用 Python 客户端或 curl 发起请求

---

## 一、X (Twitter) API

### 1.1 GET /api/v1/x/timeline — 主页时间线

```bash
curl http://localhost:PORT/api/v1/x/timeline
```

- [ ] 返回推文列表（非空）
- [ ] 无 x.com tab 时返回错误

---

### 1.2 GET /api/v1/x/tweets?tweetId=XXX — 获取推文详情

```bash
curl "http://localhost:PORT/api/v1/x/tweets?tweetId=<tweet_id>"
```

- [ ] 返回推文原始数据
- [ ] 缺少 `tweetId` 时 content script 返回错误（不再由 Go 校验）

---

### 1.3 GET /api/v1/x/tweets/:id/replies — 获取推文回复

```bash
curl "http://localhost:PORT/api/v1/x/tweets/<tweet_id>/replies"
curl "http://localhost:PORT/api/v1/x/tweets/<tweet_id>/replies?cursor=<cursor>"
```

- [ ] 返回回复列表
- [ ] cursor 参数可选，传入时正常分页

---

### 1.4 GET /api/v1/x/users?screenName=XXX — 获取用户信息

```bash
curl "http://localhost:PORT/api/v1/x/users?screenName=elonmusk"
```

- [ ] 返回用户 profile 原始数据
- [ ] 缺少 `screenName` 时返回错误

---

### 1.5 GET /api/v1/x/search?query=XXX&count=20 — 搜索

```bash
curl "http://localhost:PORT/api/v1/x/search?query=bitcoin&count=20"
```

- [ ] 返回搜索结果
- [ ] **注意：`count` 不再有默认值，必须显式传入**
- [ ] 缺少 `count` 时 content script 应报错（或使用 Python 客户端默认值 20）

---

### 1.6 GET /api/v1/x/user_tweets?userId=XXX&count=20 — 用户推文列表

```bash
curl "http://localhost:PORT/api/v1/x/user_tweets?userId=<user_id>&count=20"
```

- [ ] 返回用户推文列表
- [ ] **`count` 必须显式传入**

---

### 1.7 GET /api/v1/x/followers?userId=XXX&count=20 — 粉丝列表（新增）

```bash
curl "http://localhost:PORT/api/v1/x/followers?userId=<user_id>&count=20"
```

- [ ] 返回粉丝列表原始数据
- [ ] cursor 分页正常工作

---

### 1.8 GET /api/v1/x/following?userId=XXX&count=20 — 关注列表（新增）

```bash
curl "http://localhost:PORT/api/v1/x/following?userId=<user_id>&count=20"
```

- [ ] 返回关注列表原始数据
- [ ] cursor 分页正常工作

---

### 1.9 GET /api/v1/x/blue_verified_followers?userId=XXX&count=20 — 蓝 V 粉丝（新增）

```bash
curl "http://localhost:PORT/api/v1/x/blue_verified_followers?userId=<user_id>&count=20"
```

- [ ] 返回蓝 V 粉丝列表原始数据

---

### 1.10 POST /api/v1/x/tweets — 发推文

```bash
curl -X POST http://localhost:PORT/api/v1/x/tweets \
  -H "Content-Type: application/json" \
  -d '{"text": "test tweet", "action": "post_tweet"}'
```

- [ ] 成功发推，返回推文数据
- [ ] 带 `attachmentUrl` 时自动变为 quote tweet

---

### 1.11 POST /api/v1/x/replies — 回复推文

```bash
curl -X POST http://localhost:PORT/api/v1/x/replies \
  -H "Content-Type: application/json" \
  -d '{"tweetId": "<tweet_id>", "text": "test reply"}'
```

- [ ] 成功回复，返回推文数据

---

### 1.12 POST /api/v1/x/likes — 点赞

```bash
curl -X POST http://localhost:PORT/api/v1/x/likes \
  -H "Content-Type: application/json" \
  -d '{"tweetId": "<tweet_id>"}'
```

- [ ] 成功点赞

---

### 1.13 POST /api/v1/x/retweets — 转推

```bash
curl -X POST http://localhost:PORT/api/v1/x/retweets \
  -H "Content-Type: application/json" \
  -d '{"tweetId": "<tweet_id>"}'
```

- [ ] 成功转推

---

### 1.14 POST /api/v1/x/follows — 关注用户

```bash
curl -X POST http://localhost:PORT/api/v1/x/follows \
  -H "Content-Type: application/json" \
  -d '{"userId": "<user_id>"}'
```

- [ ] 成功关注

---

### 1.15 DELETE /api/v1/x/mytweets — 删除推文

```bash
curl -X DELETE http://localhost:PORT/api/v1/x/mytweets \
  -H "Content-Type: application/json" \
  -d '{"tweetId": "<tweet_id>"}'
```

- [ ] 成功删除

---

## 二、XHS (小红书) API

### 2.1 GET /api/v1/xhs/account — 获取账号信息

```bash
curl http://localhost:PORT/api/v1/xhs/account
```

- [ ] 返回当前登录用户信息

---

### 2.2 GET /api/v1/xhs/homefeed — 首页推荐流

```bash
curl http://localhost:PORT/api/v1/xhs/homefeed
curl "http://localhost:PORT/api/v1/xhs/homefeed?cursor_score=<score>"
```

- [ ] 返回推荐笔记列表
- [ ] cursor_score 可选，传入时正常翻页

---

### 2.3 GET /api/v1/xhs/feed?note_id=XXX — 获取笔记详情

```bash
curl "http://localhost:PORT/api/v1/xhs/feed?note_id=<note_id>"
curl "http://localhost:PORT/api/v1/xhs/feed?note_id=<note_id>&xsec_token=<token>&xsec_source=<source>"
```

- [ ] 返回笔记原始数据
- [ ] **缺少 `note_id` 时 content script 返回错误（不再有 `|| ''` fallback）**
- [ ] xsec_token / xsec_source 可选参数正常透传（新增）

---

### 2.4 POST /api/v1/xhs/search — 搜索笔记

```bash
curl -X POST http://localhost:PORT/api/v1/xhs/search \
  -H "Content-Type: application/json" \
  -d '{"keyword": "美食", "page_size": 20}'
```

- [ ] 返回搜索结果
- [ ] **缺少 `keyword` 时 content script 返回错误**
- [ ] **缺少 `page_size` 时 content script 返回错误（不再有默认值 20）**
- [ ] cursor 可选，传入时正常翻页

---

### 2.5 GET /api/v1/xhs/user_notes?user_id=XXX — 用户笔记列表

```bash
curl "http://localhost:PORT/api/v1/xhs/user_notes?user_id=<user_id>"
curl "http://localhost:PORT/api/v1/xhs/user_notes?user_id=<user_id>&xsec_token=<token>&xsec_source=<source>"
```

- [ ] 返回用户笔记列表
- [ ] **缺少 `user_id` 时 content script 返回错误**
- [ ] xsec_token / xsec_source 可选参数正常透传（新增）

---

### 2.6 GET /api/v1/xhs/comments?note_id=XXX — 获取笔记评论

```bash
curl "http://localhost:PORT/api/v1/xhs/comments?note_id=<note_id>"
curl "http://localhost:PORT/api/v1/xhs/comments?note_id=<note_id>&cursor=<cursor>"
```

- [ ] 返回评论列表
- [ ] **缺少 `note_id` 时 content script 返回错误**

---

### 2.7 GET /api/v1/xhs/user_info?user_id=XXX — 获取用户信息

```bash
curl "http://localhost:PORT/api/v1/xhs/user_info?user_id=<user_id>"
```

- [ ] 返回用户信息
- [ ] **缺少 `user_id` 时 content script 返回错误**

---

### 2.8 GET /api/v1/xhs/topics?keyword=XXX — 搜索话题

```bash
curl "http://localhost:PORT/api/v1/xhs/topics?keyword=美食"
```

- [ ] 返回话题列表
- [ ] **缺少 `keyword` 时 content script 返回错误**

---

### 2.9 GET /api/v1/xhs/notifications?notification_type=XXX — 获取通知

```bash
curl "http://localhost:PORT/api/v1/xhs/notifications?notification_type=mentions"
curl "http://localhost:PORT/api/v1/xhs/notifications?notification_type=likes"
```

- [ ] `notification_type=mentions` 正常返回 @通知
- [ ] `notification_type=likes` 正常返回点赞通知
- [ ] **传入非法值时 content script 返回错误（只允许 mentions / likes）**
- [ ] **注意：参数名从 `type` 改为 `notification_type`，旧客户端需升级**

---

### 2.10 GET /api/v1/xhs/published_notes — 已发布笔记

```bash
curl http://localhost:PORT/api/v1/xhs/published_notes
```

- [ ] 返回已发布笔记列表

---

### 2.11 GET /api/v1/xhs/search_filter?keyword=XXX — 搜索过滤器

```bash
curl "http://localhost:PORT/api/v1/xhs/search_filter?keyword=美食"
```

- [ ] 返回过滤器选项
- [ ] **缺少 `keyword` 时 content script 返回错误**

---

### 2.12 POST /api/v1/xhs/publish — 发布图文笔记

```bash
curl -X POST http://localhost:PORT/api/v1/xhs/publish \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试标题",
    "desc": "测试描述",
    "images": [{"base64": "<base64_data>", "mimeType": "image/jpeg"}],
    "privacy_type": 0,
    "topics": []
  }'
```

- [ ] 成功发布笔记，返回笔记 ID
- [ ] **缺少 `images` 时返回错误**
- [ ] 需要 creator.xiaohongshu.com tab 已打开且签名函数就绪

---

## 三、重点回归测试

以下是本次重构的核心变更，需要重点验证：

| 变更点 | 验证方法 |
|--------|---------|
| Go 层不再注入默认值 | 不传 `count` 调用搜索/用户推文，应报错而非用 20 |
| `notification_type` 参数名变更 | 旧参数名 `type` 不再生效 |
| `note_id` 必填校验 | 不传 `note_id` 调用 feed/comments，应报错 |
| `page_size` 必填校验 | 不传 `page_size` 调用 XHS 搜索，应报错 |
| xsec 参数透传 | 传入 xsec_token 后笔记详情接口正常返回 |
| publish 纯透传 | 发布笔记时 Go 不再解析字段，直接转发 body |

---

## 四、升级顺序

1. **Go localBridge app** — 先升级（已完成）
2. **tweetClaw 插件** — 重新打包并加载
3. **clawBotCli Python 客户端** — 最后升级（已完成）
