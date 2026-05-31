# 小红书笔记发布优化计划

> 创建日期：2026-05-31
> 目标：全面优化 tweetClaw 的笔记发布能力，覆盖视频、图文、长文、播客四种类型

---

## 一、现状分析

### 1.1 当前实现

| 类型 | 状态 | 说明 |
|------|------|------|
| 图文笔记 | ✅ 已实现 | `POST /web_api/sns/v2/note`，支持标题、正文、图片、话题、隐私 |
| 视频笔记 | ✅ 已实现 | 同上端点，支持标题、正文、视频、隐私 |
| 长文笔记 | 🔲 未实现 | 不同端点，富文本格式 |
| 播客 | 🔲 未实现 | 音频上传，不同端点 |

### 1.2 当前视频发布缺失的参数

从 2.log（creator.xiaohongshu.com 视频发布页面 HTML）分析，当前实现只传了最基础的字段，以下参数均未支持：

**内容设置区：**
- 封面（`cover`）：默认截取第一帧，支持自定义上传或从视频帧选取
- 章节（`chapters`）：视频结构化章节，有助于提升完播率
- 合集（`collection`）：加入已有合集或创建新合集
- 原创声明（`is_original`）：开关 + 内容类型声明下拉
- 活动话题（`activity_topics`）：关联平台活动

**添加组件区：**
- 地点（`poi`）：POI 地理位置
- 群聊（`group`）：关联群聊
- 关联直播预告（`live_preview`）
- 标记地点或朋友（`marker`）
- 添加路线（`travel_route`）

**更多设置区：**
- 可见范围（`privacy_type`）：公开可见 / 仅自己可见（已实现，但枚举值需确认）
- 定时发布（`scheduled_publish_time`）：Unix 时间戳

**正文编辑区：**
- 话题标签（`topics`）：已实现，但需支持推荐话题直接选取
- @用户（`at_users`）：已实现
- 表情（`emoji`）：纯文本，无需特殊处理

---

## 二、四种发布类型对比

| 维度 | 图文 | 视频 | 长文 | 播客 |
|------|------|------|------|------|
| 入口 URL | creator.xiaohongshu.com/publish/publish | 同左 | creator.xiaohongshu.com/publish/article | 待确认 |
| 发布端点 | `/web_api/sns/v2/note` | 同左 | 待抓包 | 待抓包 |
| 媒体上传 | COS 图片 | COS 视频 | 无（富文本内嵌图） | COS 音频 |
| 封面 | 必选图片 | 可选（默认第一帧） | 可选 | 可选 |
| 正文格式 | 纯文本 + 话题 | 纯文本 + 话题 | 富文本（HTML/JSON） | 纯文本 |
| 章节 | 不支持 | 支持 | 不支持 | 不支持 |
| 合集 | 不支持 | 支持 | 支持 | 支持 |

---

## 三、视频发布优化计划（第一阶段）

### 3.1 优先级排序

| 优先级 | 参数 | 说明 | 工时 |
|--------|------|------|------|
| P0 | 封面自定义 | 支持传入封面图片（base64 或已上传的 fileId） | 1h |
| P0 | 可见范围枚举确认 | 确认 `privacy_type` 的合法值（0=公开，1=私密，2=好友可见？） | 0.5h |
| P1 | 定时发布 | 传入 `scheduled_publish_time` Unix 时间戳 | 0.5h |
| P1 | 原创声明 | `is_original` 布尔值 + `original_type` 枚举 | 0.5h |
| P2 | 章节 | `chapters` 数组，每项含 `title` + `time_offset_ms` | 1h |
| P2 | 合集 | `collection_id` 字符串，需先查询已有合集 | 1h |
| P2 | 地点 POI | `poi_id` + `poi_name`，需先调用 POI 搜索 API | 1h |
| P3 | 活动话题 | `activity_id`，需先查询活动列表 | 1h |

### 3.2 需要抓包确认的字段

以下字段在 2.log 中可见 UI 元素，但请求体格式未知，需要抓包：

1. **封面**：上传自定义封面的请求体格式（是 fileId 还是 URL？）
2. **章节**：`chapters` 数组的具体结构
3. **合集**：`collection_id` 的传入方式，以及查询合集列表的 API
4. **原创声明**：`original_type` 的枚举值（图文原创、视频原创等）
5. **定时发布**：`scheduled_publish_time` 的时间格式（秒还是毫秒？）
6. **可见范围**：`privacy_type` 的完整枚举（当前只用了 0 和 1）

### 3.3 当前 `publish_video_note` 请求体结构

```json
{
  "title": "标题",
  "desc": "正文",
  "video": {
    "video_id": "...",
    "duration": 0,
    "width": 0,
    "height": 0,
    "first_frame_fileid": "..."
  },
  "privacy_type": 0,
  "topics": []
}
```

### 3.4 优化后目标请求体结构

```json
{
  "title": "标题",
  "desc": "正文",
  "video": {
    "video_id": "...",
    "duration": 0,
    "width": 0,
    "height": 0,
    "first_frame_fileid": "..."
  },
  "cover": {
    "file_id": "...",
    "width": 0,
    "height": 0
  },
  "privacy_type": 0,
  "topics": [],
  "is_original": false,
  "original_type": null,
  "chapters": [],
  "collection_id": null,
  "poi": {
    "poi_id": null,
    "poi_name": null
  },
  "scheduled_publish_time": null,
  "activity_topics": []
}
```

---

## 四、长文和播客（第二阶段）

### 4.1 长文笔记

长文走 `/publish/article` 路径，正文是富文本（类似 Notion/Tiptap 格式）。

**需要抓包确认：**
- 发布端点 URL
- 正文的 JSON 格式（Tiptap JSON 还是 HTML？）
- 图片内嵌方式（上传后替换为 URL？）
- 是否复用同一个 COS 上传流程

### 4.2 播客

**需要抓包确认：**
- 发布端点 URL
- 音频上传流程（是否复用 COS？）
- 封面图要求
- 是否支持章节

---

## 五、开发步骤

### 第一步：抓包补全视频发布参数

每个待确认字段需要：
1. 在 creator.xiaohongshu.com 手动操作一次
2. 抓取对应的 fetch 请求
3. 记录请求体格式

**抓包清单：**
- [ ] 上传自定义封面
- [ ] 开启原创声明（选择类型）
- [ ] 设置定时发布
- [ ] 添加章节
- [ ] 加入合集
- [ ] 添加地点 POI
- [ ] 设置可见范围（好友可见）

### 第二步：更新 Python API 参数

在 `clawBotCli/clawbot/services/xhs.py` 的 `publish_video_note` 方法中增加可选参数，保持向后兼容。

### 第三步：更新 content script

在 `tweetClaw/src/content/xhs-main-entrance.ts` 的 `publishVideoNote` 函数中，将新参数透传到请求体。

### 第四步：更新测试脚本

更新 `examples/xhs_test_publish_video.py`，支持新参数的测试。

---

## 六、注意事项

1. **封面上传**：封面图需要先通过 COS 上传流程获取 `file_id`，再传入发布接口，不能直接传 base64
2. **章节时间偏移**：`time_offset_ms` 是相对视频开始的毫秒数，需要视频已上传完成才能确定
3. **合集查询**：加入合集前需要先查询用户的合集列表，这是一个额外的读取 API
4. **定时发布**：时间必须是未来时间，建议至少提前 10 分钟
5. **原创声明**：开启后不可撤销，AI 自动发布时需谨慎处理
