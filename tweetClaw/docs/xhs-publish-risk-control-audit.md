# XHS 发布流程风控指纹审计

> 审计日期：2026-07-12
> 触发事件：发布 12000×7149 超高分辨率图片后账号被 XHS 以"违反社区规范"封禁。
> 审计目标：排查浏览器扩展发布流程中可能被 XHS 风控系统识别为"AI 自动回复 / 机器人"的代码缺陷。
> 审计范围：`src/content/xhs-main-entrance.ts`、`src/platforms/xiaohongshu/sign/xhs-sign-inject.ts`

---

## 结论速览

扩展的 XHS 发布请求存在多个**明显的自动化指纹**，极大概率被 XHS 风控系统（Sanji / RAP）识别为 bot。超高分辨率图片可能只是压垮骆驼的最后一根稻草，**根本原因是发布请求本身就是"裸奔"的 bot 指纹**。

按风险等级分 P0 / P1 / P2 三档，共 9 项问题。

| 优先级 | 问题 | 文件:行 | 一句话 |
|---|---|---|---|
| P0 | 空 `authorization` 头 | xhs-main-entrance.ts:820 | 真实浏览器从不发空 authorization |
| P0 | `x-rap-param` 失败仍发帖 | xhs-main-entrance.ts:807-811 | RAP 是反自动化核心，缺失即 bot 实锤 |
| P0 | `capa_trace_info` 空壳 | xhs-main-entrance.ts:759-763 | 无行为遥测 = 非人类操作 |
| P1 | 零人类行为时序 | 整个 publish 流程 | API 调用间隔≈0，机器枪式 |
| P1 | publish 缺 origin/referer | xhs-main-entrance.ts:833-838 | 上传说 creator，发布说 www，不一致 |
| P2 | content-type 缺 charset | xhs-main-entrance.ts:821 | 真实客户端带 `;charset=UTF-8` |
| P2 | body source 与 API 端点语义不匹配 | xhs-main-entrance.ts:785 | creator API + web source |
| P2 | traceid 纯随机 | xhs-main-entrance.ts:815-816 | 可被统计检测 |
| P2 | `post_loc: {}` 完全空 | xhs-main-entrance.ts:789 | 真实客户端基于 IP 填充 |

---

## P0 — 致命指纹（必须立即修复）

### 1. 空 `authorization` 头 ✅ 假设证伪，无需修复（2026-07-12 抓包复核）

**位置**：`src/content/xhs-main-entrance.ts:818-826`

```typescript
const publishHeaders: Record<string, string> = {
  'accept': 'application/json, text/plain, */*',
  'authorization': '',   // ← 空字符串
  'content-type': 'application/json',
  'x-b3-traceid': xB3TraceId,
  'x-s': signHeaders['x-s'],
  'x-t': signHeaders['x-t'],
  'x-xray-traceid': xXrayTraceId,
};
```

**原审计假设**：真实 XHS web 客户端从不发送空 authorization 头，空字符串是 bot 指纹。

**抓包复核（4.log，2026-07-12）**：在 `creator.xiaohongshu.com` 手动发帖抓取的 `POST /web_api/sns/v2/note` 请求中，header 第 5 行**确实带 `"authorization": ""`**。真实 creator 客户端就是发空 authorization 字符串。

**结论**：原审计假设证伪。删除空 authorization 头反而会制造与真实客户端的指纹差异（真实客户端有空头，扩展没有）。**保留 `'authorization': ''`，不修复。** 代码已回滚为保留空头，并加注释说明抓包依据。

> 同步修正：`publishImageNote` 与 `publishVideoNote` 两处 `publishHeaders` 均保留 `'authorization': ''`。

---

### 2. `x-rap-param` 失败被当 non-fatal ✅ 已修复（2026-07-12）

**位置**：`src/content/xhs-main-entrance.ts:805-811`

