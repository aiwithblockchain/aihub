# 小红书多上下文接口实现策略

## 核心原则
以后不要把 XHS 接口当成“统一签名 + 统一请求模板”的系统。
更合理的模型是：

> 按页面上下文（context）建模
> 每个 context 有自己的：
> - 目标页面
> - 预热方式
> - 真实请求采集点
> - 动态头缓存
> - 请求模板
> - freshness 策略

这样 homefeed 的成功经验才能复用到别的能力上。

---

## 一、统一抽象模型

### Context 的标准结构
建议以后每个 XHS context 都按同样结构定义：

#### 1. context name
例如：
- `homefeed`
- `note_detail`
- `user_profile`
- `comment_page`
- `search`

#### 2. target URL
为了让页面自然生成该类请求所需参数，必须进入的页面。

#### 3. warm-up action
为了让真实请求发生，需要做什么动作：
- 页面打开即触发
- 刷新
- 滚动
- 点击 tab
- 打开详情
- 输入搜索词

#### 4. capture rule
要拦截哪些真实请求：
- endpoint
- method
- 是否只采集成功请求
- 需要提取哪些动态头和 body 模板

#### 5. reusable state
要写入 storage 的内容：
- 动态头
- 模板参数
- captured_at
- captured_from_url
- captured_context

#### 6. active request API
远程主动调用时使用哪个函数：
- `queryXhsHomefeed`
- `queryXhsNoteDetail`
- `queryXhsUserProfile`
- `queryXhsCommentPage`
- `queryXhsSearch`

#### 7. freshness policy
这组参数多久内有效：
- 30 秒
- 60 秒
- 或按接口特点单独定义

---

## 二、建议优先建设的 context

### Context 1：homefeed
这是当前已经跑通的标准样板。

#### 目标页面
- `https://www.xiaohongshu.com/explore?channel_id=homefeed_recommend`

#### 预热动作
- 打开 / 导航 / 刷新页面

#### 捕获请求
- `POST /api/sns/web/v1/homefeed`

#### 已验证有效的动态头
- `x-s`
- `x-t`
- `x-s-common`
- `x-rap-param`
- `x-b3-traceid`
- `x-xray-traceid`
- `xy-direction`

#### 主动能力
- `queryXhsHomefeed(cursor_score)`

#### 现状
- 已成功
- 可作为后续所有 context 的模板

---

### Context 2：note_detail
#### 目标能力
读取指定笔记的详情数据。

#### 目标页面
- 某条笔记详情页 URL

例如：
- `https://www.xiaohongshu.com/explore/<note_id>`

#### 预热动作
- 打开笔记详情页
- 等待页面自然加载详情请求

#### 预期捕获请求
高概率是：
- `GET /api/sns/web/v1/note/...`
或与笔记详情相关的真实 web 接口

#### 可能产出的能力
- `queryXhsNoteDetail(note_id)`

#### 风险判断
这类接口通常比 homefeed 更稳定，可能比评论简单，建议优先级高。

#### 建议优先级
**高**

---

### Context 3：comment_page
#### 目标能力
读取笔记评论列表、分页评论。

#### 目标页面
- 某条笔记详情页

#### 预热动作
- 打开笔记详情页
- 触发评论区展示（必要时滚动 / 点击评论区）

#### 预期捕获请求
你前面已经提到过：
- `/api/sns/web/v2/comment/page`

#### 可能产出的能力
- `queryXhsCommentPage(note_id, cursor?)`

#### 风险判断
评论往往比详情更容易受页面状态影响，比如：
- 是否已展开评论
- 是否需要特定 UI 交互触发

#### 建议优先级
**高**

---

### Context 4：user_profile
#### 目标能力
读取用户资料、用户公开主页数据。

#### 目标页面
- 用户主页 URL

#### 预热动作
- 打开目标用户主页
- 等待页面自然发出用户信息请求

#### 预期捕获请求
可能包括：
- 用户基本信息
- 用户发布列表
- 用户关系信息

