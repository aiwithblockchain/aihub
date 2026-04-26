package restapi

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hyperorchid/localbridge/pkg/task"
	"github.com/hyperorchid/localbridge/pkg/types"
	"github.com/hyperorchid/localbridge/pkg/websocket"
)

const defaultTaskTimeoutMs = 210_000 // 与 Swift defaultExecuteTaskTimeoutMs 一致

type Handler struct {
	ws          *websocket.Server
	taskManager *task.Manager
	dataStore   *task.DataStore
	resultStore *task.ResultStore
}

func (h *Handler) Register(mux *http.ServeMux) {
	taskHandler := NewTaskHandler(h.ws, h.taskManager, h.dataStore, h.resultStore)

	mux.HandleFunc("/api/v1/tasks", taskHandler.CreateTask)
	mux.HandleFunc("/api/v1/tasks/", taskHandler.TaskDispatch)

	// ★ 通用桥接端点（所有插件均可使用）
	mux.HandleFunc("/api/v1/plugins", h.pluginList)    // GET: 插件发现
	mux.HandleFunc("/api/v1/plugins/", h.pluginInvoke) // POST /api/v1/plugins/{clientName}/invoke

	// ★ 预制快捷端点（向后兼容，功能上等价于通用端点）
	// X (tweetClaw) 端点
	mux.HandleFunc("/api/v1/x/status", h.xStatus)
	mux.HandleFunc("/api/v1/x/basic_info", h.xBasicInfo)
	mux.HandleFunc("/api/v1/x/instances", h.instances)
	mux.HandleFunc("/api/v1/x/timeline", h.timeline)
	mux.HandleFunc("/api/v1/x/search", h.searchTimeline)
	mux.HandleFunc("/api/v1/x/users", h.userProfile)
	mux.HandleFunc("/api/v1/x/user_tweets", h.userTweets)
	mux.HandleFunc("/api/v1/x/tweets", h.tweetsDispatch)
	mux.HandleFunc("/api/v1/x/tweets/", h.tweetResourceDispatch)
	mux.HandleFunc("/api/v1/x/likes", func(w http.ResponseWriter, r *http.Request) { h.execAction(w, r, "like") })
	mux.HandleFunc("/api/v1/x/unlikes", func(w http.ResponseWriter, r *http.Request) { h.execAction(w, r, "unlike") })
	mux.HandleFunc("/api/v1/x/retweets", func(w http.ResponseWriter, r *http.Request) { h.execAction(w, r, "retweet") })
	mux.HandleFunc("/api/v1/x/unretweets", func(w http.ResponseWriter, r *http.Request) { h.execAction(w, r, "unretweet") })
	mux.HandleFunc("/api/v1/x/bookmarks", func(w http.ResponseWriter, r *http.Request) { h.execAction(w, r, "bookmark") })
	mux.HandleFunc("/api/v1/x/unbookmarks", func(w http.ResponseWriter, r *http.Request) { h.execAction(w, r, "unbookmark") })
	mux.HandleFunc("/api/v1/x/follows", func(w http.ResponseWriter, r *http.Request) { h.execAction(w, r, "follow") })
	mux.HandleFunc("/api/v1/x/unfollows", func(w http.ResponseWriter, r *http.Request) { h.execAction(w, r, "unfollow") })
	mux.HandleFunc("/api/v1/x/replies", func(w http.ResponseWriter, r *http.Request) { h.execAction(w, r, "reply_tweet") })
	mux.HandleFunc("/api/v1/x/mytweets", func(w http.ResponseWriter, r *http.Request) { h.execAction(w, r, "delete_tweet") })
	mux.HandleFunc("/tweetclaw/open-tab", h.openTab)
	mux.HandleFunc("/tweetclaw/close-tab", h.closeTab)
	mux.HandleFunc("/tweetclaw/navigate-tab", h.navigateTab)
	// AI (aiClaw) 端点
	mux.HandleFunc("/api/v1/ai/status", h.aiStatus)
	mux.HandleFunc("/api/v1/ai/message", h.sendMessage)
	mux.HandleFunc("/api/v1/ai/new_conversation", h.newConversation)
	mux.HandleFunc("/api/v1/ai/navigate", h.navigateToPlatform)

	// ★ 系统端点
	mux.HandleFunc("/api/v1/x/docs", h.apiDocs)
}

