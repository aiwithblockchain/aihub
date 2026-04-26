package types

// ===========================================================
// tweetClaw 插件的 Payload 类型
// ===========================================================
// 注意：响应类型已移除，所有响应均透传原始 JSON

// ---- Tab 操作请求 ----

type OpenTabRequest struct {
	Path string `json:"path"`
}

type CloseTabRequest struct {
	TabID int `json:"tabId"`
}

type NavigateTabRequest struct {
	TabID *int   `json:"tabId"`
	Path  string `json:"path"`
}

// ---- Exec Action 请求 ----

type ExecActionRequest struct {
	Action   string   `json:"action"`   // like / unlike / retweet / follow 等
	TweetID  *string  `json:"tweetId"`
	UserID   *string  `json:"userId"`
	TabID    *int     `json:"tabId"`
	Text     *string  `json:"text"`
	MediaIDs []string `json:"media_ids,omitempty"` // 媒体 ID 列表，用于发推文时附加图片/视频
}

// ---- Timeline 查询请求 ----

type QueryTweetDetailRequest struct {
	TweetID string `json:"tweetId"`
	TabID   *int   `json:"tabId"`
}

type QueryTweetRepliesRequest struct {
	TweetID string `json:"tweetId"`
	TabID   *int   `json:"tabId"`
	Cursor  string `json:"cursor,omitempty"`
}

type QueryUserProfileRequest struct {
	ScreenName string `json:"screenName"`
	TabID      *int   `json:"tabId"`
}

type QuerySearchTimelineRequest struct {
	TabID  *int   `json:"tabId,omitempty"`
	Query  string `json:"query,omitempty"`  // 搜索关键词
	Cursor string `json:"cursor,omitempty"` // 翻页游标
	Count  int    `json:"count,omitempty"`  // 结果数量
}

type QueryUserTweetsRequest struct {
	UserID string `json:"userId"`           // 用户 ID (如 "44196397")
	TabID  *int   `json:"tabId,omitempty"`
	Cursor string `json:"cursor,omitempty"` // 翻页游标
	Count  int    `json:"count,omitempty"`  // 结果数量，默认 20
}

// ===========================================================
// aiClaw 插件的 Payload 类型
// ===========================================================
// 注意：响应类型已移除，所有响应均透传原始 JSON

// ---- 任务执行请求 ----

type SendMessagePromptPayload struct {
	Prompt         *string `json:"prompt"`
	ConversationID *string `json:"conversationId"`
	Model          *string `json:"model"`
}

type ExecuteTaskRequestPayload struct {
	TaskID   string                   `json:"taskId"`
	Platform string                   `json:"platform"` // chatgpt | gemini | grok
	Action   string                   `json:"action"`   // send_message | new_conversation
	Payload  SendMessagePromptPayload `json:"payload"`
	Timeout  *int                     `json:"timeout"`
}

// ---- 页面跳转请求 ----

type NavigateToPlatformPayload struct {
	Platform string `json:"platform"` // chatgpt | gemini | grok
}
