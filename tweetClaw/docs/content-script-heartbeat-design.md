# Content Script ↔ Background 心跳与断线重连方案

> 创建: 2026-08-12

---

## 一、背景与问题

### 1.1 MV3 Service Worker 的生命周期问题

Chrome Manifest V3 中，background 是一个 service worker，Chrome 会在其**闲置约 30 秒后将其终止**。当 background 被终止后：

- Content script 持有的 `chrome.runtime.Port` 连接会断开
- Port 的 `onDisconnect` 事件触发
- 但 content script 本身仍然存活在页面中

此时若 Python AI Agent 发来命令，background 被唤醒但 content script 没有重新建立连接，消息将**静默失败**。

### 1.2 Content Script 崩溃场景

若 content script 因 JS 异常崩溃，background 侧无法感知（port 同样会断开，但 background 无从知晓是哪个 tab 出了问题）。

### 1.3 当前现状

目前扩展没有任何心跳机制，`findIgTab()` / `findXhsTab()` 等函数只判断 tab 是否存在，不验证 content script 是否可用。命令发出后若 content script 不响应，调用方会等到超时才知道失败。

---

## 二、设计目标

1. **可靠检测**：content script 能及时感知与 background 的连接中断
2. **自动恢复**：断线后优先尝试轻量重连，重连失败才执行页面刷新
3. **用户无感**：正常情况下对用户零影响；刷新只在无法避免时发生
4. **适用范围**：所有平台（Twitter、Instagram、XHS）的 content script

---

## 三、核心机制

### 3.1 连接建立

Content script 加载时通过 `chrome.runtime.connect()` 建立**持久 Port 连接**：

```
Content Script                    Background Service Worker
     |                                      |
     |--- chrome.runtime.connect() -------->|  建立 Port
     |<-- port 建立确认 --------------------|
     |                                      |
     |--- HEARTBEAT_PING (每 20s) --------->|
     |<-- HEARTBEAT_PONG ------------------|
     |                                      |
```

### 3.2 心跳时序

- Content script 每 **20 秒**发送一次 `HEARTBEAT_PING`
- Background 收到后立即回复 `HEARTBEAT_PONG`
- Content script 若在 **5 秒内**未收到 `PONG`，判定连接异常，进入恢复流程

心跳间隔选 20 秒的原因：
- 短于 Chrome 杀掉 service worker 的闲置阈值（~30s），确保 background 保持活跃
- 不过于频繁，避免干扰 Chrome 对 service worker 的生命周期管理

### 3.3 两阶段恢复流程

```
port.onDisconnect 触发 / PING 超时
          │
          ▼
  ┌───────────────────┐
  │  阶段一：尝试重连  │  chrome.runtime.connect() 重新建立 Port
  │  超时阈值: 3 秒    │  connect() 调用本身会唤醒 service worker
  └───────────────────┘
          │
     ┌────┴────┐
  成功│         │失败（3s 内未收到 background 确认）
     │         │
     ▼         ▼
  恢复正常  ┌───────────────────┐
           │  阶段二：刷新页面  │  location.reload()
           │  content script   │  页面重载后重新注入
           │  重新注入，重建连接 │
           └───────────────────┘
```

**选择刷新而非其他方式的原因：**
- Content script 一旦崩溃，无法在原有上下文中恢复
- `location.reload()` 能保证干净的重新注入
- 相比其他恢复手段，实现最简单且最可靠

---

## 四、实现细节

### 4.1 Content Script 侧

