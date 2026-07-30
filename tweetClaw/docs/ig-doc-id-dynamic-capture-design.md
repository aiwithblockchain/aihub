# Instagram GraphQL doc_id 动态捕获系统

> 状态：设计稿（待实现）
> 日期：2026-07-30
> 目标：彻底根治所有 Instagram GraphQL API 的 `doc_id` 硬编码过期问题
> 架构决策：
> - **复用现有 `src/capture/injection.ts`**（不新建文件），在其中增加 Instagram `/graphql/` 分支，按 hostname 隔离，Twitter 行为零影响。
> - **缓存存 `sessionStorage`**（不存 `chrome.storage.local`）。理由：doc_id 绑定前端部署版本、per-tab-session 临时态，页面刷新后由 IG 前端请求自动回填，不跨账号/跨 tab 串味；page world 与 content script 同源共享存储，`getDocId` 可同步直读，无需 background 转发。

---

## 1. 问题陈述

### 1.1 现状

Instagram Web 使用 **Persisted GraphQL** 机制：客户端不发送完整查询文本，而是发送一个 `doc_id`（持久化查询标识符）+ `fb_api_req_friendly_name`（查询友好名）。服务端根据 `doc_id` 查找预注册的查询并执行。

问题在于：**Instagram 会定期轮换 `doc_id`**。前端发版后，旧的 `doc_id` 会被废弃，服务端返回：

```json
{ "errors": [{ "message": "field_exception", "code": 1675030 }] }
```

当前 tweetClaw 代码里 **所有 `doc_id` 都是硬编码**，一旦 Instagram 轮换，全部 API 同时失效，必须人工抓包更新——这不可持续。

### 1.2 受影响的 doc_id 清单（11 个 friendly_name）

| # | friendly_name | 当前硬编码 doc_id | 用途 | 定义位置 |
|---|---|---|---|---|
| 1 | `PolarisSearchBoxRefetchableQuery` | `26841114978842944` | 用户搜索 | `graphql-helper.ts` GRAPHQL_QUERIES.SEARCH_USERS |
| 2 | `PolarisFeedRootPaginationCachedQuery_subscribe` | `27274534238909635` | 首页 Feed | GRAPHQL_QUERIES.HOME_FEED |
| 3 | `PolarisPostRootQuery` | `26713194205046842` | 媒体详情 | GRAPHQL_QUERIES.MEDIA_INFO |
| 4 | `PolarisActivityFeedStoriesViewQuery` | `36796401869973287` | 活动通知 | GRAPHQL_QUERIES.ACTIVITY_FEED |
| 5 | `PolarisProfilePageContentQuery` | `26672929172408668` | 用户主页 | GRAPHQL_QUERIES.USER_PROFILE |
| 6 | `usePolarisLikeMediaXIGLikeMutation` | `27182485238052618` | 点赞 | `ig_api.ts:797` |
| 7 | `usePolarisLikeMediaXIGUnlikeMutation` | `26662414810082851` | 取消点赞 | `ig_api.ts:870` |
| 8 | `usePolarisFollowMutation` | `26508036048874888` | 关注 | `ig_api.ts:936` |
| 9 | `usePolarisUnfollowMutation` | `27789106940691111` | 取消关注 | `ig_api.ts:1006` |
| 10 | `PolarisProfilePostsQuery` | `27769721232718994` | 用户作品第 1 页 | `ig_api.ts:2255` |
| 11 | `PolarisProfilePostsTabContentQuery_connection` | `36843822688595799` | 用户作品翻页 | `ig_api.ts:2256` |

> 注：`ig_api.ts:2246-2247` 的注释里写的 doc_id（`27378030181834840` / `27839684308962379`）与代码实际使用的值（`27769721232718994` / `36843822688595799`）不一致——注释已过期，以代码为准。这恰恰说明了硬编码维护的困难。

### 1.3 为什么不能靠抓包更新

- Instagram 轮换周期不固定，可能几周一次也可能几天一次
- 11 个 doc_id 分散在 2 个文件，容易遗漏
- 抓包需要登录态、特定页面、特定操作触发，成本高
- 失效后无降级——API 直接报错，业务中断

