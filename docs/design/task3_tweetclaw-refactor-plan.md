# 阶段 3：浏览器 tweetClaw 扩展代码重构实施计划

## 文档信息
- 文档名称：阶段 3：浏览器 tweetClaw 扩展代码重构实施计划
- 版本：v1.2
- 状态：已通过评审，可作为开发依据
- 创建日期：2026-04-09
- 依赖文档：
  - [4.长任务透传链路彻底重构方案.md](./4.长任务透传链路彻底重构方案.md)
  - [5.长任务透传链路重构-任务拆解.md](./5.长任务透传链路重构-任务拆解.md)
  - [task2_long-task-manager-plan.md](./task2_long-task-manager-plan.md)

---

## 1. 计划概述

本阶段目标是将 tweetClaw 浏览器扩展改造为任务执行器模式，实现：

- 从 Go REST API 拉取任务输入数据（不再通过 WebSocket 传输大数据）
- 实现任务取消机制
- 通过 REST API 上传任务结果
- 通过 WebSocket 上报任务进度和状态事件
- 保持控制面与数据面分离

阶段 2 已完成 Go 侧的 Long Task Manager、Task Data Store、Task Result Store 和完整的 REST/WebSocket 协议。阶段 3 在此基础上改造插件侧，使其成为标准的任务执行器。

---

## 2. 本阶段目标

### 2.1 必须达成的结果

阶段 3 完成后，tweetClaw 扩展必须支持以下闭环：

1. background 接收 `request.start_task` 命令
2. background 从 Go REST API 拉取任务输入数据
3. background 驱动业务执行器（如 MediaUploadExecutor）
4. 业务执行器执行任务并上报进度
5. 业务执行器通过 REST API 上传结果
6. background 通过 WebSocket 上报 `event.task_completed`
7. 支持任务取消（接收 `request.cancel_task` 并中断执行）

### 2.2 本阶段不做的事情

本阶段不改 CLI 调用方式，不删除旧视频上传实现。这些属于阶段 4 和阶段 5。

本阶段的职责是把插件侧改造为任务执行器，并让后续阶段有完整的 southbound 协议可依赖。

---

## 3. 核心设计原则

### 3.1 控制面与数据面强分离

- WebSocket 只承载：
  - `request.start_task`
  - `request.cancel_task`
  - `event.task_progress`
  - `event.task_failed`
  - `event.task_completed`
  - `event.task_cancelled`
- REST / 本地 HTTP 承载：
  - 输入数据拉取（GET /api/v1/tasks/{taskId}/input/{partIndex}）
  - 结果数据上传（POST /api/v1/tasks/{taskId}/result）

### 3.2 任务执行器模式

插件侧采用统一的任务执行器架构：

- **TaskExecutor**：任务生命周期管理器
  - 接收 start_task 命令
  - 维护运行中任务 map
  - 拉取输入数据
  - 驱动业务执行器
  - 上报进度和状态
  
- **业务执行器**（如 MediaUploadExecutor）：
  - 只负责具体业务逻辑
  - 不管理任务生命周期
  - 不直接操作 WebSocket
  - 通过回调上报进度

### 3.3 错误分层

插件侧错误必须统一转为以下层级：

- `BRIDGE_ERROR` - 桥接层错误
- `INPUT_FETCH_ERROR` - 输入数据拉取失败
- `TASK_PREPARE_ERROR` - 任务准备阶段错误
- `TASK_EXECUTION_ERROR` - 任务执行错误
- `NETWORK_ERROR` - 网络错误
- `AUTH_ERROR` - 认证错误
- `TASK_CANCELLED` - 任务被取消

---

## 4. 模块设计

### 4.1 TaskExecutor（任务执行器）

新建 `tweetClaw/src/task/task-executor.ts`

**职责：**
- 接收 `request.start_task` 消息
- 维护运行中任务 map：`Map<taskId, TaskContext>`
- 从 Go REST API 拉取输入数据
- 创建并驱动业务执行器
- 上报进度和状态事件
- 处理任务取消

