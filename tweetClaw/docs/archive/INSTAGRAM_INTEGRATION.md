# Instagram 集成技术文档

> 归档日期：2026-06-09
> 状态：阶段一、阶段二已完成 (19/19 API, 100%)

---

## 一、架构概述

### 1.1 系统架构

Instagram 集成遵循 tweetClaw 现有架构模式：

```
AI 智能体 / Python SDK
       ↓ REST API
  localBridge (Go)
       ↓ WebSocket (messageType + payload)
   tweetClaw (Chrome 扩展)
       ↓ 页面 context / content script
  Instagram 页面 (Web APIs)
```

每个 Instagram 功能对应一个 `messageType`，例如：

```
command.ig_get_self_info        → 获取自己的账号信息
command.ig_get_feed             → 获取 Feed 内容
command.ig_post_media           → 发布媒体内容
command.ig_like_media           → 点赞
```

### 1.2 文件结构

```
tweetClaw/src/
├── content/
│   ├── main_entrance.ts          # X (Twitter) 入口
│   ├── xhs-main-entrance.ts      # XHS 入口
│   └── ig-main-entrance.ts       # Instagram 入口
├── ig_api/                       # Instagram API 层
│   ├── ig_api.ts                 # API 调用封装
│   ├── signature.ts              # 签名算法
│   ├── cookie-helper.ts          # Cookie 管理
│   ├── graphql-helper.ts         # GraphQL 辅助函数
│   ├── constants.ts              # 常量定义
│   └── types.ts                  # 类型定义

localBridge/go-lib/pkg/restapi/
└── handler.go                    # REST API 端点

clawbot/
├── transport/
│   └── ig_api.py                 # Instagram Transport
└── services/
    └── ig.py                     # Instagram Service
```

---

## 二、API 清单

### 2.1 读取 API（感知层）- 11/11 完成

| 优先级 | messageType | 功能 | API 类型 | 测试日期 |
|--------|------------|------|---------|---------|
| P0 | `command.ig_get_self_info` | 获取自己账号信息 | REST | 2026-06-07 |
| P0 | `command.ig_get_feed` | 获取主页 Feed | GraphQL | 2026-06-07 |
| P1 | `command.ig_get_user_info` | 获取他人用户信息 | REST | 2026-06-07 |
| P1 | `command.ig_get_media` | 获取媒体详情 | GraphQL | 2026-06-07 |
| P1 | `command.ig_get_media_comments` | 获取媒体评论 | REST | 2026-06-07 |
| P1 | `command.ig_search` | 搜索内容（支持分页） | GraphQL | 2026-06-08 |
| P1 | `command.ig_search_user` | 搜索用户 | GraphQL | 2026-06-07 |
| P1 | `command.ig_get_notifications` | 获取消息通知 | GraphQL | 2026-06-09 |
| P2 | `command.ig_get_user_media` | 获取用户发布内容 | GraphQL | 2026-06-07 |
| P2 | `command.ig_get_followers` | 获取粉丝列表 | REST | 2026-06-09 |
| P2 | `command.ig_get_following` | 获取关注列表 | REST | 2026-06-09 |

### 2.2 写操作 API（执行层）- 8/8 完成

| 优先级 | messageType | 功能 | API 类型 | 测试日期 |
|--------|------------|------|---------|---------|
| P0 | `command.ig_post_media` | 发布图文/视频 | REST | 2026-06-09 |
| P0 | `command.ig_like_media` | 点赞 | GraphQL | 2026-06-06 |
| P0 | `command.ig_post_comment` | 发布评论 | REST | 2026-06-07 |
| P0 | `command.ig_follow_user` | 关注用户 | GraphQL | 2026-06-07 |
| P1 | `command.ig_unlike_media` | 取消点赞 | GraphQL | 2026-06-07 |
| P1 | `command.ig_unfollow_user` | 取消关注 | GraphQL | 2026-06-07 |
| P2 | `command.ig_delete_media` | 删除内容 | REST | 2026-06-09 |
| P2 | `command.ig_delete_comment` | 删除评论 | REST | 2026-06-07 |

### 2.3 高级功能（待开发）

| 优先级 | messageType | 功能 | 状态 |
|--------|------------|------|------|
| P1 | `command.ig_post_reel` | 发布 Reels | 待开发 |
| P2 | `command.ig_post_story` | 发布 Stories | 待开发 |
| P2 | `command.ig_send_dm` | 发送私信 | 待开发 |

---

## 三、技术要点

### 3.1 认证机制

Instagram Web API 使用以下认证方式：

