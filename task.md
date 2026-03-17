# Task：LocalBridgeMac TweetClaw 功能补全

> **当前状态（2026-03-17 已完成部分）**
> - WebSocket 协议层（ws-protocol.ts / local-bridge-socket.ts）：✅ 已完成，包含 exec_action
> - background.ts 所有 handler：✅ 已完成，包含超时保护
> - BridgeMessage.swift 结构体：✅ 已完成
> - LocalBridgeWebSocketServer.swift REST 路由：✅ 已完成（10 个接口）
> - api_docs.json（For Bots 面板）：✅ 已完成（10 条文档）
>
> **本次任务新增内容（未完成，需执行）：**
> - Task A：For Human 面板补充 5 个写操作的测试按钮
> - Task B：新增 GET /api/v1/docs REST 接口，返回完整 api_docs.json
> - Task C：编写 Python 测试脚本，覆盖所有 REST API
>
> **执行前必读文件列表见文末"文件路径速查表"**

---

## 背景架构说明

```
用户 / AI Bot
    │  HTTP REST (127.0.0.1:8769)
    ▼
LocalBridgeMac (macOS App)
    │  WebSocket (ws://127.0.0.1:8765/ws)
    ▼
tweetClaw (Chrome 浏览器扩展)
    │  chrome.tabs / GraphQL Mutation / Legacy REST
    ▼
X.com (Twitter)
```

- REST HTTP 服务端口：**8769**
- WebSocket 端口：**8765**（tweetClaw 扩展连接用）
- `TweetClawHumanViewController`：界面 "TweetClaw - For Human"，供人工手动测试
- `TweetClawClawViewController`：界面 "TweetClaw - API for Bots"，展示 api_docs.json 文档，供 Bot 参考

---

## 当前已实现的全部 REST API（共 10 个）

| # | Method | Path | 功能 | 参数 |
|---|--------|------|------|------|
| 1 | GET | `/api/v1/x/status` | 查询所有 X 标签页状态 | 无 |
| 2 | GET | `/api/v1/x/basic_info` | 获取登录账号完整资料 | 无 |
| 3 | POST | `/tweetclaw/open-tab` | 新建 X 标签页 | `{"path": "home"}` |
| 4 | POST | `/tweetclaw/close-tab` | 关闭指定标签页 | `{"tabId": 123}` |
| 5 | POST | `/tweetclaw/navigate-tab` | 在标签页内跳转路径 | `{"tabId": 123, "path": "home"}` |
| 6 | POST | `/api/v1/x/likes` | 点赞推文 | `{"tweetId": "..."}` |
| 7 | POST | `/api/v1/x/retweets` | 转推 | `{"tweetId": "..."}` |
| 8 | POST | `/api/v1/x/bookmarks` | 收藏推文 | `{"tweetId": "..."}` |
| 9 | POST | `/api/v1/x/follows` | 关注用户 | `{"userId": "..."}` |
| 10 | POST | `/api/v1/x/unfollows` | 取消关注用户 | `{"userId": "..."}` |

---

## Task A：补全 TweetClawHumanViewController 的测试 UI

### 背景

`TweetClawHumanViewController`（"For Human" 面板）目前只有 5 个控制组件，对应前 5 个 REST API：

- ✅ Query X Status 按钮
- ✅ Query X Basic Info 按钮
- ✅ Open Tab（路径输入框 + 按钮）
- ✅ Close Tab（Tab ID 输入框 + 按钮）
- ✅ Navigate Tab（Tab ID + 路径输入框 + 按钮）

**缺失**：下方 5 个写操作没有任何 UI 入口：

- ❌ Like Tweet
- ❌ Retweet
- ❌ Bookmark Tweet
- ❌ Follow User
- ❌ Unfollow User

### 需要修改的文件

`/Users/hyperorchid/aiwithblockchain/aihub/localBridge/apple/LocalBridgeMac/TweetClawTabControllers.swift`

中的 `TweetClawHumanViewController` 类。

### UI 设计规范

仿照已有的 `openTabStack` / `closeTabStack` / `navigateStack` 的布局模式，**在现有 `leftStack` 的末尾追加**以下 5 组控件：

#### Like Tweet 组
```
[输入框 placeholder="Tweet ID"]  [Like 按钮]
```
- 输入框变量名：`likeTweetIdTextField`
- 按钮标题：`"点赞 Tweet"`
- 按钮 action：`#selector(likeTweetClicked)`

