package main

/*
#include <stdlib.h>

typedef const char *(*resolve_x_oauth_access_token_fn)(const char *twitter_id);
typedef void (*free_x_oauth_access_token_fn)(const char *value);
typedef const char *(*handle_x_oauth_callback_fn)(const char *query_json);
typedef void (*free_x_oauth_callback_fn)(const char *value);
typedef const char *(*feishu_send_fn)(const char *text_json);
typedef void (*free_feishu_send_fn)(const char *value);

static inline const char *call_resolve_x_oauth_access_token_fn(resolve_x_oauth_access_token_fn fn, const char *twitter_id) {
	if (fn == NULL) {
		return NULL;
	}
	return fn(twitter_id);
}

static inline const char *call_handle_x_oauth_callback_fn(handle_x_oauth_callback_fn fn, const char *query_json) {
	if (fn == NULL) {
		return NULL;
	}
	return fn(query_json);
}

static inline const char *call_feishu_send_fn(feishu_send_fn fn, const char *text_json) {
	if (fn == NULL) {
		return NULL;
	}
	return fn(text_json);
}

static inline void call_free_x_oauth_access_token_fn(free_x_oauth_access_token_fn fn, const char *value) {
	if (fn == NULL || value == NULL) {
		return;
	}
	fn(value);
}

static inline void call_free_x_oauth_callback_fn(free_x_oauth_callback_fn fn, const char *value) {
	if (fn == NULL || value == NULL) {
		return;
	}
	fn(value);
}

static inline void call_free_feishu_send_fn(free_feishu_send_fn fn, const char *value) {
	if (fn == NULL || value == NULL) {
		return;
	}
	fn(value);
}
*/
import "C"
import (
	"encoding/json"
	"errors"
	"html"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"unsafe"

	"github.com/hyperorchid/localbridge/pkg/bridge"
	"github.com/hyperorchid/localbridge/pkg/restapi"
)

const maxLogLines = 2000

var logBuf struct {
	mu    sync.Mutex
	lines []string
}

var bridgeState struct {
	mu      sync.Mutex
	lastErr string
}

type bridgeLogWriter struct{}

type cgoXOAuthResolver struct {
	accessToken       C.resolve_x_oauth_access_token_fn
	freeAccessToken   C.free_x_oauth_access_token_fn
	oauthCallback     C.handle_x_oauth_callback_fn
	freeOAuthCallback C.free_x_oauth_callback_fn
}

var xResolver = &cgoXOAuthResolver{}

// feishu 主动发消息 cgo 回调持有
var feishuSender struct {
	mu     sync.Mutex
	fn     C.feishu_send_fn
	freeFn C.free_feishu_send_fn
}

type feishuSendRequest struct {
	Text string `json:"text"`
}

