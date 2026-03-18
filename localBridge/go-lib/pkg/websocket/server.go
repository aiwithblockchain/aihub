package websocket

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	gorillaws "github.com/gorilla/websocket"
	"github.com/google/uuid"
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
	ClientName    string
	InstanceID    string
	Conn          *gorillaws.Conn
	ConnectedAt   time.Time
	LastSeenAt    time.Time
	Capabilities  []string
	ClientVersion string
	XScreenName   string
	wmu           sync.Mutex // 保护 Conn 写并发
}

// InstanceSnapshot 对外只读快照（不含 Conn 引用）
type InstanceSnapshot struct {
	ClientName    string    `json:"clientName"`
	InstanceID    string    `json:"instanceId"`
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
	httpServers      []*http.Server
	stopCh           chan struct{}
}

func NewServer() *Server {
	return &Server{
		sessions:         make(map[string]map[string]*ClientSession),
		pendingCallbacks: make(map[string]func([]byte)),
		stopCh:           make(chan struct{}),
	}
}

// Start 在多个端口上启动 WebSocket 监听，自动去重
func (s *Server) Start(ports []int) error {
	seen := map[int]bool{}
	for _, p := range ports {
		if seen[p] {
			continue
		}
		seen[p] = true
		mux := http.NewServeMux()
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			conn, err := upgrader.Upgrade(w, r, nil)
			if err != nil {
				log.Printf("[WS] upgrade error: %v", err)
				return
			}
			go s.handleConn(conn)
		})
		srv := &http.Server{Addr: fmt.Sprintf(":%d", p), Handler: mux}
		s.httpServers = append(s.httpServers, srv)
		go func(port int, server *http.Server) {
			log.Printf("[WS] listening on :%d", port)
			if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				log.Printf("[WS] port %d error: %v", port, err)
			}
		}(p, srv)
	}
	go s.runHeartbeat()
	return nil
}

func (s *Server) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	select {
	case <-s.stopCh:
	default:
		close(s.stopCh)
	}
	
	for _, srv := range s.httpServers {
		_ = srv.Close()
	}
	
	for _, sessions := range s.sessions {
		for _, sess := range sessions {
			_ = sess.Conn.Close()
		}
	}
	s.sessions = make(map[string]map[string]*ClientSession)
	s.pendingCallbacks = make(map[string]func([]byte))
}

// handleConn 每个 WS 连接的读循环（单独 goroutine）
func (s *Server) handleConn(conn *gorillaws.Conn) {
	defer func() {
		conn.Close()
		s.removeConn(conn)
	}()
	log.Printf("[WS] new connection from %s", conn.RemoteAddr())
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			log.Printf("[WS] read error (%s): %v", conn.RemoteAddr(), err)
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

	switch peek.Type {
	case types.ClientHello:
		s.handleClientHello(data, conn)

	case types.Ping:
		s.handlePing(peek, conn)

	default:
		// 所有 response.* 消息：触发对应的 pendingCallback（REST 层注册）
		s.mu.Lock()
		cb, ok := s.pendingCallbacks[peek.ID]
		if ok {
			delete(s.pendingCallbacks, peek.ID)
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
	if instanceID == "" {
		// 旧版扩展没有 instanceId，生成带 "tmp-" 前缀的临时 ID
		instanceID = "tmp-" + uuid.New().String()
	}
	log.Printf("[WS] hello: %s / %s", clientName, instanceID)

	s.mu.Lock()
	if s.sessions[clientName] == nil {
		s.sessions[clientName] = make(map[string]*ClientSession)
	}
	// 同一实例重连：关闭旧连接（不影响同 clientName 下其他 instanceId）
	if old, exists := s.sessions[clientName][instanceID]; exists {
		old.Conn.Close()
		log.Printf("[WS] replaced old session: %s/%s", clientName, instanceID)
	}
	sess := &ClientSession{
		ClientName:    clientName,
		InstanceID:    instanceID,
		Conn:          conn,
		ConnectedAt:   time.Now(),
		LastSeenAt:    time.Now(),
		Capabilities:  msg.Payload.Capabilities,
		ClientVersion: msg.Payload.ClientVersion,
	}
	s.sessions[clientName][instanceID] = sess
	s.mu.Unlock()

	s.sendHelloAck(conn, msg.ID, clientName)
}

func (s *Server) handlePing(peek types.PeekMessage, conn *gorillaws.Conn) {
	s.mu.Lock()
	for _, sessions := range s.sessions {
		for _, sess := range sessions {
			if sess.Conn == conn {
				sess.LastSeenAt = time.Now()
				break
			}
		}
	}
	clientName := s.connClientNameLocked(conn)
	s.mu.Unlock()
	s.sendPong(conn, peek.ID, clientName)
}

func (s *Server) removeConn(conn *gorillaws.Conn) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for clientName, sessions := range s.sessions {
		for instanceID, sess := range sessions {
			if sess.Conn == conn {
				delete(sessions, instanceID)
				if len(sessions) == 0 {
					delete(s.sessions, clientName)
				}
				log.Printf("[WS] removed: %s/%s", clientName, instanceID)
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
	sess.wmu.Lock()
	defer sess.wmu.Unlock()
	return sess.Conn.WriteMessage(gorillaws.TextMessage, data)
}

// RegisterCallback 注册一次性 msgID 回调（REST 层使用）
func (s *Server) RegisterCallback(msgID string, cb func([]byte)) {
	s.mu.Lock()
	s.pendingCallbacks[msgID] = cb
	s.mu.Unlock()
}

// RemoveCallback 超时清理未使用的回调
func (s *Server) RemoveCallback(msgID string) {
	s.mu.Lock()
	delete(s.pendingCallbacks, msgID)
	s.mu.Unlock()
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
			var stale []*gorillaws.Conn
			s.mu.RLock()
			for _, sessions := range s.sessions {
				for _, sess := range sessions {
					if now.Sub(sess.LastSeenAt) > heartbeatTimeout {
						stale = append(stale, sess.Conn)
					}
				}
			}
			s.mu.RUnlock()
			for _, conn := range stale {
				log.Printf("[WS] heartbeat timeout: %s", conn.RemoteAddr())
				conn.Close()
			}
		}
	}
}

// --- 内部发送 ---

func (s *Server) sendHelloAck(conn *gorillaws.Conn, replyID, target string) {
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
	conn.WriteMessage(gorillaws.TextMessage, data)
	log.Printf("[WS] sent hello_ack to %s", target)
}

func (s *Server) sendPong(conn *gorillaws.Conn, replyID, target string) {
	pong := types.Message[types.EmptyPayload]{
		ID: replyID, Type: types.Pong,
		Source: ServerName, Target: target,
		Timestamp: time.Now().UnixMilli(),
		Payload:   types.EmptyPayload{},
	}
	data, _ := json.Marshal(pong)
	conn.WriteMessage(gorillaws.TextMessage, data)
}