#### Retweet 组
```
[输入框 placeholder="Tweet ID"]  [Retweet 按钮]
```
- 输入框变量名：`retweetTweetIdTextField`
- 按钮标题：`"转推 Tweet"`
- 按钮 action：`#selector(retweetClicked)`

#### Bookmark 组
```
[输入框 placeholder="Tweet ID"]  [Bookmark 按钮]
```
- 输入框变量名：`bookmarkTweetIdTextField`
- 按钮标题：`"收藏 Tweet"`
- 按钮 action：`#selector(bookmarkClicked)`

#### Follow User 组
```
[输入框 placeholder="User ID"]  [Follow 按钮]
```
- 输入框变量名：`followUserIdTextField`
- 按钮标题：`"关注用户"`
- 按钮 action：`#selector(followClicked)`

#### Unfollow User 组
```
[输入框 placeholder="User ID"]  [Unfollow 按钮]
```
- 输入框变量名：`unfollowUserIdTextField`
- 按钮标题：`"取消关注"`
- 按钮 action：`#selector(unfollowClicked)`

### 需要新增的方法

在 `TweetClawHumanViewController` 中新增以下方法，模式与 `openTabClicked` 完全一致：

```swift
// ── Like ──────────────────────────────────────────────
@objc private func likeTweetClicked() {
    let tweetId = likeTweetIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !tweetId.isEmpty else {
        resultTextView.string = "Error: Tweet ID is required"
        return
    }
    resultTextView.string = "Liking tweet: \(tweetId)...\n"
    AppDelegate.shared?.sendExecAction(action: "like", tweetId: tweetId, userId: nil, tabId: nil)
}

@objc private func handleLikeTweetResult(_ notification: Notification) {
    guard let userInfo = notification.userInfo,
          let jsonString = userInfo["dataString"] as? String else { return }
    DispatchQueue.main.async { self.resultTextView.string = jsonString }
}

// ── Retweet ───────────────────────────────────────────
@objc private func retweetClicked() {
    let tweetId = retweetTweetIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !tweetId.isEmpty else {
        resultTextView.string = "Error: Tweet ID is required"
        return
    }
    resultTextView.string = "Retweeting: \(tweetId)...\n"
    AppDelegate.shared?.sendExecAction(action: "retweet", tweetId: tweetId, userId: nil, tabId: nil)
}

@objc private func handleRetweetResult(_ notification: Notification) {
    guard let userInfo = notification.userInfo,
          let jsonString = userInfo["dataString"] as? String else { return }
    DispatchQueue.main.async { self.resultTextView.string = jsonString }
}

// ── Bookmark ──────────────────────────────────────────
@objc private func bookmarkClicked() {
    let tweetId = bookmarkTweetIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !tweetId.isEmpty else {
        resultTextView.string = "Error: Tweet ID is required"
        return
    }
    resultTextView.string = "Bookmarking: \(tweetId)...\n"
    AppDelegate.shared?.sendExecAction(action: "bookmark", tweetId: tweetId, userId: nil, tabId: nil)
}

@objc private func handleBookmarkResult(_ notification: Notification) {
    guard let userInfo = notification.userInfo,
          let jsonString = userInfo["dataString"] as? String else { return }
    DispatchQueue.main.async { self.resultTextView.string = jsonString }
}

// ── Follow ────────────────────────────────────────────
@objc private func followClicked() {
    let userId = followUserIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !userId.isEmpty else {
        resultTextView.string = "Error: User ID is required"
        return
    }
    resultTextView.string = "Following user: \(userId)...\n"
    AppDelegate.shared?.sendExecAction(action: "follow", tweetId: nil, userId: userId, tabId: nil)
}

@objc private func handleFollowResult(_ notification: Notification) {
    guard let userInfo = notification.userInfo,
          let jsonString = userInfo["dataString"] as? String else { return }
    DispatchQueue.main.async { self.resultTextView.string = jsonString }
}

// ── Unfollow ──────────────────────────────────────────
@objc private func unfollowClicked() {
    let userId = unfollowUserIdTextField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !userId.isEmpty else {
        resultTextView.string = "Error: User ID is required"
        return
    }
    resultTextView.string = "Unfollowing user: \(userId)...\n"
    AppDelegate.shared?.sendExecAction(action: "unfollow", tweetId: nil, userId: userId, tabId: nil)
}

@objc private func handleUnfollowResult(_ notification: Notification) {
    guard let userInfo = notification.userInfo,
          let jsonString = userInfo["dataString"] as? String else { return }
    DispatchQueue.main.async { self.resultTextView.string = jsonString }
}
```

