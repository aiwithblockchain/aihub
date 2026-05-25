# 小红书发布图文笔记 — 技术方案

> 最后更新：2026-05-24  
> 当前状态：**已验证可用**（`window.mnsv2` 方案）

---

## 一、完整 API 链路

发布一条图文笔记需要三个串行步骤：

```
步骤1  GET  creator.xiaohongshu.com/api/media/v1/upload/creator/permit
       → 获取 COS 上传凭证（fileId、token、expireTime）

步骤2  PUT  ros-upload.xiaohongshu.com/spectrum/{fileId}
       → 把图片二进制数据上传到腾讯 COS
       → 不需要小红书签名，用 HMAC-SHA1 生成 COS authorization

步骤3  POST edith.xiaohongshu.com/web_api/sns/v2/note
       → 用 fileId 等元信息发布笔记
       → 需要最完整的签名头组合
```

---

## 二、关键签名头说明

### 2.1 通用签名头

| 头名称 | 含义 | 生成方式 |
|--------|------|----------|
| `x-s` | 请求主签名 | **见 2.2 节**，必须是 `XYS_` 格式 |
| `x-t` | 签名时间戳（毫秒） | `Date.now()` |
| `x-s-common` | 设备/会话指纹签名 | 基于本次 xs/xt/a1 现场计算，见 2.3 节 |
| `x-b3-traceid` | 链路追踪 ID | 16 位随机 hex |
| `x-xray-traceid` | xray 追踪 ID | 32 位随机 hex |

### 2.2 x-s 签名格式：XYS_ vs XYW_ （核心问题）

小红书有**两套签名体系**，两者不能混用：

| 格式 | 来源函数 | 使用场景 |
|------|---------|---------|
| `XYS_eyJ...` | `window.mnsv2` + `seccore_signv2` | **www.xiaohongshu.com** 和 **edith.xiaohongshu.com** 的 API，包括发布笔记 |
| `XYW_eyJ...` | `window._webmsxyw` | **www.xiaohongshu.com** 的普通数据读取 API（如 feed、搜索）|

服务端会验证签名格式，**发布笔记 `/web_api/sns/v2/note` 只接受 `XYS_` 格式**，收到 `XYW_` 直接返回 406。

解码后对比：
```json
// XYS_ 格式（正确）
{"x0":"4.3.2","x1":"ugc","x2":"Windows","x3":"mns0101_0...","x4":"object"}
//                   ^^^
//              appId = ugc，signType 字段不同

// XYW_ 格式（错误）
{"signSvn":"56","signType":"x2","appId":"ugc","signVersion":"1","payload":"..."}
```

### 2.3 x-s-common 的正确生成方式

`x-s-common` 是和本次请求的 `xs`、`xt` 绑定计算的，**每次请求必须重新生成，不能复用**。

算法移植自 `xhs_creator_260411.js` 的 `XsCommon(a1, xs, xt)` 函数：

```
输入: a1（cookie）, xs（本次请求的 x-s）, xt（本次请求的 x-t，毫秒）

step1: md5_val = MD5(String(xt) + xs + FFF)
       # FFF 是固定常量字符串（见代码 xhs-sign-inject.ts）

step2: x9 = CRC32(hexToBytes(md5_val))
       # gens9 函数实现的 CRC32

step3: d = {
         s0:5, s1:"", x0:"1", x1:"4.3.2", x2:"Windows",
         x3:"ugc", x4:"4.84.1",
         x5: a1,   ← a1 cookie
         x6: xt,   ← 本次请求的 x-t（number）
         x7: xs,   ← 本次请求的 x-s
         x8: FFF,  ← 固定常量
         x9: x9,   ← step2 的结果
         x10:0, x11:"normal"
       }

step4: x-s-common = xhsBase64(UTF8(JSON.stringify(d)))
       # 注意：使用小红书自定义 base64 字母表，不是标准 btoa()
```

### 2.4 x-rap-param

由 creator 页面内置的 RAP SDK 生成，发布笔记时必须携带。当前实现通过：
1. inject script 在页面 context 里使用 webpack 模块 9116 计算
2. content script 通过 postMessage 桥接获取结果

---

## 三、当前可用方案：window.mnsv2

### 3.1 方案原理

`window.mnsv2` 是 creator.xiaohongshu.com 页面 webpack bundle 里暴露到 `window` 的签名核心函数，负责生成 `XYS_` 格式的签名核心字符串 `x3`。

在 inject script（页面 context）里直接调用：

