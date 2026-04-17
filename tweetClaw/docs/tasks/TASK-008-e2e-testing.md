# TASK-008: 端到端测试

**优先级:** P3  
**预计时间:** 1天  
**依赖:** TASK-001 到 TASK-007

## 目标

进行完整的端到端测试,验证小红书集成的所有功能正常工作。

## 测试内容

### 1. 数据捕获测试

#### 1.1 首页信息流捕获

**测试步骤:**
1. 加载扩展到 Chrome
2. 访问 https://www.xiaohongshu.com/
3. 打开开发者工具控制台
4. 滚动页面加载更多笔记

**验收标准:**
- [ ] 控制台显示 "[XhsClaw-Page] System initialized."
- [ ] 滚动时看到 "📡 Intercepted: /api/sns/web/v1/feed"
- [ ] Background 控制台显示 "Extracted X notes from feed"
- [ ] chrome.storage 中有 `xhs_feed_cache` 数据

**验证命令:**
```javascript
// 在 background 控制台执行
chrome.storage.local.get(['xhs_feed_cache'], (result) => {
  console.log('Feed cache:', result.xhs_feed_cache?.length, 'notes');
  console.log(result.xhs_feed_cache?.[0]);
});
```

#### 1.2 笔记详情捕获

**测试步骤:**
1. 在小红书首页点击任意笔记
2. 等待笔记详情页加载
3. 检查控制台和 storage

**验收标准:**
- [ ] 控制台显示 "📡 Intercepted: /api/sns/web/v1/note/"
- [ ] Background 显示 "Note captured: xxx"
- [ ] chrome.storage 中有 `xhs_note_xxx` 数据
- [ ] 笔记数据包含标题、内容、图片、互动数据

**验证命令:**
```javascript
// 在 background 控制台执行
chrome.storage.local.get(null, (items) => {
  const noteKeys = Object.keys(items).filter(k => k.startsWith('xhs_note_'));
  console.log('Cached notes:', noteKeys.length);
  if (noteKeys.length > 0) {
    console.log('Sample note:', items[noteKeys[0]]);
  }
});
```

#### 1.3 用户资料捕获

**测试步骤:**
1. 点击笔记作者头像进入用户主页
2. 等待用户资料加载
3. 检查数据捕获

**验收标准:**
- [ ] 控制台显示 "📡 Intercepted: /api/sns/web/v1/user/otherinfo"
- [ ] Background 显示 "User profile captured: xxx"
- [ ] chrome.storage 中有 `xhs_user_xxx` 数据
- [ ] 用户数据包含昵称、粉丝数、笔记数等

**验证命令:**
```javascript
chrome.storage.local.get(null, (items) => {
  const userKeys = Object.keys(items).filter(k => k.startsWith('xhs_user_'));
  console.log('Cached users:', userKeys.length);
  if (userKeys.length > 0) {
    console.log('Sample user:', items[userKeys[0]]);
  }
});
```

### 2. API 操作测试

#### 2.1 点赞操作

**测试步骤:**
1. 找到一个未点赞的笔记 ID
2. 在 background 控制台执行点赞操作
3. 刷新页面验证

**测试命令:**
```javascript
chrome.tabs.query({active: true}, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, {
    type: 'XHS_EXECUTE_ACTION',
    action: 'like',
    note_id: '替换为实际笔记ID'
  }, (response) => {
    console.log('Like response:', response);
  });
});
```

**验收标准:**
- [ ] 返回 `{ success: true }`
- [ ] 刷新页面后笔记显示已点赞
- [ ] 点赞数增加 1

#### 2.2 收藏操作

**测试命令:**
```javascript
chrome.tabs.query({active: true}, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, {
    type: 'XHS_EXECUTE_ACTION',
    action: 'collect',
    note_id: '替换为实际笔记ID'
  }, (response) => {
    console.log('Collect response:', response);
  });
});
```

**验收标准:**
- [ ] 返回 `{ success: true }`
- [ ] 在"我的收藏"中能找到该笔记

#### 2.3 关注操作

**测试命令:**
```javascript
chrome.tabs.query({active: true}, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, {
    type: 'XHS_EXECUTE_ACTION',
    action: 'follow',
    user_id: '替换为实际用户ID'
  }, (response) => {
    console.log('Follow response:', response);
  });
});
```

**验收标准:**
- [ ] 返回 `{ success: true }`
- [ ] 在"我的关注"中能找到该用户

#### 2.4 评论操作

