# tweetClaw profile lifecycle websocket 修复方案

## 背景

当前在 `LocalBridgeMac` 中观察到一个稳定问题：关闭承载 `tweetClaw` 扩展的浏览器 profile 后，Connected Instances 中的 `tweetClaw` 节点有时不会及时下线。

最新 `1.log` 已证明这不是 Go 端清理失败，也不是 UI 刷新失败，而是扩展侧生命周期与 websocket 生命周期脱钩。

## 已确认事实

基于 `1.log`，已经确认以下现象：

1. `chrome.windows.onRemoved` 会触发
2. 触发时 `windowCount=0`
3. 触发时 websocket 仍然是活的，`hasSocket=true`，`readyState=1`
4. `chrome.runtime.onSuspend` 在该 case 中没有触发
5. 关闭 profile 后，Go 端仍持续收到 ping/pong
6. 因为连接仍然活着，Go 端没有理由删除 session，UI 继续显示在线是合理结果

这说明当前问题的根因在扩展侧，而不是 Go 服务端。

## 核心结论

不能再把 `onSuspend` 当作 websocket 关闭的主触发条件。

对业务来说，更可靠的边界是：

- `windowCount > 0`，该 profile 仍应被视为 active
- `windowCount == 0`，该 profile 应被视为 inactive，并主动断开 websocket

也就是说，连接生命周期应由业务状态驱动，而不是由 Chrome 何时真正回收 service worker 驱动。

## 目标

修复后应保证：

1. profile/window 存在时，`tweetClaw` 自动建立并维持 websocket
2. profile 没有任何 window 时，`tweetClaw` 不继续保留为在线节点
3. 重新打开 profile/window 时，可以自动恢复连接
4. 不出现重复 `connect()`、多个并发 websocket、残留 reconnect alarm 误唤醒
5. 保留 `onSuspend` 作为兜底路径，但不依赖它作为主逻辑

## 设计原则

### 1. 用业务状态驱动连接状态

不依赖 Chrome 的内部回收时机。

业务上的真实需求是：

- 还有窗口，就允许在线
- 没有窗口，就应该离线

### 2. `connect` / `disconnect` 必须幂等

因为以下事件可能重叠触发：

- service worker boot
- `chrome.runtime.onInstalled`
- `chrome.runtime.onStartup`
- `chrome.windows.onCreated`
- reconnect alarm

如果连接管理不是幂等的，就会出现：

- 重复 websocket
- 双重 `hello`
- 旧连接 close 回调污染新连接
- 旧 reconnect alarm 把已关闭 profile 再次拉起

### 3. 旧异步事件不能污染新状态

旧 socket 的 `onopen`、`onclose`、`onerror`、旧 alarm 的触发，都必须能被识别并丢弃。

## 推荐状态机

建议把 `LocalBridgeSocket` 连接管理显式收敛为状态机。

### 业务状态

最少需要以下状态：

- `inactive`
  - 当前 profile 没有可用 window，不允许持有活跃 websocket
- `connecting`
  - 正在建立 websocket
- `active`
  - websocket 已建立，并完成 hello/ack
- `backoff`
  - 希望在线，但当前断线，等待 reconnect alarm

注意，这里的 `active/inactive` 是业务状态，不是浏览器原生 readyState。

### 独立控制变量

除了状态机本身，再增加两个关键变量。

#### `desiredActive: boolean`

表示当前业务上是否应该保持在线。

- `true`，应该保持 websocket
- `false`，应该断开 websocket

#### `connectionGeneration: number`

每次进入新的一轮连接生命周期时递增。

用途：

- 让旧 websocket 的异步回调失效
- 让旧 reconnect alarm 即使触发，也不会污染当前状态

这是解决复杂竞态的关键。

## 事件到动作映射

### 一、service worker boot

#### 问题

当前 constructor 中直接 `connect()`，容易和 `onInstalled`、`onStartup`、`onCreated` 重叠，造成重复连接。

#### 方案

service worker 启动时不要盲连，先读取 `windowCount` 再决定状态。

#### 流程

1. 记录 `sw_boot`
2. 读取 `windowCount`
3. 如果 `windowCount > 0`
   - `desiredActive = true`
   - 调用统一入口 `ensureConnected("service worker boot")`