### 1.4 instagrapi 不可直接参考

`/Users/hyperorchid/aiwithblockchain/aihub/instagrapi` 中的 `doc_id` 同样是硬编码（见 `mixins/public.py:public_doc_id_graphql_request`、`mixins/graphql.py` 各 `client_doc_id=` 默认值），**并没有动态获取/刷新 doc_id 的逻辑**。它走的是移动端 `i.instagram.com/api/` 私有 API + 移动 session 认证，与 tweetClaw 的 Web session 体系不兼容。因此本方案不参考 instagrapi，而是从浏览器自身请求中被动捕获。

---

## 2. 架构

### 2.1 核心思路

**浏览器自己就是 doc_id 的权威来源。** Instagram 前端每次发起 GraphQL 请求时，请求体里就带着 `doc_id` + `fb_api_req_friendly_name`。我们只要在页面上下文 hook `fetch`/`XHR`，拦截 Instagram 自己发出的 `/graphql/query` 和 `/api/graphql` 请求，解析出 `(friendly_name → doc_id)` 映射，写入 `sessionStorage`，供扩展自己的 API 调用读取即可。

这彻底反转了依赖关系：
- **旧**：扩展硬编码 doc_id → Instagram 轮换 → 失效
- **新**：Instagram 前端发请求 → injection 拦截记录到 sessionStorage → 扩展用最新 doc_id 发自己的请求

### 2.2 为什么复用 `injection.ts`

现有 `src/capture/injection.ts` 已经是一个通用的 page-world fetch/XHR hook 框架（patchFetch + patchXHR + watchdog 自愈），目前仅由 Twitter 的 `main_entrance.ts` 注入。它的 `isTargetUrl` 匹配的是 Twitter `watchedOps`，对 IG 的 `/graphql/` URL 会返回 null 直接放行——天然不会误触发 Twitter 逻辑。

因此最省改动、最易维护的做法是：**在同一个 `injection.ts` 里增加一个 IG 分支**，按 `location.hostname` 判断是否在 instagram.com，若是则额外解析 IG GraphQL 请求体并写 sessionStorage。Twitter 分支完全不受影响。

### 2.3 为什么用 sessionStorage

| 维度 | sessionStorage | chrome.storage.local |
|---|---|---|
| 作用域 | per-tab、per-origin | 跨 tab、跨窗口共享 |
| 页面刷新 | **保留**（同 tab reload / 导航不丢） | 保留 |
| 关 tab | 清空 | 保留 |
| 读写 | 同步（`getItem`/`setItem`） | 异步（`chrome.storage.local.get`） |
| page world ↔ content script | **同源共享**，双方直读直写 | 需 chrome.runtime 消息转发 |
| 跨账号串味风险 | 无（per-tab） | 有（需手动清理） |

doc_id 绑定 Instagram Web 前端部署版本，本质是 per-tab-session 的临时态：用户在某个 IG tab 里，前端发的 doc_id 就是该 tab 当下有效的。用 sessionStorage：
- **不跨账号串味**：不同 IG 账号的 tab 各自独立
- **刷新自动回填**：主页刷新 alarm reload tab → sessionStorage 保留 → 新页面 IG 前端再发 GraphQL 请求 → injection 用最新 doc_id 覆盖写入
- **同步直读**：`graphql-helper.ts` 的 `getDocId()` 同步读 sessionStorage，调用点无需 `await`，`buildGraphQLBody` 签名与调用方式零改动
- **无需 background 参与**：没有 `chrome.runtime.sendMessage`，没有 SW 休眠丢消息问题

### 2.4 数据流

