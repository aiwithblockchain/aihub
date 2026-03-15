# TweetClaw <-> LocalBridgeMac WebSocket 技术文档 v1

## 文档目标

这份文档是给 AI 开发代理使用的执行说明。

目标只有两个：

1. 建立 `tweetClaw` 与 `LocalBridgeMac` 之间的 WebSocket 基础框架。
2. 完成第一个可验证功能：由 `LocalBridgeMac` 点击一个按钮，实时查询当前浏览器中的 X 基础信息，并把结果打印到 Xcode 控制台。

本阶段不要做：

- 不做复杂 UI
- 不做多应用路由
- 不做鉴权系统
- 不做任务队列
- 不做数据库
- 不做跨设备通信

本阶段只做最小闭环。

## 文档使用方式

这份文档负责回答三个问题：

1. 这一阶段到底做什么。
2. 每个 AI 具体负责哪一部分。
3. 每一步做到什么程度才算完成。

协议字段、消息类型、错误码不要在本文件里二次发明，统一参考：

- `docs/tweetclaw-localbridgemac-message-schema-v1.md`

执行 AI 的规则是：

- 先看本文件，明确任务边界
- 再看 schema 文档，照着写常量和消息结构
- 最后才开始编码

如果本文件与 schema 文档冲突：

- 流程和范围，以本文件为准
- 字段和常量，以 schema 文档为准

## 这份文档的真正定位

这份文档不是写给“自己做架构判断”的强 AI。

这份文档是写给下面这种 AI：

- 算力较弱
- 容易犯错
- 但可以持续工作很久
- token 便宜
- 可以一步一步执行

因此，本文件的目标不是“启发它思考”，而是“尽量减少它思考”。

执行 AI 必须遵守：

- 不要自己改需求
- 不要自己扩展范围
- 不要自己发明协议
- 不要因为一个步骤失败就停下
- 必须先自查，再继续下一步

## 单个弱算力 AI 的工作模式

如果只有一个弱算力 AI 在执行，那么它必须按下面模式工作：

1. 只做当前步骤，不并行做多个步骤。
2. 每完成一个步骤，先做本步骤自验。
3. 自验失败，就继续修，不能直接跳下一步。
4. 只有当前步骤自验通过，才能进入下一步。
5. 除非遇到“明确需要人类介入”的事项，否则不能停止。

这个 AI 不应该问自己：

- “我是不是顺手把下一阶段也做了？”
- “我是不是可以优化一下架构？”
- “我是不是可以多加几个字段？”

它只需要问：

- “当前步骤的验收条件是否满足？”

## 什么时候绝对不能停

执行 AI 在以下情况下不能停：

- 代码编译失败，但错误是普通语法错误、类型错误、导入错误
- WebSocket 连接失败，但原因是地址、端口、时机、消息格式写错
- JSON 解析失败，但原因是字段名或结构不一致
- 按钮点击无效，但原因是 selector、target、引用链路接错
- 返回结果不对，但原因是 tabs 查询或 cookie 判断逻辑有误

这些都属于正常开发问题，必须继续修复。

## 什么时候可以继续重试，而不是求助人类

如果遇到下面这些情况，执行 AI 应该继续工作，而不是停止：

- 某个新建文件没有被编译进工程
- Swift struct 不能 decode
- TypeScript interface 与实际 payload 不一致
- service worker 没有自动连接
- 心跳没按预期发送
- `chrome.tabs.query(...)` 返回为空
- `twid` cookie 判断与预期不一致

处理方式：

- 先查看日志
- 再核对 schema 文档
- 再核对本步骤的验收标准
- 改完后重复验证

## 什么时候必须停下来，等待人类介入

只有以下情况，执行 AI 才可以停下来并要求人类介入：

1. 需要人类手动打开 Xcode 或浏览器扩展调试界面，但当前环境无法自动完成。
2. 需要人类手动登录 `x.com`。
3. 需要人类点击浏览器或 macOS 的权限弹窗。
4. 需要人类确认 Xcode Target、Signing、Capabilities 之类的工程设置。
5. 需要人类实际运行最终联调并确认结果。

除了以上情况，不要把普通编码问题上升成人类阻塞。

## 本阶段要解决的问题

当前仓库中：

- `tweetClaw` 是一个 Chrome MV3 浏览器扩展
- 它的后台是 `service worker`
- `LocalBridgeMac` 是一个 macOS AppKit / SwiftUI 混合壳工程

我们要让它们之间建立一条本地 WebSocket 通道：

