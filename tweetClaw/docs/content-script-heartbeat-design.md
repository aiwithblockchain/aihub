# Content Script 消息式心跳 + background 健康表 + 发送失败自刷新方案

> 创建: 2026-08-13
> 取代: 上一版「content script 写 storage.session + 30min 周期刷新」方案

---

## 一、为什么调整

上一版让 content script 每 20s 直接写 `chrome.storage.session`，并靠独立的 30min `location.reload()` 兜底。这在「SW 空闲被杀」时没问题，但在「改代码 reload 扩展」后有问题：

- 扩展 reload 后，已打开页面里的旧 content script 变成孤儿脚本，`chrome.storage.session.set(...)` 会持续报 `Extension context invalidated`，被吞掉后健康表永远不再更新。
- 页面要等下一个 30min 刷新才能重新注入新版 content script，恢复太慢。

因此改为**消息式心跳**：content script 每 20s 主动向 background 发一条消息，background 负责更新健康表；一旦这条消息发不出去，说明扩展上下文已经失效或 background 不可达，content script 立即 reload 自己的页面，快速恢复。

---

## 二、设计原则

1. **content 主动上报，background 单点更新**：content 只 `sendMessage`，不直接写存储；健康表由 background 统一读写，写入路径单一。
2. **发送失败 = 上下文失效/不可达 → 立即自刷新**：不再等 30min。每页生命周期内最多 reload 一次，避免同一页面反复刷新。
3. **健康表仍落在 `chrome.storage.session`**：由 background 写，跨 SW 睡眠存活、随浏览器关闭清空；background 每 60s 清理一次超时条目。
4. **不建 Port、不等 pong、不写 storage**（content 侧）：没有断线重连因果链。

---

## 三、核心机制

### 3.1 content 侧：每 20s 发一条消息

```
页面加载
  │
  ├─ 立即发一次（建立初始 liveness）
  │
  └─ 定时器（每 HEARTBEAT_INTERVAL_MS）
          └──▶ chrome.runtime.sendMessage({ type: 'TWEETCLAW_HEARTBEAT', platform })
                    ├─ 成功：忽略响应，等下一轮
                    └─ 失败（lastError / 同步抛错）：location.reload()
```

- 使用 `reloadOnce` 保证一个页面生命周期只 reload 一次。
- 不再写 `chrome.storage.session`，也不再需要 `TWEETCLAW_REGISTER_HEARTBEAT` 握手（background 可从 `sender.tab.id` 拿 tabId）。

### 3.2 background 侧：收到消息更新健康表

- 键：`tweetclaw:alive:${platform}:${tabId}`（per-tab）
- 值：收到该 tab 最近一次心跳的时间戳
- 收到 `TWEETCLAW_HEARTBEAT` 时：
  - 从 `sender.tab?.id` 拿 `tabId`
  - 写入 `chrome.storage.session` 对应 key

「某账号/平台活跃」的判据：该平台下至少有一个 tab 满足 `now - timestamp <= HEALTH_TIMEOUT_MS`。

「账号不活跃」：该平台下所有 tab 都超时，background 在 60s 清理任务里删掉这些过期键。

### 3.3 background 侧：每 60s 清理超时条目

- 用 `chrome.alarms` 建一个 `periodInMinutes: 1` 的 `tweetclaw-health-check` alarm。
- alarm 触发时，遍历 `storage.session`，把超过 `HEALTH_TIMEOUT_MS` 未更新的 `tweetclaw:alive:*` 键删除。
- 删除后 `getLiveTabs()` 查不到该 tab → 账号判定为不活跃。

> 为什么用 `chrome.alarms` 而不是 `setInterval`：MV3 SW 闲置约 30s 会被杀，`setInterval` 不保证存活；`chrome.alarms` 会唤醒 SW，符合「background 每 60s 检查一次」的语义。

### 3.4 为什么健康表仍放在 storage.session

按「background 更新健康表」的语义，可以直接用内存 `Map`。但 MV3 SW 被杀后内存表会随之清零，健康表在最需要它的时刻失效。放在 `chrome.storage.session` 可以跨 SW 睡眠存活；而且现在写入方是 background（受信任上下文），content 侧不再直接访问存储。

