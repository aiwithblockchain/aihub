package config

import (
	"encoding/json"
	"os"
	"path/filepath"
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
	TweetClawWS ServiceConfig `json:"tweetClawWS"`
	AIClawWS    ServiceConfig `json:"aiClawWS"`
	RestAPI     ServiceConfig `json:"restAPI"`
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
	}
}

func configPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "localbridge", "config.json")
}

// Load 从磁盘读取配置，文件不存在时返回默认值
func Load() Config {
	cfg := DefaultConfig()
	data, err := os.ReadFile(configPath())
	if err != nil {
		return cfg
	}
	_ = json.Unmarshal(data, &cfg)

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

func Save(cfg Config) error {
	p := configPath()
	_ = os.MkdirAll(filepath.Dir(p), 0755)
	data, _ := json.MarshalIndent(cfg, "", "  ")
	return os.WriteFile(p, data, 0644)
}