- `LocalBridgeMac` 提供本地 WebSocket 服务器
- `tweetClaw` 在 `service worker` 中作为 WebSocket 客户端主动连接
- `LocalBridgeMac` 发请求
- `tweetClaw` 返回结构化结果

第一个功能非常具体：

- 查询浏览器中是否有打开的 `x.com` 或 `twitter.com` 页面
- 查询当前浏览器是否已经登录 X
- 查询当前活跃 X 页面的 URL
- 如果打开了多个 X 页面，返回列表
- 列表中每项至少包含 `tabId` 和 `url`
- `LocalBridgeMac` 收到结果后，只需要把结果打印到 Xcode 控制台

## 当前工程落点

### tweetClaw

关键文件：

- `tweetClaw/dist/manifest.json`
- `tweetClaw/src/service_work/background.ts`
- `tweetClaw/src/content/main_entrance.ts`
- `tweetClaw/src/session/session-manager.ts`

当前已知事实：

- `tweetClaw` 已经是 `manifest_version: 3`
- 后台入口已经是 `service_worker`
- 后台已有 `chrome.tabs.query(...)`
- 后台已有 `chrome.cookies.get(...)`
- 后台已有用于判断 X 登录态的 `getAuthenticUid()` 逻辑

这意味着第一个功能的绝大部分查询能力，本质上已经存在于 `background.ts` 里，只是还没有通过 WebSocket 暴露给 `LocalBridgeMac`。

### LocalBridgeMac

关键文件：

- `localBridge/apple/LocalBridgeMac/LocalBridgeMacApp.swift`
- `localBridge/apple/LocalBridgeMac/AppDelegate.swift`
- `localBridge/apple/LocalBridgeMac/MainWindowController.swift`
- `localBridge/apple/LocalBridgeMac/ConversationsSplitViewController.swift`
- `localBridge/apple/LocalBridgeMac/DetailViewController.swift`

当前已知事实：

- 这是一个本地 macOS App
- 当前 UI 很简单
- `DetailViewController` 是最适合先放按钮的地方
- 点击按钮后发起查询，并打印结果到 Xcode 控制台即可

## 技术结论

### 结论 1：方案可行

这个方案是可行的，原因如下：

- Chrome MV3 扩展的 `service worker` 可以创建 WebSocket 连接
- `tweetClaw` 已经具备获取 X tab 和 cookie 的能力
- `LocalBridgeMac` 可以作为本地 WebSocket 服务端
- 双方都在本机运行，链路简单

### 结论 2：连接方向必须固定

本阶段固定采用：

- `tweetClaw` 主动连接 `LocalBridgeMac`
- `LocalBridgeMac` 被动监听本地端口

不要反过来让 `LocalBridgeMac` 主动发现并连接扩展。

原因：

- 浏览器扩展天然适合作为 WebSocket 客户端
- macOS 本地 App 更适合作为长期存在的服务端
- 这样对后续“本地桥接多个应用”更容易扩展

### 结论 3：keep alive 采用应用层 heartbeat

不要把 keep alive 设计成浏览器原生 WebSocket Ping/Pong。

原因：

- 浏览器 `WebSocket` API 不暴露原生 Ping/Pong 控制帧接口
- 所以 `tweetClaw` 侧必须使用应用层消息做 heartbeat

因此本阶段统一使用 JSON 心跳包：

- `ping`
- `pong`

## AI 工作分包

为了降低执行难度，本阶段建议拆成 3 个工作包。

一个弱算力 AI 一次只拿一个工作包，不要跨包实现。

如果只有一个弱算力 AI 在持续执行，也要把这 3 个包按顺序完成：

1. 先完成工作包 A
2. 再完成工作包 B
3. 再完成工作包 C
4. 最后做联调

不要跳过工作包 A。

不要在工作包 A 未完成时直接去写 socket。

### 工作包 A：协议常量与消息骨架

目标：

- 让两端先使用相同消息结构

输入：

- `docs/tweetclaw-localbridgemac-message-schema-v1.md`

输出：

- TS 侧消息常量和 interface
- Swift 侧消息 struct 和 decode / encode 能力

完成标准：

- 两端都能 encode / decode `client.hello`
- 两端都能 encode / decode `ping`
- 两端都能 encode / decode `request.query_x_tabs_status`

### 工作包 B：LocalBridgeMac 服务端

目标：

- 让 Mac App 先成为一个可联调的本地服务端

输入：

- schema 文档
- 本文中的服务端职责说明

输出：

- 本地 WebSocket 服务器
- `client.hello` / `server.hello_ack`
- `ping` / `pong`
- 点击按钮发送 `request.query_x_tabs_status`
- 控制台打印响应

