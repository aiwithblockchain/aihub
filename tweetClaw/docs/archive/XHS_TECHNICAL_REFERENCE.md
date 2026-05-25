# 小红书发布图文笔记：技术参考文档

> 合并自：`XHS_ANTI_SPAM_AND_SIGN.md` + `XHS_PUBLISH_IMAGE_NOTE.md`  
> 最后更新：2026-05-25  
> 当前状态：**已验证可用**，P0/P1 脆弱点均已修复

---

## 一、整体防护体系概览

小红书的写操作（发帖、评论、点赞）依赖一套**多层签名 + 行为环境**的反垃圾体系。任何一层校验失败，服务端直接拒绝请求（HTTP 200 但 `success: false`，或直接 4xx）。

```
┌─────────────────────────────────────────────────────────────────┐
│                     小红书反垃圾防护层级                          │
│                                                                 │
│  Layer 1: Cookie 身份层                                          │
│    a1 (设备指纹)  +  web_session (登录态)                         │
│                                                                 │
│  Layer 2: 请求签名层（防重放 + 防篡改）                            │
│    x-s   ── 请求内容签名（mnsv2 / _webmsxyw）                    │
│    x-t   ── 毫秒时间戳（服务端有效窗口约 ±5min）                   │
│                                                                 │
│  Layer 3: 设备指纹绑定层（防多账号复用签名）                        │
│    x-s-common ── 把 a1 + x-s + x-t 绑定在一起                   │
│                                                                 │
│  Layer 4: 链路追踪层（辅助判断请求真实性）                          │
│    x-b3-traceid    ── Zipkin 格式链路 ID                         │
│    x-xray-traceid  ── 小红书自研 xray 链路 ID                    │
│                                                                 │
│  Layer 5: 行为风控层（仅写操作，强度最高）                          │
│    x-rap-param ── RAP SDK 行为签名（creator 域）                  │
│    XYS_ 格式   ── mnsv2 黑盒混淆签名（creator 域写接口）           │
│                                                                 │
│  Layer 6: 媒体上传鉴权层                                          │
│    COS HMAC-SHA1 Authorization ── 腾讯云对象存储上传凭证          │
└─────────────────────────────────────────────────────────────────┘
```

发布一篇图文笔记需要**按顺序**完成以下 3 个 API 调用：

```
Step 1  GET  creator.xiaohongshu.com/api/media/v1/upload/creator/permit
         ↓ 获取 COS 上传凭证（token + fileId + expireTime）

Step 2  PUT  ros-upload.xiaohongshu.com/spectrum/{fileId}
         ↓ 将图片上传到腾讯云 COS

Step 3  POST edith.xiaohongshu.com/web_api/sns/v2/note
         ↓ 提交笔记元信息（标题、正文、图片 fileId 列表）
```

---

## 二、Layer 1：Cookie 身份层

### 2.1 a1 — 设备指纹 Cookie

`a1` 是小红书在用户**首次访问**时由前端 JS 生成并写入的设备指纹 Cookie，生命周期约 1 年。

```
格式示例：1908d1a0b6eb13b5egsm8ggm97q17yfuv92n4l0g850000266761
         └─时间戳前缀─┘└──────────随机字符串──────────────┘
```

`a1` 是 `x-s-common` 的输入之一。如果 `a1` 与签名中绑定的 `a1` 不一致，服务端验证失败。

### 2.2 web_session — 登录态 Cookie

标准的 session token，登录后由服务端下发。没有这个 Cookie，所有 API 直接返回未登录错误。

---

## 三、Layer 2：请求签名层 — x-s 与 x-t

### 3.1 两套签名体系

小红书有**两套签名体系**，两者不能混用：

| 格式 | 来源函数 | 使用场景 |
|------|---------|---------|
| `XYS_eyJ...` | `window.mnsv2` | creator 域所有写操作，包括发布笔记 |
| `XYW_eyJ...` | `window._webmsxyw` | www 域普通数据读取 API（feed、搜索）|

**发布笔记 `/web_api/sns/v2/note` 只接受 `XYS_` 格式**，收到 `XYW_` 直接返回 406。

