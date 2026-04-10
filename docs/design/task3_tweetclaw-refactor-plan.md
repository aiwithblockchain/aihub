# 阶段 3：tweetClaw 扩展执行边界纠偏与任务协调重构计划

## 文档信息
- 文档名称：阶段 3：tweetClaw 扩展执行边界纠偏与任务协调重构计划
- 版本：v2.0
- 状态：待评审
- 创建日期：2026-04-09
- 依赖文档：
  - [4.长任务透传链路彻底重构方案.md](./4.长任务透传链路彻底重构方案.md)
  - [5.长任务透传链路重构-任务拆解.md](./5.长任务透传链路重构-任务拆解.md)
  - [task2_long-task-manager-plan.md](./task2_long-task-manager-plan.md)
  - [6.推特执行环境纠偏补丁方案.md](./6.推特执行环境纠偏补丁方案.md)

---

## 1. 背景与结论

当前阶段 3 的原始设计存在根本性错误：

- 它把 `background service worker` 设计成 `x.media_upload` 的实际执行器
- 它默认可以在 background 中直接完成 X/Twitter API 的上传交互

这与真实运行边界冲突。对 X/Twitter API 的实际交互必须发生在 `content` 环境。

因此，本阶段不是继续增强“background 直接上传”的方案，而是将扩展改造成以下结构：

- `background`：任务协调器、Go 输入下载器、background session 缓存管理器、结果回传者
- `content`：真实业务执行器、content session 缓存管理器、X API 调用者

---

## 2. 基于当前代码的改造基线

本计划不是从零设计，而是建立在现有已验证代码之上。

### 2.1 可以复用的现有能力

- `tweetClaw/src/service_work/background.ts`
  - 已有 upload session 缓存能力
  - 已有 `GET_UPLOAD_SESSION_CHUNK`
  - 已有 `RELEASE_UPLOAD_SESSION`
- `tweetClaw/src/content/main_entrance.ts`
  - 已有从 background 拉取分片的能力
  - 已有 `uploadMediaFromSession(...)`
- `tweetClaw/src/x_api/twitter_api.ts`
  - 已有 content/page 侧上传实现

### 2.2 需要纠偏的现有新代码

- `tweetClaw/src/task/task-executor.ts`
- `tweetClaw/src/task/data-fetcher.ts`
- `tweetClaw/src/task/executors/media-upload-executor.ts`

这些文件当前的问题是把 background 建模成了上传执行器。重构后它们要么转型为协调层模块，要么迁移到 content 侧。

---

## 3. 本阶段目标

阶段 3 完成后，插件必须支持以下闭环：

1. background 接收 `request.start_task`
2. background 通过 Go REST API 下载任务输入
3. background 将输入写入 background session
4. background 按跨环境传输块把数据发送给 content
5. content 建立 content session 并接收完整输入
6. content 在本地 session 基础上执行 X 上传
7. content 将进度、完成、失败、取消回传给 background
8. background 上传结果到 Go 并发送 `event.task_*`

---

## 4. 强制设计原则

### 4.1 执行边界

- 任何 X/Twitter API 的实际交互只能在 `content` 环境执行
- background 不得直接调用 `fetch(upload.x.com)` 或同类上传接口
- background 只能协调、缓存、转发、收敛状态

### 4.2 控制面与数据面

- WebSocket 只承载：
  - `request.start_task`
  - `request.cancel_task`
  - `event.task_progress`
  - `event.task_failed`
  - `event.task_completed`
  - `event.task_cancelled`
- Go 与插件之间的大输入数据通过本地 REST 接口传输
- background 与 content 之间的大输入数据通过 runtime message 分片传输
- 结果数据通过 REST 上传到 Go，不通过 WebSocket 直接回传

### 4.3 双 session 模型

- background session 与 content session 必须分离
- 两者不能共享同一缓存对象
- content 必须在完成本地 session 组装后才开始上传

---

## 5. 新架构

### 5.1 总链路

```text
Go request.start_task
  -> background BackgroundTaskCoordinator
  -> DataFetcher 从 Go 拉取输入
  -> background session cache
  -> runtime message 分片传输
  -> content ContentTaskRunner
  -> content session cache
  -> content UploadExecutor
  -> X API (INIT / APPEND / FINALIZE / STATUS)
  -> background ResultUploader
  -> Go event.task_completed / failed / cancelled
```

### 5.2 background 职责

background 只负责：

