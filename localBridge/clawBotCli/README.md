# ClawBot CLI / clawbot 类库

本目录正在从“REST API 测试工具集”重构为“可复制到其它工程中的 Python 类库”。

当前目录内同时包含两部分内容：

1. **新类库主体**：`clawbot/`
2. **历史测试脚本与兼容文件**：`tests/`、`utils/`、`openclaw.py`

最终目标是让外部工程复制 `clawbot/` 目录后，可以直接这样使用：

```python
from clawbot import ClawBotClient

client = ClawBotClient()
status = client.x.status.get_status()
tweets = client.x.timeline.list_timeline_tweets()
```

---

## 新类库结构

```text
clawbot/
├── __init__.py
├── client.py
├── config.py
├── errors.py
├── transport/
├── domain/
├── services/
├── workflows/
└── upload/
```

---

## 快速开始

```bash
cd localBridge/clawBotCli
pip install -r requirements.txt
```

示例：

```python
from clawbot import ClawBotClient

client = ClawBotClient()
print(client.x.status.is_logged_in())
```

---

## 迁移期兼容层说明

当前 `utils/` 目录仍然保留，但角色已经变为：

- **兼容层**
- **过渡层**
- **旧脚本/旧测试的适配层**

对于新代码、复制到其它工程后的代码、以及 AI 新增功能，**应优先直接使用 `clawbot/` 目录下的类库接口**，而不是继续从 `utils/` 扩展。

推荐新代码入口：

```python
from clawbot import ClawBotClient
```

不推荐再作为新开发主入口的旧路径：

```python
from utils.api_client import APIClient
```

---

## 作为类库复制到其它工程中使用

推荐的目标形态是：将 `clawbot/` 目录复制到其它 Python 工程中，并在目标工程里直接使用。

### 复制方式

假设你要把它复制到另一个项目：

```text
other_project/
├── app/
├── clawbot/
└── main.py
```

然后在目标工程中：

```python
from clawbot import ClawBotClient

client = ClawBotClient()
print(client.x.status.is_logged_in())
```

### 推荐给 AI 的扩展入口

当 AI 基于该类库开发新功能时，优先从以下入口扩展：

- `client.x.status`：状态与实例检查
- `client.x.timeline`：时间线读取
- `client.x.tweets`：推文详情与回复读取
- `client.x.users`：用户资料与置顶推文
- `client.x.search`：搜索能力
- `client.x.actions`：点赞、回复、发帖、关注等动作
- `client.media`：上传媒体并发帖/回复
- `client.ai.chat`：AI 平台对话
- `client.workflows`：可直接复用的组合工作流

### 最小使用示例

```python
from clawbot import ClawBotClient

client = ClawBotClient()

if client.x.status.is_logged_in():
    tweets = client.x.timeline.list_timeline_tweets()
    if tweets:
        print(tweets[0].text)
```

### AI 继续开发新功能的建议方式

例如可以继续新增：

- 自动读取时间线并筛选目标推文
- 自动搜索用户并抓取资料
- 自动生成回复并互动
- 上传媒体后自动发帖
- 基于 `client.workflows` 封装新的业务流程

---

## media/task 错误语义

为了让 `clawbot/` 作为可复制类库在其它工程中稳定使用，media/task 子系统的异常约定如下：

### `TaskApiClient`

- 配置文件不存在：返回空配置，不报错
- 配置文件 JSON 非法：抛出 `ParseError`
- 创建任务响应缺少 `taskId`：抛出 `ParseError`
- 轮询任务状态响应缺少 `state`：抛出 `ParseError`
- 任务状态为 `failed` 或 `cancelled`：抛出 `MediaUploadError`
- 任务超过超时时间：取消任务后抛出 `TaskTimeoutError`

### `MediaService.upload()`

- 本地文件不存在：抛出 `MediaUploadError`
- 任务结果不是合法 JSON：抛出 `ParseError`
- 任务结果缺少 `mediaId`：抛出 `MediaUploadError`
- 下层抛出的 `TaskTimeoutError`：保持原样继续向上抛出，不包装成别的异常
- 其它未知异常：统一包装成 `MediaUploadError`

### `MediaService.post_tweet()` / `reply_with_media()`

- 上传阶段失败：直接向上抛出异常，不继续调用动作层
- 动作层（`create_tweet` / `reply`）异常：保持原样继续向上抛出
- 只有成功上传且带有非空 `media_id` 的媒体，才会传给动作层

这意味着外部工程在接入时可以按下面方式区分处理：

```python
from clawbot.errors import MediaUploadError, ParseError, TaskTimeoutError

try:
    client.media.post_tweet("hello", ["a.png"])
except TaskTimeoutError:
    # 可重试：任务执行超时
    pass
except ParseError:
    # 接口返回结构不符合约定，需要排查服务端/协议变化
    pass
except MediaUploadError:
    # 上传流程本身失败，如任务失败、mediaId 缺失、文件不存在等
    pass
```

---

## 示例脚本

已新增示例目录：

- `examples/read_timeline.py`
- `examples/publish_tweet.py`
- `examples/reply_with_media.py`
- `examples/ai_reply_pinned_tweet.py`

---

## 重构实施文档

本次重构相关文档见：

- `重构实施清单.md`
- `最小复制包说明.md`
- `交付清单.md`

---

## 历史内容说明

现有 `tests/`、`utils/`、`openclaw.py` 仍保留，作为迁移过程中的参考与兼容来源。后续会逐步将其中能力迁移到 `clawbot/` 类库结构中。

