# 小红书发布图文笔记：反垃圾体系与签名绕过原理

> 视角：**小红书安全团队**如何设计请求合法性验证体系，以及 Spider_XHS / tweetClaw 如何绕开这些限制。

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
│    x-rap-param ── RAP 沙箱行为签名（creator 域）                  │
│    XYS_ 格式   ── mnsv2 黑盒混淆签名（creator 域写接口）           │
│                                                                 │
│  Layer 6: 媒体上传鉴权层                                          │
│    COS HMAC-SHA1 Authorization ── 腾讯云对象存储上传凭证          │
└─────────────────────────────────────────────────────────────────┘
```

发布一篇图文笔记需要**按顺序**完成以下 3 个 API 调用：

```
Step 1  GET  creator.xiaohongshu.com /api/media/v1/upload/creator/permit
         ↓ 获取 COS 上传凭证（token + fileId + expireTime）

Step 2  PUT  ros-upload.xiaohongshu.com /spectrum/{fileId}
         ↓ 将图片上传到腾讯云 COS

Step 3  POST edith.xiaohongshu.com /web_api/sns/v2/note
         ↓ 提交笔记元信息（标题、正文、图片 fileId 列表）
```

---

## 二、Layer 1：Cookie 身份层

### 2.1 a1 — 设备指纹 Cookie

`a1` 是小红书在用户**首次访问**时由前端 JS 生成并写入的设备指纹 Cookie，生命周期约 1 年。

**生成逻辑（推断）：**
- 基于浏览器 fingerprint（UA、Canvas、WebGL、字体、分辨率等）
- 加入随机盐 + 时间戳
- 服务端在首次请求时记录该值，后续请求中用于**将签名绑定到固定设备**

```
格式示例：1908d1a0b6eb13b5egsm8ggm97q17yfuv92n4l0g850000266761
         └─时间戳前缀─┘└──────────随机字符串──────────────┘
```

**为什么重要：** `a1` 是 `x-s-common` 的输入之一。如果 `a1` 与签名中绑定的 `a1` 不一致，服务端验证失败。

### 2.2 web_session — 登录态 Cookie

标准的 session token，登录后由服务端下发。没有这个 Cookie，所有 API 直接返回未登录错误。

---

## 三、Layer 2：请求签名层 — x-s 与 x-t

这是防御体系的核心。`x-s` 是对**请求路径 + 请求体**的哈希签名，服务端对每个请求重新计算验证。

### 3.1 www 域：`_webmsxyw` 函数

访问 `www.xiaohongshu.com` 时，页面会加载一个混淆 JS，把签名函数注入到 `window._webmsxyw`。

**签名流程（www 域）：**

```
输入：  api_path + request_body + a1_cookie

       ┌──────────────────────────────────────────┐
       │  window._webmsxyw(api_path, body, a1)    │
       │  ↓ 内部做了若干混淆操作（黑盒）             │
       │  返回：{ "X-s": "...", "X-t": 1234567890 }│
       └──────────────────────────────────────────┘

x-s = 结果["X-s"]
x-t = 结果["X-t"]  ← 毫秒时间戳
```

### 3.2 creator 域：`mnsv2` 函数（4.3.2 版本）

`creator.xiaohongshu.com` 使用了一套更复杂的签名体系，签名函数叫 `window.mnsv2`，最终结果用 `XYS_` 前缀标识。

**签名流程（creator 域，4.3.2 版本）：**

```
输入：api_path, request_body

Step 1  拼接完整字符串
        fullStr = api_path + body_json_string

Step 2  计算两个 MD5
        c = MD5(fullStr)          ← 整体哈希
        d = MD5(api_path)         ← 路径哈希（4.3.2 新增，之前版本是 MD5(body)）

Step 3  调用黑盒函数
        s = window.mnsv2(fullStr, c, d)   ← 返回一串不可读的哈希字符串

