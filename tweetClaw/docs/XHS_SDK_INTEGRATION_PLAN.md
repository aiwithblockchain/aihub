# XHS SDK 集成方案：移植到 TweetPilot clawbot

> 创建日期：2026-06-01  
> 目标工程：`~/.tweetpilot/clawbot/`  
> 参考来源：`aihub/localBridge/clawBotCli/`

---

## 一、背景与目标

aihub 工程已完整实现小红书（XHS）的 Python SDK，覆盖读取、写操作、合集管理共 25+ 个 API。  
目标是将这套能力移植到 TweetPilot 的 clawbot 工程，让用户通过统一的 `ClawBotClient` 同时操作 X（Twitter）和小红书。

移植后用法：

```python
from clawbot import ClawBotClient

client = ClawBotClient()

# 小红书操作
client.xhs.get_account_info()
client.xhs.publish_note(title="标题", desc="正文", images=[...])
client.xhs.create_collection(name="我的合集")
```

---

## 二、两个工程的架构对比

| 维度 | TweetPilot clawbot | aihub clawBotCli |
|------|-------------------|-----------------|
| 入口 | `ClawBotClient` | `ClawBotClient` |
| 命名空间 | `client.x.*`（SimpleNamespace） | `client.xhs`（直接挂 service） |
| Transport 基类 | `BaseApiTransport`（requests.Session） | 同一套（直接复用） |
| Service 层 | 按功能拆分（x_read / x_actions / x_status） | 单文件 `XhsService`（统一） |
| Domain 层 | 有 dataclass + parser（XTweet / XUser） | 无，直接返回 raw dict |
| LocalBridge 端口 | 20088（TweetPilot 编译配置） | 10088（aihub 编译配置） |
| 多实例路由 | 有（instanceId 三路透传） | 无（XHS 单账号） |

**结论**：XHS 不需要 domain 解析层（返回 raw dict 已满足需求），直接移植 transport + service 两层即可。

---

## 三、需要新增 / 修改的文件

### 3.1 新增文件（直接从 aihub 复制，路径不变）

```
clawbot/
├── transport/
│   └── xhs_api.py          ← 完整复制 aihub 的 XhsApiTransport（28 个方法）
└── services/
    └── xhs.py              ← 完整复制 aihub 的 XhsService（25 个方法）
```

两个文件**零修改**可直接使用，因为它们只依赖 `BaseApiTransport`，而 TweetPilot clawbot 的 `BaseApiTransport` 与 aihub 完全一致。

### 3.2 修改文件

**`clawbot/config.py`** — 无需修改，XHS 复用同一个 `API_BASE_URL`（20088）。

**`clawbot/client.py`** — 新增 XHS transport + service，挂到 `client.xhs`，复用现有 `base_url`：

```python
from clawbot.transport.xhs_api import XhsApiTransport
from clawbot.services.xhs import XhsService

class ClawBotClient:
    def __init__(self, base_url: str = API_BASE_URL, timeout: int = API_TIMEOUT):
        # 现有 X transport / service（不变）
        ...

        # 新增 XHS，复用同一个 base_url
        self.xhs_transport = XhsApiTransport(base_url=base_url, timeout=timeout)
        self.xhs = XhsService(self.xhs_transport)
```

**`clawbot/__init__.py`** — 无需修改（`ClawBotClient` 已导出，`xhs` 作为属性自动可用）。

### 3.3 新增示例脚本

```
examples/
├── xhs_read_examples.py        ← 读取账号信息、笔记、评论、搜索
├── xhs_write_examples.py       ← 发布图文/视频、点赞、关注、评论
└── xhs_collection_examples.py  ← 合集管理（创建/查询/更新）
```

### 3.4 新增文档

```
clawbot/
└── XHS_README.md               ← XHS 模块使用指南（面向 AI 助手）
```

---

## 四、API 方法清单

移植后 `client.xhs` 上的全部方法：

### 读取操作

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
| `search_users(keyword, page, rows)` | 搜索用户（@用户前置） | |
| `get_intimacy_list()` | 获取好友列表 | |
| `get_friend_fans(cursor, size)` | 获取好友粉丝列表（privacy_type=3 前置） | |

### 写操作

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

### 合集管理

