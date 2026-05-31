package restapi

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
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
	mux.HandleFunc("/api/v1/x/followers", h.followers)
	mux.HandleFunc("/api/v1/x/following", h.following)
	mux.HandleFunc("/api/v1/x/blue_verified_followers", h.blueVerifiedFollowers)
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

	// XHS (Xiaohongshu) 端点
	mux.HandleFunc("/api/v1/xhs/account", h.xhsAccountInfo)
	mux.HandleFunc("/api/v1/xhs/homefeed", h.xhsHomefeed)
	mux.HandleFunc("/api/v1/xhs/feed", h.xhsFeed)
	mux.HandleFunc("/api/v1/xhs/search", h.xhsSearch)
	mux.HandleFunc("/api/v1/xhs/user_notes", h.xhsUserNotes)
	mux.HandleFunc("/api/v1/xhs/publish", h.xhsPublish)
	mux.HandleFunc("/api/v1/xhs/publish_video", h.xhsPublishVideo)
	mux.HandleFunc("/api/v1/xhs/comments", h.xhsComments)
	mux.HandleFunc("/api/v1/xhs/user_info", h.xhsUserInfo)
	mux.HandleFunc("/api/v1/xhs/topics", h.xhsTopics)
	mux.HandleFunc("/api/v1/xhs/notifications", h.xhsNotifications)
	mux.HandleFunc("/api/v1/xhs/published_notes", h.xhsPublishedNotes)
	mux.HandleFunc("/api/v1/xhs/search_filter", h.xhsSearchFilter)
	mux.HandleFunc("/api/v1/xhs/comment", h.xhsPostComment)
	mux.HandleFunc("/api/v1/xhs/search_users", h.xhsSearchUsers)
	mux.HandleFunc("/api/v1/xhs/intimacy_list", h.xhsIntimacyList)
	mux.HandleFunc("/api/v1/xhs/like", h.xhsLikeNote)
	mux.HandleFunc("/api/v1/xhs/unlike", h.xhsUnlikeNote)
	mux.HandleFunc("/api/v1/xhs/follow", h.xhsFollowUser)
	mux.HandleFunc("/api/v1/xhs/unfollow", h.xhsUnfollowUser)
	mux.HandleFunc("/api/v1/xhs/delete_comment", h.xhsDeleteComment)

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
	bodyInstanceId := instanceIDFromRequest(r, msg)
	instanceId := bodyInstanceId

	sess, err := h.ws.ResolveConn(clientName, instanceId)
	if err != nil {
		log.Printf("[REST] bridge resolve failed client=%s msgID=%s path=%s instanceId=%q err=%v", clientName, msgID, r.URL.Path, instanceId, err)
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

func instanceIDFromRequest(r *http.Request, msg interface{}) string {
	instanceId := r.URL.Query().Get("instanceId")
	if instanceId != "" {
		return instanceId
	}

	instanceId = r.Header.Get("X-Instance-ID")
	if instanceId != "" {
		return instanceId
	}

	switch payload := msg.(type) {
	case types.RawMessage:
		return instanceIDFromRawPayload(payload.Payload)
	case *types.RawMessage:
		if payload == nil {
			return ""
		}
		return instanceIDFromRawPayload(payload.Payload)
	case types.Message[types.OpenTabRequest]:
		return payload.Payload.InstanceID
	case *types.Message[types.OpenTabRequest]:
		if payload == nil {
			return ""
		}
		return payload.Payload.InstanceID
	case types.Message[types.CloseTabRequest]:
		return payload.Payload.InstanceID
	case *types.Message[types.CloseTabRequest]:
		if payload == nil {
			return ""
		}
		return payload.Payload.InstanceID
	case types.Message[types.NavigateTabRequest]:
		return payload.Payload.InstanceID
	case *types.Message[types.NavigateTabRequest]:
		if payload == nil {
			return ""
		}
		return payload.Payload.InstanceID
	default:
		return ""
	}
}

func instanceIDFromRawPayload(payload json.RawMessage) string {
	var body struct {
		InstanceID string `json:"instanceId"`
	}
	if err := json.Unmarshal(payload, &body); err != nil {
		log.Printf("[REST] instanceIDFromRawPayload unmarshal failed: %v", err)
		return ""
	}
	return body.InstanceID
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
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "request.query_home_timeline", "tweetClaw", queryToMap(r)), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) tweetsDispatch(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		body, err := readRawBody(r)
		if err != nil {
			jsonErr(w, 400, err.Error())
			return
		}
		id := newID("http_exec")
		h.bridge(w, r, "tweetClaw", id, buildRawMsgFromBytes(id, "request.exec_action", "tweetClaw", body), 8000,
			func(data []byte) { writeRawPayload(w, data) })
	} else {
		id := newID("http_tweet_detail")
		h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "request.query_tweet_detail", "tweetClaw", queryToMap(r)), 8000,
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
	payload := queryToMap(r)
	payload["tweetId"] = tweetID

	switch {
	case len(parts) == 1:
		id := newID("http_tweet")
		h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "request.query_tweet_detail", "tweetClaw", payload), 8000,
			func(data []byte) { writeRawPayload(w, data) })
	case len(parts) == 2 && parts[1] == "replies":
		id := newID("http_tweet_replies")
		h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "request.query_tweet_replies", "tweetClaw", payload), 8000,
			func(data []byte) { writeRawPayload(w, data) })
	default:
		jsonErr(w, 404, "not_found")
	}
}