完成标准：

- App 启动即可监听本地端口
- 收到连接后有清晰日志
- 点击按钮时能发出请求

### 工作包 C：tweetClaw 客户端

目标：

- 让扩展主动连接本地服务并返回 X 基础状态

输入：

- schema 文档
- 本文中的客户端职责说明

输出：

- WebSocket 客户端
- 自动重连
- 应用层 heartbeat
- `queryXTabsStatus()` 查询函数
- `response.query_x_tabs_status`

完成标准：

- 扩展启动后会自动连接
- 收到请求后能返回结构化 JSON
- 断开后会自动重连

## 第一阶段最小架构

```
LocalBridgeMac (WebSocket Server)
        ^
        |  ws://127.0.0.1:8765/ws
        v
tweetClaw service worker (WebSocket Client)
        |
        | chrome.tabs / chrome.cookies
        v
Chrome 中打开的 x.com 页面
```

## 第一个功能的定义

功能名：

- `query_x_tabs_status`

触发方式：

- 用户在 `LocalBridgeMac` 中点击按钮

服务端动作：

- `LocalBridgeMac` 向已连接的 `tweetClaw` 发送一个请求消息

客户端动作：

- `tweetClaw service worker` 收到请求
- 读取当前浏览器中的 X tab 状态
- 判断登录态
- 返回结构化响应

最终输出：

- `LocalBridgeMac` 在 Xcode 控制台打印完整结果

## 返回结果定义

本阶段统一返回以下结构：

```json
{
  "id": "req_001",
  "type": "response.query_x_tabs_status",
  "source": "tweetClaw",
  "target": "LocalBridgeMac",
  "timestamp": 1710000000250,
  "payload": {
    "hasXTabs": true,
    "isLoggedIn": true,
    "activeXTabId": 123,
    "activeXUrl": "https://x.com/home",
    "tabs": [
      {
        "tabId": 123,
        "url": "https://x.com/home",
        "active": true
      },
      {
        "tabId": 124,
        "url": "https://x.com/someuser/status/123456789",
        "active": false
      }
    ]
  }
}
```

字段含义：

- `id`: 回显原始请求 id，用于 request-response 对应
- `hasXTabs`: 是否至少存在一个 X 页面
- `isLoggedIn`: 是否检测到已登录态
- `activeXTabId`: 当前激活的 X tab id，没有则为 `null`
- `activeXUrl`: 当前激活的 X 页面 URL，没有则为 `null`
- `tabs`: 所有已打开 X 页面的列表

## 登录态的判断规则

本阶段统一采用最简单规则：

- 使用 `chrome.cookies.get({ url: "https://x.com", name: "twid" })`
- 如果 `twid` 存在，则认为当前浏览器已登录 X
- 如果不存在，则认为当前浏览器未登录 X

注意：

- 这是“浏览器 profile 级别”的登录判断
- 不是“某个 tab 级别”的登录判断
- 对本阶段足够

## X 页面列表的判断规则

本阶段统一采用：

```ts
chrome.tabs.query({ url: ["*://x.com/*", "*://twitter.com/*"] })
```

然后把每个 tab 归一化为：

```json
{
  "tabId": 123,
  "url": "https://x.com/home",
  "active": true
}
```

## 当前活跃 X URL 的判断规则

本阶段规则如下：

1. 先查所有 X tabs。
2. 再从 X tabs 中找到 `active === true && currentWindow === true` 的 tab。
3. 如果找到了，这个 tab 的 URL 就是 `activeXUrl`。
4. 如果没找到，则 `activeXTabId = null`，`activeXUrl = null`。

注意：

- 即使没有活跃 X tab，只要存在其他后台 X tab，`hasXTabs` 仍然是 `true`

## WebSocket 消息协议

本阶段只定义最小协议，不做复杂抽象。

### 统一消息外层

所有消息都使用统一外层：

```json
{
  "id": "msg_001",
  "type": "client.hello",
  "source": "tweetClaw",
  "target": "LocalBridgeMac",
  "timestamp": 1710000000000,
  "payload": {}
}
```

统一字段：

- `id`: 当前消息 id
- `type`: 消息类型
- `source`: 发送方
- `target`: 接收方
- `timestamp`: 毫秒时间戳
- `payload`: 业务内容

### 本阶段需要的消息类型

连接建立：

- `client.hello`
- `server.hello_ack`

心跳：

- `ping`
- `pong`

业务请求：

- `request.query_x_tabs_status`
- `response.query_x_tabs_status`