4. 如果 `windowCount == 0`
   - `desiredActive = false`
   - 调用统一入口 `ensureDisconnected("service worker boot with zero windows")`

### 二、`chrome.windows.onCreated`

#### 目标

用户重新打开 profile/window 时，能够恢复连接。

#### 流程

1. 记录 `active`
2. 读取 `windowCount`
3. 若 `windowCount > 0`
   - `desiredActive = true`
   - 清理残留 reconnect alarm
   - 调用 `ensureConnected("window created")`

### 三、`chrome.windows.onRemoved`

这是主修复点。

#### 流程

1. 记录 `inactive`
2. 读取最新 `windowCount`
3. 如果 `windowCount > 0`
   - 说明只是关了一个窗口，不应断线
   - 保持当前连接
4. 如果 `windowCount == 0`
   - `desiredActive = false`
   - 清理 reconnect alarm
   - 调用 `ensureDisconnected("last window removed")`

#### 说明

不能再等待 `onSuspend` 才断开。

### 四、`chrome.runtime.onSuspend`

#### 角色

仅作为兜底，不做主逻辑。

#### 流程

1. 记录 `runtime_suspend`
2. `desiredActive = false`
3. 清理 reconnect alarm
4. 调用 `ensureDisconnected("runtime suspend")`

### 五、`chrome.runtime.onStartup`

#### 说明

保留它，但不让它承担唯一连接职责。

#### 流程

1. 记录 `active`
2. 读取 `windowCount`
3. 如果 `windowCount > 0`
   - `desiredActive = true`
   - 调用 `ensureConnected("runtime startup")`

### 六、`chrome.runtime.onInstalled`

#### 说明

同样保留，但走统一判断路径，不能直接裸调 `connect()`。

#### 流程

1. 记录 `active`
2. 读取 `windowCount`
3. 如果 `windowCount > 0`
   - `desiredActive = true`
   - 调用 `ensureConnected("runtime installed")`

### 七、reconnect alarm

这是最容易产生残留副作用的点。

#### 现有风险

即使 profile 已关闭，旧 alarm 仍可能唤醒 worker 并尝试 reconnect，导致已离线节点又被错误拉起。

#### 新规则

alarm 只是重试机制，不是越权建连机制。

#### 流程

1. alarm 触发
2. 读取 `windowCount`
3. 如果 `windowCount == 0`
   - 记录 `alarm skipped`
   - 清掉当前 alarm
   - 不 connect
   - 返回
4. 如果 `windowCount > 0`
   - `desiredActive = true`
   - 调用 `ensureConnected("alarm reconnect fired")`

## 连接控制接口设计

### `ensureConnected(reason)`

职责：在“应该在线”的前提下，保证最终只有一个活连接。

#### 逻辑

1. 如果 `desiredActive == false`
   - 直接返回
2. 如果当前已有 `OPEN` socket
   - 清掉残留 reconnect alarm
   - 返回
3. 如果当前已有 `CONNECTING` socket 或 `isConnecting == true`
   - 返回
4. 否则：
   - `connectionGeneration += 1`
   - 使用当前 generation 创建新 websocket
   - 状态进入 `connecting`

#### 在 `onopen`

1. 校验 generation 是否仍为当前值
2. 如果不是当前 generation
   - 立即关闭该 socket
   - 忽略后续动作
3. 如果是当前 generation
   - 发送 hello

#### 在 `onclose`

1. 校验 generation 是否仍为当前值
2. 如果不是当前 generation
   - 忽略
3. 如果 `desiredActive == false`
   - 不调度 reconnect
   - 结束
4. 如果 `desiredActive == true`
   - 调度 reconnect alarm

### `ensureDisconnected(reason)`

职责：在“不应该在线”的前提下，彻底收口。

#### 逻辑

1. `desiredActive = false`
2. 清理 reconnect alarm
3. 停止 heartbeat
4. `connectionGeneration += 1`
   - 用来让旧 socket 的异步事件全部失效
5. 如果有 socket
   - 解除自动重连副作用
   - 主动 close
   - `ws = null`
6. 重置 `isConnecting`
7. 清空 `serverInfo`

#### 结果

即使旧 socket 后面再触发 `onclose` / `onerror`，由于 generation 已过期，也不会再干扰当前状态。

## 如何清理重复 connect

### 已暴露的问题

当前日志里已出现：

