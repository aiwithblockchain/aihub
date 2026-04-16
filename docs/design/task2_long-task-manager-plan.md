# 阶段 2：Long Task Manager 和 Task Data Store 重构实施计划

## 文档信息
- 文档名称：阶段 2：Long Task Manager 和 Task Data Store 重构实施计划
- 版本：v1.1
- 状态：已完成实施计划，可作为开发依据
- 创建日期：2026-04-09
- 依赖文档：
  - [4.长任务透传链路彻底重构方案.md](./4.长任务透传链路彻底重构方案.md)
  - [5.长任务透传链路重构-任务拆解.md](./5.长任务透传链路重构-任务拆解.md)
  - [task1_websocket-refactor-plan.md](./task1_websocket-refactor-plan.md)

## 1. 计划概述

本阶段目标是把“长任务”从同步桥接调用中独立出来，建立平台级通用能力：

- `Long Task Manager` 负责任务元数据、状态机和生命周期
- `Task Data Store` 负责大输入数据的接收、落盘和读取
- `Task Result Store` 负责任务结果写入、引用生成和读取
- REST 提供任务创建、输入写入、seal、start、query、cancel、result 获取接口
- WebSocket 只承担控制命令和状态事件，不传输大输入和结果正文

阶段 1 已完成，当前已经具备可用的单 writer loop 和稳定的 session lifecycle。阶段 2 以此为前提，不再修改 websocket 底层模型，而是在其上建立任务框架。

## 2. 本阶段目标

### 2.1 必须达成的结果

阶段 2 完成后，平台必须支持以下闭环：

1. 调用方创建任务
2. 调用方向 task data store 分片写入输入数据
3. 调用方 seal 输入并将任务置为 `ready`
4. Go 通过 websocket 向目标插件下发 `request.start_task`
5. 插件通过 REST 读取输入分片
6. 插件通过 websocket 上报 `event.task_progress / event.task_failed / event.task_completed`
7. 插件通过 REST 上传任务结果
8. 调用方通过 `GET /api/v1/tasks/{taskId}` 查询任务状态
9. 调用方通过 `GET /api/v1/tasks/{taskId}/result` 获取最终结果

### 2.2 本阶段不做的事情

本阶段不改插件业务执行器，不改 CLI 调用方式，不删除旧视频上传实现。这些属于阶段 3、4、5。

本阶段也不提供通用 `GET /api/v1/tasks` 列表接口。阶段 2 只要求单任务查询闭环；如果后续需要调试列表能力，再单独补充。

阶段 2 的职责是把平台框架搭好，并让后续阶段有完整的 northbound/southbound 协议可依赖。

## 3. 核心设计原则

### 3.1 控制面与数据面强分离

- WebSocket 只承载：
  - `request.start_task`
  - `request.cancel_task`
  - `event.task_progress`
  - `event.task_failed`
  - `event.task_completed`
  - `event.task_cancelled`
- REST / 本地文件系统承载：
  - 输入数据写入
  - 输入数据读取
  - 结果数据上传
  - 结果数据读取

### 3.2 长任务不是同步 request/response

阶段 2 的所有接口设计都必须遵守：

- 创建任务返回 `taskId`
- 启动任务返回 `starting`
- 查询任务状态通过 `GET /api/v1/tasks/{taskId}`
- 不允许再设计一个“阻塞等待最终结果”的长事务接口

### 3.3 任务归属必须绑定到具体插件实例

任务必须显式绑定：

- `ownerClientName`
- `ownerInstanceId`

所有读输入、上传结果、接收事件的行为都必须基于这个 owner 做校验。

阶段 2 的明确语义是：

- `ClientName/InstanceID` 表示任务目标插件
- `OwnerClientName/OwnerInstanceID` 在阶段 2 中与目标插件完全相同
- CLI/REST 调用方是 northbound caller，不写入 owner 字段

也就是说，阶段 2 创建任务时：

- `Task.ClientName = request.clientName`
- `Task.InstanceID = request.instanceId`
- `Task.OwnerClientName = request.clientName`
- `Task.OwnerInstanceID = request.instanceId`

### 3.4 Go 侧生成 `resultRef`

