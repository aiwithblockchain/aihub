# Instagram 大视频分片上传任务

## 目标
实现 Instagram 大视频的分片上传（chunked upload），替代现有的 base64 全量上传方式，解决大视频内存/超时问题。

## 背景
当前 IG 视频上传流程：Rust/Python → LocalBridge REST → tweetClaw bg → content script → Instagram，视频以 base64 编码在 JSON 中全量传输，大视频会占用大量内存并可能超时。

XHS 已实现的 Task API chunked upload 流程：
1. 创建 Task (`xhs.publish_video`)，inputMode=`chunked_binary`
2. 通过 LocalBridge Task API 分片上传视频（5MB/片）
3. tweetClaw background 的 `BackgroundTaskCoordinator` 拉取分片数据
4. 通过 `bg_session_to_content_session` 传送给 content script
5. content script 边收 chunk 边上传到 XHS COS

IG 需要实现类似的 Task API 流程。

---

## Phase 1: Python 测试代码 + tweetClaw 扩展支持

### 1.1 修改 tweetClaw 扩展

#### 文件：`src/task/task-executor.ts`
- [ ] `SUPPORTED_TASK_KINDS` 数组中新增 `'ig.publish_video'`
- [ ] `resolveTargetTab` 中新增 IG tab 解析逻辑（`instagram.com`）
- [ ] `messageType` 分支中新增 `ig.publish_video` → `'START_IG_PUBLISH_VIDEO_TASK'`

#### 文件：`src/content/main_entrance.ts`
- [ ] 新增 `START_IG_PUBLISH_VIDEO_TASK` 消息 handler
- [ ] 消息 handler 中调用 IG content task runner

#### 文件：`src/content/ig-main-entrance.ts`
- [ ] 新增 `handlePublishVideoTask` 函数：
  - 通过 `GET_UPLOAD_SESSION_CHUNK` 逐步接收视频分片
  - 组装成 `Uint8Array`
  - 调用 `igApi.uploadVideo` / `igApi.configureMedia` 完成上传
  - 通过 `TASK_COMPLETED_FROM_CONTENT` / `TASK_FAILED_FROM_CONTENT` 回传结果
- [ ] 需要处理封面图（thumbnail）数据
- [ ] 需要 video metadata（width, height, duration）

#### 文件：`src/ig_api/ig_api.ts`
- [ ] 确认 `uploadVideo` 支持传入 `Uint8Array`（已支持）
- [ ] 确认 `postMedia` 中的视频流程可以复用或拆分出 uploadVideo + configureMedia 两步

### 1.2 修改 clawbot Python 测试代码

#### 新文件：`clawbot/transport/ig_task_api.py`（或修改现有文件）
- [ ] 新增 `IgTaskApiTransport` 类或函数：
  - `create_task(task_kind="ig.publish_video", input_mode="chunked_binary", params={...})`
  - `upload_chunks(task_id, file_path)` — 分片上传（5MB/片）
  - `seal_task(task_id)`
  - `start_task(task_id)`
  - `poll_task(task_id)` — 轮询直到 completed/failed
  - `get_result(task_id)`
- [ ] 复用现有的 `xhs.py` 中的 `ChunkedUploader` 逻辑

#### 新文件：`examples/ig_test_post_video_large.py`
- [ ] 测试脚本，用法类似 `xhs_publish_video_large.py`
- [ ] 参数：video_path, caption, [thumbnail_path], [disable_comments], [share_to_threads]
- [ ] 调用 `ig.publish_video` Task API 完成上传

#### 修改文件：`clawbot/services/ig.py`
- [ ] 新增 `post_video_large` 方法（或修改 `post_video` 支持大视频）
- [ ] 使用 Task API 替代 base64 REST

### 1.3 Go 代码修改（如需要）

#### 文件：`localBridge/go-lib/pkg/restapi/handler.go`
- [ ] 检查是否需要新增 IG-specific endpoint
- [ ] Task API (`/api/v1/tasks/*`) 是通用的，可能不需要修改
- [ ] 但可能需要确认 `igClaw` bridge 是否能正确转发 IG task 消息

---

## Phase 2: 抓包验证结果（已完成）

### 视频基本信息
- 文件总大小：`22,229,350` bytes（约 21.2MB）
- upload_id：`1781327606271`（毫秒时间戳）
- 视频时长：258.1s，分辨率：1920×1054

### 确认：IG 网页是分片上传

**完整上传序列（共 5 步）：**

**Step 1** — GET 查询当前进度
```
GET https://i.instagram.com/rupload_igvideo/fb_uploader_{upload_id}
Response: {"dc":"nha5c02","offset":0}
```

**Step 2** — POST 上传第 1 片（offset=0，body≈10MB）
```
POST https://i.instagram.com/rupload_igvideo/fb_uploader_{upload_id}
Headers:
  offset: "0"
  x-entity-length: "22229350"          ← 文件总大小（每次都带）
  x-entity-name: "fb_uploader_{upload_id}"
  x-instagram-rupload-params: {upload_id, media_type:2, duration_ms, width, height, ...}
Response: {"debug_info": {"retriable": true, "type": "PartialRequestError"}}   ← 正常，表示继续传
```

