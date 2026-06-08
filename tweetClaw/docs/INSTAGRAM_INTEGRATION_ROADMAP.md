# Instagram 集成开发路线图

> 目标：为 AI 自动化运营 Instagram 构建完整的基础 API 能力层  
> 创建日期：2026-06-04  
> 状态：规划阶段

---

## 一、架构定位

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
request.ig_get_self_info        → 获取自己的账号信息
request.ig_get_feed             → 获取 Feed 内容
request.ig_post_media           → 发布媒体内容
request.ig_like_media           → 点赞
```

---

## 二、功能对标（与 X/Twitter 一致）

### 2.1 核心能力映射

| 功能领域 | X (Twitter) | Instagram | 优先级 |
|---------|-------------|-----------|--------|
| **账号信息** | `get_self_info` | `ig_get_self_info` | P0 |
| **时间线/Feed** | `get_home_timeline` | `ig_get_feed` | P0 |
| **发布内容** | `post_tweet` | `ig_post_media` | P0 |
| **发布媒体** | `media_upload` | `ig_upload_media` | P0 |
| **点赞** | `like_tweet` | `ig_like_media` | P0 |
| **评论** | `post_comment` | `ig_post_comment` | P0 |
| **关注** | `follow_user` | `ig_follow_user` | P0 |
| **搜索** | `search_tweets` | `ig_search` | P1 |
| **用户信息** | `get_user_info` | `ig_get_user_info` | P1 |
| **获取评论** | `get_tweet_comments` | `ig_get_media_comments` | P1 |
| **取消点赞** | `unlike_tweet` | `ig_unlike_media` | P2 |
| **取消关注** | `unfollow_user` | `ig_unfollow_user` | P2 |
| **删除内容** | `delete_tweet` | `ig_delete_media` | P2 |
| **消息通知** | `get_notifications` | `ig_get_notifications` | P1 |

### 2.2 Instagram 特有功能（可选）

| 功能 | messageType | 说明 | 优先级 |
|------|------------|------|--------|
| Stories 发布 | `ig_post_story` | 发布 Stories（24h 过期） | P2 |
| Reels 发布 | `ig_post_reel` | 发布短视频 Reels | P1 |
| 直播预告 | `ig_schedule_live` | 预约直播 | P3 |
| 合集/精选 | `ig_create_highlight` | Stories 合集 | P3 |
| DM 消息 | `ig_send_dm` | 发送私信 | P2 |

---

## 三、技术实现路径

### 3.1 文件结构

```
tweetClaw/src/
├── content/
│   ├── main_entrance.ts          # X (Twitter) 入口
│   ├── xhs-main-entrance.ts      # XHS 入口
│   └── ig-main-entrance.ts       # Instagram 入口（新增）
├── ig_api/                       # Instagram API 层（新增）
│   ├── ig_api.ts                 # API 调用封装
│   ├── signature.ts              # 签名算法
│   ├── extractor.ts              # 数据提取器
│   └── types.ts                  # 类型定义
└── capture/
    └── ig_injection.js           # Instagram 页面注入（新增）
```

### 3.2 实现步骤

每个 API 的实现流程：

```
1. 抓包确认 Instagram Web API 请求格式
   - 端点 URL
   - 请求方法（GET/POST）
   - Headers（特别是签名相关）
   - 请求体格式

2. 创建 ig_api.ts 中的调用函数
   - 复用 XHS 的签名方案（如需要）
   - 实现 requestSign() / requestRapParam()

3. 在 ig-main-entrance.ts 中实现消息处理
   - 监听 background 发送的 messageType
   - 调用 ig_api 函数
   - 返回结果

4. 在 localBridge 中新增对应端点
   - preset_payload.go 新增 Request 结构体
   - handler.go 新增预制端点

5. Python SDK 集成
   - clawbot/transport/ig_api.py
   - clawbot/services/ig.py