插件不直接生成 `resultRef`。  
插件只上传结果数据，Go 侧写入 `Task Result Store` 后生成 `resultRef` 并写入任务元数据。  
任务状态保持 `running`，直到 Go 收到并校验 `event.task_completed` 后才收敛为 `completed`。

## 4. 模块设计

### 4.1 Task Model

新建 `localBridge/go-lib/pkg/task/task.go`，定义核心数据结构：

```go
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
```

设计要求：

- `ClientName/InstanceID` 表示任务目标插件
- `OwnerClientName/OwnerInstanceID` 等同于阶段 2 当前场景下的目标插件归属，后续如果平台需要代理模式也有扩展空间
- `Phase` 和 `Progress` 独立于 `State`

### 4.2 Long Task Manager

新建 `localBridge/go-lib/pkg/task/manager.go`。

职责：

- 创建任务
- 执行状态迁移
- 更新阶段和进度
- 记录错误
- 写入结果引用
- 查询任务
- 校验 owner

建议接口：

```go
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

func (m *Manager) CreateTask(req CreateTaskRequest) (*Task, error)
func (m *Manager) GetTask(taskID string) (*Task, error)
func (m *Manager) EnsureOwner(taskID, clientName, instanceID string) (*Task, error)
func (m *Manager) MarkReceivingInput(taskID string) error
func (m *Manager) MarkReady(taskID string, inputRef string) error
func (m *Manager) MarkStarting(taskID string) error
func (m *Manager) MarkRunning(taskID, phase string, progress float64) error
func (m *Manager) MarkCompleted(taskID, resultRef string) error
func (m *Manager) MarkFailed(taskID, phase, code, message string) error
func (m *Manager) MarkCancelled(taskID, phase string) error
```

状态迁移必须严格检查：

- `created -> receiving_input -> ready -> starting -> running -> completed`
- 任意中间态可转 `failed / cancelled`
- 不允许从终态回退

### 4.3 Task Data Store

新建 `localBridge/go-lib/pkg/task/datastore.go`。

存储路径：

```text
~/Library/Application Support/AIHub/tasks/{taskId}/input/
```

文件布局：

```text
input/
  part_000000
  part_000001
  ...
  metadata.json
```

`metadata.json` 至少包含：

- `totalParts`
- `receivedParts`
- `sealed`
- `totalBytes`
- `contentType`
- `sha256` 可选

建议接口：

```go
func (s *DataStore) WriteInputPart(taskID string, partIndex int, data []byte) error
func (s *DataStore) SealInput(taskID string, totalParts int, totalBytes int64, contentType string) (*InputMetadata, error)
func (s *DataStore) ReadInputPart(taskID string, partIndex int) ([]byte, error)
func (s *DataStore) GetInputMetadata(taskID string) (*InputMetadata, error)
func (s *DataStore) CleanupTaskInput(taskID string) error
```

规则：

- `WriteInputPart()` 必须幂等覆盖同一 `partIndex`
- `SealInput()` 后不允许继续写入
- `ReadInputPart()` 只允许在 `sealed` 后读取

### 4.4 Task Result Store

新建 `localBridge/go-lib/pkg/task/resultstore.go`。

存储路径：

```text
~/Library/Application Support/AIHub/tasks/{taskId}/result/
```

设计：

- 小结果和大结果都统一落到 result store
- `resultRef` 统一由 Go 生成，例如：
  - `task-result://{taskId}/result.json`
  - `task-result://{taskId}/result.bin`

建议接口：

```go
func (s *ResultStore) WriteResult(taskID string, contentType string, data []byte) (string, error)
func (s *ResultStore) ReadResult(taskID string, resultRef string) ([]byte, string, error)
func (s *ResultStore) CleanupTaskResult(taskID string) error
```

## 5. 协议与接口设计

### 5.1 REST API

本阶段要落地以下接口：

统一错误响应格式：

```json
{
  "error": "task_not_ready",
  "code": "TASK_NOT_READY",
  "detail": "task must be in ready state before start"
}
```

建议状态码映射：

- `400`：请求参数错误
- `403`：owner 校验失败
- `404`：任务或分片不存在
- `409`：非法状态迁移
- `500`：内部错误
- `503`：目标插件离线或启动命令无法下发

