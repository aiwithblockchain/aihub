# txid 修复进展文档

## 背景

TweetPilot PostSync 功能（P0 优先级，步骤 3）依赖 LocalBridge HTTP API（`http://127.0.0.1:20088`，Python clawbot SDK）调用 Twitter GraphQL API。所有 GraphQL 请求需要 `x-client-transaction-id` 请求头，由浏览器扩展 tweetClaw 的 `src/x_api/txid.ts` 生成。

2026-06-22 起，所有 Twitter GraphQL API 调用（`user_tweets`、`create_tweet` 等）失败，错误信息：

```
Unable to resolve the X ondemand chunk URL from the homepage runtime.
```

后续修复后又出现：

```
Unable to build animation data for row 4. The homepage animation markup may have changed.
```

## 根因分析

### txid 生成算法（4 步）

`x-client-transaction-id` npm 包 v0.2.3（仓库：github.com/Lqm1/x-client-transaction-id）的 `ClientTransaction.create(doc)` 内部执行：

1. **getOnDemandFileUrl(doc)** — 从首页 webpack runtime 提取 `ondemand.s.{hash}a.js` 的 URL
2. **fetch(ondemandUrl)** — 下载 ondemand.s JS 文件，用 `INDICES_REGEX = /\(\w\[(\d{1,2})\],\s*16\)/g` 提取 key byte indices
3. **getKey(doc)** — 从 `<meta name="twitter-site-verification">` 提取 base64 key
4. **getAnimationKey(keyBytes, doc)** — 从 DOM 中提取动画帧 SVG path 数据，生成 animation key

最终 txid = `encodeBase64(keyBytes + timeNowBytes + sha256(method!path!timeNow + keyword + animationKey)[:16] + randomBytes)`

### X 网站改版（2026-06）

X 改版影响了步骤 1 和步骤 4：

**步骤 1 问题（已修复）**：静态 HTML 不再包含 `ondemand.s` webpack runtime chunk 映射。
- 修复方案 A：改用当前 tab 已加载的 `document.documentElement.outerHTML`（SPA 运行时 DOM 仍保留 ondemand.s 引用）
- 验证结果：`outerHTML has ondemand.s: true`，chunk URL 提取成功

**步骤 4 问题（当前阻塞）**：DOM 不再包含 `id^='loading-x-anim'` 的 SVG 元素。
- 库的 `getFrames()` 硬编码选择器：`response.querySelectorAll("[id^='loading-x-anim']")`
- 5.log 诊断结果：54 个 SVG，0 个带 `loading-x-anim` ID
- 但 DOM 中仍存在含 cubic bezier (`C` 命令) 的 SVG path（2 个候选，d.len=1264 和 1202）

### 上游库状态

- 最新版本：0.2.3（npm 上无更新版本）
- Issue #20（2026-06-22 开启）：报告 `OnDemandFileUrlResolutionError`，无 PR，无修复
- 0.2.3 的 `getFrames()` 仍使用 `[id^='loading-x-anim']` 选择器，未适配 X 改版

## 修复方案与进展

### 方案：injectAnimationFrameIds（已实现，部分有效）

在 `txid.ts` 新增 `injectAnimationFrameIds(doc)` 函数：

1. 找出所有 `svg > g > path[d]` 且 `d` 含 `C` (cubic bezier) 命令的 SVG
2. 给它们注入 `loading-x-anim-0/1/2/3` ID
3. 不足 4 个时用 `cloneNode(true)` 补齐（库做 `keyBytes[5] % 4` 索引）

代码位置：`src/x_api/txid.ts` 第 85-131 行

### 验证结果

**控制台验证脚本（7-verify-fix.js）**：全部通过

| 步骤 | 结果 |
|------|------|
| 现有 loading-x-anim | 0 个 |
| 含 C 命令的动画 SVG 候选 | 2 个 |
| 注入后 loading-x-anim | 4 个 |
| ondemand URL | 提取成功 |
| indices | [30, 33, 15, 24] |
| verification key | 提取成功（len=64） |
| frameIdx (keyBytes[5] % 4) | 0 |
| frame[0] path d.len | 1264 |
| 2D array 行数 | 3 行 |
| rowIndex (keyBytes[30] % 16) | 2 |
| arr[2] | 存在，14 个值 |

**Python 端实际测试（publish_tweet.py）**：失败

```
Unable to build animation data for row 4. The homepage animation markup may have changed.
```

### 失败原因分析

验证脚本中 `rowIndex=2` 恰好在 3 行范围内，但实际发布推文时 `rowIndex=4`，超出了 path 数据 split 后的行数。

`get2dArray()` 的解析逻辑：
```js
const items = dAttr.substring(9).split("C");
```
当前 path `d` 属性以 `M14.1 2.5c1.103...` 开头，`substring(9)` 后 split `C` 只产生 3 行。

但 `getAnimationKey()` 使用 `rowIndex = keyBytes[DEFAULT_ROW_INDEX] % 16`，范围 0-15。不同账号的 key 会产生不同的 rowIndex，只有 rowIndex < 3 时才能成功。这是一个**偶发性问题**，不是稳定修复。

### 核心矛盾

当前 DOM 中的 SVG path 不是原始的 `loading-x-anim` 动画帧。原始动画帧的 path 数据结构应该能 split 出至少 16 行（覆盖 rowIndex 0-15），但当前找到的 path 只能 split 出 3 行。

X 改版后，原始的 `loading-x-anim` SVG 元素可能已完全从 DOM 中移除，动画数据可能迁移到了其他位置（如 ondemand.s JS 文件内部，或通过 Web Animations API 动态生成）。