```
┌─────────────────────────────────────────────────────────────────┐
│  Instagram 前端 (页面上下文, MAIN world)                          │
│  发起 /graphql/query 或 /api/graphql 请求                        │
│  body 含 fb_api_req_friendly_name + doc_id                       │
└──────────────────┬──────────────────────────────────────────────┘
                   │ fetch / XHR
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  injection.ts (MAIN world, 复用现有文件, 新增 IG 分支)            │
│  patchFetch / patchXHR                                          │
│  if hostname ∈ instagram.com && url matches /graphql/:          │
│    extractMapping(body) → { friendlyName, docId }               │
│    sessionStorage.setItem('ig_doc_id_map', JSON.stringify(map)) │
└──────────────────┬──────────────────────────────────────────────┘
                   │ sessionStorage（同源共享，同步）
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  graphql-helper.ts getDocId(friendlyName, fallback)             │
│  (运行在 content script isolated world, 与 page 同源共享 storage)│
│  1. 读 sessionStorage.ig_doc_id_map → 解析 → 查 friendlyName     │
│  2. 命中且 ts 新鲜 (< 6h) → 返回动态 doc_id                      │
│  3. 未命中 → 返回 fallbackDocId (GRAPHQL_QUERIES 硬编码兜底)      │
│  → 同步返回，调用方无需 await                                    │
└─────────────────────────────────────────────────────────────────┘
```

**没有 background.ts 的参与**——这是 sessionStorage 方案相比 storage.local 方案的核心简化。

### 2.5 为什么利用主页刷新机制

`background.ts` 已有 per-platform alarm（见 `docs/home-refresh-per-platform-alarm.md`，90–120 分钟随机间隔），会刷新非活跃 IG tab 到 `https://www.instagram.com/`。刷新后 Instagram 前端会自动发起一批 GraphQL 请求（首页 feed、活动通知、用户资料等），这些请求**天然携带最新的 doc_id**。因此：

- **无需用户手动操作**——alarm 自动触发刷新 → injection 自动覆盖写入 sessionStorage
- **覆盖面广**——主页加载会触发多个 friendly_name 的请求
- **周期性自愈**——即使 doc_id 被轮换，最多 90-120 分钟后自动捕获新值
- **sessionStorage 在 reload 中保留**：刷新不会清空缓存，新捕获只会覆盖更新 `ts`

对于主页刷新不会触发的 friendly_name（如搜索、点赞、关注等用户操作型 API），采用：
- **被动捕获**：用户在浏览器里自然操作时拦截
- **硬编码兜底**：动态缓存未命中时回退到当前硬编码值
- **主动自愈**（§5）：API 报 field_exception 时触发一次主页刷新重试

---

## 3. 实现细节

### 3.1 修改 `src/capture/injection.ts`：增加 IG doc_id 捕获分支

在现有 `patchFetch` / `patchXHR` 内部，**在 Twitter `isTargetUrl` 判断之外**，增加一个 IG 分支。IG 分支按 hostname 隔离，不会影响 Twitter 逻辑。

新增辅助函数与 IG 分支代码：

```typescript
// ===== Instagram doc_id 动态捕获（方案核心）=====
// 仅在 instagram.com 域名下激活；Twitter 页面 hostname 不匹配，零影响。
const IG_GRAPHQL_URL_PATTERN = /instagram\.com\/(api\/)?graphql\//i;
const IG_DOC_ID_STORAGE_KEY = 'ig_doc_id_map';
const IG_DOC_ID_TTL_MS = 6 * 60 * 60 * 1000; // 6h 新鲜度窗口

function isIgContext(): boolean {
    return /(^|\.)instagram\.com$/i.test(location.hostname);
}

function extractIgDocIdMapping(body: any): { friendlyName: string; docId: string } | null {
    if (!body) return null;
    let fn: string | undefined;
    let did: string | undefined;
    if (typeof body === 'string') {
        // IG GraphQL 用 application/x-www-form-urlencoded
        try {
            const params = new URLSearchParams(body);
            fn = params.get('fb_api_req_friendly_name') || undefined;
            did = params.get('doc_id') || undefined;
        } catch {}
    } else if (body instanceof FormData) {
        fn = (body.get('fb_api_req_friendly_name') as string) || undefined;
        did = (body.get('doc_id') as string) || undefined;
    } else if (typeof body === 'object') {
        fn = body.fb_api_req_friendly_name || body.friendly_name;
        did = body.doc_id || body.docId;
    }
    if (fn && did) return { friendlyName: fn, docId: did };
    return null;
}

function storeIgDocId(mapping: { friendlyName: string; docId: string }): void {
    try {
        const raw = sessionStorage.getItem(IG_DOC_ID_STORAGE_KEY);
        const map = raw ? JSON.parse(raw) : {};
        map[mapping.friendlyName] = { docId: mapping.docId, ts: Date.now() };
        sessionStorage.setItem(IG_DOC_ID_STORAGE_KEY, JSON.stringify(map));
        console.log(`🛡️ [IG-DocId] captured ${mapping.friendlyName} → ${mapping.docId}`);
    } catch (e) {
        console.warn('🛡️ [IG-DocId] store failed', e);
    }
}

function tryCaptureIgDocId(url: string, body: any): void {
    if (!isIgContext()) return;
    if (!IG_GRAPHQL_URL_PATTERN.test(url)) return;
    const m = extractIgDocIdMapping(body);
    if (m) storeIgDocId(m);
}
```