#### `POST /api/v1/tasks`

用途：创建任务。

请求示例：

```json
{
  "clientName": "tweetClaw",
  "instanceId": "instance_xxx",
  "taskKind": "x.media_upload",
  "inputMode": "chunked_binary",
  "params": {
    "tabId": 305047737,
    "mimeType": "video/mp4"
  }
}
```

响应示例：

```json
{
  "taskId": "task_xxx",
  "state": "created",
  "inputMode": "chunked_binary"
}
```

#### `PUT /api/v1/tasks/{taskId}/input/{partIndex}`

用途：写入输入分片。

要求：

- `Content-Type: application/octet-stream`
- 首次写入将状态推进到 `receiving_input`
- 本阶段默认这是 northbound 本地调用接口，不做插件 owner 校验

响应示例：

```json
{
  "ok": true,
  "receivedParts": 3
}
```

#### `POST /api/v1/tasks/{taskId}/seal`

用途：完成输入写入，写入 metadata，并推进任务到 `ready`。

请求体建议包含：

```json
{
  "totalParts": 12,
  "totalBytes": 144960958,
  "contentType": "video/quicktime"
}
```

响应示例：

```json
{
  "ok": true,
  "state": "ready",
  "inputRef": "task-store://task_xxx"
}
```

#### `POST /api/v1/tasks/{taskId}/start`

用途：校验任务状态和 owner，然后通过 websocket 下发 `request.start_task`。

要求：

- 只有 `ready` 任务可启动
- 启动成功后状态置为 `starting`
- 启动命令发不出去时，任务转 `failed`，并记录平台级错误

响应示例：

```json
{
  "ok": true,
  "state": "starting"
}
```

#### `GET /api/v1/tasks/{taskId}`

用途：查询任务元数据、状态、阶段、进度、错误和 `resultRef`。

响应示例：

```json
{
  "taskId": "task_xxx",
  "taskKind": "x.media_upload",
  "state": "running",
  "phase": "append",
  "progress": 0.42,
  "resultRef": null,
  "errorCode": null,
  "errorMessage": null
}
```

#### `POST /api/v1/tasks/{taskId}/cancel`

用途：取消任务。

要求：

- 对 `starting/running` 任务通过 websocket 下发 `request.cancel_task`
- 对 `created/receiving_input/ready` 任务可直接在 Go 侧转 `cancelled`

响应示例：

```json
{
  "ok": true,
  "state": "cancelled"
}
```

#### `GET /api/v1/tasks/{taskId}/input/{partIndex}`

用途：插件读取输入分片。

要求：

- 必须校验 `clientName + instanceId` 是否匹配任务 owner
- 返回原始二进制

#### `POST /api/v1/tasks/{taskId}/result`

用途：插件上传结果数据。

要求：

- 必须校验任务 owner
- 由 Go 写入 result store，并生成 `resultRef`
- 响应体返回 `resultRef`
- 插件随后在 `event.task_completed` 中带回该 `resultRef`

响应示例：

```json
{
  "ok": true,
  "resultRef": "task-result://task_xxx/result.json"
}
```

#### `GET /api/v1/tasks/{taskId}/result`

用途：调用方获取任务结果。

要求：

- 只有 `completed` 任务可读取
- 从 result store 解析 `resultRef` 并返回实际结果

响应：

- 返回结果正文
- `Content-Type` 由 result store 记录的 contentType 决定

### 5.2 WebSocket 协议

#### `request.start_task`

由 Go 发给目标插件：

```json
{
  "taskId": "task_xxx",
  "taskKind": "x.media_upload",
  "inputRef": "task-store://task_xxx",
  "params": {
    "mimeType": "video/mp4",
    "tabId": 305047737,
    "totalBytes": 144960958,
    "totalParts": 12
  }
}
```

`params` 的组装规则：

- `mimeType`、`tabId` 等来自 `Task.Params`
- `totalBytes`、`totalParts`、`contentType` 来自 `SealInput()` 后的 `InputMetadata`
- 如果 `Task.Params.mimeType` 与 `InputMetadata.contentType` 同时存在，以 `InputMetadata.contentType` 作为最终内容类型来源
- 最终由 Go 在下发 `request.start_task` 前合并为统一 payload