```typescript
// 5.5 获取 x-rap-param（RAP SDK 行为签名，写操作必须携带）
let xRapParam = '';
try {
  xRapParam = await requestRapParam(postApi, bodyStr);
} catch (rapErr: any) {
  console.warn(`${TAG} x-rap-param request failed (non-fatal): ${rapErr.message}`);
}
```

**问题**：`x-rap-param` 是 XHS 的 **RAP SDK 行为签名**（Sanji 反作弊系统），专门检测"是否真人操作"。把它当 non-fatal 意味着：**RAP 计算失败时仍然发帖，请求里不带 `x-rap-param`**。对 XHS 服务端来说，一个写操作没有 RAP 签名 = 机器人实锤。

同样的问题在 `publishVideoNote` 也存在（line 1063-1064）。

**修复**：改为 fatal——RAP 失败就 abort 发布，不继续。

```typescript
let xRapParam: string;
try {
  xRapParam = await requestRapParam(postApi, bodyStr);
} catch (rapErr: any) {
  throw new Error(`x-rap-param 获取失败，放弃发布（RAP 签名是写操作必需）: ${rapErr.message}`);
}
if (!xRapParam) {
  throw new Error('x-rap-param 为空，放弃发布（RAP 签名是写操作必需）');
}
```

---

### 3. `capa_trace_info` 是空壳 ✅ 已修复（2026-07-12，短期方案）

**位置**：`src/content/xhs-main-entrance.ts:759-763`

```typescript
const contextJson = JSON.stringify({
  recommend_title: { recommend_title_id: '', is_use: 3, used_index: -1 },
  recommendTitle: [],
  recommend_topics: { used: [] },
});
```

**问题**：`capa_trace_info`（capability trace）是 XHS 收集用户行为数据的地方——鼠标轨迹、输入节奏、滚动事件、焦点切换等。扩展只发了一个空壳 stub，所有数组为空。真实客户端会填充大量行为数据。**空 capa_trace_info = 无行为数据 = 非人类操作**。

**修复方向**（两种选择，需进一步调研真实客户端行为）：

- **方案 A（短期）**：从页面 RAP SDK / `window` 对象提取真实行为数据，填充到 contextJson。
- **方案 B（长期）**：在 content script 里注入行为监听（鼠标移动、键盘输入时序），在发布前打包成 capa_trace_info。

短期至少应填充非空的模拟数据，避免全空数组。需要抓包真实 creator 端发布请求，对照其 capa_trace_info 结构填充合理默认值。

**本次修复（已对齐抓包，2026-07-12）**：抓包复核（4.log）确认真实 creator 客户端的 `capa_trace_info.contextJson` **并不携带鼠标轨迹/输入节奏等遥测字段**，结构远比推测的简单。真实结构为：

```json
{
  "recommend_title": {"recommend_title_id": "", "is_use": 3, "used_index": -1},
  "recommendTitle": [],
  "recommend_topics": {
    "used": [
      {"id": "61e24ac3...", "name": "个人开发者", "topic_source": "recommend_exposed_display"},
      {"id": "63aabcad...", "name": "AI智能体", "topic_source": "search_offical"}
    ]
  }
}
```

关键差异：原扩展 `recommend_topics.used` 恒为空 `[]`，而真实客户端会把**本次发布实际使用的话题**填进去（含 `topic_source` 字段标记话题来源）。这才是"非人类"的真实信号——真人发帖选了话题，used 数组非空；扩展从不填，恒空。

`buildCapaTraceContext(topics)` 已改为接收本次发布的话题列表，填充 `recommend_topics.used`，每项含 `id`/`name`/`topic_source`。`publishImageNote` 与 `publishVideoNote` 均已传入 `topics`。

> 注：`topic_source` 当前统一填 `recommend_exposed_display`（抓包中推荐话题的来源标记）。若话题来自用户主动搜索，真实客户端用 `search_offical`。后续可按话题来源区分，但当前扩展不区分话题来源，统一值已足够避免空壳指纹。

---

## P1 — 高风险指纹（尽快修复）