解码后对比：
```json
// XYS_ 格式（正确）
{"x0":"4.3.2","x1":"ugc","x2":"Windows","x3":"mns0101_0...","x4":"object"}

// XYW_ 格式（错误）
{"signSvn":"56","signType":"x2","appId":"ugc","signVersion":"1","payload":"..."}
```

### 3.2 creator 域：`mnsv2` 函数（4.3.2 版本）

**签名流程：**

```
输入：api_path, request_body

Step 1  拼接完整字符串
        fullStr = api_path + body_json_string

Step 2  计算两个 MD5
        c = MD5(fullStr)          ← 整体哈希
        d = MD5(api_path)         ← 路径哈希（4.3.2 新增，之前版本是 MD5(body)）

Step 3  调用黑盒函数
        s = window.mnsv2(fullStr, c, d)

Step 4  构建签名对象
        signObj = {
            x0: "4.3.2",    ← SDK 版本号
            x1: "ugc",      ← 业务线标识
            x2: "Windows",  ← 平台
            x3: s,          ← mnsv2 输出
            x4: "object"    ← 数据类型标记
        }

Step 5  编码输出
        x-s = "XYS_" + base64_custom(utf8_encode(JSON.stringify(signObj)))
```

**自定义 base64 字符表（非标准）：**
```
标准 base64：ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/
小红书自用：  ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5
```

### 3.3 www 域：`_webmsxyw` 函数

```
输入：api_path + request_body + a1_cookie
      ↓
window._webmsxyw(api_path, body, a1)
      ↓
返回：{ "X-s": "...", "X-t": 1234567890 }
```

---

## 四、Layer 3：设备指纹绑定层 — x-s-common

`x-s-common` 把 a1（设备）与本次签名（x-s、x-t）强绑定，**每次请求必须重新生成，不能复用**。

**生成流程：**

```
输入：a1, x-s, x-t

Step 1  计算绑定哈希
        md5_url2 = MD5(str(x-t) + x-s + FFF)
        其中 FFF 是写死在 JS 里的长字符串（起盐的作用）

Step 2  CRC32 校验
        x9 = CRC32(hexToBytes(md5_url2))

Step 3  构建数据包
        d = {
            s0: 5, s1: "",
            x0: "1", x1: "4.3.2", x2: "Windows",
            x3: "ugc", x4: "4.84.1",
            x5: a1,    ← 设备指纹（关键绑定字段）
            x6: x-t,   ← 时间戳
            x7: x-s,   ← 本次签名
            x8: FFF,   ← 盐值
            x9: CRC32结果,
            x10: 0, x11: "normal",
        }

Step 4  编码输出
        x-s-common = base64_custom(utf8_encode(JSON.stringify(d)))
```

服务端解码后，对比 `x5`（a1）是否与请求 Cookie 中的 `a1` 一致，不一致则拒绝。

---

## 五、Layer 4：链路追踪层

```python
# x-b3-traceid：16 位随机 hex
x_b3_traceid = ''.join(random.choice('abcdef0123456789') for _ in range(16))

# x-xray-traceid：通过 xhs_xray.js 的 traceId() 函数生成，32 位 hex
```

---

## 六、Layer 5：行为风控层（写操作专属）

### 6.1 RAP SDK（Sanji）— x-rap-param

RAP（Risk Analysis Platform）是小红书的行为风控系统，只在**写操作**时启用。内部代号 Sanji，对应文件 `643f48183a62c46e6c924b3f0456767a.js`。

**RAP SDK 的运行机制：**
1. 页面加载时，RAP SDK 替换 `window.XMLHttpRequest` 构造函数
2. 当业务代码调用 `xhr.send(body)` 时，SDK 内部通过 `setTimeout` 异步计算行为签名
3. 计算完成后调用 `xhr.setRequestHeader('x-rap-param', value)` 写入签名值
4. 签名内容包含：API 路径、请求体哈希、以及采集到的行为特征（鼠标轨迹、键盘节奏等）

**tweetClaw 的捕获方案（两阶段 XHR Hook）：**

