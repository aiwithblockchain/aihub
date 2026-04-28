# LocalBridgeMac 日志全生命周期重构方案

## 文档信息
- 文档名称：LocalBridgeMac 日志全生命周期重构方案
- 版本：v1.0
- 状态：待评审
- 创建日期：2026-04-28
- 适用范围：`localBridge/apple/LocalBridgeMac`
- 关键文件：
  - `localBridge/apple/LocalBridgeMac/BridgeLogger.swift`
  - `localBridge/apple/LocalBridgeMac/BridgeLogsViewController.swift`
  - `localBridge/apple/LocalBridgeMac/LocalBridgeGoManager.swift`
  - `localBridge/apple/LocalBridgeMac/SettingsViewController.swift`
  - `localBridge/apple/LocalBridgeMac/AppDelegate.swift`

---

## 1. 背景与问题定义

LocalBridgeMac 当前的日志体系已经从纯内存展示，切到“文件为主、UI 为辅”的方向，但最近暴露了一个更本质的问题：日志卡顿不只是渲染压力，更可能是日志生命周期设计本身存在 bug。

用户观察到一个很强的异常信号：

1. 点击 clear 后，日志看似被清空。
2. 下一次日志轮询周期到来时，瞬间又被约 4000 条日志重新填满。
3. 这不是单纯的 UI 重绘问题，而是日志源、轮询状态、文件持久化、清理语义之间不一致导致的生命周期错误。

这说明当前方案的问题不在“某一行代码慢”，而在于：
- 日志的真实来源不止一个。
- 日志清理动作没有覆盖完整生命周期。
- Go 侧日志快照与 Mac 侧显示状态没有统一真相源。
- UI 层与日志层的语义边界还不够清晰。

所以这次不能只补一个 clear 按钮，也不能只减轻渲染压力。必须把日志的全生命周期重新设计完整。

---

## 2. 用户最新需求

本次重构要满足以下三项核心需求：

### 2.1 日志轮转
当当前日志文件超过指定大小时，需要触发一次轮转：
- 当前活动日志文件归档
- 新建一个空的活动日志文件继续写入
- 不让单个日志文件无限膨胀

### 2.2 日志保留期
需要定义日志保留时长：
- 超过保留日期的归档日志自动删除
- 避免历史日志长期堆积，占用磁盘空间

### 2.3 UI 只展示最近 1000 条
UI 上仍然保留日志展示功能，但只展示最近 1000 条：
- 不再尝试显示完整历史
- 降低内存和主线程渲染压力
- 保持调试可用性

另外，这次要先定位 clear 后日志瞬间回灌的 bug 根因，再在此基础上实施新方案。

---

## 3. 目标与非目标

### 3.1 目标

这次重构完成后，系统必须满足：

1. 日志以文件为长期真相源。
2. 单个活动日志文件超过阈值时自动轮转。
3. 归档日志按保留期自动删除。
4. UI 始终只展示最近 1000 条日志。
5. clear 后不会在下一轮轮询中把旧日志整批重新灌回 UI。
6. 日志维护动作不阻塞主线程。
7. 用户仍然可以在 UI 中查看近期日志，并能定位日志文件。

### 3.2 非目标

本次重构不做以下事情：

1. 不引入远程日志上报。
2. 不增加复杂的日志检索、过滤、搜索系统。
3. 不把日志改造成数据库存储。
4. 不在第一阶段引入用户可配置的轮转阈值与保留天数界面。
5. 不重构所有 LocalBridge 业务逻辑，只处理与日志生命周期直接相关的部分。

---

## 4. 当前实现审计

### 4.1 `BridgeLogger.swift`

现状要点：
- 已有文件写入能力。
- 内部维护 `recentLines` 缓存。
- `currentLogText()` / `snapshot()` 仍然会从文件重新读取文本。
- `clearLogs()` 会清空文件、清空 recent cache，并发出通知。

当前问题：
- UI 展示路径和文件路径仍耦合较重。
- clear 只清空 Mac 侧文件与缓存，并不能天然保证 Go 轮询状态同步。
- 没有日志轮转。
- 没有归档保留期清理。
- UI 读取仍是按文本读文件，不是严格受控的 1000 行 tail 模式。

### 4.2 `LocalBridgeGoManager.swift`

现状要点：
- 周期性调用 `LocalBridgeGetLogsJSON()` 拉取 Go 侧日志快照。
- 内部依赖 `lastGoLogSnapshot` 比对新旧快照，提取增量。
- 新增日志通过 `BridgeLogger.shared.append(newLines.map { "[Go] \($0)" })` 进入 Mac 侧 logger。

