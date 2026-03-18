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
	return &Bridge{
		cfg:        cfg,
		wsServer:   ws,
		restServer: restapi.NewServer(cfg.RestPort, ws),
	}
}

func (b *Bridge) Start() error {
	if err := b.wsServer.Start([]int{b.cfg.TweetClawPort, b.cfg.AIClawPort}); err != nil {
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
	if global == nil { return nil }
	return global.GetInstances()
}