#### `request.cancel_task`

由 Go 发给目标插件：

```json
{
  "taskId": "task_xxx"
}
```

#### `event.task_progress`

由插件发给 Go：

```json
{
  "taskId": "task_xxx",
  "state": "running",
  "phase": "append",
  "progress": 0.42
}
```

#### `event.task_failed`

```json
{
  "taskId": "task_xxx",
  "state": "failed",
  "phase": "append",
  "errorCode": "NETWORK_ERROR",
  "errorMessage": "net::ERR_HTTP2_PING_FAILED"
}
```

#### `event.task_completed`

本阶段要求只带任务完成事实和 `resultRef`，不带结果正文。  
插件应先调用 `POST /api/v1/tasks/{taskId}/result`，拿到 Go 返回的 `resultRef`，再发送完成事件：

```json
{
  "taskId": "task_xxx",
  "state": "completed",
  "phase": "done",
  "resultRef": "task-result://task_xxx/result.json"
}
```

`resultRef` 的真实值由 Go 在 `POST /result` 处理成功后生成。  
Go 收到 `event.task_completed` 后应校验事件中的 `resultRef` 与任务元数据一致，再将任务状态收敛到 `completed`。

#### `event.task_cancelled`

```json
{
  "taskId": "task_xxx",
  "state": "cancelled",
  "phase": "done"
}
```

## 6. 代码改动范围

### 6.1 新增模块

- `localBridge/go-lib/pkg/task/task.go`
- `localBridge/go-lib/pkg/task/manager.go`
- `localBridge/go-lib/pkg/task/datastore.go`
- `localBridge/go-lib/pkg/task/resultstore.go`
- `localBridge/go-lib/pkg/task/cleanup.go`
- `localBridge/go-lib/pkg/restapi/task_handler.go`

### 6.2 修改现有模块

- `localBridge/go-lib/pkg/restapi/handler.go`
  - 注册 task REST routes
- `localBridge/go-lib/pkg/websocket/server.go`
  - 处理 task 相关 websocket 消息
  - 将插件事件更新到 `TaskManager`
- `localBridge/go-lib/pkg/types/`
  - 补充 task 相关 payload 定义

## 7. 实施顺序

### 7.1 第一组：数据模型和核心存储

1. 任务 2.1：完成状态机、Task struct、InputMetadata、ResultMetadata 定义
2. 任务 2.2：实现 `Long Task Manager`
3. 任务 2.3：实现 `Task Data Store`
4. 任务 2.7：实现 `Task Result Store`

这一组完成后，应已有完整的内存元数据和磁盘数据层。

### 7.2 第二组：归属与 REST 闭环

5. 任务 2.4：实现 owner model 和校验
6. 任务 2.5：实现任务控制 REST API
7. 任务 2.6：实现插件读取输入数据接口
8. 任务 2.8：实现 `GET /result`
9. 任务 2.11：实现插件结果上传接口

这一组完成后，应已有 northbound/southbound 的完整 HTTP 闭环。

### 7.3 第三组：WebSocket 控制协议

10. 任务 2.10：实现 task websocket 控制协议
11. 任务 2.12：收敛 `task_completed` 事件载荷

这一组完成后，应具备“Go 控制启动/取消，插件上报进度/失败/完成”的完整控制面。

### 7.4 第四组：清理与集成测试

12. 任务 2.9：实现清理机制
13. 任务 2.13：阶段 2 集成测试

## 8. 关键实现细节

### 8.1 `start` 不是同步等待

`POST /api/v1/tasks/{taskId}/start` 的职责只有：

- 校验任务状态
- 将状态推进到 `starting`
- 向 websocket 发出 `request.start_task`

它不等待插件返回最终结果。

### 8.2 任务 owner 校验点

owner 校验至少要出现在：

- `GET /api/v1/tasks/{taskId}/input/{partIndex}`
- `POST /api/v1/tasks/{taskId}/result`
- websocket 事件处理（插件上报 `event.task_*` 时）