错误：

- `response.error`

### client.hello

`tweetClaw` 在 WebSocket 打开后立即发送：

```json
{
  "id": "msg_hello_001",
  "type": "client.hello",
  "source": "tweetClaw",
  "target": "LocalBridgeMac",
  "timestamp": 1710000000000,
  "payload": {
    "clientName": "tweetClaw",
    "clientVersion": "0.3.17",
    "browser": "chrome",
    "capabilities": ["query_x_tabs_status"]
  }
}
```

### server.hello_ack

`LocalBridgeMac` 收到 `client.hello` 后返回：

```json
{
  "id": "msg_hello_ack_001",
  "type": "server.hello_ack",
  "source": "LocalBridgeMac",
  "target": "tweetClaw",
  "timestamp": 1710000000100,
  "payload": {
    "serverName": "LocalBridgeMac",
    "serverVersion": "0.1.0",
    "heartbeatIntervalMs": 20000
  }
}
```

### request.query_x_tabs_status

`LocalBridgeMac` 点击按钮后发送：

```json
{
  "id": "req_001",
  "type": "request.query_x_tabs_status",
  "source": "LocalBridgeMac",
  "target": "tweetClaw",
  "timestamp": 1710000000200,
  "payload": {}
}
```

### response.query_x_tabs_status

`tweetClaw` 返回：

```json
{
  "id": "req_001",
  "type": "response.query_x_tabs_status",
  "source": "tweetClaw",
  "target": "LocalBridgeMac",
  "timestamp": 1710000000250,
  "payload": {
    "hasXTabs": true,
    "isLoggedIn": true,
    "activeXTabId": 123,
    "activeXUrl": "https://x.com/home",
    "tabs": [
      {
        "tabId": 123,
        "url": "https://x.com/home",
        "active": true
      }
    ]
  }
}
```

### response.error

如果处理失败：

```json
{
  "id": "req_001",
  "type": "response.error",
  "source": "tweetClaw",
  "target": "LocalBridgeMac",
  "timestamp": 1710000000250,
  "payload": {
    "code": "NO_SOCKET_HANDLER",
    "message": "Unsupported request type"
  }
}
```

## keep alive 设计

### 目标

在 Chrome MV3 中，`service worker` 不是永久常驻进程。

因此 keep alive 的目标不是“保证永远不掉线”，而是：

- 连接活跃时尽量保持在线
- 掉线后自动重连
- 保证 `LocalBridgeMac` 能知道当前扩展是否在线

### 心跳规则

本阶段统一规则：

- 连接建立成功后，`tweetClaw` 每 `20s` 发送一次 `ping`
- `LocalBridgeMac` 收到后立即回复 `pong`
- 如果 `tweetClaw` 连续 `60s` 没收到 `pong`，主动关闭并重连
- 如果 `LocalBridgeMac` 连续 `60s` 没收到 `ping`，判定客户端离线

### 重连规则

`tweetClaw` 客户端掉线后使用简单退避：

- 第 1 次：1 秒后重连
- 第 2 次：2 秒后重连
- 第 3 次：5 秒后重连
- 第 4 次及以后：10 秒后重连

不要在本阶段实现复杂退避算法。

### 为什么由 tweetClaw 发 ping

本阶段由 `tweetClaw` 发 `ping`，原因是：

- 我们更关心扩展是否仍然活着
- 扩展侧掉线概率高于本地 App
- 让客户端定期“报活”更直接

## 文件拆分建议

本阶段必须控制文件数量，不要过度设计。

### tweetClaw 侧建议新增文件

- `tweetClaw/src/bridge/ws-protocol.ts`
- `tweetClaw/src/bridge/local-bridge-socket.ts`

### tweetClaw 侧建议修改文件

- `tweetClaw/src/service_work/background.ts`
- `tweetClaw/dist/manifest.json`
- 如果构建脚本需要，也要同步修改 `webpack.config.js`

### LocalBridgeMac 侧建议新增文件

- `localBridge/apple/LocalBridgeMac/BridgeMessage.swift`
- `localBridge/apple/LocalBridgeMac/LocalBridgeWebSocketServer.swift`
- `localBridge/apple/LocalBridgeMac/LocalBridgeSessionStore.swift`

### LocalBridgeMac 侧建议修改文件

- `localBridge/apple/LocalBridgeMac/DetailViewController.swift`
- `localBridge/apple/LocalBridgeMac/AppDelegate.swift`
- 如果需要，也可以改 `ConversationsSplitViewController.swift`

## 文件级交付边界

