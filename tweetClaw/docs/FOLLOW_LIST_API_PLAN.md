# tweetClaw 关注列表 API 开发计划

## 一、背景与目标

### 参考来源
TweetCat（`/ninja/TweetCat/src/x_api/twitter_api.ts`）已实现三个关注列表读取接口：

| TweetCat 函数 | 说明 | X GraphQL Operation |
|---|---|---|
| `fetchFollowersPage` | 关注我的（粉丝列表） | `Followers` |
| `fetchFollowingPage` | 我关注的（关注列表） | `Following` |
| `fetchBlueVerifiedFollowersPage` | 关注我的蓝 V 用户 | `BlueVerifiedFollowers` |

TweetCat 还有一个关注**别人**的写操作 `_followApi`（实际是上面三个 read API 的底层复用），与"关注别人"不同。

### 现状分析：tweetClaw 已有什么

| 功能 | 状态 | 实现路径 |
|---|---|---|
| 关注别人（Follow） | ✅ 已实现 | `execAction({action:'follow'})` → `CreateFriendship` GraphQL + `performLegacyREST` 降级 |
| 取关（Unfollow） | ✅ 已实现 | `execAction({action:'unfollow'})` → `DestroyFriendship` GraphQL + `performLegacyREST` 降级 |
| 读取粉丝列表 | ❌ 未实现 | — |
| 读取我关注的列表 | ❌ 未实现 | — |
| 读取蓝V粉丝列表 | ❌ 未实现 | — |

> **结论**：tweetClaw 已有关注/取关的**写操作**，但三个关注列表的**读操作**均未实现，需要全部新增。

---

## 二、tweetClaw 架构回顾

实现任何新 X API 接口都需要打通以下 4 层，以现有 `queryUserTweets` 为参照：

```
[外部调用者/AI]
      │ WebSocket 消息: request.query_user_tweets
      ▼
[Bridge 层] local-bridge-socket.ts
  queryUserTweetsHandler → 调用 background.ts 中的函数
      │
      ▼
[Background 层] background.ts
  queryUserTweets() → chrome.tabs.sendMessage(tabId, {type:'FETCH_USER_TWEETS',...})
      │
      ▼
[Content Script 层] main_entrance.ts
  监听 'FETCH_USER_TWEETS' → 调用 performQuery('UserTweets', variables)
      │
      ▼
[X API 层] twitter_api.ts
  performQuery() → fetch('https://x.com/i/api/graphql/...')
```

关注列表是 **GET 查询**，与 `UserTweets`、`SearchTimeline` 属于同类，但有一个关键差异：

> TweetCat 的 `_followApi` 在请求头里额外携带了 `x-client-transaction-id`（txid），而 tweetClaw 的 `performQuery()` 已经默认包含 txid。因此 tweetClaw 可以**直接复用 `performQuery()`**，无需像 TweetCat 那样单独封装 `_followApi`。

---

## 三、需要改动的文件

共需修改 **5 个文件**，新增 **0 个文件**：

```
src/
├── capture/consts.ts              ← [1] 注册 BlueVerifiedFollowers
├── x_api/twitter_api.ts           ← [2] 新增 fetchFollowList() 辅助函数（可选，见讨论）
├── content/main_entrance.ts       ← [3] 新增 3 个消息处理器
├── service_work/background.ts     ← [4] 新增 3 个 handler 函数 + payload 类型
└── bridge/
    ├── ws-protocol.ts             ← [5a] 新增消息类型定义 + payload 接口
    └── local-bridge-socket.ts     ← [5b] 注册 3 个 handler
```

---

## 四、各文件具体改动

### 4.1 `src/capture/consts.ts`

**目的**：将 `BlueVerifiedFollowers` 纳入自动收割监听，并提供 QueryID 默认值。

#### QueryID 自动收割机制说明

tweetClaw 已实现完整的 QueryID 动态更新机制，链路如下：

```
injection.ts（页面上下文）
  拦截 fetch/XHR，URL 命中 watchedOps 中的 op 名称时
  → postMessage({ type:'SIGNAL_CAPTURED', op, apiUrl })
        ↓
content/main_entrance.ts（content script）
  转发给 background：
  → chrome.runtime.sendMessage({ type:'CAPTURED_DATA', op, apiUrl })
        ↓
background.ts（service worker）
  harvestQueryId(op, apiUrl)
  → 从 apiUrl 解析 /graphql/{queryId}/{op}
  → 若与 storage 中存储的值不同，立即覆盖更新
  → chrome.storage.local.set({ [tc_query_id_map]: map })
```

**结论**：每次用户正常浏览 X 时，只要页面触发了 `watchedOps` 中的接口，最新 QueryID 就会被自动捕获并更新到本地存储，下次 `performQuery()` 调用时自动使用新值，无需手动维护。

