# Content Script 存活上报 + 周期刷新方案（替代原心跳 / 断线重连）

> 创建: 2026-08-13
> 取代: 原 `content-script-heartbeat-design.md`（心跳 + 两阶段断线重连 + `location.reload()` 兜底）

---

## 一、为什么废弃原方案

原方案在 content script 与 background 之间维持一条持久的 `chrome.runtime.Port`，
每 20 秒 ping 一次，5 秒未收到 pong 就判定断线，进入「重连 → 失败则 `location.reload()`」的恢复流程。

在 MV3 的真实环境里这套方案会**反过来制造问题**：

1. **`connect()` 唤醒 SW 并不等于 SW 已就绪**。MV3 service worker 冷启动需要重新求值整个
   `background.ts`（3000+ 行，顶部还有 `chrome.storage.local.get(...).then()` 的异步初始化），
   在 `chrome.runtime.onConnect` / `port.onMessage` 监听器重新挂上之前，content script 发来的
   ping 会被静默丢弃，pong 回不来。
2. **`location.reload()` 会形成无限重载循环**。reload → content script 重新注入 → 再次 connect
   → 若 SW 仍在启动窗口期 → 超时 → 再次 reload。页面永远停在「加载中 / 空白」，用户手动刷新
   也无法跳出循环，只能关闭并重启浏览器让 SW 冷启动完成。
3. 设计文档里「重连失败概率极低」「刷新无副作用」这两条假设，在 SW 被 Chrome 频繁终止/重启的
   场景下都不成立。

**根因**：原方案把「报告存活」和「断线恢复」绑死在同一条 Port 上。Port 一断就要重连，重连失败
就要 reload，而重连本身又依赖 SW 及时响应——在最需要它工作的场景（SW 被杀/重启）里必然退化。

---

## 二、设计原则

1. **解耦**：content script 的两项职责各自独立，互不为前提——
   - **报告存活**：周期性把「我是活的」这个事实写到 `chrome.storage.session`；
   - **周期刷新**：周期性 `location.reload()` 自己。
2. **报告存活不经过 SW、不建立连接、不等 ack**：`chrome.storage.session` 的读写由浏览器进程直接
   处理，**不会唤醒 service worker**，也不存在 Port / pong / onDisconnect，因此没有「连接断开」
   这个触发重载的源头。
3. **健康表跨 SW 睡眠存活**：存活信息落在 `chrome.storage.session`，随浏览器会话存活、随浏览器
   关闭清空——正好匹配「平台是否 live」的语义（浏览器一关，本就无所谓 live 了）。
4. **刷新无条件、零副作用**：reload 由独立定时器触发，不因 background 是否响应而改变；同一页面
   生命周期内只发生一次，绝不叠加。
5. **不担心打断浏览**：这些 tab 的操作全部交给 AI 完成，人一般不会去操作，无需用户活跃检测。

---

## 三、核心机制

### 3.1 两个相互独立的定时器

Content script 加载后启动**两个互不相干的页面内定时器**：

```
页面加载
    │
    ├─ 定时器 A（每 LIVE_INTERVAL_MS）──▶ 写 storage.session 时间戳（不唤醒 SW）
    │
    └─ 定时器 B（每 RELOAD_INTERVAL_MS）──▶ location.reload()
                                          │
                                          └─ 页面重载 → content script 重新注入 → 两个定时器重新启动
```

- 定时器 A 只负责**写时间戳**：`chrome.storage.session.set({ [`tweetclaw:alive:${platform}`]: Date.now() })`。
  写失败（扩展上下文失效）就忽略，下一个周期自动补上，无任何副作用。
- 定时器 B 只负责**刷新**：无条件 `location.reload()`，完全不看 background 的状态。

两个定时器解耦后，**不再存在「重连失败 → reload」的因果链**，也就不再有无限重载循环。

### 3.2 报告存活：健康表落地在 `chrome.storage.session`

- 键：`tweetclaw:alive:${platform}`（如 `tweetclaw:alive:twitter`）
- 值：最近一次写入的时间戳（毫秒）
- 「某平台 live」的判据：`now - 时间戳 <= PLATFORM_STALE_AFTER_MS`

**为什么不用 background 内存 Map**：MV3 service worker 是无状态的，闲置约 30s 被杀后内存全部
销毁、下次唤醒从头重新求值。内存 Map 会和 SW 同生共死——SW 一睡健康表就清零，恰恰在最需要它的
时刻失效。`chrome.storage.session` 则跨 SW 睡眠存活、仅随浏览器关闭清空，正符合「平台账号健康表」
的生命周期。