```
Phase 1（立即执行）
  hook XMLHttpRequest.prototype.setRequestHeader
  → 拦截所有 x-rap-param 写入

Phase 2（RAP SDK 加载后）
  Object.defineProperty(window, 'XMLHttpRequest', { set(newXHR) {...} })
  → RAP SDK 替换构造函数时，对新原型重新 hook

异步捕获
  Object.defineProperty(window, '__capturedRapParam', { set(v) { resolve(v) } })
  → Sanji 通过 setTimeout 异步写入时立即 resolve Promise
  → 3 秒超时兜底
```

**合成行为注入（方案 A，已实现）：**

在 `generateRapParam()` 调用 `xhr.send(body)` 之前，注入合成行为序列，让 Sanji 采集到非空的行为数据：

```typescript
injectSyntheticBehavior();  // 58 mousemove + 5 wheel + 1 Tab
xhr.send(body);
```

`injectSyntheticBehavior()` 用 Bézier 曲线生成鼠标路径（基于 ghost-cursor 算法），加入随机滚动和 Tab 键事件。inject script 运行在真实页面 context 里，Sanji 的事件监听器已注册在真实 `window` 上，`dispatchEvent` 的合成事件会被 Sanji 当作真实事件处理。

**残留风险：** 合成事件 `isTrusted=false`，若 Sanji 未来检查此字段则失效。

### 6.2 XYS_ 格式的本质

`XYS_` 是 creator 域写接口的 `x-s` 前缀，标志使用了 `mnsv2` 签名。见第三章。

---

## 七、Layer 6：媒体上传鉴权 — COS HMAC-SHA1

### 7.1 获取上传凭证（Step 1）

```
GET creator.xiaohongshu.com/api/media/v1/upload/creator/permit
    ?biz_name=spectrum&scene=image&file_count=1&version=1&source=web

响应：{
  "data": {
    "uploadTempPermits": [{
      "fileIds": ["spectrum/UcaECZ-..."],
      "expireTime": 1709912483,
      "token": "xxxxxx",
      "uploadAddr": "ros-upload.xiaohongshu.com"
    }]
  }
}
```

提取：
- `fileId`：去掉 `spectrum/` 前缀
- `expireTime`：取前 10 位（秒级）
- `xt`：当前请求 x-t 的前 10 位（秒级）

### 7.2 生成 COS 签名（HMAC-SHA1）

```
message = "{xt};{expireTime}"

Step 1  key = HmacSHA1(message, "null")   ← key 是字符串 "null"

Step 2  canonical = "put\n/spectrum/{fileId}\n\ncontent-length={size}&host={host}\n"
        params = SHA1(canonical).hex()

Step 3  sign_str = "sha1\n{message}\n{params}\n"
        signature = HmacSHA1(sign_str, key).hex()

Authorization: q-sign-algorithm=sha1&q-ak=null
               &q-sign-time={message}&q-key-time={message}
               &q-header-list=content-length;host
               &q-url-param-list=
               &q-signature={signature}
```

`q-ak=null` 是字符串 `"null"` 而非空值，COS 侧用动态 token（`x-cos-security-token` 头）做身份验证，`q-ak` 退化为占位符。

---

## 八、发布请求体结构（Step 3）

```json
POST edith.xiaohongshu.com/web_api/sns/v2/note

{
  "common": {
    "type": "normal",
    "title": "笔记标题",
    "note_id": "",
    "desc": "正文内容 #话题[话题]#",
    "source": "{\"type\":\"web\",\"ids\":\"\",\"extraInfo\":\"{\\\"subType\\\":\\\"official\\\",\\\"systemId\\\":\\\"web\\\"}\"}",
    "business_binds": "{\"version\":1,\"noteId\":0,\"bizType\":0,...}",
    "ats": [],
    "hash_tag": [{"id": "topic_id", "name": "话题名", "type": "topic"}],
    "post_loc": {},
    "privacy_info": {"op_type": 1, "type": 0, "user_ids": []},
    "goods_info": {},
    "biz_relations": [],
    "capa_trace_info": {"contextJson": "{...}"}
  },
  "image_info": {
    "images": [{
      "file_id": "spectrum/{fileId}",
      "width": 1080, "height": 1440,
      "metadata": {"source": -1},
      "stickers": {"version": 2, "floating": []},
      "extra_info_json": "{\"mimeType\":\"image/jpeg\",\"image_metadata\":{\"bg_color\":\"\",\"origin_size\":123.4}}"
    }]
  },
  "video_info": null
}
```