这一节是给执行 AI 的硬规则。

### 负责 tweetClaw 的 AI 不要修改

- `localBridge/apple/**`
- `docs/**`

### 负责 LocalBridgeMac 的 AI 不要修改

- `tweetClaw/src/**`
- `tweetClaw/dist/manifest.json`
- `docs/**`

### 负责协议常量的 AI 不要顺手实现业务逻辑

它只需要产出：

- 常量
- 类型
- 最小 encode / decode

不要在这一包里开始写 socket 重连、按钮、tabs 查询。

## 单个弱算力 AI 的推荐执行顺序

如果是一个 AI 从头做到尾，必须严格执行以下顺序：

### 阶段 1：协议落地

只处理：

- 常量
- 消息类型
- interface / struct
- encode / decode

完成条件：

- 不跑网络也能构造和解析所有 v1 消息

### 阶段 2：LocalBridgeMac 服务端落地

只处理：

- 本地监听
- 接收连接
- 收消息
- 发消息
- 控制台日志

完成条件：

- 服务端启动后能稳定监听本地端口

### 阶段 3：tweetClaw 客户端落地

只处理：

- WebSocket 连接
- hello
- heartbeat
- 重连

完成条件：

- `tweetClaw` 可以主动连上 `LocalBridgeMac`

### 阶段 4：浏览器查询能力落地

只处理：

- `queryXTabsStatus()`
- X tabs 查询
- 登录态查询
- 结构化响应拼装

完成条件：

- 不依赖 WebSocket，也能独立得到正确 JSON 结果

### 阶段 5：联调闭环

只处理：

- 按钮触发请求
- 扩展返回响应
- Mac 控制台打印结果

完成条件：

- 4 个验证场景全部通过

## 每个文件的职责

### tweetClaw/src/bridge/ws-protocol.ts

职责：

- 定义消息类型字符串
- 定义 TypeScript interface
- 提供最简单的消息构造函数

这里只做协议定义，不做连接逻辑。

### tweetClaw/src/bridge/local-bridge-socket.ts

职责：

- 创建 WebSocket 客户端
- 连接 `ws://127.0.0.1:8765/ws`
- 维护连接状态
- 发送 `client.hello`
- 发送 `ping`
- 处理 `pong`
- 处理 `request.query_x_tabs_status`
- 断线重连

不要把太多浏览器业务逻辑塞进这个文件。

### tweetClaw/src/service_work/background.ts

职责：

- 在启动时初始化 `LocalBridgeSocket`
- 提供 `queryXTabsStatus()` 这种浏览器查询函数
- 让 `LocalBridgeSocket` 调用它获取结果

本阶段推荐新增一个独立函数：

```ts
async function queryXTabsStatus(): Promise<...>
```

不要直接把所有逻辑写进 `socket.onmessage` 回调里。

### LocalBridgeMac/BridgeMessage.swift

职责：

- 定义 Swift 侧消息结构
- 负责 JSON encode / decode
- 保证和 TS 协议字段一致

### LocalBridgeMac/LocalBridgeWebSocketServer.swift

职责：

- 启动本地 WebSocket 服务器
- 监听 `127.0.0.1:8765`
- 管理当前连接
- 收发 JSON 文本消息
- 处理 `client.hello`
- 处理 `ping`
- 提供发送 `request.query_x_tabs_status` 的方法

### LocalBridgeMac/LocalBridgeSessionStore.swift

职责：

- 保存当前连接状态
- 保存最近一次 `pong` 时间
- 保存最近一次查询返回

本阶段只需要内存级别保存，不要落盘。

### LocalBridgeMac/DetailViewController.swift

职责：

- 增加一个按钮，例如 `Query X Status`
- 点击按钮时调用 server 的 `sendQueryXTabsStatus()`
- 收到响应后打印到控制台

本阶段打印到控制台即可，不需要渲染复杂 UI。

## LocalBridgeMac 服务端实现建议

### 推荐技术

优先使用 Apple 自带 `Network.framework`：

- `NWListener`
- `NWConnection`
- `NWProtocolWebSocket`

原因：

- 不引入第三方依赖
- 与 Xcode 工程天然兼容
- 足够完成本阶段需求

### 服务端只做一件事

本阶段服务端只做一个连接就够了。

不要一开始就设计：

- 多客户端池
- 路由表
- 房间系统
- 多会话调度

最简单策略：

- 只接受一个有效 `tweetClaw` 连接
- 新连接到来时，可以替换旧连接

### 监听地址

固定为：

- Host: `127.0.0.1`
- Port: `8765`
- Path: `/ws`

