# tweetClaw profile lifecycle websocket 技术说明

## 文档目的

本文档记录 `tweetClaw` 浏览器扩展与 `LocalBridgeGo` websocket 连接的 profile 生命周期设计、已验证行为、关键实现点，以及后续排障时应关注的信号。

这不是任务分解文档，也不是待办计划。实现已经落地，这里保留的是技术事实和设计说明。

## 背景

在 `LocalBridgeMac` 中曾稳定观察到一个问题：关闭承载 `tweetClaw` 扩展的浏览器 profile 后，Connected Instances 中的 `tweetClaw` 节点有时不会及时下线。

后续日志证明，这不是 Go 端清理失败，也不是 UI 刷新失败，而是扩展侧 profile/window 生命周期与 websocket 生命周期脱钩。

## 根因总结

旧逻辑过于依赖 `chrome.runtime.onSuspend` 作为 websocket 关闭触发条件。

但在真实浏览器行为里，关闭 profile 最后一个窗口后：

- `chrome.windows.onRemoved` 会先触发
- 此时 `windowCount` 已经可能为 0
- service worker 不一定立刻进入 `onSuspend`
- websocket 可能还继续活着
- Go 端继续收到 ping/pong，就会合理地继续把该实例视为在线

所以问题不在 Go，不在 Swift UI，而在 extension 侧没有用业务状态主动收口连接。

## 设计原则

### 1. 用业务活跃状态驱动连接状态

真正可靠的边界不是 Chrome 何时回收 worker，而是当前 profile 是否还有窗口。

规则很简单：

- `windowCount > 0`，该 profile 应被视为 active
- `windowCount == 0`，该 profile 应被视为 inactive，并主动断开 websocket

### 2. `connect` / `disconnect` 必须幂等

浏览器里会有多个触发源同时推动连接流程：

- service worker boot
- `chrome.runtime.onInstalled`
- `chrome.runtime.onStartup`
- `chrome.windows.onCreated`
- reconnect alarm

如果连接管理不幂等，就会出现重复 websocket、重复 hello、旧回调污染新连接。

### 3. 旧异步事件不能污染当前状态

旧 socket 的 `onopen`、`onclose`、`onerror`，以及旧 alarm 的触发，都必须能被识别并丢弃。

## 核心实现

实现主要收敛在两个文件：

1. `tweetClaw/src/service_work/background.ts`
2. `tweetClaw/src/bridge/local-bridge-socket.ts`

### background.ts 的职责

`background.ts` 现在负责把多个浏览器事件统一收敛成一个业务入口：

- 读取 `windowCount`
- 判断当前 profile 是否应在线
- 调用统一的 `reconcileBridgeActivity(reason, extra)`

关键点：

- `windowCount == 0` 时，设置 `desiredActive = false`
- 主动 `ensureDisconnected(reason)`
- 清理 task coordinator / session store

- `windowCount > 0` 时，设置 `desiredActive = true`
- 调用 `ensureConnected(reason)`

为了避免同一时刻多个入口互相打架，背景层还做了 coalescing：

- `reconcileInFlight`
- `pendingReconcileRequest`

这让 service worker boot、runtime installed、window created 这些同时到来的触发，最终只串行落成一次收敛执行。

### local-bridge-socket.ts 的职责

`LocalBridgeSocket` 负责真正的 websocket 生命周期控制。

#### 关键状态

- `desiredActive: boolean`
  - 业务上是否应该在线

- `connectionGeneration: number`
  - 每次进入新的一轮连接生命周期就递增
  - 用于让旧 socket 的异步回调失效

- `isConnecting: boolean`
  - 阻止并发 `connect()`

#### connect 的行为

`connect(reason)` 现在遵守这些规则：

1. 若 `desiredActive == false`，直接 skip
2. 若 `isConnecting == true`，直接 skip
3. 若已有 `CONNECTING` 或 `OPEN` socket，直接 skip
4. 在读取动态配置前，先把 `isConnecting = true`
5. 配置读取完成后再次复核：
   - `desiredActive` 是否已变为 `false`
   - `ws` 是否已在等待期间变为 active
6. 只有全部通过后，才递增 `connectionGeneration` 并真正建立 websocket

这个细节很关键。

之前启动期重复 `connect_begin` 的根因，就是多个调用一起穿过前半段检查，在 `await chrome.storage.local.get(...)` 期间并发飞。现在先占住 `isConnecting`，就把这个竞态压掉了。

#### disconnect 的行为

`disconnect(reason)` 会：

1. `desiredActive = false`
2. `connectionGeneration += 1`
3. 清理 reconnect alarm
4. 停止 heartbeat
5. 清空 `serverInfo`
6. 重置 `isConnecting`
7. 若存在 socket，解除回调并主动 close

这样即使旧 socket 之后再触发 `onclose` / `onerror`，也会因为 generation 过期而失效。

