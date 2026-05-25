# XHS API 测试手册

本手册提供了 XHS (小红书) API 的完整测试指南，包括 3 个场景化测试脚本和逐个 API 的测试说明。

## 快速开始

### 前置条件
1. ✅ LocalBridge 服务已启动（端口 10088）
2. ✅ Chrome 扩展 tweetClaw 已加载
3. ✅ 小红书网站已登录（www.xiaohongshu.com）

### 测试脚本位置
```
LocalBridge/clawBotCli/examples/
├── xhs_discovery_flow.py      # 场景1: 内容发现流程
├── xhs_search_flow.py          # 场景2: 搜索探索流程
└── xhs_notifications_flow.py  # 场景3: 通知和我的内容
```

---

## 场景 1: 内容发现流程

**测试脚本**: `xhs_discovery_flow.py`

**覆盖的 API**:
1. `get_account_info()` - 获取账号信息
2. `get_homefeed()` - 获取首页 feed
3. `get_note_comments(note_id)` - 获取笔记评论
4. `get_user_info(user_id)` - 获取用户信息
5. `get_user_notes(user_id)` - 获取用户笔记
6. `search_topics(keyword)` - 搜索话题

**运行方式**:
```bash
cd LocalBridge/clawBotCli/examples
python3 xhs_discovery_flow.py
```

**数据流**:
```
获取首页 feed → 提取第一条笔记的 note_id 和 user_id 
→ 获取笔记评论 → 获取作者信息 → 获取作者其他笔记 → 搜索相关话题
```

**预期输出**:
- ✓ 显示当前登录账号信息
- ✓ 显示首页 feed 中的笔记列表
- ✓ 显示第一条笔记的详细信息（标题、作者、点赞数）
- ✓ 显示该笔记的评论列表
- ✓ 显示作者的个人资料（粉丝数、笔记数）
- ✓ 显示作者的其他笔记
- ✓ 显示相关话题标签

**测试要点**:
- 确认 feed 中有笔记数据
- 确认能正确提取 note_id 和 user_id
- 确认评论数据结构完整
- 确认用户信息包含粉丝数、笔记数等统计数据

---

## 场景 2: 搜索探索流程

**测试脚本**: `xhs_search_flow.py`

**覆盖的 API**:
1. `search(keyword, page_size)` - 搜索笔记
2. `search(keyword, cursor)` - 搜索分页
3. `get_feed(note_id)` - 获取笔记详情
4. `get_note_comments(note_id)` - 获取评论
5. `get_user_info(user_id)` - 获取用户信息
6. `get_user_notes(user_id)` - 获取用户笔记
7. `search_topics(keyword)` - 搜索话题

**运行方式**:
```bash
cd LocalBridge/clawBotCli/examples
python3 xhs_search_flow.py
```

**交互式输入**:
- 脚本会提示输入搜索关键词（默认: "美食"）
- 可以输入任何中文关键词测试

**数据流**:
```
搜索关键词 → 显示搜索结果 → 提取 note_id 和 user_id
→ 获取笔记详情 → 获取评论 → 探索作者 → 搜索相关话题 → 分页加载更多
```

**预期输出**:
- ✓ 显示搜索结果列表（最多 10 条）
- ✓ 显示每条笔记的标题、作者、点赞数
- ✓ 显示第一条笔记的详细信息
- ✓ 显示该笔记的评论（最多 3 条）
- ✓ 显示作者的个人资料和其他笔记
- ✓ 显示相关话题标签
- ✓ 显示分页加载的下一页结果

**测试要点**:
- 测试不同关键词的搜索结果
- 确认 cursor 分页机制正常工作
- 确认 get_feed() 返回完整的笔记详情
- 确认评论数据包含用户信息和点赞数

---

## 场景 3: 通知和我的内容

**测试脚本**: `xhs_notifications_flow.py`

**覆盖的 API**:
1. `get_account_info()` - 获取账号信息
2. `get_notifications(notif_type='mentions')` - 获取@通知
3. `get_notifications(notif_type='likes')` - 获取点赞通知
4. `get_published_notes()` - 获取我发布的笔记
5. `get_published_notes(cursor)` - 分页加载
6. `get_note_comments(note_id)` - 获取我的笔记的评论

**运行方式**:
```bash
cd LocalBridge/clawBotCli/examples
python3 xhs_notifications_flow.py
```

**数据流**:
```
获取账号信息 → 获取@通知 → 获取点赞通知 
→ 获取我发布的笔记 → 获取第一条笔记的评论 → 分页加载更多笔记
```

**预期输出**:
- ✓ 显示当前登录账号信息
- ✓ 显示@通知列表（谁@了我）
- ✓ 显示点赞通知列表（谁点赞了我的内容）
- ✓ 显示我发布的笔记列表
- ✓ 显示每条笔记的点赞数和评论数
- ✓ 显示第一条笔记的评论详情
- ✓ 显示分页加载的下一页笔记