**核心接口：**

```typescript
interface TaskExecutor {
  // 启动任务
  startTask(request: StartTaskRequest): Promise<void>
  
  // 取消任务
  cancelTask(taskId: string): Promise<void>
  
  // 获取任务状态
  getTaskStatus(taskId: string): TaskStatus | null
}

interface TaskContext {
  taskId: string
  taskKind: string
  executor: BusinessExecutor
  cancellationToken: CancellationToken
  startedAt: number
  phase: string
  progress: number
}
```

**状态上报：**

```typescript
// 上报进度
reportProgress(taskId: string, phase: string, progress: number): void

// 上报失败
reportFailed(taskId: string, phase: string, errorCode: string, errorMessage: string): void

// 上报完成
reportCompleted(taskId: string, resultRef: string): void

// 上报取消
reportCancelled(taskId: string): void
```

---

### 4.2 DataFetcher（数据拉取器）

新建 `tweetClaw/src/task/data-fetcher.ts`

**职责：**
- 从 Go REST API 拉取任务输入数据
- 实现分片下载和组装
- 实现数据校验
- 实现失败重试

**核心接口：**

```typescript
interface TaskInputReader {
  // 获取输入元数据（从 start_task.params 获取）
  getMetadata(): InputMetadata
  
  // 读取单个分片
  readPart(partIndex: number): Promise<Uint8Array>
  
  // 异步迭代器，按需读取分片
  [Symbol.asyncIterator](): AsyncIterator<Uint8Array>
}

interface InputMetadata {
  totalParts: number
  totalBytes: number
  contentType: string
}

interface DataFetcher {
  // 创建输入读取器（不会一次性加载所有数据）
  createInputReader(taskId: string, metadata: InputMetadata): TaskInputReader
}
```

**实现要点：**

```typescript
class TaskInputReaderImpl implements TaskInputReader {
  constructor(
    private taskId: string,
    private metadata: InputMetadata,
    private fetcher: DataFetcher
  ) {}
  
  getMetadata(): InputMetadata {
    return this.metadata
  }
  
  async readPart(partIndex: number): Promise<Uint8Array> {
    if (partIndex < 0 || partIndex >= this.metadata.totalParts) {
      throw new Error(`Invalid part index: ${partIndex}`)
    }
    
    const response = await fetch(
      `${this.baseUrl}/api/v1/tasks/${this.taskId}/input/${partIndex}`,
      {
        headers: {
          'X-Client-Name': this.clientName,
          'X-Instance-ID': this.instanceId
        }
      }
    )
    
    if (!response.ok) {
      throw new Error(`Failed to fetch part ${partIndex}: ${response.status}`)
    }
    
    return new Uint8Array(await response.arrayBuffer())
  }
  
  async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
    for (let i = 0; i < this.metadata.totalParts; i++) {
      yield await this.readPart(i)
    }
  }
}
```

**设计说明：**

- 不会一次性将所有分片加载到内存
- 支持流式读取，业务执行器可以边读边处理
- 元数据从 `request.start_task.params` 获取，不依赖额外的 API

---

### 4.3 ResultUploader（结果上传器）

新建 `tweetClaw/src/task/result-uploader.ts`

**职责：**
- 上传任务结果到 Go REST API
- 获取 Go 生成的 resultRef
- 实现失败重试

**核心接口：**

```typescript
interface ResultUploader {
  // 上传任务结果
  uploadResult(taskId: string, contentType: string, data: Uint8Array): Promise<string>
}
```

**实现要点：**

