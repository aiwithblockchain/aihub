# 小红书签名架构重构计划

> **背景：** 当前实现依赖拦截 homefeed 请求来捕获动态签名头（x-s / x-t / x-s-common / x-rap-param），
> 实测效果差，用户必须先手动刷新首页才能触发签名捕获，体验与推特侧有显著差距。
>
> **目标：** 改为本地生成签名，彻底消灭"先热身才能调用"的前置依赖，使小红书操作体验与推特对齐。

---

## 一、核心思路

社区项目 [cv-cat/Spider_XHS](https://github.com/cv-cat/Spider_XHS)（6k star，2026年4月仍在更新）
已逆向出小红书 Web 端完整签名算法，以 JS 文件形式开源：

| JS 文件 | 用途 | 生成的签名头 |
|---------|------|------------|
| `xhs_main_260411.js` | PC 端签名算法 | `x-s` / `x-t` / `x-s-common` |
| `xhs_creator_260411.js` | 创作者端签名算法 | `x-s` / `x-t` / `x-s-common`（creator 上下文） |
| `xhs_rap.js` | JSVMP 风控参数 | `x-rap-param` |
| `xhs_xray.js` | Xray 链路追踪 | `x-xray-traceid` |

调用接口极为简洁，只需提供 `a1` cookie + 接口路径 + 请求体：

```javascript
// PC 端
const { xs, xt, xs_common } = get_request_headers_params(api_path, body_str, a1, method);

// creator 端（独立签名上下文）
const { xs, xt, xs_common } = get_creator_headers_params(api_path, body_str, a1, method);
```

`a1` 是小红书设备指纹 cookie，生命周期数月，Chrome 扩展可直接通过
`chrome.cookies.get({ url: 'https://www.xiaohongshu.com', name: 'a1' })` 读取，
**无需任何用户操作触发。**

---

## 二、现状 vs 目标对比

| 维度 | 当前实现 | 重构后 |
|------|---------|--------|
| 签名获取方式 | 拦截 homefeed 请求被动捕获 | 本地 JS 主动计算 |
| 调用前提 | 用户须先刷新 www.xiaohongshu.com 首页 | 只需已登录（有 a1 cookie）|
| creator 签名前提 | 用户须先访问 creator.xiaohongshu.com | 同上，一个 a1 搞定 |
| 签名有效期 | 30s TTL（homefeed）/ 60s TTL（creator） | 无 TTL，每次调用即时计算 |
| 热身等待时间 | 最长 30s | 0s |
| 签名失败率 | 高（TTL 超期、用户未刷页面） | 接近 0 |
| 维护成本 | 无需跟进签名算法更新 | 跟进 Spider_XHS 更新 JS 文件 |

---

## 三、要删除的代码（废弃清单）

### 3.1 `src/platforms/xiaohongshu/xhs-injection.ts` — 整文件废弃

当前职责：注入页面上下文，拦截 fetch / XHR，捕获签名头。
重构后：签名本地计算，不再需要拦截任何请求。

**删除：**
- 整个文件（约 313 行）
- `dist/js/xhs-injection.js`（编译产物）

---

### 3.2 `src/content/xhs-main-entrance.ts` — 大幅简化

**删除的逻辑：**

```typescript
// ── 删除：注入脚本加载 ──────────────────────────────────────────
(function inject() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('js/xhs-injection.js');
  document.head.appendChild(script);
})();

// ── 删除：监听 xhsclaw-injection 消息并写入 storage ───────────────
window.addEventListener('message', (event) => {
  if (event.data?.source !== 'xhsclaw-injection') return;
  // XHS_SIGNAL_CAPTURED → 写消费端签名头到 storage
  // XHS_CREATOR_SIGNAL_CAPTURED → 写 creator 签名头到 storage
});
```

**保留的逻辑：**
- `chrome.runtime.onMessage` 监听器中的所有业务消息处理（EXECUTE_ACTION、FETCH_NOTE 等）
- `XHS_PING` / `XHS_SCROLL_PAGE` 辅助消息

---

### 3.3 `src/service_work/background.ts` — 删除热身机制

**删除的函数（约 200 行）：**

```typescript
// 消费端热身
const XHS_HOMEFEED_URL = '...';
const XHS_HOMEFEED_WARMUP_TTL_MS = 30_000;
let xhsHomefeedWarmupPromise: Promise<number> | null = null;
async function findOrCreateXhsTab(): Promise<chrome.tabs.Tab>
async function navigateXhsTabToHomefeed(tabId: number): Promise<void>
async function isXhsHomefeedContextFresh(): Promise<boolean>
async function waitForXhsHomefeedCapture(...): Promise<void>
async function ensureXhsHomefeedWarmContext(): Promise<number>

// creator 端热身
const XHS_CREATOR_URL = '...';
const XHS_CREATOR_WARMUP_TTL_MS = 60_000;
let xhsCreatorWarmupPromise: Promise<void> | null = null;
async function findOrCreateXhsCreatorTab(): Promise<chrome.tabs.Tab>
async function isXhsCreatorContextFresh(): Promise<boolean>
async function waitForXhsCreatorCapture(...): Promise<void>
async function ensureXhsCreatorContext(): Promise<void>
```

**同步删除：** 在 `queryXhsHomefeed` 等函数开头调用这些热身函数的代码行。

---

### 3.4 `src/platforms/xiaohongshu/xhs-api.ts` — 删除签名头读取逻辑

**删除的函数：**

```typescript
// 全部删除，替换为本地签名计算
async function getXhsHeaders(): Promise<Record<string, string>>
async function getXhsGetHeaders(): Promise<Record<string, string>>
async function ensureHomefeedDynamicHeaders(): Promise<void>
async function getHomefeedTemplate(): Promise<any>
async function getFeedTemplate(): Promise<any>

// creator 签名头管理（同样废弃）
export async function getXhsCreatorHeaders(): Promise<Record<string, string>>
export async function isXhsCreatorContextFresh(): Promise<boolean>
```

---

### 3.5 `src/platforms/xiaohongshu/xhs-consts.ts` — 清理 Storage Keys

**删除的 Storage Keys：**

```typescript
XHS_STORAGE_KEYS = {
  // 以下全部删除：
  XS_SIGN:             'xhs_xs_sign',
  XT:                  'xhs_xt',
  XS_COMMON:           'xhs_xs_common',
  RAP_PARAM:           'xhs_x_rap_param',
  B3_TRACEID:          'xhs_x_b3_traceid',
  XRAY_TRACEID:        'xhs_x_xray_traceid',
  XY_DIRECTION:        'xhs_xy_direction',
  HOMEFEED_TEMPLATE:   'xhs_homefeed_template',
  FEED_TEMPLATE:       'xhs_feed_template',
  CREATOR_XS_SIGN:     'xhs_creator_xs_sign',
  CREATOR_XT:          'xhs_creator_xt',
  CREATOR_XS_COMMON:   'xhs_creator_xs_common',
  CREATOR_CAPTURED_AT: 'xhs_creator_captured_at',

  // 保留：
  USER_ID:  'xhs_user_id',
  COOKIES:  'xhs_cookies',
}
```

**删除的消息类型：**

```typescript
XHS_MSG_TYPE = {
  // 删除：
  SIGNAL_CAPTURED:         'XHS_SIGNAL_CAPTURED',
  CREATOR_SIGNAL_CAPTURED: 'XHS_CREATOR_SIGNAL_CAPTURED',

  // 保留其余所有业务消息类型
}
```

---

### 3.6 `manifest.json` — 删除 content_scripts 和 web_accessible_resources

```json
// 删除 xhs-injection.js 的相关配置
"web_accessible_resources": [
  // 删除：{ "resources": ["js/xhs-injection.js"], ... }
]
```

---

## 四、新增代码

### 4.1 引入签名 JS 文件

从 `cv-cat/Spider_XHS` 的 `static/` 目录获取最新版本，放入：

```
src/platforms/xiaohongshu/sign/
├── xhs_main.js          ← PC 端签名（来自 xhs_main_260411.js）
├── xhs_creator.js       ← creator 端签名（来自 xhs_creator_260411.js）
├── xhs_rap.js           ← x-rap-param JSVMP
└── xhs_xray.js          ← x-xray-traceid 生成
```

---

### 4.2 新建 `xhs-sign.ts` — 签名生成模块

```typescript
// src/platforms/xiaohongshu/xhs-sign.ts

/**
 * 小红书本地签名模块
 *
 * 签名 JS 来源：cv-cat/Spider_XHS
 * 更新频率：跟随小红书 Web 端算法更新（约每季度一次）
 */

/** 从 chrome.cookies 获取 a1 */
async function getA1(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.cookies.get({ url: 'https://www.xiaohongshu.com', name: 'a1' }, (cookie) => {
      if (!cookie?.value) reject(new Error('a1 cookie not found. Please log in to xiaohongshu.com.'));
      else resolve(cookie.value);
    });
  });
}

/** 生成 PC 端完整签名头（edith.xiaohongshu.com） */
export async function buildXhsHeaders(
  apiPath: string,
  body: Record<string, any> | string | null,
  method: 'GET' | 'POST' = 'POST'
): Promise<Record<string, string>>

/** 生成 creator 端完整签名头（creator.xiaohongshu.com） */
export async function buildXhsCreatorHeaders(
  apiPath: string,
  body: Record<string, any> | string | null,
  method: 'GET' | 'POST' = 'POST'
): Promise<Record<string, string>>
```

---

### 4.3 修改 `xhs-api.ts` — 所有函数改用 `buildXhsHeaders`

重构前（以 `fetchXhsHomefeed` 为例）：

```typescript
// 旧：依赖 storage 中缓存的签名头
const headers = await getXhsHeaders();
await ensureHomefeedDynamicHeaders();
```

重构后：

```typescript
// 新：实时计算
const headers = await buildXhsHeaders(XHS_API_ENDPOINTS.HOMEFEED, body, 'POST');
```

涉及改动的函数（全部替换头部生成逻辑，其余不动）：
- `performXhsAction()`
- `fetchXhsFeed()`
- `fetchXhsNote()`
- `fetchXhsHomefeed()`
- `fetchXhsCurrentUser()`
- `searchXhsNotes()`
- `fetchXhsUserNotes()`
- `uploadXhsImage()`
- `createXhsNote()`

---

### 4.4 修改 `background.ts` — `queryXhsHomefeed` 等函数简化

删除热身调用后，这些函数只需：
1. 找到一个小红书标签页
2. 发消息给 content script
3. 返回结果

`queryXhsHomefeed` 无需热身，直接查找已打开的 XHS 标签页即可调用。
若无 XHS 标签页，抛出明确错误提示用户打开 xiaohongshu.com。

---

## 五、实施步骤

### Step 1：获取 & 验证签名 JS 文件

- [ ] 从 `cv-cat/Spider_XHS` `static/` 目录下载四个 JS 文件
- [ ] 写一个本地测试脚本，验证在 Node.js 中调用 `get_request_headers_params` 能生成有效签名
- [ ] 用生成的签名实际请求 `https://edith.xiaohongshu.com/api/sns/web/v1/homefeed`，确认返回 200

**验收标准：** 拿到一个有效的 `a1` cookie，本地能生成签名并成功调用 homefeed 接口。

---

### Step 2：实现 `xhs-sign.ts`

- [ ] 在 background service worker 环境中 bundle 并执行签名 JS（注意：service worker 无 `window` 对象，需补环境或用 `globalThis`）
- [ ] 实现 `getA1()`、`buildXhsHeaders()`、`buildXhsCreatorHeaders()`
- [ ] 单元测试：给定固定 `a1` + 路径 + 请求体，签名输出格式正确（`x-s` 非空、`x-t` 为数字字符串等）

**验收标准：** `buildXhsHeaders('/api/sns/web/v1/homefeed', body)` 返回包含所有必要签名头的对象。

---

### Step 3：重构 `xhs-api.ts`

- [ ] 将所有 API 函数的头部生成从 `getXhsHeaders()` / `getXhsGetHeaders()` 替换为 `buildXhsHeaders()`
- [ ] 删除 `getXhsHeaders`、`getXhsGetHeaders`、`ensureHomefeedDynamicHeaders`、`getHomefeedTemplate`、`getFeedTemplate` 五个函数
- [ ] 删除 `getXhsCreatorHeaders`、`isXhsCreatorContextFresh` 两个函数
- [ ] 同步清理 `xhs-api.ts` 中对 `XHS_STORAGE_KEYS` 签名相关 key 的引用

**验收标准：** 所有 API 函数编译通过，无对废弃 storage keys 的引用。

---

### Step 4：删除热身机制

- [ ] 删除 `background.ts` 中的 8 个热身相关函数
- [ ] 删除 `background.ts` 中对 `ensureXhsHomefeedWarmContext` / `ensureXhsCreatorContext` 的调用
- [ ] 删除 `xhs-consts.ts` 中的 13 个签名相关 Storage Keys
- [ ] 删除 `XHS_MSG_TYPE.SIGNAL_CAPTURED` / `XHS_MSG_TYPE.CREATOR_SIGNAL_CAPTURED` 两个消息类型

**验收标准：** 编译通过，无悬空引用。

---

### Step 5：删除注入脚本

- [ ] 删除 `src/platforms/xiaohongshu/xhs-injection.ts`
- [ ] 删除 `src/content/xhs-main-entrance.ts` 中的注入脚本加载逻辑和 window 消息监听
- [ ] 从 `manifest.json` 中移除 `xhs-injection.js` 的 web_accessible_resources 配置
- [ ] 从 webpack / vite 构建配置中移除 `xhs-injection` 入口

**验收标准：** 扩展打包后无 `xhs-injection.js`，content script 不再向页面注入任何脚本。

---

### Step 6：端到端验证

- [ ] 安装扩展，登录小红书
- [ ] 在 **不刷新首页** 的情况下，通过 LocalBridgeMac 调用 `query_xhs_homefeed` → 正常返回数据
- [ ] 调用 `exec_xhs_action`（点赞）→ 成功
- [ ] 调用 `query_xhs_search` → 成功
- [ ] 调用 `xhs_publish_note` → 成功发布（creator 签名从本地生成，无需访问 creator 页面）

---

## 六、风险与应对

| 风险 | 可能性 | 应对方式 |
|------|--------|---------|
| service worker 无 `window`/`document`，签名 JS 补环境报错 | 中 | 参考 Spider_XHS 的补环境做法；或将签名计算放到 offscreen document |
| 小红书更新签名算法导致签名失效 | 低（约每季度一次） | 跟进 Spider_XHS 仓库更新 JS 文件，替换即可 |
| `a1` cookie 过期 | 低（生命周期数月） | 检测到 401/461 时提示用户重新登录 |
| `x-rap-param` JSVMP 执行环境问题 | 中 | 若无法在 service worker 运行，可先使用空值或随机值降级 |

---

## 七、文件变更汇总

### 删除
- `src/platforms/xiaohongshu/xhs-injection.ts`

### 新增
- `src/platforms/xiaohongshu/sign/xhs_main.js`
- `src/platforms/xiaohongshu/sign/xhs_creator.js`
- `src/platforms/xiaohongshu/sign/xhs_rap.js`
- `src/platforms/xiaohongshu/sign/xhs_xray.js`
- `src/platforms/xiaohongshu/xhs-sign.ts`

### 大幅修改
- `src/platforms/xiaohongshu/xhs-api.ts`（删除签名头读取，改用 `buildXhsHeaders`）
- `src/platforms/xiaohongshu/xhs-consts.ts`（删除 13 个 storage keys、2 个消息类型）
- `src/service_work/background.ts`（删除热身机制约 200 行）
- `src/content/xhs-main-entrance.ts`（删除注入逻辑、window 消息监听）
- `manifest.json`（移除 web_accessible_resources 中的 xhs-injection.js）

### 小改动
- `xhs-main-entrance.ts` 剩余部分（消息路由逻辑不变）
- `xhs-url-utils.ts`（不变）
- `xhs-extractor.ts`（不变）
- `types/`（不变）

---

## 八、参考资料

- **签名 JS 来源：** https://github.com/cv-cat/Spider_XHS/tree/master/static
- **签名封装参考：** https://github.com/cv-cat/Spider_XHS/blob/master/xhs_utils/xhs_util.py
- **creator 端签名参考：** https://github.com/cv-cat/Spider_XHS/blob/master/xhs_utils/xhs_creator_util.py
- **MediaCrawler CDP 方案（备选）：** https://github.com/NanmiCoder/MediaCrawler
- **XHS 接口参考：** https://reajason.github.io/xhs/
