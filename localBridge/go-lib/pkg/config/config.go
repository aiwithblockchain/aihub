package config

import (
	"encoding/json"
	"fmt"
)

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

// FromJSON 从 JSON 字符串严格解析配置，解析失败或字段缺失时返回错误
func FromJSON(data string) (Config, error) {
	var cfg Config
	if len(data) == 0 {
		return Config{}, fmt.Errorf("config JSON is empty")
	}
	if err := json.Unmarshal([]byte(data), &cfg); err != nil {
		return Config{}, fmt.Errorf("invalid config JSON: %w", err)
	}

	if cfg.TimeoutMs <= 0 {
		return Config{}, fmt.Errorf("timeoutMs must be > 0")
	}
	if cfg.PublishTimeoutMs <= 0 {
		return Config{}, fmt.Errorf("publishTimeoutMs must be > 0")
	}
	if cfg.SyncIntervalMs <= 0 {
		return Config{}, fmt.Errorf("syncIntervalMs must be > 0")
	}
	if len(cfg.TweetClawWS.Addresses) == 0 {
		return Config{}, fmt.Errorf("tweetClawWS.addresses is required")
	}
	if len(cfg.AIClawWS.Addresses) == 0 {
		return Config{}, fmt.Errorf("aiClawWS.addresses is required")
	}
	if len(cfg.RestAPI.Addresses) == 0 {
		return Config{}, fmt.Errorf("restAPI.addresses is required")
	}

	return cfg, nil
}
