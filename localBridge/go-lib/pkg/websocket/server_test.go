package websocket

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	gorillaws "github.com/gorilla/websocket"
	"github.com/google/uuid"
	"github.com/hyperorchid/localbridge/pkg/types"
)

func TestWebSocketServer_Handshake(t *testing.T) {
	s := NewServer()
	
	// 使用 httptest 创建一个不需要真实端口监听的测试服务器
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("Failed to upgrade: %v", err)
			return
		}
		defer conn.Close()
		s.handleConn(conn)
	}))
	defer ts.Close()
	defer s.Stop()

	// 转换为 ws:// 协议地址
	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http")

	// 连接到服务器
	dialer := gorillaws.Dialer{}
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect: %v", err)
	}
	defer conn.Close()

	// 1. 发送 client.hello
	msgID := uuid.New().String()
	helloMsg := types.Message[types.ClientHelloPayload]{
		ID:        msgID,
		Type:      types.ClientHello,
		Source:    "testPlugin",
		Target:    "aihub",
		Timestamp: time.Now().UnixMilli(),
		Payload: types.ClientHelloPayload{
			ProtocolName:    ProtocolName,
			ProtocolVersion: ProtocolVersion,
			ClientName:      "testPlugin",
			Capabilities:    []string{"request.ping_test"},
			InstanceID:      "test-instance-1",
		},
	}
	
	err = conn.WriteJSON(helloMsg)
	if err != nil {
		t.Fatalf("Failed to send client.hello: %v", err)
	}

	// 2. 接收 server.hello_ack
	var resp types.Message[types.ServerHelloAckPayload]
	err = conn.ReadJSON(&resp)
	if err != nil {
		t.Fatalf("Failed to read server.hello_ack: %v", err)
	}

	if resp.Type != types.ServerHelloAck {
		t.Errorf("Expected type server.hello_ack, got %s", resp.Type)
	}
	
	if resp.ID != msgID {
		t.Errorf("Expected ID match %s, got %s", msgID, resp.ID)
	}

	if resp.Payload.ServerName != ServerName {
		t.Errorf("Expected serverName %s, got %s", ServerName, resp.Payload.ServerName)
	}

	t.Logf("✅ Successfully verified client.hello / server.hello_ack")
}