**Step 3** — GET 确认进度
```
GET → Response: {"dc":"nha5c02","offset":10000000}
```

**Step 4** — POST 上传第 2 片（offset=10000000，body≈10MB）
```
同上，offset: "10000000"
Response: {"debug_info": {"type": "PartialRequestError"}}
```

**Step 5** — GET 确认进度 → POST 最后一片（offset=20000000，body≈2.2MB）
```
GET → Response: {"dc":"nha5c02","offset":20000000}
POST offset: "20000000"
Response: {"media_id": 1516691906603540, "status": "ok"}   ← 上传完成！
```

**Step 6** — POST 上传封面图（复用同一 upload_id）
```
POST https://i.instagram.com/rupload_igphoto/fb_uploader_{upload_id}
Headers:
  content-type: "image/jpeg"
  offset: "0"
  x-entity-length: "170281"            ← 封面图大小（一次性传完）
  x-entity-type: "image/jpeg"
  x-instagram-rupload-params: {media_type:2, upload_id, height, width}
Response: {"upload_id": "1781327606271", "status": "ok"}
```

**Step 7** — POST configure_to_clips（轮询直到转码完成）
```
POST https://www.instagram.com/api/v1/media/configure_to_clips/
Body (form-urlencoded):
  upload_id=1781327606271&caption=...&disable_comments=0&is_unified_video=1
  &source_type=library&clips_share_preview_to_feed=1&...

Response（前几次）: {"message":"Transcode not finished yet.","status":"fail"}
Response（最终）:   {"media": {...}, "status": "ok"}
```

### 关键规律总结

| 项目 | 值 |
|---|---|
| 分片大小 | **10MB**（10,000,000 bytes） |
| 分片模式 | GET 查 offset → POST 上传 → 循环直到 response 含 `media_id` |
| 上传未完成标志 | `debug_info.type == "PartialRequestError"` |
| 上传完成标志 | response 包含 `media_id` 字段 |
| 封面图上传 | 独立接口 `/rupload_igphoto/`，复用同一 `upload_id`，一次性上传 |
| 转码轮询 | 重复 POST `/configure_to_clips/` 直到 status=ok |
| upload_id 生成 | `Date.now().toString()`（毫秒时间戳） |

---

## Phase 3: Rust 端同步（测试通过后）

#### 文件：`src-tauri/src/publish_to_platform.rs`
- [ ] `publish_ig` 中当 `has_video_path` 为 true 时：
  - 创建 Task `ig.publish_video`
  - 使用 `run_chunked_task` 分片上传
  - params 包含 caption, location, disableComments, shareToThreads, videoMetadata, thumbnail
- [ ] 直接返回 task result

---

## 当前文件引用

### tweetClaw 扩展
- `src/task/task-executor.ts` — BackgroundTaskCoordinator，task 调度核心
- `src/content/content-task-runner.ts` — ContentTaskRunner，通用 task runner
- `src/content/content-upload-executor.ts` — ContentUploadExecutor，X media upload 专用
- `src/content/xhs-main-entrance.ts` — XHS task handler 参考实现（`START_XHS_PUBLISH_VIDEO_TASK`）
- `src/content/ig-main-entrance.ts` — IG content script 入口
- `src/content/main_entrance.ts` — 消息路由总入口
- `src/ig_api/ig_api.ts` — IG API 客户端（`uploadVideo`, `uploadVideoThumbnail`, `configureMedia`）
- `src/ig_api/types.ts` — IG API 类型定义

### clawbot Python
- `clawbot/services/ig.py` — `post_video` 方法
- `clawbot/transport/ig_api.py` — `post_video_raw` REST 调用
- `clawbot/services/xhs.py` — `publish_video_note_large` Task API 参考
- `clawbot/utils/chunked_uploader.py` — 分片上传工具类

### LocalBridge Go
- `go-lib/pkg/restapi/handler.go` — REST handler，已有 `igPostMedia`
- `go-lib/pkg/bridge/bridge.go` — WebSocket bridge

---

## 测试计划

1. **单元测试**：Python 分片上传逻辑（本地 mock LocalBridge）
2. **集成测试**：Python → LocalBridge → tweetClaw → Instagram
3. **大视频测试**：>100MB 视频，验证内存占用和上传时间
4. **对比测试**：base64 REST vs Task API chunked upload

---

## 注意事项

- **封面图**：thumbnail 一般较小（<1MB），可能不需要分片，直接 base64 放入 params
- **视频元数据**：Python 端用 ffprobe 提取 width/height/durationMs，放入 params
- **任务超时**：IG 视频上传可能比 XHS 慢，设置 600s timeout
- **取消机制**：Task API 支持 cancel，上传失败时自动清理
- **错误处理**：每个分片上传失败需要重试（参考 XHS 的 retry 逻辑）

---

*Created: 2026-06-13*
*Owner: @hyperorchid*
*Status: In Progress — Phase 1*
