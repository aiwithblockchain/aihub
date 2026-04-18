# TASK: 获取小红书当前登录账号信息

## 需求背景
实现账号管理功能，需要随时获取当前登录小红书账号的基本信息，要求主动获取（非被动拦截），确保信息实时性。

## 需要获取的信息

### 核心身份信息
- `user_id` - 用户唯一标识（必需）
- `nickname` - 昵称
- `avatar` - 头像 URL
- `desc` - 个人简介

### 账号统计数据
- `follows` - 关注数
- `fans` - 粉丝数
- `interaction` - 获赞与收藏总数
- `notes_count` - 笔记数量

### 认证状态
- `verified` - 是否认证
- `verified_content` - 认证信息
- `red_official_verified` - 是否官方认证

### 其他信息
- `gender` - 性别
- `ip_location` - IP 属地

## 实现方案

**两步实现策略：**

1. **第一步：从 Cookie 获取 user_id**
   - 实现 `getXhsAuthenticUserId()` 函数
   - 参考 Twitter 的 `getAuthenticUid()` 实现 ([background.ts:184-193](../src/service_work/background.ts#L184-L193))
   - 使用 `chrome.cookies.get()` 读取小红书 Cookie
   - 需要测试确定正确的 Cookie 字段名（`web_session`、`a1`、`webId` 等）

2. **第二步：调用 API 获取完整信息**
   - 复用现有的 `fetchXhsUser(userId)` 函数 ([xhs-api.ts:166-182](../src/platforms/xiaohongshu/xhs-api.ts#L166-L182))
   - 使用已有的 x-s、x-t 签名头
   - 返回完整的用户资料数据

## API 设计

### LocalBridge Protocol 消息

**请求：**
```typescript
{
  type: 'command.query_xhs_account_info',
  id: 'req_xxx',
  source: 'LocalBridge',
  target: 'tweetClaw',
  timestamp: 1234567890,
  payload: {}
}
```

**响应（成功）：**
```typescript
{
  type: 'response.xhs_account_info',
  id: 'req_xxx',
  source: 'tweetClaw',
  target: 'LocalBridge',
  timestamp: 1234567890,
  payload: {
    success: true,
    data: {
      user_id: '5c9a0000000000001001e2a5',
      nickname: '用户昵称',
      avatar: 'https://sns-avatar-qc.xhscdn.com/...',
      desc: '个人简介',
      follows: 123,
      fans: 456,
      interaction: 789,
      notes_count: 12,
      verified: false,
      verified_content: '',
      red_official_verified: false,
      gender: 1,
      ip_location: '上海'
    }
  }
}
```

**响应（失败）：**
```typescript
{
  type: 'response.xhs_account_info',
  id: 'req_xxx',
  source: 'tweetClaw',
  target: 'LocalBridge',
  timestamp: 1234567890,
  payload: {
    success: false,
    error: 'Not logged in' | 'No XHS tabs found' | 'API error'
  }
}
```

## 实现清单

### 1. 类型定义
- [ ] 在 [ws-protocol.ts](../src/bridge/ws-protocol.ts) 添加请求/响应类型
- [ ] 确认 [xhs-user.ts](../src/platforms/xiaohongshu/types/xhs-user.ts) 的 `XhsUserProfile` 类型是否完整

### 2. Cookie 读取
- [ ] 在 [background.ts](../src/service_work/background.ts) 实现 `getXhsAuthenticUserId()`
- [ ] 测试确认正确的 Cookie 字段名

### 3. API 调用
- [ ] 研究小红书"当前用户"API 端点
- [ ] 在 [xhs-api.ts](../src/platforms/xiaohongshu/xhs-api.ts) 添加 `fetchXhsCurrentUser()` 函数
- [ ] 或复用 `fetchXhsUser(userId)` 传入当前用户 ID

### 4. Handler 实现
- [ ] 在 [background.ts](../src/service_work/background.ts) 实现 `queryXhsAccountInfo()` handler
- [ ] 注册到 `localBridge.queryXhsAccountInfoHandler`

### 5. 测试
- [ ] 使用 [test_websocket_server.py](../test_websocket_server.py) 测试完整流程
- [ ] 验证未登录状态的错误处理
- [ ] 验证数据完整性和准确性

## 参考实现

- Twitter 账号信息获取：[background.ts:387-394](../src/service_work/background.ts#L387-L394) `queryXBasicInfo()`
- Cookie 读取：[background.ts:184-193](../src/service_work/background.ts#L184-L193) `getAuthenticUid()`
- XHS API 调用：[xhs-api.ts:166-182](../src/platforms/xiaohongshu/xhs-api.ts#L166-L182) `fetchXhsUser()`

## 预期工作量
- 研究和测试：1-2 小时
- 实现和调试：2-3 小时
- 总计：3-5 小时

## 成功标准
1. 能够通过 WebSocket 命令随时获取当前登录账号信息
2. 返回数据完整且准确
3. 未登录状态能正确返回错误
4. 响应时间 < 2 秒
