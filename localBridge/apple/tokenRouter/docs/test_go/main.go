package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

type ClaudeSettings struct {
	Env struct {
		AnthropicAuthToken string `json:"ANTHROPIC_AUTH_TOKEN"`
		AnthropicAPIKey    string `json:"ANTHROPIC_API_KEY"`
		AnthropicBaseURL   string `json:"ANTHROPIC_BASE_URL"`
	} `json:"env"`
}

type AnthropicRequest struct {
	Model     string    `json:"model"`
	MaxTokens int       `json:"max_tokens"`
	Messages  []Message `json:"messages"`
	System    string    `json:"system,omitempty"`   // 系统提示
	Thinking  *Thinking `json:"thinking,omitempty"` // 扩展思考模式
}

type Thinking struct {
	Type         string `json:"type"`                    // "enabled" 或 "disabled"
	BudgetTokens int    `json:"budget_tokens,omitempty"` // thinking tokens 预算 (正确的字段名)
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type AnthropicResponse struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Role    string `json:"role"`
	Content []struct {
		Type     string `json:"type"`
		Text     string `json:"text,omitempty"`
		Thinking string `json:"thinking,omitempty"` // Extended thinking 内容
	} `json:"content"`
	Model      string `json:"model"`
	StopReason string `json:"stop_reason"`
	Usage      Usage  `json:"usage"`
	Error      *Error `json:"error,omitempty"`
}

type Usage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

type Error struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

func main() {
	fmt.Println("=== 测试 Claude API 调用 ===\n")

	homeDir, err := os.UserHomeDir()
	if err != nil {
		fmt.Printf("❌ 无法获取用户目录: %v\n", err)
		return
	}

	settingsPath := filepath.Join(homeDir, ".claude", "settings.json")
	fmt.Printf("📁 读取配置: %s\n", settingsPath)

	data, err := os.ReadFile(settingsPath)
	if err != nil {
		fmt.Printf("❌ 读取失败: %v\n", err)
		return
	}

	var settings ClaudeSettings
	if err := json.Unmarshal(data, &settings); err != nil {
		fmt.Printf("❌ 解析失败: %v\n", err)
		return
	}

	token := settings.Env.AnthropicAuthToken
	if token == "" {
		token = settings.Env.AnthropicAPIKey
	}
	baseURL := settings.Env.AnthropicBaseURL
	if baseURL == "" {
		baseURL = "https://api.anthropic.com"
	}

	fmt.Printf("✅ Base URL: %s\n", baseURL)
	if len(token) > 20 {
		fmt.Printf("✅ Token: %s...%s\n\n", token[:10], token[len(token)-10:])
	}

	// 构造请求 - 可以自定义模型、thinking 和 effort
	apiURL := baseURL + "/v1/messages"

	// 可选择的模型:
	// - claude-opus-4-6 (最强,最贵)
	// - claude-sonnet-4-6 (平衡)
	// - claude-haiku-4-5-20251001 (最快,最便宜)
	model := "claude-opus-4-6"

	// 可选择的 max_tokens (相当于 effort level):
	// - 1024: Low effort
	// - 4096: Medium effort
	// - 8192: High effort
	maxTokens := 4096

	// 构造系统提示 (模仿 Claude Code 的做法)

	reqBody := AnthropicRequest{
		Model:     model,
		MaxTokens: maxTokens,
		Messages: []Message{
			{Role: "user", Content: "你好，你可以帮我编写程序，我懂 go 代码，你是什么模型呢ß"},
		},
		// 启用扩展思考模式 (Extended Thinking)
		Thinking: &Thinking{
			Type:         "enabled",
			BudgetTokens: 10000, // thinking tokens 预算 (1024-128000)
		},
	}

	fmt.Printf("🎯 模型: %s\n", model)
	fmt.Printf("🎯 Max Tokens: %d\n", maxTokens)
	fmt.Printf("🎯 Thinking: enabled (budget: 10000)\n")

	jsonData, _ := json.Marshal(reqBody)
	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("❌ 创建请求失败: %v\n", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("x-api-key", token)
	fmt.Println("⏳ 等待响应...\n")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("❌ 请求失败: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	fmt.Printf("📥 HTTP Status: %d\n", resp.StatusCode)
	fmt.Println("─────────────────────────────────────")

	var apiResp AnthropicResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		fmt.Printf("❌ 解析响应失败: %v\n", err)
		fmt.Println("原始响应:")
		fmt.Println(string(body))
		return
	}

	if apiResp.Error != nil {
		fmt.Printf("❌ API 错误: %s\n", apiResp.Error.Message)
		fmt.Printf("   类型: %s\n", apiResp.Error.Type)
		return
	}

	if len(apiResp.Content) > 0 {
		fmt.Println("✅ Claude 回复:")
		fmt.Println("─────────────────────────────────────")

		// 显示所有 content 块
		for i, content := range apiResp.Content {
			if content.Type == "thinking" && content.Thinking != "" {
				fmt.Printf("\n💭 [Thinking %d]:\n%s\n", i+1, content.Thinking)
			} else if content.Type == "text" && content.Text != "" {
				fmt.Printf("\n📝 [Response %d]:\n%s\n", i+1, content.Text)
			}
		}

		fmt.Println("─────────────────────────────────────")
		fmt.Printf("\n📊 Token 使用: 输入=%d, 输出=%d\n",
			apiResp.Usage.InputTokens,
			apiResp.Usage.OutputTokens)
	} else {
		fmt.Println("⚠️  响应中没有内容")
		fmt.Println("原始响应:")
		var prettyJSON bytes.Buffer
		json.Indent(&prettyJSON, body, "", "  ")
		fmt.Println(prettyJSON.String())
	}
}
