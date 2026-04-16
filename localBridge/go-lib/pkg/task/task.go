package task

import (
	"time"
)

type TaskState string

const (
	TaskCreated        TaskState = "created"
	TaskReceivingInput TaskState = "receiving_input"
	TaskReady          TaskState = "ready"
	TaskStarting       TaskState = "starting"
	TaskRunning        TaskState = "running"
	TaskCompleted      TaskState = "completed"
	TaskFailed         TaskState = "failed"
	TaskCancelled      TaskState = "cancelled"
)

type Task struct {
	TaskID          string
	TaskKind        string
	ClientName      string
	InstanceID      string
	OwnerClientName string
	OwnerInstanceID string
	InputMode       string
	State           TaskState
	Phase           string
	Progress        float64
	InputRef        string
	ResultRef       string
	ErrorCode       string
	ErrorMessage    string
	Params          map[string]interface{}
	CreatedAt       time.Time
	UpdatedAt       time.Time
	StartedAt       *time.Time
	CompletedAt     *time.Time
	FailedAt        *time.Time
	CancelledAt     *time.Time
}
