package types

type StartTaskRequest struct {
	TaskID   string                 `json:"taskId"`
	TaskKind string                 `json:"taskKind"`
	InputRef string                 `json:"inputRef,omitempty"`
	Params   map[string]interface{} `json:"params"`
}

type CancelTaskRequest struct {
	TaskID string `json:"taskId"`
}

type TaskProgressEvent struct {
	TaskID   string  `json:"taskId"`
	State    string  `json:"state"`
	Phase    string  `json:"phase"`
	Progress float64 `json:"progress"`
}

type TaskFailedEvent struct {
	TaskID       string `json:"taskId"`
	State        string `json:"state"`
	Phase        string `json:"phase,omitempty"`
	ErrorCode    string `json:"errorCode"`
	ErrorMessage string `json:"errorMessage"`
}

type TaskCompletedEvent struct {
	TaskID    string `json:"taskId"`
	State     string `json:"state"`
	Phase     string `json:"phase"`
	ResultRef string `json:"resultRef"`
}

type TaskCancelledEvent struct {
	TaskID string `json:"taskId"`
	State  string `json:"state"`
	Phase  string `json:"phase,omitempty"`
}
