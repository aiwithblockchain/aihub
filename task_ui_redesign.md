# 任务：AI 控制台 UI 全面重设计

> **执行对象**：AI 编码助手  
> **任务性质**：UI 重写（不实现真实业务逻辑，使用假数据）  
> **编译要求**：完成后必须编译通过，无 warning  
> **参考设计文档**：`/Users/wesley/aiwithblockchain/aihub/AI融合器-UI设计规范.md`

---

## 背景说明

当前项目是一个 macOS 菜单栏 App（LocalBridgeMac），使用纯 **AppKit** 开发（无 SwiftUI、无 XIB、无 Storyboard）。

AI 控制台是一个独立窗口，通过 AIClaw 菜单页的「AI 控制台」按钮打开，打开时 Dock 显示图标，关闭时 Dock 图标消失。

**本次任务**：将现有的 `AIConsoleWindowController.swift` 完全重写，按照新的 UI 设计规范实现全新的四栏式 IDE 风格界面。

---

## 需要修改的文件

只修改这一个文件：

```
/Users/wesley/aiwithblockchain/aihub/localBridge/apple/LocalBridgeMac/AIConsoleWindowController.swift
```

以下文件**不要修改**：
- `AIClawTabControllers.swift`（只是调用 `AIConsoleWindowController.show()`，不动）
- `AppDelegate.swift`
- `project.pbxproj`
- 其他所有文件

---

## 现有代码结构（需要保留的关键接口）

以下两个接口是被外部调用的，**必须保留，不能改名**：

```swift
// 1. 静态启动方法 —— AIClawTabControllers.swift 里调用
AIConsoleWindowController.show()

// 2. Dock 模式切换 —— AppDelegate.swift 里已配置 .accessory 启动
// show() 里需要: NSApp.setActivationPolicy(.regular)
// windowWillClose 里需要: NSApp.setActivationPolicy(.accessory)
```

---

## 新 UI 架构

### 整体布局：四栏结构

```
窗口最小尺寸：1280 × 720
窗口默认尺寸：1440 × 900

┌──────┬──────────────────┬────────────────────────────────┬──────────────────┐
│      │                  │                                │                  │
│ 主   │  次级侧边栏       │        主工作区                 │    活动面板       │
│ 导   │  (可折叠)        │        (弹性宽度)               │    (可折叠)      │
│ 航   │  300pt          │                                │    400pt        │
│ 栏   │                  │                                │                  │
│ 60pt │                  │                                │                  │
└──────┴──────────────────┴────────────────────────────────┴──────────────────┘
```

实现方式：
- **主导航栏**：固定宽度 NSView（60pt），不放入 NSSplitView
- **其余三栏**：使用 `NSSplitView`（isVertical = true）
- 次级侧边栏和活动面板支持折叠（通过 NSSplitViewItem 的 `isCollapsed` 或手动约束宽度为 0）

---

## 颜色常量（在文件顶部定义，全局使用）

```swift
// 在 AIConsoleWindowController.swift 顶部用 extension NSColor 定义
extension NSColor {
    // 背景层级
    static let consoleZ950 = NSColor(hex: "#09090B")  // 最深背景
    static let consoleZ900 = NSColor(hex: "#18181B")  // 主背景
    static let consoleZ800 = NSColor(hex: "#27272A")  // 次级背景
    static let consoleZ700 = NSColor(hex: "#3F3F46")  // 边框 hover
    // 文字
    static let consoleText  = NSColor(hex: "#FAFAFA")  // 主文字
    static let consoleText2 = NSColor(hex: "#A1A1AA")  // 次级文字
    static let consoleText3 = NSColor(hex: "#71717A")  // 第三级文字
    // 角色配色
    static let consolePM    = NSColor(hex: "#A855F7")  // 项目经理 紫
    static let consoleDev   = NSColor(hex: "#3B82F6")  // 开发 蓝
    static let consoleQA    = NSColor(hex: "#22C55E")  // 验收 绿
    static let consoleHuman = NSColor(hex: "#F97316")  // 人类 橙
    // 功能色
    static let consoleBlue  = NSColor(hex: "#3B82F6")
    static let consoleBlueDark = NSColor(hex: "#2563EB")
    static let consoleGreen = NSColor(hex: "#22C55E")
    static let consoleYellow = NSColor(hex: "#FACC15")
    static let consoleRed   = NSColor(hex: "#EF4444")
}

// NSColor 十六进制初始化扩展
extension NSColor {
    convenience init(hex: String) {
        // 实现 hex -> NSColor 转换
    }
}
```