**测试命令:**
```javascript
chrome.tabs.query({active: true}, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, {
    type: 'XHS_EXECUTE_ACTION',
    action: 'comment',
    note_id: '替换为实际笔记ID',
    content: '测试评论内容'
  }, (response) => {
    console.log('Comment response:', response);
  });
});
```

**验收标准:**
- [ ] 返回 `{ success: true }`
- [ ] 刷新页面后能看到评论

### 3. 错误处理测试

#### 3.1 无效笔记 ID

```javascript
chrome.tabs.sendMessage(tabs[0].id, {
  type: 'XHS_EXECUTE_ACTION',
  action: 'like',
  note_id: 'invalid_id_12345'
}, (response) => {
  console.log('Error response:', response);
  // 应该返回 { success: false, error: '...' }
});
```

**验收标准:**
- [ ] 返回错误响应,不抛出异常
- [ ] 错误信息清晰

#### 3.2 认证过期

**测试步骤:**
1. 清除 chrome.storage 中的认证信息
2. 尝试执行操作

```javascript
chrome.storage.local.remove(['xhs_xs_sign', 'xhs_xt'], () => {
  // 然后执行操作
});
```

**验收标准:**
- [ ] 操作失败并返回认证错误
- [ ] 不影响页面正常浏览

### 4. 兼容性测试

#### 4.1 Twitter 功能不受影响

**测试步骤:**
1. 访问 https://x.com/
2. 验证 Twitter 功能正常

**验收标准:**
- [ ] Twitter 数据捕获正常
- [ ] Twitter 操作正常执行
- [ ] 没有小红书相关的错误日志

#### 4.2 多标签页测试

**测试步骤:**
1. 同时打开多个小红书标签页
2. 在不同标签页执行操作

**验收标准:**
- [ ] 每个标签页独立工作
- [ ] 数据不混淆
- [ ] 认证信息正确共享

### 5. 性能测试

#### 5.1 内存使用

**测试步骤:**
1. 打开 Chrome 任务管理器 (Shift+Esc)
2. 浏览小红书 30 分钟
3. 观察扩展内存使用

**验收标准:**
- [ ] 内存使用稳定,无明显泄漏
- [ ] Service worker 内存 < 50MB

#### 5.2 页面性能

**测试步骤:**
1. 使用 Chrome DevTools Performance 面板
2. 记录页面加载和滚动性能

**验收标准:**
- [ ] 页面加载时间增加 < 100ms
- [ ] 滚动流畅,无明显卡顿
- [ ] FPS 保持 > 50

## 测试报告模板

创建测试报告文件记录结果:

**文件:** `docs/test-reports/xhs-integration-test-report.md`

```markdown
# 小红书集成测试报告

**测试日期:** YYYY-MM-DD  
**测试人员:** [姓名]  
**扩展版本:** 0.6.0  
**浏览器版本:** Chrome XXX

## 测试环境
- 操作系统: macOS / Windows / Linux
- 小红书账号状态: 已登录 / 未登录

## 测试结果汇总

| 测试项 | 状态 | 备注 |
|--------|------|------|
| 首页信息流捕获 | ✅ / ❌ | |
| 笔记详情捕获 | ✅ / ❌ | |
| 用户资料捕获 | ✅ / ❌ | |
| 点赞操作 | ✅ / ❌ | |
| 收藏操作 | ✅ / ❌ | |
| 关注操作 | ✅ / ❌ | |
| 评论操作 | ✅ / ❌ | |
| 错误处理 | ✅ / ❌ | |
| Twitter 兼容性 | ✅ / ❌ | |
| 性能表现 | ✅ / ❌ | |

## 发现的问题

### 问题 1: [标题]
- **严重程度:** 高 / 中 / 低
- **描述:** ...
- **复现步骤:** ...
- **预期行为:** ...
- **实际行为:** ...

## 建议

1. ...
2. ...

## 结论

[ ] 通过,可以发布  
[ ] 需要修复后重新测试  
[ ] 不通过,需要重大修改
```

## 验收标准

- [ ] 所有数据捕获测试通过
- [ ] 所有 API 操作测试通过
- [ ] 错误处理测试通过
- [ ] 兼容性测试通过
- [ ] 性能测试通过
- [ ] 测试报告完成

## 注意事项

- 测试前确保已登录小红书账号
- 某些操作可能有频率限制,注意间隔
- 记录所有发现的问题和异常行为
- 保存测试过程的截图和日志
- 测试不同类型的笔记(图文、视频)