type feishuSendResponse struct {
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

type xOAuthAccessTokenRequest struct {
	TwitterID string `json:"twitter_id"`
}

type xOAuthAccessTokenResponse struct {
	TwitterID     string `json:"twitter_id"`
	AccessToken   string `json:"access_token"`
	TokenType     string `json:"token_type"`
	ExpiresAt     *int64 `json:"expires_at,omitempty"`
	AccountSource string `json:"account_source"`
}

type xOAuthCallbackRequest struct {
	Code             string `json:"code,omitempty"`
	State            string `json:"state,omitempty"`
	Error            string `json:"error,omitempty"`
	ErrorDescription string `json:"error_description,omitempty"`
}

type xOAuthCallbackResponse struct {
	OK          bool   `json:"ok"`
	HTML        string `json:"html,omitempty"`
	ContentType string `json:"content_type,omitempty"`
	Error       string `json:"error,omitempty"`
}

func (bridgeLogWriter) Write(p []byte) (int, error) {
	line := strings.TrimRight(string(p), "\n")
	logBuf.mu.Lock()
	logBuf.lines = append(logBuf.lines, line)
	if len(logBuf.lines) > maxLogLines {
		logBuf.lines = logBuf.lines[len(logBuf.lines)-maxLogLines:]
	}
	logBuf.mu.Unlock()
	return len(p), nil
}

func (r cgoXOAuthResolver) ResolveXOAuthAccessToken(twitterID string) string {
	if r.accessToken == nil {
		return ""
	}

	cTwitterID := C.CString(twitterID)
	defer C.free(unsafe.Pointer(cTwitterID))

	resolved := C.call_resolve_x_oauth_access_token_fn(r.accessToken, cTwitterID)
	if resolved == nil {
		return ""
	}

	value := C.GoString(resolved)
	C.call_free_x_oauth_access_token_fn(r.freeAccessToken, resolved)
	return value
}

func (h cgoXOAuthResolver) HandleXOAuthCallback(queryJSON string) string {
	if h.oauthCallback == nil {
		return ""
	}

	cQueryJSON := C.CString(queryJSON)
	defer C.free(unsafe.Pointer(cQueryJSON))

	resolved := C.call_handle_x_oauth_callback_fn(h.oauthCallback, cQueryJSON)
	if resolved == nil {
		return ""
	}

	value := C.GoString(resolved)
	C.call_free_x_oauth_callback_fn(h.freeOAuthCallback, resolved)
	return value
}

func init() {
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)
	log.SetOutput(bridgeLogWriter{})
}

func setLastErr(msg string) {
	bridgeState.mu.Lock()
	defer bridgeState.mu.Unlock()
	bridgeState.lastErr = msg
}

func getLastErr() string {
	bridgeState.mu.Lock()
	defer bridgeState.mu.Unlock()
	return bridgeState.lastErr
}

// rustBridgeAPIDocsCandidates 返回 rust-bridge 专属的 api_docs 候选路径。
// rust-bridge 以静态库形式链接进 TweetPilot，TweetPilot 启动时 resource_installer
// 已将 resources/tweetpilot-home/ 下的文件同步到 ~/.tweetpilot/，因此直接读用户目录即可，
// 无需推导 .app bundle 路径，且同样适用于 Windows（USERPROFILE\.tweetpilot）。
func rustBridgeAPIDocsCandidates() []string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil
	}
	return []string{
		filepath.Join(homeDir, ".tweetpilot", "rust_bridge_api_docs.json"),
	}
}

func registerRustBridgeRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/x/docs", restapi.NewAPIDocsHandler(rustBridgeAPIDocsCandidates()))
	mux.HandleFunc("/api/v1/x/oauth/access-token", handleXOAuthAccessToken)
	mux.HandleFunc("/oauth/callback", handleXOAuthCallback)
	mux.HandleFunc("/api/v1/feishu/send", handleFeishuSend)
}

func handleXOAuthAccessToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method_not_allowed")
		return
	}

	var req xOAuthAccessTokenRequest
	if err := decodeJSONBody(r, &req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if strings.TrimSpace(req.TwitterID) == "" {
		writeJSONError(w, http.StatusBadRequest, "invalid_request")
		return
	}

	response, err := resolveXOAuthAccessToken(req.TwitterID)
	if err != nil {
		writeJSONError(w, http.StatusServiceUnavailable, "token_unavailable")
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func handleXOAuthCallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(w, http.MethodGet)
		return
	}

	response, err := forwardXOAuthCallback(r)
	if err != nil {
		writeHTML(w, http.StatusServiceUnavailable, defaultXOAuthCallbackHTML(false, err.Error()))
		return
	}

	status := http.StatusOK
	if !response.OK {
		status = http.StatusBadRequest
	}

	contentType := strings.TrimSpace(response.ContentType)
	if contentType == "" {
		contentType = "text/html; charset=utf-8"
	}

	body := response.HTML
	if strings.TrimSpace(body) == "" {
		body = defaultXOAuthCallbackHTML(response.OK, response.Error)
	}

	w.Header().Set("Content-Type", contentType)
	w.WriteHeader(status)
	_, _ = w.Write([]byte(body))
}