func (h *Handler) userProfile(w http.ResponseWriter, r *http.Request) {
	id := newID("http_user_profile")
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "request.query_user_profile", "tweetClaw", queryToMap(r)), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) searchTimeline(w http.ResponseWriter, r *http.Request) {
	id := newID("http_search")
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "request.query_search_timeline", "tweetClaw", queryToMap(r)), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) userTweets(w http.ResponseWriter, r *http.Request) {
	id := newID("http_user_tweets")
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "request.query_user_tweets", "tweetClaw", queryToMap(r)), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) followers(w http.ResponseWriter, r *http.Request) {
	id := newID("http_followers")
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "request.query_followers", "tweetClaw", queryToMap(r)), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) following(w http.ResponseWriter, r *http.Request) {
	id := newID("http_following")
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "request.query_following", "tweetClaw", queryToMap(r)), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) blueVerifiedFollowers(w http.ResponseWriter, r *http.Request) {
	id := newID("http_blue_verified_followers")
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "request.query_blue_verified_followers", "tweetClaw", queryToMap(r)), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) execAction(w http.ResponseWriter, r *http.Request, action string) {
	body, err := readRawBody(r)
	if err != nil {
		jsonErr(w, 400, err.Error())
		return
	}
	id := newID("http_exec")
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "request.exec_action", "tweetClaw", mergeAction(body, action)), 15000,
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

// NewAPIDocsHandler 返回一个 /api/v1/x/docs 的 http.HandlerFunc。
// candidates 由各二进制的 main.go 传入，按优先级从高到低依次尝试。
func NewAPIDocsHandler(candidates []string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			jsonErr(w, 405, "method_not_allowed")
			return
		}

		var data []byte
		var lastErr error
		for _, path := range candidates {
			if path == "" {
				continue
			}
			var err error
			data, err = os.ReadFile(path)
			if err == nil {
				log.Printf("[REST] api_docs loaded from: %s", path)
				break
			}
			lastErr = err
		}
		if data == nil {
			log.Printf("[REST] api_docs not found, last error: %v", lastErr)
			jsonErr(w, 404, "api_docs not found")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write(data)
	}
}

// --- XHS (Xiaohongshu) 端点 ---

func (h *Handler) xhsAccountInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	id := newID("http_xhs_account")
	h.bridge(w, r, "tweetClaw", id, buildMsg(id, "command.query_xhs_account_info", "tweetClaw", types.EmptyPayload{}), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) xhsHomefeed(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	id := newID("http_xhs_homefeed")
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "command.query_xhs_homefeed", "tweetClaw", queryToMap(r)), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) xhsFeed(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	id := newID("http_xhs_feed")
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "command.query_xhs_feed", "tweetClaw", queryToMap(r)), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) xhsSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	body, err := readRawBody(r)
	if err != nil {
		jsonErr(w, 400, err.Error())
		return
	}
	id := newID("http_xhs_search")
	h.bridge(w, r, "tweetClaw", id, buildRawMsgFromBytes(id, "command.query_xhs_search", "tweetClaw", body), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) xhsUserNotes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	id := newID("http_xhs_user_notes")
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "command.query_xhs_user_notes", "tweetClaw", queryToMap(r)), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) xhsPublish(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	body, err := readRawBody(r)
	if err != nil {
		jsonErr(w, 400, err.Error())
		return
	}
	id := newID("http_xhs_publish")
	h.bridge(w, r, "tweetClaw", id, buildRawMsgFromBytes(id, "command.xhs_publish_image_note", "tweetClaw", body), 30000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) xhsComments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	id := newID("http_xhs_comments")
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "command.xhs_get_note_comments", "tweetClaw", queryToMap(r)), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) xhsUserInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	id := newID("http_xhs_user_info")
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "command.xhs_get_user_info", "tweetClaw", queryToMap(r)), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) xhsTopics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	id := newID("http_xhs_topics")
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "command.xhs_search_topics", "tweetClaw", queryToMap(r)), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) xhsNotifications(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	id := newID("http_xhs_notifications")
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "command.xhs_get_notifications", "tweetClaw", queryToMap(r)), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) xhsPublishedNotes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	id := newID("http_xhs_published_notes")
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "command.xhs_get_published_notes", "tweetClaw", queryToMap(r)), 35000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) xhsPublishVideo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	body, err := readRawBody(r)
	if err != nil {
		jsonErr(w, 400, err.Error())
		return
	}
	id := newID("http_xhs_publish_video")
	// 视频上传耗时较长，timeout 设为 120 秒
	h.bridge(w, r, "tweetClaw", id, buildRawMsgFromBytes(id, "command.xhs_publish_video_note", "tweetClaw", body), 120000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) xhsSearchFilter(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	id := newID("http_xhs_search_filter")
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "command.xhs_search_filter", "tweetClaw", queryToMap(r)), 8000,
		func(data []byte) { writeRawPayload(w, data) })
}