注意：

- 本阶段只监听本地回环地址
- 不要监听 `0.0.0.0`
- 如果 `Network.framework` 第一版对 path 处理成本过高，v1 可以先只固定 `127.0.0.1:8765`，暂时忽略 `/ws` 路径匹配

## tweetClaw 客户端实现建议

### 连接时机

在 `service worker` 初始化时创建连接器。

建议方式：

- `background.ts` 顶层创建单例
- 扩展加载时自动尝试连接
- 如果要依赖 WebSocket 活跃连接帮助维持 worker 生命周期，建议在 `manifest.json` 中补充 `minimum_chrome_version: "116"`

### 查询能力放在 background

第一个功能不要通过 content script 去取数据。

直接在 `background.ts` 中完成即可，因为它已经有：

- `chrome.tabs.query`
- `chrome.cookies.get`

这能把第一阶段难度压到最低。

### queryXTabsStatus 的推荐行为

伪代码：

```ts
1. query 所有 x.com / twitter.com tabs
2. query 当前 window 中 active 的 tab
3. 从 X tabs 中找 active tab
4. 读取 twid cookie 判断是否登录
5. 拼出结构化 payload 返回
```

## AI 执行顺序

AI 算力较弱时，必须按下面顺序做，不要跳步。

### Step 1

先只创建协议类型文件：

- `ws-protocol.ts`
- `BridgeMessage.swift`

验收标准：

- 两边都能表达同一套 JSON 结构
- 先不连网络
- 只要 encode / decode 正常，这一步就结束，不要提前写 socket

自验动作：

- 用最小测试数据构造 `client.hello`
- encode 成 JSON
- 再 decode 回对象
- 确认 `id/type/source/target/timestamp/payload` 六个字段都还在

自验通过标准：

- TS 侧成功一次
- Swift 侧成功一次

### Step 2

只在 `LocalBridgeMac` 中搭一个最小 WebSocket 服务器，先不发业务请求。

验收标准：

- App 启动后服务开始监听 `127.0.0.1:8765`
- 控制台能打印“server started”
- 这一步完成后也不要继续做业务请求，先停下来联调连接

自验动作：

- 启动 `LocalBridgeMac`
- 观察 Xcode 控制台

自验通过标准：

- 控制台稳定打印服务启动日志
- 没有立即崩溃

### Step 3

在 `tweetClaw service worker` 中实现最小 WebSocket 客户端，只做连接和 `client.hello`。

验收标准：

- 启动扩展后能连接本地服务
- `LocalBridgeMac` 控制台能打印收到 `client.hello`
- 这一步不要求 tabs 查询，不要把需求混在一起

自验动作：

- 重新加载扩展
- 观察扩展日志
- 观察 Xcode 控制台

自验通过标准：

- 扩展端出现 `websocket open`
- Mac 端出现 `received client.hello`

### Step 4

实现心跳：

- `tweetClaw` 定时发 `ping`
- `LocalBridgeMac` 回 `pong`

验收标准：

- 控制台能持续打印 `ping/pong`
- 手动关闭 `LocalBridgeMac` 后，扩展端能触发重连日志

自验动作：

- 等待至少 1 轮 heartbeat
- 手动关闭或停止 Mac 服务
- 观察扩展是否出现 close 和 reconnect 日志

自验通过标准：

- 至少成功完成 1 次 `ping -> pong`
- 服务断开后扩展有重连行为

### Step 5

在 `tweetClaw background.ts` 中实现 `queryXTabsStatus()`

验收标准：

- 本地手工调用这个函数时能返回结构化结果
- 不依赖 WebSocket 也能自测
- 如果这个函数没独立跑通，不要进入下一步

自验动作：

- 在 background 可调试位置单独调用 `queryXTabsStatus()`
- 分别测试“无 X 页面”和“有 X 页面”两种情况

自验通过标准：

- 返回对象字段齐全
- 空值使用 `null`
- 没有多余字段

### Step 6

把 `request.query_x_tabs_status` 接到 WebSocket 消息处理上。

验收标准：

- `tweetClaw` 收到请求后返回 `response.query_x_tabs_status`

自验动作：

- 从 Mac 端发 `request.query_x_tabs_status`
- 观察扩展日志是否进入请求处理逻辑

自验通过标准：

- 返回的 `type` 正确
- 返回的 `id` 与请求一致
- 返回 payload 符合 schema

### Step 7

在 `DetailViewController` 增加按钮并触发查询。

验收标准：

- 点击按钮会发送请求
- 控制台能打印响应 JSON