```typescript
class ResultUploaderImpl implements ResultUploader {
  constructor(
    private config: TaskExecutorConfig
  ) {}
  
  async uploadResult(taskId: string, contentType: string, data: Uint8Array): Promise<string> {
    const response = await fetch(
      `${this.config.localBridgeBaseUrl}/api/v1/tasks/${taskId}/result`,
      {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'X-Client-Name': this.config.clientName,
          'X-Instance-ID': this.config.instanceId
        },
        body: data
      }
    )
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`)
    }
    
    const result = await response.json()
    return result.resultRef  // Go 生成的 resultRef
  }
}
```

---

### 4.4 BusinessExecutor（业务执行器接口）

新建 `tweetClaw/src/task/business-executor.ts`

**职责：**
- 定义业务执行器统一接口
- 所有具体业务执行器（如 MediaUploadExecutor）实现此接口

**核心接口：**

```typescript
interface BusinessExecutor {
  // 执行任务（使用流式输入读取器）
  execute(
    inputReader: TaskInputReader,
    params: Record<string, any>,
    callbacks: ExecutorCallbacks
  ): Promise<Uint8Array>
}

interface ExecutorCallbacks {
  // 上报进度
  onProgress(phase: string, progress: number): void
  
  // 检查是否取消
  checkCancellation(): void
}
```

**设计说明：**

- `inputReader` 支持流式读取，不会一次性加载所有数据到内存
- 业务执行器可以按需读取分片，边读边处理
- 避免大文件在扩展内存中完整重组

---

### 4.5 MediaUploadExecutor（视频上传执行器）

新建 `tweetClaw/src/task/executors/media-upload-executor.ts`

**职责：**
- 实现视频上传的具体业务逻辑
- 从任务输入读取视频数据（不再从 WebSocket 消息）
- 上报各阶段进度（init, append, finalize, done）
- 支持取消

**实现要点：**

```typescript
class MediaUploadExecutor implements BusinessExecutor {
  async execute(
    inputReader: TaskInputReader,
    params: Record<string, any>,
    callbacks: ExecutorCallbacks
  ): Promise<Uint8Array> {
    const { mimeType, tabId } = params
    const metadata = inputReader.getMetadata()
    
    // Phase 1: INIT
    callbacks.onProgress('init', 0.0)
    callbacks.checkCancellation()
    const mediaId = await this.initUpload(mimeType, metadata.totalBytes, tabId)
    
    // Phase 2: APPEND（流式读取和上传）
    callbacks.onProgress('append', 0.1)
    await this.appendChunksStreaming(mediaId, inputReader, tabId, callbacks)
    
    // Phase 3: FINALIZE
    callbacks.onProgress('finalize', 0.9)
    callbacks.checkCancellation()
    await this.finalizeUpload(mediaId, tabId)
    
    // Phase 4: DONE
    callbacks.onProgress('done', 1.0)
    
    // 返回结果（JSON 格式）
    return new TextEncoder().encode(JSON.stringify({ mediaId }))
  }
  
  private async appendChunksStreaming(
    mediaId: string,
    inputReader: TaskInputReader,
    tabId: number,
    callbacks: ExecutorCallbacks
  ): Promise<void> {
    const metadata = inputReader.getMetadata()
    let partIndex = 0
    
    // 流式读取分片，边读边上传
    for await (const part of inputReader) {
      callbacks.checkCancellation()  // 检查取消
      
      // 直接上传当前分片，不需要先组装完整文件
      await this.appendChunk(mediaId, part, partIndex, tabId)
      
      // 上报进度
      partIndex++
      const progress = 0.1 + (0.8 * partIndex / metadata.totalParts)
      callbacks.onProgress('append', progress)
    }
  }
}
```

**设计优势：**

- 流式处理：读取一个分片 → 立即上传 → 释放内存 → 读取下一个分片
- 不会将整个视频文件加载到扩展内存
- 降低 service worker 内存压力
- 提高大文件上传的稳定性

---

### 4.6 CancellationToken（取消令牌）

新建 `tweetClaw/src/task/cancellation-token.ts`

**职责：**
- 提供任务取消机制
- 业务执行器定期检查取消信号

**核心接口：**

```typescript
class CancellationToken {
  private cancelled = false
  
  cancel(): void {
    this.cancelled = true
  }
  
  check(): void {
    if (this.cancelled) {
      throw new TaskCancelledException()
    }
  }
  