```
Headers:
  - X-CSRFToken: {csrftoken}
  - X-IG-App-ID: 936619743392459
  - X-IG-WWW-Claim: hmac.AR0WfvuQCL7DQedh15YwL5r8w1EnVqMNDPpLTaXT-bsO97RD
  - X-Requested-With: XMLHttpRequest
  - Cookie: sessionid=xxx; csrftoken=xxx; ds_user_id=xxx
```

**关键 Cookies：**

| Cookie 名称 | 用途 |
|------------|------|
| `sessionid` | 会话 ID，核心认证凭证 |
| `csrftoken` | CSRF 防护 |
| `ds_user_id` | 用户 ID |

### 3.2 签名算法

Instagram 部分写操作需要请求签名：

```typescript
// 签名算法：HMAC-SHA256
const signature = createHmac('sha256', SIGNATURE_KEY)
  .update(jsonPayload)
  .digest('hex');

// 签名格式
const signedBody = `${signature}.${jsonPayload}`;
```

**签名密钥（硬编码）：**
```typescript
const SIGNATURE_KEY = '9193488027538fd3450b83b7d05286d4ca9599a0f7eeed90d8c85925698a05dc';
const SIGNATURE_VERSION = '4';
```

### 3.3 GraphQL API 格式

Instagram Web 已从 REST API 迁移到 GraphQL API。

**请求格式：**
```typescript
const body = new URLSearchParams();
body.append('av', '17841427211664125');
body.append('__d', 'www');
body.append('fb_dtsg', fbDtsgToken);  // 从页面提取
body.append('variables', JSON.stringify(variables));
body.append('doc_id', docId);

// Headers
headers.set('x-fb-friendly-name', mutationName);
```

**关键点：**
- `fb_dtsg` token 必须从页面 DOM 提取
- `x-fb-friendly-name` header 必须匹配 mutation/query 名称
- `doc_id` 必须正确

### 3.4 REST API 端点

| 功能 | 端点 | 方法 |
|------|------|------|
| 获取用户信息 | `/api/v1/users/{user_id}/info/` | GET |
| 获取粉丝列表 | `/api/v1/friendships/{user_id}/followers/` | GET |
| 获取关注列表 | `/api/v1/friendships/{user_id}/following/` | GET |
| 发布评论 | `/api/v1/web/comments/{media_id}/add/` | POST |
| 删除评论 | `/api/v1/web/comments/{media_id}/delete/{comment_id}/` | POST |
| 删除媒体 | `/api/v1/web/create/{media_id}/delete/` | POST |

---

## 四、API 迁移记录

### 4.1 REST → GraphQL 迁移

| 功能 | 旧 API | 新 API | 状态 |
|------|---------|--------|------|
| 获取媒体详情 | `/p/{shortcode}/?__a=1` | GraphQL Query | ✅ 已废弃 |
| 关注用户 | `/api/v1/friendships/create/{id}/` | GraphQL Mutation | ✅ 已迁移 |
| 取消关注 | `/api/v1/friendships/destroy/{id}/` | GraphQL Mutation | ✅ 已迁移 |
| 发布评论 | `/api/v1/media/{id}/comment/` | `/api/v1/web/comments/{id}/add/` | ✅ 端点变更 |

### 4.2 GraphQL Mutation/Query 清单

| 功能 | Mutation/Query 名称 | doc_id |
|------|---------------------|--------|
| 点赞 | `usePolarisLikeMediaXIGLikeMutation` | `26662414810082851` |
| 取消点赞 | `usePolarisLikeMediaXIGUnlikeMutation` | `26662414810082851` |
| 关注 | `usePolarisFollowMutation` | `26508036048874888` |
| 取消关注 | `usePolarisUnfollowMutation` | `27789106940691111` |
| 获取媒体详情 | `PolarisPostRootQuery` | `26713194205046842` |
| 获取 Feed | `PolarisHomeFeedQuery` | `26713194205046842` |

---

## 五、分页机制

### 5.1 REST API 分页

**Followers/Following API：**
```
GET /api/v1/friendships/{user_id}/followers/?count=12&max_id={cursor}
```

响应：
```json
{
  "users": [...],
  "has_more": true,
  "next_max_id": "cursor_value",
  "page_size": 12
}
```

### 5.2 GraphQL API 分页

**Search API：**
```typescript
variables = {
  query: "search_term",
  first: 12,        // 获取数量
  after: "cursor",  // 下一页游标（可选）
  before: "cursor", // 上一页游标（可选）
}
```

响应：
```json
{
  "edges": [...],
  "page_info": {
    "has_next_page": true,
    "end_cursor": "cursor_value"
  }
}
```

---

## 六、媒体发布流程

### 6.1 图片发布

```
1. uploadImage()
   - POST https://i.instagram.com/rupload_igphoto/fb_uploader_{upload_id}
   - Headers: x-entity-length, x-instagram-rupload-params
   - 返回 upload_id

2. configure()
   - POST /api/v1/media/configure/
   - 参数: upload_id, caption, location 等
   - 返回 media_id
```