### AppDelegate / LocalBridgeWebSocketServer 需要新增的方法

`TweetClawHumanViewController` 调用的 `AppDelegate.shared?.sendExecAction(...)` 需要：

1. 在 `AppDelegate.swift` 中新增：
```swift
func sendExecAction(action: String, tweetId: String?, userId: String?, tabId: Int?) {
    wsServer.sendExecAction(action: action, tweetId: tweetId, userId: userId, tabId: tabId)
}
```

2. 在 `LocalBridgeWebSocketServer.swift` 中新增 `sendExecAction(...)` 方法，模式与 `sendOpenTab`、`sendCloseTab` 完全一致：
   - 构造 `ExecActionRequestPayload`
   - 发送 `requestExecAction` 消息
   - 设置 `pendingUiRequests`
   - 10 秒超时
   - 响应时发送 `NSNotification.Name("ExecActionReceived")` 通知

3. 在 `handleIncomingMessage` 的 `responseExecAction` case 中，除了处理 `pendingHttpCallbacks` 之外，**同时**发送 UI 通知（目前只处理了 HTTP callback，没有发 UI 通知——这是当前代码的 bug）：
```swift
case .responseExecAction:
    if let callback = self.pendingHttpCallbacks[peekMsg.id] {
        callback(data)
        self.pendingHttpCallbacks.removeValue(forKey: peekMsg.id)
    }
    // 新增：发送 UI 通知
    if self.pendingUiRequests.contains(peekMsg.id) {
        self.pendingUiRequests.remove(peekMsg.id)
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        if let resp = try? JSONDecoder().decode(BaseMessage<ExecActionResponsePayload>.self, from: data),
           let formattedData = try? encoder.encode(resp.payload),
           let formattedString = String(data: formattedData, encoding: .utf8) {
            NotificationCenter.default.post(
                name: NSNotification.Name("ExecActionReceived"),
                object: nil,
                userInfo: ["dataString": formattedString]
            )
        }
    }
```

4. 在 `TweetClawHumanViewController.viewDidLoad()` 中注册上述 5 个 Notification observer，通知名统一为 `"ExecActionReceived"`（所有写操作共用同一个通知名即可，结果都输出到同一个 resultTextView）：
```swift
NotificationCenter.default.addObserver(self, selector: #selector(handleExecActionResult(_:)),
    name: NSNotification.Name("ExecActionReceived"), object: nil)
```

并将各 `handleLikeTweetResult`、`handleRetweetResult` 等方法合并为一个：
```swift
@objc private func handleExecActionResult(_ notification: Notification) {
    guard let userInfo = notification.userInfo,
          let jsonString = userInfo["dataString"] as? String else { return }
    DispatchQueue.main.async { self.resultTextView.string = jsonString }
}
```

---

## Task B：新增 GET /api/v1/docs REST 接口

### 功能描述

Bot 可以通过 `GET http://127.0.0.1:8769/api/v1/docs` 获取所有已实现 REST API 的完整说明文档（即 api_docs.json 的完整内容），无需依赖 WebSocket，直接返回。

### 需要修改的文件

`/Users/hyperorchid/aiwithblockchain/aihub/localBridge/apple/LocalBridgeMac/LocalBridgeWebSocketServer.swift`

### 修改内容

#### 1. 在路由分发 `receiveHttpRequest` 中新增一行（在现有 else 之前）：

```swift
} else if request.contains("GET /api/v1/docs") {
    self.handleApiDocsHttpRequest(connection)
}
```

#### 2. 新增处理方法：

```swift
private func handleApiDocsHttpRequest(_ connection: NWConnection) {
    // 优先从 Bundle 读取，开发阶段 fallback 到绝对路径
    var jsonString: String? = nil

    if let url = Bundle.main.url(forResource: "api_docs", withExtension: "json"),
       let data = try? Data(contentsOf: url) {
        jsonString = String(data: data, encoding: .utf8)
    }

    if jsonString == nil {
        let path = "/Users/hyperorchid/aiwithblockchain/aihub/localBridge/apple/LocalBridgeMac/api_docs.json"
        if let data = try? Data(contentsOf: URL(fileURLWithPath: path)) {
            jsonString = String(data: data, encoding: .utf8)
        }
    }

    if let body = jsonString {
        sendHttpResponse(connection, status: "200 OK", body: body)
    } else {
        sendHttpResponse(connection, status: "500 Internal Server Error", body: "{\"error\":\"api_docs_not_found\"}")
    }
}
```

