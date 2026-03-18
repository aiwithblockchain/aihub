package types

import "encoding/json"

// MessageType 仅定义 aihub 平台内置的协议级消息类型。
// 业务级消息类型（request.*、response.*）不在此定义，全部使用 string 透传。
type MessageType string

// 内置协议消息：aihub 直接处理，不透传给插件
const (
	ClientHello    MessageType = "client.hello"
	ServerHelloAck MessageType = "server.hello_ack"
	Ping           MessageType = "ping"
	Pong           MessageType = "pong"
)

// PeekMessage 只解析 id+type，不解析 payload（用于 switch 分发）
type PeekMessage struct {
	ID   string      `json:"id"`
	Type MessageType `json:"type"`
}

// Message 泛型消息封装（Go 1.18+）
type Message[T any] struct {
	ID        string      `json:"id"`
	Type      MessageType `json:"type"`
	Source    string      `json:"source"`
	Target    string      `json:"target"`
	Timestamp int64       `json:"timestamp"`
	Payload   T           `json:"payload"`
}

// RawMessage 用于通用端点透明转发时保留 payload 原始 JSON
type RawMessage struct {
	ID        string          `json:"id"`
	Type      MessageType     `json:"type"`
	Source    string          `json:"source"`
	Target    string          `json:"target"`
	Timestamp int64           `json:"timestamp"`
	Payload   json.RawMessage `json:"payload"`
}
