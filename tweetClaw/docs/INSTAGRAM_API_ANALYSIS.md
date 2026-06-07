# Instagram Private API 代码分析报告

> 分析日期：2026-06-04  
> 项目：instagram-private-api (Nerixyz/dilame)

---

## 一、核心架构分析

### 1.1 项目结构

```
instagram-private-api/src/
├── core/                    # 核心模块
│   ├── client.ts           # 主客户端 IgApiClient
│   ├── request.ts          # HTTP 请求封装 + 签名
│   ├── state.ts            # 状态管理（Cookie、设备信息）
│   ├── constants.ts        # 常量定义（签名密钥等）
│   ├── feed.factory.ts     # Feed 工厂（分页数据）
│   └── repository.ts       # Repository 基类
├── repositories/           # API 端点封装（34个文件）
│   ├── account.repository.ts      # 账号相关
│   ├── friendship.repository.ts   # 关注/取关
│   ├── media.repository.ts        # 媒体操作
│   └── ...
├── services/               # 高级服务
│   ├── publish.service.ts  # 发布服务（21KB，核心）
│   ├── story.service.ts    # Stories 发布
│   └── ...
├── feeds/                  # 分页数据源（27个文件）
├── types/                  # TypeScript 类型定义
└── responses/              # 响应类型（108个文件）
```

---

## 二、关键技术点

### 2.1 签名算法

**位置：** `src/core/request.ts` 第 109-122 行

```typescript
public signature(data: string) {
  return createHmac('sha256', this.client.state.signatureKey)
    .update(data)
    .digest('hex');
}

public sign(payload: Payload): SignedPost {
  const json = typeof payload === 'object' ? JSON.stringify(payload) : payload;
  const signature = this.signature(json);
  return {
    ig_sig_key_version: this.client.state.signatureVersion,
    signed_body: `${signature}.${json}`,
  };
}
```

**关键参数：**
- 签名密钥：`SIGNATURE_KEY`（硬编码在 constants.ts）
- 签名版本：`SIGNATURE_VERSION = '4'`
- 算法：HMAC-SHA256
- 格式：`{hex_signature}.{json_payload}`

**签名密钥（constants.ts 第3行）：**
```typescript
export const SIGNATURE_KEY = '9193488027538fd3450b83b7d05286d4ca9599a0f7eeed90d8c85925698a05dc';
```

---

### 2.2 Cookie 管理

**位置：** `src/core/state.ts`

**关键 Cookies：**

| Cookie 名称 | 用途 | 获取方式 |
|------------|------|---------|
| `sessionid` | 会话 ID | 登录后设置 |
| `csrftoken` | CSRF 防护 | 自动生成/响应中提取 |
| `ds_user_id` | 用户 ID | 登录后设置 |
| `mid` | 设备 ID | 首次访问生成 |

**Cookie Jar 管理：**
```typescript
// state.ts 第103-105行
cookieStore = new MemoryCookieStore();
cookieJar = jar(this.cookieStore);
```

**提取 Cookie：**
```typescript
// state.ts 第171-178行
public get cookieCsrfToken() {
  try {
    return this.extractCookieValue('csrftoken');
  } catch {
    return 'missing';
  }
}
```

---

### 2.3 请求 Headers

**位置：** `src/core/request.ts` 第 183-217 行

**关键 Headers：**

```typescript
{
  'User-Agent': this.client.state.appUserAgent,
  'X-IG-App-ID': this.client.state.fbAnalyticsApplicationId,  // 固定值
  'X-IG-WWW-Claim': this.client.state.igWWWClaim || '0',
  'X-MID': this.client.state.extractCookie('mid')?.value,
  'X-IG-Device-ID': this.client.state.uuid,
  'X-IG-Android-ID': this.client.state.deviceId,
  'Authorization': this.client.state.authorization,  // Bearer token
  'X-IG-Bandwidth-Speed-KBPS': '-1.000',
  'X-IG-Connection-Type': 'WIFI',
  // ... 更多设备模拟 headers
}
```

**X-IG-App-ID 值（constants.ts）：**
```typescript
export const FACEBOOK_ANALYTICS_APPLICATION_ID = '567067343352427';
```