---

## 数据模型（替换现有的 AIConfig / ChatMessage / AgentStatus）

```swift
// 角色类型
enum AIRole {
    case pm, developer, qa
    var label: String { /* "项目经理" / "开发" / "验收" */ }
    var emoji: String { /* "👔" / "💻" / "🧪" */ }
    var color: NSColor { /* consolePM / consoleDev / consoleQA */ }
}

// 接入方式
enum AIType {
    case web, api, cli
    var label: String { /* "Web" / "API" / "CLI" */ }
    var icon: String  { /* SF Symbol: "globe" / "bolt" / "terminal" */ }
    var color: NSColor
}

// Agent 状态
enum AIAgentStatus {
    case idle, working, paused, error
    var label: String
    var color: NSColor  // zinc-400 / green-400 / yellow-400 / red-400
    var hasPulse: Bool  { self == .working }
}

// AI Agent 完整模型
struct AIAgent {
    let id: String           // "pm-1", "dev-1", "qa-1"
    let name: String         // "Claude PM"
    let role: AIRole
    let type: AIType
    var status: AIAgentStatus
    var messages: [AIMessage]
    
    // 类型专属配置（假数据）
    var url: String?         // Web 类型
    var apiEndpoint: String? // API 类型
    var model: String?       // API 类型
    var command: String?     // CLI 类型
}

// 消息
struct AIMessage {
    enum Sender { case ai, human }
    let sender: Sender
    let content: String
    let timestamp: Date
}

// 任务
struct AITask {
    enum Status { case pending, inProgress, review, done }
    enum Priority { case low, medium, high }
    let id: String
    let title: String
    let description: String
    var assignedTo: String?
    var status: Status
    var priority: Priority
    var progress: Double  // 0.0 - 1.0
}
```

### Mock 数据（文件内定义，用于展示效果）

```swift
static let mockAgents: [AIAgent] = [
    AIAgent(id: "pm-1",  name: "Claude PM",  role: .pm,        type: .api, status: .working, ...),
    AIAgent(id: "dev-1", name: "Claude 3.5", role: .developer, type: .api, status: .working, ...),
    AIAgent(id: "dev-2", name: "GPT-4",      role: .developer, type: .api, status: .idle,    ...),
    AIAgent(id: "qa-1",  name: "QA Bot",     role: .qa,        type: .cli, status: .idle,    ...),
]

static let mockTasks: [AITask] = [
    AITask(id: "t1", title: "实现用户登录功能", description: "需要实现用户名/密码登录，包括表单验证", status: .inProgress, priority: .high, progress: 0.4),
    AITask(id: "t2", title: "设计 UI 界面", description: "完成主页面的 UI 设计", status: .review, priority: .medium, progress: 1.0),
    AITask(id: "t3", title: "编写单元测试", description: "为登录模块编写完整测试用例", status: .pending, priority: .low, progress: 0.0),
]
```

---

## 各模块详细实现要求

### 1. AIConsoleWindowController（窗口控制器）

**保留现有逻辑，只改样式参数：**

```swift
final class AIConsoleWindowController: NSWindowController {
    private static var instance: AIConsoleWindowController?
    
    static func show() {
        // 保持不变：创建实例 + setActivationPolicy(.regular) + showWindow + activate
    }
    
    init() {
        // 修改：
        // - 窗口尺寸改为 1440 × 900，最小 1280 × 720
        // - 背景色改为 NSColor.consoleZ950
        // - 标题改为 "AI 融合器"
        // - 添加 .fullSizeContentView 到 styleMask（让内容延伸到标题栏下方）
    }
    
    // windowWillClose：保持不变
}
```