### 同时更新 api_docs.json

向 `api_docs.json` 末尾追加一条新的文档条目：

```json
{
  "id": "get_api_docs",
  "name": "Get API Docs",
  "summary": "获取 LocalBridge 所有已实现 REST API 的完整说明文档，供 ClawBot 自动发现接口。",
  "method": "GET",
  "path": "/api/v1/docs",
  "description": "此接口直接返回 api_docs.json 文件的完整内容（JSON 数组），包含所有已注册的 REST API 的 id、name、summary、method、path、description、request_body、curl 示例和 response 示例。ClawBot 在初始化时调用此接口即可自动获知所有可用能力，无需硬编码 API 列表。该接口无需任何参数，无需 WebSocket 连接，直接响应。",
  "curl": "curl -X GET http://127.0.0.1:8769/api/v1/docs",
  "response": "[{\"id\":\"query_x_status\", ...}, ...]"
}
```

---

## Task C：编写 REST API 测试脚本

### 脚本路径

创建文件：`/Users/hyperorchid/aiwithblockchain/aihub/test_api.py`

### 测试前提条件（脚本顶部注释说明）

```
前提条件：
1. LocalBridgeMac 已启动，REST 服务运行在 127.0.0.1:8769
2. tweetClaw Chrome 扩展已安装并已连接到 LocalBridgeMac（WebSocket 已握手）
3. Chrome 浏览器中已打开至少一个 x.com 标签页，且已登录
4. 运行方式：python3 test_api.py
```

### 测试逻辑规范

脚本使用 Python 标准库（`urllib.request`、`json`、`time`），**不依赖任何第三方库**。

每个测试用例的验证规则：**只验证 JSON 响应中关键 key 是否存在，不验证具体值**（因为 like/follow 等操作会真实执行，测试时不应使用真实数据）。

#### 测试用例列表

| # | 接口 | Method | 验证 key | 备注 |
|---|------|--------|----------|------|
| 1 | `/api/v1/x/status` | GET | `hasXTabs`, `isLoggedIn`, `tabs` | |
| 2 | `/api/v1/x/basic_info` | GET | `isLoggedIn`, `twitterId` | |
| 3 | `/tweetclaw/open-tab` | POST `{"path":"home"}` | `success`, `tabId` | 会实际打开标签页 |
| 4 | `/tweetclaw/navigate-tab` | POST `{"path":"home"}` | `success`, `tabId`, `url` | |
| 5 | `/tweetclaw/close-tab` | POST（用 #3 返回的 tabId）| `success`, `reason` | 关闭刚才打开的 tab |
| 6 | `/api/v1/x/likes` | POST `{"tweetId":"20"}` | `ok` 存在（值可以是 false） | tweetId=20 是 Twitter 第一条推文，不用担心误操作 |
| 7 | `/api/v1/x/retweets` | POST `{"tweetId":"20"}` | `ok` 存在 | 同上 |
| 8 | `/api/v1/x/bookmarks` | POST `{"tweetId":"20"}` | `ok` 存在 | 同上 |
| 9 | `/api/v1/x/follows` | POST `{"userId":"783214"}` | `ok` 存在 | userId=783214 是 @twitter 官方账号 |
| 10 | `/api/v1/x/unfollows` | POST `{"userId":"783214"}` | `ok` 存在 | 取消关注，回到初始状态 |
| 11 | `/api/v1/docs` | GET | 返回的是 JSON 数组，且数组长度 > 0 | |

#### 脚本输出格式（控制台）

```
=======================================
  LocalBridge REST API Test Suite
  Base URL: http://127.0.0.1:8769
=======================================
[1/11] GET /api/v1/x/status               ... PASS
[2/11] GET /api/v1/x/basic_info           ... PASS
[3/11] POST /tweetclaw/open-tab            ... PASS  (tabId=305036946)
[4/11] POST /tweetclaw/navigate-tab        ... PASS
[5/11] POST /tweetclaw/close-tab           ... PASS
[6/11] POST /api/v1/x/likes               ... PASS
[7/11] POST /api/v1/x/retweets            ... PASS
[8/11] POST /api/v1/x/bookmarks           ... PASS
[9/11] POST /api/v1/x/follows             ... PASS
[10/11] POST /api/v1/x/unfollows          ... PASS
[11/11] GET /api/v1/docs                  ... PASS  (11 APIs documented)
=======================================
  Results: 11 passed / 0 failed
=======================================
```