Step 4  构建签名对象
        signObj = {
            x0: "4.3.2",    ← SDK 版本号
            x1: "ugc",      ← 业务线标识（user generated content）
            x2: "Windows",  ← 平台
            x3: s,          ← mnsv2 输出
            x4: "object"    ← 数据类型标记（有 data 时为 "object"，无 data 时为 ""）
        }

Step 5  编码输出
        x-s = "XYS_" + base64_custom(utf8_encode(JSON.stringify(signObj)))
```

**自定义 base64 字符表（非标准）：**
```
标准 base64：ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/
小红书自用：  ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5
```
这是防止工具直接解码 `x-s` 内容的混淆手段。

---

## 四、Layer 3：设备指纹绑定层 — x-s-common

`x-s-common` 的作用是**把 a1（设备）与本次签名（x-s、x-t）强绑定**，防止一个账号的签名被另一个设备复用。

**生成流程：**

```
输入：a1, x-s, x-t

Step 1  计算绑定哈希
        md5_url2 = MD5(str(x-t) + x-s + fff)
        其中 fff 是一个写死在 JS 里的长字符串（起盐的作用）

Step 2  CRC32 校验
        x9 = CRC32(hex_to_bytes(md5_url2))

Step 3  构建数据包
        d = {
            s0: 5,
            s1: "",
            x0: "1",
            x1: "4.3.2",      ← SDK 版本
            x2: "Windows",    ← 平台
            x3: "ugc",        ← 业务线
            x4: "4.84.1",     ← App 版本
            x5: a1,           ← 设备指纹（关键绑定字段）
            x6: x-t,          ← 时间戳
            x7: x-s,          ← 本次签名
            x8: fff,          ← 盐值
            x9: CRC32结果,
            x10: 0,
            x11: "normal",
        }

Step 4  编码输出
        x-s-common = base64_custom(utf8_encode(JSON.stringify(d)))
```

服务端解码后，对比 `x5`（a1）是否与请求 Cookie 中的 `a1` 一致，不一致则拒绝。

---

## 五、Layer 4：链路追踪层

### 5.1 x-b3-traceid（Zipkin 格式）

```python
# 生成方式：16 位随机 hex 字符串
x_b3_traceid = ''.join(random.choice('abcdef0123456789') for _ in range(16))
# 示例：7f3a2b1c9e4d5f8a
```

这是 Zipkin 分布式链路追踪 ID，服务端用于日志关联，也可以作为**异常请求检测的辅助特征**（机器人生成的 traceid 分布往往与正常用户不同）。

### 5.2 x-xray-traceid（小红书自研）

```python
# 通过 xhs_xray.js 中的 traceId() 函数生成
# 格式：32 位 hex 字符串
# 示例：cc428472e3e116d000ea48806dce1d78
```

xray 是小红书自研的链路追踪系统，`traceId()` 内部会采集部分环境信息参与生成，使得纯随机生成的 ID 容易被识别。

---

## 六、Layer 5：行为风控层（写操作专属）

### 6.1 RAP 沙箱 — x-rap-param

RAP（Risk Analysis Platform）是小红书的行为风控系统，只在**写操作**时启用。

`x-rap-param` 通过一个 iframe 沙箱生成，沙箱内运行的 JS 会：
1. 采集鼠标轨迹、键盘输入节奏等行为特征
2. 对 API 路径 + 请求体做签名
3. 将行为特征 + 签名打包编码后输出

```python
# Spider_XHS 的处理方式：
x_rap_param = generate_x_rap_param(api_path, request_body, app_id)
# 内部调用 xhs_rap.js 中 generate_x_rap_param() 函数
# xhs_rap.js 是从浏览器中提取的完整 RAP SDK，在 Node.js 中补环境运行
```

**关键细节：** `x-rap-param` 不在所有接口上出现，只在高风险写操作（发帖 `/web_api/sns/v2/note`、评论、点赞等）才必须携带，是最难伪造的一层。

### 6.2 XYS_ 格式的本质

`XYS_` 是 creator 域写接口的 `x-s` 前缀，标志使用了 `mnsv2` 签名而非旧的 `_webmsxyw` 签名。两者的区别在于：

| 特征 | `_webmsxyw`（www 域） | `mnsv2`（creator 域） |
|------|------|------|
| 调用方式 | `_webmsxyw(path, body, a1)` | `mnsv2(fullStr, c, d)` |
| 输出格式 | 无固定前缀 | `XYS_` 前缀 |
| 第三个参数 | a1 | MD5(api_path)（4.3.2 开始）|
| 适用场景 | www 域读写 | creator 域读写 |

---

## 七、Layer 6：媒体上传鉴权 — COS HMAC-SHA1

图片上传到腾讯云 COS（Cloud Object Storage）需要携带一个时间敏感的 `Authorization` 头。

### 7.1 获取上传凭证（Step 1）

```
GET creator.xiaohongshu.com/api/media/v1/upload/creator/permit
    ?biz_name=spectrum&scene=image&file_count=1&version=1&source=web

