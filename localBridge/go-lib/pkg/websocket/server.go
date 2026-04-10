package websocket

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	gorillaws "github.com/gorilla/websocket"
	"github.com/hyperorchid/localbridge/pkg/task"
	"github.com/hyperorchid/localbridge/pkg/types"
)

const (
	ProtocolName     = "aihub-localbridge"
	ProtocolVersion  = "v1"
	ServerName       = "LocalBridgeGo"
	ServerVersion    = "0.1.0"
	HeartbeatMs      = 20000
	heartbeatTimeout = 60 * time.Second
)

var upgrader = gorillaws.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// ClientSession 单个实例会话（含内部 Conn）
type ClientSession struct {
	SessionID     string // 内部唯一标识,用于区分具体 session 实例
	ClientName    string // 逻辑实例身份
	InstanceID    string // 逻辑实例身份
	InstanceName  string
	Conn          *gorillaws.Conn
	ConnectedAt   time.Time
	LastSeenAt    time.Time
	Capabilities  []string
	ClientVersion string
	XScreenName   string

	sendQueue  chan []byte
	writerDone chan struct{}
	closeCh    chan struct{}
	closeOnce  sync.Once
	mu         sync.Mutex // 保护 LastSeenAt
}

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

// InstanceSnapshot 对外只读快照（不含 Conn 引用）
type InstanceSnapshot struct {
	ClientName    string    `json:"clientName"`
	InstanceID    string    `json:"instanceId"`
	InstanceName  string    `json:"instanceName,omitempty"`
	ClientVersion string    `json:"clientVersion"`
	Capabilities  []string  `json:"capabilities"`
	ConnectedAt   time.Time `json:"connectedAt"`
	LastSeenAt    time.Time `json:"lastSeenAt"`
	XScreenName   string    `json:"xScreenName,omitempty"`
	IsTemporary   bool      `json:"isTemporary"` // instanceId 以 "tmp-" 开头
}

// Server WebSocket 服务主体
type Server struct {
	mu               sync.RWMutex
	sessions         map[string]map[string]*ClientSession // [clientName][instanceId]
	pendingCallbacks map[string]func([]byte)
	callbackSessions map[string]string // msgID -> sessionID
	httpServers      []*http.Server
	stopCh           chan struct{}
	taskManager      *task.Manager
}

func NewServer() *Server {
	return &Server{
		sessions:         make(map[string]map[string]*ClientSession),
		pendingCallbacks: make(map[string]func([]byte)),
		callbackSessions: make(map[string]string),
		stopCh:           make(chan struct{}),
	}
}

func (s *Server) SetTaskManager(m *task.Manager) {
	s.taskManager = m
}

func (s *Server) handleTaskEvent(data []byte, conn *gorillaws.Conn) {
	if s.taskManager == nil {
		return
	}
	s.mu.RLock()
	var clientName, instanceId string
	for cn, sessions := range s.sessions {
		for id, sess := range sessions {
			if sess.Conn == conn {
				clientName = cn
				instanceId = id
				break
			}
		}
		if clientName != "" {
			break
		}
	}
	s.mu.RUnlock()

	var raw types.PeekMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return
	}

	switch raw.Type {
	case "event.task_progress":
		var ev types.Message[types.TaskProgressEvent]
		if err := json.Unmarshal(data, &ev); err == nil {
			if _, err := s.taskManager.EnsureOwner(ev.Payload.TaskID, clientName, instanceId); err == nil {
				if err := s.taskManager.MarkRunning(ev.Payload.TaskID, ev.Payload.Phase, ev.Payload.Progress); err != nil {
					log.Printf("[WS] task progress rejected: taskId=%s state update failed: %v", ev.Payload.TaskID, err)
				}
			} else {
				log.Printf("[WS] task progress owner check failed: taskId=%s client=%s instance=%s err=%v", ev.Payload.TaskID, clientName, instanceId, err)
			}
		} else {
			log.Printf("[WS] invalid task progress event: %v", err)
		}
	case "event.task_failed":
		var ev types.Message[types.TaskFailedEvent]
		if err := json.Unmarshal(data, &ev); err == nil {
			if _, err := s.taskManager.EnsureOwner(ev.Payload.TaskID, clientName, instanceId); err == nil {
				if err := s.taskManager.MarkFailed(ev.Payload.TaskID, ev.Payload.Phase, ev.Payload.ErrorCode, ev.Payload.ErrorMessage); err != nil {
					log.Printf("[WS] task failed event rejected: taskId=%s err=%v", ev.Payload.TaskID, err)
				}
			} else {
				log.Printf("[WS] task failed owner check failed: taskId=%s client=%s instance=%s err=%v", ev.Payload.TaskID, clientName, instanceId, err)
			}
		} else {
			log.Printf("[WS] invalid task failed event: %v", err)
		}
	case "event.task_completed":
		var ev types.Message[types.TaskCompletedEvent]
		if err := json.Unmarshal(data, &ev); err == nil {
			if _, err := s.taskManager.EnsureOwner(ev.Payload.TaskID, clientName, instanceId); err == nil {
				if err := s.taskManager.MarkCompleted(ev.Payload.TaskID, ev.Payload.ResultRef); err != nil {
					log.Printf("[WS] task completed event rejected: taskId=%s err=%v", ev.Payload.TaskID, err)
				}
			} else {
				log.Printf("[WS] task completed owner check failed: taskId=%s client=%s instance=%s err=%v", ev.Payload.TaskID, clientName, instanceId, err)
			}
		} else {
			log.Printf("[WS] invalid task completed event: %v", err)
		}
	case "event.task_cancelled":
		var ev types.Message[types.TaskCancelledEvent]
		if err := json.Unmarshal(data, &ev); err == nil {
			if _, err := s.taskManager.EnsureOwner(ev.Payload.TaskID, clientName, instanceId); err == nil {
				if err := s.taskManager.MarkCancelled(ev.Payload.TaskID, ev.Payload.Phase); err != nil {
					log.Printf("[WS] task cancelled event rejected: taskId=%s err=%v", ev.Payload.TaskID, err)
				}
			} else {
				log.Printf("[WS] task cancelled owner check failed: taskId=%s client=%s instance=%s err=%v", ev.Payload.TaskID, clientName, instanceId, err)
			}
		} else {
			log.Printf("[WS] invalid task cancelled event: %v", err)
		}
	}
}