  isCancelled(): boolean {
    return this.cancelled
  }
}
```

---

### 4.7 ErrorHandler（错误处理器）

新建 `tweetClaw/src/task/error-handler.ts`

**职责：**
- 统一错误捕获和转换
- 将各种错误转换为标准错误码

**核心接口：**

```typescript
interface TaskError {
  errorCode: string
  errorMessage: string
  phase: string
}

class ErrorHandler {
  static handleError(error: any, phase: string): TaskError {
    if (error instanceof TaskCancelledException) {
      return {
        errorCode: 'TASK_CANCELLED',
        errorMessage: 'Task was cancelled',
        phase
      }
    }
    
    if (error instanceof NetworkError) {
      return {
        errorCode: 'NETWORK_ERROR',
        errorMessage: error.message,
        phase
      }
    }
    
    if (error instanceof AuthError) {
      return {
        errorCode: 'AUTH_ERROR',
        errorMessage: error.message,
        phase
      }
    }
    
    // 默认为执行错误
    return {
      errorCode: 'TASK_EXECUTION_ERROR',
      errorMessage: error.message || 'Unknown error',
      phase
    }
  }
}
```

---

## 5. WebSocket 消息处理

### 5.1 background 中的消息处理

修改 `tweetClaw/src/service_work/background.ts`

**新增消息处理：**

```typescript
// 初始化 TaskExecutor
const taskExecutor = new TaskExecutor(localBridgeSocket, instanceId)

// 处理 start_task 消息
localBridgeSocket.on('request.start_task', async (message) => {
  try {
    await taskExecutor.startTask(message.payload)
  } catch (error) {
    console.error('Failed to start task:', error)
  }
})

// 处理 cancel_task 消息
localBridgeSocket.on('request.cancel_task', async (message) => {
  try {
    await taskExecutor.cancelTask(message.payload.taskId)
  } catch (error) {
    console.error('Failed to cancel task:', error)
  }
})
```

### 5.2 事件上报

TaskExecutor 通过 WebSocket 上报事件：

```typescript
// 上报进度
private reportProgress(taskId: string, phase: string, progress: number): void {
  this.socket.send({
    type: 'event.task_progress',
    payload: {
      taskId,
      state: 'running',
      phase,
      progress
    }
  })
}

// 上报失败
private reportFailed(taskId: string, phase: string, errorCode: string, errorMessage: string): void {
  this.socket.send({
    type: 'event.task_failed',
    payload: {
      taskId,
      state: 'failed',
      phase,
      errorCode,
      errorMessage
    }
  })
}

// 上报完成
private reportCompleted(taskId: string, resultRef: string): void {
  this.socket.send({
    type: 'event.task_completed',
    payload: {
      taskId,
      state: 'completed',
      phase: 'done',
      resultRef
    }
  })
}