`PUT /api/v1/tasks/{taskId}/input/{partIndex}` 在阶段 2 不做插件 owner 校验，因为它是 northbound 本地调用接口，不是插件 southbound 接口。

### 8.3 清理策略必须以任务状态为准

- `completed`：1 小时后清理输入和结果，保留元数据窗口期
- `failed/cancelled`：24 小时后清理，保留错误信息和目录用于排查
- `created/receiving_input/ready` 超过 1 小时：视为僵尸任务并清理

### 8.4 阶段 2 不做业务特化

即使首个落地用例是视频上传，本阶段所有命名、接口和错误处理都必须保持通用任务框架语义，不允许把 `media upload` 的业务字段直接写进平台层模型。

### 8.5 `POST /result` 与 `event.task_completed` 的时序

阶段 2 对完成时序的明确要求是：

1. 插件执行完成后调用 `POST /api/v1/tasks/{taskId}/result`
2. Go 写入 result store，生成 `resultRef`，写入 `Task.ResultRef`
3. 此时任务状态仍保持 `running`
4. 插件拿到 `resultRef` 后发送 `event.task_completed`
5. Go 校验事件中的 `resultRef == Task.ResultRef`
6. 校验通过后，任务状态才收敛到 `completed`

这样可以避免“结果已上传但完成事件未确认”的时序歧义。

### 8.6 session 断连后的任务状态收敛

阶段 2 的明确策略是：

- 如果 owner session 在 `starting` 或 `running` 状态下断开，任务立即转为 `failed`
- 错误码统一为 `SESSION_DISCONNECTED`
- 错误消息写入 `Task.ErrorMessage`
- 不等待插件重连，也不保持悬挂状态

这要求 websocket 层在 session 关闭时通知 `TaskManager`，由 `TaskManager` 扫描并收敛该 owner 下的活动任务。

## 9. 测试计划

### 9.1 单元测试

- Task state transition 测试
- owner 校验测试
- input store 写入/读取/seal 测试
- result store 写入/读取测试
- cleanup 规则测试
- 重复 `seal` 测试
- 重复 `start` 测试
- `seal` 前 `start` 测试
- 并发写入同一 `partIndex` 测试

### 9.2 集成测试

- `create -> input parts -> seal -> start -> progress -> completed -> get result`
- `create -> input parts -> seal -> start -> failed`
- `create -> cancel before start`
- `start -> cancel while running`
- 跳过 `partIndex` 写入后的 seal 行为
- `POST /result` 成功但 `event.task_completed` 丢失
- owner session 在 `starting/running` 时断开
- 跨实例读取输入拒绝
- 跨实例上传结果拒绝
- 100MB+ 输入分片写入和读取

### 9.3 验收标准

- 所有 task REST API 可用
- Task 状态机转换符合设计
- 输入数据和结果数据都不再经 websocket 传输
- WebSocket 只承担 task 控制命令和事件
- owner 校验正确
- 清理机制正确释放磁盘空间

## 10. 风险与注意事项

### 风险 1：状态机实现过松

如果状态转移不做强校验，后面很容易出现：

- 重复 start
- 未 seal 就 start
- 完成后再次写结果

处理要求：所有状态更新接口必须带合法性检查。

### 风险 2：owner 校验遗漏

如果漏了 owner 校验，多实例场景下任务会串。

处理要求：所有 southbound 读取/写入接口都必须显式调用 `EnsureOwner()`。

### 风险 3：结果通路再次混入 websocket

如果实现时为了省事把结果正文塞回 `event.task_completed`，阶段 2 会偏离上位方案。

处理要求：结果正文只能走 `POST /result` 和 `GET /result`。

### 风险 4：任务目录清理过早

如果 `completed` 后立即删除结果目录，调用方可能还没来得及取结果。

处理要求：结果目录保留窗口期，清理策略写成可配置项。

## 11. 开发完成判定

阶段 2 只有同时满足以下条件才算完成：

1. `TaskManager`、`TaskDataStore`、`TaskResultStore` 已实现
2. task REST API 已实现
3. task websocket 控制协议已实现
4. owner model 已实现
5. 插件读取输入和上传结果接口已实现
6. 集成测试跑通完整任务闭环

在此之前，不认为阶段 2 完成。
