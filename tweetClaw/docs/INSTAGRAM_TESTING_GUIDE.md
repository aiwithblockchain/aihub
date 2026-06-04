# Instagram 集成测试指南

> 创建日期：2026-06-04  
> 状态：原型完成，待测试

---

## 一、集成完成情况

### 1.1 已完成的文件

```
tweetClaw/
├── src/
│   ├── ig_api/                      # Instagram API 模块
│   │   ├── index.ts               # 模块入口
│   │   ├── constants.ts            # 常量定义
│   │   ├── signature.ts            # 签名算法
│   │   ├── cookie-helper.ts        # Cookie 管理
│   │   ├── types.ts                # 类型定义
│   │   ├── ig_api.ts               # 核心 API
│   │   └── test.ts                 # 测试示例
│   └── content/
│       └── ig-main-entrance.ts      # Content Script 入口
├── webpack.config.js                # ✅ 已添加 content-ig 入口
└── dist/
    └── manifest.json                # ✅ 已添加 Instagram 权限
```

### 1.2 已实现的功能

| 功能 | 消息类型 | 状态 |
|------|---------|------|
| 获取当前用户信息 | `command.ig_get_self_info` | ✅ 已实现 |
| 获取用户信息 | `command.ig_get_user_info` | ✅ 已实现 |
| 搜索用户 ID | `command.ig_search_user` | ✅ 已实现 |
| 点赞媒体 | `command.ig_like_media` | ✅ 已实现 |
| 取消点赞 | `command.ig_unlike_media` | ✅ 已实现 |
| 关注用户 | `command.ig_follow_user` | ✅ 已实现 |
| 取消关注 | `command.ig_unfollow_user` | ✅ 已实现 |
| 发布评论 | `command.ig_post_comment` | ✅ 已实现 |
| 检查登录状态 | `command.ig_check_login` | ✅ 已实现 |
| 测试连接 | `command.ig_test_connection` | ✅ 已实现 |

---

## 二、构建步骤

### 2.1 安装依赖

```bash
cd tweetClaw
npm install
```

### 2.2 构建扩展

```bash
# 开发模式（带 source map）
npm run build -- --mode development

# 生产模式
npm run build
```

### 2.3 验证构建产物

```bash
ls -la dist/js/

# 应该看到：
# - content-ig.js      ← Instagram Content Script
# - background.js      ← Background Service Worker
# - content.js         ← X Content Script
# - content-xhs.js     ← XHS Content Script
```

---

## 三、安装扩展

### 3.1 加载到 Chrome

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `tweetClaw/dist` 目录

### 3.2 验证安装

- 扩展列表中应显示 "TweetClaw v0.7.61"
- 点击扩展图标，应弹出 Popup 界面

---

## 四、测试步骤

### 4.1 准备工作

1. **登录 Instagram**
   - 访问 https://www.instagram.com/
   - 使用你的账号登录
   - 确保登录状态正常

2. **打开开发者工具**
   - 按 F12 或右键 → 检查
   - 切换到 Console 标签

### 4.2 测试签名算法

在 Instagram 页面的控制台执行：

```javascript
// 测试签名算法是否正常
const testData = '{"test":"data"}';

// 手动调用签名函数（需要先加载 content script）
// 如果看到报错，说明 content script 未正确加载
```

### 4.3 测试 Cookie 读取

```javascript
// 检查 Cookie 状态
chrome.cookies.getAll({ domain: '.instagram.com' }, (cookies) => {
  console.log('Instagram Cookies:', cookies);
  
  // 检查必需的 Cookie
  const sessionid = cookies.find(c => c.name === 'sessionid');
  const csrftoken = cookies.find(c => c.name === 'csrftoken');
  const ds_user_id = cookies.find(c => c.name === 'ds_user_id');
  
  console.log('sessionid:', sessionid ? '✅' : '❌');
  console.log('csrftoken:', csrftoken ? '✅' : '❌');
  console.log('ds_user_id:', ds_user_id ? '✅' : '❌');
});
```

### 4.4 测试 API 调用

**方法一：通过 Background 发送消息**

```javascript
// 在控制台执行（需要扩展上下文）
chrome.runtime.sendMessage(
  { type: 'command.ig_get_self_info', params: {} },
  (response) => {
    console.log('Response:', response);
    if (response.success) {
      console.log('✅ 用户信息:', response.data);
    } else {
      console.error('❌ 错误:', response.error);
    }
  }
);
```

**方法二：直接调用 API（在 Content Script 上下文）**

由于 Content Script 在隔离环境中，直接调用需要通过页面注入。

### 4.5 测试特定功能

**测试获取当前用户信息：**

```javascript
chrome.runtime.sendMessage(
  { type: 'command.ig_get_self_info', params: {} },
  console.log
);
```

**预期输出：**
```javascript
{
  success: true,
  data: {
    userId: "123456789",
    username: "your_username",
    fullName: "Your Name",
    followerCount: 100,
    followingCount: 200,
    mediaCount: 50,
    isPrivate: false,
    isVerified: false
  }
}
```

**测试点赞（需要真实的 mediaId）：**

```javascript
// 替换为真实的媒体 ID
const mediaId = "YOUR_MEDIA_ID_HERE";

chrome.runtime.sendMessage(
  { 
    type: 'command.ig_like_media', 
    params: { mediaId } 
  },
  console.log
);
```

**测试关注（需要真实的 userId）：**