`privacy_info.type`：`0` = 公开，`1` = 私密，`2` = 好友可见  
`business_binds.bizType`：`0` = 立即发布，`13` = 定时发布

---

## 九、完整请求头（Step 3 发布请求）

```
POST /web_api/sns/v2/note HTTP/1.1
Host: edith.xiaohongshu.com
Origin: https://creator.xiaohongshu.com
Content-Type: application/json
Authorization: （空字符串）

x-s:            XYS_2UQhPsHC...     ← mnsv2 签名
x-t:            1709905283000        ← 毫秒时间戳
x-s-common:     2UQAPsHC...          ← 设备指纹绑定
x-b3-traceid:   7f3a2b1c9e4d5f8a    ← 16位随机 hex
x-xray-traceid: cc428472...          ← 32位 xray ID
x-rap-param:    <RAP SDK 输出>       ← 行为风控签名
Cookie: a1=...; web_session=...
```

---

## 十、tweetClaw 发图文完整流程

### 10.1 架构分工

```
┌─────────────────────────────────────────────────────────────────┐
│                        tweetClaw 架构                            │
│                                                                 │
│  background.ts          content script           inject script  │
│  (service worker)       (xhs-main-entrance.ts)   (xhs-sign-    │
│                                                   inject.ts)    │
│  ─ 接收外部指令          ─ 执行 API 请求            ─ 运行在页面   │
│  ─ 健康检查              ─ 图片上传                   context 中  │
│  ─ 自动开 Tab            ─ 组装请求头               ─ 调用        │
│                         ─ 通过 postMessage           window.mnsv2│
│                           与 inject 通信            ─ XHR Hook   │
│                                                     捕获 x-rap  │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 发图文完整步骤

```
外部调用
  chrome.tabs.sendMessage(tabId, { type: 'XHS_PUBLISH_IMAGE_NOTE', ... })
         │
         ▼
[content script] publishImageNote()
         │
         │  Step 1: 逐张上传图片
         │    uploadImage(base64, mimeType)
         │      → getUploadPermit() → requestSign() → [inject] mnsv2 签名
         │      → GET creator.../permit → fileId, expireTime, token
         │      → 本地计算 COS HMAC-SHA1 签名
         │      → PUT ros-upload.../spectrum/{fileId}
         │
         │  Step 2: 组装发帖 body
         │    { common: { title, desc, ... }, image_info: { images: [...] } }
         │
         │  Step 3: 获取 x-s / x-t / x-s-common
         │    requestSign('/web_api/sns/v2/note', bodyStr)
         │      → [inject] mnsv2(path+body, MD5(全文), MD5(path))
         │      → x-s = "XYS_" + base64custom(JSON({x3: result, ...}))
         │      → calcXsCommon(a1, x-s, x-t) → x-s-common
         │
         │  Step 4: 获取 x-rap-param
         │    requestRapParam('/web_api/sns/v2/note', bodyStr)
         │      → [inject] injectSyntheticBehavior() ← 合成行为事件
         │      → [inject] new XMLHttpRequest().send(body) ← 触发 Sanji
         │      → Phase 1/2 Hook → __capturedRapParam setter → Promise resolve
         │      → 3s 超时兜底
         │
         │  Step 5: 组装请求头并发布
         │    POST edith.xiaohongshu.com/web_api/sns/v2/note
         │      → { success: true, data: { id: "...", share_link: "..." } }
         ▼
      返回结果给调用方
