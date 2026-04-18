# 小红书高风控接口开发说明

## 背景

我们已经验证：

- 当前登录账号信息可通过 `GET /api/sns/web/v2/user/me` 稳定获取
- 该接口已在扩展中打通，用于 `command.query_xhs_account_info`
- 小红书前端还会请求安全配置接口：
  - `POST https://as.xiaohongshu.com/api/sec/v1/sbtsource`
- 该接口返回了签名脚本、指纹脚本、上报入口，以及一组需要统一补丁/签名处理的高风控接口列表（`commonPatch`）

这意味着：

1. 小红书并不是所有接口都能像 `/api/sns/web/v2/user/me` 一样直接稳定调用
2. 后续涉及互动、内容读取、内容发布的接口，必须默认按“高风控接口”处理
3. 现有 inject 架构必须保留，后续开发优先围绕“页面真实签名链路”展开，而不是手写静态请求

---

## 已确认的安全配置接口含义

抓包请求：

```http
POST https://as.xiaohongshu.com/api/sec/v1/sbtsource
Content-Type: application/json;charset=UTF-8
body: {"callFrom":"web","appId":"xhs-pc-web"}
```

返回的关键字段：

- `reportUrl`: 风控/环境画像上报入口
- `signUrl`: 签名脚本地址，和 `x-s` 生成强相关
- `xhsTokenUrl`: token/安全校验脚本地址
- `url`: 指纹脚本地址（大概率 fingerprint）
- `extraInfo.dsUrl`: 动态安全脚本地址
- `commonPatch`: 需要统一补丁/签名/风控处理的接口列表

结论：

- `x-s`、`x-t` 不是静态参数，而是页面安全链路的一部分
- 这些参数的生成依赖页面运行时、签名脚本、风控脚本、环境信息
- 对 `commonPatch` 中的接口，不能默认认为 content 里手写 `fetch()` 就足够稳定

---

## 当前稳定接口

### 1. 当前登录账号信息

接口：

```http
GET https://edith.xiaohongshu.com/api/sns/web/v2/user/me
```

用途：

- 获取当前登录账号的基础资料
- 已用于 `command.query_xhs_account_info`

当前已验证字段：

- `red_id`
- `user_id`
- `nickname`
- `desc`
- `gender`
- `images`
- `imageb`
- `guest`

说明：

- 该接口当前不在 `commonPatch` 列表里
- 因此比点赞/关注/评论/Feed 这类接口更容易稳定调用
- 它应该作为“账号管理”类功能的基础接口

---

## 高风控接口清单（基于 commonPatch）

以下接口应统一视为“高风控接口”，后续开发时必须重点关注签名、补丁和页面运行时依赖。

### A. 已在项目中出现或已规划的接口

#### 1. 获取 Feed

接口：

```http
/api/sns/web/v1/feed
```

当前状态：

- 常量已存在：`XHS_API_ENDPOINTS.FEED`
- 处于规划/待完善状态

风险判断：高

原因：

- 在 `commonPatch` 列表中
- 很可能依赖动态签名和页面补丁
- 返回内容结构复杂，可能伴随分页、游标、推荐策略等逻辑

建议：

- 优先通过页面真实请求链路观察参数结构
- 开发时优先保留 inject 拦截与页面态调试能力
- 不要先假设单纯复用 `fetch + x-s + x-t` 就能长期稳定

---

#### 2. 点赞

接口：

```http
/api/sns/web/v1/note/like
```

当前状态：

- 已有常量：`XHS_API_ENDPOINTS.LIKE`
- 已有调用封装：`performXhsAction('like' | 'unlike')`

风险判断：高

原因：

- 在 `commonPatch` 列表中
- 属于典型互动型接口，容易触发签名与风控校验

建议：

- 需要验证当前 `performXhsAction()` 在真实页面下是否长期稳定
- 建议抓真实网页点赞请求，逐项比对：
  - method
  - body
  - x-s
  - x-t
  - 是否存在额外 header
  - 是否依赖页面先前安全初始化流程

---

#### 3. 收藏

接口：

```http
/api/sns/web/v1/note/collect
```

当前状态：

- 已有常量：`XHS_API_ENDPOINTS.COLLECT`
- 已有调用封装：`performXhsAction('collect' | 'uncollect')`

风险判断：高

原因：

- 在 `commonPatch` 列表中
- 与点赞一样属于互动接口

建议：

- 和点赞一样处理
- 先做真实网页抓包比对，再决定是否直接走 content fetch

---

#### 4. 关注

接口：

```http
/api/sns/web/v1/user/follow
```

当前状态：

- 已有常量：`XHS_API_ENDPOINTS.FOLLOW`
- 已有调用封装：`performXhsAction('follow' | 'unfollow')`

风险判断：高

原因：

- 在 `commonPatch` 列表中
- 关注关系变更通常是风控敏感行为

建议：

- 必须抓包核对真实请求
- 不建议直接相信当前 body 结构长期正确
- 优先确认：
  - `target_user_id` 是否稳定
  - 是否有额外标识字段
  - 是否存在前置校验或节流

---

#### 5. 评论发布

抓包列表中的接口：

```http
/api/sns/web/v1/comment/post
```

当前项目常量：

```http
/api/sns/web/v2/comment/post
```

当前状态：