func (h *Handler) xhsPostComment(w http.ResponseWriter, r *http.Request) {
	log.Printf("[xhsPostComment] received request method=%s", r.Method)
	if r.Method != http.MethodPost {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	body, err := readRawBody(r)
	if err != nil {
		log.Printf("[xhsPostComment] failed to read body: %v", err)
		jsonErr(w, 400, err.Error())
		return
	}
	log.Printf("[xhsPostComment] raw body: %s", string(body))
	id := newID("http_xhs_post_comment")
	log.Printf("[xhsPostComment] sending to tweetClaw: id=%s", id)
	h.bridge(w, r, "tweetClaw", id, buildRawMsgFromBytes(id, "command.xhs_post_comment", "tweetClaw", body), 15000,
		func(data []byte) {
			log.Printf("[xhsPostComment] received response len=%d", len(data))
			writeRawPayload(w, data)
		})
}

func (h *Handler) xhsSearchUsers(w http.ResponseWriter, r *http.Request) {
	log.Printf("[xhsSearchUsers] received request method=%s", r.Method)
	if r.Method != http.MethodGet {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	id := newID("http_xhs_search_users")
	log.Printf("[xhsSearchUsers] sending to tweetClaw: id=%s query=%v", id, r.URL.Query())
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "command.xhs_search_users", "tweetClaw", queryToMap(r)), 8000,
		func(data []byte) {
			log.Printf("[xhsSearchUsers] received response len=%d", len(data))
			writeRawPayload(w, data)
		})
}