---

## 四、常量

```typescript
const HEARTBEAT_INTERVAL_MS = 20_000;      // content → background 心跳间隔
const HEALTH_TIMEOUT_MS     = 60_000;      // 3 × HEARTBEAT_INTERVAL_MS：超过视为不活跃
const HEALTH_CHECK_ALARM    = 'tweetclaw-health-check'; // 60s 清理 alarm
```

---

## 五、实现

### 5.1 Content script（替换 `src/content/content-script-heartbeat.ts` 全文）

```typescript
// content-script-heartbeat.ts
//
// 消息式心跳：
//   1. 每 20s 向 background 发 TWEETCLAW_HEARTBEAT，由 background 更新健康表；
//   2. 发送失败（扩展上下文失效 / background 不可达）时 reload 当前页面。
// 不建立持久 Port、不等待 pong、不写 storage.session。

const TAG = '[TweetClaw-HB]';

const HEARTBEAT_MSG = 'TWEETCLAW_HEARTBEAT';
const HEARTBEAT_INTERVAL_MS = 20_000;

export function connect(platform: string) {
    let reloadScheduled = false;

    const reloadOnce = (reason: string) => {
        if (reloadScheduled) return;
        reloadScheduled = true;
        console.warn(`${TAG} reload: platform=${platform}, reason=${reason}`);
        location.reload();
    };

    const sendHeartbeat = () => {
        try {
            chrome.runtime.sendMessage(
                { type: HEARTBEAT_MSG, platform },
                () => {
                    if (chrome.runtime.lastError) {
                        reloadOnce(`sendMessage failed: ${chrome.runtime.lastError.message}`);
                    }
                }
            );
        } catch (e) {
            reloadOnce(`sendMessage threw: ${String(e)}`);
        }
    };

    // 立即发一次建立初始 liveness；之后每 20s 一次
    sendHeartbeat();
    setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    console.log(`${TAG} Started: platform=${platform}, heartbeat=${HEARTBEAT_INTERVAL_MS}ms`);
}
```

要点：

- 不再有 `port`、`onMessage`、`onDisconnect`、`chrome.storage.session.set`、`TWEETCLAW_REGISTER_HEARTBEAT` 握手。
- 失败来源两个：
  - 同步抛错（最常见：扩展 reload 后 `Extension context invalidated`）→ `catch` 分支 reload；
  - 异步 `lastError`（如 `Could not establish connection. Receiving end does not exist.`）→ 回调分支 reload。
- `reloadOnce` 防同一页面重复 reload。
- 三个平台入口 `startHeartbeat("twitter" | "xiaohongshu" | "instagram")` 签名不变。

### 5.2 Background：更新健康表

`onMessage` 中枢新增心跳分支（替换原 `TWEETCLAW_REGISTER_HEARTBEAT` 分支）：

```typescript
const ALIVE_KEY_PREFIX = 'tweetclaw:alive:';
const HEALTH_TIMEOUT_MS = 60_000;

// 消息中枢里新增：
if (message.type === 'TWEETCLAW_HEARTBEAT') {
    const platform = typeof message.platform === 'string' ? message.platform : '';
    const tabId = sender.tab?.id;
    if (platform && tabId != null) {
        void chrome.storage.session
            .set({ [`${ALIVE_KEY_PREFIX}${platform}:${tabId}`]: Date.now() })
            .catch((e) => console.warn('[TweetClaw-BG] health table update failed', e));
    }
    if (sendResponse) sendResponse({ ok: true });
    return false;
}
```

说明：

- 由 background 统一写 `storage.session`，content 不再直接写。
- 不再需要 `TWEETCLAW_REGISTER_HEARTBEAT` 握手，`sender.tab?.id` 已足够。

### 5.3 Background：每 60s 清理超时条目