### 4. 零人类行为时序 ✅ 已修复（2026-07-12）

**位置**：整个 `publishImageNote` / `uploadImageFromBytes` 流程

**问题**：整个发帖流程：
```
getUploadPermit → PUT COS → publishImageNote
```
全部在几秒内完成，没有任何模拟人类操作的延迟。真实用户的时序是：
- 打开发布页 → 选图（几秒到几十秒）→ 输入标题（几秒）→ 输入正文 → 选话题 → 点发布

扩展的 API 调用间隔几乎为 0，这是 bot 检测的最基础信号。

**修复**：在 permit → upload → publish 之间加随机延迟。

```typescript
async function humanDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  await new Promise(resolve => setTimeout(resolve, ms));
}

// 在 publishImageNote 中：
// 上传后 → 发布前，模拟"用户输入标题正文后点发布"
await humanDelay(2000, 6000);
```

多图场景下，每张图上传之间也应加随机间隔（1-3 秒），模拟用户逐张选图。

**本次修复**：新增 `humanDelay(minMs, maxMs)` 工具函数（line 217）。
- `publishImageNote`：多图上传循环中，每张图上传之间加 `humanDelay(1000, 3000)`（line 802）；上传完成后到发布前加 `humanDelay(2000, 6000)`（line 896）。
- `publishVideoNote`：上传完成后到发布前加 `humanDelay(2000, 6000)`（line 1155）。

---

### 5. publish 请求缺 `origin` / `referer` 显式设置 ✅ 已修复（2026-07-12，校验页面域名方案）

**位置**：`src/content/xhs-main-entrance.ts:833-838`

```typescript
const response = await fetch(publishUrl, {
  method: 'POST',
  headers: publishHeaders,  // ← 没有 origin / referer
  body: bodyStr,
  credentials: 'include',
});
```

**问题**：浏览器会自动注入 origin/referer，但值取决于 content script 所在页面。如果用户不在 `creator.xiaohongshu.com/publish/publish?...` 页面，referer 就不对。而上传请求（`uploadImageFromBytes` line 542-543）显式设了 `origin: 'https://creator.xiaohongshu.com'`，publish 却没设——**上传说"我来自 creator"，发布说"我来自 www"**，这种不一致是指纹。

**修复**：publish 请求显式设置 origin 和 referer。

```typescript
const publishHeaders: Record<string, string> = {
  'accept': 'application/json, text/plain, */*',
  'content-type': 'application/json;charset=UTF-8',
  'origin': 'https://creator.xiaohongshu.com',
  'referer': 'https://creator.xiaohongshu.com/publish/publish?source=official&from=menu&target=image',
  'x-b3-traceid': xB3TraceId,
  'x-s': signHeaders['x-s'],
  'x-t': signHeaders['x-t'],
  'x-xray-traceid': xXrayTraceId,
};
```

> 注意：`fetch()` 中 `origin` 是 [forbidden header](https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_header_name)，浏览器会忽略手动设置。需要改用 inject script（page context）的 `XMLHttpRequest` 发送，或确认 content script 所在页面就是 creator publish 页（此时浏览器自动注入正确的 origin/referer）。建议在调用前校验 `location.hostname === 'creator.xiaohongshu.com'`，否则拒绝发布。

**本次修复（校验页面域名方案）**：新增 `assertCreatorPublishPage()` 工具函数（line 227），在 `publishImageNote`（line 776）与 `publishVideoNote`（line 958）入口处调用。若 `location.hostname !== 'creator.xiaohongshu.com'` 则 `throw` 中止发布，错误信息明确提示需在创作者发布页执行。这样浏览器自动注入的 origin/referer 会与上传请求一致，避免 www/creator 不一致指纹。未手动设置 origin/referer（forbidden header，设了也会被浏览器忽略）。

---

## P2 — 中风险指纹（建议修复）

### 6. `content-type` 缺 charset

**位置**：`src/content/xhs-main-entrance.ts:821`