---

### 2.4 基础 URL

**位置：** `src/core/request.ts` 第 63 行

```typescript
baseUrl: 'https://i.instagram.com/'
```

**API 端点示例：**
```
POST /api/v1/media/123456/like/        # 点赞
POST /api/v1/friendships/create/123/   # 关注
POST /api/v1/media/configure/          # 发布媒体
GET  /api/v1/feed/user/123/            # 获取用户 Feed
```

---

## 三、核心 API 方法

### 3.1 Account Repository

**文件：** `src/repositories/account.repository.ts` (12KB)

| 方法 | 端点 | 功能 |
|------|------|------|
| `login()` | `/api/v1/accounts/login/` | 登录 |
| `logout()` | `/api/v1/accounts/logout/` | 登出 |
| `currentUser()` | `/api/v1/accounts/current_user/` | 获取当前用户 |
| `setBiography()` | `/api/v1/accounts/set_biography/` | 设置简介 |

### 3.2 Friendship Repository

**文件：** `src/repositories/friendship.repository.ts` (4.3KB)

| 方法 | 端点 | 功能 |
|------|------|------|
| `create()` | `/api/v1/friendships/create/{user_id}/` | 关注 |
| `destroy()` | `/api/v1/friendships/destroy/{user_id}/` | 取关 |
| `approve()` | `/api/v1/friendships/approve/{user_id}/` | 批准关注请求 |
| `block()` | `/api/v1/friendships/block/{user_id}/` | 拉黑 |

### 3.3 Media Repository

**文件：** `src/repositories/media.repository.ts`

| 方法 | 端点 | 功能 |
|------|------|------|
| `like()` | `/api/v1/media/{id}/like/` | 点赞 |
| `unlike()` | `/api/v1/media/{id}/unlike/` | 取消点赞 |
| `comment()` | `/api/v1/media/{id}/comment/` | 评论 |
| `deleteComment()` | `/api/v1/media/{id}/comment/{cid}/delete/` | 删除评论 |
| `info()` | `/api/v1/media/{id}/info/` | 获取媒体信息 |

### 3.4 Publish Service

**文件：** `src/services/publish.service.ts` (21KB)

**功能：**
- 图片发布：`publishPhoto()`
- 视频发布：`publishVideo()`
- Carousel 发布：`publishCarousel()`
- IGTV 发布：`publishIGTV()`

**发布流程：**
```
1. uploadPhoto() / uploadVideo()
   - 分片上传到 Instagram CDN
   
2. configure()
   - 配置媒体元数据（caption、location 等）
   
3. 返回 media_id
```

---

## 四、与我们的架构对比

### 4.1 认证方式对比

| 维度 | instagram-private-api | tweetClaw |
|------|----------------------|-----------|
| Cookie 存储 | MemoryCookieStore | 浏览器自动管理 |
| Cookie 传入 | 手动设置 | 用户已登录，浏览器携带 |
| 认证流程 | 模拟登录 | 复用浏览器会话 |
| CSRF Token | 自动提取 | 从 Cookie 读取 |

**结论：** 签名算法可直接复用，Headers 可简化（移除设备模拟相关）。

---

## 五、实际实现总结（2026-06-07）

### 5.1 已完成 API

| API | 实现方式 | 关键发现 |
|-----|---------|---------|
| **获取媒体详情** | GraphQL API | REST API `/p/{shortcode}/?__a=1` 已废弃，需使用 GraphQL |
| **取消点赞** | GraphQL Mutation | `usePolarisLikeMediaXIGUnlikeMutation`，doc_id: `26662414810082851` |
| **点赞** | GraphQL Mutation | 类似 unlike，使用对应的 mutation |

### 5.2 GraphQL API 发现

**Instagram Web 已从 REST API 迁移到 GraphQL API：**

| 功能 | GraphQL Query/Mutation | doc_id |
|------|----------------------|--------|
| 获取媒体详情 | `PolarisPostRootQuery` | `26713194205046842` |
| 取消点赞 | `usePolarisLikeMediaXIGUnlikeMutation` | `26662414810082851` |