响应：
{
  "data": {
    "uploadTempPermits": [{
      "fileIds": ["spectrum/UcaECZ-40xa7Uir1V8msV4XAq3bF6E8m16IT5eoR6Z12spg"],
      "expireTime": 1709912483,     ← Unix 时间戳（秒），约 2 小时有效
      "token": "xxxxxx",            ← 腾讯云临时 token
      "uploadAddr": "ros-upload.xiaohongshu.com"
    }]
  }
}
```

从中提取：
- `fileId` = `UcaECZ-40xa7Uir1V8msV4XAq3bF6E8m16IT5eoR6Z12spg`（去掉 `spectrum/` 前缀）
- `expireTime` = `1709912483`（取前 10 位）
- `token` = 腾讯云 STS 临时密钥 token
- `xt`（x-t 的前 10 位）= 当前请求 x-t 的秒级时间戳

### 7.2 生成 COS 签名（HMAC-SHA1）

```
message = f"{xt};{expireTime}"
# 示例: "1709905283;1709912483"

Step 1  用 "null" 作为密钥（注意：key 字符串就是 "null"）
        key_bytes = HmacSHA1(message, "null")

Step 2  构建被签名字符串
        new_message = "put\n"
                    + f"/spectrum/{fileId}\n"
                    + "\n"
                    + f"content-length={file_size}&host={upload_host}\n"

Step 3  SHA1 哈希
        params = SHA1(new_message).hex()

Step 4  构建最终签名串
        final_message = f"sha1\n{message}\n{params}\n"

Step 5  用 Step 1 的 key_bytes 签名
        signature = HmacSHA1(final_message, key_bytes).hex()
```

最终 Authorization 头：
```
q-sign-algorithm=sha1
&q-ak=null
&q-sign-time={message}
&q-key-time={message}
&q-header-list=content-length;host
&q-url-param-list=
&q-signature={signature}
```

**注意：** `q-ak=null` 是字符串 `"null"` 而非空值，这个反直觉的设计意味着 COS 侧用的是动态 `token`（`x-cos-security-token` 头）做身份验证，`q-ak` 退化为占位符。

---

## 八、发布请求体结构（Step 3）

```json
POST edith.xiaohongshu.com/web_api/sns/v2/note
Content-Type: application/json

