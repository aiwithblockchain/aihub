# Instagram 集成开发计划

> 创建日期：2026-06-04  
> 基于路线图：`INSTAGRAM_INTEGRATION_ROADMAP.md`

---

## 一、开源方案调研

### 1.1 候选项目

| 项目 | 语言 | Stars | 维护状态 | 许可证 |
|------|------|-------|---------|--------|
| [instagram-private-api (Nerixyz)](https://github.com/Nerixyz/instagram-private-api) | TypeScript | 1.2k+ | 活跃 | MIT |
| [instagram-private-api (dilame)](https://github.com/dilame/instagram-private-api) | TypeScript | 1.6k+ | 维护中 | MIT |
| [instaloader](https://github.com/instaloader/instaloader) | Python | 4.5k+ | 活跃 | MIT |
| [instagram-scraper](https://github.com/arc298/instagram-scraper) | Python | 1.8k+ | 低维护 | MIT |

### 1.2 方案评估

#### 方案 A：Nerixyz instagram-private-api（推荐）

**优势：**
- TypeScript 原生支持，与 tweetClaw 技术栈一致
- 完整的类型定义，开发体验好
- 覆盖读取 + 写操作 API
- 支持 Cookie 认证，符合我们的架构
- 活跃维护，2024-2025 持续更新

**劣势：**
- 部分高级功能需要额外实现
- 需要适配到 Chrome 扩展环境

**适用场景：**
- 作为 API 调用层的参考实现
- 签名算法可直接复用
- 类型定义可作为 `ig_api/types.ts` 基础

---

#### 方案 B：dilame instagram-private-api

**优势：**
- 社区最大、文档最全
- 支持完整账号操作流程
- 有大量示例代码

**劣势：**
- 部分功能依赖模拟登录（不适用于我们的 Cookie 复用模式）
- 更新频率略低于 Nerixyz 版本

**适用场景：**
- 作为补充参考
- 复杂操作（如媒体上传）的备选实现

---

#### 方案 C：instaloader（Python）

**优势：**
- 功能最完整，支持下载、元数据提取
- 文档详尽，社区活跃
- 可作为 Python SDK 层参考

**劣势：**
- Python 实现，无法直接用于 Chrome 扩展
- 主要面向下载场景，写操作支持有限

**适用场景：**
- Python SDK `clawbot/services/ig.py` 的参考
- 数据结构定义参考

---

### 1.3 推荐策略

**混合方案：**

```
Chrome 扩展层（TypeScript）
└── 参考 Nerixyz instagram-private-api
    ├── 签名算法 → ig_api/signature.ts
    ├── API 调用 → ig_api/ig_api.ts
    └── 类型定义 → ig_api/types.ts

Python SDK 层
└── 参考 instaloader
    ├── 服务封装 → clawbot/services/ig.py
    └── 数据结构 → clawbot/domain/ig_types.py
```

---

## 二、技术架构设计

### 2.1 文件结构

```
tweetClaw/src/
├── ig_api/                          # Instagram API 层（新增）
│   ├── ig_api.ts                    # 核心 API 调用
│   ├── signature.ts                # 签名算法（参考 Nerixyz）
│   ├── crypto.ts                    # 加密工具
│   ├── constants.ts                 # 常量定义
│   ├── types.ts                     # TypeScript 类型
│   └── extractor.ts                 # 数据提取器
├── content/
│   └── ig-main-entrance.ts          # Instagram 消息入口
├── capture/
│   └── ig_injection.js              # 页面注入脚本
└── session/
    └── ig-upload-session.ts         # 媒体上传会话

clawbot/
├── transport/
│   └── ig_api.py                    # Instagram Transport
└── services/
    └── ig.py                        # Instagram Service
```

### 2.2 核心模块职责

| 模块 | 职责 | 参考来源 |
|------|------|---------|
| `ig_api.ts` | API 调用封装、请求构建 | Nerixyz |
| `signature.ts` | 请求签名生成 | Nerixyz |
| `ig-main-entrance.ts` | 消息路由、结果返回 | XHS 实现 |
| `ig_injection.js` | 页面脚本注入、Cookie 捕获 | X 实现 |
| `ig-upload-session.ts` | 分片上传管理 | XHS 实现 |

---

## 三、开发阶段规划

### 阶段 0：技术验证（2-3 天）

**目标：** 验证 Instagram Web API 可行性

| 任务 | 输出 | 验证标准 |
|------|------|---------|
| 抓包分析核心 API | API 端点文档 | 确认请求格式、Headers |
| 签名算法验证 | `signature.ts` 原型 | 能生成有效签名 |
| Cookie 认证测试 | 认证流程文档 | 能获取自己的账号信息 |
| 原型实现 | `ig_get_self_info` | 返回正确数据 |

**关键技术点：**
- X-IG-App-ID: `936619743398459`
- 必需 Cookies: `sessionid`, `csrftoken`, `ds_user_id`
- 签名 Header: `X-IG-Signed-Body`

---

### 阶段一：读取 API（5-7 天）

**目标：** 实现感知层，让 AI 能"看到" Instagram

| 优先级 | API | messageType | 预计工时 |
|--------|-----|------------|---------|
| P0 | 获取自己账号信息 | `ig_get_self_info` | 0.5 天 |
| P0 | 获取主页 Feed | `ig_get_feed` | 1 天 |
| P1 | 获取用户信息 | `ig_get_user_info` | 0.5 天 |
| P1 | 获取媒体详情 | `ig_get_media` | 0.5 天 |
| P1 | 获取评论列表 | `ig_get_media_comments` | 0.5 天 |
| P1 | 搜索内容 | `ig_search` | 1 天 |
| P2 | 获取用户媒体列表 | `ig_get_user_media` | 0.5 天 |
| P2 | 获取粉丝/关注列表 | `ig_get_followers/following` | 1 天 |

**里程碑：** 完成 `ig-main-entrance.ts` 基础框架 + 8 个读取 API

---

### 阶段二：写操作 API（7-10 天）

**目标：** 实现执行层，AI 能操作 Instagram

| 优先级 | API | messageType | 预计工时 | 技术难点 |
|--------|-----|------------|---------|---------|
| P0 | 点赞 | `ig_like_media` | 0.5 天 | 签名 |
| P0 | 发布评论 | `ig_post_comment` | 0.5 天 | 签名 |
| P0 | 关注用户 | `ig_follow_user` | 0.5 天 | 签名 |
| P0 | 发布媒体 | `ig_post_media` | 2 天 | 上传流程 |
| P1 | 上传媒体 | `ig_upload_media` | 1.5 天 | 分片上传 |
| P1 | 取消点赞 | `ig_unlike_media` | 0.5 天 | - |
| P1 | 取消关注 | `ig_unfollow_user` | 0.5 天 | - |
| P2 | 删除媒体 | `ig_delete_media` | 0.5 天 | - |
| P2 | 删除评论 | `ig_delete_comment` | 0.5 天 | - |

**里程碑：** 完成核心写操作 + 媒体上传流程

---

### 阶段三：高级功能（5-7 天）

**目标：** Instagram 特有功能

| 优先级 | API | messageType | 预计工时 |
|--------|-----|------------|---------|
| P1 | 发布 Reels | `ig_post_reel` | 2 天 |
| P2 | 发布 Stories | `ig_post_story` | 2 天 |
| P2 | 发送私信 | `ig_send_dm` | 1 天 |
| P3 | 创建合集 | `ig_create_highlight` | 1 天 |

---

## 四、关键技术实现

### 4.1 签名算法（基于 Nerixyz）

```typescript
// ig_api/signature.ts

/**
 * Instagram 请求签名
 * 参考：Nerixyz instagram-private-api
 */
export async function signRequest(body: string): Promise<string> {
  // 1. 获取签名密钥（从页面注入脚本）
  const signatureKey = await getSignatureKey();
  
  // 2. HMAC-SHA256 签名
  const signature = await hmacSha256(body, signatureKey);
  
  // 3. 返回格式：sha256=xxx
  return `sha256=${signature}`;
}
```

**关键点：**
- 签名密钥从 Instagram 页面脚本动态提取
- 使用 HMAC-SHA256 算法
- 部分请求需要双重签名

### 4.2 Cookie 认证

```typescript
// ig_api/ig_api.ts

const REQUIRED_COOKIES = [
  'sessionid',
  'csrftoken', 
  'ds_user_id',
  'mid'
];

export async function getAuthCookies(): Promise<Map<string, string>> {
  const cookies = await chrome.cookies.getAll({
    domain: '.instagram.com'
  });
  
  const cookieMap = new Map<string, string>();
  for (const cookie of cookies) {
    if (REQUIRED_COOKIES.includes(cookie.name)) {
      cookieMap.set(cookie.name, cookie.value);
    }
  }
  
  return cookieMap;
}
```

### 4.3 媒体上传流程

```
1. 获取上传 URL
   POST /rupload_igvideo/{upload_id}
   
2. 分片上传（每片 5MB）
   - Header: Content-Type, Content-Range
   - Body: 二进制分片数据
   
3. 确认上传完成
   POST /api/v1/media/upload_finish/
   
4. 发布媒体
   POST /api/v1/media/configure/
```

**复用现有架构：**
- `ig-upload-session.ts` 参考 `content-upload-session.ts`
- 分片管理复用 `BackgroundTaskCoordinator`

---

## 五、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 签名算法变更 | 中 | 高 | 动态提取密钥 + 监控告警 |
| 频率限制严格 | 高 | 中 | 智能频率控制 + 随机延迟 |
| API 端点变更 | 中 | 中 | 版本锁定 + 快速响应机制 |
| 媒体上传失败 | 低 | 中 | 重试机制 + 错误上报 |

---

## 六、开发时间线

```
Week 1: 技术验证 + 阶段一（读取 API）
├── Day 1-2: 抓包分析、签名验证
├── Day 3: 原型实现 ig_get_self_info
├── Day 4-5: 实现核心读取 API
└── Day 6-7: 完成剩余读取 API + 测试

Week 2: 阶段二（写操作 API）
├── Day 1-3: 点赞、评论、关注
├── Day 4-5: 媒体上传流程
├── Day 6-7: 发布媒体 + 测试
└── Day 8-10: 完善写操作 + 集成测试

Week 3: 阶段三（高级功能）+ 文档
├── Day 1-3: Reels/Stories
├── Day 4-5: 私信、合集
├── Day 6: Python SDK 集成
└── Day 7: 文档完善 + 归档
```

---

## 七、下一步行动

### 立即开始（Day 1）

1. **克隆参考项目**
   ```bash
   git clone https://github.com/Nerixyz/instagram-private-api.git
   ```

2. **抓包分析**
   - 打开 Instagram Web
   - Chrome DevTools → Network
   - 记录关键 API 请求格式

3. **创建开发分支**
   ```bash
   git checkout -b feature/instagram-integration
   ```

4. **创建基础文件**
   ```
   touch src/ig_api/ig_api.ts
   touch src/ig_api/signature.ts
   touch src/content/ig-main-entrance.ts
   ```

---

## 八、成功标准

### 阶段一完成标准

- [ ] 能获取自己账号信息
- [ ] 能获取主页 Feed
- [ ] 能搜索内容
- [ ] 能获取用户信息和媒体列表
- [ ] 所有读取 API 有单元测试

### 阶段二完成标准

- [ ] 能发布图文/视频
- [ ] 能点赞、评论、关注
- [ ] 媒体上传支持 10MB+ 文件
- [ ] 所有写操作有频率控制

### 最终交付标准

- [ ] Python SDK `clawbot.services.ig` 可用
- [ ] 技术文档归档到 `docs/archive/`
- [ ] 集成测试通过
- [ ] 与 X/XHS 功能对标完成