clear bug 的高概率根因就在这里。

目前逻辑里，Mac UI 的 clear 和 Go 快照状态不是同一个生命周期对象。
如果 clear 只清掉文件和展示缓存，但 Go 侧仍持有一整份历史显示缓冲，那么下一轮轮询时：
- Go 重新返回完整日志数组
- Mac 侧又把这些日志识别为“新输入”或“需要重新对齐的输入”
- 于是 UI 瞬间重新充满几千条日志

所以这个 bug 不应简单归因给渲染层，更像是 **Go 日志快照生命周期与 Mac logger 生命周期脱节**。

### 4.3 `BridgeLogsViewController.swift`

现状要点：
- 接收 `BridgeLogger.didUpdateNotification`
- 每次刷新时构造整段富文本
- 当前数据源仍然是完整文本读取再 split

当前问题：
- 如果一次读入几千行，主线程构造 attributed string 仍然有明显压力。
- 它现在没有一个明确的“只显示最近 1000 条”边界。

### 4.4 `SettingsViewController.swift`

现状要点：
- Settings 中已有 Logs 区块。
- 支持 clear 和 reveal log file。

当前问题：
- 日志卡片本身还没有表达“只显示 tail”的产品语义。
- 没有展示轮转/保留策略说明。
- clear 的语义目前更像“删干净了”，但实际未必覆盖 Go 侧生命周期。

---

## 5. 根因分析：为什么 clear 后会瞬间回灌 4000 条

基于现有代码和用户现象，最合理的根因判断是：

### 5.1 日志并不是一个单一来源
系统里至少有两层来源：

1. **Mac 文件日志**
   - 由 `BridgeLogger` 写入 `bridge.log`
2. **Go 内存日志快照**
   - 由 `LocalBridgeGetLogsJSON()` 返回
   - 由 `LocalBridgeGoManager` 定时轮询并桥接到 `BridgeLogger`

如果 clear 只处理第一层，而第二层没有一起处理，下一轮轮询就会把旧历史重新送回来。

### 5.2 clear 动作语义不完整
用户点 clear 时，心理预期是：
- 当前显示清空
- 后台日志源也被正确“推进到新的起点”
- 下一轮不会把旧历史再刷回来

但当前实现里，clear 很可能只完成了：
- 清空 Mac 文件
- 清空 Mac recent cache

没有完整完成：
- 清空 Go 的显示缓冲，或
- 正确重置 Go polling reconciliation 状态

### 5.3 轮询状态机没有显式处理“日志源被清空/重置”
即使 Go 端本身有清理接口，如果轮询端没有识别“日志源已经 reset”这一状态，也可能导致：
- 旧 snapshot 与新 snapshot 的比较语义失效
- 重新回放历史快照

这就是典型的 lifecycle bug，不是简单的单点性能问题。

### 5.4 用户的怀疑是合理的
用户说“我怀疑这个 bug 是 go 或者 tweetClaw 等前端导致的”，这个判断是合理的。

更准确地说，这个 bug 很可能不是某一个单端单独造成，而是 **Go 快照 + Mac 轮询对齐 + UI clear 语义** 三方协作不完整造成的。

tweetClaw / aiClaw 等前端若继续稳定地产生日志，只会放大这个问题，但不是唯一根因。

---

## 6. 重构总原则

### 6.1 单一真相源原则
长期日志真相源必须是文件系统，而不是 UI 内存数组。

### 6.2 UI Tail 原则
UI 只消费最近 1000 条，不追求完整历史回放。

### 6.3 生命周期闭环原则
clear、轮转、归档、保留期删除、Go 轮询对齐，这些动作必须组成闭环，不能各管一段。

### 6.4 后台 IO 原则
文件写入、轮转、归档扫描、保留期删除都在后台串行队列处理，不进入主线程。

### 6.5 增量显示原则
UI 只在必要时刷新，而且刷新内容有明确上限。

---

## 7. 新方案概览

新的日志体系分成三层：

### 7.1 层 1：磁盘层，长期真相源
由 `BridgeLogger` 负责：
- 活动日志文件写入
- 超阈值轮转
- 归档日志管理
- 过期归档删除

### 7.2 层 2：内存 tail 层，UI 消费层
由 `BridgeLogger` 维护固定大小 recent tail：
- 只保留最近 1000 条
- UI 不再从全量历史推导显示状态
- UI 只读取 tail snapshot

### 7.3 层 3：Go 轮询对齐层
由 `LocalBridgeGoManager` 负责：
- 拉取 Go 日志快照
- 识别是 append-only 还是 snapshot reset
- 避免 clear 后历史日志重新整批注入
- 避免一次性回灌数千条造成 UI 和磁盘压力