// 上报取消
private reportCancelled(taskId: string, phase: string): void {
  this.socket.send({
    type: 'event.task_cancelled',
    payload: {
      taskId,
      state: 'cancelled',
      phase: 'done'  // 固定使用 'done'，与阶段 2 协议保持一致
    }
  })
}
```

---

## 6. 代码改动范围

### 6.1 新增文件

- `tweetClaw/src/task/task-executor.ts` - 任务执行器
- `tweetClaw/src/task/data-fetcher.ts` - 数据拉取器
- `tweetClaw/src/task/result-uploader.ts` - 结果上传器
- `tweetClaw/src/task/business-executor.ts` - 业务执行器接口
- `tweetClaw/src/task/executors/media-upload-executor.ts` - 视频上传执行器
- `tweetClaw/src/task/cancellation-token.ts` - 取消令牌
- `tweetClaw/src/task/error-handler.ts` - 错误处理器
- `tweetClaw/src/task/types.ts` - 类型定义

### 6.2 修改现有文件

- `tweetClaw/src/service_work/background.ts`
  - 初始化 TaskExecutor
  - 处理 start_task 和 cancel_task 消息
- `tweetClaw/src/bridge/local-bridge-socket.ts`
  - 添加 task 相关消息类型定义
- `tweetClaw/src/x_api/twitter_api.ts`
  - 重构视频上传逻辑为 MediaUploadExecutor

---

## 7. 实施顺序

### 7.1 第一组：基础设施

1. **任务 3.1**：定义类型和接口
   - 创建 `types.ts`
   - 定义 BusinessExecutor 接口
   - 定义 TaskContext、ExecutorCallbacks 等类型

2. **任务 3.2**：实现 CancellationToken
   - 创建 `cancellation-token.ts`
   - 实现取消令牌机制

3. **任务 3.3**：实现 ErrorHandler
   - 创建 `error-handler.ts`
   - 实现错误分层和转换

### 7.2 第二组：数据面

4. **任务 3.4**：实现 DataFetcher
   - 创建 `data-fetcher.ts`
   - 实现输入数据拉取逻辑
   - 实现分片下载和组装

5. **任务 3.5**：实现 ResultUploader
   - 创建 `result-uploader.ts`
   - 实现结果上传逻辑

### 7.3 第三组：任务执行器

6. **任务 3.6**：实现 TaskExecutor
   - 创建 `task-executor.ts`
   - 实现任务生命周期管理
   - 实现进度上报

7. **任务 3.7**：实现 MediaUploadExecutor
   - 创建 `executors/media-upload-executor.ts`
   - 重构视频上传逻辑为任务执行器模式

### 7.4 第四组：集成

8. **任务 3.8**：集成到 background
   - 修改 `background.ts`
   - 处理 start_task 和 cancel_task 消息

9. **任务 3.9**：集成测试
   - 端到端测试任务执行闭环
   - 测试取消机制
   - 测试错误场景

---

## 8. 关键实现细节

### 8.1 MV3 Service Worker 生命周期与断连收敛策略

**背景：**

MV3 service worker 有严格的生命周期限制，可能在长任务执行期间被挂起或终止。同时，WebSocket 连接可能断开。必须明确插件侧的收敛策略，避免出现"Go 侧任务已失败，插件本地上传还在继续"的孤儿任务。

**设计原则：**

1. **长任务执行依赖 WebSocket 存活**
   - 所有长任务执行必须在 WebSocket 连接存活的前提下进行
   - WebSocket 断开时，立即取消所有运行中任务
   - 不尝试在 service worker 重启后恢复任务

2. **与阶段 2 的 SESSION_DISCONNECTED 对齐**
   - 阶段 2 规定：owner session 在 `starting/running` 状态断开时，Go 侧任务立即转 `failed(SESSION_DISCONNECTED)`
   - 插件侧必须同步取消本地执行，避免孤儿任务

**实现要点：**

```typescript
class TaskExecutor {
  private runningTasks: Map<string, TaskContext> = new Map()
  
  constructor(private socket: LocalBridgeSocket) {
    // 监听 WebSocket 断开事件
    this.socket.on('disconnect', () => {
      this.handleDisconnect()
    })
  }
  
  private handleDisconnect(): void {
    console.log('[TaskExecutor] WebSocket disconnected, cancelling all running tasks')
    
    // 取消所有运行中任务
    for (const [taskId, context] of this.runningTasks) {
      try {
        context.cancellationToken.cancel()
        console.log(`[TaskExecutor] Cancelled task ${taskId} due to disconnect`)
      } catch (error) {
        console.error(`[TaskExecutor] Error cancelling task ${taskId}:`, error)
      }
    }
    
    // 清空任务列表
    this.runningTasks.clear()
  }
}
```

**Service Worker 保活策略：**

- 依赖 WebSocket 长连接保持 service worker 活跃
- 如果 WebSocket 使用 chrome.runtime.connect() 创建的 port，port 本身会保持 service worker 存活
- 不使用额外的 keepalive 机制（如 alarm 或 setInterval）
- 如果 service worker 被挂起，WebSocket 会断开，触发上述断连收敛逻辑

**约束：**

- 长任务执行期间，WebSocket 必须保持连接
- 不支持任务恢复：service worker 重启后，不尝试恢复之前的任务
- 依赖 Go 侧的 SESSION_DISCONNECTED 机制统一收敛任务状态

---

### 8.2 输入数据拉取

插件从 Go REST API 流式拉取输入数据，不再通过 WebSocket：

```typescript
// 从 start_task.params 获取元数据
const metadata: InputMetadata = {
  totalParts: startTaskRequest.params.totalParts,
  totalBytes: startTaskRequest.params.totalBytes,
  contentType: startTaskRequest.params.contentType
}