自验动作：

- 打开 `LocalBridgeMac`
- 点击按钮
- 观察 Xcode 控制台

自验通过标准：

- 看到“发送请求”日志
- 看到“收到响应”日志
- 控制台打印出结果字段

## 每一步的明确交付物

弱算力 AI 容易在“写了一半但不知道是否完成”上卡住，所以这里写死交付物。

### Step 1 交付物

- TS 协议文件 1 个
- Swift 协议文件 1 个

### Step 2 交付物

- Swift 服务端文件 1 个
- App 启动监听日志 1 条

### Step 3 交付物

- TS socket 客户端文件 1 个
- `client.hello` 联调日志 1 组

### Step 4 交付物

- 心跳定时器
- `ping/pong` 日志 1 组

### Step 5 交付物

- `queryXTabsStatus()` 函数 1 个
- 独立调试输出 1 组

### Step 6 交付物

- 请求处理分支 1 个
- `response.query_x_tabs_status` 返回日志 1 组

### Step 7 交付物

- 按钮 1 个
- 点击日志 1 组
- 控制台结果打印 1 组

## 每一步失败后的处理规则

执行 AI 不能在失败后停住，必须按下面顺序处理。

### 规则 1

先看最近 20 行相关日志。

### 规则 2

再核对当前步骤是否违反 schema 文档。

### 规则 3

再检查是否跳步了。

常见跳步错误：

- 还没完成 hello，就去做业务请求
- 还没完成 ping/pong，就去查 tabs
- 还没把 `queryXTabsStatus()` 单独跑通，就直接联调按钮

### 规则 4

一次只修一个问题。

不要同时改：

- 消息结构
- 连接时机
- UI 触发逻辑

否则弱算力 AI 很容易把问题扩大。

### 规则 5

修完以后，重新跑当前步骤的自验。

只有当前步骤通过，才能继续。

## 最小 UI 方案

本阶段 UI 不要扩展过多。

只需要在 `DetailViewController` 中新增：

- 一个按钮：`Query X Status`
- 一个状态标签：`Socket Connected` / `Socket Disconnected`

如果 AI 时间不够：

- 状态标签可以先不做
- 先保证按钮能发请求并打印日志

## 控制台打印格式

为了便于验证，`LocalBridgeMac` 的日志必须稳定。

成功时建议打印：

```text
[LocalBridgeMac] query_x_tabs_status success
[LocalBridgeMac] hasXTabs=true
[LocalBridgeMac] isLoggedIn=true
[LocalBridgeMac] activeXTabId=123
[LocalBridgeMac] activeXUrl=https://x.com/home
[LocalBridgeMac] tabs=[{tabId:123,url:https://x.com/home,active:true}]
```

失败时建议打印：

```text
[LocalBridgeMac] query_x_tabs_status failed
[LocalBridgeMac] error=...
```

## 详细验证方法

AI 必须按下面场景逐个验证。

### 场景 A：浏览器未打开任何 X 页面

准备：

- 关闭所有 `x.com` / `twitter.com` 页面

期望：

- `hasXTabs = false`
- `activeXTabId = null`
- `activeXUrl = null`
- `tabs = []`
- `isLoggedIn` 可为 `true` 或 `false`

说明：

- 因为 cookie 可能仍然存在，所以“未打开 X 页面”不等于“未登录”

### 场景 B：浏览器打开一个 X 页面，但未登录

准备：

- 打开 `https://x.com`
- 保证当前浏览器 profile 未登录

期望：

- `hasXTabs = true`
- `tabs.length = 1`
- `activeXUrl` 为当前打开页面 URL
- `isLoggedIn = false`

### 场景 C：浏览器打开一个 X 页面，且已登录

准备：

- 打开已登录的 `x.com`

期望：

- `hasXTabs = true`
- `tabs.length >= 1`
- `activeXUrl` 为当前活跃 X 页面 URL
- `isLoggedIn = true`

### 场景 D：浏览器同时打开多个 X 页面

准备：

- 打开多个 `x.com` 页面
- 至少有一个是当前激活页

期望：

- `hasXTabs = true`
- `tabs.length >= 2`
- 每个元素都有 `tabId` 和 `url`
- `activeXTabId` 对应当前激活页
- `activeXUrl` 对应当前激活页 URL

## 联调时的固定检查顺序

执行 AI 在做最终联调时，必须永远按下面顺序检查：