#### reconnect alarm 的规则

alarm 现在只是重试机制，不是越权建连机制。

处理逻辑：

1. alarm 触发后先重新读取 `windowCount`
2. 若 `windowCount == 0`
   - 标记 inactive
   - skip reconnect
   - clear alarm
3. 若 `windowCount > 0`
   - 走统一 active reconcile
   - 最终再由 `ensureConnected()` 决定是否真正建连

这解决了旧 alarm 把已关闭 profile 错误拉起的问题。

## 已验证行为

### 1. 关闭最后一个窗口会主动下线

当 `windowCount == 0` 时，扩展不会再等待 `onSuspend`，而是主动 `disconnect()`。

### 2. 关闭一个窗口但 profile 仍有其他窗口，不掉线

`windowCount > 0` 时保持连接，避免误杀。

### 3. 关闭后重新打开 profile，可以自动恢复连接

新的 `window created` / boot / startup 路径会重新驱动 active reconcile，恢复 websocket。

### 4. 旧 reconnect alarm 不会复活已关闭节点

alarm 触发前会先复核 `windowCount` 和 `desiredActive`。

### 5. 启动期重复连接噪音已经压下去

通过把 `isConnecting = true` 提前到动态配置读取之前，多个并发 `connect()` 不再同时穿透。

### 6. Go bridge 离线时会持续按 alarm 节奏重试，恢复后自动连回

最新日志已经验证：

- Go bridge 离线时出现 `ERR_CONNECTION_REFUSED`
- 触发 `ws_error` / `ws_close` / `reconnect_scheduled`
- 每轮 alarm 都先确认 `windowCount=1`
- Go bridge 恢复后，后续某轮自动 `ws_open -> hello_ack -> ping/pong`

说明 reconnect 闭环是正常的。

## 关键日志信号

现在排障时，优先看这些信号：

- `connect_begin`
- `connect_skipped`
- `ws_open`
- `ws_error`
- `ws_close`
- `reconnect_scheduled`
- `alarm_reconnect`
- `alarm_reconnect_skipped`
- `socket_event_ignored`
- `disconnect_called`
- `desired_inactive`
- `inactive`
- `hello_ack`

这些已经足够判断：

- 为什么开始连接
- 为什么跳过连接
- 为什么断开
- 为什么进入重试
- 为什么某个旧事件被丢弃
- 最终是否真正握手成功

## 日志降噪策略

为避免日志刷屏，但又不丢证据，当前策略是：

- 所有 lifecycle event 继续持久化到 `chrome.storage.local`
- 只有关键事件才打印到 console

已经从 console 生命周期白名单中去掉的高频低价值项包括：

- `desired_active`
- `active`
- `hello_send`

同时保留关键结果型事件在 console 中。

另外，发送 hello 的普通日志也已从完整 payload JSON 改为简洁摘要：

- 旧：打印整段 endpoint info payload
- 新：`sending hello, ... clientVersion=...`

这样调试仍然够用，但不会每次握手都刷一大坨对象。

## 典型故障判断方法

### Case A，节点关不掉

先看：

- `window_removed`
- `desired_inactive`
- `inactive`
- `disconnect_called`
- Go 端是否收到 close/read error

如果 `windowCount == 0` 却没走 `disconnect_called`，问题在 background 收敛逻辑。

如果扩展已主动 close，但 Go 端仍长期不清理，才值得看服务端。

### Case B，重复连接

先看：

- 是否有多条 `connect_begin`
- 是否有 `connect_skipped: already connecting`
- 是否有 `socket_event_ignored`

如果只有一条 `connect_begin`，基本就不是扩展启动并发导致的。

### Case C，断线后不重连

先看：

- `ws_close`
- `reconnect_scheduled`
- `bg_alarm_reconnect`
- alarm 时的 `windowCount`

如果 `windowCount == 0`，那是故意不重连，不是 bug。

### Case D，Go bridge 恢复后仍不连回

先看：

- alarm 是否持续触发
- 是否一直 `ERR_CONNECTION_REFUSED`
- 恢复后是否出现 `ws_open`
- 是否最终出现 `hello_ack`

只 `ws_open` 没 `hello_ack`，问题才可能进入协议层。

## 涉及文件

- `tweetClaw/src/service_work/background.ts`
- `tweetClaw/src/bridge/local-bridge-socket.ts`

## 结论

当前实现采用的是“windowCount 驱动业务活跃状态，业务活跃状态驱动 websocket 生命周期”的模型。

这套模型解决了以下问题：

- 关闭 profile 后节点持续在线
- 旧 reconnect alarm 误拉起已关闭节点
- 启动期重复 `connect_begin`
- 旧 websocket 回调污染新状态
- Go bridge 临时离线后的自动恢复

这是当前问题的最小完整闭环，也是后续排障时应继续坚持的机制。