func resolveXOAuthAccessToken(twitterID string) (*xOAuthAccessTokenResponse, error) {
	if strings.TrimSpace(twitterID) == "" {
		return nil, errors.New("twitter_id is required")
	}
	if xResolver.accessToken == nil {
		return nil, errors.New("resolver_unavailable")
	}

	payload := strings.TrimSpace(xResolver.ResolveXOAuthAccessToken(twitterID))
	if payload == "" {
		return nil, errors.New("token_unavailable")
	}

	var response xOAuthAccessTokenResponse
	if err := json.Unmarshal([]byte(payload), &response); err != nil {
		return nil, err
	}
	if strings.TrimSpace(response.AccessToken) == "" {
		return nil, errors.New("token_unavailable")
	}
	return &response, nil
}

func forwardXOAuthCallback(r *http.Request) (*xOAuthCallbackResponse, error) {
	if xResolver.oauthCallback == nil {
		return nil, errors.New("callback_handler_unavailable")
	}

	requestPayload, err := json.Marshal(xOAuthCallbackRequest{
		Code:             strings.TrimSpace(r.URL.Query().Get("code")),
		State:            strings.TrimSpace(r.URL.Query().Get("state")),
		Error:            strings.TrimSpace(r.URL.Query().Get("error")),
		ErrorDescription: strings.TrimSpace(r.URL.Query().Get("error_description")),
	})
	if err != nil {
		return nil, err
	}

	payload := strings.TrimSpace(xResolver.HandleXOAuthCallback(string(requestPayload)))
	if payload == "" {
		return nil, errors.New("callback_handler_unavailable")
	}

	var response xOAuthCallbackResponse
	if err := json.Unmarshal([]byte(payload), &response); err != nil {
		return nil, err
	}
	return &response, nil
}

func defaultXOAuthCallbackHTML(ok bool, message string) string {
	title := "X OAuth 登录失败"
	body := "请返回 TweetPilot 重试。"
	if ok {
		title = "X OAuth 登录成功"
		body = "你可以关闭此页面并返回 TweetPilot。"
	} else if strings.TrimSpace(message) != "" {
		body = html.EscapeString(message)
	}

	return "<!doctype html><html><head><meta charset=\"utf-8\"><title>" + title + "</title></head><body><h1>" + title + "</h1><p>" + body + "</p></body></html>"
}

func decodeJSONBody(r *http.Request, v interface{}) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	if status == http.StatusMethodNotAllowed {
		w.Header().Set("Allow", http.MethodPost)
	}
	writeJSON(w, status, map[string]string{"error": message})
}

func writeMethodNotAllowed(w http.ResponseWriter, method string) {
	w.Header().Set("Allow", method)
	writeHTML(w, http.StatusMethodNotAllowed, "method not allowed")
}

func writeHTML(w http.ResponseWriter, status int, body string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(body))
}

//export LocalBridgeStart
func LocalBridgeStart() C.int {
	if err := bridge.StartDefaultWithRESTRegistrar(registerRustBridgeRoutes); err != nil {
		setLastErr(err.Error())
		return -1
	}
	setLastErr("")
	return 0
}

//export LocalBridgeStop
func LocalBridgeStop() {
	bridge.StopDefault()
}

//export LocalBridgeGetInstancesJSON
func LocalBridgeGetInstancesJSON() *C.char {
	instances := bridge.GetDefaultInstances()
	data, err := json.Marshal(instances)
	if err != nil {
		setLastErr(err.Error())
		return C.CString("[]")
	}
	return C.CString(string(data))
}

//export LocalBridgeGetLastErrorJSON
func LocalBridgeGetLastErrorJSON() *C.char {
	data, _ := json.Marshal(map[string]any{"error": getLastErr()})
	return C.CString(string(data))
}