| 方法 | 说明 | 需要 creator tab |
|------|------|:---:|
| `create_collection(name, desc, cover)` | 创建合集 | ✅ |
| `list_collections(cursor)` | 查询合集列表 | ✅ |
| `list_collection_notes(collection_id)` | 查询合集内笔记 | ✅ |
| `update_collection(collection_id, name, ...)` | 更新合集信息 | ✅ |

---

## 五、关键实现细节

### 5.1 端口说明

XHS 和 X 使用**同一个浏览器扩展（tweetClaw）**，走同一个 LocalBridge 实例，因此端口相同。

端口由各工程自己的编译配置决定：

| 工程 | REST API 默认端口 | 配置来源 |
|------|-----------------|---------|
| aihub（本工程） | 10088 | `localBridge/go-lib/pkg/config/config.go` DefaultConfig |
| TweetPilot（目标工程） | 20088 | `src-tauri/src/services/settings_store.rs` DEFAULT_REST_API_PORT |

TweetPilot 的 Go 代码入口是 `localBridge/go-lib/cmd/rust-bridge/main.go`，编译脚本是 `localBridge/go-lib/scripts/build-rust-static.sh`（macOS）和 `build-windows-dll.ps1`（Windows），编译产物以静态库形式链接进 Tauri 应用，端口在 Rust 层通过 `LocalBridgeConfig` 传入 Go。

所以在 TweetPilot clawbot 里，XHS 和 X 的请求都走同一个 `base_url`（20088），**不需要** `xhs_base_url` 这个独立参数。

`ClawBotClient` 的初始化保持现有签名不变：

```python
client = ClawBotClient()  # base_url 默认 http://127.0.0.1:20088，XHS 和 X 共用
```

### 5.2 媒体格式

XHS 媒体上传与 X 完全不同，**不复用** TweetPilot 的 `MediaService`：

- 图片/视频/封面：传 `{"base64": "...", "mimeType": "image/jpeg"}` 给 localBridge
- localBridge 内部完成 COS 上传，Python 层无需感知
- 视频发布时 cover 可选，不传则 XHS 自动截帧

### 5.3 发布参数速查

```python
# 隐私设置
privacy_type=0   # 公开
privacy_type=1   # 仅自己可见
privacy_type=3   # 指定人可见（需先调用 get_friend_fans() 获取 user_id 列表）
privacy_type=4   # 好友可见

# 话题（id 从 search_topics() 获取）
topics=[{"id": "624d11eb000000000101e223", "name": "大模型"}]

# 定时发布（Unix 秒级时间戳，localBridge 自动 ×1000 转毫秒）
scheduled_publish_time=1780418940
```

### 5.4 creator tab 要求

部分 API 需要浏览器中已打开 `creator.xiaohongshu.com` 标签页：
- `get_published_notes`、`delete_note`
- 全部合集管理 API（create / list / list_notes / update）

调用前需确认 creator tab 已打开，否则 localBridge 返回错误。

### 5.5 @ 用户评论两步流程

```python
# 1. 搜索用户，获取带 token 后缀的完整 userid
users = client.xhs.search_users("昵称关键词")

# 2. 发布评论时传入完整 userid
client.xhs.post_comment(
    note_id="xxx",
    content=" @昵称 评论内容",
    at_users=[{"user_id": "完整userid含后缀", "nickname": "昵称"}]
)
```

---

## 六、文档计划

### 6.1 XHS_README.md（面向 AI 助手）

参照 TweetPilot `clawbot/README.md` 的格式，内容包括：

- 4 个边界说明（LocalBridge 是能力源、clawbot 是复用层等）
- 快速开始代码示例
- 按任务类型分组的方法速查
- creator tab 前置条件说明
- 常见任务速查（发布图文、发布视频、创建合集、指定人可见发布）
- 配置说明（端口与 X 共用，即 TweetPilot 工程编译的端口）
- 错误处理

### 6.2 更新 TweetPilot clawbot/README.md

在现有 README 末尾新增一节：

```markdown
## 小红书（XHS）操作

使用 `client.xhs` 命名空间，详见 [XHS_README.md](XHS_README.md)。

快速示例：
client.xhs.get_account_info()
client.xhs.publish_note(title="标题", desc="正文", images=[...])
```

---

