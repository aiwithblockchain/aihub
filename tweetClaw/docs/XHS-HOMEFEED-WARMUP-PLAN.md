# XHS queryXhsHomefeed 自动预热实施计划

## 目标
将 `queryXhsHomefeed` 从“依赖最近一次自然页面请求”升级为：

- 完全可远程驱动
- 不依赖人工刷新
- 每次请求前可自动获得最新页面动态参数
- 作为后续 XHS 高风控接口的标准模式

---

## 核心方案

### 标准执行链路
1. background 接到 `command.query_xhs_homefeed`
2. 先确保存在可用的小红书 tab
3. 导航到目标页面：
   - `https://www.xiaohongshu.com/explore?channel_id=homefeed_recommend`
4. 根据“新鲜度策略”决定是否需要刷新预热
5. 等待页面真实 homefeed 请求发生并被捕获
6. content/inject 将最新动态头和模板写入 storage
7. background 确认参数新鲜有效
8. 再调用 content 的 `fetchXhsHomefeed(cursor_score)`
9. 返回 `response.query_xhs_homefeed`

---

## 一、设计原则

### 1. `queryXhsHomefeed` 不再依赖人工前置操作
调用者只发命令，不需要先手动刷新页面。

### 2. 动态参数来源以“页面实时生成”为准
高动态头不做长期静态默认值方案。

### 3. background 负责流程编排
- tab 管理
- 导航
- 刷新
- 等待预热完成
- 再触发主动请求

### 4. content / inject 负责观测与执行
- inject：被动捕获真实页面请求
- content：持久化捕获结果、执行最终 homefeed 请求

### 5. 建立“预热成功判定”与“新鲜度策略”
避免每次都无脑刷新，同时避免使用过期参数。

---

## 二、需要实现的能力拆分

### 能力 A：homefeed 参数新鲜度判定
新增统一判定函数，例如：

- `isXhsHomefeedContextFresh()`

判定依据建议：

#### 必须存在的高动态头
- `xhs_xs_sign`
- `xhs_xt`
- `xhs_xs_common`
- `xhs_x_rap_param`

#### 必须存在的模板
- `xhs_homefeed_template`

#### 必须满足的时间条件
例如：
- `captured_at` 距当前时间不超过 30 秒

#### 可选附加条件
- 当前 tab URL 已在：
  - `https://www.xiaohongshu.com/explore?channel_id=homefeed_recommend`
- 当前 tab 已完成加载

---

### 能力 B：homefeed 页面预热
新增 background 编排函数，例如：

- `ensureXhsHomefeedWarmContext()`

职责：
1. 查找或打开 XHS tab
2. 导航到目标 URL
3. 如果上下文不新鲜，则执行刷新
4. 等待 storage 中出现“本次刷新后捕获到的新参数”
5. 成功后返回 tab / 上下文信息

---

### 能力 C：等待页面捕获完成
新增等待逻辑，例如：

- `waitForXhsHomefeedCapture(afterTimestamp, timeoutMs)`

判断条件建议：
- `xhs_homefeed_template.captured_at > afterTimestamp`
- 且高动态头全部存在

超时建议：
- 10s ~ 15s

失败时抛出明确错误：
- `Timed out waiting for Xiaohongshu homefeed warm-up capture`

---

### 能力 D：避免并发冲突
新增 background 侧轻量锁，例如：

- `xhsHomefeedWarmupPromise`

行为：
- 如果已有 homefeed 预热在进行中，后续请求等待同一个 promise
- 避免多次重复刷新同一个页面

---

## 三、代码修改计划

### 1. `src/service_work/background.ts`
这是本次核心改造点。

#### 新增常量
- `XHS_HOMEFEED_URL = 'https://www.xiaohongshu.com/explore?channel_id=homefeed_recommend'`

#### 新增函数

##### `findOrCreateXhsTab()`
职责：
- 查找现有 XHS tab
- 若不存在，则创建新 tab
- 优先返回目标 URL tab

##### `navigateXhsTabToHomefeed(tabId)`
职责：
- 若当前 URL 不是目标 URL，则导航到目标 URL
- 等待加载完成

##### `isXhsHomefeedContextFresh()`
职责：
- 读取 storage
- 判断动态头 + 模板 + 时间是否有效

##### `waitForTabComplete(tabId, timeoutMs)`
职责：
- 等待 tab 完成加载

##### `waitForXhsHomefeedCapture(afterTimestamp, timeoutMs)`
职责：
- 轮询 storage 或通过事件等待
- 直到捕获数据新于 `afterTimestamp`

##### `ensureXhsHomefeedWarmContext()`
职责：
- 串联以上步骤
- 实现完整预热流程

#### 修改 `queryXhsHomefeed(payload)`
当前逻辑是：
- 直接找到 tab
- 直接 sendMessage 给 content

要改成：
1. `await ensureXhsHomefeedWarmContext()`
2. 然后再 `chrome.tabs.sendMessage(... XHS_FETCH_HOMEFEED ...)`

---