如果某条测试失败，输出：
```
[3/11] POST /tweetclaw/open-tab            ... FAIL  (missing key: tabId, response: {"error":"tweetclaw_offline"})
```

#### 脚本结构参考

```python
#!/usr/bin/env python3
"""
LocalBridge REST API Test Suite
前提：LocalBridgeMac 已启动，tweetClaw 扩展已连接，X.com 已打开并登录
运行：python3 test_api.py
"""

import json
import time
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional

BASE_URL = "http://127.0.0.1:8769"
TIMEOUT = 15  # 秒

def http_get(path: str) -> Optional[Any]:
    """发送 GET 请求，返回解析后的 JSON 或 None"""
    ...

def http_post(path: str, body: dict) -> Optional[Any]:
    """发送 POST 请求，返回解析后的 JSON 或 None"""
    ...

def check_keys(data: Any, required_keys: List[str]) -> tuple[bool, str]:
    """检查 JSON 对象中必填 key 是否存在，返回 (passed, error_msg)"""
    ...

def run_tests():
    passed = 0
    failed = 0
    opened_tab_id = None  # 用于在第 5 条测试中关闭第 3 条打开的 tab

    tests = [
        # (编号, 名称, 请求函数, 验证函数)
        ...
    ]

    print("=" * 47)
    print("  LocalBridge REST API Test Suite")
    print(f"  Base URL: {BASE_URL}")
    print("=" * 47)

    for result in tests:
        ...  # 输出测试结果

    print("=" * 47)
    print(f"  Results: {passed} passed / {failed} failed")
    print("=" * 47)

    return failed == 0

if __name__ == "__main__":
    import sys
    success = run_tests()
    sys.exit(0 if success else 1)
```

> **注意**：测试用例 3（open-tab）成功后需要保存返回的 `tabId`，用于测试用例 5（close-tab）。如果测试用例 3 失败，测试用例 5 应标记为 SKIP 而非 FAIL。

---

## 执行顺序

1. 先阅读以下文件（完整读取，不能跳过）：
   - `/Users/hyperorchid/aiwithblockchain/aihub/localBridge/apple/LocalBridgeMac/TweetClawTabControllers.swift`
   - `/Users/hyperorchid/aiwithblockchain/aihub/localBridge/apple/LocalBridgeMac/LocalBridgeWebSocketServer.swift`
   - `/Users/hyperorchid/aiwithblockchain/aihub/localBridge/apple/LocalBridgeMac/AppDelegate.swift`
   - `/Users/hyperorchid/aiwithblockchain/aihub/localBridge/apple/LocalBridgeMac/api_docs.json`

2. 执行 **Task A**：修改 `TweetClawTabControllers.swift`，补充 5 组 UI 控件和响应方法；修改 `AppDelegate.swift` 添加 `sendExecAction`；修改 `LocalBridgeWebSocketServer.swift` 添加 `sendExecAction` 方法并补全 `responseExecAction` 的 UI 通知分支。

3. 执行 **Task B**：修改 `LocalBridgeWebSocketServer.swift` 添加 `/api/v1/docs` 路由；向 `api_docs.json` 追加 1 条文档条目。

4. 执行 **Task C**：创建 `/Users/hyperorchid/aiwithblockchain/aihub/test_api.py`，完整实现测试脚本。

5. **验证**：
   - 用 `python3 -m json.tool api_docs.json` 验证 JSON 格式合法
   - 检查 `TweetClawTabControllers.swift` 中 `viewDidLoad` 的 observer 注册和 `deinit` 的 removeObserver 是否同步更新（不能漏注册或漏移除）

---

## 文件路径速查表

| 文件 | 用途 |
|------|------|
| `.../TweetClawTabControllers.swift` | TweetClaw 界面，本次需修改 TweetClawHumanViewController |
| `.../LocalBridgeWebSocketServer.swift` | REST 路由 + WS 服务，本次需新增 /api/v1/docs 路由和 sendExecAction 方法 |
| `.../AppDelegate.swift` | App 入口，需新增 sendExecAction 转发方法 |
| `.../BridgeMessage.swift` | WS 消息结构定义（本次无需修改，ExecActionRequestPayload 已存在） |
| `.../api_docs.json` | API 文档数据，本次需追加 get_api_docs 条目 |
| `.../test_api.py`（新建） | Python 测试脚本 |

完整路径前缀：`/Users/hyperorchid/aiwithblockchain/aihub/localBridge/apple/LocalBridgeMac/`

测试脚本路径：`/Users/hyperorchid/aiwithblockchain/aihub/test_api.py`