// ListenAddress 监听地址配置
type ListenAddress struct {
	IP      string
	Port    int
	Enabled bool
}

// Start 在多个地址上启动 WebSocket 监听，自动去重
func (s *Server) Start(addresses []ListenAddress) error {
	seen := map[string]bool{}
	for _, addr := range addresses {
		if !addr.Enabled {
			continue
		}
		listenAddr := fmt.Sprintf("%s:%d", addr.IP, addr.Port)
		if seen[listenAddr] {
			continue
		}
		seen[listenAddr] = true

		mux := http.NewServeMux()
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			conn, err := upgrader.Upgrade(w, r, nil)
			if err != nil {
				log.Printf("[WS] upgrade error: %v", err)
				return
			}
			go s.handleConn(conn)
		})
		srv := &http.Server{Addr: listenAddr, Handler: mux}
		s.httpServers = append(s.httpServers, srv)
		go func(address string, server *http.Server) {
			log.Printf("[WS] listening on %s", address)
			if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				log.Printf("[WS] address %s error: %v", address, err)
			}
		}(listenAddr, srv)
	}
	go s.runHeartbeat()
	return nil
}

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

// handleConn 每个 WS 连接的读循环（单独 goroutine）
func (s *Server) handleConn(conn *gorillaws.Conn) {
	log.Printf("[WS] new connection from %s", conn.RemoteAddr())
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			log.Printf("[WS] read error (%s): %v", conn.RemoteAddr(), err)
			s.closeSessionByConn(conn)
			return
		}
		s.handleMessage(data, conn)
	}
}

func (s *Server) handleMessage(data []byte, conn *gorillaws.Conn) {
	var peek types.PeekMessage
	if err := json.Unmarshal(data, &peek); err != nil {
		log.Printf("[WS] malformed message: %v", err)
		return
	}
	// 任意入站消息都刷新 LastSeenAt
	s.touchConn(conn)

	switch peek.Type {
	case types.ClientHello:
		s.handleClientHello(data, conn)

	case types.Ping:
		s.handlePing(peek, conn)

	case "event.task_progress", "event.task_failed", "event.task_completed", "event.task_cancelled":
		s.handleTaskEvent(data, conn)

	default:
		// 所有 response.* 消息：触发对应的 pendingCallback（REST 层注册）
		s.mu.Lock()
		cb, ok := s.pendingCallbacks[peek.ID]
		if ok {
			delete(s.pendingCallbacks, peek.ID)
			delete(s.callbackSessions, peek.ID)
		}
		s.mu.Unlock()
		if ok {
			cb(data)
		}
	}
}

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
		SessionID:     uuid.New().String(),
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

func (s *Server) handlePing(peek types.PeekMessage, conn *gorillaws.Conn) {
	s.mu.RLock()
	var targetSess *ClientSession
	clientName := s.connClientNameLocked(conn)
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
	log.Printf("[WS] received ping: id=%s from=%s", peek.ID, clientName)
	if targetSess != nil {
		s.sendPong(targetSess, peek.ID, clientName)
	}
}

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

func (s *Server) closeSession(sess *ClientSession) {
	sess.closeOnce.Do(func() {
		// 1. 先关闭底层连接,打断正在进行的 I/O
		sess.Conn.Close()

		// 2. 关闭 closeCh,通知 writerLoop 退出
		close(sess.closeCh)

		// 3. 等待 writerLoop 退出 (有界等待,因为连接已关闭)
		select {
		case <-sess.writerDone:
		case <-time.After(5 * time.Second):
			log.Printf("[WS] writerLoop timeout for %s/%s", sess.ClientName, sess.InstanceID)
		}

		// 4. 清理回调和注册
		s.cleanupSessionCallbacks(sess.SessionID)

		if s.taskManager != nil {
			s.taskManager.HandleSessionDisconnect(sess.ClientName, sess.InstanceID)
		}

		s.removeSession(sess)
	})
}

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