//export LocalBridgeFreeString
func LocalBridgeFreeString(s *C.char) {
	C.free(unsafe.Pointer(s))
}

//export LocalBridgeGetLogsJSON
func LocalBridgeGetLogsJSON() *C.char {
	logBuf.mu.Lock()
	snapshot := make([]string, len(logBuf.lines))
	copy(snapshot, logBuf.lines)
	logBuf.mu.Unlock()

	data, err := json.Marshal(snapshot)
	if err != nil {
		return C.CString("[]")
	}
	return C.CString(string(data))
}

//export SetXOAuthAccessTokenResolver
func SetXOAuthAccessTokenResolver(
	resolver C.resolve_x_oauth_access_token_fn,
	freeFn C.free_x_oauth_access_token_fn,
) {
	if resolver == nil {
		xResolver.accessToken = nil
		xResolver.freeAccessToken = nil
		return
	}
	xResolver.accessToken = resolver
	xResolver.freeAccessToken = freeFn
}

//export SetXOAuthCallbackHandler
func SetXOAuthCallbackHandler(
	handler C.handle_x_oauth_callback_fn,
	freeFn C.free_x_oauth_callback_fn,
) {
	if handler == nil {
		xResolver.oauthCallback = nil
		xResolver.freeOAuthCallback = nil
		return
	}
	xResolver.oauthCallback = handler
	xResolver.freeOAuthCallback = freeFn
}

// handleFeishuSend 处理 POST /api/v1/feishu/send 请求。
// 接收 {"text":"..."} 并通过 cgo 回调转发给 Rust feishu_bridge::agent::send_to_last_chat。
func handleFeishuSend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method_not_allowed")
		return
	}

	var req feishuSendRequest
	if err := decodeJSONBody(r, &req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if strings.TrimSpace(req.Text) == "" {
		writeJSONError(w, http.StatusBadRequest, "text_required")
		return
	}

	feishuSender.mu.Lock()
	fn := feishuSender.fn
	freeFn := feishuSender.freeFn
	feishuSender.mu.Unlock()

	if fn == nil {
		log.Printf("[rust-bridge] feishu send: handler not registered")
		writeJSON(w, http.StatusServiceUnavailable, feishuSendResponse{OK: false, Error: "handler_not_registered"})
		return
	}

	// 序列化为 JSON 传给 Rust
	payload, err := json.Marshal(req)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, feishuSendResponse{OK: false, Error: "marshal_error"})
		return
	}

	cPayload := C.CString(string(payload))
	defer C.free(unsafe.Pointer(cPayload))

	result := C.call_feishu_send_fn(fn, cPayload)
	if result == nil {
		writeJSON(w, http.StatusServiceUnavailable, feishuSendResponse{OK: false, Error: "null_response"})
		return
	}

	resultStr := C.GoString(result)
	C.call_free_feishu_send_fn(freeFn, result)

	log.Printf("[rust-bridge] feishu send result: %s", resultStr)

	var resp feishuSendResponse
	if err := json.Unmarshal([]byte(resultStr), &resp); err != nil {
		writeJSON(w, http.StatusInternalServerError, feishuSendResponse{OK: false, Error: "parse_response_error"})
		return
	}

	if resp.OK {
		writeJSON(w, http.StatusOK, resp)
	} else {
		writeJSON(w, http.StatusServiceUnavailable, resp)
	}
}

//export SetFeishuSendHandler
func SetFeishuSendHandler(
	fn C.feishu_send_fn,
	freeFn C.free_feishu_send_fn,
) {
	feishuSender.mu.Lock()
	defer feishuSender.mu.Unlock()
	feishuSender.fn = fn
	feishuSender.freeFn = freeFn
	if fn == nil {
		log.Printf("[rust-bridge] feishu send handler unregistered")
	} else {
		log.Printf("[rust-bridge] feishu send handler registered")
	}
}

func main() {}
