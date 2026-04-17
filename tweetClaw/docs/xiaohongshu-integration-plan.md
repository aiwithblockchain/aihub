# 小红书 (Xiaohongshu) 集成开发计划

## 项目概述

将 tweetClaw 浏览器扩展扩展到支持小红书平台 (https://www.xiaohongshu.com/)，使其能够捕获小红书的内容数据并提供 AI 代理操作能力。

## 核心功能设计

### 1. 笔记内容捕获 (Note Content Capture)

**功能描述:**
- 捕获小红书笔记的完整内容,包括文本、图片、视频、标签等
- 支持图文笔记和视频笔记两种类型
- 提取笔记的互动数据(点赞数、收藏数、评论数)

**技术实现:**
- 拦截小红书 API 端点: `/api/sns/web/v1/feed` (首页信息流)
- 拦截笔记详情接口: `/api/sns/web/v1/note/{note_id}`
- 拦截评论接口: `/api/sns/web/v2/comment/page`

**数据结构:**
```typescript
interface XhsNote {
  note_id: string;
  title: string;
  desc: string;           // 笔记正文
  type: 'normal' | 'video';
  user: XhsUserBasic;
  images?: XhsImage[];
  video?: XhsVideo;
  tags: XhsTag[];
  interact_info: {
    liked_count: number;
    collected_count: number;
    comment_count: number;
    share_count: number;
  };
  create_time: number;
  last_update_time: number;
}
```

### 2. 用户资料获取 (User Profile Fetching)

**功能描述:**
- 获取小红书用户的完整个人资料
- 包括用户基本信息、统计数据、认证信息
- 支持通过用户 ID 或用户主页 URL 获取

**技术实现:**
- 拦截用户主页接口: `/api/sns/web/v1/user/otherinfo`
- 拦截用户笔记列表: `/api/sns/web/v1/user_posted`

**数据结构:**
```typescript
interface XhsUserProfile {
  user_id: string;
  nickname: string;
  avatar: string;
  desc: string;           // 个人简介
  gender: number;         // 0:未知 1:男 2:女
  ip_location: string;    // IP属地
  follows: number;        // 关注数
  fans: number;           // 粉丝数
  interaction: number;    // 获赞与收藏
  notes_count: number;    // 笔记数
  verified: boolean;      // 是否认证
  verified_content?: string;
}
```

### 3. 互动操作 (Interaction Actions)

**功能描述:**
- 点赞/取消点赞笔记
- 收藏/取消收藏笔记
- 关注/取消关注用户
- 发布评论

**技术实现:**
- 点赞接口: `POST /api/sns/web/v1/note/like`
- 收藏接口: `POST /api/sns/web/v1/note/collect`
- 关注接口: `POST /api/sns/web/v1/user/follow`
- 评论接口: `POST /api/sns/web/v2/comment/post`

**操作类型:**
```typescript
type XhsAction = 
  | 'like'
  | 'unlike'
  | 'collect'
  | 'uncollect'
  | 'follow'
  | 'unfollow'
  | 'comment';

interface XhsActionRequest {
  action: XhsAction;
  note_id?: string;
  user_id?: string;
  content?: string;  // 评论内容
}
```

## 技术架构

### 文件结构

```
tweetClaw/
├── src/
│   ├── platforms/
│   │   ├── twitter/          # 现有 Twitter 实现
│   │   └── xiaohongshu/      # 新增小红书模块
│   │       ├── xhs-api.ts           # 小红书 API 客户端
│   │       ├── xhs-extractor.ts     # 数据提取器
│   │       ├── xhs-injection.ts     # 页面注入脚本
│   │       ├── xhs-url-utils.ts     # URL 解析工具
│   │       ├── xhs-consts.ts        # 常量定义
│   │       └── types/
│   │           ├── xhs-note.ts
│   │           ├── xhs-user.ts
│   │           └── xhs-common.ts
│   ├── utils/
│   │   ├── platform-detector.ts     # 平台检测器(新增)
│   │   └── route-parser.ts          # 路由解析器(扩展)
│   └── content/
│       └── main_entrance.ts         # 内容脚本入口(扩展)
```

### 核心模块设计

#### 1. 平台检测器 (Platform Detector)

```typescript
// src/utils/platform-detector.ts
export type Platform = 'twitter' | 'xiaohongshu' | 'unknown';

export function detectPlatform(url: string): Platform {
  if (url.includes('x.com') || url.includes('twitter.com')) {
    return 'twitter';
  }
  if (url.includes('xiaohongshu.com')) {
    return 'xiaohongshu';
  }
  return 'unknown';
}
```

#### 2. 小红书注入脚本 (XHS Injection)

类似 `injection.ts` 的实现,拦截小红书的 fetch/XHR 请求:

```typescript
// src/platforms/xiaohongshu/xhs-injection.ts
const XHS_API_ENDPOINTS = [
  '/api/sns/web/v1/feed',
  '/api/sns/web/v1/note/',
  '/api/sns/web/v1/user/otherinfo',
  '/api/sns/web/v2/comment/page',
  // ... 更多端点
];

function isXhsApiUrl(url: string): string | null {
  for (const endpoint of XHS_API_ENDPOINTS) {
    if (url.includes(endpoint)) {
      return endpoint;
    }
  }
  return null;
}

// 拦截 fetch 请求
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0] as string;
  const endpoint = isXhsApiUrl(url);
  
  if (endpoint) {
    return originalFetch.apply(this, args).then(response => {
      const clonedResponse = response.clone();
      clonedResponse.json().then(data => {
        postSignal(endpoint, url, data);
      });
      return response;
    });
  }
  
  return originalFetch.apply(this, args);
};
```

#### 3. 小红书 API 客户端 (XHS API Client)

```typescript
// src/platforms/xiaohongshu/xhs-api.ts
export async function performXhsAction(
  action: XhsAction,
  params: any
): Promise<any> {
  const endpoint = getXhsEndpoint(action);
  const headers = await getXhsHeaders();
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
    credentials: 'include'
  });
  
  return response.json();
}

async function getXhsHeaders(): Promise<Record<string, string>> {
  // 小红书需要特殊的请求头
  return {
    'content-type': 'application/json',
    'x-s': await getXsSign(),  // 小红书签名
    'x-t': Date.now().toString(),
    'referer': 'https://www.xiaohongshu.com/'
  };
}
```

#### 4. 路由解析器扩展

```typescript
// src/utils/route-parser.ts (扩展)
export type RouteKind = 
  | 'home' 
  | 'search' 
  | 'thread' 
  | 'profile' 
  | 'notification'
  | 'xhs_explore'    // 小红书发现页
  | 'xhs_note'       // 小红书笔记详情
  | 'xhs_user'       // 小红书用户主页
  | 'none' 
  | 'unknown';

export function parseRouteKind(url: string): RouteKind {
  const platform = detectPlatform(url);
  
  if (platform === 'xiaohongshu') {
    return parseXhsRoute(url);
  }
  
  if (platform === 'twitter') {
    return parseTwitterRoute(url);
  }
  
  return 'unknown';
}

function parseXhsRoute(url: string): RouteKind {
  try {
    const u = new URL(url);
    const path = u.pathname;
    
    if (path === '/' || path === '/explore') return 'xhs_explore';
    if (path.startsWith('/explore/')) return 'xhs_note';
    if (path.startsWith('/user/profile/')) return 'xhs_user';
    
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
```

## 实施步骤

### Phase 1: 基础架构 (2-3天)

1. **创建平台抽象层**
   - 实现 `platform-detector.ts`
   - 扩展 `route-parser.ts` 支持多平台
   - 修改 `main_entrance.ts` 支持平台分发

2. **创建小红书模块结构**
   - 创建 `src/platforms/xiaohongshu/` 目录
   - 定义 TypeScript 类型定义
   - 创建常量文件 `xhs-consts.ts`

### Phase 2: 数据捕获 (3-4天)

1. **实现注入脚本**
   - 开发 `xhs-injection.ts`
   - 拦截小红书 API 请求
   - 提取认证信息 (cookies, x-s 签名等)

2. **实现数据提取器**
   - 开发 `xhs-extractor.ts`
   - 解析笔记数据结构
   - 解析用户数据结构
   - 处理图片/视频 URL

3. **测试数据捕获**
   - 验证首页信息流捕获
   - 验证笔记详情捕获
   - 验证用户资料捕获

### Phase 3: API 客户端 (3-4天)

1. **实现 API 客户端**
   - 开发 `xhs-api.ts`
   - 实现认证头生成
   - 实现 x-s 签名算法(如需要)

2. **实现互动操作**
   - 点赞/取消点赞
   - 收藏/取消收藏
   - 关注/取消关注
   - 发布评论

3. **错误处理**
   - API 错误处理
   - 重试机制
   - 降级策略

### Phase 4: 集成与测试 (2-3天)

1. **集成到主流程**
   - 修改 manifest.json 添加小红书域名权限
   - 更新 webpack 配置
   - 集成到 background.ts

2. **端到端测试**
   - 测试完整的数据捕获流程
   - 测试所有互动操作
   - 测试错误场景

3. **文档编写**
   - API 文档
   - 使用说明
   - 故障排查指南

## 技术挑战与解决方案

### 1. 小红书反爬虫机制

**挑战:** 小红书有较强的反爬虫机制,包括:
- x-s 签名验证
- 设备指纹识别
- 频率限制

**解决方案:**
- 从真实浏览器会话中提取认证信息
- 复用用户的真实 cookies
- 实现请求频率控制
- 如需要,逆向 x-s 签名算法

### 2. API 端点发现

**挑战:** 小红书的 API 端点可能不公开,需要通过抓包分析

**解决方案:**
- 使用浏览器开发者工具分析网络请求
- 记录所有关键 API 端点
- 建立 API 端点映射表

### 3. 数据结构变化

**挑战:** 小红书可能随时更改 API 响应结构

**解决方案:**
- 实现健壮的数据解析器
- 添加版本检测机制
- 实现降级处理

## manifest.json 配置更新

```json
{
  "manifest_version": 3,
  "name": "TweetClaw",
  "version": "0.6.0",
  "permissions": [
    "storage",
    "cookies",
    "webRequest"
  ],
  "host_permissions": [
    "https://x.com/*",
    "https://twitter.com/*",
    "https://www.xiaohongshu.com/*",
    "https://edith.xiaohongshu.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://x.com/*",
        "https://twitter.com/*"
      ],
      "js": ["js/content-twitter.js"]
    },
    {
      "matches": [
        "https://www.xiaohongshu.com/*"
      ],
      "js": ["js/content-xhs.js"]
    }
  ]
}
```

## 测试计划

### 单元测试
- 平台检测器测试
- 路由解析器测试
- 数据提取器测试
- URL 工具测试

### 集成测试
- 数据捕获流程测试
- API 调用测试
- 错误处理测试

### 手动测试场景
1. 浏览小红书首页,验证信息流捕获
2. 打开笔记详情,验证笔记内容捕获
3. 访问用户主页,验证用户资料获取
4. 执行点赞操作,验证 API 调用
5. 执行收藏操作,验证 API 调用
6. 发布评论,验证评论功能

## 时间估算

- Phase 1: 2-3 天
- Phase 2: 3-4 天
- Phase 3: 3-4 天
- Phase 4: 2-3 天

**总计: 10-14 天**

## 风险评估

### 高风险
- 小红书 x-s 签名算法可能难以逆向
- API 端点可能频繁变化
- 反爬虫机制可能导致账号风险

### 中风险
- 数据结构解析复杂度
- 跨平台架构重构工作量

### 低风险
- 基础功能实现
- 测试覆盖

## 后续扩展

1. **搜索功能** - 支持小红书搜索
2. **消息功能** - 支持私信发送
3. **发布笔记** - 支持发布图文/视频笔记
4. **数据分析** - 提供笔记数据分析功能
5. **批量操作** - 支持批量点赞、收藏等操作

## 参考资料

- 小红书官网: https://www.xiaohongshu.com/
- tweetClaw 现有架构文档
- 浏览器扩展开发文档
- Chrome Extension Manifest V3 文档