```typescript
function signWithMnsv2(url: string, data: string): string {
  const mnsv2 = (window as any).mnsv2;
  if (typeof mnsv2 !== 'function') throw new Error('window.mnsv2 not found');

  const fullStr = url + (data || '');
  const c = xhsMd5(fullStr);   // MD5(url+data)
  const d = xhsMd5(url);       // MD5(url)
  const s = mnsv2(fullStr, c, d);  // 核心签名

  const signObj = { x0: '4.3.2', x1: 'ugc', x2: 'Windows', x3: s, x4: 'object' };
  return 'XYS_' + xhsB64Encode(Array.from(new TextEncoder().encode(JSON.stringify(signObj))));
}
```

### 3.2 handleSignRequest 优先级逻辑

```typescript
// 优先用 mnsv2（creator 页面）→ 产生 XYS_
if (typeof window.mnsv2 === 'function') {
  xs = signWithMnsv2(url, data);
  xt = Date.now();
} else {
  // 回退到 _webmsxyw（www 页面）→ 产生 XYW_（只适用于读取 API）
  xs = _webmsxyw(url, data, a1)['X-s'];
  xt = _webmsxyw(url, data, a1)['X-t'];
}
```

### 3.3 验证结果

2026-05-24 测试通过，发布成功：
```json
{
  "success": true,
  "data": {
    "id": "6a131ec30000000007026efe",
    "share_link": "https://www.xiaohongshu.com/discovery/item/6a131ec30000000007026efe"
  }
}
```

---

## 四、历史方案失败原因分析

### 失败1：早期方案——拦截 x-s-common 复用

- **做法**：用 XHR/fetch 拦截器捕获页面真实请求里的 `x-s-common` 并缓存
- **失败原因**：`x-s-common` 是基于每次请求的 xs+xt 现场计算的，复用旧值与新请求的签名不匹配，服务端拒绝

### 失败2：www tab 路由方案

- **做法**：creator tab 无法签名，把签名请求路由到 www tab 计算
- **失败原因**：www 和 creator 页面的 `_webmsxyw` 产生的都是 `XYW_` 格式，不是 `XYS_`，两个 tab 都是错的

### 失败3：XHR proxy 方案

- **做法**：让 inject script 用页面原生 XHR 发请求，期望反垃圾 SDK 自动注入 `XYS_` 格式的 x-s
- **失败原因**：creator 页面的 axios 拦截器只对 `/fe_api/` 路径自动签名，`/web_api/` 不在范围内，x-s 没有被自动注入

### 根本原因总结

我们长期尝试用 `_webmsxyw` 作为签名函数，但这个函数永远只产生 `XYW_` 格式。`XYS_` 格式需要 `window.mnsv2`，这个函数没有在 window 上有任何文档或暗示，只能通过：
1. 逆向 creator 页面 webpack bundle 里的请求拦截器源码
2. 找到 `window.shouldSign` + `window.sign` 的调用路径
3. 最终定位到 `window.mnsv2` 是关键

---

## 五、已知脆弱点与优化方向

### 5.1 当前方案的风险

| 风险 | 描述 | 应对策略 |
|------|------|---------|
| `window.mnsv2` 消失 | 小红书更新 JS bundle 后，mnsv2 可能不再暴露到 window，或改名 | 见 5.2 节 |
| mnsv2 算法更新 | mnsv2 内部实现（目前返回 `mns0101_0...`）可能变化 | 监控签名前缀 |
| `x-s-common` 字段变化 | 固定常量 FFF、字段名、结构随版本更新 | 见 5.3 节 |

### 5.2 为什么没有可靠的自动备用方案

**曾经考虑过的 "备用路径"：通过 webpack 内部模块调用**

`window.mnsv2` 实际上是 webpack 模块 `69384` 初始化时显式赋值到 window 的，理论上即使
`window.mnsv2` 消失，还可以通过 `webpackChunkugc` + `wpRequire('69384').UM(...)` 调用。

**但这条路不可靠，原因如下：**

- webpack **模块 id**（`69384`）每次重新打包都可能变化
- **导出名**（`UM`、`Ay`、`My`）是混淆器生成的随机字母，每次打包都不同
- 下次更新后 `wpRequire('69384').UM` 可能对应完全不同的函数

**结论：不写看起来有备用实则不可靠的 fallback，避免静默失败。**

### 5.3 正确的工程策略

**第一步：监控（自动）**

`window.mnsv2` 相对稳定——它是代码里**显式写死的字符串**，混淆器不会改变具名属性名，
小红书要改只能主动改，不会因常规重新打包而消失。

在 inject script 里加入检测，消失时立即告警，不静默降级：

```typescript
// inject script 启动时检测
if (typeof (window as any).mnsv2 !== 'function') {
  console.error('[XhsClaw] window.mnsv2 不存在，签名功能失效，需要人工更新！');
  // 通过 postMessage 通知 content script → background → 扩展 UI 显示告警
  window.postMessage({ type: 'XHS_SIGN_UNAVAILABLE', reason: 'mnsv2_missing' }, '*');
}
```