**粒度**：按平台（而非按 tab）存储。同一平台的多个 tab（如小红书 home + creator）写入同一个键，
latest-write-wins，只要有一个 tab 在持续写入，平台就保持 live——这正好表达「某平台当前是 live」。
若后续需要 per-tab 粒度，可把键扩展为 `${platform}:${tabId}`，本文档暂不涉及。

> 健康表如何影响各平台的 tab 选择策略（优先级、fallback 顺序等）不在本文档范围，
> 见 [`docs/tweetclaw-tab-routing-current-state.md`](./tweetclaw-tab-routing-current-state.md)。

### 3.3 周期刷新：为什么「刷新」就够用

| 原方案要解决的问题 | 周期刷新的等价效果 |
|-------------------|------------------|
| background 被 Chrome 终止后消息静默失败 | 页面定期重载，content script 定期重新注入、重新建立可用运行环境 |
| content script 因 JS 异常崩溃 | 下一次刷新必然恢复（崩溃后定时器停止，但用户/AI 下一次刷新同样恢复） |
| 登录 session 保活 | 每次 reload 重新加载平台首页，session cookie 被重新验证/续期 |

刷新是「最重」的恢复手段，但也是最可靠的——不依赖任何外部状态，天然幂等。

### 3.4 间隔常量

```typescript
const LIVE_INTERVAL_MS    = 20_000;            // 写存活时间戳间隔（20s）
const RELOAD_INTERVAL_MS  = 30 * 60 * 1000;    // 周期刷新间隔（30min）
const PLATFORM_STALE_AFTER_MS = 60_000;        // 超过 60s 未写入即视为离线（= 3 × LIVE_INTERVAL_MS）
```

- `LIVE_INTERVAL_MS = 20s`：足够稀疏，健康表不会抖动；写 `storage.session` 不唤醒 SW，无额外开销。
- `RELOAD_INTERVAL_MS = 30min`：足够稀疏，不形成异常高频刷新指纹；相比原 background 侧 90–120 分钟
  的保活刷新，能更及时地兜住 SW 被终止后的空窗。
- `PLATFORM_STALE_AFTER_MS = 60s`：3 个上报周期，容忍偶发写失败/丢写，又不至于让离线判定太迟钝。

---

## 四、实现

### 4.1 Content script 侧（替换 `src/content/content-script-heartbeat.ts` 全文）

```typescript
// content-script-heartbeat.ts
//
// 两项解耦的职责：
//   1. 周期性把存活时间戳写入 chrome.storage.session（不唤醒 SW），供 background 判断平台 live；
//   2. 周期性刷新页面（location.reload）。
// 不建立持久 Port、不 sendMessage、不等待 ack，因此不存在「断线重连 → 重载」的无限循环。

const TAG = '[TweetClaw-HB]';

// 与 background 侧保持一致的前缀
const ALIVE_KEY_PREFIX = 'tweetclaw:alive:';

const LIVE_INTERVAL_MS    = 20_000;           // 写存活时间戳间隔
const RELOAD_INTERVAL_MS  = 30 * 60 * 1000;   // 周期刷新间隔

export function connect(platform: string) {
    // 1. 报告存活：每 20s 写一次时间戳，latest-write-wins，不等待任何响应
    setInterval(() => {
        try {
            void chrome.storage.session
                .set({ [`${ALIVE_KEY_PREFIX}${platform}`]: Date.now() })
                .catch(() => {});
        } catch (e) {
            // 扩展上下文失效（如正在 reload）时忽略；下一个周期会再写
        }
    }, LIVE_INTERVAL_MS);

    // 2. 周期刷新：独立定时器，与报告存活完全解耦
    setInterval(() => {
        console.log(`${TAG} Periodic reload: platform=${platform}`);
        location.reload();
    }, RELOAD_INTERVAL_MS);

    console.log(
        `${TAG} Started: platform=${platform}, alive=${LIVE_INTERVAL_MS}ms, reload=${RELOAD_INTERVAL_MS}ms`
    );
}
```

要点：

- 不再有 `port`、`heartbeatTimer`、`pongTimer`、`attemptReconnect`、`chrome.runtime.connect`、
  `chrome.runtime.sendMessage`，也没有任何 `onMessage` / `onDisconnect` 监听。
- `chrome.storage.session.set(...)` 返回 Promise，`void ... .catch(() => {})` 吞掉「上下文失效」
  的 rejection，保证不产生未处理异常。
- 三个平台入口（`main_entrance.ts` / `xhs-main-entrance.ts` / `ig-main-entrance.ts`）继续以
  `startHeartbeat("twitter" | "xiaohongshu" | "instagram")` 的形式调用，**签名保持不变**，
  入口文件无需改动。