```

### 10.3 inject script 签名通信协议

| 消息类型 | 方向 | 用途 |
|---------|------|------|
| `XHS_SIGN_REQUEST` | CS → inject | 请求 mnsv2 签名 |
| `XHS_SIGN_RESPONSE` | inject → CS | 返回 x-s/x-t/x-s-common |
| `XHS_RAP_REQUEST` | CS → inject | 请求 x-rap-param |
| `XHS_RAP_RESPONSE` | inject → CS | 返回 x-rap-param 字符串 |
| `XHS_HEALTH_CHECK_REQUEST` | CS → inject | 检查 mnsv2 是否就绪 |
| `XHS_HEALTH_CHECK_RESPONSE` | inject → CS | 返回健康状态 |

每条消息携带唯一 `msgId`，通过 `pendingSigns` / `pendingRap` / `pendingHealth` Map 做 Promise 配对，超时自动 reject。

### 10.4 健康检查与自动恢复

```
checkXhsSignHealth()
  ↓
找 creator.xiaohongshu.com tab
  ├─ 找不到 → getOrOpenCreatorTab() 自动打开 → 重试
  └─ 找到 → sendMessage(XHS_CHECK_SIGN_HEALTH)
              ↓
           inject script 执行 mnsv2 测试签名
              ├─ ok=true  → 可以发布
              └─ ok=false → reason（inject_timeout / format_changed 等）
```

---

## 十一、Spider_XHS 对比

```
Spider_XHS（逆向方案）              tweetClaw（注入方案）
────────────────────                ────────────────────
提取 JS → 补环境 → execjs 调用       Chrome 扩展 inject script
                                    在真实页面 context 中运行

x-s/x-t：                           直接调用 window.mnsv2()
  提取 mnsv2 到本地重现               或 window._webmsxyw()

x-rap-param：                        两阶段 XHR Hook 捕获
  提取 xhs_rap.js 补环境运行           RAP SDK 异步写入的值

优点：纯 Python，无需浏览器            优点：永远使用最新签名逻辑
缺点：XHS 更新 JS 时需重新提取              无需逆向和补环境
     算法内部变化必须重新实现               x-rap-param 来自真实 SDK 运行
                                    缺点：需要 Chrome 扩展权限
                                         需要用户已打开 creator 页面
```

**tweetClaw 各防护层的处理方式：**

| 防护层 | 小红书手段 | tweetClaw 绕过方式 |
|--------|-----------|-------------------|
| Cookie 身份 | a1 + web_session | 用户已登录浏览器，cookie 自动携带 |
| x-s 签名 | mnsv2 混淆黑盒 | inject script 直接调用页面内 `window.mnsv2()` |
| x-t 时间戳 | 服务端 ±5min 窗口 | 每次请求实时生成 |
| x-s-common | 绑定 a1 + 签名 | inject script 调用页面内 `calcXsCommon()` |
| 链路 ID | 行为分布检测 | 随机生成（格式合法即可）|
| x-rap-param | RAP SDK 行为采集 | 两阶段 XHR Hook + 合成行为注入 |
| COS 上传签名 | HMAC-SHA1 时效凭证 | 公式已逆向，key="null" 字符串，本地计算 |

---

## 十二、版本演进与对抗历史

```
2023 ──  _webmsxyw 函数混淆上线，x-s 签名开始被强制验证

2024 ──  x-s-common 字段上线，a1 绑定到签名

2024 ──  creator 域切换为 mnsv2，签名格式改为 XYS_ 前缀

2025 ──  mnsv2 4.3.2 版本：第三个参数从 MD5(body) 改为 MD5(api_path)

2026 ──  x-rap-param 在写操作上变为强制字段

