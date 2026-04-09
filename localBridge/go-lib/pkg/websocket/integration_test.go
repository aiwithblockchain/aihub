package websocket

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	gorillaws "github.com/gorilla/websocket"
	"github.com/hyperorchid/localbridge/pkg/types"
)

// setupTestServerAndClient 创建一个带打桩 HTTP server 封装的本地 Server 环境，以及建立连接的 clientConn
func setupTestServerAndClient(t *testing.T, clientName, instanceID string) (*Server, *httptest.Server, *gorillaws.Conn) {
	s := NewServer()

	// 启动测试 HTTP Server 模拟 Start() 中的路由
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Logf("upgrade error: %v", err)
			return
		}
		// 路由拦截并交付读循环协程
		go s.handleConn(conn)
	})
	ts := httptest.NewServer(mux)

	// 构造前端 WebSocket URL
	u, _ := url.Parse(ts.URL)
	u.Scheme = "ws"

	// 实例化真实的后端 Gorilla websocket dialer
	conn, _, err := gorillaws.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		t.Fatalf("Failed to connect to test server: %v", err)
	}

	// 握手阶段：先发射一个合法合规的 ClientHello，确保创建 ClientSession
	helloMsg := types.Message[types.ClientHelloPayload]{
		ID:        "test-hello-" + uuid.New().String()[:5],
		Type:      types.ClientHello,
		Source:    clientName,
		Target:    "LocalBridgeGo",
		Timestamp: time.Now().UnixMilli(),
		Payload: types.ClientHelloPayload{
			ClientName:    clientName,
			InstanceID:    instanceID,
			InstanceName:  "TestInstance",
			ClientVersion: "1.0",
		},
	}
	helloData, _ := json.Marshal(helloMsg)
	_ = conn.WriteMessage(gorillaws.TextMessage, helloData)

	// 为 server 的 readLoop 和 handleClientHello 的处理留白短暂停顿
	time.Sleep(100 * time.Millisecond)

	return s, ts, conn
}

// 任务用例 1: 测试大量并发发送下，单写模型是否会引发原来版本必然复现的 panic 的顽固问题
func TestConcurrentSend(t *testing.T) {
	clientName, instanceID := "testClient", "inst1"
	s, ts, clientConn := setupTestServerAndClient(t, clientName, instanceID)
	defer ts.Close()
	defer clientConn.Close()
	defer s.Stop()

	// Client 端设置假性读循环处理响应队列，避免 Socket 堵塞拖慢后端发送测试效率
	go func() {
		for {
			_, _, err := clientConn.ReadMessage()
			if err != nil {
				return
			}
		}
	}()

	sess, err := s.ResolveConn(clientName, instanceID)
	if err != nil {
		t.Fatalf("ResolveConn failed, Session missing: %v", err)
	}

	var wg sync.WaitGroup
	msgCount := 1000 // 测试 1000 次超量并发压入 channel (缓冲设为 100)
	wg.Add(msgCount)

	for i := 0; i < msgCount; i++ {
		go func(id int) {
			defer wg.Done()
			payload := types.Message[string]{
				ID:      fmt.Sprintf("msg-%d", id),
				Type:    "test.concurrent",
				Payload: "test payload string",
			}
			data, _ := json.Marshal(payload)
			
			// 并发调用最新的非阻塞 Send 通道
			err := sess.Send(data)
			// 通道有满的概率，只要不 panic，抛出 send queue full 属于系统自我保护范畴(也是预期的非恐慌表现)
			if err != nil && err.Error() != "send queue full" {
				t.Errorf("Send failed unexpectedly: %v", err)
			}
		}(i)
	}

	wg.Wait()
	time.Sleep(100 * time.Millisecond) // 等待 writerLoop 处理剩余缓冲区数据
}


// 任务用例 2: 连接断网或回收时，HTTP 发来的 pending callbacks 必须立刻被失效剔除
func TestSessionDisconnectCleanup(t *testing.T) {
	clientName, instanceID := "testClient", "inst2"
	s, ts, clientConn := setupTestServerAndClient(t, clientName, instanceID)
	defer ts.Close()
	defer s.Stop()

	sess, err := s.ResolveConn(clientName, instanceID)
	if err != nil {
		t.Fatalf("ResolveConn failed: %v", err)
	}

	var wg sync.WaitGroup
	callbackCount := 10 // 抛给 server 处理的模拟被拦截 REST 调用
	wg.Add(callbackCount)
	
	// 大量注入 Pending Callback (绑定到上面的这个 sess 上)
	for i := 0; i < callbackCount; i++ {
		msgID := fmt.Sprintf("pending-%d", i)
		s.RegisterCallback(msgID, sess, func(data []byte) {
			defer wg.Done()

			// 断网清理机制的承诺返回体
			var errResp struct {
				Type    string `json:"type"`
				Payload struct {
					Code string `json:"code"`
				} `json:"payload"`
			}
			json.Unmarshal(data, &errResp)

			if errResp.Type != "response.error" || errResp.Payload.Code != "session_disconnected" {
				t.Errorf("Expected immediate fallback response.error code session_disconnected, got %+v", errResp)
			}
		})
	}

	// [高危复刻]: 前端因超时或被杀后台强行终止链接！
	clientConn.Close()

	// 设置一个时间倒数监视器验证即时性：
	c := make(chan struct{})
	go func() {
		wg.Wait()
		close(c)
	}()

	select {
	case <-c:
		// success: 由于强制回收清空操作，10条被拦截挂起的任务会极速瞬间触发！
	case <-time.After(1 * time.Second):
		t.Fatalf("Timeout! Fast-fail disconnect cleanup mechanism failed to fire hooks immediately!")
	}
}