// connClientNameLocked 调用方必须持有 s.mu（任意锁模式）
func (s *Server) connClientNameLocked(conn *gorillaws.Conn) string {
	for _, sessions := range s.sessions {
		for _, sess := range sessions {
			if sess.Conn == conn {
				return sess.ClientName
			}
		}
	}
	return "unknown"
}

// ResolveConn 根据 clientName + 可选 instanceID 返回 session
// 与 Swift resolveConnection() 逻辑完全一致：
//   - 单实例：直接返回
//   - 多实例 + 无 instanceID：返回 ambiguous_target 错误
//   - 多实例 + 有 instanceID：精确匹配
func (s *Server) ResolveConn(clientName, instanceID string) (*ClientSession, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sessions, ok := s.sessions[clientName]
	if !ok || len(sessions) == 0 {
		return nil, fmt.Errorf("%s extension is not connected or installed", clientName)
	}
	if instanceID != "" {
		sess, ok := sessions[instanceID]
		if !ok {
			return nil, fmt.Errorf("%s instance %s not found", clientName, instanceID)
		}
		return sess, nil
	}
	if len(sessions) == 1 {
		for _, sess := range sessions {
			return sess, nil
		}
	}
	var ids []string
	for id := range sessions {
		ids = append(ids, id)
	}
	return nil, fmt.Errorf("ambiguous_target: multiple %s instances %v, specify instanceId", clientName, ids)
}

// SendJSON 线程安全地向 session 发送 JSON 消息
func (s *Server) SendJSON(sess *ClientSession, v interface{}) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return sess.Send(data)
}

// RegisterCallback 注册一次性 msgID 回调（REST 层使用）
func (s *Server) RegisterCallback(msgID string, sess *ClientSession, cb func([]byte)) {
	s.mu.Lock()
	s.pendingCallbacks[msgID] = cb
	s.callbackSessions[msgID] = sess.SessionID
	s.mu.Unlock()
}

// RemoveCallback 超时清理未使用的回调
func (s *Server) RemoveCallback(msgID string) {
	s.mu.Lock()
	delete(s.pendingCallbacks, msgID)
	delete(s.callbackSessions, msgID)
	s.mu.Unlock()
}

func (s *Server) cleanupSessionCallbacks(sessionID string) {
	s.mu.Lock()
	var toFail []struct {
		msgID string
		cb    func([]byte)
	}

	for msgID, sid := range s.callbackSessions {
		if sid == sessionID {
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

	for _, item := range toFail {
		errResp := map[string]interface{}{
			"id":   item.msgID,
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

// GetInstances 返回所有在线实例的只读快照
func (s *Server) GetInstances() []InstanceSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []InstanceSnapshot
	for clientName, sessions := range s.sessions {
		for instanceID, sess := range sessions {
			_ = clientName
			result = append(result, InstanceSnapshot{
				ClientName:    sess.ClientName,
				InstanceID:    instanceID,
				InstanceName:  sess.InstanceName,
				ClientVersion: sess.ClientVersion,
				Capabilities:  sess.Capabilities,
				ConnectedAt:   sess.ConnectedAt,
				LastSeenAt:    sess.LastSeenAt,
				XScreenName:   sess.XScreenName,
				IsTemporary:   len(instanceID) >= 4 && instanceID[:4] == "tmp-",
			})
		}
	}
	return result
}

// runHeartbeat 每 10 秒检查，超时 60 秒未收到 ping 则断连
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

// --- 内部发送 ---

func (s *Server) sendHelloAck(sess *ClientSession, replyID, target string) {
	ack := types.Message[types.ServerHelloAckPayload]{
		ID: replyID, Type: types.ServerHelloAck,
		Source: ServerName, Target: target,
		Timestamp: time.Now().UnixMilli(),
		Payload: types.ServerHelloAckPayload{
			ProtocolName:        ProtocolName,
			ProtocolVersion:     ProtocolVersion,
			ServerName:          ServerName,
			ServerVersion:       ServerVersion,
			HeartbeatIntervalMs: HeartbeatMs,
		},
	}
	data, _ := json.Marshal(ack)
	if err := sess.Send(data); err != nil {
		log.Printf("[WS] failed to send hello_ack to %s: %v", target, err)
		return
	}
	log.Printf("[WS] sent hello_ack to %s", target)
}

func (s *Server) sendPong(sess *ClientSession, replyID, target string) {
	pong := types.Message[types.EmptyPayload]{
		ID: replyID, Type: types.Pong,
		Source: ServerName, Target: target,
		Timestamp: time.Now().UnixMilli(),
		Payload:   types.EmptyPayload{},
	}
	data, _ := json.Marshal(pong)
	if err := sess.Send(data); err != nil {
		log.Printf("[WS] failed to send pong to %s: %v", target, err)
		return
	}
	log.Printf("[WS] sent pong: id=%s to=%s", replyID, target)
}