---

### 2. AIConsoleRootViewController（根布局）

**重写为四栏布局：**

```swift
final class AIConsoleRootViewController: NSViewController {
    // 四个子 VC
    private let navVC      = ConsoleNavViewController()      // 主导航栏 60pt
    private let sidebarVC  = ConsoleSidebarViewController()  // 次级侧边栏 300pt
    private let workVC     = ConsoleWorkspaceViewController() // 主工作区 弹性
    private let activityVC = ConsoleActivityViewController() // 活动面板 400pt
    
    override func viewDidLoad() {
        // 布局：navVC 固定在左侧（不进入 splitView）
        // splitView 包含 sidebarVC + workVC + activityVC
        // navVC 宽 60pt 固定
        // sidebarVC 默认宽 300pt，可折叠至 0
        // activityVC 默认宽 400pt，可折叠至 0
    }
}
```

---

### 3. ConsoleNavViewController（主导航栏）

**规格：**
- 宽 60pt，全高
- 背景色：`#18181B`（consoleZ900）
- 右边框：1pt `#27272A`

**顶部 Logo 区域（高 72pt）：**
- 40×40 圆角矩形（8pt），渐变背景从 `#3B82F6` 到 `#9333EA`
- SF Symbol `network`，白色，20pt
- 外边距：上 16pt，水平居中

**导航按钮列表（中间）：**

每个按钮规格：
- 60pt 宽 × 48pt 高
- 图标 20pt，居中
- 状态：默认（图标色 `#A1A1AA`）/ 激活（图标色 `#60A5FA` + 左侧 4pt×32pt 蓝色竖条 `#3B82F6` + 背景 `#27272A`）

6 个导航项（用枚举管理当前选中状态）：

| index | SF Symbol | 标签 |
|-------|-----------|------|
| 0 | briefcase | 项目经理 |
| 1 | chevron.left.forwardslash.chevron.right | 开发团队 |
| 2 | checkmark.circle | 验收团队 |
| 3 | message | 消息流 |
| 4 | network | AI 配置 |
| 5 | gearshape | 设置 |

点击导航按钮时，通过 **delegate 或 closure** 通知 `AIConsoleRootViewController` 切换主工作区的内容。

**底部控制区（距底部）：**

运行/暂停按钮（距底 60pt）：
- 60pt × 48pt
- 初始状态：`play.fill`，图标色 `#A1A1AA`
- 运行状态：`pause.fill`，图标色 `#4ADE80`
- 点击切换，假数据演示即可

状态指示点（距底 32pt，水平居中）：
- 8pt 圆形
- 运行中：`#22C55E`，使用 `CABasicAnimation` 实现脉动（opacity 1→0.3→1，2s 循环）
- 停止：`#52525B`，无动画

---

### 4. ConsoleSidebarViewController（次级侧边栏）

**规格：**
- 默认宽 300pt
- 背景色：`#18181B` 带 50% 透明度（实现方式：`NSColor(red:0.094 green:0.094 blue:0.043 alpha:0.5)` 近似即可，或直接用 `consoleZ900`）
- 右边框：1pt `#27272A`

**根据主导航栏的当前选中项显示不同内容。**

侧边栏标题区（高 80pt）：
- 左侧：标题文字（16pt semibold，根据当前导航变化）+ 下方副标题「X 个 AI」（14pt，`#A1A1AA`）
- 右侧：添加按钮（32pt 圆角矩形，`plus` 图标，`#A1A1AA`）
- 底边框：1pt `#27272A`

标题映射：
- 项目经理视图 → 标题「项目经理」，显示 role == .pm 的 agent
- 开发视图 → 标题「开发人员」，显示 role == .developer 的 agent
- 验收视图 → 标题「验收人员」，显示 role == .qa 的 agent
- 消息流/配置/设置视图 → 标题「AI 列表」，显示全部 agent

