# TASK-002: 小红书类型定义

**优先级:** P0 (必须先完成)  
**预计时间:** 0.5天  
**依赖:** 无

## 目标

创建小红书平台的 TypeScript 类型定义,为后续开发提供类型支持。

## 实现内容

### 1. 创建目录结构

```
src/platforms/xiaohongshu/
├── types/
│   ├── xhs-common.ts
│   ├── xhs-note.ts
│   └── xhs-user.ts
└── xhs-consts.ts
```

### 2. 通用类型定义

**文件:** `src/platforms/xiaohongshu/types/xhs-common.ts`

```typescript
export interface XhsImage {
  url: string;
  url_default: string;
  url_pre: string;
  width: number;
  height: number;
  file_id?: string;
}

export interface XhsVideo {
  url: string;
  url_default: string;
  duration: number;
  width: number;
  height: number;
  cover: XhsImage;
}

export interface XhsTag {
  id: string;
  name: string;
  type: string;
}

export interface XhsUserBasic {
  user_id: string;
  nickname: string;
  avatar: string;
}

export interface XhsInteractInfo {
  liked: boolean;
  liked_count: string;
  collected: boolean;
  collected_count: string;
  comment_count: string;
  share_count: string;
}

export type XhsAction = 
  | 'like'
  | 'unlike'
  | 'collect'
  | 'uncollect'
  | 'follow'
  | 'unfollow'
  | 'comment';

export interface XhsActionRequest {
  action: XhsAction;
  note_id?: string;
  user_id?: string;
  content?: string;
}
```

### 3. 笔记类型定义

**文件:** `src/platforms/xiaohongshu/types/xhs-note.ts`

```typescript
import { XhsImage, XhsVideo, XhsTag, XhsUserBasic, XhsInteractInfo } from './xhs-common';

export type XhsNoteType = 'normal' | 'video';

export interface XhsNote {
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

export interface XhsNoteFeed {
  notes: XhsNote[];
  cursor: string;
  has_more: boolean;
}

export interface XhsNoteDetail extends XhsNote {
  comments?: XhsComment[];
}

export interface XhsComment {
  id: string;
  content: string;
  user: XhsUserBasic;
  create_time: number;
  like_count: number;
  sub_comment_count: number;
  sub_comments?: XhsComment[];
}
```

### 4. 用户类型定义

**文件:** `src/platforms/xiaohongshu/types/xhs-user.ts`

```typescript
import { XhsUserBasic } from './xhs-common';

export interface XhsUserProfile extends XhsUserBasic {
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

export interface XhsUserStats {
  follows: number;
  fans: number;
  interaction: number;
  notes_count: number;
}
```

### 5. 常量定义

**文件:** `src/platforms/xiaohongshu/xhs-consts.ts`

```typescript
// API 端点
export const XHS_API_ENDPOINTS = {
  FEED: '/api/sns/web/v1/feed',
  NOTE_DETAIL: '/api/sns/web/v1/note/',
  USER_INFO: '/api/sns/web/v1/user/otherinfo',
  USER_POSTED: '/api/sns/web/v1/user_posted',
  COMMENT_PAGE: '/api/sns/web/v2/comment/page',
  LIKE: '/api/sns/web/v1/note/like',
  COLLECT: '/api/sns/web/v1/note/collect',
  FOLLOW: '/api/sns/web/v1/user/follow',
  COMMENT_POST: '/api/sns/web/v2/comment/post',
} as const;

// 消息类型
export const XHS_MSG_TYPE = {
  SIGNAL_CAPTURED: 'XHS_SIGNAL_CAPTURED',
  EXECUTE_ACTION: 'XHS_EXECUTE_ACTION',
  FETCH_NOTE: 'XHS_FETCH_NOTE',
  FETCH_USER: 'XHS_FETCH_USER',
  FETCH_FEED: 'XHS_FETCH_FEED',
} as const;

// 存储键
export const XHS_STORAGE_KEYS = {
  USER_ID: 'xhs_user_id',
  COOKIES: 'xhs_cookies',
  XS_SIGN: 'xhs_xs_sign',
} as const;

// 请求头
export const XHS_HEADERS = {
  CONTENT_TYPE: 'application/json',
  REFERER: 'https://www.xiaohongshu.com/',
} as const;
```

### 6. 导出索引文件

**文件:** `src/platforms/xiaohongshu/types/index.ts`

```typescript
export * from './xhs-common';
export * from './xhs-note';
export * from './xhs-user';
```

**文件:** `src/platforms/xiaohongshu/index.ts`

```typescript
export * from './types';
export * from './xhs-consts';
```

## 验收标准

- [ ] 所有类型定义文件创建完成
- [ ] 常量文件创建完成
- [ ] 导出索引文件配置正确
- [ ] TypeScript 编译无错误
- [ ] 所有类型都有完整的字段定义
- [ ] 类型之间的引用关系正确

## 测试方法

```bash
# TypeScript 编译检查
npm run build:d

# 验证类型导出
node -e "const types = require('./dist/platforms/xiaohongshu'); console.log(Object.keys(types));"
```

## 注意事项

- 类型定义应该基于小红书实际 API 响应结构
- 使用 `string` 类型表示大数字(如点赞数),避免精度问题
- 可选字段使用 `?` 标记
- 常量使用 `as const` 确保类型推断