```ts
// content-script-heartbeat.ts

const HEARTBEAT_INTERVAL_MS = 20_000;
const HEARTBEAT_TIMEOUT_MS  = 5_000;
const RECONNECT_TIMEOUT_MS  = 3_000;

let port: chrome.runtime.Port | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let pongTimer: ReturnType<typeof setTimeout> | null = null;

function connect() {
    port = chrome.runtime.connect({ name: 'heartbeat' });

    port.onMessage.addListener((msg) => {
        if (msg.type === 'HEARTBEAT_PONG') {
            clearTimeout(pongTimer!);
        }
    });

    port.onDisconnect.addListener(() => {
        clearInterval(heartbeatTimer!);
        clearTimeout(pongTimer!);
        port = null;
        attemptReconnect();
    });

    startHeartbeat();
}

function startHeartbeat() {
    heartbeatTimer = setInterval(() => {
        if (!port) return;

        port.postMessage({ type: 'HEARTBEAT_PING' });

        // 等待 PONG，超时视为连接异常
        pongTimer = setTimeout(() => {
            port?.disconnect();
            // onDisconnect 会触发 attemptReconnect
        }, HEARTBEAT_TIMEOUT_MS);
    }, HEARTBEAT_INTERVAL_MS);
}

function attemptReconnect() {
    const timer = setTimeout(() => {
        // 3 秒内未成功重连，刷新页面
        console.warn('[TweetClaw] Reconnect timeout, reloading page...');
        location.reload();
    }, RECONNECT_TIMEOUT_MS);

    try {
        const newPort = chrome.runtime.connect({ name: 'heartbeat' });

        newPort.onMessage.addListener((msg) => {
            if (msg.type === 'HEARTBEAT_PONG') {
                // 重连成功
                clearTimeout(timer);
                port = newPort;
                startHeartbeat();
            }
        });

        newPort.onDisconnect.addListener(() => {
            // 重连本身也断了，等 timer 触发刷新
        });

        // 主动发一次 PING 确认 background 响应
        newPort.postMessage({ type: 'HEARTBEAT_PING' });

    } catch (e) {
        // connect() 直接抛异常，等 timer 触发刷新
        console.error('[TweetClaw] Reconnect failed immediately:', e);
    }
}

// 页面加载时启动
connect();
```

### 4.2 Background 侧

```ts
// background.ts 中新增

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'heartbeat') return;

    port.onMessage.addListener((msg) => {
        if (msg.type === 'HEARTBEAT_PING') {
            port.postMessage({ type: 'HEARTBEAT_PONG' });
        }
    });

    // port.onDisconnect 无需处理，连接断开是正常生命周期事件
});
```

### 4.3 集成到现有 Content Script

各平台的 content script 入口文件引入心跳模块：

```ts
// 在 content script 入口（如 injection.ts）顶部调用
import { connect as startHeartbeat } from './content-script-heartbeat';

// DOMContentLoaded 后启动
document.addEventListener('DOMContentLoaded', () => {
    startHeartbeat();
    // ... 其余初始化逻辑
});
```

---

## 五、与现有 Tab 查找逻辑的关系（待议）

> **本节暂不设计**。健康表如何与各平台的 tab 查找函数（`findIgTab()` / `findXhsTab()` / Twitter tab 查找逻辑）协作，涉及三个平台的路由策略统一，需结合 [`docs/tweetclaw-tab-routing-current-state.md`](./tweetclaw-tab-routing-current-state.md) 的分析一并讨论决策。

当前阶段的边界划分：

- **本文档负责**：心跳连接的建立、断线检测、两阶段恢复、background 健康表的维护
- **路由文档负责**：健康表数据如何影响各平台的 tab 选择策略（优先级、fallback 顺序等）

---

## 六、边界情况

| 场景 | 行为 |
|------|------|
| Background 被 Chrome 正常终止（闲置） | Port 断开 → content script 重连 → `connect()` 唤醒 background → 重连成功，无需刷新 |
| Background crash | 同上，Chrome 会重启 service worker |
| Content script 崩溃 | 心跳停止发送 → background 健康表移除该 tab（方案 B）→ 下次命令不选该 tab |
| 用户正在活跃操作 tab 时触发刷新 | 重连超时 3s 才刷新，且重连失败概率极低；可接受 |
| 页面刷新中再次触发刷新 | `location.reload()` 在页面卸载期间调用无副作用 |
| 多个 content script 同时触发重连 | 各自独立重连，互不影响 |

---

## 七、实现优先级建议

1. **第一步**：实现基础心跳（第四节 4.1 + 4.2），解决 background 被杀后静默失败的问题
2. **第二步**：集成到各平台 content script 入口（4.3），background 同步建立健康表
3. **第三步**：健康表如何影响 tab 选择策略 → 见 [`docs/tweetclaw-tab-routing-current-state.md`](./tweetclaw-tab-routing-current-state.md)