// 任务用例 3: 循环测试重叠访问造成的 Goroutine 泄露问题
func TestNoGoroutineLeak(t *testing.T) {
	initialGoroutines := runtime.NumGoroutine()

	s := NewServer()
	
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		conn, _ := upgrader.Upgrade(w, r, nil)
		go s.handleConn(conn)
	})
	ts := httptest.NewServer(mux)
	
	u, _ := url.Parse(ts.URL)
	u.Scheme = "ws"

	var conns []*gorillaws.Conn
	for i := 0; i < 50; i++ {
		conn, _, err := gorillaws.DefaultDialer.Dial(u.String(), nil)
		if err == nil {
			helloMsg := types.Message[types.ClientHelloPayload]{
				ID:   fmt.Sprintf("hello-%d", i),
				Type: types.ClientHello,
				Payload: types.ClientHelloPayload{
					ClientName: "testBatch",
					InstanceID: fmt.Sprintf("inst-%d", i),
				},
			}
			msgData, _ := json.Marshal(helloMsg)
			conn.WriteMessage(gorillaws.TextMessage, msgData)
			conns = append(conns, conn)
		}
	}

	// 稍微放慢脚步给 Server 读循环和各种 hello 处理逻辑时间生成常驻 Coroutine
	time.Sleep(300 * time.Millisecond)

	// 野蛮抛弃：无预兆关闭所有的 client socket
	for _, c := range conns {
		c.Close()
	}
	// Server 自身底层清理也需要些许纳秒至毫秒
	time.Sleep(500 * time.Millisecond)

	ts.Close()
	s.Stop()
	time.Sleep(200 * time.Millisecond)
	
	// 在内存上推演一把完整的 Go 原生 GC 垃圾箱回收
	runtime.GC()

	endGoroutines := runtime.NumGoroutine()
	difference := endGoroutines - initialGoroutines
	
	// 允许极少量的底层系统调度（常态波动），只要不随着客户端连接数呈正比爆炸就不叫泄漏。
	if difference > 10 {
		t.Errorf("Potential memory leak (Goroutine leak detected): init=%d, after load test=%d (+%d)", initialGoroutines, endGoroutines, difference)
	}
}


// 任务用例 4: 业务消息是否足以作为心跳存活特征 (避免长任务超时被错杀)
func TestHeartbeatViaBusinessMessage(t *testing.T) {
	clientName, instanceID := "testHB", "hb-inst1"
	s, ts, clientConn := setupTestServerAndClient(t, clientName, instanceID)
	defer ts.Close()
	defer clientConn.Close()
	defer s.Stop()

	sess, err := s.ResolveConn(clientName, instanceID)
	if err != nil {
		t.Fatalf("ResolveConn failed: %v", err)
	}

	sess.mu.Lock()
	initSeen := sess.LastSeenAt
	sess.mu.Unlock()

	time.Sleep(50 * time.Millisecond)

	// 我们发个毫无意义的内部业务伪造数据包过去（不发Ping）
	busMsg := types.PeekMessage{
		ID:   "routine-task-progress-msg",
		Type: "event.task_progress",
	}
	data, _ := json.Marshal(busMsg)
	clientConn.WriteMessage(gorillaws.TextMessage, data)

	// Server 端处理更新 LastSeenAt 纳秒级别，但为测试给一点物理容忍度
	time.Sleep(100 * time.Millisecond)

	sess.mu.Lock()
	newSeen := sess.LastSeenAt
	sess.mu.Unlock()

	// 若 `handleMessage` 没有做 `s.touchConn(conn)`，该测试条件不成立
	if !newSeen.After(initSeen) {
		t.Errorf("Expected heartbeat (LastSeenAt timestamp) to forcefully update via any application business packet/event. Old=%v, Fresh=%v", initSeen, newSeen)
	}
}