**第二步：快速响应（人工，约 5 分钟）**

`window.mnsv2` 消失时，按以下步骤定位新函数：

```
1. 打开 creator.xiaohongshu.com，DevTools → Console

2. 搜索 XYS_ 签名的生成位置：
   let wpRequire;
   window.webpackChunkugc.push([[Symbol()], {}, (r) => { wpRequire = r; }]);
   for (const id of Object.keys(wpRequire.m)) {
     const src = wpRequire.m[id].toString();
     if (src.includes('"XYS_"') || src.includes("'XYS_'")) {
       console.log('found:', id, src.slice(0, 300));
     }
   }

3. 找到模块后，查看新的签名函数如何被调用
   → 找到新的 window.xxx 暴露点，或者直接用 wpRequire 调用

4. 更新 xhs-sign-inject.ts 里的 signWithMnsv2() 函数
   → 只改这一个函数，其他不动

5. npm run build → 发布新版扩展
```

**第三步：版本变更检测（可选增强）**

签名核心字符串以版本号开头（当前是 `mns0101_0...`），可通过 Self-test 检测算法版本变化：

```typescript
// inject script 启动时 Self-test
const testXs = signWithMnsv2('/api/health', '');
if (!testXs.startsWith('XYS_')) {
  console.error('[XhsClaw] mnsv2 签名格式异常！当前结果:', testXs.slice(0, 20));
  window.postMessage({ type: 'XHS_SIGN_UNAVAILABLE', reason: 'format_changed' }, '*');
} else {
  console.log('[XhsClaw] mnsv2 签名正常:', testXs.slice(0, 15) + '...');
}
```

---

## 六、步骤2 COS 上传签名（HMAC-SHA1，已稳定）

此部分当前代码已正确实现，逻辑来自 `xhs_creator_signature.js`：

```
message = "{xt[:10]};{expireTime[:10]}"   ← x-t 和 expireTime 都取前10位（秒级）

step1: key1 = HMAC-SHA1("null", message)

step2: canonical = "put\n/spectrum/{fileId}\n\ncontent-length={size}&host={host}\n"
       hash = SHA1(canonical)

step3: sign_str = "sha1\n{message}\n{hash}\n"
       signature = HMAC-SHA1(key1, sign_str)

Authorization: q-sign-algorithm=sha1&q-ak=null
               &q-sign-time={message}&q-key-time={message}
               &q-header-list=content-length;host
               &q-url-param-list=
               &q-signature={signature}
```

---

## 七、发布请求体结构

```json
{
  "common": {
    "type": "normal",
    "title": "标题",
    "note_id": "",
    "desc": "正文",
    "source": "{\"type\":\"web\",\"ids\":\"\",\"extraInfo\":\"{\\\"subType\\\":\\\"official\\\",\\\"systemId\\\":\\\"web\\\"}\"}",
    "business_binds": "{\"version\":1,\"noteId\":0,\"bizType\":0,...}",
    "ats": [],
    "hash_tag": [],
    "post_loc": {},
    "privacy_info": { "op_type": 1, "type": 1, "user_ids": [] },
    "goods_info": {},
    "biz_relations": [],
    "capa_trace_info": { "contextJson": "{...}" }
  },
  "image_info": {
    "images": [{
      "file_id": "spectrum/{fileId}",
      "width": 1,
      "height": 1,
      "metadata": { "source": -1 },
      "stickers": { "version": 2, "floating": [] },
      "extra_info_json": "{\"mimeType\":\"image/png\",\"image_metadata\":{\"bg_color\":\"\",\"origin_size\":0.068}}"
    }]
  },
  "video_info": null
}
```

`privacy_info.type`：`0` = 公开，`1` = 私密，`2` = 好友可见

---

## 八、验证方法

在 creator.xiaohongshu.com 页面 DevTools → Network 里，确认发帖请求头包含：
- `x-s`：以 `XYS_` 开头 ✅（以前是 `XYW_` ❌）
- `x-t`：13 位数字时间戳
- `x-s-common`：很长的 base64 字符串
- `x-rap-param`：有值

四个都有，服务端返回 200，`success: true`。

---

## 九、维护策略：以 Spider_XHS 为情报源

### 9.1 背景：所有逆向工具面临同样的挑战

Spider_XHS、ReaJason/xhs、NanmiCoder/MediaCrawler 等所有 XHS 逆向工具，核心都是：
1. 下载 XHS 的 JS bundle
2. 逆向找到签名函数和常量（FFF、mnsv2 或等价物）
3. 在 Node.js 里重现这套逻辑

XHS 每次更新 bundle，所有这些项目一起受影响。他们的维护模式是：有人发现挂了 → 开 issue → 有人去重新逆向 → PR → 合并。

**我们 vs Spider_XHS 的处境对比：**