#### 为什么 `BlueVerifiedFollowers` 必须加入 `watchedOps`

`Followers` 和 `Following` 已在 `watchedOps` 中，injection 会自动监听并更新它们的 QueryID。但 `BlueVerifiedFollowers` **目前不在列表里**，即使用户访问了 X 上能触发该接口的页面，injection 也会静默忽略，QueryID 永远不会被更新。

**不加入 `watchedOps` 的后果**：`defaultQueryKeyMap` 中写死的初始值一旦过期（X 随时可能更换哈希），接口会持续 404 报错，且无法自愈。

#### 代码改动

```diff
 export const watchedOps = [
     ...
     'Followers',
     'Following',
+    'BlueVerifiedFollowers',   // ← 必须加，否则 QueryID 无法被自动收割更新
     ...
 ];

 export const defaultQueryKeyMap: Record<string, string> = {
     ...
     'Following': 'SaWqzw0TFAWMx1nXWjXoaQ',
     'Followers': 'i6PPdIMm1MO7CpAqjau7sw',
+    'BlueVerifiedFollowers': 'NpilnLAjnXV-kEHbBFzQlg',  // 从 TweetCat 同步的初始值，上线后由机制自动更新
     ...
 };
```

> **说明**：`defaultQueryKeyMap` 中的初始值只是启动时的兜底，首次触发该接口后会被自动覆盖为最新值。若初始值已过期，第一次调用会 404，但用户访问 X 相关页面后即可自愈。

---

### 4.2 `src/x_api/twitter_api.ts`（可选）

**目的**：封装关注列表专用的参数构造，隔离差异。

TweetCat 中 `buildFollowersUrl` 和 `buildFollowingURL` 的参数略有不同：

| 接口 | 特殊参数 |
|---|---|
| `Followers` / `BlueVerifiedFollowers` | `withGrokTranslatedBio: false` |
| `Following` | `withGrokTranslatedBio: false`（相同） |
| 三者共同参数 | `userId`, `count`, `includePromotedContent: false`, `cursor?` |

由于参数结构几乎完全一致，**不需要新增专用 API 函数**，直接在 Content Script 层内联构造 variables 即可，与 `FETCH_USER_TWEETS` 的处理方式相同。

若将来需要在多处复用，可在此文件新增一个 `performFollowListQuery(op, userId, count, cursor)` 辅助函数，但当前阶段不需要。

---

### 4.3 `src/content/main_entrance.ts`

**目的**：新增 3 个消息处理器，接收来自 Background 的转发，调用 `performQuery` 并返回原始响应。

在文件末尾（`return false;` 之前）新增：

```typescript
if (message.type === 'FETCH_FOLLOWERS_PAGE') {
    (async () => {
        try {
            const variables: any = {
                userId: message.userId,
                count: message.count || 20,
                includePromotedContent: false,
                withGrokTranslatedBio: false,
            };
            if (message.cursor) variables.cursor = message.cursor;
            const data = await performQuery('Followers', variables);
            sendResponse({ success: true, data });
        } catch (e: any) {
            sendResponse({ success: false, error: e.message });
        }
    })();
    return true;
}

if (message.type === 'FETCH_FOLLOWING_PAGE') {
    (async () => {
        try {
            const variables: any = {
                userId: message.userId,
                count: message.count || 20,
                includePromotedContent: false,
                withGrokTranslatedBio: false,
            };
            if (message.cursor) variables.cursor = message.cursor;
            const data = await performQuery('Following', variables);
            sendResponse({ success: true, data });
        } catch (e: any) {
            sendResponse({ success: false, error: e.message });
        }
    })();
    return true;
}

if (message.type === 'FETCH_BLUE_VERIFIED_FOLLOWERS_PAGE') {
    (async () => {
        try {
            const variables: any = {
                userId: message.userId,
                count: message.count || 20,
                includePromotedContent: false,
                withGrokTranslatedBio: false,
            };
            if (message.cursor) variables.cursor = message.cursor;
            const data = await performQuery('BlueVerifiedFollowers', variables);
            sendResponse({ success: true, data });
        } catch (e: any) {
            sendResponse({ success: false, error: e.message });
        }
    })();
    return true;
}
```

---

### 4.4 `src/service_work/background.ts`

**目的**：新增 3 个 payload 接口 + 3 个 handler 函数，注册到 localBridge。

**Step 1：新增 payload 类型**（在现有 `QueryUserTweetsPayload` 接口附近）