2026-05 ── tweetClaw P0/P1 修复：两阶段 XHR Hook + 合成行为注入 + 自动开 Tab
```

---

## 十三、历史失败方案分析

### 失败1：拦截 x-s-common 复用

- **做法**：捕获页面真实请求里的 `x-s-common` 并缓存复用
- **失败原因**：`x-s-common` 是基于每次请求的 xs+xt 现场计算的，复用旧值导致验证失败

### 失败2：www tab 路由方案

- **做法**：把签名请求路由到 www tab 计算
- **失败原因**：www 和 creator 页面的 `_webmsxyw` 都产生 `XYW_` 格式，发布接口只接受 `XYS_`

### 失败3：XHR proxy 方案

- **做法**：让 inject script 用页面原生 XHR 发请求，期望 SDK 自动注入 `XYS_` 签名
- **失败原因**：creator 页面的 axios 拦截器只对 `/fe_api/` 路径自动签名，`/web_api/` 不在范围内

**根本原因**：长期用 `_webmsxyw`，但这个函数永远只产生 `XYW_`。`XYS_` 需要 `window.mnsv2`，只能通过逆向 webpack bundle 的请求拦截器源码定位。

---

## 十四、已修复项与残留风险

### ✅ P0 已修复：x-rap-param 两阶段 XHR Hook（2026-05）

两阶段 hook + 异步捕获 + 合成行为注入。已验证：发布 HTTP 200，`success: true`，笔记 ID 正常返回，x-rap-param 内含合成行为数据（`[SyntheticBehavior] injected: 58 mousemove, 5 wheel, 1 Tab`）。

### ✅ P1 已修复：no_creator_tab 自动打开（2026-05）

`checkXhsSignHealth` 检测到 `no_creator_tab` 时，自动调用 `getOrOpenCreatorTab()` 打开 creator 页面，等待 content script 就绪后重试。

### ⚠️ 残留风险

| 风险 | 描述 | 概率 |
|------|------|------|
| RAP isTrusted 检查 | 合成事件 `isTrusted=false`，若 Sanji 未来检查此字段则行为数据失效 | 低 |
| mnsv2 格式变更 | XHS 更新签名 JS，`format_changed` 导致请求被拒 | 中 |
| x-t 漂移 | 多图上传超过 5 分钟时，发布请求的 x-t 超出服务端 ±5min 窗口 | 低 |
| FFF 常量更新 | x-s-common 盐值随 bundle 更新变化 | 中 |

---

## 十五、维护策略

### 15.1 tweetClaw vs Spider_XHS 的维护优势

| 维度 | Spider_XHS | tweetClaw |
|------|-----------|-----------|
| mnsv2 算法内部更新 | 必须重新逆向、重新实现 | **完全不受影响**，调用 XHS 自己的函数 |
| FFF 常量更新 | 必须重新找 | 必须重新找（同等处境）|
| `mnsv2` 被改名/移除 | 不受影响（不依赖 window）| 需要重新找 window 入口 |

### 15.2 FFF 常量变化应对（5 分钟成本）

Spider_XHS 的 Python 代码里包含最新 FFF 常量（他们重现了完整的 x-s-common 算法）。

1. Watch [NanmiCoder/MediaCrawler](https://github.com/NanmiCoder/MediaCrawler) 仓库（含 XHS 签名最新实现）
2. 发现签名相关 commit → 打开 diff
3. 搜索 `I38rHdgsjopg`（FFF 前缀）找到新常量值
4. 更新 `xhs-sign-inject.ts` 里的 `FFF` 常量

### 15.3 `window.mnsv2` 消失应对（30 分钟成本）

```javascript
// 在 creator.xiaohongshu.com DevTools Console 执行
let wpRequire;
window.webpackChunkugc.push([[Symbol()], {}, (r) => { wpRequire = r; }]);
for (const id of Object.keys(wpRequire.m)) {
  const src = wpRequire.m[id].toString();
  if (src.includes('"XYS_"') || src.includes("'XYS_'")) {
    console.log('found:', id, src.slice(0, 300));
  }
}
```

找到新模块 → 找到新的 `window.xxx` 赋值点 → 更新 `signWithMnsv2()` 函数。

### 15.4 Spider_XHS 挂掉是我们的告警信号

Spider_XHS / MediaCrawler issue 区出现大量"签名失效"报告，是 XHS 更新签名的可靠早期信号。出现以下关键词重点关注：`sign failed`、`406`、`x-s`、`签名`、`invalid signature`。

**完整情报链路：**

```
XHS 更新 bundle
    ↓
Spider_XHS issue 区出现报告（早期告警）
    ↓
维护者逆向 → commit 更新代码
    ↓
我们读 diff → 提取 FFF 新值（5分钟）或理解新算法方向（30分钟）
    ↓
更新 xhs-sign-inject.ts → 交给用户编译 → 发布新版扩展
```
