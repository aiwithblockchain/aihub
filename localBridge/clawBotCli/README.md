# ClawBot CLI - REST API 测试工具

LocalBridge REST API 的 Python 测试工具集，用于验证 Twitter/X 自动化功能。

---

## 📋 前置条件

1. **LocalBridgeMac 应用已启动**：REST API 服务运行在 `http://127.0.0.1:10088`
2. **TweetClaw 扩展已加载**：浏览器已加载 TweetClaw 扩展并连接到 LocalBridge
3. **已登录 X 账号**：在浏览器中登录 X 账号
4. **Python 环境**：Python 3.7+

---

## 🚀 安装

```bash
cd localBridge/clawBotCli
pip install -r requirements.txt
```

---

## 📖 测试方案

### TEST-002: 元数据查询测试

验证系统元数据查询功能（API 文档、状态、实例）。

```bash
python3 tests/test_metadata.py
```

**覆盖 API**:
- `GET /api/v1/x/docs` - API 文档
- `GET /api/v1/x/status` - X 状态
- `GET /api/v1/x/instances` - 连接实例

---

### TEST-003: 基础读取测试

验证基础读取功能（账号信息、时间线）。

```bash
python3 tests/test_basic_read.py
```

**覆盖 API**:
- `GET /api/v1/x/basic_info` - 当前账号信息
- `GET /api/v1/x/timeline` - 主页时间线

---

### TEST-004: 推文详情和回复测试

验证推文详情查询和回复列表（含分页）。

```bash
python3 tests/test_tweet_details.py
```

**覆盖 API**:
- `GET /api/v1/x/tweets/{tweet_id}` - 推文详情
- `GET /api/v1/x/tweets/{tweet_id}/replies` - 推文回复（支持分页）

---

### TEST-005: 用户和搜索测试

验证用户资料查询和搜索功能（含分页）。

```bash
python3 tests/test_user_search.py
```

**覆盖 API**:
- `GET /api/v1/x/users?screenName={screen_name}` - 用户资料
- `GET /api/v1/x/search?query={query}` - 搜索推文（支持分页）

---

### TEST-006: 标签页控制测试

验证标签页控制功能（打开、导航、关闭）。

```bash
python3 tests/test_tab_control.py
```

**覆盖 API**:
- `POST /tweetclaw/open-tab` - 打开新标签页
- `POST /tweetclaw/navigate-tab` - 导航标签页
- `POST /tweetclaw/close-tab` - 关闭标签页

---

### TEST-007: 正向操作测试

验证点赞、转发、收藏、关注功能。

⚠️ **警告**：这些测试会在真实账号上执行操作！

```bash
python3 tests/test_actions.py
```

**覆盖 API**:
- `POST /api/v1/x/likes` - 点赞推文
- `POST /api/v1/x/retweets` - 转发推文
- `POST /api/v1/x/bookmarks` - 收藏推文
- `POST /api/v1/x/follows` - 关注用户

**输出文件**: 生成 `test_actions.json` 供 TEST-008 使用

---

### TEST-008: 反向操作测试

验证取消点赞、取消转发、取消收藏、取消关注功能。

⚠️ **警告**：这些测试会在真实账号上执行操作！必须先执行 TEST-007。

```bash
python3 tests/test_reverse_actions.py
```

**覆盖 API**:
- `POST /api/v1/x/unlikes` - 取消点赞
- `POST /api/v1/x/unretweets` - 取消转发
- `POST /api/v1/x/unbookmarks` - 取消收藏
- `POST /api/v1/x/unfollows` - 取消关注

**前置条件**: 需要先运行 TEST-007 生成 `test_actions.json`

---

### TEST-009: 发布推文测试

验证推文发布功能（支持文字和媒体）。

⚠️ **警告**：这些测试会在真实账号上发布推文！

```bash
# 发布纯文字推文
python3 tests/test_publish.py --text "测试推文内容"

# 发布带图片的推文
python3 tests/test_publish.py --text "测试图片" --image ./test.jpg

# 发布带多图的推文
python3 tests/test_publish.py --text "测试多图" --images img1.jpg,img2.jpg

# 发布带视频的推文
python3 tests/test_publish.py --text "测试视频" --video ./test.mp4

# 回复推文
python3 tests/test_publish.py --reply-to TWEET_ID --text "回复内容"

# 回复推文（带图片）
python3 tests/test_publish.py --reply-to TWEET_ID --text "回复内容" --image ./test.jpg

# AI 自动化测试（不推荐）
python3 tests/test_publish.py --auto
```

**覆盖 API**:
- `POST /api/v1/x/tweets` - 发布推文
- `POST /api/v1/x/replies` - 回复推文
- `POST /api/v1/x/media/upload` - 上传媒体

**支持的媒体格式**:
- 图片：JPEG, PNG, GIF（最多 4 张）
- 视频：MP4

**注意**:
- ⚠️ `--auto` 参数会自动发布测试推文，可能导致账号审核风险，不推荐使用

---

### TEST-010: 删除推文测试

验证推文删除功能。

⚠️ **危险操作**：删除操作不可逆！

```bash
# 方式 1: 交互式删除（推荐）
python3 tests/test_delete.py

# 方式 2: 命令行参数删除
python3 tests/test_delete.py --tweet-id TWEET_ID --force
```

**覆盖 API**:
- `DELETE /api/v1/x/mytweets` - 删除自己的推文

**建议流程**:
1. 先用 TEST-010 创建测试推文
2. 记录返回的 tweet_id
3. 使用 TEST-011 删除测试推文

---

## 🔧 配置

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
