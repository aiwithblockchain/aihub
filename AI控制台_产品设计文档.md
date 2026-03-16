# AI 控制台 — 产品设计文档

> 版本：v0.1  
> 项目：LocalBridgeMac / AIClaw 模块  
> 路径：`/Users/wesley/aiwithblockchain/aihub/localBridge/apple/LocalBridgeMac`

---

## 一、产品定位

**AI 控制台（AI Console）** 是一个多 AI 角色协作工作台，运行在 macOS 原生环境中。它让用户（人类）作为「总指挥」，通过一套类 IDE 的可视化界面，编排和管理多个 AI Agent（项目经理、程序员、验收员）之间的协作流程，完成软件开发、任务拆解、成果验收等工作。

核心理念：**人类保持高层控制权，AI 负责具体执行，人类可随时介入任意环节。**

---

## 二、核心概念

### 2.1 角色体系

| 角色 | 类型 | 职责 | 数量 |
|------|------|------|------|
| 用户（人类） | Human | 总指挥，任务发起，最终决策 | 1 |
| 项目经理 AI | PM Agent | 接收用户指令，拆解任务，分发给程序员，汇总结果 | 1 |
| 程序员 AI | Dev Agent | 接收 PM 分配的子任务，生成代码/方案 | N（可多个） |
| 验收员 | Reviewer | 对程序员产出进行验收，可以是人工或 AI | 1（含两种模式） |

### 2.2 信息流

```
用户
 │
 ▼
项目经理 AI ◄──── 用户随时介入
 │  ▲
 │  │（结果汇报）
 ▼  │
程序员 AI × N ◄── 用户随时介入
 │
 ▼
验收区域（人工 / AI）◄── 用户直接操作
 │
 ▼
项目经理 AI（收到验收结果，决定下一步）
```

### 2.3 工作模式

**模式 A：全自动流转（Auto）**  
用户只需和项目经理 AI 对话，后续任务由 PM AI 自动拆解并下发给程序员 AI，验收也由 AI 自动完成。用户只在关键节点收到通知。

**模式 B：人工确认节点（Semi-Auto）**  
每个节点下发前都需要人类点击「确认」，才能继续流转。适合对输出质量要求高的场景。

**模式 C：完全手动（Manual）**  
用户直接和每个 AI 单独对话，手动复制粘贴信息在 AI 之间传递。

> 当前 v0.1 版本优先实现 UI 骨架，模式切换作为后续功能。

---

## 三、界面总体架构

### 3.1 窗口特性

- **独立窗口**：AI 控制台是一个独立的 `NSWindow`，启动时在 macOS Dock 中显示图标，行为和普通 App 一致
- **尺寸**：默认 `1280 × 800`，最小 `1100 × 700`，可全屏
- **持久化**：只有点击关闭按钮才消失，切换到其他 App 不会隐藏
- **焦点**：关闭时同时从 Dock 移除图标，主 App 恢复 accessory 模式

### 3.2 整体布局（三栏 + 顶部工具栏）

```
┌─────────────────────────────────────────────────────────────────────┐
│  工具栏：[项目名称]  [模式选择: Auto/Semi/Manual]  [全局状态指示灯]  │
├──────────────┬──────────────────────────────┬───────────────────────┤
│              │                              │                       │
│   左侧面板   │        中央主工作区          │     右侧信息面板       │
│              │                              │                       │
│  ┌──────┐   │   ┌──────────────────────┐   │  ┌─────────────────┐  │
│  │ PM   │   │   │  程序员 AI 卡片网格  │   │  │   消息流 Log    │  │
│  │ AI   │   │   │                      │   │  │（所有 AI 的     │  │
│  │ 对话 │   │   │  [Card1] [Card2] [+] │   │  │ 通信记录）      │  │
│  │      │   │   └──────────────────────┘   │  └─────────────────┘  │
│  │      │   │                              │                       │
│  │      │   │   ┌──────────────────────┐   │  ┌─────────────────┐  │
│  │      │   │   │       验收区域       │   │  │   任务看板      │  │
│  └──────┘   │   │  [人工] | [AI验收]   │   │  │（Kanban 状态）  │  │
│              │   └──────────────────────┘   │  └─────────────────┘  │
└──────────────┴──────────────────────────────┴───────────────────────┘
```

### 3.3 各区域说明

#### 左侧面板 — 项目经理 AI（固定宽度约 340px）

- 顶部：AI 名称 + 状态指示灯（🟢在线/🔴离线）+ 重置按钮
- 中部：聊天记录（滚动，气泡样式区分用户/AI）
- 底部：输入框 + 发送 + 介入模式切换开关
- 未配置时：大加号 + 引导文字

