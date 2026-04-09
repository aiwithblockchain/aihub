package task_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/hyperorchid/localbridge/pkg/restapi"
	"github.com/hyperorchid/localbridge/pkg/task"
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