func NewHandler(ws *websocket.Server) *Handler {
	baseDir := os.ExpandEnv("$HOME/Library/Application Support/AIHub/tasks")
	taskManager := task.NewManager()
	dataStore := task.NewDataStore(baseDir)
	resultStore := task.NewResultStore(baseDir)

	ws.SetTaskManager(taskManager)

	cleaner := task.NewCleaner(taskManager, dataStore, resultStore)
	cleaner.Start()

	return &Handler{
		ws:          ws,
		taskManager: taskManager,
		dataStore:   dataStore,
		resultStore: resultStore,
	}
}

// ============================================================
// 通用桥接端点实现（所有插件均可使用）
// ============================================================

// pluginList 处理 GET /api/v1/plugins
// 返回所有已连接插件列表，含各实例的 capabilities
func (h *Handler) pluginList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.ws.GetInstances())
}

// pluginInvoke 处理 POST /api/v1/plugins/{clientName}/invoke
// 这是 aihub 的核心通用端点：不知道任何业务逻辑，完全透传 payload
func (h *Handler) pluginInvoke(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, 405, "method_not_allowed")
		return
	}

	// 解析路径：/api/v1/plugins/{clientName}/invoke
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/plugins/"), "/")
	if len(parts) < 2 || parts[1] != "invoke" {
		jsonErr(w, 404, "path must be /api/v1/plugins/{clientName}/invoke")
		return
	}
	clientName := parts[0]

	// 解析 body
	var req struct {
		MessageType string          `json:"messageType"` // 如 "request.query_x_tabs_status"
		InstanceID  string          `json:"instanceId"`  // 可选
		Payload     json.RawMessage `json:"payload"`     // 完全透明，不解析
		TimeoutMs   int             `json:"timeoutMs"`   // 默认 5000
	}
	if err := readJSON(r, &req); err != nil {
		jsonErr(w, 400, err.Error())
		return
	}
	if req.MessageType == "" {
		jsonErr(w, 400, "messageType is required")
		return
	}
	timeoutMs := req.TimeoutMs
	if timeoutMs <= 0 {
		timeoutMs = 5000
	}

	// 封装消息（payload 不解析，原始 JSON 透传）
	id := newID("invoke")
	msg := types.RawMessage{
		ID:        id,
		Type:      types.MessageType(req.MessageType),
		Source:    "aihub",
		Target:    clientName,
		Timestamp: time.Now().UnixMilli(),
		Payload:   req.Payload,
	}

	sess, err := h.ws.ResolveConn(clientName, req.InstanceID)
	if err != nil {
		jsonErr(w, 503, err.Error())
		return
	}

	done := make(chan struct{}, 1)
	h.ws.RegisterCallback(id, sess, func(data []byte) {
		// 返回插件响应的 payload，去掉外层消息封装
		writeRawPayload(w, data)
		done <- struct{}{}
	})
	if err := h.ws.SendJSON(sess, msg); err != nil {
		h.ws.RemoveCallback(id)
		jsonErr(w, 500, "ws_send_failed")
		return
	}
	select {
	case <-done:
	case <-time.After(time.Duration(timeoutMs) * time.Millisecond):
		h.ws.RemoveCallback(id)
		jsonErr(w, 504, fmt.Sprintf("timeout after %ds", timeoutMs/1000))
	}
}

// ============================================================
// 预制快捷端点实现（向后兼容，内部均通过 bridge() 调用）
// ============================================================

// bridge 是核心辅助：发 WS 消息 → 等回调 → 写 HTTP 响应
// 超时后自动返回 504，与 Swift 各端点的 DispatchQueue.asyncAfter 逻辑一致
func (h *Handler) bridge(
	w http.ResponseWriter,
	r *http.Request,
	clientName string,
	msgID string,
	msg interface{},
	timeoutMs int,
	onResp func([]byte),
) {
	// 从 HTTP header 或 query parameter 中提取 instanceId
	instanceId := r.URL.Query().Get("instanceId")
	if instanceId == "" {
		instanceId = r.Header.Get("X-Instance-ID")
	}

	sess, err := h.ws.ResolveConn(clientName, instanceId)
	if err != nil {
		jsonErr(w, 503, err.Error())
		return
	}
	if timeoutMs <= 0 {
		timeoutMs = 5000
	}
	done := make(chan struct{}, 1)
	h.ws.RegisterCallback(msgID, sess, func(data []byte) {
		onResp(data)
		done <- struct{}{}
	})
	if err := h.ws.SendJSON(sess, msg); err != nil {
		h.ws.RemoveCallback(msgID)
		jsonErr(w, 500, "ws_send_failed")
		return
	}
	select {
	case <-done:
	case <-time.After(time.Duration(timeoutMs) * time.Millisecond):
		h.ws.RemoveCallback(msgID)
		jsonErr(w, 504, fmt.Sprintf("timeout after %ds", timeoutMs/1000))
	}
}

