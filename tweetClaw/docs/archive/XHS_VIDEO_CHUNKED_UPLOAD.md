# XHS 大文件视频发布 — 分片上传技术文档

> 文档类型：技术参考 | 归档日期：2026-06-04

---

## 一、架构概述

XHS 大文件视频发布采用分片上传机制，绕过 Chrome 64 MiB 消息上限限制。该架构参照 `x.media_upload` task 链路设计。

### 1.1 数据流

```
Python SDK
  └─ ChunkedUploader.upload_file()        # 5 MB/片分片上传到 LocalBridge
  └─ TaskApiClient.seal_input()           # 标记上传完成
  └─ TaskApiClient.start_task()           # 触发执行
       │
       ▼
LocalBridge Go（task_handler.go）
  └─ StartTask()                          # 读取 inputRef，通过 WebSocket 发 request.start_task
       │
       ▼
tweetClaw Background（task-executor.ts）
  └─ BackgroundTaskCoordinator.startTask()
       └─ dataFetcher.fetchAndChunkTaskInput()   # 从 LocalBridge REST 拉取分片数据
       └─ chrome.tabs.sendMessage(xTab, START_TASK_UPLOAD_FROM_BG_SESSION)
            │
            ▼
       tweetClaw Content（content-task-runner.ts / content-upload-executor.ts）
            └─ 接收 bg session 数据块
            └─ executeDirectUpload / executeFromContentSession  # 调用 X 上传接口
            └─ TASK_COMPLETED_FROM_CONTENT → background → LocalBridge
```

---

## 二、模块职责

| 层 | 文件 | 职责 |
|----|------|------|
| Background | `src/task/task-executor.ts` | Task 调度、tab 解析、消息路由 |
| Content | `src/content/xhs-main-entrance.ts` | 处理 XHS 发布消息、调用发布接口 |
| Python SDK | `clawbot/services/xhs.py` | 分片上传、task 触发 |
| Go 层 | `task_handler.go` / `task/manager.go` | Task 通用管理（无需修改） |

---

## 三、关键实现

### 3.1 task-executor.ts — Task Kind 支持

**支持的 Task Kind：**

```typescript
const SUPPORTED_TASK_KINDS = ['x.media_upload', 'xhs.publish_video'] as const;
type SupportedTaskKind = typeof SUPPORTED_TASK_KINDS[number];
```

**Tab 解析逻辑：**

```typescript
private async resolveTargetTab(taskKind: string, preferredTabId?: number): Promise<number> {
  if (preferredTabId) {
    return preferredTabId;
  }

  if (taskKind === 'xhs.publish_video') {
    const xhsTabs = await chrome.tabs.query({
      url: ['*://www.xiaohongshu.com/*', '*://xiaohongshu.com/*']
    });
    const targetTab = xhsTabs.find(tab => tab.active) || xhsTabs[0];
    if (!targetTab?.id) {
      throw new Error('No xiaohongshu.com tab found for task execution');
    }
    return targetTab.id;
  }

  // x.com 逻辑
  const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
  const targetTab = xTabs.find(tab => tab.active) || xTabs[0];
  if (!targetTab?.id) {
    throw new Error('No x.com tab found for task execution');
  }
  return targetTab.id;
}
```

**消息类型选择：**

```typescript
const messageType = request.taskKind === 'xhs.publish_video'
  ? 'START_XHS_PUBLISH_VIDEO_TASK'
  : 'START_TASK_UPLOAD_FROM_BG_SESSION';
```

### 3.2 xhs-main-entrance.ts — 消息处理

**消息结构：**

```typescript
interface XhsPublishVideoTask {
  type: 'START_XHS_PUBLISH_VIDEO_TASK';
  taskId: string;
  uploadSessionId: string;
  mimeType: string;
  totalBytes: number;
  transferChunkCount: number;
  params: {
    title?: string;
    desc?: string;
    cover?: { base64: string; mimeType: string };
    privacy_type?: number;
    scheduled_publish_time?: number;
  };
}
```

**处理流程：**

1. 从 bg session 拉取分片数据，拼装成 base64
2. 汇报进度（phase: 'uploading', progress: 0.2）
3. 调用 `publishVideoNote` 发布
4. 上报完成或失败

### 3.3 Python SDK — 分片上传

**方法签名：**

```python
def publish_video_note_large(
    self,
    title: str,
    desc: str,
    video_path: str,
    cover: Optional[Dict] = None,
    privacy_type: int = 0,
    scheduled_publish_time: Optional[int] = None,
    topics: Optional[List[Dict]] = None,
    at_users: Optional[List[str]] = None,
    chunk_size: int = 5 * 1024 * 1024,  # 5 MB
) -> Dict:
```

**实现要点：**
- 使用 `ChunkedUploader` 分片上传视频文件
- 调用 `seal_input()` 标记上传完成
- 调用 `start_task()` 触发扩展执行发布

---

## 四、数据格式

### 4.1 发布参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `title` | string | 笔记标题 |
| `desc` | string | 笔记正文 |
| `video` | `{base64, mimeType}` | 视频数据 |
| `cover` | `{base64, mimeType}` | 封面（可选） |
| `privacy_type` | int | 隐私设置（0=公开, 1=仅自己, 3=指定人, 4=好友） |
| `scheduled_publish_time` | int | 定时发布时间戳（秒） |
| `topics` | `[{id, name}]` | 话题列表 |
| `at_users` | `[userId]` | @用户列表 |

### 4.2 进度上报

```typescript
// 进度消息
{
  type: 'TASK_PROGRESS_FROM_CONTENT',
  taskId: string,
  phase: 'uploading' | 'publishing',
  progress: number  // 0.0 - 1.0
}

// 完成消息
{
  type: 'TASK_COMPLETED_FROM_CONTENT',
  taskId: string,
  contentType: 'application/json',
  resultBase64: string  // JSON 结果的 base64 编码
}

// 失败消息
{
  type: 'TASK_FAILED_FROM_CONTENT',
  taskId: string,
  phase: string,
  errorCode: string,
  errorMessage: string
}
```

---

## 五、注意事项

1. **Base64 转换**：从 bg session 拉取的二进制分片需先转换为 base64 字符串
2. **MIME Type**：视频需正确传递 mimeType（如 `video/mp4`）
3. **Tab 检测**：发布前需确保有活跃的小红书 tab
4. **错误处理**：所有阶段失败都需通过 `TASK_FAILED_FROM_CONTENT` 上报