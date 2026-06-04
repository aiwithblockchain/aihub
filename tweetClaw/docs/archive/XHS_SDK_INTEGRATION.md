# XHS SDK 集成技术文档

> 文档类型：技术参考 | 归档日期：2026-06-04

---

## 一、架构概述

XHS SDK 采用 Transport + Service 两层架构，与 X SDK 共享 `BaseApiTransport` 基类。

### 1.1 模块结构

```
clawbot/
├── transport/
│   ├── base_api.py      # 基类（X 和 XHS 共用）
│   ├── x_api.py         # X Transport
│   └── xhs_api.py       # XHS Transport（28 个方法）
└── services/
    ├── x_read.py        # X 读取服务
    ├── x_actions.py     # X 写操作服务
    ├── x_status.py      # X 状态服务
    └── xhs.py           # XHS 服务（25 个方法）
```

### 1.2 客户端集成

```python
from clawbot import ClawBotClient

client = ClawBotClient()

# X 操作
client.x.read.get_home_timeline()
client.x.actions.post_tweet(text="Hello")

# XHS 操作
client.xhs.get_account_info()
client.xhs.publish_note(title="标题", desc="正文", images=[...])
```

---

## 二、端口配置

XHS 和 X 使用同一个浏览器扩展（tweetClaw），走同一个 LocalBridge 实例。

| 工程 | REST API 默认端口 | 配置来源 |
|------|-----------------|---------|
| aihub | 10088 | `localBridge/go-lib/pkg/config/config.go` |
| TweetPilot | 20088 | `src-tauri/src/services/settings_store.rs` |

---

## 三、API 方法清单

### 3.1 读取操作

| 方法 | 说明 | 需要 creator tab |
|------|------|:---:|
| `get_account_info()` | 获取当前账号信息 | |
| `get_homefeed(cursor_score)` | 获取主页推荐 feed | |
| `get_feed(note_id)` | 获取笔记详情 | |
| `search(keyword, cursor, page_size)` | 搜索笔记 | |
| `get_user_notes(user_id, cursor)` | 获取他人发布笔记 | |
| `get_user_info(user_id)` | 获取他人用户信息 | |
| `get_note_comments(note_id, cursor)` | 获取笔记评论 | |
| `get_notifications(notif_type, cursor)` | 获取消息通知 | |
| `get_published_notes(cursor)` | 获取自己已发布笔记 | ✅ |
| `search_topics(keyword)` | 搜索话题 | |
| `search_filter(keyword)` | 获取搜索筛选器 | |
| `search_users(keyword, page, rows)` | 搜索用户 | |
| `get_intimacy_list()` | 获取好友列表 | |
| `get_friend_fans(cursor, size)` | 获取好友粉丝列表 | |

### 3.2 写操作

| 方法 | 说明 | 需要 creator tab |
|------|------|:---:|
| `publish_note(title, desc, images, ...)` | 发布图文笔记 | |
| `publish_video_note(title, desc, video, ...)` | 发布视频笔记 | |
| `post_comment(note_id, content, ...)` | 发布/回复评论 | |
| `like_note(note_id)` | 点赞笔记 | |
| `unlike_note(note_id)` | 取消点赞 | |
| `follow_user(target_user_id)` | 关注用户 | |
| `unfollow_user(target_user_id)` | 取消关注 | |
| `collect_note(note_id)` | 收藏笔记 | |
| `delete_note(note_id)` | 删除笔记 | ✅ |
| `delete_comment(note_id, comment_id)` | 删除评论 | |

### 3.3 合集管理

| 方法 | 说明 | 需要 creator tab |
|------|------|:---:|
| `create_collection(name, desc, cover)` | 创建合集 | ✅ |
| `list_collections(cursor)` | 查询合集列表 | ✅ |
| `list_collection_notes(collection_id)` | 查询合集内笔记 | ✅ |
| `update_collection(collection_id, name, ...)` | 更新合集信息 | ✅ |

---

## 四、媒体格式

XHS 媒体上传与 X 完全不同，不复用 `MediaService`：

- 图片/视频/封面：传 `{"base64": "...", "mimeType": "image/jpeg"}` 给 LocalBridge
- LocalBridge 内部完成 COS 上传，Python 层无需感知
- 视频发布时 cover 可选，不传则 XHS 自动截帧

