# TASK-007: Background 脚本集成

**优先级:** P2  
**预计时间:** 1天  
**依赖:** TASK-003, TASK-004, TASK-005

## 目标

扩展 background 脚本以支持小红书平台的数据捕获和操作分发。

## 实现内容

### 1. 扩展 background.ts

**文件:** `src/service_work/background.ts` (扩展)

在现有文件中添加小红书消息处理:

```typescript
import { detectPlatform } from '../utils/platform-detector';
import { extractNotes, extractUserProfile } from '../platforms/xiaohongshu/xhs-extractor';
import { XHS_MSG_TYPE, XHS_STORAGE_KEYS } from '../platforms/xiaohongshu/xhs-consts';

// ... 现有代码

// 小红书数据捕获处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ... 现有 Twitter 消息处理

  // 小红书数据捕获
  if (message.type === 'XHS_CAPTURED_DATA') {
    handleXhsCapturedData(message, sender);
    sendResponse({ ok: true });
    return true;
  }

  // 小红书 Ping
  if (message.type === 'XHS_PING') {
    sendResponse({ 
      ok: true, 
      platform: 'xiaohongshu',
      version: chrome.runtime.getManifest().version 
    });
    return true;
  }

  return false;
});

/**
 * 处理小红书捕获的数据
 */
function handleXhsCapturedData(message: any, sender: chrome.runtime.MessageSender) {
  const { endpoint, apiUrl, data, headers } = message;

  console.log(`[Background-XHS] Captured: ${endpoint}`);

  // 缓存认证信息
  if (headers?.['x-s']) {
    chrome.storage.local.set({
      [XHS_STORAGE_KEYS.XS_SIGN]: headers['x-s'],
      xhs_xt: headers['x-t'],
      xhs_last_update: Date.now(),
    }).catch(() => {});
  }

  // 根据端点类型处理数据
  if (endpoint.includes('/feed')) {
    handleXhsFeed(data, sender);
  } else if (endpoint.includes('/note/')) {
    handleXhsNote(data, sender);
  } else if (endpoint.includes('/user/otherinfo')) {
    handleXhsUser(data, sender);
  } else if (endpoint.includes('/comment/page')) {
    handleXhsComments(data, sender);
  }

  // 广播到所有监听器(如果有 WebSocket 连接)
  broadcastXhsData(endpoint, data);
}

/**
 * 处理信息流数据
 */
function handleXhsFeed(data: any, sender: chrome.runtime.MessageSender) {
  try {
    const notes = extractNotes(data);
    console.log(`[Background-XHS] Extracted ${notes.length} notes from feed`);

    // 存储到本地(可选)
    chrome.storage.local.get(['xhs_feed_cache'], (result) => {
      const cache = result.xhs_feed_cache || [];
      const updated = [...notes, ...cache].slice(0, 100); // 保留最新 100 条
      chrome.storage.local.set({ xhs_feed_cache: updated });
    });
  } catch (e) {
    console.error('[Background-XHS] handleXhsFeed failed:', e);
  }
}

/**
 * 处理笔记详情
 */
function handleXhsNote(data: any, sender: chrome.runtime.MessageSender) {
  try {
    const note = extractNotes({ data: { items: [{ note_card: data.data }] } })[0];
    if (note) {
      console.log(`[Background-XHS] Note captured: ${note.note_id}`);
      
      // 存储笔记详情
      chrome.storage.local.set({
        [`xhs_note_${note.note_id}`]: note,
      });
    }
  } catch (e) {
    console.error('[Background-XHS] handleXhsNote failed:', e);
  }
}

/**
 * 处理用户资料
 */
function handleXhsUser(data: any, sender: chrome.runtime.MessageSender) {
  try {
    const profile = extractUserProfile(data);
    if (profile) {
      console.log(`[Background-XHS] User profile captured: ${profile.user_id}`);
      
      // 存储用户资料
      chrome.storage.local.set({
        [`xhs_user_${profile.user_id}`]: profile,
      });
    }
  } catch (e) {
    console.error('[Background-XHS] handleXhsUser failed:', e);
  }
}

/**
 * 处理评论数据
 */
function handleXhsComments(data: any, sender: chrome.runtime.MessageSender) {
  try {
    const comments = data.data?.comments || [];
    console.log(`[Background-XHS] Captured ${comments.length} comments`);
  } catch (e) {
    console.error('[Background-XHS] handleXhsComments failed:', e);
  }
}

/**
 * 广播小红书数据到 WebSocket 客户端
 */
function broadcastXhsData(endpoint: string, data: any) {
  // TODO: 如果有 WebSocket 连接,广播数据
  // 这部分取决于现有的 WebSocket 实现
}
```