### 6.2 视频发布

```
1. uploadVideo()
   - POST https://i.instagram.com/rupload_igvideo/fb_uploader_{upload_id}
   - 需要视频时长、宽高等参数

2. configure()
   - POST /api/v1/media/configure_video/
   - 参数: upload_id, caption, duration, width, height
```

---

## 七、测试覆盖

### 7.1 测试脚本清单

| 测试脚本 | API | 状态 |
|---------|-----|------|
| `ig_test_1_get_self_info.py` | get_self_info | ✅ |
| `ig_test_2_get_user_info.py` | get_user_info | ✅ |
| `ig_test_3_search_user.py` | search_user | ✅ |
| `ig_test_4_like_media.py` | like_media | ✅ |
| `ig_test_5_unlike_media.py` | unlike_media | ✅ |
| `ig_test_6_follow_user.py` | follow_user | ✅ |
| `ig_test_7_unfollow_user.py` | unfollow_user | ✅ |
| `ig_test_8_post_comment.py` | post_comment | ✅ |
| `ig_test_9_get_feed.py` | get_feed | ✅ |
| `ig_test_10_get_media_info.py` | get_media_info | ✅ |
| `ig_test_11_get_media_comments.py` | get_media_comments | ✅ |
| `ig_test_12_delete_comment.py` | delete_comment | ✅ |
| `ig_test_13_post_media.py` | post_media | ✅ |
| `ig_test_14_delete_media_simple.py` | delete_media | ✅ |
| `ig_test_15_get_user_media.py` | get_user_media | ✅ |
| `ig_test_18_search.py` | search | ✅ |
| `ig_test_19_search_pagination.py` | search (分页) | ✅ |
| `ig_test_21_get_notifications.py` | get_notifications | ✅ |
| `ig_test_22_get_followers.py` | get_followers | ✅ |
| `ig_test_23_get_following.py` | get_following | ✅ |

**测试覆盖率：** 20/20 (100%) ✅

---

## 八、工具函数

### 8.1 Shortcode ↔ Media ID 转换

```typescript
// Shortcode 转 Media ID
shortcodeToMediaId('DWxxh4pJHjK')  // => '3869091387729541322'

// Media ID 转 Shortcode
mediaIdToShortcode('3869091387729541322')  // => 'DWxxh4pJHjK'

// 从 URL 提取 Shortcode
extractShortcodeFromUrl('https://www.instagram.com/p/DWxxh4pJHjK/')  // => 'DWxxh4pJHjK'
```

### 8.2 全局 API（window.igApi）

```javascript
// 在 Instagram 页面控制台可用
await window.igApi.getSelfInfo()
await window.igApi.getFeed()
await window.igApi.likeMedia({ mediaId: '123' })
await window.igApi.followUser({ userId: '456' })
```

---

## 九、频率限制

Instagram 对自动化操作有严格限制：

```
单次写操作后随机等待：5～15 秒
每小时点赞上限：~100 次
每小时关注上限：~30 次
每天发布上限：~25 条
```

---

## 十、错误处理

### 10.1 常见错误码

| 错误类型 | 说明 | 处理方式 |
|---------|------|---------|
| `rate_limited` | 频率限制 | 等待后重试 |
| `auth_required` | 需要登录 | 检查 Cookie |
| `media_invalid` | 媒体无效 | 检查格式/大小 |
| `user_not_found` | 用户不存在 | 检查 user_id |
| `private_account` | 私密账号 | 无法访问 |

### 10.2 常见问题排查

**问题 1：Content Script 未加载**
- 检查 manifest.json 中 content_scripts 配置
- 确认 URL 匹配模式正确
- 刷新 Instagram 页面

**问题 2：Cookie 读取失败**
- 确认已登录 Instagram
- 检查 host_permissions 是否包含 `https://www.instagram.com/*`

**问题 3：fb_dtsg token 获取失败**
- 刷新 Instagram 页面
- 检查 DOM 中是否存在 `input[name="fb_dtsg"]`

---

## 十一、参考资源

### 11.1 开源项目

- [instagram-private-api (Nerixyz)](https://github.com/Nerixyz/instagram-private-api) - TypeScript，签名算法参考
- [instaloader](https://github.com/instaloader/instaloader) - Python，数据结构参考

### 11.2 内部参考

- `tweetClaw/docs/archive/XHS_API_ROADMAP.md` - XHS 开发路线图
- `tweetClaw/src/content/xhs-main-entrance.ts` - XHS 实现参考
- `tweetClaw/src/content/main_entrance.ts` - X 实现参考