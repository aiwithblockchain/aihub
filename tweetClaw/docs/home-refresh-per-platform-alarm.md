# Home Refresh：每平台独立 Alarm 方案（方案 B）

## 背景

当前 `refreshOnlineAccountsHome()` 用单个 alarm + 串行 `for` 循环刷新所有平台，
三个平台几乎同时刷新到 home，形成可被风控识别的同步指纹。

**现状代码**（`src/service_work/background.ts:1044-1071`）：

```typescript
async function refreshOnlineAccountsHome(): Promise<void> {
    const statuses = await collectAccountStatuses();
    const online = statuses.filter(s => s.status === 'logged_in');
    for (const s of online) {
        if (s.platform === 'twitter')    { await refreshTabsToHome(...); }
        else if (s.platform === 'instagram') { await refreshTabsToHome(...); }
        else if (s.platform === 'xiaohongshu') { await refreshTabsToHome(...); }
    }
}
```

**问题**：`chrome.tabs.update` 是毫秒级返回的，`await` 串行并不能错开时间，
三个平台的 tab 在同一秒内全部刷新。

## 设计目标

1. 三个平台**各自独立调度**，刷新时刻天然漂开
2. 抗 service worker 挂起（MV3 SW 30s 无活动会被 kill）
3. 保留现有 30–60 分钟随机间隔
4. 只刷新已存在的非活动 tab，不新建、不打断用户

## 方案：每个平台一个独立 alarm

### Alarm 命名

```typescript
const HOME_REFRESH_ALARM_NAMES = {
    twitter:      'tweetclaw-home-refresh-twitter',
    instagram:    'tweetclaw-home-refresh-instagram',
    xiaohongshu:  'tweetclaw-home-refresh-xhs',
} as const;
```

### 平台刷新配置

```typescript
interface PlatformRefreshConfig {
    platform: 'twitter' | 'instagram' | 'xiaohongshu';
    urlPatterns: string[];
    homeUrl: string;
    // 小红书有两套域名（主站 + 创作者中心），用数组表达
    extraRefreshes?: { urlPatterns: string[]; homeUrl: string }[];
}

const PLATFORM_REFRESH_CONFIGS: PlatformRefreshConfig[] = [
    {
        platform: 'twitter',
        urlPatterns: ['*://x.com/*', '*://twitter.com/*'],
        homeUrl: 'https://x.com/home',
    },
    {
        platform: 'instagram',
        urlPatterns: ['*://www.instagram.com/*', '*://instagram.com/*'],
        homeUrl: 'https://www.instagram.com/',
    },
    {
        platform: 'xiaohongshu',
        urlPatterns: ['*://www.xiaohongshu.com/*', '*://xiaohongshu.com/*'],
        homeUrl: 'https://www.xiaohongshu.com/explore',
        extraRefreshes: [
            {
                urlPatterns: ['*://creator.xiaohongshu.com/*'],
                homeUrl: 'https://creator.xiaohongshu.com/new/home?source=official',
            },
        ],
    },
];
```

### 初始化：每个平台独立创建 alarm

替换现有 `chrome.alarms.get(HOME_REFRESH_ALARM_NAME, ...)` 块：

```typescript
function nextHomeRefreshDelayMinutes(): number {
    return HOME_REFRESH_MIN_MINUTES
        + Math.random() * (HOME_REFRESH_MAX_MINUTES - HOME_REFRESH_MIN_MINUTES);
}

// SW 启动时为每个平台独立安排 alarm（若不存在）
for (const cfg of PLATFORM_REFRESH_CONFIGS) {
    const alarmName = HOME_REFRESH_ALARM_NAMES[cfg.platform];
    chrome.alarms.get(alarmName, (existing) => {
        if (!existing) {
            const delay = nextHomeRefreshDelayMinutes();
            chrome.alarms.create(alarmName, { delayInMinutes: delay });
            console.log(
                `[tweetClaw][A41][home-refresh] ${cfg.platform} alarm created (next fire in ${delay.toFixed(1)}min)`
            );
        }
    });
}
```

**关键**：三个平台在 SW 启动时各自独立 `nextHomeRefreshDelayMinutes()`，
首次触发时刻就天然错开（比如 twitter=37min、instagram=51min、xhs=44min）。

### Alarm 监听：按 name 分发

替换现有 `if (alarm.name === HOME_REFRESH_ALARM_NAME)` 块：

