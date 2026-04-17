# TASK-001: 平台抽象层实现

**优先级:** P0 (必须先完成)  
**预计时间:** 0.5天  
**依赖:** 无

## 目标

创建平台检测和路由解析的抽象层,使 tweetClaw 支持多平台架构。

## 实现内容

### 1. 创建平台检测器

**文件:** `src/utils/platform-detector.ts`

```typescript
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

export function isTwitter(url: string): boolean {
  return detectPlatform(url) === 'twitter';
}

export function isXiaohongshu(url: string): boolean {
  return detectPlatform(url) === 'xiaohongshu';
}
```

### 2. 扩展路由解析器

**文件:** `src/utils/route-parser.ts`

扩展现有的 `RouteKind` 类型和 `parseRouteKind` 函数:

```typescript
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

function parseTwitterRoute(url: string): RouteKind {
  // 现有的 Twitter 路由解析逻辑
  if (!url || !(url.includes('x.com') || url.includes('twitter.com'))) return 'none';
  try {
    const u = new URL(url);
    const path = u.pathname;
    if (path === '/home' || path === '/') return 'home';
    if (path.includes('/search')) return 'search';
    if (path.includes('/status/')) return 'thread';
    if (path.includes('/notifications')) return 'notification';
    return 'profile';
  } catch { return 'unknown'; }
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

### 3. 添加单元测试

**文件:** `src/utils/__tests__/platform-detector.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { detectPlatform, isTwitter, isXiaohongshu } from '../platform-detector';

describe('platform-detector', () => {
  it('should detect Twitter platform', () => {
    expect(detectPlatform('https://x.com/home')).toBe('twitter');
    expect(detectPlatform('https://twitter.com/user')).toBe('twitter');
    expect(isTwitter('https://x.com/home')).toBe(true);
  });

  it('should detect Xiaohongshu platform', () => {
    expect(detectPlatform('https://www.xiaohongshu.com/explore')).toBe('xiaohongshu');
    expect(isXiaohongshu('https://www.xiaohongshu.com/explore')).toBe(true);
  });

  it('should return unknown for unrecognized URLs', () => {
    expect(detectPlatform('https://example.com')).toBe('unknown');
    expect(detectPlatform('')).toBe('unknown');
  });
});
```

**文件:** `src/utils/__tests__/route-parser.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { parseRouteKind } from '../route-parser';

describe('route-parser', () => {
  describe('Twitter routes', () => {
    it('should parse Twitter home', () => {
      expect(parseRouteKind('https://x.com/home')).toBe('home');
      expect(parseRouteKind('https://x.com/')).toBe('home');
    });

    it('should parse Twitter thread', () => {
      expect(parseRouteKind('https://x.com/user/status/123')).toBe('thread');
    });

    it('should parse Twitter profile', () => {
      expect(parseRouteKind('https://x.com/username')).toBe('profile');
    });
  });

  describe('Xiaohongshu routes', () => {
    it('should parse XHS explore', () => {
      expect(parseRouteKind('https://www.xiaohongshu.com/')).toBe('xhs_explore');
      expect(parseRouteKind('https://www.xiaohongshu.com/explore')).toBe('xhs_explore');
    });

    it('should parse XHS note', () => {
      expect(parseRouteKind('https://www.xiaohongshu.com/explore/123abc')).toBe('xhs_note');
    });

    it('should parse XHS user', () => {
      expect(parseRouteKind('https://www.xiaohongshu.com/user/profile/456def')).toBe('xhs_user');
    });
  });
});
```

## 验收标准

- [ ] `platform-detector.ts` 文件创建完成,包含所有导出函数
- [ ] `route-parser.ts` 扩展完成,支持小红书路由
- [ ] 所有单元测试通过 (`npm test`)
- [ ] TypeScript 编译无错误 (`npm run build:d`)
- [ ] 代码符合项目 lint 规范

## 测试方法

```bash
# 运行单元测试
npm test

# 运行 TypeScript 编译检查
npm run build:d
```

## 注意事项

- 保持向后兼容,不要破坏现有 Twitter 功能
- 确保所有导出的类型和函数都有正确的 TypeScript 类型定义
- 测试覆盖率应达到 100%
