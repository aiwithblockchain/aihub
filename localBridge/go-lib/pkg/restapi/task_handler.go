package restapi

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/hyperorchid/localbridge/pkg/task"
	"github.com/hyperorchid/localbridge/pkg/types"
	"github.com/hyperorchid/localbridge/pkg/websocket"
)

const backgroundToContentTransferChunkBytes = 30 * 1024 * 1024

type TaskHandler struct {
	ws          *websocket.Server
	manager     *task.Manager
	dataStore   *task.DataStore
	resultStore *task.ResultStore
}

func NewTaskHandler(ws *websocket.Server, manager *task.Manager, dataStore *task.DataStore, resultStore *task.ResultStore) *TaskHandler {
	return &TaskHandler{
		ws:          ws,
		manager:     manager,
		dataStore:   dataStore,
		resultStore: resultStore,
	}
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, code, detail string) {
	writeJSON(w, status, map[string]string{
		"error":  code,
		"code":   code,
		"detail": detail,
	})
}

// POST /api/v1/tasks
func (h *TaskHandler) CreateTask(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "")
		return
	}
	var req task.CreateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", err.Error())
		return
	}
	t, err := h.manager.CreateTask(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "CREATE_FAILED", err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"taskId":    t.TaskID,
		"state":     t.State,
		"inputMode": t.InputMode,
	})
}

func (h *TaskHandler) TaskDispatch(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/tasks/")
	parts := strings.Split(path, "/")
	if len(parts) == 0 || parts[0] == "" {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "")
		return
	}
	taskID := parts[0]

	if len(parts) == 1 && r.Method == http.MethodGet {
		h.GetTask(w, r, taskID)
		return
	}

	if len(parts) == 2 {
		action := parts[1]
		switch action {
		case "seal":
			if r.Method == http.MethodPost {
				h.SealInput(w, r, taskID)
				return
			}
		case "start":
			if r.Method == http.MethodPost {
				h.StartTask(w, r, taskID)
				return
			}
		case "cancel":
			if r.Method == http.MethodPost {
				h.CancelTask(w, r, taskID)
				return
			}
		case "result":
			if r.Method == http.MethodPost {
				h.UploadResult(w, r, taskID)
				return
			} else if r.Method == http.MethodGet {
				h.GetResult(w, r, taskID)
				return
			}
		}
	}

	if len(parts) == 3 && parts[1] == "input" {
		partIndex, err := strconv.Atoi(parts[2])
		if err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_PART_INDEX", "partIndex must be an integer")
			return
		}
		if r.Method == http.MethodPut {
			h.WriteInputPart(w, r, taskID, partIndex)
			return
		} else if r.Method == http.MethodGet {
			h.ReadInputPart(w, r, taskID, partIndex)
			return
		}
	}

	writeError(w, http.StatusNotFound, "NOT_FOUND", "Endpoint not implemented")
}