## 七、实施步骤

```
步骤 1：复制 transport 文件
  从 aihub/localBridge/clawBotCli/clawbot/transport/xhs_api.py
  到  ~/.tweetpilot/clawbot/clawbot/transport/xhs_api.py
  验证：文件存在，import 无报错

步骤 2：复制 service 文件
  从 aihub/localBridge/clawBotCli/clawbot/services/xhs.py
  到  ~/.tweetpilot/clawbot/clawbot/services/xhs.py
  验证：文件存在，import 无报错

  步骤 3：修改 config.py
  无需修改，XHS 复用同一个 API_BASE_URL

步骤 4：修改 client.py
  新增 XhsApiTransport + XhsService，复用现有 base_url 参数
  挂到 self.xhs
  验证：client.xhs.get_account_info() 可调用（需 LocalBridge 运行）

步骤 5：编写示例脚本
  examples/xhs_read_examples.py
  examples/xhs_write_examples.py
  examples/xhs_collection_examples.py

步骤 6：编写 XHS_README.md
  放到 ~/.tweetpilot/clawbot/XHS_README.md

步骤 7：更新 clawbot/README.md
  末尾新增 XHS 章节入口
```

每步独立可验证，步骤 1-4 是核心，步骤 5-7 是文档补全。

---

## 八、不需要做的事

- **不需要** domain 层（XhsNote / XhsUser dataclass）：XHS API 返回 raw dict 已满足 AI 使用需求，过度封装反而增加维护成本
- **不需要** 多实例路由（instanceId）：XHS 是单账号场景，无此需求
- **不需要** 修改现有 X 相关代码：完全独立，零影响
- **不需要** 新的 BaseApiTransport：两个工程的基类完全一致，直接复用

---

## 九、示例脚本详细设计

aihub 工程已有 23 个经过测试的 `xhs_test_*` 脚本，移植时直接参考这些脚本的模式，**不重新发明**。

### 9.1 脚本模式（所有测试脚本统一遵循）

```python
#!/usr/bin/env python3
"""功能说明
Usage:
  python3 examples/xhs_xxx.py [args]
"""

import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from clawbot import ClawBotClient

client = ClawBotClient()

result = client.xhs.<method>(...)
print(f"Success: {result.get('success')}")

if result.get("success"):
    data = result.get("data", {})
    # 打印关键字段
else:
    print(f"Error: {result.get('error', 'Unknown error')}")
    print(json.dumps(result, ensure_ascii=False, indent=2))
```

**注意**：TweetPilot 工程中脚本不需要 `sys.path.insert`，因为 TweetPilot 会注入 `PYTHONPATH`。但为了兼容直接运行，保留这行无害。

### 9.2 aihub 已有测试脚本清单（全部测试通过，直接参考）

| 脚本文件 | 对应方法 | 关键参数 |
|---------|---------|---------|
| `xhs_test_1_account.py` | `get_account_info()` | 无 |
| `xhs_test_1_homefeed.py` | `get_homefeed(cursor_score)` | 演示翻页 |
| `xhs_test_2_mentions.py` | `get_notifications("mentions")` | 无 |
| `xhs_test_3_likes_notif.py` | `get_notifications("likes")` | 无 |
| `xhs_test_4_published_notes.py` | `get_published_notes()` | 需 creator tab |
| `xhs_test_5_comments.py` | `get_note_comments(note_id)` | 自动从 homefeed 取 note_id |
| `xhs_test_6_pagination.py` | `get_published_notes(cursor)` | 演示翻页 |
| `xhs_test_7_feed.py` | `get_feed(note_id)` | 自动从 homefeed 取 note_id |
| `xhs_test_8_user_notes.py` | `get_user_notes(user_id)` | 自动从 homefeed 取 user_id |
| `xhs_test_9_user_info.py` | `get_user_info(user_id)` | 自动从 homefeed 取 user_id |
| `xhs_test_10_search_topics.py` | `search_topics(keyword)` | 默认 keyword=美食 |
| `xhs_test_11_search.py` | `search(keyword)` | 演示翻页 |
| `xhs_test_12_search_filter.py` | `search_filter(keyword)` | 默认 keyword=美食 |
| `xhs_test_13_post_comment.py` | `post_comment(note_id, content)` | 支持 @用户，含昵称解析逻辑 |
| `xhs_test_14_search_users.py` | `search_users(keyword)` | 默认 keyword=大梦 |
| `xhs_test_15_intimacy_list.py` | `get_intimacy_list()` | 无 |
| `xhs_test_16_like_note.py` | `like_note(note_id)` | 命令行传 note_id |
| `xhs_test_17_follow_user.py` | `follow_user(target_user_id)` | rid（不含 hash 后缀） |
| `xhs_test_18_delete_comment.py` | `delete_comment(note_id, comment_id)` | 两个参数 |
| `xhs_test_19_unlike_note.py` | `unlike_note(note_id)` | 命令行传 note_id |
| `xhs_test_20_unfollow_user.py` | `unfollow_user(target_user_id)` | rid（不含 hash 后缀） |
| `xhs_test_21_collect_note.py` | `collect_note(note_id)` | 命令行传 note_id |
| `xhs_test_22_delete_note.py` | `delete_note(note_id)` | 需 creator tab |
| `test_xhs_publish_video.py` | `publish_video_note(...)` | 完整参数：话题/隐私/定时/封面 |
| `test_xhs_collection.py` | 合集管理全部方法 | `--action list/create/list_notes/update/friend_fans` |