在 `patchFetch` 的 fetch hook 内，**在 `targetOp` 判断之前**插入 IG 捕获（IG 页面不会有 Twitter targetOp，互斥）：

```typescript
window.fetch = async function (...args: any[]) {
    const reqArg = args[0];
    const initArg = args[1];
    const url = typeof reqArg === 'string'
        ? reqArg
        : (reqArg instanceof Request ? reqArg.url : String(reqArg));
    // ... 现有 method/body 计算 ...

    // ===== IG doc_id 捕获（新增）=====
    if (isIgContext() && IG_GRAPHQL_URL_PATTERN.test(url)) {
        try {
            let bodyForIg = initArg?.body;
            if (!bodyForIg && reqArg instanceof Request) {
                bodyForIg = await reqArg.clone().text();
            }
            tryCaptureIgDocId(url, bodyForIg);
        } catch (e) {
            console.warn('🛡️ [IG-DocId] fetch extract error', e);
        }
        // IG 页面无需走 Twitter targetOp 分支，直接放行
        return orgFetch.apply(this, args as any);
    }

    // ===== 以下为原有 Twitter 逻辑，保持不变 =====
    const targetOp = isTargetUrl(url);
    if (!targetOp) { ... }
    ...
};
```

在 `patchXHR` 的 `send` 内同样插入：

```typescript
send(b?: any) {
    try {
        if (isIgContext() && IG_GRAPHQL_URL_PATTERN.test((this as any).__tc_url || '')) {
            tryCaptureIgDocId((this as any).__tc_url, b);
        }
    } catch (e) {
        console.warn('🛡️ [IG-DocId] xhr extract error', e);
    }
    // ... 原有 Twitter 拦截逻辑不变 ...
    return super.send(b);
}
```

**注意**：IG 分支只解析请求体里的 `fb_api_req_friendly_name` + `doc_id` 两个字段，不读响应体、不读 cookie、不记录 variables，开销 < 1ms/请求。

### 3.2 修改 `src/content/ig-main-entrance.ts`：注入 injection.js

当前 `ig-main-entrance.ts` 没有注入任何 page-world 脚本。仿照 Twitter `main_entrance.ts` 的 `inject()` 模式，在文件顶部注入同一个 `js/injection.js`：

```typescript
// 注入 page-world fetch/XHR hook（复用 Twitter 的 injection.js，内含 IG doc_id 捕获分支）
(function injectIgInjury() {
    if (document.getElementById('tc_injection')) return;
    const script = document.createElement('script');
    script.id = 'tc_injection';
    script.src = chrome.runtime.getURL('js/injection.js');
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();
})();
```

**无需新增 message 监听**：IG doc_id 捕获直接写 sessionStorage，`graphql-helper.ts` 同步直读，不需要 `window.postMessage` → `chrome.runtime.sendMessage` → background 这条链路。

`manifest.json` 的 `web_accessible_resources` 已经暴露 `js/injection.js`（Twitter 在用），无需修改。`webpack.config.js` 的 `injection` entry 已存在，无需修改。

