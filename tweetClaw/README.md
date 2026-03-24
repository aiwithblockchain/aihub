# TweetClaw - Twitter/X AI 交互插件

> **重要提示：** TweetClaw 是支持 LocalBridge AI Hub 的第一个官方浏览器扩展。

---

## 项目概述

TweetClaw 是一个 Chrome 浏览器扩展，专为 AI 与 Twitter/X 平台交互而设计。它通过 WebSocket 连接到 [LocalBridge Hub](../localBridge/)，将 Twitter/X 的复杂 GraphQL API 转换为结构化的数据接口，让 AI 能够高效、精确地操作 Twitter。

---

## 设计目标

### 核心理念

**让 AI 像人类一样使用 Twitter，但更高效、更精确**

```
┌─────────────────────────────────────────────────────────────┐
│                         外部 AI                              │
│                    (OpenClaw, Claude, etc.)                  │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   LocalBridge Hub                            │
│                   (本地 WebSocket 服务)                       │
└────────────────────────┬────────────────────────────────────┘
                         │ WebSocket
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      TweetClaw                               │
│                   (Chrome 浏览器扩展)                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Content Script                                       │  │
│  │  - 注入到 twitter.com/x.com 页面                       │  │
│  │  - 拦截 GraphQL 请求和响应                             │  │
│  │  - 提取结构化数据                                      │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│  ┌──────────────────▼───────────────────────────────────┐  │
│  │  Background Service Worker                            │  │
│  │  - 管理 WebSocket 连接                                 │  │
│  │  - 处理任务队列                                        │  │
│  │  - 数据转换和路由                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Twitter/X 网站                            │
│                  (twitter.com / x.com)                       │
└─────────────────────────────────────────────────────────────┘
```

### 为什么需要 TweetClaw？

**传统方式的问题：**
- **截图 + 视觉识别**：慢、不准确、成本高、无法获取完整数据
- **DOM 解析**：数据量大、噪音多、结构复杂、易失效
- **官方 API**：限流严格、功能受限、需要开发者账号

**TweetClaw 的优势：**
- **原始 GraphQL 数据**：直接获取 Twitter 内部 API 的完整响应
- **结构化输出**：JSON 格式，AI 易于理解和处理
- **无需 API Key**：使用浏览器会话，无需申请开发者账号
- **功能完整**：支持读取、发布、点赞、转发、搜索等所有操作
- **低延迟**：本地运行，无需云服务中转

---

## 核心功能

### 读取类操作

- **获取用户信息**：用户名、简介、粉丝数、关注数等
- **读取时间线**：首页推文、用户推文、回复、点赞列表
- **推文详情**：完整推文内容、媒体、引用、回复树
- **搜索功能**：搜索推文、搜索用户、高级搜索
- **关系查询**：关注列表、粉丝列表、互关关系

### 写入类操作

- **发布推文**：文本、图片、视频、投票
- **互动操作**：点赞、转发、引用转发、回复
- **关系操作**：关注、取消关注、拉黑、举报
- **书签管理**：添加书签、删除书签、查看书签列表

### 标签页控制

- **打开 Twitter 标签页**：自动导航到指定页面
- **关闭标签页**：清理不需要的标签
- **标签页状态查询**：检查是否有活跃的 Twitter 标签页

---

## 技术架构

### 技术栈

- **语言**：TypeScript
- **构建工具**：Webpack 5
- **扩展框架**：Chrome Extension Manifest V3
- **WebSocket 客户端**：原生 WebSocket API
- **依赖库**：
  - `webextension-polyfill`：跨浏览器兼容性
  - `x-client-transaction-id`：Twitter API 事务 ID 生成

### 目录结构

```
tweetClaw/
├── README.md                    # 本文件
├── package.json                 # 项目配置
├── tsconfig.json                # TypeScript 配置
├── webpack.config.js            # Webpack 构建配置
│
├── src/                         # 源代码目录
│   ├── service_work/            # Background Service Worker
│   │   └── 管理 WebSocket 连接和任务队列
│   │
│   ├── content/                 # Content Script
│   │   └── 注入到 Twitter 页面，拦截 API
│   │
│   ├── popup/                   # 扩展弹窗 UI
│   │   └── 显示连接状态和调试信息
│   │
│   ├── capture/                 # GraphQL 数据捕获
│   │   └── 拦截和解析 Twitter GraphQL 响应
│   │
│   ├── x_api/                   # Twitter API 封装
│   │   └── 构造 GraphQL 请求
│   │
│   ├── bridge/                  # WebSocket 桥接
│   │   └── 与 LocalBridge Hub 通信
│   │
│   ├── types/                   # TypeScript 类型定义
│   ├── utils/                   # 工具函数
│   └── debug/                   # 调试工具
│
└── dist/                        # 构建输出目录
    ├── manifest.json            # 扩展清单文件
    ├── js/                      # 编译后的 JavaScript
    ├── html/                    # HTML 文件
    ├── css/                     # 样式文件
    └── images/                  # 图标和图片
```