### 9.3 移植到 TweetPilot 的示例脚本规划

将上述 25 个脚本合并为 3 个综合示例文件，每个文件覆盖一个功能域：

**`examples/xhs_read_examples.py`**
- 演示：account_info → homefeed（含翻页）→ feed → search（含翻页）→ user_notes → user_info → comments → notifications → published_notes → search_topics → search_filter
- 自动串联：从 homefeed 取 note_id / user_id，无需手动传参

**`examples/xhs_write_examples.py`**
- 演示：like_note → unlike_note → follow_user → unfollow_user → collect_note → post_comment（含 @用户）→ delete_comment
- 参数通过命令行传入，附带 Usage 说明

**`examples/xhs_publish_examples.py`**
- 演示：publish_note（图文）→ publish_video_note（视频，含话题/隐私/定时/封面）
- 完整参数示例，含 `resolve_topics()` 辅助函数（从 aihub `test_xhs_publish_video.py` 直接复用）

**`examples/xhs_collection_examples.py`**
- 直接复制 aihub `test_xhs_collection.py`，仅去掉 `sys.path.insert` 行
- 支持 `--action list/create/list_notes/update/friend_fans`

### 9.4 关键实现细节（来自测试脚本）

**`get_feed` / `get_note_comments` / `get_user_notes` 需要 `xsec_token`**

这个 token 从 homefeed 或 search 结果中获取，不是固定值：

```python
# 从 homefeed 取 note_id + xsec_token
items = client.xhs.get_homefeed()["data"]["items"]
note_id = items[0]["id"]
xsec_token = items[0]["xsec_token"]

# 再调用详情
client.xhs.get_feed(note_id=note_id, xsec_token=xsec_token)
client.xhs.get_note_comments(note_id=note_id, xsec_token=xsec_token)
```

**`follow_user` / `unfollow_user` 使用 `rid`（不含 hash 后缀）**

```python
# search_users 返回两个 ID 字段：
# - rid: 真实用户 ID，用于 follow/unfollow
# - userid: 带 hash 后缀的完整 ID，用于 @用户评论
items = client.xhs.search_users("昵称")["data"]["items"]
rid = items[0]["rid"]          # 用于 follow_user
userid = items[0]["userid"]    # 用于 post_comment at_users
```

**`post_comment` @用户的昵称解析**

`xhs_test_13_post_comment.py` 中实现了 `resolve_at_user_by_nickname()` 函数，通过 `get_intimacy_list()` 按昵称精确匹配获取完整 userid。这个函数值得在 `xhs_write_examples.py` 中保留。

**`search_topics` 返回字段名不固定**

测试脚本中用了多个字段名兜底：

```python
topics = data.get("topic_dto_list") or data.get("topic_info_dtos") or data.get("topics") or []
```

移植时保留这个兜底逻辑。

**`search_filter` 返回字段名同样不固定**

```python
filters = data.get("filters") or data.get("filter_items") or []
items = group.get("filter_tags") or group.get("items") or []
```