- 项目里已有 `XHS_API_ENDPOINTS.COMMENT_POST = /api/sns/web/v2/comment/post`
- 但 `commonPatch` 里出现的是 `/api/sns/web/v1/comment/post`

风险判断：很高

原因：

- 当前项目实现与抓包/安全配置返回不一致
- 存在版本不一致风险（v1 vs v2）
- 这类接口又在高风控列表里

建议：

- 评论功能开发前必须重新抓真实网页请求
- 先确认网页当前实际使用的是 v1 还是 v2
- 在没有真实抓包前，不要默认现有常量就是正确的

---

### B. 后续可能要支持但当前尚未实现的接口

#### 6. 笔记发布

接口：

```http
/fe_api/burdock/v2/note/post
```

风险判断：极高

原因：

- 发帖属于最敏感行为之一
- 在 `commonPatch` 列表中
- 往往涉及更多上传、草稿、素材、封面、正文结构、风控校验

建议：

- 单独立项，不要和普通读取接口混在一起
- 大概率需要完整页面链路观察与分步骤实现

---

#### 7. 评论读取 / 评论分页

当前项目常量：

```http
/api/sns/web/v2/comment/page
```

当前状态：

- 常量已存在：`XHS_API_ENDPOINTS.COMMENT_PAGE`
- 但不在本次 `commonPatch` 返回中

风险判断：中到高

说明：

- 虽然这次抓包的 `commonPatch` 里没有它
- 但评论相关接口整体仍然属于较敏感区域
- 需要通过真实页面抓包确认其签名依赖程度

建议：

- 后续开发时单独验证
- 不要因为不在当前 `commonPatch` 就视为低风险

---

#### 8. 笔记详情

当前项目常量：

```http
/api/sns/web/v1/note/:noteId
```

当前状态：

- 已有 `fetchXhsNote(noteId)`

风险判断：中到高

说明：

- 不在当前 `commonPatch` 列表中
- 但仍属于核心内容读取接口
- 是否稳定仍要以真实抓包为准

建议：

- 后续开发时补做抓包验证
- 重点看是否依赖 `x-s` / `x-t`

---

## 当前项目代码现状与风险提示

### 已有封装

当前项目已经存在的 XHS API 封装主要包括：

- `performXhsAction()`
  - like / unlike
  - collect / uncollect
  - follow / unfollow
  - comment
- `fetchXhsNote(noteId)`
- `fetchXhsCurrentUser()`

### 风险判断

其中：

- `fetchXhsCurrentUser()`：已验证可用
- `performXhsAction()`：仅说明“已有封装”，不代表已经通过真实风控验证
- `fetchXhsNote()`：未完成真实抓包比对，不应默认稳定

所以当前结论不是“XHS 互动功能已经完成”，而是：

**当前只确认“当前账号信息查询”这条链路已跑通；其余接口都还需要基于真实网页请求逐项核对。**

---

## 推荐开发策略

### 第一阶段：低风险、已验证接口优先

优先做：

1. 当前登录账号信息
2. 与账号管理直接相关但可抓到明确网页请求的只读接口

目标：

- 建立稳定的 XHS 查询基础能力
- 先不要急于覆盖所有互动接口

---

### 第二阶段：逐个推进高风控互动接口

建议顺序：

1. like / unlike
2. collect / uncollect
3. follow / unfollow
4. comment post
5. feed
6. note post

每个接口都建议遵循固定流程：

1. 在真实网页操作一次
2. 抓包记录：
   - URL
   - method
   - body
   - x-s
   - x-t
   - referrer
   - 其它关键 header
3. 对比当前项目实现是否一致
4. 再决定：
   - 能否直接 content 调用
   - 是否必须走 inject / 页面态桥接
   - 是否需要保留动态补丁/签名采集

---

## 开发原则（必须遵守）

1. **不要再猜 API**
   - 必须以真实网页抓包为准

2. **不要把现有封装等同于已验证能力**
   - 代码里有接口封装 ≠ 已经可用

3. **高风控接口默认先按页面真实链路处理**
   - 特别是 `commonPatch` 里的接口

4. **inject 架构必须保留**
   - 即使当前未启用全量拦截，也必须保留可快速恢复能力

5. **优先做最小闭环验证**
   - 每完成一个接口，就走一次从扩展到 LocalBridge 的完整测试

---

## 当前建议的下一步任务

建议下一步从以下两类任务里选一类：

### 方案 A：先做互动接口最小闭环
优先做：
- `like`
- `collect`
- `follow`

目标：
- 验证高风控互动接口在当前架构下到底能不能稳定工作

### 方案 B：先做更多只读接口
优先做：
- note detail
- comment page
- feed

目标：
- 优先扩展读取能力，降低操作类风控风险

---

## 附：本轮已确认正确的当前账号信息接口

```http
GET https://edith.xiaohongshu.com/api/sns/web/v2/user/me
```

成功返回示例字段：

```json
{
  "code": 0,
  "success": true,
  "msg": "成功",
  "data": {
    "red_id": "94181395786",
    "user_id": "66d2d0e6000000001b0178ca",
    "nickname": "tweetclaw",
    "desc": "我是ai agent",
    "gender": 0,
    "images": "...",
    "imageb": "...",
    "guest": false
  }
}
```
