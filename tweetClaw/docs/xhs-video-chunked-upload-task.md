# XHS 大文件视频发布 — 分片上传任务实现方案

> 创建日期：2026-06-02  
> 背景：`publish_video` 接口将视频 base64 编码后通过 `chrome.tabs.sendMessage` 传输，受 Chrome 64 MiB 消息上限限制，无法发布大文件视频。本方案参照 `x.media_upload` task 链路，为 XHS 实现同等能力。

---

## 一、现有链路回顾（x.media_upload）

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

## 二、需要修改的文件清单

| 层 | 文件 | 改动说明 |
|----|------|----------|
| Background | `src/task/task-executor.ts` | 支持 `xhs.publish_video` task_kind；`resolveTargetTab` 支持小红书 tab |
| Content | `src/content/xhs-main-entrance.ts` | 处理 `START_XHS_PUBLISH_VIDEO_TASK` 消息，调用已有的 `publishVideoNote` |
| Python SDK | `clawbot/services/xhs.py` | 增加 `publish_video_note_large()` 方法，走分片 task 通道 |
| Python SDK | `clawbot/transport/xhs_api.py` | （可选）无需改动，task 通道复用 `TaskApiClient` |

> Go 层（`task_handler.go` / `task/manager.go`）**无需修改**。Task 系统是通用的，`taskKind` 只是一个字符串透传给扩展，Go 层不做 dispatch。

---

## 三、详细修改说明

### 3.1 task-executor.ts — 支持 xhs.publish_video

**位置：** `src/task/task-executor.ts`

#### 改动 1：放开 taskKind 校验（第 76 行）

```typescript
// 原代码
if (request.taskKind !== 'x.media_upload') {
  throw new Error(`Unknown taskKind: ${request.taskKind}`);
}

// 修改后
const SUPPORTED_TASK_KINDS = ['x.media_upload', 'xhs.publish_video'] as const;
type SupportedTaskKind = typeof SUPPORTED_TASK_KINDS[number];

if (!SUPPORTED_TASK_KINDS.includes(request.taskKind as SupportedTaskKind)) {
  throw new Error(`Unknown taskKind: ${request.taskKind}`);
}
```

#### 改动 2：resolveTargetTab 支持 XHS tab（第 237 行）

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

  // 原有 x.com 逻辑
  const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
  const targetTab = xTabs.find(tab => tab.active) || xTabs[0];
  if (!targetTab?.id) {
    throw new Error('No x.com tab found for task execution');
  }
  return targetTab.id;
}
```

#### 改动 3：startTask 中传入 taskKind 给 resolveTargetTab，并发不同消息

```typescript
// 原代码（第 83 行）
const tabId = await this.resolveTargetTab(params.tabId);

// 修改后
const tabId = await this.resolveTargetTab(request.taskKind, params.tabId);

// 原代码（第 109 行）— 发送 START_TASK_UPLOAD_FROM_BG_SESSION
const startResponse = await chrome.tabs.sendMessage(tabId, {
  type: 'START_TASK_UPLOAD_FROM_BG_SESSION',
  ...
});

// 修改后：根据 taskKind 选择消息类型
const messageType = request.taskKind === 'xhs.publish_video'
  ? 'START_XHS_PUBLISH_VIDEO_TASK'
  : 'START_TASK_UPLOAD_FROM_BG_SESSION';