**AI 卡片列表（NSScrollView 滚动）：**

每张卡片规格（284pt × 76pt，圆角 8pt，内边距 12pt，间距 8pt）：

```
┌─────────────────────────────────────┐
│ [图标框]  AI 名称              [●]  │  <- 名称 14pt semibold，状态点 8pt 圆形
│  40×40    角色标签 · 类型标签        │  <- 12pt，#A1A1AA
└─────────────────────────────────────┘
```

图标框（40×40，圆角 8pt）：
- 背景：`#3B82F6` + 20% 透明
- 边框：1pt `#3B82F6` + 30% 透明
- SF Symbol `brain`，`#60A5FA`，20pt

角色标签（高 20pt，圆角 4pt，水平内边距 6pt，11pt）：
- PM：背景 `#A855F7` 20%，文字 `#C084FC`，边框 `#A855F7` 30%
- Developer：背景 `#3B82F6` 20%，文字 `#60A5FA`，边框 `#3B82F6` 30%
- QA：背景 `#22C55E` 20%，文字 `#4ADE80`，边框 `#22C55E` 30%

类型标签：背景 `#3F3F46`，文字 `#A1A1AA`，11pt

状态点颜色：
- idle：`#A1A1AA`
- working：`#4ADE80` + 脉动动画
- paused：`#FACC15`
- error：`#F87171`

卡片选中状态：背景 `#27272A`，边框 1pt `#3B82F6` 50%

**折叠按钮：**
- 位置：侧边栏右边缘外 16pt，距顶 16pt
- 32pt 圆形，背景 `#27272A`，边框 1pt `#3F3F46`
- 图标 `chevron.left`（展开时）/ `chevron.right`（折叠时），`#A1A1AA`
- 点击后将侧边栏宽度动画折叠至 0（使用 `animator()` 或约束动画，0.3s ease-in-out）

---

### 5. ConsoleWorkspaceViewController（主工作区）

主工作区是一个容器，根据主导航栏选中的 index 切换显示不同的子视图控制器：

| 导航 index | 显示的子 VC |
|-----------|------------|
| 0 | PMWorkspaceViewController（项目经理） |
| 1 | DevWorkspaceViewController（开发） |
| 2 | QAWorkspaceViewController（验收） |
| 3 | MessageFlowViewController（消息流） |
| 4 | AIConfigViewController（AI 配置） |
| 5 | SettingsViewController（设置，复用现有或新建简单版） |

切换时直接替换 child view controller（`removeChild` + `addChild`）。

---

### 6. PMWorkspaceViewController（项目经理主工作区）

**左右两栏布局（NSSplitView，isVertical = true）：**
- 左栏：任务总览（固定 400pt）
- 右栏：对话区域（弹性）

**左栏 - 任务总览：**

顶部标题栏（60pt）：
- 标题「任务总览」（16pt semibold）
- 副标题「共 X 个任务」（14pt，`#A1A1AA`）
- 底边框 1pt `#27272A`

任务卡片列表（NSScrollView）：

每张卡片（圆角 8pt，背景 consoleZ900 50%，边框 1pt `#27272A`，内边距 12pt）：

```
┌───────────────────────────────────┐
│ [●] 任务标题（14pt semibold）      │
│     描述（12pt，zinc-400，最多2行） │
│                                   │
│ [优先级标签] [分配标签]            │
└───────────────────────────────────┘
```

状态图标（`circle` / `clock.fill` / `exclamationmark.circle` / `checkmark.circle.fill`）对应颜色（zinc-400 / blue-400 / yellow-400 / green-400）

优先级标签：
- low：背景 `#3F3F46`，文字 `#D4D4D8`
- medium：背景 `#3B82F6` 20%，文字 `#60A5FA`，边框 `#3B82F6` 30%
- high：背景 `#EF4444` 20%，文字 `#F87171`，边框 `#EF4444` 30%

**右栏 - 对话区域：**

