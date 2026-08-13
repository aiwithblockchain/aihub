# Instagram `getUserInfo` 初始化时序问题

> 状态：待处理
> 日期：2026-08-13
> 相关模块：`src/content/ig-main-entrance.ts`、`src/capture/injection.ts`、`src/ig_api/ig_api.ts`

## 1. 问题描述

Instagram content script 在 `document_start` 阶段就开始执行，并且在没有等待页面初始化完成、也没有等待 page-world 注入脚本准备好之前，就立刻执行登录检查和 API 连接测试。

首次调用链是：

```text
content script 初始化
  → checkLogin()
  → testConnection()
  → getSelfInfo()
  → getUserInfo()
  → getUserInfoViaGraphQL()
```

其中 `getUserInfoViaGraphQL()` 依赖：

- `fb_dtsg` token，从页面 DOM 中提取
- `PolarisProfilePageContentQuery` 的动态 `doc_id`，从 `sessionStorage.ig_doc_id_map` 读取

这两个值都依赖页面加载完成后，Instagram 前端和 `injection.ts` 完成初始化并捕获到真实请求。

## 2. 当前代码时序

`manifest.json` 中 Instagram content script 配置为：

```json
{
  "matches": ["https://www.instagram.com/*", "https://instagram.com/*"],
  "js": ["js/content-ig.js"],
  "run_at": "document_start"
}
```

`src/content/ig-main-entrance.ts` 顶部异步注入 page-world 脚本：

```ts
(function injectIgInjury() {
  if (document.getElementById('tc_injection')) return;
  const script = document.createElement('script');
  script.id = 'tc_injection';
  script.src = chrome.runtime.getURL('js/injection.js');
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();
})();
```

但紧接着的初始化 IIFE 没有等待这个注入脚本加载完成，也没有等待 `document.readyState === 'complete'`：

```ts
(async () => {
  const isLoggedIn = await igApi.checkLogin();
  if (isLoggedIn) {
    const testResult = await igApi.testConnection();
  }
})();
```

因此首次 `getUserInfo` 可能早于以下事件发生：

- `injection.ts` 完成 page-world fetch/XHR hook 注入
- Instagram 前端发出自己的 GraphQL 请求并写入 doc_id 缓存
- `PolarisProfilePageContentQuery` 的动态 `doc_id` 被捕获

## 3. 日志证据

在 Instagram 控制台日志中可以看到，content script 的初始化和 API 调用发生在 page-world 注入脚本初始化之前：

```text
content-ig.js [IgClaw-CS] Instagram Content Script loaded
content-ig.js [IgClaw-CS] ✅ User is logged in to Instagram

injection.ts [TweetClaw-Page] System initializing...
injection.ts [IG-DocId] captured IGDBadgeCountOffMsysQuery → ...
injection.ts [IG-DocId] captured PolarisProfileNavItemBadgeQuery → ...

content-ig.js [IG API] getUserInfo fingerprint: ...
```

也就是说，`getUserInfo` 开始执行时，`injection.ts` 刚完成初始化或尚未完成初始化，页面可能还没有捕获到当前页面所需的全部 doc_id。

## 4. 潜在影响

当以下情况出现时，首次 GraphQL 调用可能失败：

- `sessionStorage.ig_doc_id_map` 中没有 `PolarisProfilePageContentQuery`
- 缓存里的 doc_id 已经过期，但尚未被新的页面请求覆盖
- 页面尚未生成 `fb_dtsg` token，`getFbDtsgWithCache()` 只做有限次短重试

这类失败可能表现为：

```text
[IG API] GraphQL getUserInfo failed, falling back to REST: ...
```

即使当前有 REST fallback，但过早请求仍会造成不必要的失败、日志噪音，以及依赖 GraphQL 的新查询在冷启动时不够稳定。

## 5. 建议处理方向

不要直接删掉 `document_start`，因为 page-world 注入需要尽早执行。建议在首次 `testConnection()` 之前显式等待两个条件：

1. 等待文档进入可用状态：

```ts
function waitForDocumentReady(): Promise<void> {
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener('load', resolve, { once: true });
  });
}
```

2. 等待 `PolarisProfilePageContentQuery` 的动态 doc_id 出现在 `sessionStorage.ig_doc_id_map` 中，并设置超时：

```ts
async function waitForProfileDocId(timeoutMs: number): Promise<void> {
  const key = 'ig_doc_id_map';
  const friendlyName = 'PolarisProfilePageContentQuery';
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const map = JSON.parse(sessionStorage.getItem(key) || '{}');
      if (map[friendlyName]?.docId) return;
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
```

然后将初始化改成：

```ts
await waitForDocumentReady();
await waitForProfileDocId(5000);

const isLoggedIn = await igApi.checkLogin();
if (isLoggedIn) {
  const testResult = await igApi.testConnection();
}
```

超时后仍可继续执行，避免扩展初始化被永久卡住；等待期间若发现已有有效缓存，可以提前结束等待。
