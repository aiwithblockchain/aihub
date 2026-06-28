# A42 扩展侧页面导航行为修正验证指南

## 已完成的改动

### 1. 移除小红书 creator 首页自动打开（已验证）
- **问题**：`getOrOpenCreatorTab()` 在无 `creator.xiaohongshu.com` 标签页时自动创建，导致莫名打开创作首页
- **修复**：改为复用/创建 `www.xiaohongshu.com` 标签页，签名函数在 www 域同样可用
- **状态**：✅ 已验证（2026-06-27），发布流程无需 creator 子域

### 2. 账号信息同步前刷新到平台首页（本次完成）
- **问题**：标签页停留在非首页（具体推文/设置页等），导致账号信息 API 响应不完整或失败
- **修复**：新增 `ensurePlatformTabReady()`，刷新到首页并等待加载完成后再调用 API
- **状态**：✅ 已实现（2026-06-28），需端到端验证

---

## 验证步骤

### 准备工作
1. 在 Chrome 中加载更新后的扩展（`chrome://extensions` → 加载已解压的扩展程序 → 选择 `tweetClaw/dist`）
2. 确保已登录 Twitter/X、小红书、Instagram 账号
3. 打开 TweetPilot App，确保 LocalBridge 已启动

### 测试场景 1：Twitter/X 账号信息同步

#### 场景 1a：标签页在具体推文页
1. 打开 `https://x.com/elonmusk/status/123456789` （任意推文详情页）
2. 在 TweetPilot App 中触发账号信息同步（或等待定时同步触发）
3. **预期**：
   - 扩展自动将 X 标签页刷新到 `https://x.com/home`
   - 等待首页加载完成（`status === 'complete`）
   - 然后调用 `FETCH_SETTINGS_AND_PROFILE` API
   - 同步成功，账号信息准确

#### 场景 1b：标签页在设置页
1. 打开 `https://x.com/settings/account`
2. 触发账号信息同步
3. **预期**：同场景 1a，刷新到 `/home` 后同步成功

#### 场景 1c：无 X 标签页
1. 关闭所有 X 标签页
2. 触发账号信息同步
3. **预期**：
   - 扩展自动创建 inactive 标签页打开 `https://x.com/home`
   - 等待加载完成后同步成功
   - 新标签页在后台（不抢占用户当前标签页）

### 测试场景 2：小红书账号信息同步

#### 场景 2a：标签页在笔记详情页
1. 打开 `https://www.xiaohongshu.com/explore/123456789` （任意笔记详情页）
2. 触发账号信息同步
3. **预期**：
   - 扩展自动将小红书标签页刷新到 `https://www.xiaohongshu.com/explore`（首页）
   - 等待首页加载完成后同步成功

#### 场景 2b：标签页在创作中心
1. 打开 `https://creator.xiaohongshu.com/creator/post` （创作中心）
2. 触发账号信息同步
3. **预期**：
   - **不应**再打开新的 creator 标签页
   - 复用当前 creator 标签页或 www 标签页刷新到 `www.xiaohongshu.com/explore`
   - 同步成功

#### 场景 2c：发布笔记流程
1. 通过 TweetPilot App 发布小红书图文笔记
2. **预期**：
   - **不应**自动打开 `creator.xiaohongshu.com/home`
   - 发布流程正常完成
   - 无莫名打开的多余标签页

### 测试场景 3：Instagram 账号信息同步

#### 场景 3a：标签页在帖子详情页
1. 打开 `https://www.instagram.com/p/ABC123/` （任意帖子详情页）
2. 触发账号信息同步
3. **预期**：
   - 扩展自动将 IG 标签页刷新到 `https://www.instagram.com/`（首页）
   - 等待首页加载完成后同步成功

#### 场景 3b：标签页在个人主页
1. 打开 `https://www.instagram.com/tweetpilot_ai/`
2. 触发账号信息同步
3. **预期**：刷新到根路径 `/` 后同步成功

### 测试场景 4：优先使用非活动标签页

#### 场景 4：用户正在浏览活动标签页
1. 打开 2 个 X 标签页：
   - Tab 1（活动）：`https://x.com/explore` （用户正在浏览）
   - Tab 2（非活动）：`https://x.com/notifications`
2. 触发账号信息同步
3. **预期**：
   - 扩展优先选择 Tab 2（非活动）刷新到 `/home`
   - Tab 1（用户正在浏览）不受干扰
   - 同步成功

---

## 检查清单

- [ ] Twitter/X 在推文详情页时刷新到 `/home` 后同步成功
- [ ] Twitter/X 在设置页时刷新到 `/home` 后同步成功
- [ ] Twitter/X 无标签页时自动创建 inactive tab 同步成功
- [ ] 小红书在笔记详情页时刷新到 `/explore` 后同步成功
- [ ] 小红书在 creator 页时不再打开新的 creator tab
- [ ] 小红书发布流程不再自动打开 `creator.xiaohongshu.com/home`
- [ ] Instagram 在帖子详情页时刷新到 `/` 后同步成功
- [ ] Instagram 在个人主页时刷新到 `/` 后同步成功
- [ ] 有多个标签页时优先使用非活动标签页
- [ ] 所有刷新操作都等待 `status === 'complete'` 后再发 API 请求
- [ ] 超时处理正常（15s 超时后报错，不无限等待）

---

## 调试技巧

### 查看扩展日志
1. 打开 `chrome://extensions`
2. 找到 TweetClaw 扩展 → 点击 "service worker" 链接
3. 查看 Console 日志，关键日志：
   ```
   [TweetClaw-BG] queryXBasicInfo called
   [TweetClaw-BG] queryXhsAccountInfo called
   [TweetClaw-BG] igGetSelfInfo called
   Tab <id> did not reach 'complete' within 15000ms  // 超时错误
   ```

### 查看 LocalBridge 日志
```bash
tail -f ~/.tweetpilot/logs/app.log | grep -E "mark_account_instance_state|managed_account_status|resolve_managed_binding"
```

### 查看工作区 AI 日志
```bash
tail -f <workspace>/.tweetpilot/logs/ai.log | grep -E "账号状态|同步"
```

---

## 回归测试

完成上述验证后，确保以下功能不受影响：

- [ ] 小红书发布图文笔记
- [ ] 小红书发布视频笔记
- [ ] 小红书同步已发布笔记
- [ ] 小红书搜索话题
- [ ] 小红书签名健康检查（`checkXhsSignHealth`）
- [ ] Twitter/X 发布推文
- [ ] Instagram 发布帖子
- [ ] 评论自动回复功能
- [ ] PostSync 文章同步功能

---

## 已知限制

1. **15s 超时**：如果首页加载慢（网络差/广告拦截器/VPN 慢），可能超时失败
   - **解决方案**：用户重试或增加超时时间（需修改 `timeoutMs` 参数）

2. **多个活动标签页**：如果用户在多个活动标签页间切换，可能选中非预期的 tab
   - **当前策略**：优先非活动标签页，只有单个活动标签页时才用它

3. **用户手动导航**：验证期间用户手动导航到其他页面，可能与扩展自动刷新冲突
   - **影响**：仅测试期间，实际使用中同步频率低（30min 一次），碰撞概率极低