func (h *TaskHandler) WriteInputPart(w http.ResponseWriter, r *http.Request, taskID string, partIndex int) {
	data, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	if err := h.manager.MarkReceivingInput(taskID); err != nil {
		writeError(w, http.StatusConflict, "INVALID_STATE", err.Error())
		return
	}
	if err := h.dataStore.WriteInputPart(taskID, partIndex, data); err != nil {
		writeError(w, http.StatusInternalServerError, "WRITE_FAILED", err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{"ok": true})
}

func (h *TaskHandler) SealInput(w http.ResponseWriter, r *http.Request, taskID string) {
	var req struct {
		TotalParts  int    `json:"totalParts"`
		TotalBytes  int64  `json:"totalBytes"`
		ContentType string `json:"contentType"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", err.Error())
		return
	}
	_, err := h.dataStore.SealInput(taskID, req.TotalParts, req.TotalBytes, req.ContentType)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "SEAL_FAILED", err.Error())
		return
	}
	inputRef := fmt.Sprintf("task-store://%s", taskID)
	if err := h.manager.MarkReady(taskID, inputRef); err != nil {
		writeError(w, http.StatusConflict, "INVALID_STATE", err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"ok":       true,
		"state":    "ready",
		"inputRef": inputRef,
	})
}

func (h *TaskHandler) StartTask(w http.ResponseWriter, r *http.Request, taskID string) {
	t, err := h.manager.GetTask(taskID)
	if err != nil {
		writeError(w, http.StatusNotFound, "TASK_NOT_FOUND", err.Error())
		return
	}
	if err := h.manager.MarkStarting(taskID); err != nil {
		writeError(w, http.StatusConflict, "INVALID_STATE", err.Error())
		return
	}

	meta, err := h.dataStore.GetInputMetadata(taskID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "START_FAILED", "Failed to retrieve input metadata")
		return
	}

	params := t.Params
	if params == nil {
		params = make(map[string]interface{})
	}
	if meta != nil && meta.Sealed {
		params["totalBytes"] = meta.TotalBytes
		params["totalParts"] = meta.TotalParts
		if meta.ContentType != "" {
			params["contentType"] = meta.ContentType
		}
	}
	if _, exists := params["executionEnv"]; !exists {
		params["executionEnv"] = "content"
	}
	if _, exists := params["deliveryMode"]; !exists {
		params["deliveryMode"] = "bg_session_to_content_session"
	}
	if _, exists := params["transferChunkBytes"]; !exists {
		params["transferChunkBytes"] = backgroundToContentTransferChunkBytes
	}

	startReq := types.StartTaskRequest{
		TaskID:   t.TaskID,
		TaskKind: t.TaskKind,
		InputRef: t.InputRef,
		Params:   params,
	}

	msg := types.Message[types.StartTaskRequest]{
		ID:        "cmd-" + t.TaskID,
		Type:      "request.start_task",
		Source:    "LocalBridgeGo",
		Target:    t.OwnerClientName,
		Timestamp: time.Now().UnixMilli(),
		Payload:   startReq,
	}

	sess, err := h.ws.ResolveConn(t.OwnerClientName, t.OwnerInstanceID)
	if err != nil {
		h.manager.MarkFailed(taskID, "start", "PLUGIN_OFFLINE", err.Error())
		writeError(w, http.StatusServiceUnavailable, "PLUGIN_OFFLINE", err.Error())
		return
	}

	if err := h.ws.SendJSON(sess, msg); err != nil {
		h.manager.MarkFailed(taskID, "start", "SEND_FAILED", err.Error())
		writeError(w, http.StatusServiceUnavailable, "SEND_FAILED", err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"ok":    true,
		"state": "starting",
	})
}

func (h *TaskHandler) GetTask(w http.ResponseWriter, r *http.Request, taskID string) {
	t, err := h.manager.GetTask(taskID)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"taskId":       t.TaskID,
		"taskKind":     t.TaskKind,
		"state":        string(t.State),
		"phase":        t.Phase,
		"progress":     t.Progress,
		"resultRef":    t.ResultRef,
		"errorCode":    t.ErrorCode,
		"errorMessage": t.ErrorMessage,
	})
}

func (h *TaskHandler) CancelTask(w http.ResponseWriter, r *http.Request, taskID string) {
	t, err := h.manager.GetTask(taskID)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	if t.State == task.TaskStarting || t.State == task.TaskRunning {
		cancelReq := types.CancelTaskRequest{TaskID: taskID}
		msg := types.Message[types.CancelTaskRequest]{
			ID:        "cmd-cancel-" + taskID,
			Type:      "request.cancel_task",
			Source:    "LocalBridgeGo",
			Target:    t.OwnerClientName,
			Timestamp: time.Now().UnixMilli(),
			Payload:   cancelReq,
		}
		if sess, err := h.ws.ResolveConn(t.OwnerClientName, t.OwnerInstanceID); err == nil {
			_ = h.ws.SendJSON(sess, msg)
		}
	}

	if err := h.manager.MarkCancelled(taskID, "cancelled_by_user"); err != nil {
		writeError(w, http.StatusConflict, "INVALID_STATE", err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"ok":    true,
		"state": "cancelled",
	})
}

func (h *TaskHandler) checkOwnerAuth(r *http.Request, t *task.Task) error {
	clientName := r.URL.Query().Get("clientName")
	instanceId := r.URL.Query().Get("instanceId")
	if clientName == "" {
		clientName = r.Header.Get("X-Client-Name")
	}
	if instanceId == "" {
		instanceId = r.Header.Get("X-Instance-ID")
	}
	// For dev bypass simply return if blank
	// if clientName == "" && instanceId == "" { return nil }
	if t.OwnerClientName != clientName || t.OwnerInstanceID != instanceId {
		return fmt.Errorf("owner mismatch for %v / %v", clientName, instanceId)
	}
	return nil
}

func (h *TaskHandler) ReadInputPart(w http.ResponseWriter, r *http.Request, taskID string, partIndex int) {
	t, err := h.manager.GetTask(taskID)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}
	if err := h.checkOwnerAuth(r, t); err != nil {
		writeError(w, http.StatusForbidden, "FORBIDDEN", err.Error())
		return
	}

	data, err := h.dataStore.ReadInputPart(taskID, partIndex)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "READ_FAILED", err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Write(data)
}

func (h *TaskHandler) UploadResult(w http.ResponseWriter, r *http.Request, taskID string) {
	t, err := h.manager.GetTask(taskID)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}
	if err := h.checkOwnerAuth(r, t); err != nil {
		writeError(w, http.StatusForbidden, "FORBIDDEN", err.Error())
		return
	}

	data, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	contentType := r.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	ref, err := h.resultStore.WriteResult(taskID, contentType, data)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "WRITE_FAILED", err.Error())
		return
	}

	if err := h.manager.SetResultRef(taskID, ref); err != nil {
		writeError(w, http.StatusConflict, "STATE_ERROR", err.Error())
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"ok":        true,
		"resultRef": ref,
	})
}

func (h *TaskHandler) GetResult(w http.ResponseWriter, r *http.Request, taskID string) {
	t, err := h.manager.GetTask(taskID)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}
	if t.State != task.TaskCompleted {
		writeError(w, http.StatusConflict, "NOT_COMPLETED", "Task is not completed yet")
		return
	}

	data, contentType, err := h.resultStore.ReadResult(taskID, t.ResultRef)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "READ_FAILED", err.Error())
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Write(data)
}
