package task_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	gorillaws "github.com/gorilla/websocket"
	"github.com/hyperorchid/localbridge/pkg/restapi"
	"github.com/hyperorchid/localbridge/pkg/task"
	"github.com/hyperorchid/localbridge/pkg/types"
	"github.com/hyperorchid/localbridge/pkg/websocket"
)

func TestTaskFullLifecycle(t *testing.T) {
	// Setup Core
	baseDir := os.ExpandEnv("$HOME/Library/Application Support/AIHub/tasks_test")
	defer os.RemoveAll(baseDir)

	manager := task.NewManager()
	dataStore := task.NewDataStore(baseDir)
	resultStore := task.NewResultStore(baseDir)
	ws := websocket.NewServer()
	ws.SetTaskManager(manager)

	taskHandler := restapi.NewTaskHandler(ws, manager, dataStore, resultStore)

	// 1. Create Task
	req := task.CreateTaskRequest{
		ClientName: "testClient",
		InstanceID: "testInstance",
		TaskKind:   "mock_task",
		InputMode:  "chunked",
	}
	body, _ := json.Marshal(req)
	hreq := httptest.NewRequest(http.MethodPost, "/api/v1/tasks", bytes.NewReader(body))
	w := httptest.NewRecorder()
	taskHandler.CreateTask(w, hreq)

	if w.Result().StatusCode != 200 {
		t.Fatalf("CreateTask failed: %s", w.Body.String())
	}

	var res map[string]interface{}
	json.NewDecoder(w.Body).Decode(&res)
	taskID := res["taskId"].(string)

	if taskID == "" {
		t.Fatalf("missing taskID")
	}

	// 2. Write Input Part
	hreq = httptest.NewRequest(http.MethodPut, "/api/v1/tasks/"+taskID+"/input/0", bytes.NewReader([]byte("chunked-data")))
	w = httptest.NewRecorder()
	taskHandler.WriteInputPart(w, hreq, taskID, 0)
	if w.Result().StatusCode != 200 {
		t.Fatalf("WriteInputPart failed: %d", w.Result().StatusCode)
	}

	// 3. Seal Input
	sealReq := map[string]interface{}{
		"totalParts":  1,
		"totalBytes":  12,
		"contentType": "text/plain",
	}
	sealBody, _ := json.Marshal(sealReq)
	hreq = httptest.NewRequest(http.MethodPost, "/api/v1/tasks/"+taskID+"/seal", bytes.NewReader(sealBody))
	w = httptest.NewRecorder()
	taskHandler.SealInput(w, hreq, taskID)
	if w.Result().StatusCode != 200 {
		t.Fatalf("SealInput failed: %s", w.Body.String())
	}

	// Simulate starting and running for testing (since we don't mock websocket connections explicitly here for start_task dispatch logic success)
	if err := manager.MarkStarting(taskID); err != nil {
		t.Fatalf("MarkStarting failed: %v", err)
	}
	if err := manager.MarkRunning(taskID, "processing", 1.0); err != nil {
		t.Fatalf("MarkRunning failed: %v", err)
	}

	// 4. Upload Result
	hreq = httptest.NewRequest(http.MethodPost, "/api/v1/tasks/"+taskID+"/result", bytes.NewReader([]byte("result_val")))
	hreq.Header.Set("X-Client-Name", "testClient")
	hreq.Header.Set("X-Instance-ID", "testInstance")
	hreq.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	taskHandler.UploadResult(w, hreq, taskID)

	if w.Result().StatusCode != 200 {
		t.Fatalf("UploadResult failed: %s", w.Body.String())
	}

	var uploadRes map[string]interface{}
	json.NewDecoder(w.Body).Decode(&uploadRes)
	ref := uploadRes["resultRef"].(string)

	if err := manager.MarkCompleted(taskID, ref); err != nil {
		t.Fatalf("MarkCompleted failed: %v", err)
	}

	// 5. Get Result
	hreq = httptest.NewRequest(http.MethodGet, "/api/v1/tasks/"+taskID+"/result", nil)
	w = httptest.NewRecorder()
	taskHandler.GetResult(w, hreq, taskID)

	if w.Result().StatusCode != 200 {
		t.Fatalf("GetResult failed")
	}

	if w.Body.String() != "result_val" {
		t.Fatalf("bad result content")
	}
}

