package task

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

type CreateTaskRequest struct {
	ClientName string
	InstanceID string
	TaskKind   string
	InputMode  string
	Params     map[string]interface{}
}

type Manager struct {
	mu    sync.RWMutex
	tasks map[string]*Task
}

func NewManager() *Manager {
	return &Manager{
		tasks: make(map[string]*Task),
	}
}

func deepCopyParams(params map[string]interface{}) map[string]interface{} {
	if params == nil {
		return nil
	}
	copyMap := make(map[string]interface{}, len(params))
	for k, v := range params {
		// Note: This is a shallow copy. Params should only contain primitive types.
		// If nested structures (maps/slices) are needed in the future, use JSON marshal/unmarshal for true deep copy.
		copyMap[k] = v
	}
	return copyMap
}

func (m *Manager) CreateTask(req CreateTaskRequest) (*Task, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	taskID := "task_" + uuid.New().String()
	now := time.Now()

	task := &Task{
		TaskID:          taskID,
		TaskKind:        req.TaskKind,
		ClientName:      req.ClientName,
		InstanceID:      req.InstanceID,
		OwnerClientName: req.ClientName,
		OwnerInstanceID: req.InstanceID,
		InputMode:       req.InputMode,
		State:           TaskCreated,
		Params:          req.Params,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	m.tasks[taskID] = task
	return task, nil
}

func (m *Manager) GetTask(taskID string) (*Task, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	task, exists := m.tasks[taskID]
	if !exists {
		return nil, fmt.Errorf("task %s not found", taskID)
	}
	taskCopy := *task
	taskCopy.Params = deepCopyParams(task.Params)
	return &taskCopy, nil
}

func (m *Manager) EnsureOwner(taskID, clientName, instanceID string) (*Task, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	task, exists := m.tasks[taskID]
	if !exists {
		return nil, fmt.Errorf("task %s not found", taskID)
	}
	if task.OwnerClientName != clientName || task.OwnerInstanceID != instanceID {
		return nil, fmt.Errorf("unauthorized: owner mismatch for task %s", taskID)
	}
	taskCopy := *task
	taskCopy.Params = deepCopyParams(task.Params)
	return &taskCopy, nil
}

func (m *Manager) MarkReceivingInput(taskID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	task, exists := m.tasks[taskID]
	if !exists {
		return fmt.Errorf("task %s not found", taskID)
	}

	if task.State != TaskCreated && task.State != TaskReceivingInput {
		return fmt.Errorf("invalid state transition: %s -> %s", task.State, TaskReceivingInput)
	}

	task.State = TaskReceivingInput
	task.UpdatedAt = time.Now()
	return nil
}

func (m *Manager) MarkReady(taskID string, inputRef string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	task, exists := m.tasks[taskID]
	if !exists {
		return fmt.Errorf("task %s not found", taskID)
	}

	if task.State != TaskCreated && task.State != TaskReceivingInput {
		return fmt.Errorf("invalid state transition: %s -> %s", task.State, TaskReady)
	}

	task.State = TaskReady
	task.InputRef = inputRef
	task.UpdatedAt = time.Now()
	return nil
}

func (m *Manager) MarkStarting(taskID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	task, exists := m.tasks[taskID]
	if !exists {
		return fmt.Errorf("task %s not found", taskID)
	}

	if task.State != TaskReady {
		return fmt.Errorf("invalid state transition: %s -> %s", task.State, TaskStarting)
	}

	task.State = TaskStarting
	task.UpdatedAt = time.Now()
	return nil
}

func (m *Manager) MarkRunning(taskID, phase string, progress float64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	task, exists := m.tasks[taskID]
	if !exists {
		return fmt.Errorf("task %s not found", taskID)
	}

	if task.State != TaskStarting && task.State != TaskRunning {
		return fmt.Errorf("invalid state transition: %s -> %s", task.State, TaskRunning)
	}

	task.State = TaskRunning
	if phase != "" {
		task.Phase = phase
	}
	task.Progress = progress
	now := time.Now()
	if task.StartedAt == nil {
		task.StartedAt = &now
	}
	task.UpdatedAt = now
	return nil
}

func (m *Manager) SetResultRef(taskID, resultRef string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	task, exists := m.tasks[taskID]
	if !exists {
		return fmt.Errorf("task %s not found", taskID)
	}
	if task.State != TaskStarting && task.State != TaskRunning {
		return fmt.Errorf("cannot set resultRef: invalid state %s", task.State)
	}
	task.ResultRef = resultRef
	now := time.Now()
	if task.State == TaskStarting {
		task.State = TaskRunning
		if task.StartedAt == nil {
			task.StartedAt = &now
		}
	}
	task.UpdatedAt = now
	return nil
}

func (m *Manager) MarkCompleted(taskID, resultRef string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	task, exists := m.tasks[taskID]
	if !exists {
		return fmt.Errorf("task %s not found", taskID)
	}

	if task.State != TaskStarting && task.State != TaskRunning {
		return fmt.Errorf("invalid state transition: %s -> %s", task.State, TaskCompleted)
	}

	if task.ResultRef != "" && task.ResultRef != resultRef {
		return fmt.Errorf("resultRef mismatch: %s != %s", task.ResultRef, resultRef)
	}
	if resultRef != "" {
		task.ResultRef = resultRef
	}

	task.State = TaskCompleted
	task.Phase = "done"
	now := time.Now()
	if task.StartedAt == nil {
		task.StartedAt = &now
	}
	task.CompletedAt = &now
	task.UpdatedAt = now
	return nil
}

func (m *Manager) MarkFailed(taskID, phase, code, message string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	task, exists := m.tasks[taskID]
	if !exists {
		return fmt.Errorf("task %s not found", taskID)
	}

	if task.State == TaskCompleted || task.State == TaskCancelled || task.State == TaskFailed {
		return fmt.Errorf("invalid state transition: %s -> %s", task.State, TaskFailed)
	}

	task.State = TaskFailed
	if phase != "" {
		task.Phase = phase
	}
	task.ErrorCode = code
	task.ErrorMessage = message
	now := time.Now()
	task.FailedAt = &now
	task.UpdatedAt = now
	return nil
}

func (m *Manager) MarkCancelled(taskID, phase string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	task, exists := m.tasks[taskID]
	if !exists {
		return fmt.Errorf("task %s not found", taskID)
	}

	if task.State == TaskCompleted || task.State == TaskFailed || task.State == TaskCancelled {
		return fmt.Errorf("invalid state transition: %s -> %s", task.State, TaskCancelled)
	}

	task.State = TaskCancelled
	if phase != "" {
		task.Phase = phase
	}
	now := time.Now()
	task.CancelledAt = &now
	task.UpdatedAt = now
	return nil
}

func (m *Manager) HandleSessionDisconnect(clientName, instanceID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, task := range m.tasks {
		if task.OwnerClientName == clientName && task.OwnerInstanceID == instanceID {
			if task.State == TaskStarting || task.State == TaskRunning {
				task.State = TaskFailed
				task.ErrorCode = "SESSION_DISCONNECTED"
				task.ErrorMessage = "Owner session disconnected unexpectedly"
				now := time.Now()
				task.FailedAt = &now
				task.UpdatedAt = now
			}
		}
	}
}