- 两次 `connect_begin`
- 两次 `ws_open`
- Go 端两条 TCP 连接，但只有一条真正进入 hello/session 注册

这说明当前存在多入口并发 connect。

### 修改建议

#### 1. 去掉 `LocalBridgeSocket` constructor 里的直接 `this.connect()`

constructor 只做：

- bootstrap lifecycle trail
- 初始化字段
- 不直接发起连接

#### 2. 所有连接入口统一走一个调度方法

例如：

- `reconcileBridgeActivity(reason)`

或者至少统一调用：

- `ensureConnected(reason)`
- `ensureDisconnected(reason)`

而不是在多个事件监听器里直接散落 `connect()`。

#### 3. connect 幂等化

只要：

- 已 `OPEN`
- 已 `CONNECTING`
- 当前不应在线

都直接跳过。

## 如何清理残留 reconnect alarm

### 规则

#### 1. 成功 `hello_ack` 后立即清 alarm

只有真正握手稳定后，才能认为旧重试任务已经无效。

#### 2. `ensureDisconnected()` 时必须清 alarm

任何主动断开都要同步清理 alarm。

#### 3. alarm handler 里做资格复核

即使 alarm 已经触发，也必须先检查：

- `desiredActive`
- `windowCount`
- 当前 generation / 当前状态

不满足条件就 skip。

#### 4. reconnect alarm 必须唯一

使用固定 alarm 名字，schedule 前先 clear，避免堆积多个历史 alarm。

## 复杂场景覆盖

### 场景 1，关闭一个窗口，但 profile 还有其他窗口

#### 预期

不掉线。

#### 处理

- `onRemoved`
- `windowCount > 0`
- 仅记录日志，保持连接

### 场景 2，关闭最后一个窗口，但 profile 没有立刻 suspend

#### 预期

也要掉线。

#### 处理

- `onRemoved`
- `windowCount == 0`
- 主动 `ensureDisconnected()`

这是当前问题的主修复路径。

### 场景 3，关闭 profile 后重新打开

#### 预期

自动恢复连接。

#### 处理

- 关闭时主动断线
- 打开时 `onCreated` / boot 触发
- `windowCount > 0`
- `ensureConnected()`

### 场景 4，关闭后旧 reconnect alarm 触发

#### 预期

不能把节点错误拉起。

#### 处理

- alarm fired
- `windowCount == 0`
- skip reconnect
- clear alarm

### 场景 5，窗口刚打开时旧 socket 的 `onclose` 晚到

#### 预期

不能污染新连接。

#### 处理

- generation 校验
- 旧 socket 回调直接忽略

### 场景 6，service worker 启动时多个事件同时到达

#### 预期

最终只建立一个连接。

#### 处理

- 去掉 constructor 直连
- 统一走幂等 `ensureConnected()`
- 用 `isConnecting` + generation 抑制并发

### 场景 7，连接失败，但窗口仍然打开

#### 预期

允许重连。

#### 处理

- `desiredActive == true`
- `onclose` / `onerror` 后 schedule reconnect alarm
- alarm 再次触发时复核 `windowCount > 0`
- 允许重试

### 场景 8，连接失败后，用户在重试前关闭 profile

#### 预期

不应再重连。

#### 处理

- `onRemoved` 发现 `windowCount == 0`
- `desiredActive = false`
- clear alarm
- 即使旧 alarm 后面触发，也直接 skip

## 推荐统一入口

建议在 `background.ts` 中新增统一方法，例如：

```ts
async function reconcileBridgeActivity(reason: string) {
  const windowCount = await getWindowCount();

  if (windowCount > 0) {
    await localBridge.markDesiredActive(reason, { windowCount });
    await localBridge.ensureConnected(reason);
    return;
  }

  await localBridge.markDesiredInactive(reason, { windowCount });
  localBridge.ensureDisconnected(reason);
}
```

实际命名可以调整，但原则是：

- 所有事件入口统一收敛
- 不在各个 listener 里散落 `connect()` / `disconnect()`

## 建议补充日志

为了后续验证状态机是否按设计运行，建议额外增加以下日志字段：

- `reason`
- `windowCount`
- `desiredActive`
- `connectionGeneration`
- `hasSocket`
- `readyState`
- `isConnecting`
- `reconnectAttempts`
- `alarmScheduled`