顶部信息栏（72pt，背景 consoleZ950）：
- 左侧：头像框（40×40，圆角 8pt，渐变背景 `#A855F7`→`#EC4899` 各 20%，内含 emoji 👔）+ AI 名称（14pt semibold）+ 副标题「项目经理 · claude-3.5-sonnet」（12pt `#A1A1AA`）
- 右侧：在线状态标签（圆角 12pt，背景 `#22C55E` 20%，文字 `#4ADE80` "在线"，边框 `#22C55E` 30%）
- 底边框 1pt `#27272A`

消息滚动区域：
- 背景透明，内容居中（最大宽 800pt）
- 消息气泡布局（见下方消息气泡规格）
- 使用 NSScrollView + NSStackView（orientation = vertical）展示消息

消息气泡规格：
- AI 消息（左对齐）：圆角 8pt，背景 `#27272A` 50%，边框 1pt `#3F3F46`，内边距 12pt，文字 `#FAFAFA`，左侧 32pt 头像框
- 用户消息（右对齐）：圆角 8pt，背景 `#3B82F6` 20%，边框 1pt `#3B82F6` 30%，内边距 12pt，文字 `#FAFAFA`，右侧 32pt 头像框（emoji 👤，橙色背景）
- 时间戳：11pt，`#71717A`，气泡下方 4pt

底部输入区（72pt，背景 consoleZ950）：
- 顶边框 1pt `#27272A`
- 左侧 NSTextField（高 40pt，圆角 6pt，背景 consoleZ900，边框 consoleZ700，占位符「给项目经理发送消息...」）
- 右侧发送按钮（40pt 方形，圆角 6pt，背景 `#2563EB`，SF Symbol `paperplane.fill`，白色）
- 下方提示文字「在此输入可直接干预项目经理的决策」（11pt，`#71717A`，居中）
- 点击发送后：追加用户气泡，0.8s 后追加 AI 回复气泡（假数据）

**假数据初始化：**
- 加载时展示 2-3 条假消息（一条 AI，一条用户，一条 AI 回复）
- 任务列表展示 `mockTasks`

---

### 7. DevWorkspaceViewController（开发团队主工作区）

**顶部：** 与 PMWorkspaceViewController 的对话右栏顶部信息栏格式相同，但角色改为开发（💻，蓝色渐变背景）

**标签页控制栏（44pt，背景 consoleZ900）：**
三个标签页：`[对话]` `[代码预览]` `[任务]`

标签样式（高 32pt，圆角 4pt，水平内边距 12pt）：
- 未激活：透明背景，文字 `#A1A1AA`
- 激活：背景 `#27272A`，文字 `#FAFAFA`

**标签页 1 - 对话：**
同 PM 对话区域，头像换 💻，消息颜色用蓝色系

**标签页 2 - 代码预览：**

代码块（圆角 8pt，背景 consoleZ900）：

文件名栏（44pt）：
- 左侧：文件名「LoginForm.swift」（12pt，`#A1A1AA`）
- 右侧：语言标签「Swift」（圆角 4pt，背景 `#3F3F46`，文字 `#A1A1AA`，11pt）
- 底边框 1pt `#27272A`

代码区域：
- 背景 consoleZ900，底部圆角 8pt
- 内边距 16pt
- SF Mono 13pt，行高 1.6，文字 `#D4D4D8`
- 展示一段假 Swift 代码（20-30 行），用属性字符串做简单语法高亮：
  - 关键字（import/class/func/let/var/return）：`#C084FC`
  - 字符串字面量：`#4ADE80`
  - 注释（// 开头）：`#71717A`
  - 其余：`#D4D4D8`

**标签页 3 - 任务：**

任务卡片（圆角 8pt，背景 consoleZ900 50%，边框 1pt `#27272A`，内边距 16pt）：

```
┌──────────────────────────────────────┐
│ 任务名称（14pt semibold）   [进行中]   │
│                                      │
│ 进度                           40%   │
│ [━━━━━━━░░░░░░░░░░]                 │
└──────────────────────────────────────┘
```

