package types

// EmptyPayload 用于 ping/pong 和无参数的内置消息
type EmptyPayload struct{}

// ClientHelloPayload 插件向 aihub 发送握手信息
// 必须字段：clientName、capabilities
type ClientHelloPayload struct {
	ProtocolName    string   `json:"protocolName"`
	ProtocolVersion string   `json:"protocolVersion"`
	ClientName      string   `json:"clientName"`
	ClientVersion   string   `json:"clientVersion"`
	Browser         string   `json:"browser"`
	Capabilities    []string `json:"capabilities"` // 插件支持的所有 messageType
	InstanceID      string   `json:"instanceId,omitempty"` // 空 = 旧版插件，自动生成 tmp- 前缀 ID
	Incognito       *bool    `json:"incognito,omitempty"`
}

// ServerHelloAckPayload aihub 回应插件的握手确认
type ServerHelloAckPayload struct {
	ProtocolName        string `json:"protocolName"`
	ProtocolVersion     string `json:"protocolVersion"`
	ServerName          string `json:"serverName"`
	ServerVersion       string `json:"serverVersion"`
	HeartbeatIntervalMs int    `json:"heartbeatIntervalMs"`
}

// ErrorPayload 协议级错误响应
type ErrorPayload struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Details map[string]interface{} `json:"details,omitempty"`
}