---

## 五、发布参数

### 5.1 隐私设置

```python
privacy_type=0   # 公开
privacy_type=1   # 仅自己可见
privacy_type=3   # 指定人可见（需先调用 get_friend_fans() 获取 user_id 列表）
privacy_type=4   # 好友可见
```

### 5.2 话题

```python
# id 从 search_topics() 获取
topics=[{"id": "624d11eb000000000101e223", "name": "大模型"}]
```

### 5.3 定时发布

```python
# Unix 秒级时间戳，localBridge 自动 ×1000 转毫秒
scheduled_publish_time=1780418940
```

---

## 六、Creator Tab 要求

部分 API 需要在小红书创作者中心页面执行：

| API | 页面要求 |
|-----|---------|
| `get_published_notes` | `creator.xiaohongshu.com/publish/publish` |
| `delete_note` | `creator.xiaohongshu.com/publish/publish` |
| `create_collection` | `creator.xiaohongshu.com/publish/publish` |
| `list_collections` | `creator.xiaohongshu.com/publish/publish` |
| `list_collection_notes` | `creator.xiaohongshu.com/publish/publish` |
| `update_collection` | `creator.xiaohongshu.com/publish/publish` |

---

## 七、Transport 层实现

### 7.1 XhsApiTransport 关键方法

```python
class XhsApiTransport(BaseApiTransport):
    # 账号信息
    def get_account_info(self) -> Dict
    
    # Feed 相关
    def get_homefeed(self, cursor_score: str = "") -> Dict
    def get_feed(self, note_id: str) -> Dict
    
    # 搜索
    def search(self, keyword: str, cursor: str = "", page_size: int = 20) -> Dict
    def search_topics(self, keyword: str) -> Dict
    def search_users(self, keyword: str, page: int = 1, rows: int = 10) -> Dict
    
    # 用户相关
    def get_user_notes(self, user_id: str, cursor: str = "") -> Dict
    def get_user_info(self, user_id: str) -> Dict
    
    # 评论
    def get_note_comments(self, note_id: str, cursor: str = "") -> Dict
    def post_comment(self, note_id: str, content: str, **kwargs) -> Dict
    
    # 发布
    def publish_note(self, title: str, desc: str, images: List, **kwargs) -> Dict
    def publish_video_note(self, title: str, desc: str, video: Dict, **kwargs) -> Dict
    
    # 互动
    def like_note(self, note_id: str) -> Dict
    def follow_user(self, target_user_id: str) -> Dict
    
    # 合集
    def create_collection(self, name: str, **kwargs) -> Dict
    def list_collections(self, cursor: str = "") -> Dict
```

---

## 八、Service 层实现

### 8.1 XhsService 结构

```python
class XhsService:
    def __init__(self, transport: XhsApiTransport):
        self._t = transport
    
    # 所有方法直接透传到 transport
    def get_account_info(self) -> Dict:
        return self._t.get_account_info()
    
    def publish_note(self, title: str, desc: str, images: List, **kwargs) -> Dict:
        return self._t.publish_note(title, desc, images, **kwargs)
```

---

## 九、示例代码

### 9.1 发布图文笔记

```python
from clawbot import ClawBotClient

client = ClawBotClient()

result = client.xhs.publish_note(
    title="我的笔记标题",
    desc="这是笔记正文内容",
    images=[
        {"base64": base64_image_data, "mimeType": "image/jpeg"}
    ],
    privacy_type=0,  # 公开
    topics=[{"id": "xxx", "name": "话题名"}]
)
```

### 9.2 发布视频笔记

```python
result = client.xhs.publish_video_note(
    title="视频标题",
    desc="视频描述",
    video={"base64": base64_video_data, "mimeType": "video/mp4"},
    cover={"base64": base64_cover_data, "mimeType": "image/jpeg"},  # 可选
    privacy_type=0
)
```

### 9.3 搜索与互动

```python
# 搜索笔记
results = client.xhs.search("关键词", page_size=20)

# 点赞
client.xhs.like_note(note_id="xxx")

# 关注
client.xhs.follow_user(target_user_id="xxx")
```