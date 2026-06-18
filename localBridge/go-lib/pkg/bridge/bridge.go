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
	return NewWithRESTRegistrar(cfg, nil)
}

func NewWithRESTRegistrar(cfg config.Config, registrar restapi.RouteRegistrar) *Bridge {
	ws := websocket.NewServer()
	restAddresses := convertToRESTAddresses(cfg.RestAPI.Addresses)

	return &Bridge{
		cfg:        cfg,
		wsServer:   ws,
		restServer: restapi.NewServerWithRegistrar(restAddresses, ws, registrar, cfg),
	}
}

func (b *Bridge) Start() error {
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

func StartWithConfigJSON(configJSON string, registrar restapi.RouteRegistrar) error {
	cfg := config.FromJSON(configJSON)
	global = NewWithRESTRegistrar(cfg, registrar)
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