进度条（高 8pt，圆角 4pt）：
- 背景：`#27272A`
- 填充：渐变 `#3B82F6` → `#06B6D4`
- 用 `NSView` + 约束宽度比例实现，`animator()` 动画 0.5s

展示 `mockTasks` 数据。

---

### 8. QAWorkspaceViewController（验收团队主工作区）

同 DevWorkspaceViewController 结构，三个标签页改为：`[对话]` `[测试结果]` `[测试报告]`

头像 emoji 改为 🧪，角色颜色改为绿色系。

**标签页 2 - 测试结果：**

测试结果卡片（圆角 8pt，内边距 16pt）：
- passed：背景 `#22C55E` 10%，边框 `#22C55E` 30%
- warning：背景 `#FACC15` 10%，边框 `#FACC15` 30%
- failed：背景 `#EF4444` 10%，边框 `#EF4444` 30%

每项格式：
```
[图标] 测试名称                   0.23s
       错误信息（warning/failed 才显示）
```

图标：`checkmark.circle`（绿）/ `exclamationmark.triangle`（黄）/ `xmark.circle`（红）

展示至少 3 条假测试结果（1 passed、1 warning、1 failed）。

**标签页 3 - 测试报告：**

摘要卡片（圆角 8pt，背景 consoleZ900 50%，边框 1pt `#27272A`，内边距 24pt）：

统计网格（3列，水平 NSStackView）：
- 通过数 / 警告数 / 失败数
- 每格：数字（24pt bold）+ 标签（12pt，`#A1A1AA`）
- 背景：对应状态色 10%，边框：对应状态色 30%，圆角 8pt

覆盖率区域：
- 标题「覆盖率」（14pt semibold）
- 语句 / 分支 / 函数 / 行 四项
- 每项：标签 + 百分比 + 进度条
- 颜色：>=80% 绿，60-79% 黄，<60% 红

问题列表：
- 标题「需要关注的问题」（14pt semibold）
- 圆点 + 文字，按严重程度用红/黄圆点

---

### 9. MessageFlowViewController（全局消息流）

**顶部（100pt）：**
- 左侧：标题「全局消息流」（18pt bold）+ 副标题「所有 AI 的活动记录」（14pt，`#A1A1AA`）
- 搜索框（40pt 高，圆角 6pt，背景 consoleZ900，边框 consoleZ700，左侧 `magnifyingglass` 图标）

**时间线区域（NSScrollView）：**

日期分隔线：
```
─────── 2026年3月16日 ───────
```
线条 1pt `#27272A`，文字 12pt `#71717A`，用 NSView + NSTextField 组合实现

时间线消息项：
```
[●]  AI名称 [角色标签] HH:mm
     ┌──────────────────────┐
     │ 消息内容              │
     └──────────────────────┘
```

圆点（40×40，圆角 8pt）：角色颜色 20% 背景，角色颜色 30% 边框，内含角色 emoji

连接线：宽 2pt，颜色 `#27272A`，从圆点中心向下

消息内容框：圆角 8pt，背景 consoleZ900 50%，边框 1pt `#27272A`，内边距 16pt，文字 `#D4D4D8`，13pt

展示 `mockAgents` 对应的假消息数据（至少 5-6 条，各角色都有）。

---

### 10. AIConfigViewController（AI 配置中心）

**左右两栏（NSSplitView）：**
- 左栏：AI 列表（固定 400pt）
- 右栏：配置表单（弹性）

**左栏顶部（72pt）：**
- 标题「AI 配置中心」（16pt semibold）
- 副标题「共 X 个 AI」
- 右侧「+ 添加 AI」按钮（32pt 高，圆角 6pt，背景 `#2563EB`，白色文字）

**AI 卡片列表：**

同次级侧边栏的 AI 卡片，但图标框按类型变色：
- Web：`globe`，蓝色（`#3B82F6`）
- API：`bolt`，黄色（`#FACC15`）
- CLI：`terminal`，绿色（`#22C55E`）

展示 `mockAgents`，点击选中某个 agent，右栏显示配置表单。