**关键请求参数：**

```typescript
// 必需参数
{
  av: '17841427211664125',  // 固定值（不是 0）
  __d: 'www',
  __comet_req: '7',
  fb_dtsg: '...',  // 从页面提取的 CSRF token
  fb_api_req_friendly_name: 'PolarisPostRootQuery',
  doc_id: '26713194205046842',
  variables: { shortcode, ... }
}
```

**响应路径：**

```typescript
// 获取媒体详情
data.xdt_api__v1__media__shortcode__web_info.items[0]

// 取消点赞
data.xig_media_unlike.media.has_liked
```

### 5.3 超时配置

**写操作需要更长超时（因为 smartDelay）：**

| 操作 | Go 服务器超时 | TypeScript smartDelay |
|------|--------------|---------------------|
| 点赞/取消点赞 | 30s | 5-15s 随机延迟 |
| 关注/取关 | 30s | 5-15s 随机延迟 |
| 评论 | 30s | 5-15s 随机延迟 |

**原因：** `smartDelay(5000, 15000)` + API 请求时间 > 15s 默认超时

### 5.4 工具函数

**已暴露到 `window.igApi`：**

```typescript
// Shortcode ↔ Media ID 转换
shortcodeToMediaId(shortcode: string): string
mediaIdToShortcode(mediaId: string): string

// URL 解析
extractShortcodeFromUrl(url: string): string | null
```

**用途：** 在浏览器控制台直接测试和调试

---

## 六、下一步计划

### 6.1 待实现 API

| 优先级 | API | 预计工时 |
|--------|-----|---------|
| P1 | 获取主页 Feed | 1 天 |
| P1 | 搜索内容 | 1 天 |
| P1 | 获取评论列表 | 0.5 天 |
| P2 | 获取粉丝/关注列表 | 1 天 |

### 6.2 技术债务

- [ ] 完善 GraphQL 查询参数提取（更多 API 的 doc_id）
- [ ] 添加错误重试机制
- [ ] 添加请求频率限制
- [ ] 完善单元测试

---

**结论：** 我们无需实现登录流程，直接从浏览器 Cookie 读取 `sessionid`、`csrftoken`。

---

### 4.2 请求方式对比

| 维度 | instagram-private-api | tweetClaw |
|------|----------------------|-----------|
| HTTP 客户端 | `request-promise` (Node.js) | `fetch` (浏览器) |
| Base URL | `https://i.instagram.com/` | 相同 |
| 签名方式 | HMAC-SHA256 | 相同（可复用） |
| Headers | 设备模拟 headers | 简化版（浏览器已有） |

**结论：** 签名算法可直接复用，Headers 可简化（移除设备模拟相关）。

---

### 4.3 数据流对比

**instagram-private-api：**
```
Node.js App
  ↓ 手动管理 Cookie
  ↓ 构建签名请求
  ↓ HTTP 请求
Instagram API
```

**tweetClaw：**
```
Chrome Extension (content script)
  ↓ 从浏览器读取 Cookie
  ↓ 构建签名请求（复用签名算法）
  ↓ fetch() 请求
Instagram API
```

---

## 五、可复用的代码

### 5.1 直接复用（无需修改）

| 文件 | 内容 | 复用方式 |
|------|------|---------|
| `constants.ts` | 签名密钥、App ID | 复制常量定义 |
| `types/` | TypeScript 类型定义 | 参考或直接导入 |
| `responses/` | 响应类型定义 | 参考结构 |

### 5.2 需要适配的代码

| 文件 | 原实现 | 我们的实现 |
|------|---------|-----------|
| `request.ts` | `request-promise` | `fetch()` API |
| `state.ts` | CookieJar 管理 | `chrome.cookies` API |
| `signature()` | Node.js `crypto` | Web Crypto API |

### 5.3 签名算法适配

**原代码（Node.js）：**
```typescript
import { createHmac } from 'crypto';

public signature(data: string) {
  return createHmac('sha256', this.client.state.signatureKey)
    .update(data)
    .digest('hex');
}
```