如需查看新的使用方式与交付边界，优先参考：

- `examples/`
- `重构实施清单.md`
- `最小复制包说明.md`
- `交付清单.md`

---

## 配置

默认配置在 [config.py](config.py)：

```python
API_BASE_URL = "http://127.0.0.1:10088"
API_TIMEOUT = 30  # 秒
```

可根据需要修改。

---

## 📂 目录结构

```
clawBotCli/
├── README.md              # 本文件
├── requirements.txt       # Python 依赖
├── config.py             # 配置文件
├── tests/                # 测试脚本目录
│   ├── test_metadata.py           # TEST-002
│   ├── test_basic_read.py         # TEST-003
│   ├── test_tweet_details.py      # TEST-004
│   ├── test_user_search.py        # TEST-005
│   ├── test_tab_control.py        # TEST-006
│   ├── test_actions.py            # TEST-007
│   ├── test_reverse_actions.py    # TEST-008
│   ├── test_publish.py            # TEST-009
│   └── test_delete.py             # TEST-010
└── utils/                # 工具模块
    ├── api_client.py     # REST API 客户端
    └── response_parser.py # 响应验证工具
```

---

## 📝 API 客户端使用示例

### 基础用法

```python
from utils.api_client import APIClient

client = APIClient()

# 查询状态
status = client.get_x_status()
print(status)

# 查询账号信息
info = client.get_basic_info()
print(info)

# 查询时间线
timeline = client.get_timeline()
print(timeline)
```

### 读取类 API

```python
# 获取推文详情
tweet = client.get_tweet("1234567890")

# 获取推文回复（支持分页）
replies = client.get_tweet_replies("1234567890", cursor="ABC123")

# 获取用户资料
user = client.get_user_profile("elonmusk")

# 搜索推文（支持分页）
results = client.search_timeline("AI", cursor="XYZ789", count=20)
```

### 写入类 API

```python
# 发布推文
response = client.create_tweet("Hello World")

# 回复推文
response = client.create_reply("1234567890", "Nice tweet!")

# 点赞推文
response = client.like_tweet("1234567890")

# 转发推文
response = client.retweet("1234567890")

# 收藏推文
response = client.bookmark_tweet("1234567890")

# 关注用户
response = client.follow_user("44196397")

# 删除推文
response = client.delete_tweet("1234567890")
```

### 标签页控制 API

```python
# 打开新标签页
response = client.open_tab("home")

# 导航标签页
response = client.navigate_tab("notifications", tab_id=123)

# 关闭标签页
response = client.close_tab(123)
```

---

## ✅ 响应验证

所有测试脚本会验证：
1. HTTP 状态码是否为 200
2. 响应是否为有效的 JSON
3. 响应是否包含 Twitter 原始数据结构（如 `data`, `legacy`, `rest_id` 等字段）

**重要**：所有响应都是 Twitter GraphQL 原始响应，未经过数据转换或字段提取。

---

## ⚠️ 注意事项

### 安全提醒

1. **真实操作**：写入类测试（TEST-007、TEST-008、TEST-010、TEST-011）会在真实账号上执行操作
2. **账号风险**：频繁的自动化操作可能触发 Twitter 的反滥用机制
3. **测试账号**：建议使用测试账号进行开发和测试
4. **人工确认**：所有写入操作都需要人工确认（输入 `yes`）

### 功能限制

1. **不支持自动化测试**：已移除 `--auto` 参数，避免账号审核风险
2. **不支持批量操作**：每个操作都需要单独执行和确认

### 环境要求

1. **LocalBridge 必须运行**：确保 LocalBridgeMac 应用正在运行
2. **TweetClaw 必须连接**：确保浏览器扩展已连接到 LocalBridge
3. **必须登录 X**：确保浏览器已登录 X 账号
4. **至少一个 X 标签页**：某些 API 需要打开的 X 标签页

---

## 🐛 故障排查

### 连接失败

**问题**：`Connection refused` 或 `Connection error`

**解决方案**：
1. 检查 LocalBridgeMac 是否正在运行
2. 检查端口配置是否正确（默认 10088）
3. 检查防火墙设置

### 503 错误

**问题**：`503 Service Unavailable`

**解决方案**：
1. 检查 TweetClaw 扩展是否已加载
2. 检查扩展是否已连接到 LocalBridge（查看扩展 popup）
3. 确认至少有一个 X 标签页打开

### 空响应或错误

**问题**：API 返回空数据或格式错误

**解决方案**：
1. 确认已在浏览器中登录 X 账号
2. 检查 X 页面是否正常加载
3. 刷新 X 页面重试

### 超时错误

**问题**：`Read timed out`

**解决方案**：
1. 检查网络连接
2. 增加超时时间（修改 `config.py` 中的 `API_TIMEOUT`）
3. 检查 TweetClaw 是否正常工作

---

## 📚 相关文档

- [LocalBridge 架构文档](../README.md)
- [TweetClaw 文档](../../tweetClaw/README.md)
- [API 设计规范](../API_DESIGN_RULES.md)
- [任务分发文档](../apple/LocalBridgeMac/doc/14_task-assignment.md)

---

## 🔗 相关项目

- **LocalBridge**: AI Hub 核心服务
- **TweetClaw**: Twitter/X 浏览器扩展
- **AiClaw**: 通用 AI 平台交互插件

---

*最后更新：2026-03-25*