### 3.3 修改 `src/ig_api/graphql-helper.ts`：新增同步 `getDocId`

```typescript
const IG_DOC_ID_STORAGE_KEY = 'ig_doc_id_map';
const IG_DOC_ID_TTL_MS = 6 * 60 * 60 * 1000; // 6h

/**
 * 动态获取 doc_id（方案核心，同步）
 *
 * 1. 读 sessionStorage.ig_doc_id_map（由 injection.ts 在 page world 写入，
 *    content script 同源共享），命中且 ts 新鲜 (< 6h) → 返回动态 doc_id
 * 2. 未命中 / 陈旧 / 读取异常 → 返回 fallbackDocId
 *
 * 同步签名：sessionStorage.getItem 同步返回，调用方无需 await，
 * buildGraphQLBody 调用方式零改动。
 *
 * @param friendlyName  GraphQL friendly_name（如 'PolarisSearchBoxRefetchableQuery'）
 * @param fallbackDocId GRAPHQL_QUERIES.X.docId 硬编码兜底值
 */
export function getDocId(friendlyName: string, fallbackDocId: string): string {
    try {
        const raw = sessionStorage.getItem(IG_DOC_ID_STORAGE_KEY);
        if (!raw) return fallbackDocId;
        const map = JSON.parse(raw) as Record<string, { docId: string; ts: number }>;
        const entry = map[friendlyName];
        if (entry && entry.docId && (Date.now() - entry.ts) < IG_DOC_ID_TTL_MS) {
            return entry.docId;
        }
    } catch (e) {
        console.warn('[IG GraphQL] getDocId sessionStorage read failed', e);
    }
    return fallbackDocId;
}
```

**保留 `GRAPHQL_QUERIES` 常量**：不再作为主 doc_id 来源，而是作为 `fallbackDocId` 兜底值。冷启动（sessionStorage 空）时仍能尝试用旧值。

### 3.4 修改 `src/ig_api/ig_api.ts`：11 个调用点改用 `getDocId`

**原则**：每个调用点把硬编码 `docId` 常量改为 `getDocId('FRIENDLY_NAME', FALLBACK_CONST)`。因为 `getDocId` 是**同步**的，调用它的函数不需要改成 async（绝大多数已经是 async，但无需为此新增 await）。

示例（搜索方法，约 `ig_api.ts:384`）：

```typescript
// 修改前
const body = buildGraphQLBody(
    GRAPHQL_QUERIES.SEARCH_USERS.queryName,
    GRAPHQL_QUERIES.SEARCH_USERS.docId,
    variables,
    fbDtsg,
    ...
);

// 修改后
const body = buildGraphQLBody(
    GRAPHQL_QUERIES.SEARCH_USERS.queryName,
    getDocId(GRAPHQL_QUERIES.SEARCH_USERS.queryName, GRAPHQL_QUERIES.SEARCH_USERS.docId),
    variables,
    fbDtsg,
    ...
);
```

**11 个调用点清单**（按 §1.2 表格顺序）：

| # | 位置 | friendly_name | fallback doc_id |
|---|---|---|---|
| 1 | `ig_api.ts:303` USER_PROFILE | `PolarisProfilePageContentQuery` | `GRAPHQL_QUERIES.USER_PROFILE.docId` |
| 2 | `ig_api.ts:385` SEARCH_USERS | `PolarisSearchBoxRefetchableQuery` | `GRAPHQL_QUERIES.SEARCH_USERS.docId` |
| 3 | `ig_api.ts:475` HOME_FEED | `PolarisFeedRootPaginationCachedQuery_subscribe` | `GRAPHQL_QUERIES.HOME_FEED.docId` |
| 4 | `ig_api.ts:563` MEDIA_INFO | `PolarisPostRootQuery` | `GRAPHQL_QUERIES.MEDIA_INFO.docId` |
| 5 | `ig_api.ts:797` Like | `usePolarisLikeMediaXIGLikeMutation` | `27182485238052618` |
| 6 | `ig_api.ts:870` Unlike | `usePolarisLikeMediaXIGUnlikeMutation` | `26662414810082851` |
| 7 | `ig_api.ts:936` Follow | `usePolarisFollowMutation` | `26508036048874888` |
| 8 | `ig_api.ts:1006` Unfollow | `usePolarisUnfollowMutation` | `27789106940691111` |
| 9 | `ig_api.ts:2255` ProfilePosts 第 1 页 | `PolarisProfilePostsQuery` | `27769721232718994` |
| 10 | `ig_api.ts:2256` ProfilePosts 翻页 | `PolarisProfilePostsTabContentQuery_connection` | `36843822688595799` |
| 11 | `ig_api.ts:2630` ACTIVITY_FEED | `PolarisActivityFeedStoriesViewQuery` | `GRAPHQL_QUERIES.ACTIVITY_FEED.docId` |