```typescript
// 找到触发的是哪个平台的 alarm
const platformEntry = Object.entries(HOME_REFRESH_ALARM_NAMES)
    .find(([_, name]) => name === alarm.name);
if (platformEntry) {
    const platform = platformEntry[0] as keyof typeof HOME_REFRESH_ALARM_NAMES;
    void (async () => {
        try {
            console.log(`[tweetClaw][A41][home-refresh] ${platform} alarm fired`);
            await refreshSinglePlatformHome(platform);
        } finally {
            // 无论成功失败都重新安排下一次，避免链中断
            const delay = nextHomeRefreshDelayMinutes();
            await chrome.alarms.create(alarm.name, { delayInMinutes: delay });
            console.log(
                `[tweetClaw][A41][home-refresh] ${platform} next fire in ${delay.toFixed(1)}min`
            );
        }
    })().catch((e) =>
        console.warn(`[tweetClaw][A41][home-refresh] ${platform} failed`, e)
    );
    return;
}
```

### 单平台刷新函数

```typescript
async function refreshSinglePlatformHome(
    platform: 'twitter' | 'instagram' | 'xiaohongshu'
): Promise<void> {
    // 先检查该平台账号是否仍在线；离线则跳过（不刷新、不报错）
    const statuses = await collectAccountStatuses();
    const online = statuses.find(s => s.platform === platform && s.status === 'logged_in');
    if (!online) {
        console.log(`[tweetClaw][A41][home-refresh] ${platform} not online, skip`);
        return;
    }

    const cfg = PLATFORM_REFRESH_CONFIGS.find(c => c.platform === platform);
    if (!cfg) return;

    const n = await refreshTabsToHome(cfg.urlPatterns, cfg.homeUrl);
    console.log(`[tweetClaw][A41][home-refresh] ${platform}: refreshed ${n} tab(s)`);

    // 小红书主站 + 创作者中心
    if (cfg.extraRefreshes) {
        for (const extra of cfg.extraRefreshes) {
            const n2 = await refreshTabsToHome(extra.urlPatterns, extra.homeUrl);
            console.log(
                `[tweetClaw][A41][home-refresh] ${platform} extra: refreshed ${n2} tab(s)`
            );
        }
    }
}
```

### 删除旧函数

`refreshOnlineAccountsHome()` 整个函数删除，被 `refreshSinglePlatformHome` 取代。

## 时序效果

假设 SW 在 T=0 启动，三个平台首次随机延迟：

```
twitter:     T+37min  → refresh → 重新随机 → T+37+52min
instagram:   T+51min  → refresh → 重新随机 → T+51+33min
xiaohongshu: T+44min  → refresh → 重新随机 → T+44+48min
```

三个平台的刷新时刻**永远不同步**，且每次刷新后各自独立重新随机，
长期看没有任何固定周期，无法被风控识别为 bot指纹。

## 抗 SW 挂起

- `chrome.alarms` 由浏览器进程持久化，SW 被 kill 不影响 alarm 触发
- alarm 触发时浏览器会唤醒 SW，执行完 `finally` 重新安排下一次
- 即使某次刷新失败，`finally` 仍会安排下一次，链不会断

## 兼容性

- 旧 alarm 名 `tweetclaw-home-refresh` 会在升级后不再被创建，
  但已存在的旧 alarm 仍会触发——在监听器里加一段一次性兜底：

```typescript
// 一次性迁移：旧的单 alarm 触发时，按新逻辑刷新所有平台然后删除自己
if (alarm.name === 'tweetclaw-home-refresh') {
    void (async () => {
        console.log('[tweetClaw][A41][home-refresh] legacy alarm fired, migrating');
        for (const cfg of PLATFORM_REFRESH_CONFIGS) {
            await refreshSinglePlatformHome(cfg.platform);
        }
        await chrome.alarms.clear('tweetclaw-home-refresh');
        // 确保三个新 alarm 都已安排
        for (const cfg of PLATFORM_REFRESH_CONFIGS) {
            const name = HOME_REFRESH_ALARM_NAMES[cfg.platform];
            const existing = await chrome.alarms.get(name);
            if (!existing) {
                const delay = nextHomeRefreshDelayMinutes();
                await chrome.alarms.create(name, { delayInMinutes: delay });
            }
        }
    })();
    return;
}
```

## 改动清单

| 文件 | 改动 |
|------|------|
| `src/service_work/background.ts` | 新增 `HOME_REFRESH_ALARM_NAMES`、`PLATFORM_REFRESH_CONFIGS`、`refreshSinglePlatformHome`；修改 alarm 初始化块和监听器；删除 `refreshOnlineAccountsHome`；加旧 alarm 迁移兜底 |

## 测试要点

1. SW 重启后，三个 alarm 各自独立创建，延迟不同
2. 单个 alarm 触发只刷新对应平台，其他平台不受影响
3. 平台离线时跳过刷新，但仍重新安排下一次 alarm
4. 旧 alarm `tweetclaw-home-refresh` 触发后能迁移到新机制
5. 三个平台的刷新时刻在长时间运行后仍保持错开