// 创建输入读取器
const inputReader = dataFetcher.createInputReader(taskId, metadata)

// 流式读取分片（不会一次性加载所有数据）
for await (const part of inputReader) {
  // 处理当前分片
  await processChunk(part)
  // 分片处理完后会被垃圾回收，不占用内存
}
```

**关键点：**

- 元数据从 `request.start_task.params` 获取，不依赖额外的 API
- 每次读取请求必须携带 owner 身份头：
  ```typescript
  headers: {
    'X-Client-Name': 'tweetClaw',
    'X-Instance-ID': this.instanceId
  }
  ```
- 流式处理，不会将大文件完整加载到内存

### 8.3 本地 API 基址配置

不要硬编码 API 地址，使用配置化方式：

```typescript
interface TaskExecutorConfig {
  localBridgeBaseUrl: string  // 例如：'http://localhost:8080'
  clientName: string
  instanceId: string
}

class TaskExecutor {
  constructor(
    private socket: LocalBridgeSocket,
    private config: TaskExecutorConfig
  ) {}
  
  private getApiUrl(path: string): string {
    return `${this.config.localBridgeBaseUrl}${path}`
  }
}
```

**配置来源：**

- 从扩展配置读取（chrome.storage）
- 或由现有 bridge client 在初始化时注入
- 默认值：`http://localhost:8080`

---

### 8.4 结果上传时序

插件必须先上传结果，再发送完成事件：

```typescript
// 1. 上传结果到 Go
const resultRef = await resultUploader.uploadResult(taskId, 'application/json', resultData)

// 2. 发送完成事件（携带 resultRef）
this.reportCompleted(taskId, resultRef)
```

### 8.5 取消机制

业务执行器定期检查取消信号：

```typescript
async execute(inputReader, params, callbacks) {
  for await (const part of inputReader) {
    callbacks.checkCancellation()  // 抛出 TaskCancelledException
    await this.processChunk(part)
  }
}
```

TaskExecutor 捕获取消异常并上报：

```typescript
try {
  await executor.execute(inputReader, params, callbacks)
} catch (error) {
  if (error instanceof TaskCancelledException) {
    this.reportCancelled(taskId)
  } else {
    const taskError = ErrorHandler.handleError(error, currentPhase)
    this.reportFailed(taskId, taskError.phase, taskError.errorCode, taskError.errorMessage)
  }
}
```

### 8.6 进度上报粒度

- 每个业务阶段变化必须上报一次
- 长时间阶段（如 append）必须周期性上报
- 建议至少每 5 秒上报一次进度

---

## 9. 与主任务拆解的映射关系

本计划中的任务编号是对 [5.长任务透传链路重构-任务拆解.md](./5.长任务透传链路重构-任务拆解.md) 阶段 3（任务卡 3.1-3.8）的实施级细分。

**映射关系：**

| 本计划任务 | 主任务拆解 | 说明 |
|-----------|-----------|------|
| 3.1 定义类型和接口 | 3.1 设计插件任务执行器架构 | 架构设计的代码实现 |
| 3.2 实现 CancellationToken | 3.5 实现任务取消机制 | 取消机制的基础设施 |
| 3.3 实现 ErrorHandler | 3.7 实现错误分层和上报 | 错误处理的基础设施 |
| 3.4 实现 DataFetcher | 3.3 实现输入数据拉取逻辑 | 数据拉取器实现 |
| 3.5 实现 ResultUploader | 3.6 实现结果上传逻辑 | 结果上传器实现 |
| 3.6 实现 TaskExecutor | 3.2 实现 background TaskExecutor | 任务执行器实现 |
| 3.7 实现 MediaUploadExecutor | 3.4 重构视频上传为任务执行器 | 业务执行器实现 |
| 3.8 集成到 background | 3.2 实现 background TaskExecutor | background 集成 |
| 3.9 集成测试 | 3.8 阶段 3 集成测试 | 端到端测试 |

