package types

// ===========================================================
// tweetClaw 插件的 Payload 类型
// ===========================================================

// ---- X (Twitter) 查询 ----

type XTabInfo struct {
	TabID  int    `json:"tabId"`
	URL    string `json:"url"`
	Active bool   `json:"active"`
}

type QueryXTabsStatusResponse struct {
	HasXTabs     bool       `json:"hasXTabs"`
	IsLoggedIn   bool       `json:"isLoggedIn"`
	ActiveXTabID *int       `json:"activeXTabId"`
	ActiveXURL   *string    `json:"activeXUrl"`
	Tabs         []XTabInfo `json:"tabs"`
}

type QueryXBasicInfoResponse struct {
	IsLoggedIn     bool        `json:"isLoggedIn"`
	Name           *string     `json:"name"`
	ScreenName     *string     `json:"screenName"`
	TwitterID      *string     `json:"twitterId"`
	Verified       *bool       `json:"verified"`
	FollowersCount *int        `json:"followersCount"`
	FriendsCount   *int        `json:"friendsCount"`
	StatusesCount  *int        `json:"statusesCount"`
	Avatar         *string     `json:"avatar"`
	Description    *string     `json:"description"`
	CreatedAt      *string     `json:"createdAt"`
	Raw            interface{} `json:"raw"`
	UpdatedAt      *int64      `json:"updatedAt"`
}

// ---- Tab 操作 ----

type OpenTabRequest struct {
	Path string `json:"path"`
}
type OpenTabResponse struct {
	Success bool    `json:"success"`
	TabID   *int    `json:"tabId"`
	URL     *string `json:"url"`
	Error   *string `json:"error"`
}

type CloseTabRequest struct {
	TabID int `json:"tabId"`
}
type CloseTabResponse struct {
	Success bool    `json:"success"`
	Reason  string  `json:"reason"` // "success" | "not_found" | "failed"
	Error   *string `json:"error"`
}

type NavigateTabRequest struct {
	TabID *int   `json:"tabId"`
	Path  string `json:"path"`
}
type NavigateTabResponse struct {
	Success bool    `json:"success"`
	TabID   int     `json:"tabId"`
	URL     string  `json:"url"`
	Error   *string `json:"error"`
}

// ---- Exec Action ----

type ExecActionRequest struct {
	Action  string  `json:"action"`   // like / unlike / retweet / follow 等
	TweetID *string `json:"tweetId"`
	UserID  *string `json:"userId"`
	TabID   *int    `json:"tabId"`
	Text    *string `json:"text"`
}
type ExecActionResponse struct {
	OK    bool        `json:"ok"`
	Data  interface{} `json:"data"`
	Error *string     `json:"error"`
}

// ---- Timeline 查询 ----

type QueryTweetDetailRequest struct {
	TweetID string `json:"tweetId"`
	TabID   *int   `json:"tabId"`
}
type QueryUserProfileRequest struct {
	ScreenName string `json:"screenName"`
	TabID      *int   `json:"tabId"`
}
type QuerySearchTimelineRequest struct {
	TabID *int `json:"tabId"`
}

// ===========================================================
// aiClaw 插件的 Payload 类型
// ===========================================================

// ---- AI 标签页状态 ----

type PlatformStatus struct {
	HasTab     bool `json:"hasTab"`
	IsLoggedIn bool `json:"isLoggedIn"`
}

type AIPlatformsInfo struct {
	ChatGPT PlatformStatus `json:"chatgpt"`
	Gemini  PlatformStatus `json:"gemini"`
	Grok    PlatformStatus `json:"grok"`
}

type AITabInfo struct {
	TabID    int    `json:"tabId"`
	URL      string `json:"url"`
	Platform string `json:"platform"` // chatgpt | gemini | grok
	Active   bool   `json:"active"`
}

type QueryAITabsStatusResponse struct {
	HasAITabs     bool            `json:"hasAITabs"`
	Platforms     AIPlatformsInfo `json:"platforms"`
	ActiveAITabID *int            `json:"activeAITabId"`
	ActiveAIURL   *string         `json:"activeAIUrl"`
	Tabs          []AITabInfo     `json:"tabs"`
}

// ---- 任务执行 ----

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

type ExecuteTaskResultPayload struct {
	TaskID         string  `json:"taskId"`
	Success        bool    `json:"success"`
	Platform       string  `json:"platform"`
	Content        *string `json:"content"`
	ConversationID *string `json:"conversationId"`
	Error          *string `json:"error"`
	ExecutedAt     string  `json:"executedAt"`
	DurationMs     int     `json:"durationMs"`
}