### 2. 创建平台管理器(可选,用于统一管理)

**文件:** `src/platforms/platform-manager.ts`

```typescript
import { Platform, detectPlatform } from '../utils/platform-detector';

export interface PlatformHandler {
  handleCapturedData(message: any, sender: chrome.runtime.MessageSender): void;
  ping(): Promise<{ ok: boolean; platform: Platform }>;
}

class PlatformManager {
  private handlers: Map<Platform, PlatformHandler> = new Map();

  register(platform: Platform, handler: PlatformHandler) {
    this.handlers.set(platform, handler);
  }

  getHandler(platform: Platform): PlatformHandler | undefined {
    return this.handlers.get(platform);
  }

  detectAndHandle(url: string, message: any, sender: chrome.runtime.MessageSender) {
    const platform = detectPlatform(url);
    const handler = this.handlers.get(platform);
    if (handler) {
      handler.handleCapturedData(message, sender);
    }
  }
}

export const platformManager = new PlatformManager();
```

### 3. 添加调试工具

**文件:** `src/debug/xhs-debug.ts`

```typescript
/**
 * 小红书调试工具
 */

export function logXhsState() {
  chrome.storage.local.get(null, (items) => {
    const xhsKeys = Object.keys(items).filter(k => k.startsWith('xhs_'));
    console.group('XHS State');
    xhsKeys.forEach(key => {
      console.log(key, items[key]);
    });
    console.groupEnd();
  });
}

export function clearXhsCache() {
  chrome.storage.local.get(null, (items) => {
    const xhsKeys = Object.keys(items).filter(k => k.startsWith('xhs_'));
    chrome.storage.local.remove(xhsKeys, () => {
      console.log(`Cleared ${xhsKeys.length} XHS cache entries`);
    });
  });
}

// 暴露到全局(仅开发模式)
if (process.env.NODE_ENV === 'development') {
  (window as any).xhsDebug = {
    logState: logXhsState,
    clearCache: clearXhsCache,
  };
}
```

## 验收标准

- [ ] background.ts 扩展完成,支持小红书消息
- [ ] 所有小红书端点都有对应的处理函数
- [ ] 数据正确提取并存储到 chrome.storage
- [ ] 认证信息(x-s 签名)正确缓存
- [ ] 编译无错误,扩展加载成功
- [ ] 在小红书页面浏览时,background 控制台有日志输出

## 测试方法

```bash
# 编译
npm run build:d

# 加载扩展后测试:
# 1. 打开 chrome://extensions/
# 2. 找到 TweetClaw,点击"service worker"打开 background 控制台
# 3. 访问 https://www.xiaohongshu.com/
# 4. 滚动页面,应该看到 "[Background-XHS] Captured: /api/sns/web/v1/feed"
# 5. 点击笔记,应该看到 "[Background-XHS] Note captured: xxx"

# 在 background 控制台执行:
chrome.storage.local.get(null, (items) => {
  const xhsKeys = Object.keys(items).filter(k => k.startsWith('xhs_'));
  console.log('XHS cached items:', xhsKeys.length);
  console.log(items);
});
```

## 注意事项

- background 脚本在 manifest v3 中是 service worker,可能会被挂起
- 重要状态必须持久化到 chrome.storage
- 避免在 background 中存储大量数据,注意内存使用
- 错误处理要健壮,避免影响其他平台功能
- 考虑添加数据过期清理机制