{
  "common": {
    "type": "normal",
    "title": "笔记标题",
    "note_id": "",
    "desc": "正文内容 #话题[话题]#",
    "source": "{\"type\":\"web\",\"ids\":\"\",\"extraInfo\":\"{\\\"subType\\\":\\\"official\\\",\\\"systemId\\\":\\\"web\\\"}\"}",
    "business_binds": "{\"version\":1,\"noteId\":0,\"bizType\":0,...}",
    "ats": [],
    "hash_tag": [
      {"id": "topic_id", "link": "...", "name": "话题名", "type": "topic"}
    ],
    "post_loc": {},
    "privacy_info": {
      "op_type": 1,
      "type": 0,      ← 0=公开 1=仅自己可见
      "user_ids": []
    },
    "goods_info": {},
    "biz_relations": [],
    "capa_trace_info": {"contextJson": "{...}"}
  },
  "image_info": {
    "images": [
      {
        "file_id": "spectrum/{fileId}",    ← 上传成功的 fileId，加 spectrum/ 前缀
        "width": 1080,
        "height": 1440,
        "metadata": {"source": -1},
        "stickers": {"version": 2, "floating": []},
        "extra_info_json": "{\"mimeType\":\"image/jpeg\",\"image_metadata\":{\"bg_color\":\"\",\"origin_size\":123.4}}"
      }
    ]
  },
  "video_info": null
}
```

**`business_binds` 字段的含义：**
```json
{
  "version": 1,
  "noteId": 0,
  "bizType": 0,       ← 0=立即发布，13=定时发布
  "notePostTiming": {},      ← 定时发布时填 {"postTime": "1234567890000"}
  "noteCollectionBind": {"id": ""},
  "coProduceBind": {"enable": true},    ← 允许合拍
  "noteCopyBind": {"copyable": true},   ← 允许转载
  "interactionPermissionBind": {"commentPermission": 0}  ← 0=所有人可评论
}
```

---

## 九、完整请求头（Step 3 发布请求）

```
POST /web_api/sns/v2/note HTTP/1.1
Host: edith.xiaohongshu.com
Origin: https://creator.xiaohongshu.com
Referer: https://creator.xiaohongshu.com/
Content-Type: application/json
Authorization: （空字符串，由 cookie 鉴权）

x-s:          XYS_2UQhPsHC...     ← mnsv2 签名，XYS_ 前缀
x-t:          1709905283000        ← 毫秒时间戳
x-s-common:   2UQAPsHC...          ← 设备指纹绑定（很长，约 2000+ 字符）
x-b3-traceid: 7f3a2b1c9e4d5f8a    ← 16位随机 hex
x-xray-traceid: cc428472...        ← 32位 xray ID
x-rap-param:  <RAP SDK 输出>       ← 行为风控签名
Cookie: a1=...; web_session=...
```

---

## 十、Spider_XHS 的绕过策略

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Spider_XHS 绕过策略总览                           │
│                                                                     │
│  防护层          小红书手段               Spider_XHS 绕过方式          │
│  ─────────────  ──────────────────────   ────────────────────────── │
│  Cookie 身份     a1 + web_session         用户手动提供真实 cookie      │
│                                                                     │
│  x-s 签名        mnsv2 混淆黑盒函数         提取 mnsv2 到本地，用        │
│                 _webmsxyw 混淆黑盒函数      execjs 在 Node.js 中运行    │
│                                                                     │
│  x-t 时间戳      服务端有效窗口约 ±5min      每次请求实时生成             │
│                                                                     │
│  x-s-common     绑定 a1 + 签名             同一套 JS 中实现，          │
│                 CRC32 校验                 连同 mnsv2 一起运行         │
│                                                                     │
│  链路 ID         行为分布检测               随机生成（格式合法即可）       │
│                                                                     │
│  x-rap-param    RAP 沙箱行为采集           提取完整 RAP SDK，          │
│                                           补浏览器环境后运行           │
│                                                                     │
│  COS 上传签名    HMAC-SHA1 时效凭证         公式已逆向，               │
│                                           key="null" 字符串          │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.1 补环境技术（Environment Patching）

`mnsv2` 和 RAP SDK 的 JS 代码虽然混淆，但**不能被修改**（修改会导致签名错误）。Spider_XHS 的策略是在 Node.js 里**构造一个假浏览器环境**，让这段 JS 以为自己在真实的浏览器里运行：

```javascript
// xhs_creator_260411.js 中的补环境示例
Navigator = function () {}
Navigator.prototype = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
    webdriver: false,          ← 关键：不能暴露是 webdriver
}
navigator = watch(new Navigator(), 'navigator')