- 接收 `request.start_task`
- 建立任务上下文
- 下载任务输入
- 建立和维护 background session
- 把数据按传输块发送到 content
- 接收 content 回传事件
- 上传结果到 Go
- 通过 WebSocket 上报最终状态

background 不负责：

- 直接执行上传
- 直接访问 X/Twitter 上传 API
- 在本地长期保留任务结果原文

### 5.3 content 职责

content 负责：

- 接收 background 发起的执行命令
- 通过 `GET_UPLOAD_SESSION_CHUNK` 拉取 background 分片
- 建立 content session
- 在 content 内执行上传
- 周期性回传进度
- 在完成/失败/取消时释放 content session

---

## 6. 模块设计

### 6.1 BackgroundTaskCoordinator

文件：

- `tweetClaw/src/task/task-executor.ts`
- `tweetClaw/src/service_work/background.ts`

重构目标：

- 将现有 `TaskExecutor` 改造成 `BackgroundTaskCoordinator`
- 删除“直接驱动 `MediaUploadExecutor` 上传”的职责

核心接口：

```typescript
interface BackgroundTaskCoordinator {
  startTask(request: StartTaskRequest): Promise<void>
  cancelTask(taskId: string): Promise<void>
  handleContentProgress(taskId: string, phase: string, progress: number): void
  handleContentCompleted(taskId: string, result: Uint8Array): Promise<void>
  handleContentFailed(taskId: string, phase: string, errorCode: string, errorMessage: string): void
  handleContentCancelled(taskId: string): void
}
```

### 6.2 BackgroundInputFetcher

文件：

- `tweetClaw/src/task/data-fetcher.ts`

职责：

- 从 Go 读取输入 part
- 进行输入完整性校验
- 按 `30 MiB raw equivalent` 重切分为 runtime 传输块

说明：

- 这里的切块是 `background -> content` 传输块
- 不等于 Go task data store 中的原始 part

### 6.3 BackgroundSessionStore

建议位置：

- `tweetClaw/src/task/background-session-store.ts`
  或继续收敛在 `tweetClaw/src/service_work/background.ts`

核心结构：

```typescript
interface BackgroundTaskSession {
  taskId: string
  mimeType: string
  totalBytes: number
  transferChunkCount: number
  transferChunks: string[]
  createdAt: number
}
```

要求：

- 浏览器关闭时自动释放
- 任务完成/失败/取消时必须显式释放
- 支持 `getChunk(taskId, chunkIndex)` 和 `release(taskId)`

### 6.4 ContentTaskRunner

文件：

- `tweetClaw/src/content/content-task-runner.ts`
- `tweetClaw/src/content/main_entrance.ts`

职责：

- 接收 `START_TASK_UPLOAD_FROM_BG_SESSION`
- 拉取全部 background 分片
- 建立 content session
- 调用 content 侧上传执行器
- 回传 `progress / completed / failed / cancelled`

### 6.5 ContentSessionStore

文件：

- `tweetClaw/src/content/content-upload-session.ts`

核心结构：

```typescript
interface ContentUploadSession {
  taskId: string
  mimeType: string
  totalBytes: number
  chunks: Blob[]
  createdAt: number
}
```

要求：

- 接收完成之前不得开始上传
- 任务完成、失败、取消后必须释放
- 不与 background session 共享任何缓存对象

### 6.6 ContentUploadExecutor

文件：

- `tweetClaw/src/content/content-upload-executor.ts`
- `tweetClaw/src/x_api/twitter_api.ts`

职责：

- 在 content 环境中执行上传
- 小文件复用现有成功路径
- 大文件在 content 内做 `INIT / APPEND / FINALIZE / STATUS`

核心接口：

```typescript
interface ContentUploadExecutor {
  executeFromContentSession(
    session: ContentUploadSession,
    params: Record<string, unknown>,
    callbacks: ExecutorCallbacks
  ): Promise<Uint8Array>
}
```

---

## 7. 消息与数据流设计

### 7.1 Go 到 background

使用现有 REST：

- `GET /api/v1/tasks/{taskId}/input/{partIndex}`

metadata 来自 `request.start_task.params`，至少包含：

- `tabId`
- `contentType`
- `totalBytes`
- `totalParts`
- `executionEnv: "content"`
- `deliveryMode: "bg_session_to_content_session"`

### 7.2 background 到 content

复用现有消息能力，并新增任务语义：