### 关键动作日志

建议增加以下清晰日志：

- `ensureConnected skipped: desiredActive=false`
- `ensureConnected skipped: already open`
- `ensureConnected skipped: already connecting`
- `ensureDisconnected skipped: already disconnected`
- `reconnect alarm skipped: desiredActive=false`
- `reconnect alarm skipped: windowCount=0`
- `socket event ignored: stale generation`
- `last window removed, disconnecting bridge`
- `window reopened, reconnecting bridge`

## 修改范围

先控制在最小范围，只动以下两个文件：

1. `tweetClaw/src/service_work/background.ts`
   - 用 `windowCount` 驱动业务活跃状态
   - 所有入口统一收敛

2. `tweetClaw/src/bridge/local-bridge-socket.ts`
   - 幂等 connect/disconnect
   - generation 防旧回调污染
   - reconnect alarm 清理和资格复核

这样可以最小代价形成闭环。

## 验证计划

### Case 1，单 profile 打开

预期：

- boot / created 后只建立一个连接
- 只有一个 `ws_open`
- 只有一个在线实例

### Case 2，单 profile 关闭最后一个窗口

预期：

- 记录 `windowCount=0`
- 主动 disconnect
- Go 很快收到 close / read error / remove
- UI 从 1 变 0

### Case 3，单 profile 关闭后重新打开

预期：

- 关闭时节点下线
- 重开时重新 connect
- UI 从 0 回到 1

### Case 4，一个 profile 有两个窗口，关闭其中一个

预期：

- 不掉线
- UI 仍保持 1

### Case 5，两个 profile 在线，关闭其中一个 profile

预期：

- 只移除被关闭的那个
- 另一个继续 ping
- UI 从 2 变 1

### Case 6，两个 profile 全部关闭

预期：

- 两个都断线并被 Go 删除
- UI 从 2 变 0

### Case 7，关闭 profile 后等待旧 reconnect alarm 触发

预期：

- alarm 即使触发，也会 skip
- 不会把节点重新拉上线

### Case 8，快速关闭再打开

预期：

- 不出现双连接
- 不出现两个 session
- 不出现残留 alarm 干扰

## 风险点

### 风险 1，`chrome.windows.getAll()` 存在短暂时序抖动

有可能 `onRemoved` 刚触发时，`getAll()` 的结果存在短暂竞态。

#### 处理建议

第一版先不加复杂防抖，避免过度设计。

如果后续日志证明这里存在误判，再加最小二次确认，例如：

- 200 到 500ms 延迟后再次读取 `windowCount`
- 两次都为 0 才执行断线

### 风险 2，Chrome 某些唤醒路径没有 window 事件

例如 alarm 唤醒 worker。

#### 处理建议

boot、startup、alarm 路径都先读取 `windowCount`，再决定是否允许连接。

### 风险 3，disconnect 后 UI 不是绝对瞬时下线

Go 端下线仍取决于 close/read error 被感知的时间。

#### 处理建议

只要扩展主动走 close 路径，Go 端就会进入清理逻辑。允许存在极短传播延迟，但不应再出现“持续在线不掉”的旧问题。

## 推荐实施顺序

### 第一步

只实现核心闭环，不做额外重构：

- 去掉 constructor 直接 `connect()`
- 增加 `desiredActive`
- 增加 `connectionGeneration`
- 用 `windowCount` 驱动 `ensureConnected()` / `ensureDisconnected()`
- alarm 增加资格复核

### 第二步

按验证计划跑 8 个 case。

### 第三步

如果仍发现 `windowCount` 判断存在竞态，再增加最小二次确认。

## 最终方案摘要

最终建议采用以下规则：

### 主规则

- `windowCount > 0`，允许在线
- `windowCount == 0`，主动离线

### 辅助规则

- `onSuspend` 仅作兜底断线
- reconnect alarm 仅在 `desiredActive=true` 且 `windowCount>0` 时允许生效
- 所有 connect/disconnect 必须幂等
- 用 `connectionGeneration` 防止旧异步事件污染当前状态

这套方案同时覆盖：

- 关闭窗口又打开
- 关闭 profile 又打开
- 重复 connect
- 残留 reconnect alarm
- 旧 websocket 回调晚到
- 多入口并发触发

是当前问题的最小完整修复方案。