```typescript
interface QueryFollowersPayload {
    userId: string;   // 目标用户 ID
    tabId?: number;
    cursor?: string;  // 翻页游标
    count?: number;   // 单页数量（默认 20）
}

interface QueryFollowingPayload {
    userId: string;
    tabId?: number;
    cursor?: string;
    count?: number;
}

interface QueryBlueVerifiedFollowersPayload {
    userId: string;
    tabId?: number;
    cursor?: string;
    count?: number;
}
```

> 三个 payload 结构完全相同，可以合并成一个 `QueryFollowListPayload`，但为了与其他接口风格保持一致，分开定义更清晰。

**Step 2：新增 3 个 handler 函数**（在 `queryUserTweets` 函数之后）

```typescript
export async function queryFollowers(payload: QueryFollowersPayload): Promise<TwitterResponse> {
    const { userId, cursor, count, tabId } = payload;
    if (!userId) throw new Error('userId is required');

    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) throw new Error('No x.com tab found');

    const result = await chrome.tabs.sendMessage(targetTabId, {
        type: 'FETCH_FOLLOWERS_PAGE',
        userId,
        cursor,
        count: count || 20
    });

    return result;
}

export async function queryFollowing(payload: QueryFollowingPayload): Promise<TwitterResponse> {
    const { userId, cursor, count, tabId } = payload;
    if (!userId) throw new Error('userId is required');

    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) throw new Error('No x.com tab found');

    const result = await chrome.tabs.sendMessage(targetTabId, {
        type: 'FETCH_FOLLOWING_PAGE',
        userId,
        cursor,
        count: count || 20
    });

    return result;
}

export async function queryBlueVerifiedFollowers(payload: QueryBlueVerifiedFollowersPayload): Promise<TwitterResponse> {
    const { userId, cursor, count, tabId } = payload;
    if (!userId) throw new Error('userId is required');

    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    let targetTabId: number | undefined = tabId;
    if (!targetTabId) {
        const activeTab = xTabs.find(t => t.active) || xTabs[0];
        targetTabId = activeTab?.id;
    }
    if (!targetTabId) throw new Error('No x.com tab found');

    const result = await chrome.tabs.sendMessage(targetTabId, {
        type: 'FETCH_BLUE_VERIFIED_FOLLOWERS_PAGE',
        userId,
        cursor,
        count: count || 20
    });

    return result;
}
```

**Step 3：注册到 localBridge**（在现有 `localBridge.queryUserTweetsHandler = queryUserTweets;` 附近）

```typescript
localBridge.queryFollowersHandler = queryFollowers;
localBridge.queryFollowingHandler = queryFollowing;
localBridge.queryBlueVerifiedFollowersHandler = queryBlueVerifiedFollowers;
```

---

### 4.5 `src/bridge/ws-protocol.ts`

**目的**：扩展消息类型枚举 + 新增 payload 接口。

**Step 1：在 `MessageType` union 中新增**

```diff
   | 'request.query_user_tweets'
   | 'response.query_user_tweets'
+  | 'request.query_followers'
+  | 'response.query_followers'
+  | 'request.query_following'
+  | 'response.query_following'
+  | 'request.query_blue_verified_followers'
+  | 'response.query_blue_verified_followers'
   | 'request.start_task'
```

**Step 2：在 `MESSAGE_TYPES` 常量中新增**

```diff
   REQUEST_QUERY_USER_TWEETS: 'request.query_user_tweets',
   RESPONSE_QUERY_USER_TWEETS: 'response.query_user_tweets',
+  REQUEST_QUERY_FOLLOWERS: 'request.query_followers',
+  RESPONSE_QUERY_FOLLOWERS: 'response.query_followers',
+  REQUEST_QUERY_FOLLOWING: 'request.query_following',
+  RESPONSE_QUERY_FOLLOWING: 'response.query_following',
+  REQUEST_QUERY_BLUE_VERIFIED_FOLLOWERS: 'request.query_blue_verified_followers',
+  RESPONSE_QUERY_BLUE_VERIFIED_FOLLOWERS: 'response.query_blue_verified_followers',
```

**Step 3：新增 payload 接口**（在 `QueryUserTweetsRequestPayload` 之后）

```typescript
export interface QueryFollowersRequestPayload {
    userId: string;   // 目标用户 ID
    tabId?: number;
    cursor?: string;
    count?: number;
}

export interface QueryFollowingRequestPayload {
    userId: string;
    tabId?: number;
    cursor?: string;
    count?: number;
}

export interface QueryBlueVerifiedFollowersRequestPayload {
    userId: string;
    tabId?: number;
    cursor?: string;
    count?: number;
}
```

---

### 4.6 `src/bridge/local-bridge-socket.ts`

**目的**：声明 3 个 handler 属性，并在 `onmessage` 路由中处理对应消息类型。

**Step 1：在 handler 属性声明区新增**（在 `queryUserTweetsHandler` 附近）