```

---

## 四、开发计划

### 阶段一：读取 API（感知层）

让 AI 能"看到"账号状态和平台内容。

| 优先级 | messageType | 功能 | 状态 | 测试日期 |
|--------|------------|------|------|---------|
| P0 | `command.ig_get_self_info` | 获取自己账号信息 | ✅ 已完成 | 2026-06-07 |
| P0 | `command.ig_get_feed` | 获取主页 Feed | ✅ 已完成 | 2026-06-07 |
| P1 | `command.ig_get_user_info` | 获取他人用户信息 | ✅ 已完成 | 2026-06-07 |
| P1 | `command.ig_get_media` | 获取媒体详情 | ✅ 已完成 | 2026-06-07 |
| P1 | `command.ig_get_media_comments` | 获取媒体评论 | 待开发 | - |
| P1 | `command.ig_search` | 搜索内容（媒体帖子） | ✅ 已完成 | 2026-06-08 |
| P1 | `command.ig_search_user` | 搜索用户 | ✅ 已完成 | 2026-06-07 |
| P1 | `command.ig_get_notifications` | 获取消息通知 | 待开发 | - |
| P2 | `command.ig_get_user_media` | 获取用户发布内容 | 待开发 | - |
| P2 | `command.ig_get_followers` | 获取粉丝列表 | 待开发 | - |
| P2 | `command.ig_get_following` | 获取关注列表 | 待开发 | - |

**预计工期：** 5-7 个工作日

**实际进度：** 已完成 6/11 个读取 API (55%) - ✅ 测试通过 6/6 (100%)

---

### 阶段二：写操作 API（执行层）

AI 运营的核心动作。

| 优先级 | messageType | 功能 | 状态 | 测试日期 |
|--------|------------|------|------|---------|
| P0 | `command.ig_post_media` | 发布图文/视频 | 待开发 | - |
| P0 | `command.ig_like_media` | 点赞 | ✅ 已完成 | 2026-06-06 |
| P0 | `command.ig_post_comment` | 发布评论 | ✅ 已完成 | 2026-06-07 |
| P0 | `command.ig_follow_user` | 关注用户 | ✅ 已完成 | 2026-06-07 |
| P1 | `command.ig_upload_media` | 上传媒体文件 | 待开发 | - |
| P1 | `command.ig_unlike_media` | 取消点赞 | ✅ 已完成 | 2026-06-07 |
| P1 | `command.ig_unfollow_user` | 取消关注 | ✅ 已完成 | 2026-06-07 |
| P2 | `command.ig_delete_media` | 删除内容 | 待开发 | - |
| P2 | `command.ig_delete_comment` | 删除评论 | 待开发 | - |

**预计工期：** 7-10 个工作日

---

### 阶段三：高级功能（扩展层）

Instagram 特有功能。

| 优先级 | messageType | 功能 | 状态 |
|--------|------------|------|------|
| P1 | `command.ig_post_reel` | 发布 Reels | 待开发 |
| P2 | `command.ig_post_story` | 发布 Stories | 待开发 |
| P2 | `command.ig_send_dm` | 发送私信 | 待开发 |
| P3 | `command.ig_create_highlight` | 创建合集 | 待开发 |

**预计工期：** 5-7 个工作日

---

## 五、Instagram Web API 技术要点

### 5.1 认证机制

Instagram Web API 使用以下认证方式：

```
Headers:
  - Authorization: Bearer {token}
  - X-IG-App-ID: 936619743398459
  - X-IG-WWW-Claim: 0
  - Cookie: sessionid=xxx; csrftoken=xxx