#### 中央主工作区 — 程序员 + 验收（自适应宽度）

分为上下两个区域，使用可拖拽分割线：

**上半部分：程序员区域**
- 卡片网格布局（类似 IDE 的 Tab 或卡片）
- 每张卡片显示：AI 名称、当前状态（待命/工作中/完成）、最后一条消息摘要
- 点击卡片「展开」，在卡片内或右侧滑出对话面板
- 末尾始终保留「＋ 添加程序员 AI」按钮

**下半部分：验收区域**
- 左栏人工验收：多行文本 + 提交按钮
- 右栏 AI 验收：配置 AI + 开始验收 + 结果展示

#### 右侧信息面板（固定宽度约 280px，可折叠）

- **消息流 Log**：实时显示所有 AI 之间的通信摘要，带时间戳
- **任务看板**：当前任务拆解后的子任务状态（待分配/进行中/已完成/已验收）

---

## 四、交互设计原则

### 4.1 人类介入机制

- 工具栏提供「⏸ 暂停」按钮，暂停后所有 AI 停止响应，等待用户操作
- 每条 AI 消息旁边有「↩ 介入」按钮，点击后可在该 AI 的对话中插入用户消息
- Semi-Auto 模式下，PM AI 下发指令前会出现「确认」悬浮提示条

### 4.2 状态可视化

- 每个 AI 有三态指示灯：🟢 待命 / 🟡 处理中 / 🔴 错误
- 任务看板用颜色区分进度
- 顶部工具栏有全局状态摘要（如「3 个任务进行中」）

### 4.3 快捷操作

- `Cmd + Enter`：在当前聚焦输入框发送消息
- `Cmd + P`：全局暂停/恢复
- `Cmd + 1/2/3`：快速聚焦 PM / 程序员区域 / 验收区域

---

## 五、技术架构

### 5.1 窗口管理

```swift
// 启动 AI 控制台时切换 Dock 模式
NSApp.setActivationPolicy(.regular)
// 关闭时恢复
NSApp.setActivationPolicy(.accessory)
```

### 5.2 文件结构

```
LocalBridgeMac/
├── AIConsole/
│   ├── AIConsoleWindowController.swift    // 窗口控制器 + Dock 模式切换
│   ├── AIConsoleRootViewController.swift  // 根布局（三栏 NSSplitView）
│   ├── PMPanel/
│   │   └── PMPanelViewController.swift    // 项目经理 AI 面板
│   ├── DevPanel/
│   │   ├── DevPanelViewController.swift   // 程序员区域容器
│   │   └── DevCardView.swift              // 单个程序员卡片
│   ├── ReviewPanel/
│   │   └── ReviewPanelViewController.swift // 验收区域
│   ├── LogPanel/
│   │   └── LogPanelViewController.swift   // 右侧消息流 + 看板
│   └── Shared/
│       ├── AIPicker.swift                 // AI 配置选择弹窗（通用）
│       ├── ChatBubbleView.swift           // 气泡消息组件
│       └── AIAgent.swift                  // AI Agent 数据模型
```

### 5.3 数据模型

```swift
struct AIConfig {
    let id: UUID
    let name: String       // "GPT-4", "Claude 3.5"...
    let provider: String   // "OpenAI", "Anthropic"...
    let icon: String       // emoji 或系统图标名
    var apiKey: String
}

enum AgentRole { case pm, developer, reviewer }
enum AgentStatus { case idle, working, done, error }

struct AIAgent {
    let id: UUID
    let config: AIConfig
    let role: AgentRole
    var status: AgentStatus
    var messages: [ChatMessage]
}

struct ChatMessage {
    let id: UUID
    let role: MessageRole  // .user / .assistant
    let content: String
    let timestamp: Date
}
```

---

## 六、版本规划

| 版本 | 内容 |
|------|------|
| v0.1 | UI 骨架，假数据，三区域布局，AI 选择弹窗，独立窗口 + Dock |
| v0.2 | 接入真实 AI API（OpenAI/Claude 等），PM AI 可真实对话 |
| v0.3 | 程序员 AI 真实对话，PM 与 Dev 之间的消息路由 |
| v0.4 | 任务看板，消息流 Log，Semi-Auto 模式确认节点 |
| v1.0 | 全模式切换，持久化配置，工程文件关联 |

---

## 七、当前任务（v0.1 实施范围）

参见：[task.md](/Users/wesley/aiwithblockchain/aihub/task.md)

重点：**只实现 UI，不接入真实 AI，使用假数据模拟所有交互效果。**