- 依赖 manifest 已有的 `"storage"` 权限（无需新增）。

### 4.2 Background 侧：惰性读取 `storage.session`，不再维护内存表

删除 `chrome.runtime.onConnect` 的 Port 心跳 handler 与内存 `healthTable`/`healthLog` 旧实现，
改为一个读取函数，在需要时（路由选 tab、日志观测）调用：

```typescript
// ── 平台存活健康表（落在 chrome.storage.session，跨 SW 睡眠存活）────────────

const ALIVE_KEY_PREFIX = 'tweetclaw:alive:';   // 与 content script 保持一致
const PLATFORM_STALE_AFTER_MS = 60_000;        // 3 × LIVE_INTERVAL_MS：超过即视为离线

// 读取所有 live 平台；顺带清理已过期的键
async function getLivePlatforms(): Promise<string[]> {
    const all = await chrome.storage.session.get(null);
    const now = Date.now();
    const live: string[] = [];
    const staleKeys: string[] = [];
    for (const [key, value] of Object.entries(all)) {
        if (!key.startsWith(ALIVE_KEY_PREFIX)) continue;
        const platform = key.slice(ALIVE_KEY_PREFIX.length);
        if (typeof value === 'number' && now - value <= PLATFORM_STALE_AFTER_MS) {
            live.push(platform);
        } else {
            staleKeys.push(key);
        }
    }
    if (staleKeys.length) {
        void chrome.storage.session.remove(staleKeys).catch(() => {});
    }
    return live;
}

// 观测用：SW 醒着时周期打印一次，便于排查
setInterval(() => {
    void getLivePlatforms().then(live => {
        console.log(`[TweetClaw-BG] Live platforms:`, JSON.stringify(live));
    });
}, 30_000);
```

要点：

- **不再有内存 `Map`**：`healthTable` 数据即 `storage.session`，SW 睡眠/重启后依然保留，无空窗。
- **读时判定、读时清理**：`getLivePlatforms()` 按时间差判定 live，顺带把过期键删掉，无需后台定时
  清理任务。
- 判断某平台是否 live：`(await getLivePlatforms()).includes(platform)`。

删除项：

- `chrome.runtime.onConnect.addListener((port) => { if (port.name !== 'heartbeat') ... })` 整块；
- 原 `HealthEntry`、`healthTable`、`healthLog()`（`lastPingAt` 版本）、`HEALTH_LOG_INTERVAL_MS`。

### 4.3 移除 background 的「首页保活刷新」机制

> **注意**：本次删除**仅针对「首页保活刷新」这套机制**（即用户所说的「第二处 reload」，
> 指后台定期把 online 账号的非活动 tab 刷新回平台首页的逻辑）。
> `IG_TRIGGER_HOME_REFRESH`（doc_id 自愈通道）**必须保留、不能删除**，见 4.4。

background 里另有一套每 90–120 分钟触发的首页刷新（`HOME_REFRESH_ALARM_NAMES` /
`PLATFORM_REFRESH_CONFIGS` / `refreshSinglePlatformHome` / `refreshTabsToHome` /
`nextHomeRefreshDelayMinutes` 及对应 alarm 初始化与监听逻辑）。它与 content script 的周期刷新
是**两个独立来源对同一批 tab 反复刷新**，且同样是「已打开的 tab 被无谓刷新」的来源之一，一并删除。

删除范围：

- 常量与类型：`HOME_REFRESH_ALARM_NAMES`、`HOME_REFRESH_LEGACY_ALARM_NAME`、
  `HOME_REFRESH_MIN_MINUTES`、`HOME_REFRESH_MAX_MINUTES`、`PlatformRefreshConfig`、
  `PLATFORM_REFRESH_CONFIGS`；
- 函数：`nextHomeRefreshDelayMinutes`、`refreshTabsToHome`、`refreshSinglePlatformHome`；
- alarm 初始化循环（`for (const cfg of PLATFORM_REFRESH_CONFIGS) { chrome.alarms.get(...) }`）；
- `chrome.alarms.onAlarm` 监听器里三个相关分支：`tweetclaw-reconnect` 保留，
  `HOME_REFRESH_LEGACY_ALARM_NAME` 迁移分支、以及 `HOME_REFRESH_ALARM_NAMES` 平台分发分支删除。

### 4.4 必须保留：IG doc_id 自愈通道（最小改写）

该消息来自 `src/ig_api/ig_api.ts` 的 `checkGraphQlDocIdError`，检测到 GraphQL `field_exception`
（doc_id 过期）时，请求 background 刷新 IG 主页 tab，让前端重新发 GraphQL → injection 捕获新 doc_id。