// localStorage 里甚至要填入真实的历史数据
localStorage = {
    "b1": "I38rHdgsjopg...",   ← 这些是从真实浏览器里提取的
    "guide-ImageNoteGuide": "{...}",
}
```

### 10.2 tweetClaw 的进化方案

tweetClaw 用了更彻底的方案：**不做任何逆向，直接复用真实浏览器里的签名函数**。

```
Spider_XHS（逆向方案）              tweetClaw（注入方案）
────────────────────                ────────────────────
提取 JS → 补环境 → execjs 调用       Chrome 扩展 inject script
                                    ↓ 在真实页面 context 中
优点：纯 Python，无需浏览器           直接调用 window.mnsv2()
缺点：小红书更新 JS 时需要重新提取      window._webmsxyw()
     补环境可能不完整导致签名错误      
                                    优点：永远使用最新签名逻辑
                                         无需逆向和补环境
                                    缺点：需要 Chrome 扩展权限
                                         需要用户已打开相关页面
```

---

## 十一、版本演进与对抗历史

```
时间线

2023 ──  _webmsxyw 函数混淆上线，x-s 签名开始被强制验证
          ↓ Spider_XHS：提取 _webmsxyw 到本地运行

2024 ──  x-s-common 字段上线，a1 绑定到签名
          ↓ Spider_XHS：同步实现 XsCommon()

2024 ──  creator 域切换为 mnsv2，签名格式改为 XYS_ 前缀
          ↓ Spider_XHS：提取 mnsv2 + 更新 xhs_creator_260411.js

2025 ──  mnsv2 4.3.2 版本：第三个参数从 MD5(body) 改为 MD5(api_path)
          ↓ Spider_XHS：更新 seccore_signv2() 中的参数顺序

2026 ──  x-rap-param 在写操作上变为强制字段
          ↓ Spider_XHS：提取完整 RAP SDK (xhs_rap.js)
```

---

## 十二、关键数据流图

```
用户 Cookie (a1 + web_session)
         │
         ├──────────────────────────────────────┐
         │                                      │
         ▼                                      ▼
┌─────────────────┐                  ┌───────────────────┐
│ Step 1: 获取     │                  │ x-s-common 计算    │
│ COS 上传凭证     │                  │                   │
│                 │                  │ XsCommon(          │
│ GET /permit     │                  │   a1,              │
│   ↓             │                  │   x-s,             │
│ fileId          │                  │   x-t              │
│ token           │                  │ )                  │
│ expireTime      │                  └───────────────────┘
└────────┬────────┘                            │
         │                                     │
         ▼                                     │
┌─────────────────┐                            │
│ Step 2: 上传图片 │                            │
│ to COS          │                            │
│                 │                            │
│ message =       │                            │
│  "{xt};{expire}"│                            │
│   ↓             │                            │
│ HMAC-SHA1 签名  │                            │
│   ↓             │                            │
│ PUT /spectrum/  │                            │
│   {fileId}      │                            │
│   ↓             │                            │
│ 上传成功         │                            │
└────────┬────────┘                            │
         │                                     │
         ▼                                     ▼
┌───────────────────────────────────────────────────┐
│ Step 3: 发布笔记                                    │
│                                                   │
│ Body = {common: {...}, image_info: {images: [     │
│           {file_id: "spectrum/{fileId}", ...}     │
│        ]}}                                        │
│   ↓                                               │
│ mnsv2(api_path + body, MD5(全文), MD5(path))       │
│   ↓                                               │
│ x-s = "XYS_" + base64custom(JSON({x3: 结果,...})) │
│   ↓                                               │
│ POST edith.xiaohongshu.com/web_api/sns/v2/note    │
│ Headers: x-s, x-t, x-s-common, x-rap-param, ...  │
└───────────────────────────────────────────────────┘
```

---

## 十三、最难突破的环节：x-rap-param

在所有防护层中，`x-rap-param` 是技术含量最高、最难稳定绕过的一层。

**根本原因：**

```
普通签名（x-s）：  确定性函数
                  给定相同输入 → 永远输出相同结果
                  → 提取 JS 本地运行，完全可复现

