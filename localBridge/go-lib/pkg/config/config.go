package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type Config struct {
	TweetClawPort int `json:"tweetClawPort"` // default 10086
	AIClawPort    int `json:"aiClawPort"`    // default 10087
	RestPort      int `json:"restPort"`      // always 10088, not user-configurable
}

func DefaultConfig() Config {
	return Config{TweetClawPort: 10086, AIClawPort: 10087, RestPort: 10088}
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
	if cfg.TweetClawPort <= 0 { cfg.TweetClawPort = 10086 }
	if cfg.AIClawPort <= 0    { cfg.AIClawPort    = 10087 }
	cfg.RestPort = 10088 // 固定，不允许覆盖
	return cfg
}

func Save(cfg Config) error {
	p := configPath()
	_ = os.MkdirAll(filepath.Dir(p), 0755)
	data, _ := json.MarshalIndent(cfg, "", "  ")
	return os.WriteFile(p, data, 0644)
}