```javascript
// 替换为真实的用户 ID
const userId = "TARGET_USER_ID_HERE";

chrome.runtime.sendMessage(
  { 
    type: 'command.ig_follow_user', 
    params: { userId } 
  },
  console.log
);
```

---

## 五、调试技巧

### 5.1 查看 Content Script 日志

1. 打开 Instagram 页面
2. 按 F12 打开控制台
3. 查找 `[IgClaw-CS]` 前缀的日志

**正常初始化日志：**
```
[IgClaw-CS] Instagram Content Script loaded
[IgClaw-CS] ✅ User is logged in to Instagram
[IgClaw-CS] ✅ API connection successful, userId: 123456789
```

### 5.2 查看 Background 日志

1. 访问 `chrome://extensions/`
2. 找到 TweetClaw 扩展
3. 点击"service worker"链接
4. 查看 Background 控制台

### 5.3 常见问题排查

**问题 1：Content Script 未加载**

症状：控制台没有 `[IgClaw-CS]` 日志

解决：
- 检查 manifest.json 中 content_scripts 配置
- 确认 URL 匹配模式正确
- 刷新 Instagram 页面

**问题 2：Cookie 读取失败**

症状：`sessionid not found` 错误

解决：
- 确认已登录 Instagram
- 检查 host_permissions 是否包含 `https://www.instagram.com/*`
- 检查 cookies 权限

**问题 3：签名失败**

症状：API 返回 400 或 403 错误

解决：
- 检查签名密钥是否正确
- 验证签名算法实现
- 对比 instagram-private-api 的签名结果

**问题 4：CORS 错误**

症状：`Access-Control-Allow-Origin` 错误

解决：
- 确认 host_permissions 包含 `https://i.instagram.com/*`
- 检查请求 headers 是否正确

---

## 六、性能测试

### 6.1 频率限制测试

Instagram 对 API 调用有严格限制：

```javascript
// 测试连续点赞（会触发延迟）
for (let i = 0; i < 5; i++) {
  chrome.runtime.sendMessage(
    { type: 'command.ig_like_media', params: { mediaId: `test_${i}` } },
    (response) => {
      console.log(`Like ${i}:`, response);
    }
  );
}
```

**预期行为：**
- 每次操作间隔 5-15 秒（随机延迟）
- 控制台显示 `[IG API] Smart delay: XXXms`

### 6.2 并发请求测试

```javascript
// 测试并发请求
Promise.all([
  chrome.runtime.sendMessage({ type: 'command.ig_get_self_info', params: {} }),
  chrome.runtime.sendMessage({ type: 'command.ig_check_login', params: {} }),
]).then(console.log);
```

---

## 七、集成到 LocalBridge

### 7.1 Python SDK 集成

**创建文件：** `clawbot/transport/ig_api.py`

```python
from clawbot.transport.base_api import BaseApiTransport

class IgApiTransport(BaseApiTransport):
    """Instagram API Transport"""
    
    def get_self_info(self) -> dict:
        """获取当前用户信息"""
        return self.request(
            method='pluginInvoke',
            payload={
                'messageType': 'command.ig_get_self_info',
                'params': {}
            }
        )
    
    def like_media(self, media_id: str) -> dict:
        """点赞媒体"""
        return self.request(
            method='pluginInvoke',
            payload={
                'messageType': 'command.ig_like_media',
                'params': {'mediaId': media_id}
            }
        )
```

**创建文件：** `clawbot/services/ig.py`

```python
from clawbot.transport.ig_api import IgApiTransport

class IgService:
    """Instagram 服务"""
    
    def __init__(self, transport: IgApiTransport):
        self._t = transport
    
    def get_self_info(self) -> dict:
        return self._t.get_self_info()
    
    def like_media(self, media_id: str) -> dict:
        return self._t.like_media(media_id)
```

### 7.2 LocalBridge 配置

在 `localBridge` 中添加 Instagram 支持：

1. 在 `preset_payload.go` 中添加 Instagram 消息类型
2. 在 `handler.go` 中添加 Instagram 端点路由

---

## 八、下一步工作

### 8.1 短期任务（1-2 天）

- [ ] 完成构建并测试基础功能
- [ ] 验证签名算法正确性
- [ ] 测试点赞、关注等写操作
- [ ] 修复发现的问题

### 8.2 中期任务（3-5 天）

- [ ] 实现剩余读取 API（Feed、搜索、评论列表）
- [ ] 实现媒体上传功能
- [ ] 集成到 Python SDK
- [ ] 编写单元测试

### 8.3 长期任务（1-2 周）

- [ ] 实现 Stories 发布
- [ ] 实现 Reels 发布
- [ ] 完善错误处理和重试机制
- [ ] 优化频率控制策略

---

## 九、成功标准

### 9.1 基础功能验证

- [ ] 能获取当前用户信息
- [ ] 能点赞媒体
- [ ] 能关注用户
- [ ] 能发布评论

### 9.2 性能验证

- [ ] 写操作有正确的延迟（5-15秒）
- [ ] 并发请求能正常处理
- [ ] 错误能正确捕获和上报

### 9.3 集成验证

- [ ] Python SDK 能调用 Instagram API
- [ ] LocalBridge 能正确路由消息
- [ ] 完整的端到端测试通过

---

## 十、参考资源

- [Instagram API 分析报告](./INSTAGRAM_API_ANALYSIS.md)
- [Instagram 开发计划](./INSTAGRAM_DEVELOPMENT_PLAN.md)
- [Instagram 功能路线图](./INSTAGRAM_INTEGRATION_ROADMAP.md)
- [instagram-private-api 项目](../../instagram-private-api/)