---

## 8. 文件布局设计

推荐目录：

- 活动日志文件：
  - `~/Library/Application Support/LocalBridgeMac/Logs/bridge.log`
- 归档目录：
  - `~/Library/Application Support/LocalBridgeMac/Logs/archive/`
- 归档文件命名：
  - `bridge-YYYYMMDD-HHmmss.log`

说明：
- 保持与当前 `Application Support/LocalBridgeMac/Logs` 路径兼容，减少迁移成本。
- 引入 `archive/` 子目录，明确当前日志与归档日志边界。

---

## 9. 轮转策略设计

### 9.1 触发条件
活动日志文件超过阈值时触发轮转。

推荐默认值：
- `maxActiveLogBytes = 5 * 1024 * 1024`，即 5MB

原因：
- 足够承载近期调试日志
- 不会让单文件无限膨胀
- 轮转频率适中

### 9.2 轮转流程
在 logger 的后台串行队列执行：

1. 检查活动日志文件大小。
2. 若未超阈值，继续写入。
3. 若超阈值：
   - 关闭当前写入句柄（如果持有）
   - 将 `bridge.log` 移动到 `archive/bridge-YYYYMMDD-HHmmss.log`
   - 创建新的空 `bridge.log`
   - 在新文件写入一条轮转标记，例如：
     - `[time] [Log] rotated from previous active log`
4. 轮转后立即触发归档清理。

### 9.3 UI 与轮转的关系
UI recent tail 不需要保留整个归档历史。
轮转只影响磁盘，不应强制 UI 重新回放归档。
UI 继续显示最近 1000 条即可。

---

## 10. 保留期策略设计

### 10.1 保留对象
只删除归档目录里的过期日志文件。
不自动删除当前活动日志文件。

### 10.2 推荐默认值
- `logRetentionDays = 7`

### 10.3 执行时机
保留期清理在以下时机执行：

1. App 启动时
2. 每次日志轮转后
3. 可选：每日首次写入时

第一阶段建议先做前两项，简单可靠。

### 10.4 删除规则
- 读取 archive 目录下所有 `bridge-*.log`
- 依据文件修改时间或文件名时间戳判断是否过期
- 过期则删除

推荐优先使用文件修改时间，逻辑更稳，不依赖文件名解析作为唯一来源。

---

## 11. UI 展示策略设计

### 11.1 展示上限
UI 始终只显示最近 1000 条。

### 11.2 recent tail 维护方式
`BridgeLogger` 内部维护：
- `displayMaxLines = 1000`
- 每次 append 后裁剪到最近 1000 条
- 启动时从活动日志文件尾部读取最近 1000 条恢复 UI

### 11.3 `BridgeLogsViewController` 的职责
控制器不再从“完整日志文本”推导显示内容，而只消费 logger 暴露的 tail 数据：
- `displaySnapshot()` 或等价接口
- 只构造最近 1000 行的 attributed string
- 保留 copy / clear / auto-scroll 等现有交互

### 11.4 clear 的新语义
需要明确区分两个动作：

#### A. 清空显示日志
- 清空 UI 的 recent tail
- 清空活动日志文件
- 同时通知 Go 侧清空显示缓冲或重置快照对齐状态

#### B. 自动轮转与归档
- 属于后台维护行为
- 不暴露给用户作为手动清理操作

用户点击 clear 后的目标是“从现在开始重新记”，而不是“归档仍然偷偷在下一轮全部灌回来”。

---

## 12. Go 轮询一致性方案

这是这次重构里最关键的 bug 修复点。

### 12.1 当前模型的问题
当前轮询是把 Go 返回的 `[String]` 视为快照，再和 `lastGoLogSnapshot` 做差异比对。
如果快照源或清理语义发生变化，而轮询器没有显式识别 reset，就容易出现整批回灌。

### 12.2 新的对齐模型
`LocalBridgeGoManager` 需要显式处理三类情况：

#### 情况 A：append-only 继续增长
- 新快照以前一个快照为前缀
- 只取 delta 部分追加到 `BridgeLogger`

#### 情况 B：快照缩短
- 新快照长度小于旧快照
- 视为日志源 reset 或 Go 侧清空
- 不再按旧 offset 推导
- 重新以新快照作为基准

#### 情况 C：长度没变或更长，但内容不连续
- 前缀/后缀比对失败
- 说明 Go 侧快照已经重建或替换
- 视为 snapshot discontinuity
- 重新对齐，而不是盲目回放全部历史

