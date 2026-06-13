# Instagram 大视频分片上传 — 技术说明

> 状态：**已实现并测试通过**（2026-06-13）
> 实测结果：21.2 MB 视频，312 秒完成，Reel URL: https://www.instagram.com/reel/DZhONHgxT2Z/

---

## 架构概览

Chrome 扩展消息通道上限约 64 MiB，视频数据不能通过常规消息全量传输。解决方案：

```
Python/Rust
  └─ LocalBridge Task API（分片上传，5 MB/片）
       └─ BackgroundTaskCoordinator（background service worker）
            └─ START_IG_PUBLISH_VIDEO_TASK → ig-main-entrance.ts（content script）
                 ├─ GET_UPLOAD_SESSION_CHUNK × N   （按需从 bg 拉取分片）
                 ├─ POST rupload_igvideo（10 MB IG chunk × N）
                 ├─ POST rupload_igphoto（封面图）
                 └─ POST /api/v1/media/configure_to_clips/（轮询转码）
```

---

## 抓包协议分析（Phase 2 结论）

### 视频分片上传（rupload_igvideo）

**分片大小：10 MB**（代码中为 `10 * 1024 * 1024 = 10485760` bytes）

**循环流程：GET offset → POST chunk → 重复直到 media_id**

```
GET https://i.instagram.com/rupload_igvideo/fb_uploader_{upload_id}
← {"dc":"nha5c02","offset":0}

POST https://i.instagram.com/rupload_igvideo/fb_uploader_{upload_id}
  Headers:
    offset: "0"
    x-entity-length: "22229350"           ← 文件总大小，每次都带
    x-entity-name: "fb_uploader_{upload_id}"
    x-instagram-rupload-params: {         ← JSON 序列化后 URL encode
      upload_id, media_type:2,
      upload_media_duration_ms, upload_media_width, upload_media_height,
      is_clips_video:"1", client-passthrough:"1",
      video_edit_params: {trim_start, trim_end, crop_x1, crop_y1, ...}
    }
← {"debug_info":{"type":"PartialRequestError"}}   ← 继续传

GET → {"offset":10485760}

POST offset=10485760 ... （第 2 片）
← {"debug_info":{"type":"PartialRequestError"}}

GET → {"offset":20971520}

POST offset=20971520 size=1257830 （最后一片）
← {"media_id":2078470073092713,"status":"ok"}     ← 上传完成
```

### 封面图上传（rupload_igphoto）

复用同一 `upload_id`，一次性上传（无需分片）：

```
POST https://i.instagram.com/rupload_igphoto/fb_uploader_{upload_id}
  Headers:
    content-type: "image/jpeg"
    offset: "0"
    x-entity-length: "159615"
    x-entity-type: "image/jpeg"
    x-instagram-rupload-params: {media_type:2, upload_id, width, height}
← {"upload_id":"1781338714644","status":"ok"}
```

### configure_to_clips（转码轮询）

```
POST https://www.instagram.com/api/v1/media/configure_to_clips/
  Body (form-urlencoded):
    upload_id=...&caption=...&disable_comments=0&is_unified_video=1
    &source_type=library&clips_share_preview_to_feed=1&...

← {"message":"Transcode not finished yet.","status":"fail"}  （前几次，正常）
← {"media":{...},"status":"ok"}                              （转码完成）
```

**实测：约 6 次重试，每次随机间隔 5-15s，总等待约 60-90s。**

---

## 关键实现文件

| 文件 | 职责 |
|------|------|
| `src/task/task-executor.ts` | `SUPPORTED_TASK_KINDS` 含 `ig.publish_video`；解析 instagram.com tab；发送 `START_IG_PUBLISH_VIDEO_TASK` |
| `src/content/ig-main-entrance.ts` | 接收 `START_IG_PUBLISH_VIDEO_TASK`；调用 `handlePublishVideoTask`；通过 `GET_UPLOAD_SESSION_CHUNK` 从 bg 拉取分片；驱动 IG 上传全流程 |
| `src/ig_api/ig_api.ts` | `uploadVideoChunked(getChunk, totalBytes, uploadId, ...)` — 10 MB 分片循环；`uploadVideoThumbnail` — 封面图上传；`configureVideo` — configure_to_clips 轮询 |

### upload_id 生成

```typescript
const uploadId = Date.now().toString();  // 毫秒时间戳，如 "1781338714644"
```

### getChunk 回调（content script 侧）

content script 本身没有完整视频数据，通过消息从 bg session 按需拉取：

```typescript
const getChunk = async (offset: number, size: number): Promise<Uint8Array> => {
  // 从累积 buffer 中消费，不够时向 bg 请求下一个 transfer chunk
  while (buffer.length < size && fetchedChunks < transferChunkCount) {
    const resp = await chrome.runtime.sendMessage({
      type: 'GET_UPLOAD_SESSION_CHUNK',
      uploadSessionId,
      chunkIndex: fetchedChunks,
    });
    // 拼接到 buffer...
  }
  const result = buffer.slice(0, size);
  buffer = buffer.slice(size);
  return result;
};
```

**注意**：Python 端分片大小（5 MB）与 IG rupload 分片大小（10 MB）不同。`getChunk` 内部会把 2 个 Python 分片拼成 1 个 10 MB IG chunk。

---

## Task API 参数（Python → LocalBridge）

```json
{
  "clientName": "tweetClaw",
  "instanceId": "<instance_uuid>",
  "taskKind": "ig.publish_video",
  "inputMode": "chunked_binary",
  "params": {
    "caption": "文案",
    "videoDuration": 258100,
    "videoWidth": 1920,
    "videoHeight": 1054,
    "disableComments": false,
    "shareToThreads": true,
    "thumbnailBase64": "<可选，base64 JPEG/PNG>"
  }
}
```

---

## 实测数据

| 指标 | 值 |
|------|------|
| 视频大小 | 21.2 MB（22,229,350 bytes） |
| IG rupload 分片 | 3 片（10 MB + 10 MB + 1.2 MB） |
| Python → LocalBridge 分片 | 5 片（5 MB × 4 + 1.2 MB） |
| 视频上传耗时 | ~207s（~3.5 min） |
| 封面图上传耗时 | ~3s |
| configure_to_clips 等待 | ~96s（6 次轮询） |
| **全流程总耗时** | **312s（~5.2 min）** |
| Media ID | `3918475624859385241_27233003055` |
| Shortcode | `DZhONHgxT2Z` |

---

## 注意事项

- **不要关闭 instagram.com 页签**：上传过程中 content script 必须存活
- **Service worker 重启**：若 SW 在上传途中重启（如点击"更新扩展"），当前上传任务会中断；fetch 到 Instagram 的请求可能仍完成，但任务状态无法回报
- **封面图**：不提供时 `ig_api.ts` 自动生成纯色默认封面（1×1 JPEG）
- `upload_id` 在视频上传和封面图上传中必须一致
- `configure_to_clips` 的 `trim_end` 单位是秒（`duration / 1000`）