const startResponse = await chrome.tabs.sendMessage(tabId, {
  type: messageType,
  taskId,
  uploadSessionId: session.sessionId,
  mimeType: session.mimeType,
  totalBytes: session.totalBytes,
  transferChunkCount: session.transferChunkCount,
  params      // 包含 title, desc, privacy_type, cover 等发布参数
}).catch((error: any) => {
  throw new Error(`Failed to start content task: ${error?.message || String(error)}`);
});
```

---

### 3.2 xhs-main-entrance.ts — 处理 START_XHS_PUBLISH_VIDEO_TASK

**位置：** `src/content/xhs-main-entrance.ts`

在现有消息监听器（`chrome.runtime.onMessage`）中新增处理分支，复用已有的 `publishVideoNote` 函数：

```typescript
if (message.type === 'START_XHS_PUBLISH_VIDEO_TASK') {
  (async () => {
    const { taskId, uploadSessionId, mimeType, totalBytes, transferChunkCount, params } = message;

    try {
      // 1. 从 bg session 拉取分片数据，拼装成 base64
      const videoBase64 = await assembleVideoFromBgSession(
        uploadSessionId,
        mimeType,
        totalBytes,
        transferChunkCount
      );

      // 2. 汇报进度：数据接收完毕
      chrome.runtime.sendMessage({
        type: 'TASK_PROGRESS_FROM_CONTENT',
        taskId,
        phase: 'uploading',
        progress: 0.2
      });

      // 3. 调用已有的 publishVideoNote（不变）
      const result = await publishVideoNote({
        title: params.title || '',
        desc: params.desc || '',
        video: { base64: videoBase64, mimeType },
        cover: params.cover,
        privacyType: params.privacy_type ?? 0,
        scheduledPublishTime: params.scheduled_publish_time,
      });

      // 4. 上报完成
      chrome.runtime.sendMessage({
        type: 'TASK_COMPLETED_FROM_CONTENT',
        taskId,
        contentType: 'application/json',
        resultBase64: btoa(JSON.stringify(result))
      });

      sendResponse({ success: true });
    } catch (e: any) {
      chrome.runtime.sendMessage({
        type: 'TASK_FAILED_FROM_CONTENT',
        taskId,
        phase: 'publish',
        errorCode: 'PUBLISH_FAILED',
        errorMessage: e?.message || String(e)
      });
      sendResponse({ success: false, error: e?.message });
    }
  })();
  return true;
}
```

**辅助函数 `assembleVideoFromBgSession`：** 负责从 background session store 逐块拉取数据并拼成完整 base64 字符串。可参照 `content-task-runner.ts` 第 131-141 行的分块拉取逻辑，调用 `contentUploadSession` 的 fetch chunk 接口。

> **注意：** `publishVideoNote` 接受的 `video.base64` 字段在 XHS content script 内部会调用 `atob()` 解码。从 bg session 拉取的是二进制分片，需要先 `Uint8Array → base64` 转换后传入。

---

### 3.3 Python SDK — publish_video_note_large()

**位置：** `clawbot/services/xhs.py`

参照 `clawbot/services/media.py` 的 `upload()` 方法：

```python
def publish_video_note_large(
    self,
    file_path: str,
    title: str,
    desc: str,
    privacy_type: int = 0,
    cover_path: Optional[str] = None,
    topics: Optional[List[Dict[str, Any]]] = None,
    scheduled_publish_time: Optional[int] = None,
    instance_id: Optional[str] = None,
    tab_id: Optional[int] = None,
) -> Dict[str, Any]:
    """发布视频笔记（大文件走分片 Task 通道，绕过 Chrome 64 MiB 消息限制）。"""
    import os, json, base64
    from clawbot.errors import MediaUploadError, ParseError, TaskTimeoutError
    from clawbot.upload.chunked_uploader import ChunkedUploader

    if not os.path.exists(file_path):
        raise MediaUploadError(f"File does not exist: {file_path}")

    # 可选封面：小文件，继续走 base64
    cover = None
    if cover_path and os.path.exists(cover_path):
        with open(cover_path, "rb") as f:
            cover = {"base64": base64.b64encode(f.read()).decode(), "mimeType": "image/jpeg"}

    params = {
        "title": title,
        "desc": desc,
        "privacy_type": privacy_type,
        "topics": topics or [],
        "cover": cover,
    }
    if scheduled_publish_time is not None:
        params["scheduled_publish_time"] = scheduled_publish_time
    if tab_id is not None:
        params["tabId"] = tab_id

    task_id = None
    try:
        if not instance_id:
            instance_id = self.task_client.get_default_instance_id("tweetClaw")

        task_id = self.task_client.create_task(
            client_name="tweetClaw",
            instance_id=instance_id,
            task_kind="xhs.publish_video",
            input_mode="chunked_binary",
            params=params,
        )

        uploader = ChunkedUploader(self.task_client)
        total_parts, total_bytes, content_type = uploader.upload_file(task_id, file_path)

        self.task_client.seal_input(task_id, total_parts, total_bytes, content_type)
        self.task_client.start_task(task_id)

        self.task_client.wait_for_completion(task_id, poll_interval=3.0, timeout=600.0)

        result_bytes = self.task_client.get_task_result(task_id)
        return json.loads(result_bytes)

    except Exception as exc:
        if task_id:
            try:
                self.task_client.cancel_task(task_id)
            except Exception:
                pass
        raise
```

`XhsService.__init__` 需要接受 `task_client: TaskApiClient` 参数，与 `MediaService` 同样的注入方式。`ClawBotClient` 在构建 `XhsService` 时传入已有的 `task_client` 实例即可。

---

## 四、调用示例

```python
from clawbot import ClawBotClient

client = ClawBotClient()

# 小文件（< ~48 MB）— 原有接口，base64 inline
result = client.xhs.publish_video_note(
    title="短视频",
    desc="测试",
    video={"base64": video_b64, "mimeType": "video/mp4"},
    privacy_type=1,
)

# 大文件 — 新接口，分片 Task 通道
result = client.xhs.publish_video_note_large(
    file_path="/path/to/video.mov",
    title="大视频测试",
    desc="仅自己可见",
    privacy_type=1,
)
print(result)  # {'success': True, 'data': {'id': '...'}, ...}
```

---

## 五、测试验证步骤

1. **修改并 build 扩展**
   ```bash
   cd /Users/hyperorchid/aiwithblockchain/aihub/tweetClaw
   npm run build
   # 重新加载 chrome://extensions/ 中的 tweetClaw
   ```

2. **用 a.mp4（3 MB）冒烟验证 task 通道**
   ```bash
   python3 -c "
   from clawbot import ClawBotClient
   c = ClawBotClient()
   r = c.xhs.publish_video_note_large(
       '/path/to/a.mp4', title='Task 通道测试', desc='仅自己可见', privacy_type=1
   )
   print(r)
   "
   ```

3. **用 b.mov（138 MB）验证大文件**
   ```bash
   python3 -c "
   from clawbot import ClawBotClient
   c = ClawBotClient()
   r = c.xhs.publish_video_note_large(
       '/path/to/b.mov', title='大文件测试', desc='仅自己可见', privacy_type=1
   )
   print(r)
   "
   ```

4. 验证发布后删除测试笔记
   ```python
   c.xhs.delete_note(note_id=r['data']['id'])
   ```

---

## 六、边界说明

| 场景 | 接口 | 限制 |
|------|------|------|
| 视频 < ~48 MB | `publish_video_note()` | Chrome 消息 64 MiB，base64 膨胀 ~1.33x |
| 视频 ≥ 48 MB | `publish_video_note_large()` | 无大小限制，受网络速度和 600s 超时约束 |
| 封面图片 | 两个接口均支持 | 小文件，继续走 base64 inline |