func (h *Handler) xhsIntimacyList(w http.ResponseWriter, r *http.Request) {
	log.Printf("[xhsIntimacyList] received request method=%s", r.Method)
	if r.Method != http.MethodGet {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	id := newID("http_xhs_intimacy_list")
	log.Printf("[xhsIntimacyList] sending to tweetClaw: id=%s", id)
	h.bridge(w, r, "tweetClaw", id, buildRawMsg(id, "command.xhs_get_intimacy_list", "tweetClaw", nil), 8000,
		func(data []byte) {
			log.Printf("[xhsIntimacyList] received response len=%d", len(data))
			writeRawPayload(w, data)
		})
}

func (h *Handler) xhsLikeNote(w http.ResponseWriter, r *http.Request) {
	log.Printf("[xhsLikeNote] received request method=%s", r.Method)
	if r.Method != http.MethodPost {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	body, err := readRawBody(r)
	if err != nil {
		log.Printf("[xhsLikeNote] failed to read body: %v", err)
		jsonErr(w, 400, err.Error())
		return
	}
	log.Printf("[xhsLikeNote] raw body: %s", string(body))
	id := newID("http_xhs_like_note")
	log.Printf("[xhsLikeNote] sending to tweetClaw: id=%s", id)
	h.bridge(w, r, "tweetClaw", id, buildRawMsgFromBytes(id, "command.xhs_like_note", "tweetClaw", body), 15000,
		func(data []byte) {
			log.Printf("[xhsLikeNote] received response len=%d", len(data))
			writeRawPayload(w, data)
		})
}

func (h *Handler) xhsUnlikeNote(w http.ResponseWriter, r *http.Request) {
	log.Printf("[xhsUnlikeNote] received request method=%s", r.Method)
	if r.Method != http.MethodPost {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	body, err := readRawBody(r)
	if err != nil {
		log.Printf("[xhsUnlikeNote] failed to read body: %v", err)
		jsonErr(w, 400, err.Error())
		return
	}
	log.Printf("[xhsUnlikeNote] raw body: %s", string(body))
	id := newID("http_xhs_unlike_note")
	log.Printf("[xhsUnlikeNote] sending to tweetClaw: id=%s", id)
	h.bridge(w, r, "tweetClaw", id, buildRawMsgFromBytes(id, "command.xhs_unlike_note", "tweetClaw", body), 15000,
		func(data []byte) {
			log.Printf("[xhsUnlikeNote] received response len=%d", len(data))
			writeRawPayload(w, data)
		})
}

func (h *Handler) xhsFollowUser(w http.ResponseWriter, r *http.Request) {
	log.Printf("[xhsFollowUser] received request method=%s", r.Method)
	if r.Method != http.MethodPost {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	body, err := readRawBody(r)
	if err != nil {
		log.Printf("[xhsFollowUser] failed to read body: %v", err)
		jsonErr(w, 400, err.Error())
		return
	}
	log.Printf("[xhsFollowUser] raw body: %s", string(body))
	id := newID("http_xhs_follow_user")
	log.Printf("[xhsFollowUser] sending to tweetClaw: id=%s", id)
	h.bridge(w, r, "tweetClaw", id, buildRawMsgFromBytes(id, "command.xhs_follow_user", "tweetClaw", body), 15000,
		func(data []byte) {
			log.Printf("[xhsFollowUser] received response len=%d", len(data))
			writeRawPayload(w, data)
		})
}

func (h *Handler) xhsUnfollowUser(w http.ResponseWriter, r *http.Request) {
	log.Printf("[xhsUnfollowUser] received request method=%s", r.Method)
	if r.Method != http.MethodPost {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	body, err := readRawBody(r)
	if err != nil {
		log.Printf("[xhsUnfollowUser] failed to read body: %v", err)
		jsonErr(w, 400, err.Error())
		return
	}
	log.Printf("[xhsUnfollowUser] raw body: %s", string(body))
	id := newID("http_xhs_unfollow_user")
	log.Printf("[xhsUnfollowUser] sending to tweetClaw: id=%s", id)
	h.bridge(w, r, "tweetClaw", id, buildRawMsgFromBytes(id, "command.xhs_unfollow_user", "tweetClaw", body), 15000,
		func(data []byte) {
			log.Printf("[xhsUnfollowUser] received response len=%d", len(data))
			writeRawPayload(w, data)
		})
}

func (h *Handler) xhsDeleteComment(w http.ResponseWriter, r *http.Request) {
	log.Printf("[xhsDeleteComment] received request method=%s", r.Method)
	if r.Method != http.MethodPost {
		jsonErr(w, 405, "method_not_allowed")
		return
	}
	body, err := readRawBody(r)
	if err != nil {
		log.Printf("[xhsDeleteComment] failed to read body: %v", err)
		jsonErr(w, 400, err.Error())
		return
	}
	log.Printf("[xhsDeleteComment] raw body: %s", string(body))
	id := newID("http_xhs_delete_comment")
	log.Printf("[xhsDeleteComment] sending to tweetClaw: id=%s", id)
	h.bridge(w, r, "tweetClaw", id, buildRawMsgFromBytes(id, "command.xhs_delete_comment", "tweetClaw", body), 15000,
		func(data []byte) {
			log.Printf("[xhsDeleteComment] received response len=%d", len(data))
			writeRawPayload(w, data)
		})
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

func buildRawMsg(id string, msgType types.MessageType, target string, payload interface{}) types.RawMessage {
	payloadBytes, _ := json.Marshal(payload)
	return types.RawMessage{
		ID:        id,
		Type:      msgType,
		Source:    "LocalBridgeGo",
		Target:    target,
		Timestamp: time.Now().UnixMilli(),
		Payload:   json.RawMessage(payloadBytes),
	}
}

// buildRawMsgFromBytes 用于已经是 json.RawMessage 的 payload，避免二次 Marshal
func buildRawMsgFromBytes(id string, msgType types.MessageType, target string, payload json.RawMessage) types.RawMessage {
	return types.RawMessage{
		ID:        id,
		Type:      msgType,
		Source:    "LocalBridgeGo",
		Target:    target,
		Timestamp: time.Now().UnixMilli(),
		Payload:   payload,
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

// queryToMap 将 URL query string 所有参数转为 map，供 GET 端点透传
func queryToMap(r *http.Request) map[string]interface{} {
	m := make(map[string]interface{})
	for k, v := range r.URL.Query() {
		if k == "instanceId" {
			continue // instanceId 由 bridge 层单独处理
		}
		if len(v) == 1 {
			m[k] = v[0]
		} else {
			m[k] = v
		}
	}
	return m
}

// readRawBody 读取 request body 为 json.RawMessage，供 POST 端点透传
func readRawBody(r *http.Request) (json.RawMessage, error) {
	defer r.Body.Close()
	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, err
	}
	if len(data) == 0 {
		return json.RawMessage("{}"), nil
	}
	return json.RawMessage(data), nil
}

// mergeAction 将 action 字段注入到透传的 JSON payload 中
func mergeAction(body json.RawMessage, action string) map[string]interface{} {
	var m map[string]interface{}
	_ = json.Unmarshal(body, &m)
	if m == nil {
		m = make(map[string]interface{})
	}
	m["action"] = action
	return m
}

func newID(prefix string) string { return prefix + "_" + shortID() }
func shortID() string            { return uuid.New().String()[:8] }