> 第 9、10 项在 `ig_api.ts:2251-2257` 是一个三元表达式同时选 `queryName` 和 `docId`，改为：
> ```typescript
> const queryName = hasAfter ? 'PolarisProfilePostsTabContentQuery_connection' : 'PolarisProfilePostsQuery';
> const fallbackDocId = hasAfter ? '36843822688595799' : '27769721232718994';
> const docId = getDocId(queryName, fallbackDocId);
> ```
> 同时建议顺手修正 `ig_api.ts:2246-2247` 那两条已过期的注释（与代码实际值不一致），避免后续维护者困惑——这属于本次改动的直接关联清理。

### 3.5 `buildGraphQLBody` 签名不变

`buildGraphQLBody(queryName, docId, variables, fbDtsg, crn)` 保持同步签名——调用方在调用前先 `getDocId(...)` 拿到 docId，再传入。`getDocId` 同步，所以调用方无需 await，改动面最小。

---

## 4. 主页刷新机制的协同

### 4.1 现有机制（无需修改）

`background.ts:300-450` 已实现（见 `docs/home-refresh-per-platform-alarm.md`）：
- 3 个独立 alarm（twitter/instagram/xiaohongshu），90-120 分钟随机间隔
- 触发时调用 `refreshSinglePlatformHome(platform)` 刷新非活跃 tab 到主页
- IG 主页 URL：`https://www.instagram.com/`

刷新后 Instagram 前端加载，自动发起 GraphQL 请求（至少包含 HOME_FEED、ACTIVITY_FEED、USER_PROFILE 等 friendly_name），injection 脚本拦截并覆盖写入 sessionStorage。

### 4.2 sessionStorage 在 reload 中的行为

关键语义（W3C spec）：**sessionStorage 在同一 tab 内跨 reload 和同 tab 导航保留，仅在 tab 关闭时清空。** 因此：
- 主页刷新 alarm reload IG tab → sessionStorage 不丢 → 新页面 IG 前端发 GraphQL 请求 → injection 用最新 doc_id 覆盖写入（更新 `ts`）
- 用户在 IG tab 内导航（主页 → 个人页 → 媒体详情）→ sessionStorage 持续累积不同 friendly_name 的映射
- 关 tab 再开 → sessionStorage 为空 → 冷启动走 fallback，随后被动/主动捕获回填

### 4.3 被动覆盖的 friendly_name

主页加载天然覆盖：
- `PolarisFeedRootPaginationCachedQuery_subscribe`（首页 feed）
- `PolarisActivityFeedStoriesViewQuery`（活动通知）
- `PolarisProfilePageContentQuery`（用户主页组件）
- `PolarisPostRootQuery`（若有媒体卡片）

用户操作时被动覆盖：
- `PolarisSearchBoxRefetchableQuery`（用户在 IG 搜索框输入）
- `usePolarisFollowMutation` / `usePolarisUnfollowMutation`（关注/取关）
- `usePolarisLikeMediaXIGLikeMutation` / `usePolarisLikeMediaXIGUnlikeMutation`（点赞）
- `PolarisProfilePostsQuery` / `PolarisProfilePostsTabContentQuery_connection`（浏览用户作品）