**适配后（浏览器）：**
```typescript
// 使用 Web Crypto API
public async signature(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(this.signatureKey);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

---

## 六、集成方案

### 6.1 文件映射

```
instagram-private-api/src/          tweetClaw/src/ig_api/
├── core/constants.ts          →   constants.ts（直接复制）
├── core/request.ts            →   signature.ts（提取签名部分）
├── types/                     →   types.ts（合并关键类型）
├── repositories/media.ts      →   ig_api.ts（参考实现）
└── services/publish.service.ts →  ig-upload.ts（参考上传流程）
```

### 6.2 实现优先级

**Phase 1：基础读取 API**
1. 提取签名算法 → `ig_api/signature.ts`
2. 定义常量 → `ig_api/constants.ts`
3. 实现 Cookie 读取 → `ig_api/cookie-helper.ts`
4. 实现第一个 API：`ig_get_self_info`

**Phase 2：核心写操作**
1. 点赞：`ig_like_media`
2. 关注：`ig_follow_user`
3. 评论：`ig_post_comment`

**Phase 3：媒体上传**
1. 图片上传
2. 视频上传（分片）
3. 发布配置

---

## 七、关键代码片段

### 7.1 签名密钥（直接使用）

```typescript
// tweetClaw/src/ig_api/constants.ts
export const SIGNATURE_KEY = '9193488027538fd3450b83b7d05286d4ca9599a0f7eeed90d8c85925698a05dc';
export const SIGNATURE_VERSION = '4';
export const X_IG_APP_ID = '567067343352427';
export const BASE_URL = 'https://i.instagram.com/';
```

### 7.2 点赞 API 参考

**原实现（media.repository.ts）：**
```typescript
public async like(options: MediaLikeOrUnlikeOptions) {
  const signedBody = this.client.request.sign({
    module_name: options.moduleInfo.module_name,
    user_id: options.moduleInfo.user_id,
    username: options.moduleInfo.username,
    d: options.d,
  });
  
  return this.client.request.send({
    url: `/api/v1/media/${options.mediaId}/like/`,
    method: 'POST',
    form: {
      ...signedBody,
      media_id: options.mediaId,
    },
  });
}
```

**我们的实现（计划）：**
```typescript
// tweetClaw/src/ig_api/ig_api.ts
export async function likeMedia(mediaId: string): Promise<any> {
  const payload = {
    media_id: mediaId,
    module_name: 'profile',
    d: 0,
  };
  
  const signedBody = await signRequest(payload);
  const csrfToken = await getCsrfToken();
  
  const response = await fetch(`https://i.instagram.com/api/v1/media/${mediaId}/like/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-CSRFToken': csrfToken,
      'X-IG-App-ID': X_IG_APP_ID,
    },
    body: new URLSearchParams(signedBody).toString(),
    credentials: 'include',  // 浏览器自动带 Cookie
  });
  
  return response.json();
}
```

---

## 八、下一步行动

### 8.1 立即可做

1. **创建基础文件**
   ```bash
   mkdir -p tweetClaw/src/ig_api
   touch tweetClaw/src/ig_api/constants.ts
   touch tweetClaw/src/ig_api/signature.ts
   touch tweetClaw/src/ig_api/types.ts
   touch tweetClaw/src/ig_api/ig_api.ts
   ```

2. **复制常量定义**
   - 从 `instagram-private-api/src/core/constants.ts` 复制关键常量

3. **实现签名函数**
   - 适配 Web Crypto API
   - 测试签名结果

### 8.2 第一个 API

**目标：** 实现 `ig_get_self_info`

**步骤：**
1. 从浏览器读取 `sessionid`、`csrftoken`
2. 构建请求 Headers
3. 调用 `/api/v1/accounts/current_user/`
4. 返回用户信息

---

## 九、风险提示

### 9.1 签名密钥有效性

- 密钥可能随 Instagram 版本更新而变化
- 需要监控 API 响应，及时更新

### 9.2 设备模拟

- instagram-private-api 模拟 Android 设备
- 我们在浏览器环境，可能需要调整部分 Headers

### 9.3 频率限制

- Instagram 对 API 调用有严格限制
- 需要实现智能延迟和重试机制