#### 可能产出的能力
- `queryXhsUserProfile(user_id)`
- `queryXhsUserPosted(user_id, cursor?)`

#### 风险判断
用户主页类接口通常较适合 context 化治理。

#### 建议优先级
**高**

---

### Context 5：search
#### 目标能力
按关键词读取搜索结果。

#### 目标页面
- 搜索结果页

#### 预热动作
- 打开搜索页
- 输入关键词 / 导航到已带参数的搜索 URL
- 等待页面自然发出搜索请求

#### 预期捕获请求
- 搜索结果相关接口

#### 可能产出的能力
- `queryXhsSearch(keyword, cursor?)`

#### 风险判断
搜索通常会有更强的上下文绑定，可能比 homefeed 更复杂，但值得做。

#### 建议优先级
**中高**

---

### Context 6：user_action / behavior
#### 目标能力
点赞、关注、收藏、评论等行为类控制。

#### 目标页面
- 笔记详情页 / 用户主页等

#### 现状
你已经有部分主动行为能力了。

#### 风险判断
这类行为往往风控更高，可能需要比读取类接口更严格的上下文和参数新鲜度管理。

#### 建议优先级
**中**

---

### Context 7：security / high-risk
#### 目标能力
更底层风险接口分析，例如你之前关注的：
- `sbtsource`
- 其他风控相关接口

#### 风险判断
这类不建议在读取类能力未完全体系化之前投入太深。

#### 建议优先级
**低，单独研究**

---

## 三、建议的开发顺序

### 第一阶段：把 homefeed 抽象成标准模板
目标不是继续扩功能，而是沉淀方法论：
- context 配置项
- warm-up 机制
- freshness 机制
- capture → storage → active request 流程

这是基础设施。

### 第二阶段：优先打通 3 个高价值读取类 context
建议顺序：
1. `note_detail`
2. `comment_page`
3. `user_profile`

为什么这样排：
- 它们都是高业务价值
- 也都比较符合“打开页面 → 页面自然发请求 → 捕获 → 再主动读”的模式

### 第三阶段：search
search 价值高，但更可能涉及更多 UI 驱动和参数变化。

### 第四阶段：行为类与高风险接口
等读取链路体系稳定后再系统推进。

---

## 四、统一实现框架建议
以后最好不要每个接口各自零散实现。
建议逐步抽象成统一框架：

### 1. Context registry
例如维护一份配置：
- `homefeed`
- `note_detail`
- `comment_page`
- `user_profile`
- `search`

每个 context 描述：
- target URL builder
- warm-up strategy
- capture endpoints
- storage keys
- active fetch function

### 2. Warm-up orchestrator
background 统一负责：
- 找 tab
- 打开页面
- 导航
- 刷新
- 等待采集成功

以后所有 context 共用这套 orchestrator。

### 3. Capture manager
inject/content 统一负责：
- 采集真实请求
- 识别属于哪个 context
- 写入对应 storage

### 4. Active request layer
`xhs-api.ts` 中按 context 读取对应 storage 数据发请求。

---

## 五、判断一个新接口是否值得纳入 context 化方案的标准
以后你看到一个新接口时，先问 5 个问题：

1. 它在哪个页面上下文自然发生？
2. 页面打开后会不会自然发出这个请求？
3. 是否能稳定捕获它的动态头？
4. 主动请求时是否能复用这组参数？
5. 这个接口是否有明确业务价值？

只要 1~4 能成立，这个接口就适合进入 context 体系。

---

## 六、最重要的最终结论

不是：
“homefeed 这套参数能否顺手打通所有其它接口”

而是：
“homefeed 已经证明：XHS 应该按页面上下文逐类实现”

这才是可持续路线。

---

## 七、后续具体建议
如果你接下来要继续做一个新能力，我建议按这个优先级选：

### 第一优先
- `note_detail`

### 第二优先
- `comment_page`

### 第三优先
- `user_profile / user_posted`

因为这三类最可能直接复用我们刚刚验证成功的方法论。