### 12.3 reset 后怎么处理
当检测到 reset/discontinuity 时：
- 不要把几千条旧日志全部重新写进 UI 和文件
- 只取当前快照的 tail，最多 1000 条进行重新基线对齐
- 同时写一条 lifecycle 标记，例如：
  - `[Go] log snapshot reset detected, rebasing to recent tail`

这样可以保证：
- 不丢掉“日志源发生过重置”这个证据
- 不会再因为 reset 而把 4000 条历史一次性回灌

### 12.4 clear 与轮询状态的联动
用户点击 clear 时，需要同时做三件事：

1. `BridgeLogger` 清空文件和 recent tail。
2. `LocalBridgeGoManager` 调用 Go 的日志清理接口，清掉 Go 显示缓冲。
3. `LocalBridgeGoManager` 把自己的 `lastGoLogSnapshot` 一起 reset 为 `[]`。

只有这三步都做，clear 才算是生命周期闭环。

如果 Go 清理接口异步生效，那么轮询端还需要在下一轮 poll 时接受一次“日志源已空”的状态，并正确更新基线。

### 12.5 关于 tweetClaw / aiClaw / 其他前端
用户怀疑“可能是 go 或者 tweetClaw 等前端导致的”，这在系统层面是有道理的。

需要明确：
- 前端持续产生日志本身不是 bug。
- 真正的 bug 是日志消费者把“旧历史”重新当成“新日志”注入。

所以本次优先修的是 **Go 快照对齐与 logger 生命周期**。
不是先去改 tweetClaw / aiClaw 的日志输出量，除非后续验证发现某个前端还存在重复日志风暴。

---

## 13. `BridgeLogger` 重构设计

### 13.1 新职责
`BridgeLogger` 负责：
- 管理日志目录和归档目录
- 追加写活动日志
- 维护 recent tail
- 提供 UI snapshot
- 执行轮转
- 执行保留期清理
- clear 时完成磁盘与内存重置

### 13.2 推荐接口
保持最小 API 扩展：

- `log(_ message: String)`
- `append(_ messages: [String])`
- `displaySnapshot() -> [String]`
- `currentLogTextForCopy() -> String`
- `clearLogs(completion:)`
- `fileURL`
- `logsDirectoryURL`

内部新增：
- `rotateIfNeeded()`
- `archiveCurrentLog()`
- `pruneExpiredArchives()`
- `loadRecentTailFromDisk()`

### 13.3 内存与读取策略
- recent tail 固定 1000 条
- copy 行为默认复制当前 display snapshot
- 如需复制完整活动文件，可后续再加专门动作，本阶段不做

---

## 14. `BridgeLogsViewController` 重构设计

### 14.1 数据源改造
从：
- `currentLogText()` 读文本再 split

改为：
- 直接从 `displaySnapshot()` 取最近 1000 条

### 14.2 渲染边界
- 每次最多渲染 1000 行
- attributed string 构建复杂度被严格封顶
- clear 后不会因为文件里还有大量旧内容而再次构造整段历史

### 14.3 文案提示
建议增加一条轻量说明：
- “Showing latest 1000 lines”
或中文本地化等价文案

这能减少用户误解，明确 UI 不是完整历史查看器。

---

## 15. `SettingsViewController` 设计调整

### 15.1 保留 Logs 区块
继续保留：
- clear
- reveal log file
- 日志 viewer

### 15.2 可选增强
可增加一个说明标签：
- 日志长期保存在文件中
- 界面只显示最近 1000 条
- 旧日志会自动轮转归档并按保留期删除

第一阶段不强制增加用户可调配置控件，先把机制跑稳。

---

## 16. `AppDelegate` 与清理语义

`AppDelegate.clearBridgeLogs()` 不能只清 Go 侧显示缓冲，也不能只依赖 UI clear。
它应该成为“补充 Go 清理动作”的协调入口，或者完全由 `BridgeLogger.clearLogs` + `LocalBridgeGoManager.clearDisplayedLogs` 的组合取代。

建议语义：
- UI clear 先调用 `BridgeLogger.clearLogs`
- completion 中再调用 `AppDelegate.shared?.clearBridgeLogs()`
- `clearBridgeLogs()` 内部明确负责 Go 缓冲 reset

这个顺序要在实现时统一，不然仍会出现“删了又回来”的错觉。

---

## 17. 实施步骤

### 17.1 第一步：修 clear 生命周期 bug
优先级最高。

修改点：
- `LocalBridgeGoManager.swift`
  - 重构 Go 日志轮询状态机
  - 明确 reset / discontinuity 处理
  - clear 时同步 reset `lastGoLogSnapshot`
  - 调用 Go 清理接口后，不允许旧快照回灌