**说明：**

- 本计划将基础设施（类型、取消令牌、错误处理）单独拆分为独立任务
- 这样可以更清晰地组织实施顺序和依赖关系
- 所有任务最终都对应到主任务拆解中的任务卡

---

## 10. 测试计划

### 9.1 单元测试

- DataFetcher 测试
  - 分片下载和组装
  - 数据完整性校验
  - 失败重试
- ResultUploader 测试
  - 结果上传
  - 失败重试
- CancellationToken 测试
  - 取消机制
- ErrorHandler 测试
  - 错误分层和转换

### 9.2 集成测试

- 视频上传任务完整流程
  - 创建任务 → 拉取输入 → 执行上传 → 上传结果 → 获取结果
- 任务取消场景
  - 运行中任务被中断
  - 取消事件正确上报
- 各种错误场景
  - 网络错误
  - 认证错误
  - 输入数据拉取失败
- 进度上报准确性
  - 各阶段进度正确
  - 进度更新及时

### 9.3 验收标准

- 所有测试用例通过
- 视频上传功能正常（a.mp4, b.mov）
- 取消机制有效
- 结果上传正确
- 进度上报准确
- 不再依赖 WebSocket 传输视频数据
- 视频上传稳定性验证（连续上传 10 个视频）

---

## 11. 风险和缓解措施

### 风险 1：数据拉取性能问题

**风险：** 从 REST API 拉取大文件可能较慢

**缓解措施：**
- 实现并发分片下载
- 实现下载进度显示
- 实现失败重试机制

### 风险 2：取消机制不及时

**风险：** 业务执行器可能不及时检查取消信号

**缓解措施：**
- 在所有长时间操作前检查取消
- 在循环中定期检查取消
- 设置取消超时机制

### 风险 3：错误信息不清晰

**风险：** 错误码和错误信息可能不够明确

**缓解措施：**
- 统一错误分层
- 错误信息包含足够上下文
- 记录详细错误日志

### 风险 4：与旧实现冲突

**风险：** 新旧实现可能同时存在导致冲突

**缓解措施：**
- 使用不同的消息类型
- 新实现使用独立的代码路径
- 阶段 5 统一清理旧实现

---

## 12. 开发完成判定

阶段 3 只有同时满足以下条件才算完成：

1. TaskExecutor、DataFetcher、ResultUploader 已实现
2. MediaUploadExecutor 已实现
3. 取消机制已实现
4. 错误处理已实现
5. background 集成已完成
6. 集成测试跑通完整任务闭环
7. 视频上传功能正常（a.mp4, b.mov）

在此之前，不认为阶段 3 完成。

---

## 13. 与阶段 2 的依赖关系

阶段 3 依赖阶段 2 的以下成果：

- ✅ Long Task Manager（任务生命周期管理）
- ✅ Task Data Store（输入数据存储）
- ✅ Task Result Store（结果数据存储）
- ✅ REST API（9 个端点）
- ✅ WebSocket 协议（6 个消息类型）

阶段 2 已完成并通过验收，阶段 3 可以开始。

---

## 14. 后续阶段预览

### 阶段 4：CLI 任务式调用改造

- 实现 TaskClient 基础类
- 实现分片上传逻辑
- 重构视频上传接口

### 阶段 5：清理旧实现

- 删除旧的同步桥接式长任务实现
- 删除旧的控制面大 payload 传输逻辑
- 更新文档

---

**评审人：待定**  
**评审日期：待定**
