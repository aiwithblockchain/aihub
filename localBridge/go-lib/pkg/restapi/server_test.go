package restapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/hyperorchid/localbridge/pkg/websocket"
)

func TestWithCORSPreflight(t *testing.T) {
	handler := withCORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/tasks/task-1/input/0", nil)
	req.Header.Set("Origin", "chrome-extension://kpooeeoeiopfdioegelfapkkloncgbcf")
	req.Header.Set("Access-Control-Request-Method", "GET")
	req.Header.Set("Access-Control-Request-Headers", "X-Client-Name, X-Instance-ID")

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "chrome-extension://kpooeeoeiopfdioegelfapkkloncgbcf" {
		t.Fatalf("unexpected allow origin: %q", got)
	}
	if got := rec.Header().Get("Access-Control-Allow-Headers"); got == "" {
		t.Fatal("missing Access-Control-Allow-Headers")
	}
}

func TestWithCORSPassesThroughNonPreflight(t *testing.T) {
	called := false
	handler := withCORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/tasks/task-1/input/0", nil)
	req.Header.Set("Origin", "chrome-extension://kpooeeoeiopfdioegelfapkkloncgbcf")

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !called {
		t.Fatal("expected wrapped handler to be called")
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "chrome-extension://kpooeeoeiopfdioegelfapkkloncgbcf" {
		t.Fatalf("unexpected allow origin: %q", got)
	}
}

func TestRegisterSharesTaskStateAcrossMuxes(t *testing.T) {
	ws := websocket.NewServer()
	handler := NewHandler(ws)

	mux1 := http.NewServeMux()
	mux2 := http.NewServeMux()
	handler.Register(mux1)
	handler.Register(mux2)

	createBody := []byte(`{"clientName":"tweetClaw","instanceId":"instance-1","taskKind":"x.media_upload","inputMode":"chunked"}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/tasks", bytes.NewReader(createBody))
	createRec := httptest.NewRecorder()
	mux1.ServeHTTP(createRec, createReq)

	if createRec.Code != http.StatusOK {
		t.Fatalf("create task failed: %s", createRec.Body.String())
	}

	var created map[string]any
	if err := json.Unmarshal(createRec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode create response failed: %v", err)
	}
	taskID, _ := created["taskId"].(string)
	if taskID == "" {
		t.Fatal("missing taskId")
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/tasks/"+taskID, nil)
	getRec := httptest.NewRecorder()
	mux2.ServeHTTP(getRec, getReq)

	if getRec.Code != http.StatusOK {
		t.Fatalf("expected second mux to see same task, got %d body=%s", getRec.Code, getRec.Body.String())
	}

	var taskStatus map[string]any
	if err := json.Unmarshal(getRec.Body.Bytes(), &taskStatus); err != nil {
		t.Fatalf("decode get response failed: %v", err)
	}
	if got, _ := taskStatus["taskId"].(string); got != taskID {
		t.Fatalf("expected taskId %s, got %s", taskID, got)
	}
}