- `START_TASK_UPLOAD_FROM_BG_SESSION`
- `GET_UPLOAD_SESSION_CHUNK`
- `RELEASE_UPLOAD_SESSION`
- `TASK_PROGRESS_FROM_CONTENT`
- `TASK_COMPLETED_FROM_CONTENT`
- `TASK_FAILED_FROM_CONTENT`
- `TASK_CANCELLED_FROM_CONTENT`
- `CANCEL_CONTENT_TASK`

传输约束：

- 单条 runtime message 只传一个传输块
- 单块大小不超过 `30 MiB raw equivalent`
- 跨环境载荷使用 base64 string

### 7.3 content 到 background 结果

content 不直接写 Go。

content 完成后回传：

- `mediaId`
- 可选业务结果 JSON

background 负责：

1. 调用 `POST /api/v1/tasks/{taskId}/result`
2. 获取 `resultRef`
3. 发送 `event.task_completed`

---

## 8. 取消与断连收敛

### 8.1 取消

- Go 发 `request.cancel_task`
- background 标记任务取消并向 content 发送 `CANCEL_CONTENT_TASK`
- content 停止上传并释放 content session
- background 释放 background session
- background 发 `event.task_cancelled`

### 8.2 断连

- 如果 WebSocket 断开，background 必须取消所有运行中的任务
- background 不再尝试自行恢复上传
- content 在收到取消后停止本地执行
- 由 Go 的 `SESSION_DISCONNECTED` 收敛最终状态

---

## 9. 代码改动范围

### 9.1 需要重构的文件

- `tweetClaw/src/task/task-executor.ts`
  - 从执行器改成协调器
- `tweetClaw/src/task/data-fetcher.ts`
  - 从“直接供 background 执行器读取”改成“下载并切成 bg->content 传输块”
- `tweetClaw/src/service_work/background.ts`
  - 接入 `BackgroundTaskCoordinator`
  - 统一管理 background session
- `tweetClaw/src/content/main_entrance.ts`
  - 接入任务消息
  - 转交 `ContentTaskRunner`

### 9.2 需要新增的文件

- `tweetClaw/src/task/background-session-store.ts`
- `tweetClaw/src/content/content-task-runner.ts`
- `tweetClaw/src/content/content-upload-session.ts`
- `tweetClaw/src/content/content-upload-executor.ts`
- `tweetClaw/src/task/types.ts`
- `tweetClaw/src/task/error-handler.ts`
- `tweetClaw/src/task/result-uploader.ts`

### 9.3 需要删除或降级的错误职责

- `tweetClaw/src/task/executors/media-upload-executor.ts`
  - 不再作为 background 执行器保留
  - 如需保留文件名，也必须迁移为 content 侧执行器

---

## 10. 实施顺序

### 10.1 第一组：类型与职责收口

1. 定义 `BackgroundTaskCoordinator`、`ContentTaskRunner`、session 类型
2. 收敛错误码与结果回传类型

### 10.2 第二组：background 数据面

3. 重构 `data-fetcher.ts`
4. 建立 background session store
5. 接通 background 到 content 的分片传输

### 10.3 第三组：content 执行面

6. 建立 content session store
7. 实现 `ContentTaskRunner`
8. 将上传逻辑迁移到 content 执行器

### 10.4 第四组：状态闭环

9. 实现 content -> background 的进度、完成、失败、取消回传
10. 实现 background -> Go 的结果上传与事件上报

### 10.5 第五组：集成验证

11. 跑通 `a.mp4`
12. 跑通大于 64MiB 的视频
13. 验证取消、断连、浏览器关闭清理

---

## 11. 测试计划

### 11.1 单元测试

- background session store
- content session store
- 传输块切分逻辑
- 错误处理与取消令牌

### 11.2 集成测试

- 小视频上传闭环
- 大视频上传闭环
- content 执行失败回传
- `request.cancel_task` 闭环
- WebSocket 断开后的任务收敛

### 11.3 验收标准

- background 不再直接调用任何 X 上传 API
- 所有 X API 调用都发生在 content
- 小视频上传成功
- 大于 64MiB 视频上传成功
- 结果通过 REST 上传到 Go 并生成 `resultRef`
- 任务结束后 background / content session 均被释放

---

## 12. 完成判定

阶段 3 只有同时满足以下条件才算完成：

1. background 已转为协调器
2. content 已转为真实上传执行器
3. Go 输入数据能够通过 background 安全送达 content
4. 上传结果能由 background 正确回传到 Go
5. `a.mp4` 与大视频场景均通过

在此之前，不认为阶段 3 完成。