### 2. `src/content/xhs-main-entrance.ts`
当前已具备：
- 接收 inject 捕获结果
- 写 storage
- 执行 `fetchXhsHomefeed`

#### 建议增强
写 storage 时增加更清晰的元数据：
- `captured_at`
- `captured_from_url`
- `captured_method`
- `captured_endpoint`

可选：向 background 主动发消息：
- `type: 'XHS_HOMEFEED_CAPTURED'`

第一版可先用 storage 轮询实现，简单可靠。

---

### 3. `src/platforms/xiaohongshu/xhs-api.ts`
当前这个文件已经基本正确，但要适配最终方案。

#### 保留
- 高动态头缺失时报错
- `xy-direction` 默认值 `98`
- 首屏 / 翻页 body 模板策略

#### 建议增强
##### `ensureHomefeedDynamicHeaders()`
增加时间新鲜度检查，例如：
- 如果 `captured_at` 太旧，也报错

##### `fetchXhsHomefeed(cursorScore)`
继续保持：
- 首屏：`refresh_type = 1`, `note_index = 0`
- 翻页：`refresh_type = 3`, `note_index = 35`

后续如果真实页面发现翻页 `note_index` 还会继续推进，再单独升级。

---

### 4. `src/platforms/xiaohongshu/xhs-injection.ts`
当前主要做被动采集，已足够支撑新方案。

#### 建议保留
- 对真实 homefeed 请求的 fetch/XHR 捕获
- 关键头抽取

#### 建议修改
- 保持默认不打印大 JSON
- 继续用 `window.__XHS_CLAW_DEBUG__` 控制 debug

不建议让它重新承担主动业务请求。

---

### 5. 文档更新
本计划实施完成后，需要同步更新：
- `docs/TASK-XHS-HOMEFEED.md`

新增“最终标准执行模型”章节，明确：

> `queryXhsHomefeed` 的标准实现为：background 自动预热页面上下文，再执行主动请求。

---

## 四、执行时序

### 场景 1：首次调用 `queryXhsHomefeed("")`
1. websocket 收到命令
2. background 查找 XHS tab
3. 若无 tab，创建 tab 并打开目标 URL
4. 等待页面加载
5. 检查 storage：无新鲜参数
6. 执行 refresh
7. 等待页面真实 homefeed 请求被 inject/content 捕获
8. storage 出现最新动态头与模板
9. background 调 content 的 `XHS_FETCH_HOMEFEED`
10. content 调 `fetchXhsHomefeed("")`
11. 返回第一页结果

### 场景 2：短时间内再次调用 `queryXhsHomefeed(nextCursor)`
1. background 检查上下文仍新鲜
2. 不刷新
3. 直接调用 content 发请求
4. 返回第二页结果

### 场景 3：参数过期后调用
1. background 检测 `captured_at` 过旧
2. 再次执行 refresh 预热
3. 等待新参数捕获
4. 再执行请求

---

## 五、新鲜度策略建议

第一版建议简单一些。

### fresh 条件
满足以下全部条件：
1. `x-s`
2. `x-t`
3. `x-s-common`
4. `x-rap-param`
5. `xhs_homefeed_template`
6. `captured_at >= now - 30_000`

即：
- 30 秒内捕获的数据视为可用

### 为什么先用 30 秒
- 足够短，降低签名过期概率
- 足够长，避免连续翻页时频繁刷新

后续再根据真实表现调节到：
- 15 秒
- 60 秒
等

---

## 六、错误处理设计

### 1. 页面未登录
错误：
- `No valid Xiaohongshu session found`
或沿用当前 API 错误结果

### 2. 预热超时
错误：
- `Timed out waiting for Xiaohongshu homefeed warm-up capture`

### 3. 动态头缺失
错误：
- `Missing captured Xiaohongshu dynamic headers: ...`

### 4. 请求失败
错误：
- 保留当前：
  - `Failed to fetch homefeed: <status> <text>`

---

## 七、为什么这是以后 `queryXhsHomefeed` 的标准方案

因为它同时满足：

### 1. 远程控制要求
不需要人工先刷新。

### 2. 动态签名现实约束
不把 `x-s/x-t/x-s-common/x-rap-param` 错误地当成静态配置。

### 3. 浏览器能力优势
既然我们本来就能控制 tab/导航/刷新，就应该利用真实页面环境来产出最新上下文。

### 4. 可推广性
未来其它 XHS 高风控接口也可以复用：
- 先预热目标页面
- 捕获最新动态参数
- 再执行远程动作

---

## 八、实施顺序

### Phase 1
改 `background.ts`，加入：
- find/create tab
- navigate
- refresh
- wait capture
- freshness check

### Phase 2
增强 `content` 写入的 capture metadata

### Phase 3
将 `queryXhsHomefeed` 切换到：
- 先 warm-up
- 再 fetch

### Phase 4
端到端验证：
- 首次请求自动成功
- 不人工刷新也成功
- 第二页成功
- 参数过期后自动 refresh 仍成功

### Phase 5
同步文档