func TestOwnerAuthRejection(t *testing.T) {
	baseDir := os.ExpandEnv("$HOME/Library/Application Support/AIHub/tasks_test_auth")
	defer os.RemoveAll(baseDir)
	manager := task.NewManager()
	dataStore := task.NewDataStore(baseDir)
	resultStore := task.NewResultStore(baseDir)
	ws := websocket.NewServer()
	ws.SetTaskManager(manager)
	taskHandler := restapi.NewTaskHandler(ws, manager, dataStore, resultStore)

	req := task.CreateTaskRequest{
		ClientName: "testClient", InstanceID: "testInstance",
	}
	tModel, _ := manager.CreateTask(req)

	hreq := httptest.NewRequest(http.MethodPut, "/api/v1/tasks/"+tModel.TaskID+"/input/0", bytes.NewReader([]byte("data")))
	hreq.Header.Set("X-Client-Name", "evilClient") // Wrong owner
	w := httptest.NewRecorder()
	taskHandler.WriteInputPart(w, hreq, tModel.TaskID, 0) // Should reject
	// Though we don't return JSON cleanly in fake httptest if not routed natively, taskHandler.ReadInputPart tests owner sync:
	hreq2 := httptest.NewRequest(http.MethodGet, "/api/v1/tasks/"+tModel.TaskID+"/input/0", nil)
	hreq2.Header.Set("X-Client-Name", "evilClient")
	w2 := httptest.NewRecorder()
	taskHandler.ReadInputPart(w2, hreq2, tModel.TaskID, 0)
	if w2.Result().StatusCode != http.StatusForbidden {
		t.Fatalf("Expected 403 Forbidden, got %d", w2.Result().StatusCode)
	}
}

func TestTaskCancelScenario(t *testing.T) {
	baseDir := os.ExpandEnv("$HOME/Library/Application Support/AIHub/tasks_test_cancel")
	defer os.RemoveAll(baseDir)
	manager := task.NewManager()
	ws := websocket.NewServer()
	ws.SetTaskManager(manager)
	taskHandler := restapi.NewTaskHandler(ws, manager, nil, nil)

	req := task.CreateTaskRequest{ClientName: "testClient", InstanceID: "testInstance"}
	tModel, _ := manager.CreateTask(req)

	hreq := httptest.NewRequest(http.MethodPost, "/api/v1/tasks/"+tModel.TaskID+"/cancel", nil)
	w := httptest.NewRecorder()
	taskHandler.CancelTask(w, hreq, tModel.TaskID)
	if w.Result().StatusCode != 200 {
		t.Fatalf("Expected 200 OK cancel state")
	}

	canceledTask, _ := manager.GetTask(tModel.TaskID)
	if canceledTask.State != task.TaskCancelled {
		t.Fatalf("Expected state cancelled, got %s", canceledTask.State)
	}
}