```

**关键点：**
- `sessionid` Cookie 是核心认证凭证
- `csrftoken` 用于防 CSRF
- `X-IG-App-ID` 是固定的 Web App ID
- 部分请求需要签名（类似 XHS 的 x-rap-param）

### 5.2 签名算法

Instagram 部分写操作需要请求签名：

```javascript
// 伪代码示例
const signature = generateSignature(
  requestBody,
  signatureKey  // 从页面脚本提取
);
```

**实现策略：**
- 注入脚本捕获签名逻辑
- 复用 XHS 的 Hook 方案
- 在 `ig_api/signature.ts` 中实现

### 5.3 媒体上传

Instagram 媒体上传流程：

```
1. 获取上传凭证（类似 XHS 的 COS permit）
2. 分片上传到 Facebook CDN
3. 确认上传完成
4. 发布媒体（关联上传的 media_id）
```

**分片上传：**
- 单文件最大 4GB（视频）
- 建议分片大小：5MB
- 复用 `content-task-runner.ts` 的分片机制

---

## 六、数据结构

### 6.1 用户信息

```typescript
interface IgUser {
  id: string;
  username: string;
  full_name: string;
  biography: string;
  profile_pic_url: string;
  follower_count: number;
  following_count: number;
  media_count: number;
  is_private: boolean;
  is_verified: boolean;
}
```

### 6.2 媒体对象

```typescript
interface IgMedia {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'REEL' | 'STORY';
  media_url: string;
  thumbnail_url?: string;
  caption?: string;
  timestamp: string;
  like_count: number;
  comment_count: number;
  owner: IgUser;
}
```

### 6.3 发布参数

```typescript
interface IgPostMediaParams {
  caption: string;              // 文案
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL';
  media: Array<{
    base64: string;
    mimeType: string;
  }>;
  location?: {                  // 地理位置（可选）
    name: string;
    lat: number;
    lng: number;
  };
  tagged_users?: string[];      // @用户列表
  hide_like_count?: boolean;    // 隐藏点赞数
  disable_comments?: boolean;   // 禁用评论
}
```

---

## 七、实现规范

### 7.1 频率控制

Instagram 对自动化操作有严格限制：

```
单次写操作后随机等待：5～15 秒
每小时点赞上限：~100 次
每小时关注上限：~30 次
每天发布上限：~25 条
```

### 7.2 错误处理

```typescript
// Instagram API 错误类型
enum IgErrorCode {
  RATE_LIMITED = 'rate_limited',
  AUTH_REQUIRED = 'auth_required',
  MEDIA_INVALID = 'media_invalid',
  CAPTION_TOO_LONG = 'caption_too_long',
  USER_NOT_FOUND = 'user_not_found',
  PRIVATE_ACCOUNT = 'private_account',
}
```

### 7.3 Cookie 管理

```
必需 Cookies:
  - sessionid      // 会话 ID
  - csrftoken      // CSRF Token
  - ds_user_id     // 用户 ID
  - mid            // 设备 ID
```

---

## 八、与现有平台对比

| 维度 | X (Twitter) | XHS (小红书) | Instagram |
|------|-------------|-------------|-----------|
| 签名复杂度 | 中等 | 高 | 高 |
| 媒体上传 | 分片上传 | COS 直传 | FB CDN 分片 |
| 认证方式 | Bearer Token | Cookie + 签名 | Cookie + 签名 |
| API 风格 | GraphQL | REST | REST-like |
| 限制严格度 | 中等 | 较低 | 高 |

---

## 九、风险与挑战

### 9.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 签名算法复杂 | 开发周期延长 | 参考开源项目，注入脚本复用 |
| 频率限制严格 | 功能受限 | 实现智能频率控制 |
| API 变更频繁 | 维护成本高 | 版本锁定 + 监控告警 |
| 媒体上传复杂 | 大文件支持难 | 复用现有分片机制 |

### 9.2 合规风险

- Instagram ToS 对自动化有限制
- 需要模拟人类行为模式
- 建议添加随机延迟和频率限制

---

## 十、参考资源

### 10.1 开源项目参考

- [instagram-private-api](https://github.com/Nerixyz/instagram-private-api) - Instagram 私有 API
- [instaloader](https://github.com/instaloader/instaloader) - Instagram 下载工具
- [instagram-scraper](https://github.com/arc298/instagram-scraper) - 爬虫工具

### 10.2 API 文档

- Instagram Graph API（官方，需审核）
- Instagram Web API（逆向，本项目使用）

### 10.3 内部参考

- `tweetClaw/docs/archive/XHS_API_ROADMAP.md` - XHS 开发路线图
- `tweetClaw/src/content/xhs-main-entrance.ts` - XHS 实现参考
- `tweetClaw/src/content/main_entrance.ts` - X 实现参考

---

## 十一、下一步行动

1. **技术调研**（1-2 天）
   - 抓包确认核心 API 请求格式
   - 分析签名算法
   - 确认 Cookie 依赖

2. **原型开发**（2-3 天）
   - 实现 `ig_get_self_info`
   - 实现 `ig_get_feed`
   - 验证架构可行性

3. **完整开发**（按阶段推进）
   - 阶段一：读取 API
   - 阶段二：写操作 API
   - 阶段三：高级功能

---

**文档维护：** 随着开发进度更新状态标记（待开发 → 开发中 → 已完成）