## ondemand.s 文件分析

对 `ondemand.s.e7960b8a.js`（19514 字节）的分析：

- 包含 `H=n=>({color:..., transform:..., easing:...})` 函数（动画 key 生成逻辑）
- 包含 `Z=(n,t,W,r)=>{...}` 函数（对应库的 `solve()` 方法）
- 包含 `y=n=>(n<16?"0":"")+n.toString(16)` 函数（byte 转 hex）
- indices 模式匹配 4 个：`(n[30],16)`, `(n[33],16)`, `(n[15],16)`, `(n[24],16)`
- **未找到** SVG path 数据（`M...C...` 模式 0 个匹配）
- **未找到** 8+ 元素的数字数组
- **未找到** `.animate()` 调用

结论：ondemand.s 文件包含动画 key 的**计算逻辑**，但不包含动画帧的**原始数据**。帧数据仍需从 DOM 获取。

## 最终修复：方案 B — 调用 X 自己的 txid 生成函数（已验证通过）

### 思路转变

之前的方案（injectAnimationFrameIds）尝试自己复现 txid 算法，但 X 改版后 DOM 中不再有能产生 16+ 行的 path 数据，无法稳定生成。

新思路：**不自己生成 txid，而是调用 X 前端自己的 txid 生成函数。**

X 前端每次发 GraphQL 请求时都会生成 txid，这个逻辑在 webpack 模块 991160 中：
```javascript
// 模块 991160 导出
{
  kc: (host, path, method) => Promise<txid>,  // txid 生成函数
  Ay: (fetchFilter),                          // fetch 拦截器，调用 kc
  _E: (host验证)
}
```

`kc` 函数源码：
```javascript
async function s(e,t,r){
  try{
    if(e.includes("jf.x.com")) return await a("jf","PATCH");
    return await a(o(t),r)
  }catch(e){return btoa(`e:${e}`)}
}
```

### 实现方式：CustomEvent 桥接

content script 运行在 isolated world，无法直接访问 page world 的 `webpackRequire`。通过 CustomEvent 桥接：

1. **`src/capture/injection.ts`**（page world）：监听 `tweetclaw:txid-request` 事件，通过 webpack chunk push 获取 `__webpack_require__`，调用 `wr(991160).kc(host, path, method)` 生成 txid，用 `tweetclaw:txid-response` 返回。

2. **`src/x_api/txid.ts`**（content script）：`getTransactionIdFor()` 先尝试 bridge（方案 B），3 秒超时后回退到上游库（方案 A fallback）。

### 验证结果（2026-06-23）

| 测试 | 结果 |
|------|------|
| 控制台 `11-call-x-txid.js` | ✅ kc 函数成功生成 txid（长度 94，base64 编码） |
| `publish_tweet.py` (CreateTweet) | ✅ `success=True, target_id=2069311704182198460` |
| `test_user_tweets.py` (UserTweets) | ✅ `success=True`，返回完整 timeline |

**PostSync P0 步骤 3 的 txid 阻塞问题已完全解决。**

### 修改的文件

- `src/capture/injection.ts` — 新增 txid bridge：监听 `tweetclaw:txid-request`，通过 webpackRequire 调用 X 的 kc 函数
- `src/x_api/txid.ts` — `getTransactionIdFor()` 改为先尝试 bridge，失败回退上游库

## 诊断脚本

- `TweetPilot/10-find-x-txid-fn.js` — 定位 X 的 txid 生成函数（hook fetch/Headers，搜索 webpack 模块）
- `TweetPilot/11-call-x-txid.js` — 直接调用 X 的 kc 函数验证 txid 生成
- `TweetPilot/5.log` — 控制台测试输出

## 历史方案（已废弃）

### 方案 A：injectAnimationFrameIds（部分有效，已废弃）

给 DOM 中含 C 命令的 SVG 注入 `loading-x-anim-N` ID，但 path 只能 split 出 3 行，而 rowIndex 范围 0-15，偶发失败。代码保留在 txid.ts 中作为 fallback。

## 相关文件

- `src/x_api/txid.ts` — txid 生成器（已修改）
- `src/x_api/twitter_api.ts` — Twitter API 调用（已还原，始终附加 x-client-transaction-id 头）
- `node_modules/x-client-transaction-id/esm/transaction.js` — 上游库实现
- `node_modules/x-client-transaction-id/esm/utils.js` — 上游库工具函数（含 handleXMigration）
- `dist/manifest.json` — 扩展清单（v0.8.25）

## 诊断脚本

- `TweetPilot/5.log` — 控制台诊断输出（SVG 结构分析 + ondemand.s 关键词搜索 + 修复验证）
- `TweetPilot/6-diagnose-anim.js` — DOM 动画帧 SVG 结构诊断脚本
- `TweetPilot/6-diagnose-ondemand.js` — ondemand.s 文件内容分析脚本
- `TweetPilot/7-verify-fix.js` — 修复方案验证脚本（模拟完整 txid 生成流程）

## 测试脚本

- `resources/tweetpilot-home/clawbot/examples/twitter/publish_tweet.py` — 发布推文测试
- `resources/tweetpilot-home/clawbot/examples/twitter/test_user_tweets.py` — 用户推文查询测试

运行方式：
```bash
cd resources/tweetpilot-home/clawbot/examples/twitter
PYTHONPATH=/Users/hyperorchid/aiwithblockchain/TweetPilot/resources/tweetpilot-home/clawbot python3 publish_tweet.py
```
