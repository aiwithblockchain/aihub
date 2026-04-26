package bridge

import (
	"github.com/hyperorchid/localbridge/pkg/config"
	"github.com/hyperorchid/localbridge/pkg/restapi"
	"github.com/hyperorchid/localbridge/pkg/websocket"
)

type Bridge struct {
	cfg        config.Config
	wsServer   *websocket.Server
	restServer *restapi.Server
}

var global *Bridge

func New(cfg config.Config) *Bridge {
	ws := websocket.NewServer()

	// 将配置转换为 WebSocket 和 REST API 所需的格式
	wsAddresses := convertToWSAddresses(cfg.TweetClawWS.Addresses)
	wsAddresses = append(wsAddresses, convertToWSAddresses(cfg.AIClawWS.Addresses)...)
	restAddresses := convertToRESTAddresses(cfg.RestAPI.Addresses)

	return &Bridge{
		cfg:        cfg,
		wsServer:   ws,
		restServer: restapi.NewServer(restAddresses, ws),
	}
}

func (b *Bridge) Start() error {
	// 合并 TweetClaw 和 AIClaw 的地址一起启动 WebSocket 服务器
	wsAddresses := convertToWSAddresses(b.cfg.TweetClawWS.Addresses)
	wsAddresses = append(wsAddresses, convertToWSAddresses(b.cfg.AIClawWS.Addresses)...)

	if err := b.wsServer.Start(wsAddresses); err != nil {
		return err
	}
	return b.restServer.Start()
}

func (b *Bridge) Stop() {
	b.restServer.Stop()
	b.wsServer.Stop()
}

func (b *Bridge) GetInstances() []websocket.InstanceSnapshot {
	return b.wsServer.GetInstances()
}

// 转换配置格式
func convertToWSAddresses(addrs []config.ListenAddress) []websocket.ListenAddress {
	result := make([]websocket.ListenAddress, len(addrs))
	for i, addr := range addrs {
		result[i] = websocket.ListenAddress{
			IP:      addr.IP,
			Port:    addr.Port,
			Enabled: addr.Enabled,
		}
	}
	return result
}

func convertToRESTAddresses(addrs []config.ListenAddress) []restapi.ListenAddress {
	result := make([]restapi.ListenAddress, len(addrs))
	for i, addr := range addrs {
		result[i] = restapi.ListenAddress{
			IP:      addr.IP,
			Port:    addr.Port,
			Enabled: addr.Enabled,
		}
	}
	return result
}

// 包级单例方法，供 CGo export 层调用

func StartDefault() error {
	cfg := config.Load()
	global = New(cfg)
	return global.Start()
}

func StopDefault() {
	if global != nil {
		global.Stop()
		global = nil
	}
}

func GetDefaultInstances() []websocket.InstanceSnapshot {
	if global == nil {
		return []websocket.InstanceSnapshot{}
	}
	return global.GetInstances()
}