---

## 安装和使用

### 前置条件

1. **Chrome 浏览器**（或基于 Chromium 的浏览器）
2. **LocalBridge Hub**：必须先安装并运行 [LocalBridge](../localBridge/)
3. **Twitter/X 账号**：需要在浏览器中登录

### 构建扩展

```bash
# 安装依赖
npm install

# 开发模式构建
npm run build:d

# 生产模式构建
npm run build:r
```

### 加载到浏览器

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `tweetClaw/dist/` 目录

### 连接到 LocalBridge

1. 确保 LocalBridge Hub 正在运行（默认端口：8765）
2. 点击浏览器工具栏中的 TweetClaw 图标
3. 在弹窗中查看连接状态
4. 如果显示"已连接"，则可以开始使用

---

## WebSocket 协议

### 连接信息

- **默认地址**：`ws://127.0.0.1:8765/`
- **协议**：WebSocket
- **数据格式**：JSON

### 消息格式

#### 接收任务（从 Hub 到 TweetClaw）

```json
{
  "taskId": "task_123",
  "type": "get_user_info",
  "params": {
    "username": "elonmusk"
  }
}
```

#### 返回结果（从 TweetClaw 到 Hub）

```json
{
  "taskId": "task_123",
  "status": "success",
  "data": {
    "user": {
      "rest_id": "44196397",
      "legacy": {
        "screen_name": "elonmusk",
        "name": "Elon Musk",
        "followers_count": 200000000,
        "friends_count": 500
      }
    }
  }
}
```

#### 错误响应

```json
{
  "taskId": "task_123",
  "status": "error",
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found"
  }
}
```

---

## 支持的任务类型

### 用户相关

- `get_user_info`：获取用户信息
- `get_user_tweets`：获取用户推文列表
- `get_followers`：获取粉丝列表
- `get_following`：获取关注列表
- `follow_user`：关注用户
- `unfollow_user`：取消关注

### 推文相关

- `get_tweet_detail`：获取推文详情
- `get_home_timeline`：获取首页时间线
- `publish_tweet`：发布推文
- `delete_tweet`：删除推文
- `like_tweet`：点赞推文
- `unlike_tweet`：取消点赞
- `retweet`：转发推文
- `unretweet`：取消转发
- `reply_tweet`：回复推文

### 搜索相关

- `search_tweets`：搜索推文
- `search_users`：搜索用户
- `advanced_search`：高级搜索

### 书签相关

- `add_bookmark`：添加书签
- `remove_bookmark`：删除书签
- `get_bookmarks`：获取书签列表

### 标签页控制

- `open_x_tab`：打开 Twitter 标签页
- `close_x_tab`：关闭 Twitter 标签页
- `get_x_status`：查询标签页状态

详细的任务参数和响应格式，请参考 [LocalBridge API 文档](../localBridge/API_DESIGN_RULES.md)。

---

## 数据格式

### Twitter GraphQL 原始数据

TweetClaw 返回的是 Twitter 内部 GraphQL API 的原始响应，未经过滤或转换。这意味着：

- **数据完整**：包含所有字段，不会丢失信息
- **结构复杂**：嵌套层级深，需要 AI 自行解析
- **字段稳定**：Twitter 内部 API 相对稳定，字段变化较少

### 典型响应示例

```json
{
  "data": {
    "user": {
      "result": {
        "__typename": "User",
        "id": "VXNlcjo0NDE5NjM5Nw==",
        "rest_id": "44196397",
        "legacy": {
          "screen_name": "elonmusk",
          "name": "Elon Musk",
          "description": "Tesla, SpaceX, Neuralink, The Boring Company",
          "followers_count": 200000000,
          "friends_count": 500,
          "statuses_count": 50000,
          "verified": true,
          "profile_image_url_https": "https://pbs.twimg.com/..."
        }
      }
    }
  }
}
```

---

## 测试

### 使用 clawBotCli 测试

TweetClaw 配套的测试工具是 [clawBotCli](../localBridge/clawBotCli/)，它通过 LocalBridge REST API 测试 TweetClaw 的功能。

```bash
# 进入测试工具目录
cd ../localBridge/clawBotCli

# 安装依赖
pip install -r requirements.txt

# 测试所有 API
python test_all.py

# 测试特定功能
python tests/test_status.py          # 状态查询
python tests/test_read_apis.py       # 读取类 API
python tests/test_write_apis.py      # 写入类 API
python tests/test_tab_control.py     # 标签页控制
```