| 维度 | Spider_XHS | 我们（Chrome 扩展）|
|------|-----------|-------------------|
| 签名函数从哪来 | 在 Node.js 里重现 mnsv2 逻辑 | 直接调用 `window.mnsv2`（XHS 自己的代码）|
| 算法内部更新 | **必须重新逆向、重新实现** | **完全不受影响**，XHS 自己的函数处理 |
| FFF 常量更新 | 必须重新找 | 必须重新找（同等处境）|
| `mnsv2` 被改名/移除 | 不受影响（不依赖 window）| 需要重新找入口 |

**结论：我们对算法内部变化有天然免疫，Spider_XHS 没有。我们真正需要外部情报的只有两点。**

---

### 9.2 我们的两个弱点及应对

**弱点1：FFF 常量变化（概率中等）**

Spider_XHS 的 Python 代码里必然包含最新的 FFF 常量（他们重现了完整的 x-s-common 算法）。

XHS 更新 bundle → Spider_XHS 维护者逆向更新代码 → FFF 新值出现在他们的 commit diff 里。

应对步骤：
1. 在 GitHub 上 Watch Spider_XHS 仓库，启用 commit 通知
2. 发现签名相关 commit → 打开 diff
3. 找到 FFF 常量新值（搜索 `I38r` 开头的长字符串，或 `x8` 字段赋值处）
4. 复制到我们的 `xhs-sign-inject.ts` 里的 `FFF` 常量

**成本：5 分钟，不需要自己逆向 bundle。**

**弱点2：`window.mnsv2` 消失（概率低）**

Spider_XHS 不依赖 `window.mnsv2`，所以他们的更新不会直接告诉我们新的 `window.*` 属性叫什么。但他们的新代码揭示了算法的新输入/输出结构，有了这个方向，在 creator bundle 里搜索新的 `window` 赋值点会快很多。

应对步骤：
1. 看 Spider_XHS 新代码，理解新签名算法结构（输入参数、返回格式）
2. 打开 creator.xiaohongshu.com，DevTools Console 执行：
   ```javascript
   let wpRequire;
   window.webpackChunkugc.push([[Symbol()], {}, (r) => { wpRequire = r; }]);
   for (const id of Object.keys(wpRequire.m)) {
     const src = wpRequire.m[id].toString();
     if (src.includes('"XYS_"') || src.includes("'XYS_'")) {
       console.log('found:', id, src.slice(0, 300));
     }
   }
   ```
3. 找到新模块，验证签名结构是否与 Spider_XHS 新代码吻合
4. 找到新的 `window.xxx` 赋值点 → 更新 `signWithMnsv2()` 函数

**成本：从"可能几小时盲目搜索"压缩到"30 分钟有方向验证"。**

---

### 9.3 Spider_XHS 仓库地址及关注方式

**主仓库：**
```
https://github.com/NanmiCoder/MediaCrawler
```
（MediaCrawler 是活跃维护的多平台爬虫，含 XHS 签名最新实现）

**XHS 签名专项仓库（参考）：**
```
https://github.com/ReaJason/xhs
```

**关注策略：**
- GitHub → Watch → Custom → 勾选 `Releases` + `Commits`（或直接 Watch All Activity）
- 也可以订阅 RSS：`https://github.com/NanmiCoder/MediaCrawler/commits/main.atom`

**在代码里找 FFF 常量的方法：**

MediaCrawler 里搜索 `x-s-common` 或 `xs_common` 或直接搜那个长 Base64 字符串的前20个字符（当前：`I38rHdgsjopg`）：

```bash
# 在 MediaCrawler 仓库里搜索
grep -r "I38rHdgsjopg" .
grep -r "x_s_common" .
grep -r "xs_common" .
```

---

### 9.4 Spider_XHS 挂掉是我们的告警信号

**这是一个被动告警的额外好处：**

Spider_XHS / MediaCrawler 的 issue 区出现大量"签名失效"报告，是 XHS 更新了签名的可靠信号，往往比我们的扩展自己报错更早。

建议在 GitHub 上 star + watch 这两个仓库，定期（每1-2周）浏览一次 issue 区。出现以下关键词就需要重点关注：

- `sign failed`、`406`、`x-s`、`签名`、`invalid signature`

**完整情报链路：**

```
XHS 更新 bundle
    ↓
Spider_XHS / MediaCrawler issue 区出现报告（早期告警）
    ↓
维护者逆向 → commit 更新代码
    ↓
我们读 diff → 提取 FFF 新值（5分钟）或理解新算法方向（30分钟）
    ↓
更新 xhs-sign-inject.ts → npm run build → 发布新版扩展
```

我们不需要自己维护完整的逆向流程，只需要**会读他们的代码**，把他们的社区工作转化为我们的更新输入。