### 4.4 冷启动策略

首次安装/启动或刚开新 tab 时 sessionStorage 为空：
1. 所有 API 用硬编码 fallback doc_id（可能已过期）
2. 若 fallback 也失效（field_exception），调用方触发一次主页刷新（见 §5.2）
3. 主页刷新后 sessionStorage 填充，重试调用

---

## 5. 错误处理与自愈

### 5.1 field_exception 检测

在 `ig_api.ts` 的 GraphQL 响应处理中，统一检测 `field_exception` / code `1675030`：

```typescript
if (resp?.errors?.some(e => e.code === 1675030 || e.message === 'field_exception')) {
    // doc_id 可能过期
    // 1. 清除该 friendly_name 的 sessionStorage 条目（强制下次用 fallback 或重新捕获）
    // 2. 触发主页刷新（若当前 tab 非活跃）
    // 3. 抛出明确错误，让上层决定是否重试
}
```

清除 sessionStorage 条目的辅助函数（可放 `graphql-helper.ts`）：

```typescript
export function invalidateDocId(friendlyName: string): void {
    try {
        const raw = sessionStorage.getItem(IG_DOC_ID_STORAGE_KEY);
        if (!raw) return;
        const map = JSON.parse(raw);
        delete map[friendlyName];
        sessionStorage.setItem(IG_DOC_ID_STORAGE_KEY, JSON.stringify(map));
    } catch {}
}
```

### 5.2 主动自愈流程

```
API 调用 → field_exception
  → invalidateDocId(friendlyName)            // 清 sessionStorage 该条目
  → 若 IG tab 非活跃: chrome.tabs.update(tabId, { url: homeUrl })  // 触发刷新
  → 等待 8-15s（页面加载 + IG 前端 GraphQL 请求被 injection 拦截写入 sessionStorage）
  → 重新查 sessionStorage: 若命中新 doc_id → 用新 doc_id 重试一次
  → 仍失败 → 抛错给上层
```

> 注：主动自愈需要 content script 主动触发 tab 刷新，可通过 `chrome.runtime.sendMessage` 请求 background 执行 `chrome.tabs.update`（这条消息只在实际报错时发一次，不涉及常态存储转发，不影响 sessionStorage 方案的简化优势）。

### 5.3 缓存新鲜度

- TTL = 6 小时：超过 6h 的 sessionStorage 条目视为陈旧，`getDocId` 回退到 fallback
- 主页刷新周期 = 90-120 分钟：远小于 TTL，保证活跃条目持续刷新
- 每次捕获都更新 `ts`：即使 friendly_name 相同，新捕获的时间戳延长新鲜度

---

## 6. 安全与隐私

- **hostname 隔离**：IG 分支只在 `location.hostname` 匹配 `instagram.com` 时激活，Twitter / XHS 页面零影响
- **只拦截 instagram.com 域名的 `/graphql/` 请求**：URL 正则严格匹配
- **只提取 friendly_name + doc_id**：不记录 variables、不记录响应体、不记录 cookie
- **存储在 sessionStorage**：per-tab、不跨设备同步、tab 关闭即清空、不上传任何远端
- **注入脚本无外部通信**：只写本页 sessionStorage，不发起任何网络请求、不 postMessage 出页

---

## 7. 实现步骤（建议顺序）

1. **修改 `src/capture/injection.ts`** 增加 IG 分支（`isIgContext` + `extractIgDocIdMapping` + `storeIgDocId` + fetch/XHR hook 插入点）→ 验证：在 IG 页面 console 手动执行等价逻辑，检查 `sessionStorage.ig_doc_id_map` 出现条目
2. **修改 `src/content/ig-main-entrance.ts`** 注入 `js/injection.js` → 验证：IG 页面加载后 console 出现 `🛡️ [IG-DocId] captured ...` 日志
3. **修改 `src/ig_api/graphql-helper.ts`** 新增同步 `getDocId()` + `invalidateDocId()` → 验证：单元调用返回 fallback 或 sessionStorage 缓存值
4. **修改 `src/ig_api/ig_api.ts`** 11 个调用点改用 `getDocId`，顺手修正 `2246-2247` 过期注释 → 验证：每个 API 仍可正常调用
5. **修改 `src/ig_api/ig_api.ts`** field_exception 检测 + `invalidateDocId` + 自愈刷新 → 验证：模拟过期触发刷新重试
6. **构建 + 端到端测试**：`npm run build` → 加载扩展 → 浏览 IG → 调用 `window.igApi.search(...)` 等接口