### 前置条件

1. LocalBridge Hub 正在运行
2. TweetClaw 扩展已加载到浏览器
3. 浏览器已登录 Twitter/X 账号
4. 至少有一个 Twitter 标签页打开

---

## 开发指南

### 本地开发

```bash
# 安装依赖
npm install

# 开发模式构建（带 source map）
npm run build:d

# 监听文件变化（需要手动刷新扩展）
npm run build:d -- --watch

# 运行测试
npm test
```

### 调试技巧

1. **查看 Service Worker 日志**：
   - 访问 `chrome://extensions/`
   - 找到 TweetClaw，点击"Service Worker"
   - 在 DevTools 中查看日志

2. **查看 Content Script 日志**：
   - 打开 Twitter 页面
   - 按 F12 打开 DevTools
   - 在 Console 中查看日志

3. **使用调试页面**：
   - 访问 `chrome-extension://<extension-id>/debug.html`
   - 查看 WebSocket 连接状态和消息历史

4. **查看扩展弹窗**：
   - 点击工具栏中的 TweetClaw 图标
   - 查看连接状态和最近的任务

### 添加新功能

1. **定义任务类型**：在 `src/types/` 中定义新的任务类型
2. **实现 API 调用**：在 `src/x_api/` 中封装 Twitter GraphQL 请求
3. **处理任务**：在 `src/service_work/` 中添加任务处理逻辑
4. **测试**：在 `../localBridge/clawBotCli/tests/` 中添加测试用例
5. **更新文档**：更新本文档和 API 文档

---

## 版本历史

- **v0.4.40**（当前版本）：
  - 完善 WebSocket 连接管理
  - 优化数据捕获和解析
  - 改进错误处理
  - 更新 UI 主题系统

- **v0.3.x**：
  - 实现基础的读取和写入功能
  - 添加标签页控制
  - 集成 LocalBridge Hub

- **v0.2.x**：
  - 初始版本
  - 基础的 GraphQL 拦截和数据提取

---

## 限制和注意事项

### 当前限制

1. **仅支持 Chrome**：基于 Manifest V3，暂不支持 Firefox
2. **需要登录**：必须在浏览器中登录 Twitter 账号
3. **单会话**：一个浏览器实例只能连接一个 LocalBridge Hub
4. **本地运行**：不支持远程连接，仅限 localhost

### 使用注意事项

1. **遵守 Twitter 规则**：不要用于垃圾信息、自动化滥用等违规行为
2. **频率限制**：虽然使用浏览器会话，但仍需注意请求频率，避免触发 Twitter 的反爬机制
3. **数据隐私**：所有数据在本地处理，不会上传到云端
4. **账号安全**：建议使用测试账号进行开发和测试

---

## 故障排查

### 连接失败

**问题**：TweetClaw 无法连接到 LocalBridge Hub

**解决方案**：
1. 确认 LocalBridge Hub 正在运行
2. 检查端口配置（默认 8765）
3. 查看 Service Worker 日志中的错误信息
4. 尝试重启浏览器和 LocalBridge Hub

### 503 错误

**问题**：REST API 返回 503 Service Unavailable

**解决方案**：
1. 确认 TweetClaw 扩展已加载
2. 检查扩展是否已连接到 Hub（查看弹窗状态）
3. 确认至少有一个 Twitter 标签页打开
4. 尝试刷新 Twitter 页面

### 空响应或错误数据

**问题**：API 返回空数据或格式错误

**解决方案**：
1. 确认已在浏览器中登录 Twitter 账号
2. 检查 Twitter 页面是否正常加载
3. 查看 Content Script 日志中的错误
4. 尝试手动在 Twitter 页面执行相同操作，确认功能可用

### 任务超时

**问题**：任务长时间无响应

**解决方案**：
1. 检查网络连接
2. 确认 Twitter 页面没有被阻塞或冻结
3. 查看 Service Worker 是否崩溃（需要重新加载扩展）
4. 增加任务超时时间（在 LocalBridge 配置中）

---

## 相关项目

- **[LocalBridge](../localBridge/)**：AI Hub 核心服务
- **[aiClaw](../aiClaw/)**：通用浏览器交互插件
- **[clawBotCli](../localBridge/clawBotCli/)**：REST API 测试工具

---

## 贡献指南

当前处于内部开发阶段，暂不接受外部贡献。未来会开放源代码和贡献流程。

---

## 许可证

详见项目根目录的 [LICENSE](../LICENSE) 文件。

---

## 联系方式

- **项目仓库**：（待公开）
- **问题反馈**：（待公开）

---

*最后更新：2026-03-24*
*版本：v0.4.40*