func TestStartTaskInjectsContentExecutionMetadata(t *testing.T) {
	baseDir := os.ExpandEnv("$HOME/Library/Application Support/AIHub/tasks_test_start")
	defer os.RemoveAll(baseDir)

	manager := task.NewManager()
	dataStore := task.NewDataStore(baseDir)
	resultStore := task.NewResultStore(baseDir)
	ws := websocket.NewServer()
	ws.SetTaskManager(manager)
	taskHandler := restapi.NewTaskHandler(ws, manager, dataStore, resultStore)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("Listen failed: %v", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	_ = ln.Close()

	if err := ws.Start([]websocket.ListenAddress{{
		IP:      "127.0.0.1",
		Port:    port,
		Enabled: true,
	}}); err != nil {
		t.Fatalf("ws.Start failed: %v", err)
	}
	defer ws.Stop()

	wsURL := fmt.Sprintf("ws://127.0.0.1:%d/", port)
	var clientConn *gorillaws.Conn
	for attempt := 0; attempt < 10; attempt++ {
		clientConn, _, err = gorillaws.DefaultDialer.Dial(wsURL, nil)
		if err == nil {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	defer clientConn.Close()

	hello := types.Message[types.ClientHelloPayload]{
		ID:        "hello-1",
		Type:      "client.hello",
		Source:    "tweetClaw",
		Target:    "LocalBridgeGo",
		Timestamp: time.Now().UnixMilli(),
		Payload: types.ClientHelloPayload{
			ProtocolName:    websocket.ProtocolName,
			ProtocolVersion: websocket.ProtocolVersion,
			ClientName:      "tweetClaw",
			ClientVersion:   "test",
			Browser:         "chrome",
			Capabilities:    []string{"tasks"},
			InstanceID:      "instance-1",
			InstanceName:    "test-instance",
		},
	}
	if err := clientConn.WriteJSON(hello); err != nil {
		t.Fatalf("write hello failed: %v", err)
	}
	var helloAck types.Message[types.ServerHelloAckPayload]
	if err := clientConn.ReadJSON(&helloAck); err != nil {
		t.Fatalf("read hello ack failed: %v", err)
	}
	if helloAck.Type != types.ServerHelloAck {
		t.Fatalf("expected server.hello_ack, got %s", helloAck.Type)
	}

	req := task.CreateTaskRequest{
		ClientName: "tweetClaw",
		InstanceID: "instance-1",
		TaskKind:   "x.media_upload",
		InputMode:  "chunked",
		Params: map[string]interface{}{
			"tabId": 123,
		},
	}
	tModel, err := manager.CreateTask(req)
	if err != nil {
		t.Fatalf("CreateTask failed: %v", err)
	}
	if err := dataStore.WriteInputPart(tModel.TaskID, 0, []byte("hello")); err != nil {
		t.Fatalf("WriteInputPart failed: %v", err)
	}
	if _, err := dataStore.SealInput(tModel.TaskID, 1, 5, "video/mp4"); err != nil {
		t.Fatalf("SealInput failed: %v", err)
	}
	if err := manager.MarkReady(tModel.TaskID, "task-store://"+tModel.TaskID); err != nil {
		t.Fatalf("MarkReady failed: %v", err)
	}

	startReq := httptest.NewRequest(http.MethodPost, "/api/v1/tasks/"+tModel.TaskID+"/start", nil)
	w := httptest.NewRecorder()
	taskHandler.StartTask(w, startReq, tModel.TaskID)
	if w.Result().StatusCode != 200 {
		t.Fatalf("StartTask failed: %s", w.Body.String())
	}

	_ = clientConn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var startMsg types.Message[types.StartTaskRequest]
	if err := clientConn.ReadJSON(&startMsg); err != nil {
		t.Fatalf("read start task failed: %v", err)
	}
	if startMsg.Type != "request.start_task" {
		t.Fatalf("expected request.start_task, got %s", startMsg.Type)
	}
	if got := startMsg.Payload.Params["executionEnv"]; got != "content" {
		t.Fatalf("expected executionEnv=content, got %#v", got)
	}
	if got := startMsg.Payload.Params["deliveryMode"]; got != "bg_session_to_content_session" {
		t.Fatalf("expected deliveryMode=bg_session_to_content_session, got %#v", got)
	}
	if got := startMsg.Payload.Params["transferChunkBytes"]; got != float64(30*1024*1024) {
		t.Fatalf("expected transferChunkBytes=31457280, got %#v", got)
	}
	if got := startMsg.Payload.Params["contentType"]; got != "video/mp4" {
		t.Fatalf("expected contentType=video/mp4, got %#v", got)
	}
	if got := startMsg.Payload.Params["totalParts"]; got != float64(1) {
		t.Fatalf("expected totalParts=1, got %#v", got)
	}
	if got := startMsg.Payload.Params["totalBytes"]; got != float64(5) {
		t.Fatalf("expected totalBytes=5, got %#v", got)
	}
}