// --- tweetClaw 端点 ---

func (h *Handler) xStatus(w http.ResponseWriter, r *http.Request) {
	id := newID("http_x_status")
	h.bridge(w, r, "tweetClaw", id, buildMsg(id, "request.query_x_tabs_status", "tweetClaw", types.EmptyPayload{}), 5000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) xBasicInfo(w http.ResponseWriter, r *http.Request) {
	id := newID("http_x_basic")
	h.bridge(w, r, "tweetClaw", id, buildMsg(id, "request.query_x_basic_info", "tweetClaw", types.EmptyPayload{}), 5000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) timeline(w http.ResponseWriter, r *http.Request) {
	id := newID("http_timeline")
	h.bridge(w, r, "tweetClaw", id, buildMsg(id, "request.query_home_timeline", "tweetClaw",
		types.QuerySearchTimelineRequest{TabID: parseTabID(r)}), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) tweetsDispatch(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		h.execAction(w, r, "post_tweet")
	} else {
		id := newID("http_tweet_detail")
		tweetID := r.URL.Query().Get("tweetId")
		h.bridge(w, r, "tweetClaw", id, buildMsg(id, "request.query_tweet_detail", "tweetClaw",
			types.QueryTweetDetailRequest{TweetID: tweetID, TabID: parseTabID(r)}), 8000,
			func(data []byte) { writeRawPayload(w, data) })
	}
}

func (h *Handler) tweetResourceDispatch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonErr(w, 405, "method_not_allowed")
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/v1/x/tweets/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		jsonErr(w, 404, "not_found")
		return
	}

	tweetID := parts[0]
	switch {
	case len(parts) == 1:
		id := newID("http_tweet")
		h.bridge(w, r, "tweetClaw", id, buildMsg(id, "request.query_tweet_detail", "tweetClaw",
			types.QueryTweetDetailRequest{TweetID: tweetID, TabID: parseTabID(r)}), 8000,
			func(data []byte) { writeRawPayload(w, data) })
	case len(parts) == 2 && parts[1] == "replies":
		id := newID("http_tweet_replies")
		h.bridge(w, r, "tweetClaw", id, buildMsg(id, "request.query_tweet_replies", "tweetClaw",
			types.QueryTweetRepliesRequest{TweetID: tweetID, TabID: parseTabID(r), Cursor: r.URL.Query().Get("cursor")}), 8000,
			func(data []byte) { writeRawPayload(w, data) })
	default:
		jsonErr(w, 404, "not_found")
	}
}