> 无需修改 `manifest.json`（`web_accessible_resources` 已含 `js/injection.js`）、无需修改 `webpack.config.js`（`injection` entry 已存在）、无需修改 `background.ts`（常态不参与；仅自愈刷新时复用现有 tab 刷新能力）。

---

## 8. 风险与取舍

| 风险 | 缓解 |
|---|---|
| Instagram 改用非 `/graphql/` 路径 | 正则 `instagram\.com\/(api\/)?graphql\/` 已覆盖 `/graphql/query` 与 `/api/graphql` 两种现有路径 |
| 请求体非 form-urlencoded | `extractIgDocIdMapping` 支持 string(URLSearchParams)/FormData/object 三种格式，覆盖现有所有形态 |
| 主页刷新不触发某些 friendly_name | 硬编码 fallback 兜底 + 用户操作被动捕获 + §5.2 主动自愈 |
| sessionStorage 被页面其他脚本覆盖 key | key 名 `ig_doc_id_map` 足够专有；JSON.parse 失败时 `getDocId` 异常 catch 回退 fallback |
| 关 tab 后缓存丢失 | 符合设计：per-tab 临时态，重开 tab 走 fallback + 被动回填，不构成数据损坏 |
| 注入脚本被 CSP 拦截 | IG 主页 CSP 允许同源 script；`web_accessible_resources` 已配置（Twitter 在用，验证可行） |
| 性能开销 | 拦截只解析 body 两个字段，不读响应体，开销 < 1ms/请求 |
| Twitter 与 IG 共用 injection.js 的耦合 | hostname 隔离 + 互斥分支（IG 页面无 Twitter targetOp），逻辑解耦；若未来要彻底拆分可再分文件 |

---

## 9. 不做的事（明确排除）

- **不新建 `ig-injection.ts`**：复用现有 `injection.ts`，hostname 隔离加 IG 分支
- **不用 `chrome.storage.local`**：sessionStorage 同步直读、per-tab 不串味、无需 background 转发
- **不抓包移动端 API / 不参考 instagrapi 的 doc_id**：instagrapi 同样硬编码 doc_id 且走移动私有 API，与 Web session 体系不兼容
- **不实现 webRequest 拦截**：MV3 `webRequest` 权限受限，且 injection 脚本已足够
- **不主动构造 GraphQL 请求去探测 doc_id**：这会暴露扩展指纹，只被动拦截浏览器自身请求
- **不修改 `buildGraphQLBody` 签名**：保持同步，调用方负责 `getDocId`（同步，无需 await）
- **不修改 `manifest.json` / `webpack.config.js`**：复用现有 `injection` entry 与 `web_accessible_resources`

---

## 10. 验收标准

- [ ] 浏览 IG 主页 30s 内，`sessionStorage.ig_doc_id_map` 至少包含 3 个 friendly_name
- [ ] `window.igApi.search(...)` 调用使用动态捕获的 doc_id，搜索结果正常返回
- [ ] 手动篡改 sessionStorage 中某 doc_id 为无效值 → 调用对应 API → 触发 field_exception → 自动刷新 → 重试成功
- [ ] 清空 sessionStorage → 冷启动 → 所有 API 用 fallback 值仍可调用（若 fallback 未过期）
- [ ] 主页刷新 alarm 触发后，sessionStorage 中至少 1 个 friendly_name 的 `ts` 被更新
- [ ] Twitter / XHS 页面行为零变化（hostname 隔离验证）
- [ ] 无任何 console error 与本方案相关