**右栏 - 配置表单：**

空状态：`gearshape` 图标（50pt，`#52525B`）+ 文字「选择一个 AI 进行配置」，垂直居中

选中后显示表单：

顶部栏（60pt）：
- 标题「配置 AI」（14pt semibold）
- 右侧删除按钮（圆角 6pt，边框 `#EF4444` 30%，文字 `#F87171`，`trash` 图标）

表单内容（NSScrollView，内边距 24pt，最大宽 800pt）：

基本信息卡片（圆角 8pt，背景 consoleZ900 50%，边框 1pt `#27272A`，内边距 24pt）：
- 卡片标题：`person.fill` 图标 + 「基本信息」（14pt semibold）
- 字段：名称 / 角色（NSPopUpButton，三个选项）/ 接入方式（NSPopUpButton）
- 标签 13pt，输入框 40pt 高，圆角 6pt，背景 consoleZ900，边框 consoleZ700，聚焦边框蓝色

类型专属配置卡片（根据选择的类型显示）：
- Web：`globe` 图标 + 「Web 配置」，字段：网页 URL
- API：`bolt` 图标 + 「API 配置」，字段：API 端点 / API 密钥（密码框）/ 模型
- CLI：`terminal` 图标 + 「CLI 配置」，字段：命令 / 参数

底部操作栏（72pt，背景 consoleZ950，顶边框）：
- 右对齐
- 取消按钮（40pt，圆角 6pt，透明背景，边框 consoleZ700，文字白色）
- 保存按钮（40pt，圆角 6pt，背景 `#2563EB`，白色文字，`checkmark` 图标）
- 保存点击后：弹出 NSAlert「保存成功」，假数据演示

---

### 11. ConsoleActivityViewController（活动面板）

**规格：**
- 默认宽 400pt，背景 consoleZ900 50%，左边框 1pt `#27272A`

**标题区（72pt）：**
- 标题「实时活动」（16pt semibold）
- 副标题「系统消息流」（14pt，`#A1A1AA`）
- 底边框 1pt `#27272A`

**消息列表（NSScrollView）：**

每条消息项（NSView，内边距 16pt，下边距 12pt）：

```
[头像]  AI名称 [角色标签]
32pt    消息内容（13pt，#D4D4D8）
        X分钟前（11pt，#71717A）
```

头像（32×32，圆角 8pt）：角色颜色 20% 背景，角色颜色 30% 边框，emoji

消息内容：最多显示 2 行，超过用 `...` 截断

时间戳格式：「X 分钟前」/ 「X 小时前」/ 「昨天」（假数据固定即可）

**展示 `mockAgents` 的各条 messages，至少 6-8 条。**

**折叠按钮：**
- 位置：活动面板左边缘外 16pt，距顶 16pt
- 样式同次级侧边栏折叠按钮（方向相反）
- 点击折叠/展开（宽度动画 0.3s）

---

### 12. 通用组件（全部定义在同一文件末尾）

#### ConsoleTextField
- 已存在，保留并更新颜色使用新的颜色常量

#### ConsoleRoleBadge（新增）
```swift
// 角色标签，替代之前的 StatusBadge
final class ConsoleRoleBadge: NSView {
    init(role: AIRole)    // PM/Dev/QA 三种颜色
}
```

#### ConsoleTypeBadge（新增）
```swift
// 类型标签 Web/API/CLI
final class ConsoleTypeBadge: NSView {
    init(type: AIType)
}
```

#### ConsoleStatusDot（新增）
```swift
// 带动画的状态点
final class ConsoleStatusDot: NSView {
    init(status: AIAgentStatus)
    // working 状态自动添加 CABasicAnimation pulse
}
```

#### ConsoleProgressBar（新增）
```swift
// 任务进度条
final class ConsoleProgressBar: NSView {
    var progress: Double  // 0.0-1.0，设置时用 animator() 动画
    // 渐变填充 #3B82F6 -> #06B6D4
}
```