1. `LocalBridgeMac` 是否已经启动监听。
2. `tweetClaw` 是否已经连接成功。
3. `client.hello` / `server.hello_ack` 是否已经出现。
4. `ping/pong` 是否已经出现。
5. 点击按钮时是否真的发出 `request.query_x_tabs_status`。
6. `tweetClaw` 是否真的收到请求。
7. `tweetClaw` 是否真的返回响应。
8. `LocalBridgeMac` 是否真的打印结果。

如果第 3 步失败，就不要检查第 5 步。

如果第 4 步失败，就不要直接怀疑 tabs 查询。

如果第 5 步失败，就不要直接改扩展逻辑。

必须沿着链路顺序排查。

## 完成标准

只有同时满足以下条件，第一阶段才算完成：

1. `LocalBridgeMac` 成功启动本地 WebSocket 服务器。
2. `tweetClaw service worker` 能自动连接到该服务器。
3. 双方完成 `client.hello` / `server.hello_ack`。
4. 双方完成应用层 `ping/pong` keep alive。
5. 点击 `LocalBridgeMac` 按钮后，会发出 `request.query_x_tabs_status`。
6. `tweetClaw` 返回结构化响应。
7. `LocalBridgeMac` 在 Xcode 控制台打印正确结果。
8. 上述四个验证场景都能通过。

## 最终交付前，执行 AI 必须给出这份自验结论

执行 AI 在结束前，必须明确写出下面 4 行结论：

1. `协议层已通过`
2. `连接层已通过`
3. `业务查询层已通过`
4. `最终联调待人类确认` 或 `最终联调已通过`

如果连这 4 行都不能明确写出来，说明它还没有做完。

## 本阶段明确不要做的事情

下面这些内容全部放到下一阶段：

- 让 `tweetClaw` 直接执行点赞、转发、发推
- 让 Mac App 支持多个浏览器扩展同时连接
- 引入命令队列和任务调度器
- 在本地端口上做完整鉴权系统
- 设计最终版协议
- 构建生产级 UI

## AI 编码注意事项

### 注意 1

不要把第一阶段做成“通用 RPC 框架”。

只支持当前需要的几种消息类型即可。

### 注意 2

不要一开始就抽象过头。

例如：

- 不要写很多 protocol / generic
- 不要拆十几个 Swift 文件
- 不要引入状态机框架

### 注意 3

优先保证日志清晰。

AI 开发这种本地桥接功能时，最容易卡住的是：

- 连接没建立
- 消息没发出去
- 消息解析失败
- 心跳丢失

所以日志比 UI 更重要。

### 注意 4

优先保证 request-response 可验证，再优化代码结构。

### 注意 5

每个执行 AI 在提交代码前，必须用一句话说明自己完成的是哪个工作包。

例如：

- `我完成的是工作包 B：LocalBridgeMac 服务端`
- `我完成的是工作包 C：tweetClaw 客户端`

如果说不清这个问题，说明它的改动范围太散。

## 推荐日志点

以下日志必须存在：

### LocalBridgeMac

- server started
- client connected
- client disconnected
- received client.hello
- sent server.hello_ack
- received ping
- sent pong
- sent request.query_x_tabs_status
- received response.query_x_tabs_status

### tweetClaw

- websocket connecting
- websocket open
- websocket closed
- websocket reconnect scheduled
- sent client.hello
- received server.hello_ack
- sent ping
- received pong
- received request.query_x_tabs_status
- sent response.query_x_tabs_status

## 推荐的后续扩展方向

等第一阶段跑通后，再做第二阶段：

- 查询当前账号基础信息
- 查询当前时间线摘要
- 读取当前详情页 tweet id
- 执行点赞 / 转发 / 发推

但这些都不属于本阶段。

## 参考资料

用于确认技术边界的资料：

- Apple WWDC19，`Network.framework` 支持通过 `NWListener` 和 `NWConnection` 做 WebSocket 客户端与服务端：<https://developer.apple.com/cn/videos/play/wwdc2019/712/>
- Chrome Extensions 官方文档，MV3 service worker 可使用 WebSocket，且连接活跃时可刷新空闲计时器：<https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets>
- Chrome Extensions service worker 生命周期说明：<https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle>
- WHATWG WebSocket 标准说明：浏览器 WebSocket API 不暴露 Ping/Pong 控制帧：<https://websockets.spec.whatwg.org/>

## 一句话总结

第一阶段只做一件事：

让 `LocalBridgeMac` 和 `tweetClaw service worker` 建立稳定的本地 WebSocket 通道，并通过一个按钮成功查询“当前 X 页面是否打开、是否登录、URL 是什么”，然后把结果打印到 Xcode 控制台。
