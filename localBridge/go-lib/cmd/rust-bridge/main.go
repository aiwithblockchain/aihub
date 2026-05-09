package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"sync"
	"unsafe"

	"github.com/hyperorchid/localbridge/pkg/bridge"
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

func registerRustBridgeRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/x/oauth/access-token", handleXOAuthAccessToken)
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

func resolveXOAuthAccessToken(twitterID string) (*xOAuthAccessTokenResponse, error) {
	if strings.TrimSpace(twitterID) == "" {
		return nil, errors.New("twitter_id is required")
	}
	return nil, errors.New("not implemented")
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

func main() {}
