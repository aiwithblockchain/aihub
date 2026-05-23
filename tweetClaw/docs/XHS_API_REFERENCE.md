# 小红书（XHS）接口与代码参考文档

> 本文档整理自 `src/platforms/xiaohongshu/` 及相关文件中的所有已实现代码，作为小红书模块的统一参考。
>
> **图例：**
> - ✅ 已实现且逻辑完整
> - ⚠️ 已实现但字段/路径待抓包验证
> - 🔲 规格已定义，尚未实现

---

## 目录

1. [文件结构](#1-文件结构)
2. [认证机制](#2-认证机制)
3. [常量定义](#3-常量定义)
4. [TypeScript 类型定义](#4-typescript-类型定义)
5. [API 端点一览](#5-api-端点一览)
6. [消费端 API 函数](#6-消费端-api-函数-edithxiaohongshucom)
7. [创作者端 API 函数](#7-创作者端-api-函数-creatorxiaohongshucom)
8. [数据提取工具](#8-数据提取工具-xhs-extractorts)
9. [URL 工具函数](#9-url-工具函数-xhs-url-utilsts)
10. [注入脚本（页面上下文拦截）](#10-注入脚本页面上下文拦截-xhs-injectionts)
11. [Content Script 消息处理](#11-content-script-消息处理-xhs-main-entrancets)
12. [Background 调度函数](#12-background-调度函数-backgroundts)
13. [WebSocket 命令总览](#13-websocket-命令总览)

---

## 1. 文件结构

```
src/
├── platforms/xiaohongshu/
│   ├── index.ts                    # 平台模块导出入口
│   ├── xhs-consts.ts               # 所有常量（端点、消息类型、Storage Key、请求头）
│   ├── xhs-api.ts                  # 所有 API 调用函数（消费端 + 创作者端）
│   ├── xhs-extractor.ts            # API 响应数据提取工具
│   ├── xhs-injection.ts            # 页面注入脚本（拦截 fetch / XHR）
│   ├── xhs-url-utils.ts            # URL 解析与构建工具
│   └── types/
│       ├── index.ts                # 类型导出入口
│       ├── xhs-common.ts           # 基础类型（图片、视频、标签、用户基础、互动信息、Action）
│       ├── xhs-note.ts             # 笔记类型（XhsNote、XhsNoteFeed、XhsNoteDetail、XhsComment）
│       └── xhs-user.ts             # 用户类型（XhsUserProfile、XhsUserStats）
├── content/
│   └── xhs-main-entrance.ts        # XHS Content Script 入口（注入脚本 + 消息路由）
└── service_work/
    └── background.ts               # Background Service Worker（含 XHS 调度函数）
```

---

## 2. 认证机制

### 2.1 消费端（`edith.xiaohongshu.com`）✅

消费端签名头通过拦截 `homefeed` 或 `feed` 请求自动捕获，存入 `chrome.storage.local`。

| 请求头 | Storage Key | 性质 | 说明 |
|--------|-------------|------|------|
| `x-s` | `xhs_xs_sign` | 高动态 | 每次请求重新签名 |
| `x-t` | `xhs_xt` | 高动态 | 毫秒时间戳相关 |
| `x-s-common` | `xhs_xs_common` | 高动态 | 设备/会话指纹 |
| `x-rap-param` | `xhs_x_rap_param` | 高动态 | 风控参数 |
| `x-b3-traceid` | `xhs_x_b3_traceid` | 可复用 | 链路追踪 ID |
| `x-xray-traceid` | `xhs_x_xray_traceid` | 可复用 | Xray 追踪 ID |
| `xy-direction` | `xhs_xy_direction` | 可复用 | 缺失时默认 `98` |

**触发刷新：** 用户刷新 `https://www.xiaohongshu.com/explore?channel_id=homefeed_recommend`，
页面发出 `homefeed` 请求时自动更新。TTL = 30s。

**附加缓存（请求体模板）：**

| Storage Key | 用途 |
|-------------|------|
| `xhs_homefeed_template` | 缓存上次 homefeed 请求体参数，用于构造下次请求 |
| `xhs_feed_template` | 缓存上次 feed 请求体参数（xsec_token 等） |

---

### 2.2 创作者端（`creator.xiaohongshu.com`）✅

创作者端使用**独立的签名上下文**，不复用消费端签名头。签名算法输入包含请求路径，路径不同则签名不同。

| 请求头 | Storage Key | 性质 |
|--------|-------------|------|
| `x-s` | `xhs_creator_xs_sign` | 高动态 |
| `x-t` | `xhs_creator_xt` | 高动态 |
| `x-s-common` | `xhs_creator_xs_common` | 高动态 |
| *(捕获时间)* | `xhs_creator_captured_at` | 元数据，用于 TTL 计算 |

**触发刷新：** 用户访问 `creator.xiaohongshu.com` 并触发任意 API 请求时自动捕获。TTL = 60s。

**Cookie（两端通用）：** `a1` / `webId` / `web_session` 由浏览器通过 `credentials: 'include'` 自动携带，无需手动处理。

---

## 3. 常量定义

**文件：** `src/platforms/xiaohongshu/xhs-consts.ts`

### 3.1 API 端点常量（`XHS_API_ENDPOINTS`）

```typescript
export const XHS_API_ENDPOINTS = {
  FEED:         '/api/sns/web/v1/feed',
  HOMEFEED:     '/api/sns/web/v1/homefeed',
  NOTE_DETAIL:  '/api/sns/web/v1/note/',        // GET，需拼接 noteId
  USER_INFO:    '/api/sns/web/v1/user/otherinfo',
  USER_POSTED:  '/api/sns/web/v1/user_posted',
  SEARCH_NOTES: '/api/sns/web/v1/search/notes',
  COMMENT_PAGE: '/api/sns/web/v2/comment/page',
  LIKE:         '/api/sns/web/v1/note/like',
  COLLECT:      '/api/sns/web/v1/note/collect',
  FOLLOW:       '/api/sns/web/v1/user/follow',
  COMMENT_POST: '/api/sns/web/v2/comment/post',
};
```

### 3.2 创作者端端点常量（`XHS_CREATOR_ENDPOINTS`）⚠️

```typescript
export const XHS_CREATOR_ENDPOINTS = {
  UPLOAD_TOKEN: '/api/media/v1/upload/token',    // ⚠️ 路径待抓包验证
  NOTE_POST:    '/api/galaxy/creator/note/post', // ⚠️ 路径待抓包验证
};
```

### 3.3 消息类型常量（`XHS_MSG_TYPE`）

```typescript
export const XHS_MSG_TYPE = {
  SIGNAL_CAPTURED:         'XHS_SIGNAL_CAPTURED',
  CREATOR_SIGNAL_CAPTURED: 'XHS_CREATOR_SIGNAL_CAPTURED',
  EXECUTE_ACTION:          'XHS_EXECUTE_ACTION',
  FETCH_NOTE:              'XHS_FETCH_NOTE',
  FETCH_CURRENT_USER:      'XHS_FETCH_CURRENT_USER',
  FETCH_HOMEFEED:          'XHS_FETCH_HOMEFEED',
  FETCH_FEED:              'XHS_FETCH_FEED',
  SEARCH_NOTES:            'XHS_SEARCH_NOTES',
  FETCH_USER_NOTES:        'XHS_FETCH_USER_NOTES',
  UPLOAD_IMAGE:            'XHS_UPLOAD_IMAGE',
  CREATE_NOTE:             'XHS_CREATE_NOTE',
};
```

### 3.4 Storage Keys 完整列表（`XHS_STORAGE_KEYS`）

```typescript
export const XHS_STORAGE_KEYS = {
  USER_ID:              'xhs_user_id',
  COOKIES:              'xhs_cookies',
  // 消费端签名头
  XS_SIGN:              'xhs_xs_sign',
  XT:                   'xhs_xt',
  XS_COMMON:            'xhs_xs_common',
  RAP_PARAM:            'xhs_x_rap_param',
  B3_TRACEID:           'xhs_x_b3_traceid',
  XRAY_TRACEID:         'xhs_x_xray_traceid',
  XY_DIRECTION:         'xhs_xy_direction',
  HOMEFEED_TEMPLATE:    'xhs_homefeed_template',
  FEED_TEMPLATE:        'xhs_feed_template',
  // 创作者端签名头
  CREATOR_XS_SIGN:      'xhs_creator_xs_sign',
  CREATOR_XT:           'xhs_creator_xt',
  CREATOR_XS_COMMON:    'xhs_creator_xs_common',
  CREATOR_CAPTURED_AT:  'xhs_creator_captured_at',
};
```

### 3.5 固定请求头（`XHS_HEADERS`）

```typescript
export const XHS_HEADERS = {
  CONTENT_TYPE: 'application/json;charset=UTF-8',
  REFERER:      'https://www.xiaohongshu.com/',
};
```

---

## 4. TypeScript 类型定义

**文件：** `src/platforms/xiaohongshu/types/`

### 4.1 基础公共类型（`xhs-common.ts`）

```typescript
interface XhsImage {
  url: string;
  url_default: string;
  url_pre: string;
  width: number;
  height: number;
  file_id?: string;
}

interface XhsVideo {
  url: string;
  url_default: string;
  duration: number;
  width: number;
  height: number;
  cover: XhsImage;
}

interface XhsTag {
  id: string;
  name: string;
  type: string;
}

interface XhsUserBasic {
  user_id: string;
  nickname: string;
  avatar: string;
}

interface XhsInteractInfo {
  liked: boolean;
  liked_count: string;
  collected: boolean;
  collected_count: string;
  comment_count: string;
  share_count: string;
}

type XhsAction = 'like' | 'unlike' | 'collect' | 'uncollect' | 'follow' | 'unfollow' | 'comment';

interface XhsActionRequest {
  action: XhsAction;
  note_id?: string;
  user_id?: string;
  content?: string;
}
```

### 4.2 笔记类型（`xhs-note.ts`）

```typescript
type XhsNoteType = 'normal' | 'video';

interface XhsNote {
  note_id: string;
  title: string;
  desc: string;
  type: XhsNoteType;
  user: XhsUserBasic;
  images?: XhsImage[];
  video?: XhsVideo;
  tags: XhsTag[];
  interact_info: XhsInteractInfo;
  ip_location?: string;
  create_time: number;
  last_update_time: number;
}

interface XhsNoteFeed {
  notes: XhsNote[];
  cursor: string;
  has_more: boolean;
}

interface XhsNoteDetail extends XhsNote {
  comments?: XhsComment[];
}

interface XhsComment {
  id: string;
  content: string;
  user: XhsUserBasic;
  create_time: number;
  like_count: number;
  sub_comment_count: number;
  sub_comments?: XhsComment[];
}
```

### 4.3 用户类型（`xhs-user.ts`）

```typescript
interface XhsUserProfile extends XhsUserBasic {
  desc: string;
  gender: number;
  ip_location: string;
  follows: number;
  fans: number;
  interaction: number;
  notes_count: number;
  verified: boolean;
  verified_content?: string;
  red_official_verified: boolean;
}

interface XhsUserStats {
  follows: number;
  fans: number;
  interaction: number;
  notes_count: number;
}
```

---

## 5. API 端点一览

| 端点 | 方法 | 域名 | 说明 | 状态 |
|------|------|------|------|------|
| `/api/sns/web/v1/homefeed` | POST | `edith` | 首页推荐流 | ✅ |
| `/api/sns/web/v1/feed` | POST | `edith` | 笔记详情（feed 接口） | ✅ |
| `/api/sns/web/v1/note/{noteId}` | GET | `edith` | 笔记详情（直接获取） | ✅ |
| `/api/sns/web/v2/user/me` | GET | `edith` | 当前登录用户信息 | ✅ |
| `/api/sns/web/v1/user/otherinfo` | GET | `edith` | 其他用户信息 | 已定义常量 |
| `/api/sns/web/v1/user_posted` | GET | `edith` | 用户发布的笔记列表 | ✅ |
| `/api/sns/web/v1/search/notes` | POST | `edith` | 搜索笔记 | ✅ |
| `/api/sns/web/v2/comment/page` | GET | `edith` | 评论列表 | 已定义常量 |
| `/api/sns/web/v1/note/like` | POST | `edith` | 点赞/取消点赞 | ✅ |
| `/api/sns/web/v1/note/collect` | POST | `edith` | 收藏/取消收藏 | ✅ |
| `/api/sns/web/v1/user/follow` | POST | `edith` | 关注/取消关注 | ✅ |
| `/api/sns/web/v2/comment/post` | POST | `edith` | 发表评论 | ✅ |
| `/api/media/v1/upload/token` | POST | `creator` | 获取图片上传凭证 | ⚠️ 路径待验证 |
| `/api/galaxy/creator/note/post` | POST | `creator` | 创建图文笔记 | ⚠️ 路径+结构待验证 |

> `edith` = `https://edith.xiaohongshu.com`
> `creator` = `https://creator.xiaohongshu.com`

---

## 6. 消费端 API 函数

**文件：** `src/platforms/xiaohongshu/xhs-api.ts`

### 6.1 请求头构建

#### `getXhsHeaders()` — POST 请求头（含全部签名头）

```typescript
async function getXhsHeaders(): Promise<Record<string, string>>
```

从 `chrome.storage.local` 读取所有签名头。`xy-direction` 缺失时默认填 `'98'`。

#### `getXhsGetHeaders()` — GET 请求头（精简版）

```typescript
async function getXhsGetHeaders(): Promise<Record<string, string>>
```

在 `getXhsHeaders()` 基础上，移除 `content-type`、`x-rap-param`、`x-b3-traceid`、`x-xray-traceid`、`xy-direction`。

#### `ensureHomefeedDynamicHeaders()` — 校验签名头完整性

```typescript
async function ensureHomefeedDynamicHeaders(): Promise<void>
```

检查 `x-s`、`x-t`、`x-s-common`、`x-rap-param` 四个动态头是否存在，缺失时抛出明确错误信息。

---

### 6.2 数据读取函数

#### `fetchXhsHomefeed(cursorScore?)` ✅

```typescript
export async function fetchXhsHomefeed(cursorScore: string = ''): Promise<any>
```

**端点：** `POST /api/sns/web/v1/homefeed`

请求体从 `xhs_homefeed_template` 缓存中读取参数，支持翻页（`refresh_type: 3`）和首页（`refresh_type: 1`）两种模式。

**请求体关键字段：**

| 字段 | 首页默认值 | 说明 |
|------|-----------|------|
| `cursor_score` | `''` | 翻页游标 |
| `num` | `35` | 返回条数 |
| `refresh_type` | `1`（首页）/ `3`（翻页） | 刷新类型 |
| `note_index` | `0`（首页）/ `35`（翻页） | 笔记索引 |
| `category` | `'homefeed_recommend'` | 推荐分类 |
| `image_formats` | `['jpg','webp','avif']` | 图片格式 |

---

#### `fetchXhsFeed(noteId)` ✅

```typescript
export async function fetchXhsFeed(noteId: string): Promise<any>
```

**端点：** `POST /api/sns/web/v1/feed`

通过 feed 接口获取单篇笔记详情，使用 `xhs_feed_template` 缓存中的 `xsec_token`。

---

#### `fetchXhsNote(noteId)` ✅

```typescript
export async function fetchXhsNote(noteId: string): Promise<any>
```

**端点：** `GET /api/sns/web/v1/note/{noteId}`

直接通过 noteId 获取笔记详情（GET 请求，无需请求体）。

---

#### `fetchXhsCurrentUser()` ✅

```typescript
export async function fetchXhsCurrentUser(): Promise<any>
```

**端点：** `GET /api/sns/web/v2/user/me`

获取当前登录账号的用户信息。

---

#### `searchXhsNotes(keyword, cursor?, pageSize?)` ✅

```typescript
export async function searchXhsNotes(
  keyword: string,
  cursor: string = '',
  pageSize: number = 20
): Promise<any>
```

**端点：** `POST /api/sns/web/v1/search/notes`

**请求体：**

```json
{
  "keyword": "关键词",
  "page": 1,
  "page_size": 20,
  "search_id": "",
  "sort": "general",
  "note_type": 0,
  "cursor": "可选翻页游标"
}
```

---

#### `fetchXhsUserNotes(userId, cursor?)` ✅

```typescript
export async function fetchXhsUserNotes(userId: string, cursor: string = ''): Promise<any>
```

**端点：** `GET /api/sns/web/v1/user_posted?user_id=&cursor=&num=30&image_formats=jpg,webp,avif`

---

### 6.3 互动操作函数

#### `performXhsAction(action, params)` ✅

```typescript
export async function performXhsAction(
  action: XhsAction,
  params: { note_id?: string; user_id?: string; content?: string }
): Promise<any>
```

统一处理所有写操作，内部通过 `getXhsEndpoint()` 路由端点，`buildRequestBody()` 构建请求体。

**各 action 请求体：**

| action | 端点 | 请求体 |
|--------|------|--------|
| `like` / `unlike` | `/note/like` | `{ note_id, type: 'normal' }` |
| `collect` / `uncollect` | `/note/collect` | `{ note_id }` |
| `follow` / `unfollow` | `/user/follow` | `{ target_user_id }` |
| `comment` | `/comment/post` | `{ note_id, content, at_users: [] }` |

---

## 7. 创作者端 API 函数

**文件：** `src/platforms/xiaohongshu/xhs-api.ts`

### 7.1 Creator 签名头管理

#### `getXhsCreatorHeaders()` ✅

```typescript
export async function getXhsCreatorHeaders(): Promise<Record<string, string>>
```

从 storage 读取 creator 签名头，检查是否存在且在 60s TTL 内，过期则抛错。

返回的 headers：

```typescript
{
  'x-s':        '...',
  'x-t':        '...',
  'x-s-common': '...',
  'accept':     'application/json, text/plain, */*',
  'referer':    'https://creator.xiaohongshu.com/publish/publish',
}
```

#### `isXhsCreatorContextFresh()` ✅

```typescript
export async function isXhsCreatorContextFresh(): Promise<boolean>
```

检查 creator 签名头是否存在且未超过 60s TTL。

---

### 7.2 图片上传 ⚠️

#### `uploadXhsImage(imageBase64, mimeType)` ⚠️

```typescript
export async function uploadXhsImage(imageBase64: string, mimeType: string): Promise<string>
```

**两步流程：**

**Step 1 — 获取上传凭证**

```
POST https://creator.xiaohongshu.com/api/media/v1/upload/token  ⚠️ 路径待验证

请求体：
{
  "biz_name": "spectrum",
  "scene": "image",
  "file_count": 1,
  "quality": 1000,
  "source": "web"
}

响应（字段路径待验证）：
data.tokens[0] 或 data：
  - upload_url / url
  - token / auth_token
  - file_id / object_key / fileId
```

**Step 2 — 上传二进制到 OSS**

```
PUT {upload_url}
Header: Authorization: {token}
Header: Content-Type: {mimeType}
Body: 图片二进制（Blob）
```

返回值：`file_id: string`（⚠️ 字段名待验证）

---

### 7.3 创建笔记 ⚠️

#### `createXhsNote(params)` ⚠️

```typescript
export interface XhsCreateNoteParams {
  title: string;
  content: string;
  tags: string[];       // 话题标签，不含 #
  file_ids: string[];   // 图片 file_id 列表
}

export async function createXhsNote(params: XhsCreateNoteParams): Promise<any>
```

**端点：** `POST https://creator.xiaohongshu.com/api/galaxy/creator/note/post` ⚠️

**请求体（⚠️ 结构待抓包验证）：**

```json
{
  "common": {
    "type": "normal",
    "title": "笔记标题",
    "note_id": "",
    "ats": [],
    "hash_tag": [{ "name": "话题", "type": "topic" }],
    "post_loc": {},
    "privacy_type": "public"
  },
  "image_info_list": [
    { "file_id": "xxx", "order": 0, "sticker_info": {} }
  ],
  "desc_info": {
    "desc": "正文内容"
  },
  "business_binds": {
    "version": 1,
    "bindType": 1,
    "bindList": []
  }
}
```

---

## 8. 数据提取工具

**文件：** `src/platforms/xiaohongshu/xhs-extractor.ts`

所有函数都有 try/catch 容错处理，字段缺失时返回安全默认值。

| 函数 | 输入 | 输出 | 说明 |
|------|------|------|------|
| `extractNotes(apiResponse)` | API 响应 | `XhsNote[]` | 提取 `data.items` 中的笔记列表 |
| `extractNote(item)` | 单个 item | `XhsNote \| null` | 提取单条笔记，无 `note_id` 返回 null |
| `extractUserBasic(userData)` | 用户数据 | `XhsUserBasic` | 提取基础用户信息，兼容 `nick_name` 字段 |
| `extractUserProfile(apiResponse)` | API 响应 | `XhsUserProfile \| null` | 提取完整用户资料，follows/fans 自动转 number |
| `extractComments(apiResponse)` | API 响应 | `XhsComment[]` | 提取 `data.comments`，支持嵌套子评论 |

**字段兼容性处理：**

- 用户 ID：`user_id` ← `id`
- 昵称：`nickname` ← `nick_name`
- 头像：`avatar` ← `image`
- 笔记标题：`display_title` ← `title`
- 视频 URL：`url` ← `media.stream.h264[0].master_url`
- 文件 ID：`file_id` ← `trace_id`

---

## 9. URL 工具函数

**文件：** `src/platforms/xiaohongshu/xhs-url-utils.ts`

```typescript
// 从 URL 中提取笔记 ID（匹配 /explore/{noteId}）
extractNoteId(url: string): string | null

// 从 URL 中提取用户 ID（匹配 /user/profile/{userId}）
extractUserId(url: string): string | null

// 构建笔记 URL
buildNoteUrl(noteId: string): string
// → https://www.xiaohongshu.com/explore/{noteId}

// 构建用户主页 URL
buildUserUrl(userId: string): string
// → https://www.xiaohongshu.com/user/profile/{userId}
```

---

## 10. 注入脚本（页面上下文拦截）

**文件：** `src/platforms/xiaohongshu/xhs-injection.ts`

注入到页面主上下文（main world），通过覆写 `window.fetch` 和 `XMLHttpRequest` 拦截请求。

### 10.1 拦截目标

| 拦截 URL | 目的 |
|----------|------|
| `edith.xiaohongshu.com/api/sns/web/v1/homefeed` | 捕获消费端签名头 + 请求体模板 |
| `edith.xiaohongshu.com/api/sns/web/v1/feed` | 捕获消费端签名头 + xsec_token |
| `creator.xiaohongshu.com/api/**` | 捕获创作者端签名头（只要 `x-s/x-t/x-s-common` 齐全即上报） |

### 10.2 签名头提取的完整字段

```
x-s / x-t / x-s-common / x-rap-param / x-b3-traceid / x-xray-traceid / xy-direction
```

### 10.3 消费端信号上报（`postSignal`）

通过 `window.postMessage` 发送：

```typescript
{
  source: 'xhsclaw-injection',
  type: 'XHS_SIGNAL_CAPTURED',
  endpoint: '/api/sns/web/v1/homefeed',
  apiUrl: '完整 URL',
  pageUrl: window.location.href,
  method: 'POST',
  requestBody: { /* 解析后的 JSON 请求体 */ },
  headers: { /* 7个签名头的当前值 */ },
  data: { /* 响应体 */ },
  timestamp: Date.now(),
}
```

### 10.4 创作者端信号上报（`postCreatorSignal`）

```typescript
{
  source: 'xhsclaw-injection',
  type: 'XHS_CREATOR_SIGNAL_CAPTURED',
  headers: { 'x-s': '...', 'x-t': '...', 'x-s-common': '...' },
  timestamp: Date.now(),
}
```

三个核心头缺少任意一个则不上报。

### 10.5 账号信息主动获取

注入脚本还监听来自 content script 的 `GET_ACCOUNT_INFO` 消息，直接调用：

```
GET https://edith.xiaohongshu.com/api/sns/web/v2/user/me
```

并通过 `window.postMessage` 回传 `ACCOUNT_INFO_RESPONSE`。

### 10.6 `normalizeHeaders()` 头部归一化

统一将各种格式（`Headers` 实例 / 数组 / 含 `.entries()` 对象 / 普通对象）归一化为 `Record<string, string>`，键名全部转小写。

---

## 11. Content Script 消息处理

**文件：** `src/content/xhs-main-entrance.ts`

### 11.1 注入脚本

```typescript
(function inject() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('js/xhs-injection.js');
  document.head.appendChild(script);
})();
```

### 11.2 监听注入脚本信号 → 写入 Storage

| 信号类型 | 触发端点 | 写入 Storage Keys |
|---------|---------|------------------|
| `XHS_SIGNAL_CAPTURED` + `homefeed` | homefeed POST | 7个消费端签名头 + `xhs_homefeed_template` |
| `XHS_SIGNAL_CAPTURED` + `feed` | feed POST | 7个消费端签名头 + `xhs_feed_template` |
| `XHS_CREATOR_SIGNAL_CAPTURED` | creator 任意 API | 3个 creator 签名头 + `xhs_creator_captured_at` |

### 11.3 监听 Background 命令 → 执行操作

| 消息 type | 调用函数 | 关键参数 |
|-----------|---------|---------|
| `XHS_PING` | — | 返回 `{ ok: true, url, context }` |
| `XHS_SCROLL_PAGE` | `window.scrollBy` | `pixels`（默认 800） |
| `XHS_EXECUTE_ACTION` | `performXhsAction()` | `action, note_id, user_id, content` |
| `XHS_FETCH_NOTE` | `fetchXhsNote()` | `note_id` |
| `XHS_FETCH_HOMEFEED` | `fetchXhsHomefeed()` | `cursor_score` |
| `XHS_FETCH_FEED` | `fetchXhsFeed()` | `note_id` |
| `XHS_FETCH_CURRENT_USER` | `fetchXhsCurrentUser()` | — |
| `XHS_SEARCH_NOTES` | `searchXhsNotes()` | `keyword, cursor, page_size` |
| `XHS_FETCH_USER_NOTES` | `fetchXhsUserNotes()` | `user_id, cursor` |
| `XHS_UPLOAD_IMAGE` | `uploadXhsImage()` | `imageBase64, mimeType` → 返回 `file_id` |
| `XHS_CREATE_NOTE` | `createXhsNote()` | `title, content, tags, file_ids` |

---

## 12. Background 调度函数

**文件：** `src/service_work/background.ts`（XHS 相关部分）

### 12.1 消费端热身机制

#### `ensureXhsHomefeedWarmContext()` ✅

```typescript
async function ensureXhsHomefeedWarmContext(): Promise<number>  // 返回 tabId
```

**流程：**
1. `findOrCreateXhsTab()` — 查找或创建 `www.xiaohongshu.com` 标签页
2. `navigateXhsTabToHomefeed()` — 导航到推荐页
3. `isXhsHomefeedContextFresh()` — 检查 TTL（30s）
4. 不新鲜则滚动页面触发 homefeed 请求
5. `waitForXhsHomefeedCapture()` — 轮询 storage，等待签名头更新（500ms 间隔，超时 30s）

**TTL / URL 常量：**
```typescript
const XHS_HOMEFEED_URL = 'https://www.xiaohongshu.com/explore?channel_id=homefeed_recommend';
const XHS_HOMEFEED_WARMUP_TTL_MS = 30_000;
const XHS_HOMEFEED_WARMUP_TIMEOUT_MS = 30_000;
```

---

### 12.2 创作者端热身机制

#### `ensureXhsCreatorContext()` ✅

```typescript
async function ensureXhsCreatorContext(): Promise<void>
```

**流程：**
1. `findOrCreateXhsCreatorTab()` — 查找或创建 `creator.xiaohongshu.com` 标签页
2. `isXhsCreatorContextFresh()` — 检查 TTL（60s）
3. 不新鲜则刷新页面
4. `waitForXhsCreatorCapture()` — 轮询 storage，等待 creator 签名头更新（500ms 间隔，超时 30s）

**TTL / URL 常量：**
```typescript
const XHS_CREATOR_URL = 'https://creator.xiaohongshu.com/publish/publish';
const XHS_CREATOR_WARMUP_TTL_MS = 60_000;
const XHS_CREATOR_WARMUP_TIMEOUT_MS = 30_000;
```

---

### 12.3 对外暴露函数（绑定到 `localBridge`）

| 函数 | LocalBridge 属性 | 说明 |
|------|-----------------|------|
| `queryXhsAccountInfo()` | `queryXhsAccountInfoHandler` | 获取当前用户信息 |
| `queryXhsHomefeed(payload)` | `queryXhsHomefeedHandler` | 获取首页推荐流 |
| `queryXhsFeed(payload)` | `queryXhsFeedHandler` | 获取笔记详情（feed） |
| `queryXhsSearch(payload)` | `queryXhsSearchHandler` | 搜索笔记 |
| `queryXhsUserNotes(payload)` | `queryXhsUserNotesHandler` | 获取用户笔记列表 |
| `publishXhsNote(payload)` | `xhsPublishNoteHandler` | 发布图文笔记 |

---

### 12.4 `publishXhsNote(payload)` ✅ ⚠️

```typescript
export async function publishXhsNote(payload: {
  title: string;
  content: string;
  tags: string[];
  images: Array<{ data: string; mime_type: string }>;
}): Promise<{ success: boolean; note_id?: string; error?: string }>
```

**完整流程：**

```
1. ensureXhsCreatorContext()           — 确保 creator 签名头就绪
2. 查找 creator.xiaohongshu.com 标签页
3. 串行对每张图片发送 XHS_UPLOAD_IMAGE → 收集 file_id[]
4. 发送 XHS_CREATE_NOTE { title, content, tags, file_ids }
5. 提取 note_id（路径：data.data.note_id 或 data.note_id）  ⚠️ 待验证
6. 返回 { success: true, note_id }
```

---

## 13. WebSocket 命令总览

通过 `localBridge`（LocalBridgeMac ↔ Background WebSocket）对外暴露的完整命令集：

| WS 命令 | 参数 | 说明 | 状态 |
|---------|------|------|------|
| `command.query_xhs_account_info` | — | 获取当前登录账号信息 | ✅ |
| `command.query_xhs_homefeed` | `{ cursor_score? }` | 获取首页推荐流 | ✅ |
| `command.query_xhs_feed` | `{ note_id }` | 获取笔记详情（feed 接口） | ✅ |
| `command.exec_xhs_action` | `{ action, note_id?, user_id?, content? }` | 点赞/收藏/关注/评论 | ✅ |
| `command.query_xhs_search` | `{ keyword, cursor?, page_size? }` | 搜索笔记 | ✅ |
| `command.query_xhs_user_notes` | `{ user_id, cursor? }` | 获取用户发布的笔记 | ✅ |
| `command.xhs_publish_note` | `{ title, content, tags, images[] }` | 发布图文笔记 | ✅ ⚠️ |

---

## 附：已知待验证项

以下内容在代码中已有实现框架，但标注需要抓包后确认：

| 项目 | 位置 | 说明 |
|------|------|------|
| 上传凭证接口路径 | `XHS_CREATOR_ENDPOINTS.UPLOAD_TOKEN` | `/api/media/v1/upload/token` 待验证 |
| 发布笔记接口路径 | `XHS_CREATOR_ENDPOINTS.NOTE_POST` | `/api/galaxy/creator/note/post` 待验证 |
| 上传凭证响应字段 | `uploadXhsImage()` | `data.tokens[0]` / `upload_url` / `token` / `file_id` 待验证 |
| 发布笔记请求体结构 | `createXhsNote()` | `common` / `image_info_list` / `desc_info` 结构待验证 |
| 发布成功响应中 note_id 路径 | `publishXhsNote()` | `data.data.note_id` 还是 `data.note_id` 待验证 |