验收：
- clear 后下一轮轮询不会瞬间恢复 4000 条旧日志

### 17.2 第二步：为 `BridgeLogger` 增加轮转与归档
修改点：
- `BridgeLogger.swift`
  - 增加 archive 目录
  - 增加 size threshold 检查
  - 增加 rotateIfNeeded
  - 增加 pruneExpiredArchives

验收：
- 活动日志超过阈值后，生成归档文件并继续写新文件

### 17.3 第三步：把 UI 数据源改成 recent 1000 lines
修改点：
- `BridgeLogger.swift`
  - recent tail 固定为 1000
  - 暴露 display snapshot
- `BridgeLogsViewController.swift`
  - 改为消费 snapshot
  - 最多渲染 1000 行

验收：
- 大量日志下 UI 不再因全量历史构建而明显卡顿

### 17.4 第四步：补充说明文案与日志入口一致性
修改点：
- `SettingsViewController.swift`
  - 增加“显示最近 1000 条”说明
  - 保留 clear / reveal log file

验收：
- 用户能理解 UI 展示边界与文件归档策略

---

## 18. 测试计划

### 18.1 功能测试

1. **正常追加写入**
   - 启动应用并产生新日志
   - 确认活动文件持续追加
   - UI 正常显示近期日志

2. **clear 生命周期测试**
   - 产生大量日志
   - 点击 clear
   - 观察下一次 Go polling 周期
   - 确认不会瞬间重新灌回几千条旧日志

3. **Go reset 测试**
   - 让 Go 日志缓冲被清空或重启
   - 确认 Mac 端正确识别 reset，不重复回放旧日志

4. **轮转测试**
   - 把阈值临时调小到易触发数值
   - 产生大量日志
   - 确认 `bridge.log` 被归档，新的活动文件继续写入

5. **保留期删除测试**
   - 制造几个过期 archive 文件
   - 启动 app 或触发轮转
   - 确认过期文件自动删除

6. **UI 1000 行上限测试**
   - 产生超过 1000 条日志
   - 确认 UI 只显示最近 1000 条
   - 确认 copy 行为只复制当前显示内容

### 18.2 性能测试

1. 高频日志场景下观察主线程卡顿是否明显减轻。
2. 确认 attributed string 构建最多只针对 1000 行。
3. 确认轮转和归档删除都在后台队列执行。

### 18.3 持久化测试

1. 重启 App 后，UI 能恢复最近日志 tail。
2. 归档文件在重启后仍存在。
3. 保留期删除在重启后仍按规则生效。

---

## 19. 风险与权衡

### 19.1 风险：clear 语义仍然被误解
如果 clear 既想清 UI，又想清文件，又想清 Go 内存，又想清所有归档，很容易再次变成混乱语义。

本方案的建议是：
- clear 主要作用于“当前活动日志生命周期重置”
- 归档保留由后台策略接管
- 不把“删除所有历史归档”混进同一个按钮

### 19.2 风险：Go 快照 API 本身不稳定
如果 `LocalBridgeGetLogsJSON()` 返回的快照没有稳定单调语义，Mac 端只能做 best-effort reconciliation。

但即便如此，只要做到“检测 reset 时最多 rebase 最近 1000 条”，也能把灾难级回灌压住。

### 19.3 权衡：UI 不显示完整历史
这会损失“在 UI 中翻很久以前的日志”的能力。

但这是有意的产品边界。完整历史应通过文件和归档查看，不应由实时 UI 承担。

---

## 20. 验收标准

本方案落地后，视为完成的标准是：

1. `bridge.log` 超过阈值后会自动归档轮转。
2. 归档日志超过保留期会自动删除。
3. UI 永远只展示最近 1000 条日志。
4. clear 后，下一轮日志轮询不会重新灌回数千条旧日志。
5. Go 日志快照 reset / shrink / discontinuity 时，Mac 端能平滑重建基线。
6. 高频日志下，日志 UI 的主线程压力明显低于全量展示方案。
7. 用户仍可通过 reveal log file 定位日志文件并查看完整历史。

---

## 21. 推荐实施顺序

建议按下面顺序落地，不要一上来同时改全部：

1. 先修 clear 回灌 bug，锁住生命周期正确性。
2. 再加活动文件轮转。
3. 再加归档保留期清理。
4. 最后把 UI 严格收敛到最近 1000 条。

原因很简单：
先把正确性修好，再做持久化治理，再做展示边界。这样排查最清楚，也最不容易把 bug 埋深。