```typescript
public queryFollowersHandler: ((payload: any) => Promise<any>) | null = null;
public queryFollowingHandler: ((payload: any) => Promise<any>) | null = null;
public queryBlueVerifiedFollowersHandler: ((payload: any) => Promise<any>) | null = null;
```

**Step 2：在 `onmessage` 路由分发处新增**（仿照 `query_user_tweets` 的处理模式）

```typescript
case MESSAGE_TYPES.REQUEST_QUERY_FOLLOWERS:
    this.handleRequest(msg, this.queryFollowersHandler);
    break;

case MESSAGE_TYPES.REQUEST_QUERY_FOLLOWING:
    this.handleRequest(msg, this.queryFollowingHandler);
    break;

case MESSAGE_TYPES.REQUEST_QUERY_BLUE_VERIFIED_FOLLOWERS:
    this.handleRequest(msg, this.queryBlueVerifiedFollowersHandler);
    break;
```

---

## 五、关于"关注别人"（Follow）的结论

**tweetClaw 已实现，无需移植。**

| TweetCat `_followApi` | tweetClaw 对应实现 |
|---|---|
| **读**：获取粉丝/关注列表（`Followers`、`Following`、`BlueVerifiedFollowers`） | ❌ 未实现，本计划补充 |
| **写**：关注别人（`CreateFriendship`）| ✅ `execAction({action:'follow', userId})` |
| **写**：取关（`DestroyFriendship`）| ✅ `execAction({action:'unfollow', userId})` |

TweetCat 的 `_followApi` 是读取列表的底层方法名，在 tweetClaw 里它对应 `performQuery()`，已经存在，不需要单独引入。

---

## 六、实现顺序

建议按以下顺序实现，每步可独立验证：

```
Step 1 → consts.ts
  添加 BlueVerifiedFollowers 到 watchedOps 和 defaultQueryKeyMap
  验证：打开 X 页面，查看 storage 中的 tc_query_id_map

Step 2 → ws-protocol.ts
  新增消息类型定义和 payload 接口
  验证：TypeScript 编译无报错

Step 3 → local-bridge-socket.ts
  声明 3 个 handler 属性，注册路由 case
  验证：TypeScript 编译无报错

Step 4 → content/main_entrance.ts
  新增 3 个消息处理器
  验证：在 X 页面 console 手动 sendMessage 测试

Step 5 → service_work/background.ts
  新增 payload 接口、3 个 handler 函数、注册到 localBridge
  验证：通过 WebSocket 客户端发送 request.query_followers 并收到响应

Step 6 → 端到端验证（见下方）
```

---

## 七、端到端验证方案

### 验证消息格式

通过 WebSocket 向插件发送（以 `query_followers` 为例）：

```json
{
  "id": "test-001",
  "type": "request.query_followers",
  "source": "LocalBridgeMac",
  "target": "tweetClaw",
  "timestamp": 1716000000000,
  "payload": {
    "userId": "44196397",
    "count": 20
  }
}
```

期望收到：

```json
{
  "id": "test-001",
  "type": "response.query_followers",
  "source": "tweetClaw",
  "target": "LocalBridgeMac",
  "payload": {
    "success": true,
    "data": { ... }  // X 原始 GraphQL 响应
  }
}
```

### 翻页验证

确认响应中包含 `nextCursor`，并在下次请求中作为 `cursor` 参数传入，验证翻页正常工作。

### 注意事项

- **userId 来源**：需先通过 `query_user_profile` 或 `x_basic_info` 获取目标用户的数字 ID（如 `"44196397"`），不能使用 `@screenName`。
- **`BlueVerifiedFollowers` QueryID**：初次使用需在真实 X 环境中触发一次该接口，让 injection 自动收割正确的 QueryID，替换掉 `defaultQueryKeyMap` 中的初始值。
- **频率限制**：X 对关注列表接口有速率限制，测试时避免短时间内大量翻页。

---

## 八、变更量汇总

| 文件 | 变更类型 | 估计行数 |
|---|---|---|
| `capture/consts.ts` | 新增 2 行 | ~2 |
| `x_api/twitter_api.ts` | 不改动 | 0 |
| `content/main_entrance.ts` | 新增 3 个消息处理器 | ~45 |
| `service_work/background.ts` | 新增 3 个类型 + 3 个函数 + 3 行注册 | ~75 |
| `bridge/ws-protocol.ts` | 新增消息类型 + 接口 | ~30 |
| `bridge/local-bridge-socket.ts` | 新增属性声明 + case 分支 | ~12 |
| **合计** | | **~164 行** |

所有改动均为**纯新增**，不修改任何已有逻辑，零破坏性风险。
