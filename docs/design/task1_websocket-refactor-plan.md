# WebSocket 发送模型重构实施计划

## 计划概述

本计划针对阶段 1 的 7 个任务卡,实现 WebSocket 单写协程模型,消除并发写 panic,建立稳定的通信基础。

## 当前问题分析

### 1. 并发写问题

**位置**: [server.go:306-314](localBridge/go-lib/pkg/websocket/server.go#L306-L314), [server.go:418-445](localBridge/go-lib/pkg/websocket/server.go#L418-L445)

当前存在多个写入点:
- `SendJSON()` 方法 (line 306-314): 使用 `sess.wmu` 互斥锁保护
- `sendHelloAck()` (line 384-402): 调用 `writeJSONToConn()`
- `sendPong()` (line 404-416): 调用 `writeJSONToConn()`
- `writeJSONToConn()` (line 418-445): 尝试查找 session 并加锁,但存在竞态

**问题**:
1. `writeJSONToConn()` 中的锁获取逻辑不安全 (line 424-442)
2. 在查找 session 和加锁之间存在时间窗口
3. 多个 goroutine 可能同时调用 `Conn.WriteMessage`

### 2. Session 生命周期管理混乱

**位置**: [server.go:138-153](localBridge/go-lib/pkg/websocket/server.go#L138-L153), [server.go:232-247](localBridge/go-lib/pkg/websocket/server.go#L232-L247)

- `handleConn()` 中 defer 关闭连接
- `removeConn()` 只从 map 中移除,不关闭连接
- 没有统一的关闭入口
- reader 和 writer 职责不清晰

### 3. 挂起调用未清理

**位置**: [handler.go:129-145](localBridge/go-lib/pkg/restapi/handler.go#L129-L145)

当 session 断开时:
- `pendingCallbacks` 中的回调不会被清理
- REST 请求会一直等到超时 (默认 5000ms)
- 用户体验差,看起来像卡死

### 4. 心跳语义不合理

**位置**: [server.go:354-380](localBridge/go-lib/pkg/websocket/server.go#L354-L380)

- 只有 `ping` 消息刷新 `LastSeenAt`
- 业务消息不刷新心跳时间
- 长任务执行期间可能被误判为超时

## 实施方案

### 任务 1.1: 设计单写协程模型 ✓

**架构设计**:

```go
type ClientSession struct {
    SessionID     string       // 内部唯一标识,用于区分具体 session 实例 (uuid)
    ClientName    string       // 逻辑实例身份
    InstanceID    string       // 逻辑实例身份
    InstanceName  string
    Conn          *gorillaws.Conn
    ConnectedAt   time.Time
    LastSeenAt    time.Time
    Capabilities  []string
    ClientVersion string
    XScreenName   string
    
    // 新增字段
    sendQueue     chan []byte          // 发送队列
    writerDone    chan struct{}        // writer 退出信号
    closeCh       chan struct{}        // 关闭信号
    closeOnce     sync.Once            // 确保只关闭一次
    mu            sync.Mutex           // 保护 LastSeenAt
}
```

**关键设计点**:
- `SessionID`: 内部唯一标识,用 uuid 生成,用于区分具体 session 实例
- `ClientName + InstanceID`: 逻辑实例身份,用于路由和实例管理
- `callbackSessions` 使用 `sessionID` 建索引,避免旧 session 和新 session 混淆
- `removeSession()` 按 `sessionID` 删除,确保只删除目标 session

**生命周期**:
1. 连接建立 → 创建 session → 启动 writerLoop
2. 所有写操作 → 投递到 sendQueue
3. writerLoop 串行消费 sendQueue → WriteMessage
4. 连接断开/写失败 → 关闭底层 Conn 打断 I/O → 关闭 closeCh → 等待 writerLoop 退出 → 清理回调和注册

**错误处理**:
- sendQueue 满时返回错误 (非阻塞)
- writerLoop 写失败时关闭连接
- 关闭时清理所有挂起的回调

### 任务 1.2: 实现 ClientSession 单写模型

**修改文件**: [server.go](localBridge/go-lib/pkg/websocket/server.go)

**实现步骤**:

1. 修改 `ClientSession` 结构体 (line 30-41):
```go
type ClientSession struct {
    SessionID     string       // 内部唯一标识,用于区分具体 session 实例
    ClientName    string       // 逻辑实例身份
    InstanceID    string       // 逻辑实例身份
    InstanceName  string
    Conn          *gorillaws.Conn
    ConnectedAt   time.Time
    LastSeenAt    time.Time
    Capabilities  []string
    ClientVersion string
    XScreenName   string
    
    sendQueue     chan []byte
    writerDone    chan struct{}
    closeCh       chan struct{}
    closeOnce     sync.Once
    mu            sync.Mutex  // 保护 LastSeenAt
}
```

2. 实现 `writerLoop()` 方法 (写失败时触发统一关闭):
```go
func (s *ClientSession) writerLoop(server *Server) {
    defer close(s.writerDone)
    for {
        select {
        case msg := <-s.sendQueue:
            if err := s.Conn.WriteMessage(gorillaws.TextMessage, msg); err != nil {
                log.Printf("[WS] write error: %v", err)
                // 写失败时通知 server 进入统一关闭路径
                go server.closeSession(s)
                return
            }
        case <-s.closeCh:
            return
        }
    }
}
```

3. 实现 `Send()` 方法:
```go
func (s *ClientSession) Send(data []byte) error {
    select {
    case s.sendQueue <- data:
        return nil
    case <-s.closeCh:
        return fmt.Errorf("session closed")
    default:
        return fmt.Errorf("send queue full")
    }
}
```

4. 在 `handleClientHello()` 中启动 writerLoop (line 184-222):
```go
sess := &ClientSession{
    // ... 现有字段 ...
    sendQueue:  make(chan []byte, 100),
    writerDone: make(chan struct{}),
    closeCh:    make(chan struct{}),
}
go sess.writerLoop(s)  // 传递 server 引用
```

### 任务 1.3: 重构所有直接写入点

**修改文件**: [server.go](localBridge/go-lib/pkg/websocket/server.go)

**需要修改的位置**:

1. 删除 `SendJSON()` 方法 (line 306-314),改为:
```go
func (s *Server) SendJSON(sess *ClientSession, v interface{}) error {
    data, err := json.Marshal(v)
    if err != nil {
        return err
    }
    return sess.Send(data)
}
```

2. 删除 `writeJSONToConn()` 方法 (line 418-445)

3. 修改 `sendHelloAck()` (line 384-402):
```go
func (s *Server) sendHelloAck(sess *ClientSession, replyID, target string) {
    ack := types.Message[types.ServerHelloAckPayload]{
        // ... 构造消息 ...
    }
    data, _ := json.Marshal(ack)
    if err := sess.Send(data); err != nil {
        log.Printf("[WS] failed to send hello_ack: %v", err)
    }
}
```

4. 修改 `sendPong()` (line 404-416):
```go
func (s *Server) sendPong(sess *ClientSession, replyID, target string) {
    pong := types.Message[types.EmptyPayload]{
        // ... 构造消息 ...
    }
    data, _ := json.Marshal(pong)
    if err := sess.Send(data); err != nil {
        log.Printf("[WS] failed to send pong: %v", err)
    }
}
```

5. 修改 `handleMessage()` 正常响应路径,同时删除 pendingCallbacks 和 callbackSessions (line 171-180):
```go
default:
    // 所有 response.* 消息：触发对应的 pendingCallback（REST 层注册）
    s.mu.Lock()
    cb, ok := s.pendingCallbacks[peek.ID]
    if ok {
        delete(s.pendingCallbacks, peek.ID)
        delete(s.callbackSessions, peek.ID)  // 同时删除 callbackSessions
    }
    s.mu.Unlock()
    if ok {
        cb(data)
    }
```

6. 修改 `RemoveCallback()` 同时删除两个 map (line 323-327):
```go
func (s *Server) RemoveCallback(msgID string) {
    s.mu.Lock()
    delete(s.pendingCallbacks, msgID)
    delete(s.callbackSessions, msgID)  // 同时删除 callbackSessions
    s.mu.Unlock()
}
```

### 任务 1.4: 实现 session 断开时挂起调用清理

**修改文件**: [server.go](localBridge/go-lib/pkg/websocket/server.go)

**实现步骤**:

1. 在 `Server` 中添加 session 到 callbacks 的映射:
```go
type Server struct {
    mu               sync.RWMutex
    sessions         map[string]map[string]*ClientSession // [clientName][instanceId]
    pendingCallbacks map[string]func([]byte)
    callbackSessions map[string]string  // msgID -> sessionID (不是 clientName/instanceID)
    httpServers      []*http.Server
    stopCh           chan struct{}
}
```

2. 修改 `RegisterCallback()` (line 317-321):
```go
func (s *Server) RegisterCallback(msgID string, sess *ClientSession, cb func([]byte)) {
    s.mu.Lock()
    s.pendingCallbacks[msgID] = cb
    s.callbackSessions[msgID] = sess.SessionID  // 使用 sessionID 而非 clientName/instanceID
    s.mu.Unlock()
}
```

3. 实现 `cleanupSessionCallbacks()` (两段式:锁内摘取,锁外执行,按 sessionID 索引):
```go
func (s *Server) cleanupSessionCallbacks(sessionID string) {
    // 第一阶段:锁内摘取待失败的 callback (按 sessionID 索引)
    s.mu.Lock()
    var toFail []struct {
        msgID string
        cb    func([]byte)
    }
    
    for msgID, sid := range s.callbackSessions {
        if sid == sessionID {  // 按 sessionID 匹配,不是 clientName/instanceID
            if cb, ok := s.pendingCallbacks[msgID]; ok {
                toFail = append(toFail, struct {
                    msgID string
                    cb    func([]byte)
                }{msgID, cb})
                delete(s.pendingCallbacks, msgID)
                delete(s.callbackSessions, msgID)
            }
        }
    }
    s.mu.Unlock()
    
    // 第二阶段:锁外执行 callback
    for _, item := range toFail {
        // 构造错误响应
        errResp := map[string]interface{}{
            "id": item.msgID,
            "type": "response.error",
            "payload": map[string]interface{}{
                "code":    "session_disconnected",
                "message": "WebSocket session disconnected",
            },
        }
        data, _ := json.Marshal(errResp)
        item.cb(data)
    }
}
```

4. 在 session 关闭时调用清理

### 任务 1.5: 调整心跳语义

**修改文件**: [server.go](localBridge/go-lib/pkg/websocket/server.go)

**实现步骤**:

1. 修改 `handleMessage()` (line 155-182):
```go
func (s *Server) handleMessage(data []byte, conn *gorillaws.Conn) {
    var peek types.PeekMessage
    if err := json.Unmarshal(data, &peek); err != nil {
        log.Printf("[WS] malformed message: %v", err)
        return
    }
    
    // 任意入站消息都刷新 LastSeenAt
    s.touchConn(conn)
    
    // ... 其余逻辑不变 ...
}
```

2. 删除 `handlePing()` 中的 `touchConn()` 调用 (line 224-230)

3. 修改 `touchConn()` 使用 session 的 mutex (line 249-260):
```go
func (s *Server) touchConn(conn *gorillaws.Conn) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    for _, sessions := range s.sessions {
        for _, sess := range sessions {
            if sess.Conn == conn {
                sess.mu.Lock()
                sess.LastSeenAt = time.Now()
                sess.mu.Unlock()
                return
            }
        }
    }
}
```

### 任务 1.6: 统一 session lifecycle 管理

**修改文件**: [server.go](localBridge/go-lib/pkg/websocket/server.go)

**实现步骤**:

1. 实现统一的 `closeSession()` 方法:
```go
func (s *Server) closeSession(sess *ClientSession) {
    sess.closeOnce.Do(func() {
        // 1. 先关闭底层连接,打断正在进行的 I/O
        sess.Conn.Close()
        
        // 2. 关闭 closeCh,通知 writerLoop 退出
        close(sess.closeCh)
        
        // 3. 等待 writerLoop 退出 (有界等待,因为连接已关闭)
        select {
        case <-sess.writerDone:
            // writerLoop 正常退出
        case <-time.After(5 * time.Second):
            // 超时保护,避免永久卡住
            log.Printf("[WS] writerLoop timeout for %s/%s", sess.ClientName, sess.InstanceID)
        }
        
        // 4. 清理回调和注册 (按 sessionID,不在锁内执行)
        s.cleanupSessionCallbacks(sess.SessionID)
        s.removeSession(sess)
    })
}
```

2. 实现 `removeSession()` (按 sessionID 删除):
```go
func (s *Server) removeSession(sess *ClientSession) {
    s.mu.Lock()
    defer s.mu.Unlock()
    
    // 按 sessionID 精确匹配删除,避免误删新 session
    if sessions, ok := s.sessions[sess.ClientName]; ok {
        if current, exists := sessions[sess.InstanceID]; exists && current.SessionID == sess.SessionID {
            delete(sessions, sess.InstanceID)
            if len(sessions) == 0 {
                delete(s.sessions, sess.ClientName)
            }
            log.Printf("[WS] removed: %s/%s (sessionID=%s)", sess.ClientName, sess.InstanceID, sess.SessionID)
        }
    }
}
```

3. 修改 `handleConn()` (line 138-153):
```go
func (s *Server) handleConn(conn *gorillaws.Conn) {
    log.Printf("[WS] new connection from %s", conn.RemoteAddr())
    
    // readerLoop
    for {
        _, data, err := conn.ReadMessage()
        if err != nil {
            log.Printf("[WS] read error: %v", err)
            // 查找对应的 session 并关闭
            s.closeSessionByConn(conn)
            return
        }
        s.handleMessage(data, conn)
    }
}
```

4. 实现 `closeSessionByConn()`:
```go
func (s *Server) closeSessionByConn(conn *gorillaws.Conn) {
    s.mu.RLock()
    var targetSess *ClientSession
    for _, sessions := range s.sessions {
        for _, sess := range sessions {
            if sess.Conn == conn {
                targetSess = sess
                break
            }
        }
        if targetSess != nil {
            break
        }
    }
    s.mu.RUnlock()
    
    if targetSess != nil {
        s.closeSession(targetSess)
    }
}
```

5. 修改 `handleClientHello()` 中的旧连接关闭逻辑 (两段式:锁内摘取,锁外关闭):
```go
func (s *Server) handleClientHello(data []byte, conn *gorillaws.Conn) {
    var msg types.Message[types.ClientHelloPayload]
    if err := json.Unmarshal(data, &msg); err != nil {
        log.Printf("[WS] invalid client.hello: %v", err)
        return
    }
    clientName := msg.Payload.ClientName
    instanceID := msg.Payload.InstanceID
    instanceName := msg.Payload.InstanceName
    if instanceID == "" {
        instanceID = "tmp-" + uuid.New().String()
    }
    log.Printf("[WS] hello: clientName=%s, instanceId=%s, instanceName=%s", clientName, instanceID, instanceName)

    // 第一阶段:锁内摘取旧 session 并注册新 session
    s.mu.Lock()
    if s.sessions[clientName] == nil {
        s.sessions[clientName] = make(map[string]*ClientSession)
    }
    var oldSession *ClientSession
    if old, exists := s.sessions[clientName][instanceID]; exists {
        oldSession = old
        log.Printf("[WS] will replace old session: %s/%s (sessionID=%s)", clientName, instanceID, old.SessionID)
    }
    
    sess := &ClientSession{
        SessionID:     uuid.New().String(),  // 生成唯一 sessionID
        ClientName:    clientName,
        InstanceID:    instanceID,
        InstanceName:  instanceName,
        Conn:          conn,
        ConnectedAt:   time.Now(),
        LastSeenAt:    time.Now(),
        Capabilities:  msg.Payload.Capabilities,
        ClientVersion: msg.Payload.ClientVersion,
        sendQueue:     make(chan []byte, 100),
        writerDone:    make(chan struct{}),
        closeCh:       make(chan struct{}),
    }
    s.sessions[clientName][instanceID] = sess
    s.mu.Unlock()

    // 第二阶段:锁外关闭旧 session
    if oldSession != nil {
        s.closeSession(oldSession)
    }

    // 启动 writerLoop
    go sess.writerLoop(s)

    // 发送 hello_ack
    s.sendHelloAck(sess, msg.ID, clientName)
}
```

6. 修改 `Stop()` 方法 (避免在持锁时调用 closeSession):
```go
func (s *Server) Stop() {
    // 第一阶段: 锁内摘取 session 快照并切换全局状态
    s.mu.Lock()
    select {
    case <-s.stopCh:
        s.mu.Unlock()
        return
    default:
        close(s.stopCh)
    }
    
    var allSessions []*ClientSession
    for _, sessions := range s.sessions {
        for _, sess := range sessions {
            allSessions = append(allSessions, sess)
        }
    }
    s.mu.Unlock()
    
    // 第二阶段: 锁外关闭 HTTP 服务器
    for _, srv := range s.httpServers {
        _ = srv.Close()
    }
    
    // 第三阶段: 锁外逐个关闭 session (closeSession 内部会获取锁)
    for _, sess := range allSessions {
        s.closeSession(sess)
    }
    
    // 第四阶段: 清理全局状态
    s.mu.Lock()
    s.sessions = make(map[string]map[string]*ClientSession)
    s.pendingCallbacks = make(map[string]func([]byte))
    s.callbackSessions = make(map[string]string)
    s.mu.Unlock()
}
```

7. 修改 `runHeartbeat()` (line 354-380):
```go
func (s *Server) runHeartbeat() {
    ticker := time.NewTicker(10 * time.Second)
    defer ticker.Stop()
    for {
        select {
        case <-s.stopCh:
            return
        case <-ticker.C:
            now := time.Now()
            var stale []*ClientSession
            s.mu.RLock()
            for _, sessions := range s.sessions {
                for _, sess := range sessions {
                    sess.mu.Lock()
                    lastSeen := sess.LastSeenAt
                    sess.mu.Unlock()
                    if now.Sub(lastSeen) > heartbeatTimeout {
                        stale = append(stale, sess)
                    }
                }
            }
            s.mu.RUnlock()
            for _, sess := range stale {
                log.Printf("[WS] heartbeat timeout: %s/%s", sess.ClientName, sess.InstanceID)
                s.closeSession(sess)
            }
        }
    }
}
```

### 任务 1.7: 阶段 1 集成测试

**新建文件**: `localBridge/go-lib/pkg/websocket/integration_test.go`

**测试用例**:

1. **并发发送测试**:
```go
func TestConcurrentSend(t *testing.T) {
    // 启动服务器
    // 建立连接
    // 并发发送 1000 条消息
    // 验证无 panic,所有消息都收到
}
```

2. **Session 断开清理测试**:
```go
func TestSessionDisconnectCleanup(t *testing.T) {
    // 建立连接
    // 注册多个 pending callback
    // 断开连接
    // 验证所有 callback 在 1 秒内被调用并返回错误
}
```

3. **Goroutine 泄漏测试**:
```go
func TestNoGoroutineLeak(t *testing.T) {
    // 记录初始 goroutine 数量
    // 建立 100 个连接
    // 关闭所有连接
    // 等待 5 秒
    // 验证 goroutine 数量恢复到初始值 ±5
}
```

4. **心跳机制测试**:
```go
func TestHeartbeat(t *testing.T) {
    // 建立连接
    // 定期发送业务消息(不发 ping)
    // 验证连接保持 60 秒以上
    // 停止发送消息
    // 验证 60 秒后连接被关闭
}
```

## REST API 层适配

**修改文件**: [handler.go](localBridge/go-lib/pkg/restapi/handler.go)

需要修改 `bridge()` 方法和 `pluginInvoke()` 方法,传递 session 给 `RegisterCallback()`:

### 1. 修改 `bridge()` 方法 (line 152-186):

```go
func (h *Handler) bridge(
    w http.ResponseWriter,
    clientName string,
    msgID string,
    msg interface{},
    timeoutMs int,
    onResp func([]byte),
) {
    sess, err := h.ws.ResolveConn(clientName, "")
    if err != nil {
        jsonErr(w, 503, err.Error())
        return
    }
    if timeoutMs <= 0 {
        timeoutMs = 5000
    }
    done := make(chan struct{}, 1)
    h.ws.RegisterCallback(msgID, sess, func(data []byte) {  // 传递 sess
        onResp(data)
        done <- struct{}{}
    })
    if err := h.ws.SendJSON(sess, msg); err != nil {
        h.ws.RemoveCallback(msgID)
        jsonErr(w, 500, "ws_send_failed")
        return
    }
    select {
    case <-done:
    case <-time.After(time.Duration(timeoutMs) * time.Millisecond):
        h.ws.RemoveCallback(msgID)
        jsonErr(w, 504, fmt.Sprintf("timeout after %ds", timeoutMs/1000))
    }
}
```

### 2. 修改 `pluginInvoke()` 方法 (line 78-146):

```go
func (h *Handler) pluginInvoke(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        jsonErr(w, 405, "method_not_allowed")
        return
    }

    // 解析路径：/api/v1/plugins/{clientName}/invoke
    parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/plugins/"), "/")
    if len(parts) < 2 || parts[1] != "invoke" {
        jsonErr(w, 404, "path must be /api/v1/plugins/{clientName}/invoke")
        return
    }
    clientName := parts[0]

    // 解析 body
    var req struct {
        MessageType string          `json:"messageType"` // 如 "request.query_x_tabs_status"
        InstanceID  string          `json:"instanceId"`  // 可选
        Payload     json.RawMessage `json:"payload"`     // 完全透明，不解析
        TimeoutMs   int             `json:"timeoutMs"`   // 默认 5000
    }
    if err := readJSON(r, &req); err != nil {
        jsonErr(w, 400, err.Error())
        return
    }
    if req.MessageType == "" {
        jsonErr(w, 400, "messageType is required")
        return
    }
    timeoutMs := req.TimeoutMs
    if timeoutMs <= 0 {
        timeoutMs = 5000
    }

    // 封装消息（payload 不解析，原始 JSON 透传）
    id := newID("invoke")
    msg := types.RawMessage{
        ID:        id,
        Type:      types.MessageType(req.MessageType),
        Source:    "aihub",
        Target:    clientName,
        Timestamp: time.Now().UnixMilli(),
        Payload:   req.Payload,
    }

    sess, err := h.ws.ResolveConn(clientName, req.InstanceID)
    if err != nil {
        jsonErr(w, 503, err.Error())
        return
    }

    done := make(chan struct{}, 1)
    h.ws.RegisterCallback(id, sess, func(data []byte) {  // 传递 sess
        // 返回插件响应的 payload，去掉外层消息封装
        writeRawPayload(w, data)
        done <- struct{}{}
    })
    if err := h.ws.SendJSON(sess, msg); err != nil {
        h.ws.RemoveCallback(id)
        jsonErr(w, 500, "ws_send_failed")
        return
    }
    select {
    case <-done:
    case <-time.After(time.Duration(timeoutMs) * time.Millisecond):
        h.ws.RemoveCallback(id)
        jsonErr(w, 504, fmt.Sprintf("timeout after %ds", timeoutMs/1000))
    }
}
```

## 验收标准

### 代码验收
- [ ] 除 `writerLoop` 外,无任何直接调用 `Conn.WriteMessage` 的地方
- [ ] 所有写操作都通过 `session.Send()`
- [ ] Session 关闭路径唯一且幂等
- [ ] 所有资源(goroutine、连接、注册)正确清理

### 功能验收
- [ ] 并发发送 1000 条消息无 panic
- [ ] Session 断开时挂起请求在 1 秒内返回错误
- [ ] 运行 1 小时无 goroutine 泄漏
- [ ] 业务消息可以刷新心跳时间
- [ ] 长任务执行期间不会因心跳超时断开

### 性能验收
- [ ] 内存和 goroutine 数量稳定
- [ ] 消息发送延迟 < 10ms (p99)
- [ ] 支持 100+ 并发连接

## 风险和注意事项

### 风险 1: sendQueue 容量设置
- **问题**: 队列太小会导致发送失败,太大会占用内存
- **缓解**: 初始设置为 100,根据测试调整

### 风险 2: 关闭时序
- **问题**: 关闭顺序不当可能导致 panic 或死锁
- **缓解**: 使用 `closeOnce` 确保幂等,先关闭底层 Conn 打断 I/O,再关闭 closeCh,等待 writerDone (有界等待 5 秒)

### 风险 3: 向后兼容
- **问题**: 修改 `RegisterCallback` 签名会影响所有调用方
- **缓解**: 同时修改 REST handler 中的所有调用点

### 风险 4: 测试覆盖
- **问题**: 并发问题难以复现和测试
- **缓解**: 使用 race detector,增加并发压力测试

## 实施顺序

1. **任务 1.1**: 完成架构设计 (0.5 天)
2. **任务 1.2**: 实现单写模型 (1.5 天)
3. **任务 1.3**: 重构写入点 (1 天)
4. **任务 1.5**: 调整心跳 (0.5 天) - 可与 1.3 并行
5. **任务 1.6**: 统一生命周期 (1 天)
6. **任务 1.4**: 实现挂起调用清理 (1 天)
7. **任务 1.7**: 集成测试 (0.5 天)

**总计**: 4-6 天

## 关键代码位置索引

- WebSocket Server: [server.go](localBridge/go-lib/pkg/websocket/server.go)
- REST Handler: [handler.go](localBridge/go-lib/pkg/restapi/handler.go)
- Message Types: [message.go](localBridge/go-lib/pkg/types/message.go)
- 现有测试: [server_test.go](localBridge/go-lib/pkg/websocket/server_test.go)
