# TASK-005: 小红书 API 客户端

**优先级:** P2  
**预计时间:** 2天  
**依赖:** TASK-002, TASK-003

## 目标

实现小红书 API 客户端,支持点赞、收藏、关注、评论等互动操作。

## 实现内容

### 1. 创建 API 客户端

**文件:** `src/platforms/xiaohongshu/xhs-api.ts`

```typescript
import { XHS_API_ENDPOINTS, XHS_STORAGE_KEYS } from './xhs-consts';
import { XhsAction } from './types';

/**
 * 获取小红书请求头
 */
async function getXhsHeaders(): Promise<Record<string, string>> {
  const stored = await chrome.storage.local.get([
    XHS_STORAGE_KEYS.XS_SIGN,
    'xhs_xt',
  ]);

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'referer': 'https://www.xiaohongshu.com/',
    'accept': 'application/json, text/plain, */*',
  };

  // 添加签名头
  if (stored[XHS_STORAGE_KEYS.XS_SIGN]) {
    headers['x-s'] = stored[XHS_STORAGE_KEYS.XS_SIGN];
  }
  if (stored.xhs_xt) {
    headers['x-t'] = stored.xhs_xt;
  }

  return headers;
}

/**
 * 获取 API 端点
 */
function getXhsEndpoint(action: XhsAction): string {
  const baseUrl = 'https://edith.xiaohongshu.com';
  
  switch (action) {
    case 'like':
    case 'unlike':
      return `${baseUrl}${XHS_API_ENDPOINTS.LIKE}`;
    case 'collect':
    case 'uncollect':
      return `${baseUrl}${XHS_API_ENDPOINTS.COLLECT}`;
    case 'follow':
    case 'unfollow':
      return `${baseUrl}${XHS_API_ENDPOINTS.FOLLOW}`;
    case 'comment':
      return `${baseUrl}${XHS_API_ENDPOINTS.COMMENT_POST}`;
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * 执行小红书操作
 */
export async function performXhsAction(
  action: XhsAction,
  params: {
    note_id?: string;
    user_id?: string;
    content?: string;
  }
): Promise<any> {
  const endpoint = getXhsEndpoint(action);
  const headers = await getXhsHeaders();

  // 构建请求体
  const body = buildRequestBody(action, params);

  console.log(`[XhsAPI] ${action} request to ${endpoint}`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[XhsAPI] ${action} failed (${response.status}):`, text);
    throw new Error(`XHS API error: ${response.status}`);
  }

  const data = await response.json();
  
  // 检查业务错误
  if (data.code !== 0 && data.success !== true) {
    console.error(`[XhsAPI] ${action} business error:`, data);
    throw new Error(data.msg || data.message || 'XHS API business error');
  }

  console.log(`[XhsAPI] ${action} success`);
  return data;
}

/**
 * 构建请求体
 */
function buildRequestBody(
  action: XhsAction,
  params: {
    note_id?: string;
    user_id?: string;
    content?: string;
  }
): any {
  switch (action) {
    case 'like':
      return {
        note_id: params.note_id,
        type: 'normal',
      };
    case 'unlike':
      return {
        note_id: params.note_id,
        type: 'normal',
      };
    case 'collect':
      return {
        note_id: params.note_id,
      };
    case 'uncollect':
      return {
        note_id: params.note_id,
      };
    case 'follow':
      return {
        target_user_id: params.user_id,
      };
    case 'unfollow':
      return {
        target_user_id: params.user_id,
      };
    case 'comment':
      return {
        note_id: params.note_id,
        content: params.content,
        at_users: [],
      };
    default:
      return {};
  }
}

/**
 * 获取笔记详情
 */
export async function fetchXhsNote(noteId: string): Promise<any> {
  const url = `https://edith.xiaohongshu.com${XHS_API_ENDPOINTS.NOTE_DETAIL}${noteId}`;
  const headers = await getXhsHeaders();

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch note: ${response.status}`);
  }

  return response.json();
}

/**
 * 获取用户资料
 */
export async function fetchXhsUser(userId: string): Promise<any> {
  const url = `https://edith.xiaohongshu.com${XHS_API_ENDPOINTS.USER_INFO}`;
  const headers = await getXhsHeaders();

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ user_id: userId }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status}`);
  }

  return response.json();
}
```

### 2. 扩展内容脚本处理操作

**文件:** `src/content/xhs-main-entrance.ts` (扩展)

在现有文件中添加消息处理:

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ... 现有代码

  if (message.type === 'XHS_EXECUTE_ACTION') {
    (async () => {
      try {
        const result = await performXhsAction(message.action, {
          note_id: message.note_id,
          user_id: message.user_id,
          content: message.content,
        });
        sendResponse({ success: true, data: result });
      } catch (e: any) {
        console.error('[XhsClaw-CS] action failed:', e);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === 'XHS_FETCH_NOTE') {
    (async () => {
      try {
        const data = await fetchXhsNote(message.note_id);
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === 'XHS_FETCH_USER') {
    (async () => {
      try {
        const data = await fetchXhsUser(message.user_id);
        sendResponse({ success: true, data });
      } catch (e: any) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  return false;
});
```

### 3. 添加 URL 工具

**文件:** `src/platforms/xiaohongshu/xhs-url-utils.ts`

```typescript
/**
 * 从 URL 中提取笔记 ID
 */
export function extractNoteId(url: string): string | null {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\/explore\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * 从 URL 中提取用户 ID
 */
export function extractUserId(url: string): string | null {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\/user\/profile\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * 构建笔记 URL
 */
export function buildNoteUrl(noteId: string): string {
  return `https://www.xiaohongshu.com/explore/${noteId}`;
}

/**
 * 构建用户主页 URL
 */
export function buildUserUrl(userId: string): string {
  return `https://www.xiaohongshu.com/user/profile/${userId}`;
}
```

## 验收标准

- [ ] `xhs-api.ts` 实现完成
- [ ] `xhs-url-utils.ts` 实现完成
- [ ] 内容脚本消息处理扩展完成
- [ ] 所有 API 操作都有错误处理
- [ ] TypeScript 编译无错误
- [ ] 能正确构建请求头和请求体

## 测试方法

```bash
# 编译检查
npm run build:d

# 手动测试(需要先完成 manifest 配置):
# 1. 加载扩展到 Chrome
# 2. 登录小红书
# 3. 打开控制台,在 background 页面执行:
chrome.tabs.query({active: true}, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, {
    type: 'XHS_EXECUTE_ACTION',
    action: 'like',
    note_id: '实际的笔记ID'
  }, (response) => {
    console.log('Response:', response);
  });
});
```

## 注意事项

- x-s 签名可能有时效性,需要从最新请求中提取
- API 端点可能变化,需要通过抓包验证
- 错误响应格式可能不统一,需要健壮处理
- 频率限制可能导致请求失败,需要适当重试
- 某些操作可能需要额外的参数或签名