```typescript
const HEALTH_CHECK_ALARM = 'tweetclaw-health-check';

async function pruneStaleHealthEntries(): Promise<void> {
    const all = await chrome.storage.session.get(null);
    const now = Date.now();
    const staleKeys: string[] = [];
    for (const [key, value] of Object.entries(all)) {
        if (!key.startsWith(ALIVE_KEY_PREFIX)) continue;
        if (typeof value !== 'number' || now - value > HEALTH_TIMEOUT_MS) {
            staleKeys.push(key);
        }
    }
    if (staleKeys.length) {
        await chrome.storage.session.remove(staleKeys);
    }
}

// 初始化 alarm（同名 alarm 会覆盖旧 alarm）
chrome.alarms.create(HEALTH_CHECK_ALARM, { periodInMinutes: 1 });

// 在已有 chrome.alarms.onAlarm 里新增分支：
if (alarm.name === HEALTH_CHECK_ALARM) {
    void pruneStaleHealthEntries();
}
```

说明：

- 60s 清理用 `chrome.alarms` 而不是 `setInterval`。
- `getLiveTabs()` 读取函数继续保留，它在读时也会按 `HEALTH_TIMEOUT_MS` 过滤/清理过期键；60s alarm 是主动清理，两者互补。

### 5.4 保留项

- `reloadIgHomeTab()`（IG doc_id 过期自愈通道）与本次改动无关，保留不动。
- `getLiveTabs()` / `findLiveTab()` 继续作为 background 读取健康表、选择 tab 的入口。

---

## 六、边界情况

| 场景 | 行为 |
|------|------|
| 扩展 reload / update | 旧 content script 下一次 `sendMessage` 抛 `Extension context invalidated` → 立即 reload 页面 → 注入新版 content script |
| SW 空闲被杀 / 重启 | 健康表在 `storage.session` 中保留；content 下一轮 20s 心跳唤醒 SW 并重新写入 |
| tab 崩溃 / content script 崩溃 / 页面关闭 | 不再有心跳 → 60s 后清理，账号判定不活跃 |
| 浏览器关闭 | `storage.session` 清空；本就无 tab，清空正确 |
| 页面 reload | content script 重新注入，`reloadScheduled` 重置，闭环自洽 |
| 心跳偶发失败（冷启动窗口） | 依赖 background `onMessage` 顶层同步注册；若仍失败则 reload |
| 多个 tab（同/异平台） | 各自每 20s 发心跳，background 按 `platform:tabId` 独立记录 |

> 前提：`chrome.runtime.onMessage.addListener` 必须在 background 顶层同步注册，否则 SW 冷启动窗口内首条心跳可能被丢。当前实现满足此前提。

---

## 七、改动清单

| 文件 | 改动 |
|------|------|
| `src/content/content-script-heartbeat.ts` | 全文替换为消息式心跳；删除 `TWEETCLAW_REGISTER_HEARTBEAT` 握手、`storage.session` 写入、30min 周期刷新；新增发送失败 reload |
| `src/service_work/background.ts` | `onMessage` 中把 `TWEETCLAW_REGISTER_HEARTBEAT` 分支替换为 `TWEETCLAW_HEARTBEAT` 分支；新增 `pruneStaleHealthEntries()` 与 `tweetclaw-health-check` alarm 初始化/监听；保留 `getLiveTabs()`/`findLiveTab()`；可选移除 `setAccessLevel` 开放逻辑 |

**无需改动**：

- 三个平台入口 `startHeartbeat(...)` 签名不变；
- `manifest.json` —— 若已有 `"alarms"` 与 `"storage"` 权限则无需改动（background 当前已使用 `chrome.alarms`）。

---

## 八、测试要点

1. 打开平台 tab 后，SW 控制台 `chrome.storage.session.get(null)` 能看到 `tweetclaw:alive:<platform>:<tabId>`，且每 20s 刷新。
2. `getLiveTabs()` 返回该平台 tabId；关闭 tab 后 60s 内键被清理、平台不活跃。
3. reload 扩展后，旧 tab 下一次心跳失败并自动 reload 页面，恢复后重新出现在健康表。
4. 重启 SW（手动 sleep/kill）后，`storage.session` 键仍在，`getLiveTabs()` 无空窗。
5. 多个平台 tab 同时打开时各自独立记录、独立刷新。
6. IG doc_id 自愈通道（`reloadIgHomeTab()`）行为不变。