RAP（x-rap-param）：非确定性，输出里混入了行为数据
                    → 鼠标轨迹、键盘节奏、停留时长、滚动行为
                    → 服务端有 ML 模型对行为模式打分
                    → 纯机器生成的行为数据会被识别
```

Spider_XHS 目前提取完整 RAP SDK 补环境运行能够通过，是因为小红书目前对 creator 域写操作的 RAP 校验阈值还没有卡死——行为数据为空或随机时，只要其他层都对，仍然放行。**这是一个随时可能被收紧的口子。**

---

## 十四、tweetClaw 当前方案的脆弱点

### 脆弱点 1（P0，最严重）：x-rap-param 完全缺失

查看发布代码中的请求头组装：

```typescript
// src/content/xhs-main-entrance.ts - publishImageNote()
const publishHeaders: Record<string, string> = {
    'accept': '...',
    'authorization': '',
    'content-type': 'application/json',
    'x-b3-traceid': xB3TraceId,
    'x-s': signHeaders['x-s'],
    'x-t': signHeaders['x-t'],
    'x-xray-traceid': xXrayTraceId,
};
// ← x-rap-param 完全没有
```

而 Spider_XHS 发布时明确有这一行：

```python
# apis/xhs_creator_apis.py - post_note()
headers['x-rap-param'] = generate_x_rap_param(post_api, data)  ← 有
```

**现在能发布成功，只是因为小红书对 creator 域写操作的 RAP 校验还没有全量强制。**
一旦强制，发布请求会直接被拒绝，且我们没有任何降级方案。

### 脆弱点 2（P1，次严重）：整条链路依赖 creator Tab 存活

tweetClaw 的签名依赖链：

```
edith.xiaohongshu.com 发布请求
         ↑ 需要 x-s（mnsv2 输出）
         ↑ 需要 creator tab 存活
         ↑ 需要 mnsv2 已加载到页面
         ↑ 需要 inject script 已注入
         ↑ 任何一环断，签名失败
```

具体断点风险：

| 场景 | 错误 | 影响 |
|------|------|------|
| 用户关掉 creator 标签页 | `no_creator_tab` | 完全无法签名 |
| 小红书更新 mnsv2 逻辑 | `format_changed` | 签名格式变了，请求被拒 |
| 页面刚打开 mnsv2 未加载 | `inject_timeout` | 8 秒超时失败 |
| 大量图片上传耗时 > 5 分钟 | x-t 过期 | 服务端判定时间戳失效 |

Spider_XHS 没有这个问题，因为它把 mnsv2 提取到本地离线运行，没有任何外部依赖。

---

## 十五、两种方案综合对比

```
维度                Spider_XHS（逆向方案）      tweetClaw（注入方案）
────────────────    ──────────────────────     ──────────────────────
x-rap-param         有（行为数据为伪造）          完全没有 ← P0 风险
mnsv2 更新适配       需手动重新提取 JS             自动跟随最新版本 ✓
Tab 依赖             无，完全本地离线              依赖 creator tab 存活
x-t 时效             每次实时生成，无漂移风险        多图上传时存在漂移风险
长期稳定性            更新 JS 前稳定               mnsv2 自适应，但 RAP 是定时炸弹
```

---

## 十六、修复优先级与建议方向

### P0：补 x-rap-param

两条路径可选：

**方案 A（注入路径，优先）：**
在 inject script 里探测 `creator.xiaohongshu.com` 页面是否加载了 RAP SDK，
若有则直接调用页面内的 `generate_x_rap_param()`，通过 `window.postMessage` 传回，
与现有 mnsv2 注入方案保持一致，零额外逆向工作。

**方案 B（提取路径，备用）：**
参考 Spider_XHS，把 `xhs_rap.js` 打包进 inject script，
在本地补环境运行，作为 Tab 不可用时的降级兜底。

### P1：Tab 不存在时的降级

可在 `checkXhsSignHealth` 检测到 `no_creator_tab` 时，
通过 `chrome.tabs.create` 自动打开 `creator.xiaohongshu.com`，
等待 mnsv2 加载完毕（healthCheck ok=true）后再执行发布。
