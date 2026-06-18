package config

import "encoding/json"

type ListenAddress struct {
	IP      string `json:"ip"`
	Port    int    `json:"port"`
	Enabled bool   `json:"enabled"`
}

type ServiceConfig struct {
	Addresses []ListenAddress `json:"addresses"`
}

type Config struct {
	TweetClawWS      ServiceConfig `json:"tweetClawWS"`
	AIClawWS         ServiceConfig `json:"aiClawWS"`
	RestAPI          ServiceConfig `json:"restAPI"`
	TimeoutMs        int           `json:"timeoutMs"`
	PublishTimeoutMs int           `json:"publishTimeoutMs"`
	SyncIntervalMs   int           `json:"syncIntervalMs"`
}

func DefaultConfig() Config {
	return Config{
		TweetClawWS: ServiceConfig{
			Addresses: []ListenAddress{
				{IP: "127.0.0.1", Port: 10086, Enabled: true},
			},
		},
		AIClawWS: ServiceConfig{
			Addresses: []ListenAddress{
				{IP: "127.0.0.1", Port: 10087, Enabled: true},
			},
		},
		RestAPI: ServiceConfig{
			Addresses: []ListenAddress{
				{IP: "127.0.0.1", Port: 10088, Enabled: true},
			},
		},
		TimeoutMs:        30000,
		PublishTimeoutMs: 300000,
		SyncIntervalMs:   60000,
	}
}

// FromJSON 从 JSON 字符串解析配置，解析失败或字段缺失时回退到默认值
func FromJSON(data string) Config {
	cfg := DefaultConfig()
	if len(data) == 0 {
		return cfg
	}
	_ = json.Unmarshal([]byte(data), &cfg)

	// 兜底：如果解析出的 timeout 字段为 0，回退到默认值
	if cfg.TimeoutMs <= 0 {
		cfg.TimeoutMs = DefaultConfig().TimeoutMs
	}
	if cfg.PublishTimeoutMs <= 0 {
		cfg.PublishTimeoutMs = DefaultConfig().PublishTimeoutMs
	}
	if cfg.SyncIntervalMs <= 0 {
		cfg.SyncIntervalMs = DefaultConfig().SyncIntervalMs
	}

	// 确保至少有一个启用的地址
	if len(cfg.TweetClawWS.Addresses) == 0 {
		cfg.TweetClawWS = DefaultConfig().TweetClawWS
	}
	if len(cfg.AIClawWS.Addresses) == 0 {
		cfg.AIClawWS = DefaultConfig().AIClawWS
	}
	if len(cfg.RestAPI.Addresses) == 0 {
		cfg.RestAPI = DefaultConfig().RestAPI
	}

	return cfg
}

// Load 保留旧函数签名供兼容，但不再读取文件，直接返回默认配置
func Load() Config {
	return DefaultConfig()
}

// Save 保留旧函数签名供兼容，但不再操作文件
func Save(cfg Config) error {
	return nil
}