删除 `refreshSinglePlatformHome` 后，`IG_TRIGGER_HOME_REFRESH` 分支需要一个新的、不依赖保活机制的
等价实现。语义是「把非活动 IG tab 导航回主页（不在主页则导航、在主页则 reload）」：

```typescript
// IG doc_id 过期自愈：把 instagram 非活动 tab 导航回主页，让前端重新发 GraphQL 以捕获新 doc_id。
async function reloadIgHomeTab(): Promise<void> {
    const HOME_URL = 'https://www.instagram.com/';
    const tabs = await chrome.tabs.query({ url: ['*://www.instagram.com/*', '*://instagram.com/*'] });
    const tab = tabs.find(t => !t.active) || tabs[0];
    if (!tab?.id) return;
    const normalize = (u: string) => u.split('#')[0].split('?')[0];
    if (normalize(tab.url || '') === normalize(HOME_URL)) {
        await chrome.tabs.reload(tab.id);
    } else {
        await chrome.tabs.update(tab.id, { url: HOME_URL });
    }
}
```

`IG_TRIGGER_HOME_REFRESH` 分支内部把 `refreshSinglePlatformHome('instagram')` 替换为
`reloadIgHomeTab()`。其余（fire-and-forget、sendResponse 语义）不变。

---

## 五、边界情况

| 场景 | 行为 |
|------|------|
| SW 被杀 / 睡眠 / 重启 | `storage.session` 中的时间戳保留，健康表不丢，无空窗 |
| tab 崩溃 / content script 崩溃 / 页面关闭 | 不再写时间戳 → 60s 后 `getLivePlatforms` 判定为离线并清理 |
| 浏览器关闭 | `storage.session` 清空；此时本就无 tab，清空是正确的 |
| 页面 reload | 两个定时器随页面销毁，content script 重新注入后重新启动，闭环自洽 |
| 用户/AI 正在操作 tab 时触发刷新 | 每 30 分钟最多一次，且这些 tab 由 AI 操作、人一般不动，接受偶尔刷新 |
| 多个 tab 同时打开（同/异平台） | 各自独立写时间戳、独立刷新，互不影响；同平台 latest-write-wins |
| 页面刷新中再次触发刷新 | `setInterval` 在页面卸载时被销毁，不存在叠加 |

---

## 六、改动清单

| 文件 | 改动 |
|------|------|
| `src/content/content-script-heartbeat.ts` | 全文替换为 4.1：两个独立定时器（写 `storage.session` 时间戳 + 周期刷新），删除 Port/心跳/重连逻辑 |
| `src/service_work/background.ts` | 删除 `onConnect` Port 心跳 handler 与内存 `healthTable`/`healthLog` 旧实现；新增 `getLivePlatforms()`（读 `storage.session` 判定 live 并清理过期键）；删除首页保活刷新（`HOME_REFRESH_*`、`PLATFORM_REFRESH_CONFIGS`、`refreshTabsToHome`、`refreshSinglePlatformHome`、`nextHomeRefreshDelayMinutes` 及 alarm 初始化/监听分支）；`IG_TRIGGER_HOME_REFRESH` 分支改用 `reloadIgHomeTab()` |
| `docs/home-refresh-per-platform-alarm.md` | 对应「首页保活刷新」机制已删除，标记为归档/废弃（如保留文档需注明） |

**无需改动**：

- `src/content/main_entrance.ts` / `src/content/xhs-main-entrance.ts` / `src/content/ig-main-entrance.ts`
  —— `startHeartbeat(...)` 调用签名保持不变；
- `manifest.json` —— `"storage"` 权限已存在，无 manifest 层面的变更。

---

## 七、测试要点

1. 打开任一平台 tab 后，在 SW 控制台 `chrome.storage.session.get(null)` 能看到
   `tweetclaw:alive:<platform>` 且值在 20s 内刷新。
2. `getLivePlatforms()` 返回该平台；关闭 tab（或停写时间戳）后 60s 内从 live 列表消失、键被清理。
3. 手动 sleep 或重启 SW 后，`storage.session` 中的时间戳仍在（健康表不丢）。
4. 打开 tab 满 30 分钟后自动刷新一次（可将 `RELOAD_INTERVAL_MS` 临时调小验证）。
5. 刷新是「干净」的：页面正常重新渲染，无卡死、无空白、无无限重载循环。
6. 多个平台 tab 同时打开时，各自独立写时间戳、独立刷新，互不干扰。
7. IG 出现 `field_exception`（doc_id 过期）时，`IG_TRIGGER_HOME_REFRESH` 仍能把非活动 IG tab
   导航回主页一次，自愈语义不丢失。