#### ConsoleAICard（新增）
```swift
// 可复用的 AI 卡片（侧边栏和配置中心共用）
final class ConsoleAICard: NSView {
    var isSelected: Bool
    var onTap: (() -> Void)?
    init(agent: AIAgent)
}
```

#### ConsoleSendButton（新增）
```swift
// 统一的发送按钮（40pt，圆角 6pt，蓝色背景，paperplane 图标）
final class ConsoleSendButton: NSButton {
    init()
}
```

---

## 验收标准

执行完成后，以下所有项必须满足：

- [ ] 代码编译通过，无错误，无 warning
- [ ] `AIConsoleWindowController.show()` 可以正常调用（被 AIClawTabControllers.swift 调用）
- [ ] 打开窗口时 Dock 显示图标，关闭时消失
- [ ] 四栏布局正确显示：主导航 60pt + 侧边栏 300pt + 主工作区弹性 + 活动面板 400pt
- [ ] 主导航栏 6 个按钮点击可切换主工作区内容，激活状态有左侧蓝色竖条
- [ ] 次级侧边栏显示对应角色的 AI 列表（假数据）
- [ ] 次级侧边栏和活动面板的折叠按钮可以折叠/展开（有动画）
- [ ] 项目经理视图：左侧任务列表 + 右侧对话气泡，可输入并获得假数据回复
- [ ] 开发团队视图：三个标签页可切换，代码预览有假代码，任务标签有进度条
- [ ] 验收团队视图：三个标签页可切换，测试结果有颜色区分，测试报告有统计和进度条
- [ ] 消息流视图：时间线布局，各角色颜色正确
- [ ] AI 配置中心：左侧列表可选中，右侧表单显示对应类型的配置字段
- [ ] 活动面板：消息列表正确显示，头像颜色按角色区分
- [ ] 运行/暂停按钮可切换状态，状态点有脉动动画（working 状态时）
- [ ] 所有颜色使用新的 `NSColor.consoleXxx` 常量，不使用硬编码数字
- [ ] 窗口最小尺寸 1280×720

---

## 注意事项

1. **纯 AppKit**，不使用 SwiftUI、XIB、Storyboard
2. 所有约束使用 `NSLayoutConstraint.activate([...])`，不使用 frame
3. 所有 `NSView` 子类需要 `translatesAutoresizingMaskIntoConstraints = false`
4. 动画使用 `NSAnimationContext` 或 `CABasicAnimation`，不使用 UIKit 动画 API
5. 折叠动画：`NSAnimationContext.runAnimationGroup { ctx in ctx.duration = 0.3; ... }`
6. **整个新界面写在 `AIConsoleWindowController.swift` 一个文件中**，类名按上面规范
7. 删除现有文件中的所有旧类（`PMPanelViewController`、`DevPanelViewController`、`ReviewPanelViewController`、`CenterWorkspaceViewController`、`LogPanelViewController`、`ConsoleToolbarViewController`、`AIPickerPopover`、`AIPickerRow`、`ConsolePlusButton`、`ConsoleAddCard`、`StatusBadge` 等），全部用新类替代
8. 保留并更新 `ConsoleTextField`（已有实现，只需更新颜色常量引用）
9. 假数据回复内容自行模拟，体现真实感即可
10. 如果某个视图（如设置）实现复杂，可以用「占位视图」代替，但必须有标题和基本样式

---

## 文件路径

```
修改文件：
/Users/wesley/aiwithblockchain/aihub/localBridge/apple/LocalBridgeMac/AIConsoleWindowController.swift

参考设计：
/Users/wesley/aiwithblockchain/aihub/AI融合器-UI设计规范.md

不要修改的文件（只读参考）：
/Users/wesley/aiwithblockchain/aihub/localBridge/apple/LocalBridgeMac/AIClawTabControllers.swift
/Users/wesley/aiwithblockchain/aihub/localBridge/apple/LocalBridgeMac/AppDelegate.swift
/Users/wesley/aiwithblockchain/aihub/localBridge/apple/LocalBridgeApple.xcodeproj/project.pbxproj
```