**测试要点**:
- 确认通知数据包含用户信息和时间戳
- 确认 `notif_type` 参数验证正常（只接受 'mentions' 或 'likes'）
- 确认我的笔记列表包含互动数据（点赞数、评论数）
- 确认分页 cursor 格式正确（数字格式）

**已知问题**:
- ⚠️ `get_published_notes()` 可能返回 "Failed to fetch" 错误（权限或账号状态问题）
- ⚠️ 使用假 cursor（如 "test_cursor"）会导致 500 错误，需要使用真实的数字 cursor

---

## 逐个 API 测试清单

### ✅ 已验证通过的 API (9个)

| API | 状态 | 测试场景 | 备注 |
|-----|------|---------|------|
| `get_account_info()` | ✅ | 场景1, 场景3 | 返回完整账号信息 |
| `get_homefeed()` | ✅ | 场景1 | 返回首页 feed 流 |
| `get_homefeed(cursor_score)` | ✅ | 场景1 | 分页正常 |
| `search(keyword)` | ✅ | 场景2 | 搜索功能正常 |
| `search(keyword, cursor, page_size)` | ✅ | 场景2 | 分页正常 |
| `search_topics(keyword)` | ✅ | 场景1, 场景2 | 返回话题列表 |
| `get_notifications('mentions')` | ✅ | 场景3 | 返回@通知 |
| `get_notifications('likes')` | ✅ | 场景3 | 返回点赞通知 |
| 无效通知类型验证 | ✅ | 场景3 | 正确抛出 ValueError |

### ⚠️ 需要真实数据测试的 API (5个)

这些 API 需要从 feed 或搜索结果中获取真实的 ID 才能测试：

| API | 测试方法 | 在哪个场景中测试 |
|-----|---------|----------------|
| `get_feed(note_id)` | 从搜索结果提取 note_id | 场景2 |
| `get_note_comments(note_id)` | 从 feed 提取 note_id | 场景1, 场景2, 场景3 |
| `get_user_info(user_id)` | 从 feed 提取 user_id | 场景1, 场景2 |
| `get_user_notes(user_id)` | 从 feed 提取 user_id | 场景1, 场景2 |
| `publish_note(...)` | 需要真实图片数据 | 暂未实现（会创建真实内容） |

### ⚠️ 已知问题的 API (2个)

| API | 问题 | 原因 | 解决方案 |
|-----|------|------|---------|
| `get_notifications(type, cursor='test_cursor')` | 500 错误 | XHS API 要求数字格式的 cursor | 使用真实返回的 cursor 值 |
| `get_published_notes()` | "Failed to fetch" | 可能是权限或账号状态问题 | 需要在真实账号上测试 |

---

## 测试建议

### 1. 按顺序测试
建议按以下顺序运行测试脚本：
1. **场景1** (xhs_discovery_flow.py) - 最基础的流程，测试核心 API
2. **场景2** (xhs_search_flow.py) - 测试搜索和分页功能
3. **场景3** (xhs_notifications_flow.py) - 测试通知和个人内容

### 2. 查看详细日志
所有脚本都会打印详细的 JSON 响应数据，方便你查看：
- API 返回的完整数据结构
- 提取的 note_id 和 user_id
- 每个步骤的成功/失败状态

### 3. 测试不同数据
- **场景2** 支持自定义搜索关键词，可以测试不同类型的内容
- 可以修改脚本中的 `page_size` 参数测试不同的分页大小
- 可以修改显示的条目数量（如 `[:3]` 改为 `[:10]`）

### 4. 错误处理
所有脚本都包含错误处理：
- 如果 API 返回失败，会显示 `⚠` 警告和错误信息
- 如果数据为空，会显示相应提示
- 脚本会继续执行后续步骤，不会因单个 API 失败而中断

---

## 调试技巧

### 查看原始响应
如果需要查看完整的 API 响应，可以在脚本中添加：
```python
import json
print(json.dumps(result, ensure_ascii=False, indent=2))
```

### 提取特定字段
如果需要提取特定字段进行测试，可以使用：
```python
note_id = result.get('data', {}).get('items', [])[0].get('id')
print(f"Extracted note_id: {note_id}")
```

### 测试单个 API
如果只想测试某个特定 API，可以直接在 Python 交互式环境中运行：
```python
from clawbot import ClawBotClient
client = ClawBotClient()

# 测试搜索
result = client.xhs.search(keyword="测试")
print(result)

# 测试获取账号信息
account = client.xhs.get_account_info()
print(account)
```

---

## 总结

**已完成**:
- ✅ 11 个 REST API 端点全部实现
- ✅ Go 消息类型 bug 已修复
- ✅ Python 客户端完整实现（transport + service + client）
- ✅ 3 个场景化测试脚本
- ✅ 9/12 个可测试的 API 验证通过

**待测试**:
- ⚠️ `get_published_notes()` 需要在有发布内容的账号上测试
- ⚠️ `publish_note()` 需要真实图片数据（会创建真实内容，谨慎测试）

**使用建议**:
1. 先运行 3 个场景脚本，熟悉 API 的使用方式
2. 根据实际需求修改脚本，提取需要的数据
3. 可以基于这些脚本开发自己的自动化工具