```typescript
'content-type': 'application/json',
```

**问题**：真实 XHS web 客户端发的是 `application/json;charset=UTF-8`（见同文件 `signedFetch` 函数 line 240 就是带 charset 的）。publish 请求却少了 `;charset=UTF-8`，这种细微差异可以被指纹。

**修复**：

```typescript
'content-type': 'application/json;charset=UTF-8',
```

---

### 7. body `source` 与 API 端点语义不匹配

**位置**：`src/content/xhs-main-entrance.ts:785`

```typescript
source: '{"type":"web","ids":"","extraInfo":"{\\"subType\\":\\"official\\",\\"systemId\\":\\"web\\"}"}',
```

**问题**：发布端点 `/web_api/sns/v2/note` 是 creator 端 API，但 source 声明是 "web" 消费端。真实 creator 端发布可能用不同的 source 值。这种 body 字段与 API 端点的语义不匹配可能被服务端交叉校验。

**修复**：需抓包真实 creator 端发布请求，确认其 `source` 字段值。如果 creator 端用不同的 source（如 `{"type":"creator",...}`），需对齐。

---

### 8. `x-b3-traceid` / `x-xray-traceid` 纯随机

**位置**：`src/content/xhs-main-entrance.ts:815-816`

```typescript
const xB3TraceId = Array.from({ length: 16 }, () => hexChars[Math.floor(Math.random() * 16)]).join('');
const xXrayTraceId = Array.from({ length: 32 }, () => hexChars[Math.floor(Math.random() * 16)]).join('');
```

**问题**：真实客户端的 traceid 可能基于 session 上下文派生，纯 `Math.random()` 生成的值在大量请求下可能被统计检测（例如同一 session 内 traceid 完全无关联）。

**修复**：调研真实客户端 traceid 生成逻辑。如果无法确定，至少在同一发布会话内让 traceid 有某种关联性（如基于同一 seed 派生）。

---

### 9. `post_loc: {}` 完全空

**位置**：`src/content/xhs-main-entrance.ts:789`

```typescript
post_loc: {},
```

**问题**：真实客户端可能基于 IP / 浏览器 geolocation 填充地理位置信息。完全空的 `post_loc` 可能被指纹。

**修复**：抓包确认真实客户端是否填充 post_loc。如果填充，需对齐结构。

---

## 修复路线图

### 阶段 1：止血（P0，立即）

1. 删除 `authorization: ''` 空头
2. `x-rap-param` 失败改为 fatal，阻断发布
3. `capa_trace_info` 至少填充非空模拟数据（需抓包对照真实结构）

### 阶段 2：降低指纹（P1，本周）

4. 加入人类行为时序延迟（permit→upload→publish 间 2-6 秒，多图 1-3 秒/张）
5. publish 请求校验 `location.hostname === 'creator.xiaohongshu.com'`，确保 origin/referer 正确；或改用 page context XHR 发送

### 阶段 3：对齐真实客户端（P2，后续）

6. content-type 加 `;charset=UTF-8`
7. 抓包确认 creator 端真实 `source` / `post_loc` / traceid 生成逻辑，对齐

---

## 验证方式

修复后需验证：

1. **抓包对照**：用 Chrome DevTools 抓取真实用户在 creator.xiaohongshu.com 手动发帖的请求，逐头对照扩展发出的请求，确保无差异。
2. **小号测试**：用非主账号发布合规图片（长边 ≤4096px），观察是否仍触发风控。
3. **RAP 健康检查**：发布前调用 `requestSignHealth()`，确认 mnsv2 和 RAP SDK 均正常。
4. **日志确认**：发布日志中应出现 `x-rap-param` 非空、无空 authorization 头、capa_trace_info 非空。

---

## 相关文档

- `docs/image-upload-check-design.md`（TweetPilot 仓库）— XHS 超高分辨率保护性阻断设计
- `docs/xhs-ig-image-chunked-upload-design.md`（TweetPilot 仓库）— 分片上传端到端设计