func (h *Handler) userProfile(w http.ResponseWriter, r *http.Request) {
	id := newID("http_user_profile")
	h.bridge(w, r, "tweetClaw", id, buildMsg(id, "request.query_user_profile", "tweetClaw",
		types.QueryUserProfileRequest{ScreenName: r.URL.Query().Get("screenName"), TabID: parseTabID(r)}), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) searchTimeline(w http.ResponseWriter, r *http.Request) {
	id := newID("http_search")
	query := r.URL.Query().Get("query")
	cursor := r.URL.Query().Get("cursor")
	count := 20
	if c := r.URL.Query().Get("count"); c != "" {
		if n, err := strconv.Atoi(c); err == nil && n > 0 {
			count = n
		}
	}

	h.bridge(w, r, "tweetClaw", id, buildMsg(id, "request.query_search_timeline", "tweetClaw",
		types.QuerySearchTimelineRequest{
			TabID:  parseTabID(r),
			Query:  query,
			Cursor: cursor,
			Count:  count,
		}), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) userTweets(w http.ResponseWriter, r *http.Request) {
	id := newID("http_user_tweets")
	userID := r.URL.Query().Get("userId")
	if userID == "" {
		jsonErr(w, 400, "userId is required")
		return
	}
	cursor := r.URL.Query().Get("cursor")
	count := 20
	if c := r.URL.Query().Get("count"); c != "" {
		if n, err := strconv.Atoi(c); err == nil && n > 0 {
			count = n
		}
	}

	h.bridge(w, r, "tweetClaw", id, buildMsg(id, "request.query_user_tweets", "tweetClaw",
		types.QueryUserTweetsRequest{
			UserID: userID,
			TabID:  parseTabID(r),
			Cursor: cursor,
			Count:  count,
		}), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) execAction(w http.ResponseWriter, r *http.Request, action string) {
	var req types.ExecActionRequest
	if r.ContentLength > 0 {
		_ = readJSON(r, &req)
	}
	req.Action = action
	id := newID("http_exec")
	h.bridge(w, r, "tweetClaw", id, buildMsg(id, "request.exec_action", "tweetClaw", req), 15000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) openTab(w http.ResponseWriter, r *http.Request) {
	var req types.OpenTabRequest
	if err := readJSON(r, &req); err != nil {
		jsonErr(w, 400, err.Error())
		return
	}
	id := newID("http_open_tab")
	h.bridge(w, r, "tweetClaw", id, buildMsg(id, "request.open_tab", "tweetClaw", req), 5000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) closeTab(w http.ResponseWriter, r *http.Request) {
	var req types.CloseTabRequest
	if err := readJSON(r, &req); err != nil {
		jsonErr(w, 400, err.Error())
		return
	}
	id := newID("http_close_tab")
	h.bridge(w, r, "tweetClaw", id, buildMsg(id, "request.close_tab", "tweetClaw", req), 5000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) navigateTab(w http.ResponseWriter, r *http.Request) {
	var req types.NavigateTabRequest
	if err := readJSON(r, &req); err != nil {
		jsonErr(w, 400, err.Error())
		return
	}
	id := newID("http_nav_tab")
	h.bridge(w, r, "tweetClaw", id, buildMsg(id, "request.navigate_tab", "tweetClaw", req), 5000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) instances(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	allInstances := h.ws.GetInstances()
	xInstances := make([]websocket.InstanceSnapshot, 0, len(allInstances))
	for _, instance := range allInstances {
		if instance.ClientName == "tweetClaw" {
			xInstances = append(xInstances, instance)
		}
	}
	json.NewEncoder(w).Encode(xInstances)
}

func (h *Handler) apiDocs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonErr(w, 405, "method_not_allowed")
		return
	}

	// 获取可执行文件路径
	execPath, err := os.Executable()
	var bundleResourcePath string
	if err == nil {
		fmt.Printf("[Go] Executable path: %s\n", execPath)
		// 从可执行文件路径推导 Resources 目录
		// 例如: /path/to/OpenHub.app/Contents/MacOS/OpenHub -> /path/to/OpenHub.app/Contents/Resources
		if strings.Contains(execPath, ".app/Contents/MacOS/") {
			bundleResourcePath = strings.Replace(execPath, "/Contents/MacOS/"+filepath.Base(execPath), "/Contents/Resources/api_docs.json", 1)
			fmt.Printf("[Go] Bundle resource path: %s\n", bundleResourcePath)
		}
	}

	candidatePaths := []string{
		bundleResourcePath, // 优先尝试应用包内的 Resources 目录
		"api_docs.json",
		"LocalBridgeMac/api_docs.json",
		os.ExpandEnv("$HOME/aiwithblockchain/aihub/localBridge/apple/LocalBridgeMac/api_docs.json"),
	}

	fmt.Printf("[Go] Trying to load api_docs.json from %d candidate paths\n", len(candidatePaths))
	var data []byte
	for i, path := range candidatePaths {
		if path == "" {
			continue
		}
		fmt.Printf("[Go] [%d] Trying: %s\n", i, path)
		data, err = os.ReadFile(path)
		if err == nil {
			fmt.Printf("[Go] [%d] ✓ Successfully loaded from: %s\n", i, path)
			break
		} else {
			fmt.Printf("[Go] [%d] ✗ Failed: %v\n", i, err)
		}
	}
	if err != nil {
		fmt.Printf("[Go] Error: api_docs.json not found in any candidate location\n")
		jsonErr(w, 404, "api_docs.json not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

// --- aiClaw 端点 ---

func (h *Handler) aiStatus(w http.ResponseWriter, r *http.Request) {
	id := newID("http_ai_status")
	h.bridge(w, r, "aiClaw", id, buildMsg(id, "request.query_ai_tabs_status", "aiClaw", types.EmptyPayload{}), 5000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) sendMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	var req struct {
		Platform  string  `json:"platform"`
		Prompt    string  `json:"prompt"`
		ConvID    *string `json:"conversationId"`
		Model     *string `json:"model"`
		TimeoutMs *int    `json:"timeoutMs"`
	}
	if err := readJSON(r, &req); err != nil {
		jsonErr(w, 400, err.Error())
		return
	}
	timeoutMs := defaultTaskTimeoutMs
	if req.TimeoutMs != nil && *req.TimeoutMs > 1000 {
		timeoutMs = *req.TimeoutMs
	}
	taskID := "task_api_" + shortID()
	id := newID("http_msg")
	payload := types.ExecuteTaskRequestPayload{
		TaskID: taskID, Platform: req.Platform, Action: "send_message",
		Payload: types.SendMessagePromptPayload{Prompt: &req.Prompt, ConversationID: req.ConvID, Model: req.Model},
		Timeout: &timeoutMs,
	}
	h.bridge(w, r, "aiClaw", id, buildMsg(id, "request.execute_task", "aiClaw", payload), timeoutMs,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) newConversation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	var req struct {
		Platform  string  `json:"platform"`
		Model     *string `json:"model"`
		TimeoutMs *int    `json:"timeoutMs"`
	}
	if err := readJSON(r, &req); err != nil {
		jsonErr(w, 400, err.Error())
		return
	}
	timeoutMs := 30_000
	if req.TimeoutMs != nil && *req.TimeoutMs > 1000 {
		timeoutMs = *req.TimeoutMs
	}
	taskID := "task_api_newconv_" + shortID()
	id := newID("http_newconv")
	payload := types.ExecuteTaskRequestPayload{
		TaskID: taskID, Platform: req.Platform, Action: "new_conversation",
		Payload: types.SendMessagePromptPayload{Model: req.Model},
		Timeout: &timeoutMs,
	}
	h.bridge(w, r, "aiClaw", id, buildMsg(id, "request.execute_task", "aiClaw", payload), timeoutMs,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) navigateToPlatform(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	var req struct {
		Platform string `json:"platform"`
	}
	if err := readJSON(r, &req); err != nil {
		jsonErr(w, 400, err.Error())
		return
	}
	if req.Platform != "chatgpt" && req.Platform != "gemini" && req.Platform != "grok" {
		jsonErr(w, 400, "platform must be chatgpt, gemini, or grok")
		return
	}
	id := newID("http_navigate")
	payload := types.NavigateToPlatformPayload{Platform: req.Platform}
	h.bridge(w, r, "aiClaw", id, buildMsg(id, "request.navigate_to_platform", "aiClaw", payload), 5000,
		func(data []byte) { writeRawPayload(w, data) })
}

// --- 工具函数 ---

func buildMsg[T any](id string, msgType types.MessageType, target string, payload T) types.Message[T] {
	return types.Message[T]{
		ID: id, Type: msgType,
		Source: "LocalBridgeGo", Target: target,
		Timestamp: time.Now().UnixMilli(), Payload: payload,
	}
}

func writePayload[T any](w http.ResponseWriter, data []byte) {
	var msg types.Message[T]
	if err := json.Unmarshal(data, &msg); err != nil {
		jsonErr(w, 500, "decode_failed")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(msg.Payload)
}

func writeRawPayload(w http.ResponseWriter, data []byte) {
	var msg struct {
		Payload json.RawMessage `json:"payload"`
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		jsonErr(w, 500, "decode_failed")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(msg.Payload)
}

func jsonErr(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	fmt.Fprintf(w, `{"error":%q}`, msg)
}

func readJSON(r *http.Request, v interface{}) error {
	defer r.Body.Close()
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, v)
}

func newID(prefix string) string { return prefix + "_" + shortID() }
func shortID() string            { return uuid.New().String()[:8] }
func parseTabID(r *http.Request) *int {
	s := r.URL.Query().Get("tabId")
	if s == "" {
		return nil
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return nil
	}
	return &v
}

