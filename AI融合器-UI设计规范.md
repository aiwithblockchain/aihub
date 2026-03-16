# AI 融合器系统 - Mac App UI 设计规范

> 本文档详细描述了 AI 融合器系统的完整 UI 设计，供开发团队参考实现。

## 📋 目录

1. [整体架构](#整体架构)
2. [布局结构](#布局结构)
3. [视图详细设计](#视图详细设计)
4. [组件规范](#组件规范)
5. [颜色系统](#颜色系统)
6. [交互动画](#交互动画)
7. [数据结构](#数据结构)

---

## 整体架构

### 设计理念

仿照现代 IDE（如 VS Code、Xcode）的多栏式布局，专门为多 AI 协作场景优化：

- **高效的空间利用**：四栏式布局，每个区域职责清晰
- **灵活的视图切换**：快速在不同角色（项目经理、开发、验收）间切换
- **实时监控**：右侧活动面板实时显示所有 AI 活动
- **随时介入**：每个视图都有对话输入框，支持人工干预

### 技术栈建议

- **macOS 开发**：SwiftUI（推荐）或 AppKit
- **最低系统版本**：macOS 12.0+
- **窗口尺寸**：最小宽度 1280px，推荐 1440px 或更大

---

## 布局结构

### 四栏布局示意图

```
┌────────┬─────────────────┬──────────────────────────────┬─────────────────┐
│        │                 │                              │                 │
│  主    │   次级侧边栏     │        主工作区               │   活动面板       │
│  导    │   (可折叠)      │      (弹性宽度)              │   (可折叠)      │
│  航    │   300pt        │                              │   400pt        │
│  栏    │                 │                              │                 │
│        │                 │                              │                 │
│  60pt  │                 │                              │                 │
│        │                 │                              │                 │
└────────┴─────────────────┴──────────────────────────────┴─────────────────┘
```

### 布局说明

| 区域 | 宽度 | 功能 | 可折叠 |
|-----|------|------|--------|
| 主导航栏 | 60pt | 全局导航、运行控制 | 否 |
| 次级侧边栏 | 300pt | 当前角色的 AI 列表 | 是 |
| 主工作区 | 弹性 | 主要内容区域 | 否 |
| 活动面板 | 400pt | 实时消息流 | 是 |

---

## 视图详细设计

## 1. 主导航栏（60pt 宽）

### 视觉样式

```
背景色：#18181B (zinc-900)
右边框：1pt #27272A (zinc-800)
高度：窗口全高
```

### 内容布局（从上到下）

#### 1.1 应用 Logo（顶部）

```
尺寸：40pt × 40pt
圆角：8pt
背景：渐变色 (from #3B82F6 to #9333EA)
图标：网络图标（SF Symbol: network）
颜色：白色
外边距：上下 16pt
```

#### 1.2 导航按钮列表（中间，垂直排列）

共 6 个导航按钮，每个规格如下：

```
尺寸：60pt × 48pt (宽 × 高)
圆角：0pt (矩形)
图标尺寸：20pt × 20pt
间距：2pt
```

**导航项列表：**

| 序号 | 图标 (SF Symbol) | 标签 | 路径 |
|-----|-----------------|------|------|
| 1 | briefcase | 项目经理 | / |
| 2 | chevron.left.forwardslash.chevron.right | 开发团队 | /developers |
| 3 | checkmark.circle | 验收团队 | /qa |
| 4 | message | 消息流 | /messages |
| 5 | network | AI 配置 | /config |
| 6 | gearshape | 设置 | /settings |

**按钮状态样式：**

```swift
// 默认状态
backgroundColor: .clear
iconColor: #A1A1AA (zinc-400)

// 悬停状态
backgroundColor: #27272A (zinc-800)
iconColor: #FFFFFF

// 激活状态
backgroundColor: #27272A (zinc-800)
iconColor: #60A5FA (blue-400)
leftIndicator: 4pt × 32pt, #3B82F6 (blue-500), 左侧垂直条
```

**Tooltip：**
- 显示位置：按钮右侧
- 延迟：0ms（即时显示）
- 样式：系统默认暗色 Tooltip

#### 1.3 控制按钮（底部）

**运行/暂停按钮：**

```
位置：距底部 60pt
尺寸：60pt × 48pt
图标：play.fill / pause.fill (切换)

运行状态：
- 图标：pause.fill
- 颜色：#4ADE80 (green-400)

停止状态：
- 图标：play.fill  
- 颜色：#A1A1AA (zinc-400)
```

**状态指示器：**

```
位置：距底部 32pt，水平居中
尺寸：8pt × 8pt (圆形)
圆角：4pt (完全圆形)

运行中：
- 颜色：#22C55E (green-500)
- 动画：脉动效果 (pulse)

停止：
- 颜色：#52525B (zinc-600)
- 动画：无
```

---

## 2. 次级侧边栏（300pt 宽）

### 视觉样式

```
背景色：#18181B + 50% 透明度 (zinc-900/50)
右边框：1pt #27272A (zinc-800)
```

### 2.1 标题区域（固定在顶部）

```
高度：80pt
内边距：16pt
底边框：1pt #27272A (zinc-800)
```

**内容布局：**

```
┌─────────────────────────────────────┐
│ 标题文字（根据路由变化）    [+ 按钮] │  ← 16pt 字体，中粗体
│ 副标题：X 个 AI                     │  ← 14pt 字体，zinc-400
└─────────────────────────────────────┘
```

**标题文字映射：**

| 路径 | 标题 | 筛选角色 |
|-----|------|---------|
| / | 项目经理 | pm |
| /developers | 开发人员 | developer |
| /qa | 验收人员 | qa |
| 其他 | AI 列表 | 无筛选 |

**添加按钮：**
```
尺寸：32pt × 32pt
圆角：6pt
背景：透明
悬停背景：#27272A (zinc-800)
图标：plus (SF Symbol)
颜色：#A1A1AA (zinc-400)
```

### 2.2 AI 列表（滚动区域）

**容器样式：**
```
内边距：8pt
滚动条：macOS 原生滚动条样式
```

**AI 卡片样式：**

```
尺寸：284pt 宽 × 76pt 高
圆角：8pt
内边距：12pt
下边距：8pt

默认状态：
- 背景：透明
- 边框：无

悬停状态：
- 背景：#27272A + 50% 透明度 (zinc-800/50)

选中状态：
- 背景：#27272A (zinc-800)
- 边框：1pt #3B82F6 + 50% 透明度 (blue-500/50)
```

**AI 卡片内容布局：**

```
┌────────────────────────────────────────┐
│ [图标]  AI 名称              [状态点]   │  ← 名称 14pt 中粗体
│ 40×40   角色 · 类型/模型              │  ← 副标题 12pt zinc-400
│                                        │
└────────────────────────────────────────┘
```

**AI 图标框：**
```
尺寸：40pt × 40pt
圆角：8pt
背景：渐变 (from #3B82F6/20 to #9333EA/20)
边框：1pt #3B82F6 + 30% 透明度
图标：brain (SF Symbol)
图标颜色：#60A5FA (blue-400)
图标尺寸：20pt × 20pt
```

**状态指示点：**
```
尺寸：8pt × 8pt (圆形)
位置：卡片右上角

状态颜色：
- idle (空闲): #A1A1AA (zinc-400)
- working (工作中): #4ADE80 (green-400) + 脉动动画
- paused (暂停): #FACC15 (yellow-400)
- error (错误): #F87171 (red-400)
```

**角色和类型标签：**
```
高度：20pt
圆角：4pt
内边距：水平 6pt，垂直 2pt
字体：11pt

类型标签样式：
- Web: 灰色背景 #3F3F46 (zinc-700)
- API: 灰色背景 #3F3F46
- CLI: 灰色背景 #3F3F46

角色标签颜色：
- PM: 背景 #A855F7/20, 文字 #C084FC, 边框 #A855F7/30
- Developer: 背景 #3B82F6/20, 文字 #60A5FA, 边框 #3B82F6/30  
- QA: 背景 #22C55E/20, 文字 #4ADE80, 边框 #22C55E/30
```

### 2.3 折叠按钮

```
位置：侧边栏右边缘，向右偏移 16pt，距顶部 16pt
尺寸：32pt × 32pt (圆形)
背景：#27272A (zinc-800)
边框：1pt #3F3F46 (zinc-700)
图标：chevron.left / chevron.right
图标颜色：#A1A1AA (zinc-400)
阴影：轻微阴影
```

---

## 3. 主工作区（弹性宽度）

主工作区根据当前路由显示不同的视图内容。

### 3.1 项目经理视图

#### 布局

```
┌─────────────┬────────────────────────────────────┐
│             │                                    │
│  任务总览    │        对话区域                     │
│  400pt 固定 │        (弹性宽度)                   │
│             │                                    │
└─────────────┴────────────────────────────────────┘
```

#### 任务总览区域

**顶部标题栏：**
```
高度：60pt
内边距：16pt
底边框：1pt #27272A (zinc-800)

内容：
- 标题："任务总览" (16pt 中粗体)
- 副标题："共 X 个任务" (14pt zinc-400)
```

**任务卡片：**

```
宽度：368pt (400pt - 内边距)
高度：自适应（最小 100pt）
圆角：8pt
背景：#18181B + 50% 透明度 (zinc-900/50)
边框：1pt #27272A (zinc-800)
内边距：12pt
下边距：8pt
悬停边框：#3F3F46 (zinc-700)
```

**任务卡片内容：**

```
┌─────────────────────────────────────┐
│ [图标] 任务标题                      │  ← 14pt 中粗体
│        任务描述（最多 2 行）          │  ← 12pt zinc-400
│                                     │
│ [优先级标签] [分配对象标签]          │  ← 底部标签
└─────────────────────────────────────┘
```

**状态图标：**
- pending: circle (空心圆) - zinc-400
- in-progress: clock.fill (时钟) - blue-400 + 旋转动画
- review: exclamationmark.circle (感叹号) - yellow-400
- done: checkmark.circle.fill (勾选) - green-400

**优先级标签：**
- low: 背景 #3F3F46, 文字 #D4D4D8
- medium: 背景 #3B82F6/20, 文字 #60A5FA, 边框 #3B82F6/30
- high: 背景 #EF4444/20, 文字 #F87171, 边框 #EF4444/30

#### 对话区域

**顶部信息栏：**

```
高度：72pt
内边距：16pt
底边框：1pt #27272A (zinc-800)
背景：#09090B (zinc-950)

布局：
┌───────────────────────────────────────────────────┐
│ [头像] AI 名称                        [在线状态]   │
│ 40pt   项目经理 · claude-3.5-sonnet             │
└───────────────────────────────────────────────────┘
```

**头像框：**
```
尺寸：40pt × 40pt
圆角：8pt
背景：渐变 (from #A855F7/20 to #EC4899/20)
边框：1pt #A855F7/30
内容：emoji 👔 或图标
```

**在线状态标签：**
```
高度：24pt
圆角：12pt
内边距：水平 8pt
背景：#22C55E/20
文字：#4ADE80 "在线"
边框：1pt #22C55E/30
```

**消息滚动区域：**

```
内边距：16pt
背景：透明
最大宽度：800pt (居中显示)
```

**消息气泡组件：**

AI 消息（左对齐）：
```
最大宽度：600pt
圆角：8pt
背景：#27272A + 50% 透明度 (zinc-800/50)
边框：1pt #3F3F46 (zinc-700)
内边距：12pt
文字颜色：#FAFAFA
下边距：16pt

头像：
- 尺寸：32pt × 32pt
- 圆角：8pt
- 背景：角色颜色/20
- 内容：emoji (项目经理: 👔, 开发: 💻, 验收: 🧪)
```

用户消息（右对齐）：
```
最大宽度：600pt
圆角：8pt
背景：#3B82F6/20
边框：1pt #3B82F6/30
内边距：12pt
文字颜色：#FAFAFA
下边距：16pt
对齐：右对齐

头像：
- emoji: 👤
- 背景：#F97316/20 (orange)
```

**时间戳：**
```
字体：11pt
颜色：#71717A (zinc-500)
位置：气泡下方，间距 4pt
```

**底部输入区域：**

```
高度：72pt
内边距：16pt
顶边框：1pt #27272A (zinc-800)
背景：#09090B (zinc-950)

布局：
┌────────────────────────────────────────┐
│ [输入框..............................] [发送按钮] │
└────────────────────────────────────────┘

提示文字（下方居中）：
"在此输入可直接干预项目经理的决策"
字体：11pt, 颜色 #71717A
```

**输入框样式：**
```
高度：40pt
圆角：6pt
背景：#18181B (zinc-900)
边框：1pt #3F3F46 (zinc-700)
聚焦边框：1pt #3B82F6 (blue-500)
聚焦光晕：2pt #3B82F6/50
内边距：水平 12pt
占位符颜色：#71717A (zinc-500)
```

**发送按钮：**
```
尺寸：40pt × 40pt
圆角：6pt
背景：#2563EB (blue-600)
悬停背景：#1D4ED8 (blue-700)
图标：paperplane.fill (SF Symbol)
图标颜色：白色
```

---

### 3.2 开发人员视图

#### 顶部标签栏

```
高度：72pt
内边距：16pt
底边框：1pt #27272A (zinc-800)

内容：
- AI 信息（同项目经理视图）
- 状态标签："正在编码" (blue-400 背景)
```

#### 标签页控制

```
位置：信息栏下方
高度：44pt
内边距：水平 16pt
背景：#18181B (zinc-900)
边框：1pt #27272A (zinc-800)
圆角：6pt

标签项：
- [对话] [代码预览] [任务]
- 高度：32pt
- 圆角：4pt
- 内边距：水平 12pt
```

**标签状态：**
```
未激活：
- 背景：透明
- 文字：#A1A1AA (zinc-400)
- 悬停背景：#27272A/50

激活：
- 背景：#27272A (zinc-800)
- 文字：#FAFAFA
```

#### 对话标签页

内容同项目经理视图的对话区域，但：
- 头像 emoji 改为 💻
- 角色标签颜色改为蓝色系

#### 代码预览标签页

**代码容器：**

```
内边距：16pt
最大宽度：1000pt (居中)

代码块：
┌─────────────────────────────────────────┐
│ LoginForm.tsx              [React]      │  ← 文件名栏
├─────────────────────────────────────────┤
│ import { useForm } from ...             │
│ ...                                     │  ← 代码区
│ }                                       │
└─────────────────────────────────────────┘
```

**文件名栏：**
```
高度：44pt
内边距：12pt
背景：#18181B (zinc-900)
顶部圆角：8pt
底边框：1pt #27272A (zinc-800)

左侧文件名：12pt, #A1A1AA
右侧标签：语言标签 (如 "React", "TypeScript")
```

**代码区域：**
```
背景：#18181B (zinc-900)
底部圆角：8pt
内边距：16pt
字体：SF Mono 或 Menlo (等宽字体)
字号：13pt
行高：1.6
文字颜色：#D4D4D8 (zinc-300)

语法高亮：
- 关键字：#C084FC (purple-400)
- 字符串：#4ADE80 (green-400)
- 函数：#60A5FA (blue-400)
- 注释：#71717A (zinc-500)
```

#### 任务标签页

**任务卡片：**

```
宽度：最大 800pt (居中)
高度：自适应
圆角：8pt
背景：#18181B/50 (zinc-900/50)
边框：1pt #27272A (zinc-800)
内边距：16pt
下边距：12pt
```

**任务卡片内容：**

```
┌────────────────────────────────────────┐
│ 任务名称                    [进行中]    │  ← 14pt 中粗体
│                                        │
│ 进度                            40%    │  ← 12pt
│ [━━━━━━━━━━░░░░░░░░░░░░░░░]          │  ← 进度条
└────────────────────────────────────────┘
```

**进度条：**
```
高度：8pt
圆角：4pt
背景：#27272A (zinc-800)
填充：渐变 (from #3B82F6 to #06B6D4)
动画：500ms 平滑过渡
```

---

### 3.3 验收人员视图

#### 结构

同开发人员视图，包含三个标签页：

1. **对话**：同开发视图，emoji 改为 🧪
2. **测试结果**
3. **测试报告**

#### 测试结果标签页

**测试结果卡片：**

```
宽度：最大 1000pt (居中)
高度：自适应（最小 60pt）
圆角：8pt
内边距：16pt
下边距：8pt

根据状态不同背景：
- passed (通过): 背景 #22C55E/10, 边框 #22C55E/30
- warning (警告): 背景 #FACC15/10, 边框 #FACC15/30
- failed (失败): 背景 #EF4444/10, 边框 #EF4444/30
```

**测试结果卡片内容：**

```
┌─────────────────────────────────────────────┐
│ [✓] 用户登录 - 正常流程              0.23s  │  ← 通过
│ [⚠] 用户登录 - API 错误处理          1.2s   │  ← 警告
│     响应时间较长                            │     错误信息
│ [✗] 用户登录 - 网络超时              5.0s   │  ← 失败
│     超时处理未正确实现                      │     错误信息
└─────────────────────────────────────────────┘
```

**状态图标：**
- ✓ (checkmark.circle): #4ADE80 (green-400)
- ⚠ (exclamationmark.triangle): #FACC15 (yellow-400)
- ✗ (xmark.circle): #F87171 (red-400)

#### 测试报告标签页

**摘要卡片：**

```
宽度：最大 1000pt (居中)
圆角：8pt
背景：#18181B/50 (zinc-900/50)
边框：1pt #27272A (zinc-800)
内边距：24pt
```

**统计网格（3列）：**

```
┌─────────┬─────────┬─────────┐
│   12    │    2    │    1    │  ← 24pt 粗体
│  通过    │  警告    │  失败   │  ← 12pt zinc-400
└─────────┴─────────┴─────────┘

每个格子：
- 背景颜色：对应状态色/10
- 边框：对应状态色/30
- 圆角：8pt
- 内边距：16pt
```

**覆盖率部分：**

```
标题："覆盖率" (14pt 中粗体)
间距：12pt

每项格式：
语句覆盖率                              85%

[━━━━━━━━━━━━━━━━━░░░░]

颜色规则：
- >= 80%: green-500
- 60-79%: yellow-500
- < 60%: red-500
```

**问题列表：**

```
标题："需要关注的问题" (14pt 中粗体)

列表项：
• 网络超时处理未正确实现，需要添加 timeout 配置
• API 响应时间较长，建议优化或添加 loading 状态

红色问题：#F87171 圆点
黄色问题：#FACC15 圆点
```

---

### 3.4 消息流视图

#### 顶部区域

```
高度：100pt
内边距：16pt
底边框：1pt #27272A (zinc-800)

左侧：
- 标题："全局消息流" (18pt 粗体)
- 副标题："所有 AI 的活动记录" (14pt zinc-400)

右侧：
- [筛选] 按钮
- [导出] 按钮
```

**搜索框：**

```
宽度：100%
高度：40pt
圆角：6pt
背景：#18181B (zinc-900)
边框：1pt #3F3F46 (zinc-700)
内边距：水平 12pt，左侧预留 36pt (图标位置)

左侧图标：magnifyingglass (SF Symbol)
图标位置：距左 12pt
图标颜色：#A1A1AA (zinc-400)
```

#### 时间线区域

**日期分隔线：**

```
高度：32pt
内边距：上下 24pt

格式：
─────── 2026年3月16日 ───────

线条：1pt #27272A (zinc-800)
文字：12pt #71717A (zinc-500)
```

**时间线消息项：**

```
布局：

[●]─┐  AI名称 [角色标签] 时间戳
    │  ┌─────────────────────────┐
    │  │  消息内容                 │
    │  └─────────────────────────┘
    │
    │
```

**时间线圆点：**
```
尺寸：40pt × 40pt
圆角：8pt
背景：角色颜色/20
边框：1pt 角色颜色/30
内容：emoji (👔/💻/🧪/👤)
```

**连接线：**
```
宽度：2pt
颜色：#27272A (zinc-800)
位置：圆点中心向下
```

**消息信息行：**
```
高度：24pt
间距：8pt

内容：
- AI名称：14pt 中粗体
- 角色标签：同之前角色标签规范
- 时间戳：12pt #71717A (zinc-500)
```

**消息内容框：**
```
圆角：8pt
背景：#18181B/50 (zinc-900/50)
边框：1pt #27272A (zinc-800)
内边距：16pt
文字颜色：#D4D4D8 (zinc-300)
字号：13pt
行距：1.5
```

---

### 3.5 AI 配置中心视图

#### 布局

```
┌─────────────┬────────────────────────────────────┐
│             │                                    │
│  AI 列表    │        配置表单区域                 │
│  400pt     │        (弹性宽度)                   │
│             │                                    │
└─────────────┴────────────────────────────────────┘
```

#### AI 列表区域（左侧）

**顶部：**
```
高度：72pt
内边距：16pt
底边框：1pt #27272A

标题："AI 配置中心" (16pt 中粗体)
副标题："共 X 个 AI" (14pt zinc-400)
右侧：[+ 添加 AI] 按钮
```

**添加 AI 按钮：**
```
高度：32pt
圆角：6pt
背景：#2563EB (blue-600)
悬停：#1D4ED8 (blue-700)
文字：白色 13pt
内边距：水平 12pt
图标：plus
```

**AI 卡片列表：**

同次级侧边栏的 AI 卡片样式，但增加类型图标：

**类型图标框：**
```
尺寸：40pt × 40pt
圆角：8pt
背景：类型颜色/20
边框：1pt 类型颜色/30

图标映射：
- Web (globe): #3B82F6 (蓝色)
- API (bolt): #FACC15 (黄色)
- CLI (terminal): #22C55E (绿色)
```

#### 配置表单区域（右侧）

**空状态：**

```
居中显示：
图标：gearshape (100pt, zinc-500/50)
文字："选择一个 AI 进行配置" (14pt zinc-500)
```

**创建/编辑表单：**

**顶部栏：**
```
高度：60pt
内边距：16pt
底边框：1pt #27272A

左侧标题："添加新的 AI" 或 "配置 AI"
右侧：[删除] 按钮 (编辑模式)
```

**删除按钮：**
```
高度：32pt
圆角：6pt
背景：透明
边框：1pt #EF4444/30
文字：#F87171 (red-400)
悬停背景：#EF4444/10
图标：trash
```

**表单滚动区域：**

```
内边距：24pt
最大宽度：800pt (居中)
```

**配置卡片：**

```
宽度：100%
圆角：8pt
背景：#18181B/50 (zinc-900/50)
边框：1pt #27272A (zinc-800)
内边距：24pt
下边距：24pt
```

**卡片标题：**
```
高度：32pt
左侧图标 + 文字

图标尺寸：20pt
文字：14pt 中粗体
间距：12pt
```

**表单字段：**

```
标签：
- 字体：13pt
- 颜色：#FAFAFA
- 下边距：6pt

输入框：
- 高度：40pt
- 圆角：6pt
- 背景：#18181B (zinc-900)
- 边框：1pt #3F3F46 (zinc-700)
- 聚焦边框：1pt #3B82F6
- 聚焦光晕：2pt #3B82F6/50
- 内边距：水平 12pt
- 占位符：#71717A
- 字段间距：16pt

下拉选择器：
- 同输入框样式
- 右侧箭头图标：chevron.down
```

**类型专属配置卡片：**

显示不同的表单字段：

**Web 类型：**
```
图标：globe (blue)
标题："Web 配置"

字段：
- 网页 URL (输入框)
  占位符："https://chat.openai.com"
  提示文字："通过浏览器自动化与 AI 交互" (11pt zinc-500)
```

**API 类型：**
```
图标：bolt (yellow)
标题："API 配置"

字段：
- API 端点 (输入框)
  占位符："https://api.anthropic.com"
- API 密钥 (密码输入框)
  占位符："sk-..."
- 模型 (输入框)
  占位符："claude-3.5-sonnet"
```

**CLI 类型：**
```
图标：terminal (green)
标题："CLI 配置"

字段：
- 命令 (输入框)
  占位符："python"
- 参数 (输入框)
  占位符："--model gpt-4 --verbose"
  提示文字："用空格分隔多个参数"
```

**底部操作栏：**

```
高度：72pt
内边距：16pt
顶边框：1pt #27272A (zinc-800)
背景：#09090B (zinc-950)
对齐：右对齐
```

**按钮组：**
```
[取消] [保存] (创建模式)
[保存更改] (编辑模式)

取消按钮：
- 高度：40pt
- 圆角：6pt
- 背景：透明
- 边框：1pt #3F3F46
- 文字：#FAFAFA
- 悬停背景：#27272A

保存按钮：
- 高度：40pt
- 圆角：6pt
- 背景：#2563EB (blue-600)
- 悬停：#1D4ED8 (blue-700)
- 文字：白色
- 图标：checkmark
- 禁用状态：opacity 50%, pointer-events none
```

---

### 3.6 设置视图

#### 布局

```
顶部：
- 图标 + 标题 + 副标题 (同消息流视图)

滚动区域：
- 内边距：24pt
- 最大宽度：1000pt (居中)
```

#### 设置卡片

每个设置组为一个卡片：

```
宽度：100%
圆角：8pt
背景：#18181B/50 (zinc-900/50)
边框：1pt #27272A (zinc-800)
内边距：24pt
下边距：24pt
```

**卡片标题行：**
```
图标 + 标题
图标尺寸：20pt
标题：14pt 中粗体
间距：12pt
下边距：16pt
```

**设置项：**

**开关项格式：**
```
┌────────────────────────────────────────┐
│ 标题文字                      [开关]    │
│ 描述文字                               │
└────────────────────────────────────────┘

标题：13pt, #FAFAFA
描述：12pt, #A1A1AA (zinc-400)
行间距：4pt
项间距：16pt
分隔线：1pt #27272A (设置项之间)
```

**开关控件 (NSSwitch / Toggle)：**
```
系统默认样式
开启颜色：#3B82F6 (blue-500)
```

**数字输入项：**
```
同开关项布局，右侧为数字输入框
输入框宽度：120pt
```

**颜色选择项：**
```
标题："主题色"
下方：4个圆形颜色按钮 (32pt × 32pt)
间距：8pt

选中状态：2pt 边框 + 2pt 偏移
```

**设置组：**

1. **常规设置** (bolt 图标, blue-400)
   - 自动运行
   - 并行执行
   - 最大并发数

2. **通知设置** (bell 图标, yellow-400)
   - 任务完成通知
   - 错误通知
   - 人工干预提示

3. **外观设置** (paintbrush 图标, purple-400)
   - 主题色
   - 紧凑模式

4. **数据与存储** (internaldrive 图标, green-400)
   - 自动保存对话
   - 消息保留时间
   - [清除所有数据] 按钮 (red-400)

5. **安全设置** (lock.shield 图标, red-400)
   - 需要确认删除
   - 加密 API 密钥

---

## 4. 活动面板（400pt 宽）

### 视觉样式

```
背景色：#18181B + 50% 透明度 (zinc-900/50)
左边框：1pt #27272A (zinc-800)
```

### 4.1 标题区域

```
高度：72pt
内边距：16pt
底边框：1pt #27272A (zinc-800)

标题："实时活动" (16pt 中粗体)
副标题："系统消息流" (14pt zinc-400)
```

### 4.2 消息列表

**容器：**
```
内边距：16pt
滚动：macOS 原生滚动条
```

**消息项：**

```
布局：

┌────────────────────────────────────┐
│ [●]  AI名称 [角色]                  │
│ 32pt  消息内容                      │
│       3分钟前                       │
└────────────────────────────────────┘

下边距：12pt
```

**消息头像：**
```
尺寸：32pt × 32pt
圆角：8pt
背景：角色颜色/20 或人类 orange/20
边框：1pt 角色颜色/30
内容：emoji
```

**消息信息：**
```
名称：13pt 中粗体
角色标签：11pt, 角色颜色
间距：6pt
```

**消息内容：**
```
字体：13pt
颜色：#D4D4D8 (zinc-300)
行间距：1.5
上边距：4pt
```

**时间戳：**
```
字体：11pt
颜色：#71717A (zinc-500)
格式："X分钟前", "X小时前", "昨天", 等
上边距：4pt
```

### 4.3 折叠按钮

```
位置：活动面板左边缘，向左偏移 16pt，距顶部 16pt
样式：同次级侧边栏折叠按钮
图标：chevron.left / chevron.right (方向相反)
```

---

## 5. 颜色系统

### 5.1 基础色板

```swift
// 深色主题 (Dark Mode)
背景层级：
- Level 0 (最深): #09090B (zinc-950)
- Level 1: #18181B (zinc-900)
- Level 2: #27272A (zinc-800)
- Level 3: #3F3F46 (zinc-700)

文字层级：
- Primary: #FAFAFA (zinc-50)
- Secondary: #E4E4E7 (zinc-200)
- Tertiary: #D4D4D8 (zinc-300)
- Quaternary: #A1A1AA (zinc-400)
- Quinary: #71717A (zinc-500)

边框：
- Default: #27272A (zinc-800)
- Hover: #3F3F46 (zinc-700)
```

### 5.2 角色配色

```swift
项目经理 (PM):
- Primary: #A855F7 (purple-500)
- Light: #C084FC (purple-400)
- Background: #A855F7 20% opacity
- Border: #A855F7 30% opacity

开发人员 (Developer):
- Primary: #3B82F6 (blue-500)
- Light: #60A5FA (blue-400)
- Background: #3B82F6 20% opacity
- Border: #3B82F6 30% opacity

验收人员 (QA):
- Primary: #22C55E (green-500)
- Light: #4ADE80 (green-400)
- Background: #22C55E 20% opacity
- Border: #22C55E 30% opacity

人类用户 (Human):
- Primary: #F97316 (orange-500)
- Light: #FB923C (orange-400)
- Background: #F97316 20% opacity
- Border: #F97316 30% opacity
```

### 5.3 状态配色

```swift
成功 / 在线 / 通过:
- Primary: #22C55E (green-500)
- Light: #4ADE80 (green-400)

警告:
- Primary: #EAB308 (yellow-500)
- Light: #FACC15 (yellow-400)

错误 / 失败:
- Primary: #EF4444 (red-500)
- Light: #F87171 (red-400)

信息 / 主要操作:
- Primary: #3B82F6 (blue-500)
- Light: #60A5FA (blue-400)
- Dark: #2563EB (blue-600)
- Darker: #1D4ED8 (blue-700)
```

### 5.4 类型配色

```swift
Web:
- Icon: #3B82F6 (blue-500)
- Background: #3B82F6 20% opacity

API:
- Icon: #FACC15 (yellow-400)
- Background: #FACC15 20% opacity

CLI:
- Icon: #22C55E (green-500)
- Background: #22C55E 20% opacity
```

---

## 6. 交互动画

### 6.1 折叠动画

```swift
// 次级侧边栏 / 活动面板折叠
动画时长: 0.3s
缓动函数: ease-in-out
属性: width

展开: 0pt -> 300pt (次级) / 400pt (活动)
收起: 300pt / 400pt -> 0pt
```

### 6.2 状态脉动

```swift
// 工作中状态圆点
动画: pulse (系统内置)
时长: 2s
循环: 无限
不透明度: 1.0 -> 0.5 -> 1.0
```

### 6.3 悬停过渡

```swift
// 按钮、卡片等悬停效果
动画时长: 0.2s
缓动函数: ease
属性: background-color, border-color, opacity
```

### 6.4 进度条动画

```swift
// 任务进度条、覆盖率进度条
动画时长: 0.5s
缓动函数: ease-out
属性: width
```

### 6.5 加载旋转

```swift
// 时钟图标 (进行中状态)
动画: rotate
时长: 1s
循环: 无限
角度: 0° -> 360°
缓动函数: linear
```

### 6.6 消息出现

```swift
// 新消息淡入
动画时长: 0.3s
缓动函数: ease-in
属性: opacity, translateY
from: opacity 0, translateY 10pt
to: opacity 1, translateY 0pt
```

---

## 7. 数据结构

### 7.1 AI Agent

```typescript
interface AIAgent {
  id: string;              // 唯一标识，如 "pm-1", "dev-1"
  name: string;            // 显示名称，如 "Claude PM"
  role: AIRole;            // 角色类型
  type: AIType;            // 接入方式
  status: AIStatus;        // 当前状态
  avatar?: string;         // 头像（可选，emoji 或图片路径）
  config: AIConfig;        // 配置信息
  isActive?: boolean;      // 是否为当前激活的 AI
}

type AIRole = 'pm' | 'developer' | 'qa';

type AIType = 'web' | 'api' | 'cli';

type AIStatus = 'idle' | 'working' | 'paused' | 'error';

interface AIConfig {
  type: AIType;
  
  // Web 类型配置
  url?: string;
  
  // API 类型配置
  apiEndpoint?: string;
  apiKey?: string;
  model?: string;
  
  // CLI 类型配置
  command?: string;
  args?: string[];
}
```

### 7.2 Message

```typescript
interface Message {
  id: string;              // 消息 ID
  agentId: string;         // 发送者 ID
  agentName: string;       // 发送者名称
  agentRole: AIRole;       // 发送者角色
  content: string;         // 消息内容
  timestamp: Date;         // 时间戳
  isHuman?: boolean;       // 是否为人类发送
}
```

### 7.3 Task

```typescript
interface Task {
  id: string;              // 任务 ID
  title: string;           // 任务标题
  description: string;     // 任务描述
  assignedTo?: string;     // 分配给的 AI ID
  status: TaskStatus;      // 任务状态
  priority: TaskPriority;  // 优先级
  createdAt: Date;         // 创建时间
  updatedAt?: Date;        // 更新时间
}

type TaskStatus = 'pending' | 'in-progress' | 'review' | 'done';

type TaskPriority = 'low' | 'medium' | 'high';
```

### 7.4 TestResult

```typescript
interface TestResult {
  id: string;              // 测试 ID
  name: string;            // 测试名称
  status: TestStatus;      // 测试状态
  duration: number;        // 执行时长（秒）
  message?: string;        // 错误或警告信息
  timestamp: Date;         // 执行时间
}

type TestStatus = 'passed' | 'warning' | 'failed';
```

### 7.5 Coverage

```typescript
interface Coverage {
  statements: number;      // 语句覆盖率 (0-100)
  branches: number;        // 分支覆盖率 (0-100)
  functions: number;       // 函数覆盖率 (0-100)
  lines: number;          // 行覆盖率 (0-100)
}
```

---

## 8. 图标资源 (SF Symbols)

### 8.1 导航图标

```
briefcase              - 项目经理
chevron.left.forwardslash.chevron.right - 开发团队
checkmark.circle       - 验收团队
message                - 消息流
network                - AI 配置
gearshape              - 设置
```

### 8.2 控制图标

```
play.fill              - 开始运行
pause.fill             - 暂停运行
plus                   - 添加
trash                  - 删除
checkmark              - 保存/确认
xmark                  - 取消/关闭
chevron.left           - 向左折叠
chevron.right          - 向右折叠
chevron.down           - 下拉
```

### 8.3 状态图标

```
circle                 - 待办状态（空心）
circle.fill            - 状态点（实心）
clock.fill             - 进行中（带旋转动画）
exclamationmark.circle - 警告/审查中
checkmark.circle.fill  - 完成
xmark.circle           - 失败
exclamationmark.triangle - 警告（测试）
```

### 8.4 功能图标

```
paperplane.fill        - 发送消息
magnifyingglass        - 搜索
line.3.horizontal.decrease - 筛选
arrow.down.doc         - 导出/下载
brain                  - AI（通用）
person.fill            - 用户
globe                  - Web 类型
bolt                   - API 类型
terminal               - CLI 类型
bell                   - 通知
paintbrush             - 外观
internaldrive          - 数据存储
lock.shield            - 安全
```

---

## 9. 字体规范

### 9.1 字体族

```
界面字体：SF Pro (macOS 系统默认)
代码字体：SF Mono 或 Menlo
```

### 9.2 字体大小

```
大标题：18pt (Bold)
标题：16pt (Semibold)
副标题：14pt (Medium)
正文：13pt (Regular)
小字：12pt (Regular)
极小：11pt (Regular)

代码：13pt (Monospace)
```

### 9.3 字重

```
Bold (700)      - 大标题
Semibold (600)  - 标题
Medium (500)    - 副标题、重要文字
Regular (400)   - 正文
```

### 9.4 行高

```
标题：1.2
正文：1.5
代码：1.6
```

---

## 10. 间距系统

### 10.1 内边距 (Padding)

```
极小：4pt
小：8pt
默认：12pt
中：16pt
大：24pt
超大：32pt
```

### 10.2 外边距 (Margin)

```
组件间距：8pt
卡片间距：12pt
区块间距：16pt
视图间距：24pt
```

### 10.3 圆角 (Border Radius)

```
极小：4pt  (标签)
小：6pt   (按钮、输入框)
默认：8pt  (卡片、容器)
大：12pt  (大卡片)
圆形：50% (头像、状态点)
```

---

## 11. 窗口与布局

### 11.1 窗口规格

```
最小尺寸：1280pt × 720pt
推荐尺寸：1440pt × 900pt 或更大
样式：标准 macOS 窗口
标题栏：集成工具栏（如需要）
全屏支持：是
```

### 11.2 响应式规则

```
窗口宽度 >= 1440pt:
  - 所有面板正常显示

窗口宽度 1280pt - 1440pt:
  - 优先折叠活动面板
  - 保持次级侧边栏和主工作区

窗口宽度 < 1280pt:
  - 次级侧边栏也折叠
  - 只保留主导航和主工作区
```

---

## 12. 可访问性

### 12.1 颜色对比度

```
所有文字与背景对比度 >= 4.5:1 (WCAG AA 标准)
重要操作按钮对比度 >= 7:1 (WCAG AAA 标准)
```

### 12.2 键盘导航

```
支持 Tab 键在可交互元素间切换
支持 Enter/Space 激活按钮
支持 Esc 关闭弹窗/取消操作
支持 Cmd+快捷键操作（如需要）
```

### 12.3 VoiceOver 支持

```
所有交互元素添加适当的辅助功能标签
图标按钮添加文字描述
状态变化提供语音反馈
```

---

## 13. 开发建议

### 13.1 技术选型

**SwiftUI (推荐)**
```
优点：
- 声明式 UI，代码简洁
- 原生动画支持
- 自动支持暗色模式
- 与 macOS 12+ 完美集成

适合：
- 新项目
- macOS 12.0+ 目标系统
```

**AppKit**
```
优点：
- 更成熟稳定
- 更细粒度的控制
- 支持更低版本系统

适合：
- 需要兼容旧系统
- 需要高度自定义
```

### 13.2 实现优先级

**第一阶段：基础框架**
1. 四栏布局结构
2. 主导航栏及路由
3. 折叠功能
4. 基础样式系统

**第二阶段：核心功能**
1. 项目经理视图（对话）
2. 次级侧边栏（AI 列表）
3. 活动面板（消息流）
4. 数据模型和状态管理

**第三阶段：扩展视图**
1. 开发人员视图
2. 验收人员视图
3. 消息流视图
4. AI 配置中心

**第四阶段：优化完善**
1. 所有动画效果
2. 交互细节优化
3. 性能优化
4. 测试和调试

### 13.3 状态管理建议

```
推荐使用：
- SwiftUI: @StateObject, @ObservableObject
- Combine 框架处理异步事件
- 单一数据源原则 (Single Source of Truth)

数据流：
User Action -> ViewModel -> Model -> View Update
```

---

## 14. Mock 数据示例

### 14.1 Mock AI Agents

```swift
let mockAgents: [AIAgent] = [
    AIAgent(
        id: "pm-1",
        name: "Claude PM",
        role: .pm,
        type: .api,
        status: .working,
        config: AIConfig(
            type: .api,
            apiEndpoint: "https://api.anthropic.com",
            model: "claude-3.5-sonnet"
        )
    ),
    AIAgent(
        id: "dev-1",
        name: "Claude 3.5",
        role: .developer,
        type: .api,
        status: .working,
        config: AIConfig(
            type: .api,
            apiEndpoint: "https://api.anthropic.com",
            model: "claude-3.5-sonnet"
        )
    ),
    AIAgent(
        id: "dev-2",
        name: "GPT-4",
        role: .developer,
        type: .api,
        status: .idle,
        config: AIConfig(
            type: .api,
            apiEndpoint: "https://api.openai.com",
            model: "gpt-4"
        )
    ),
    AIAgent(
        id: "qa-1",
        name: "QA Bot",
        role: .qa,
        type: .cli,
        status: .idle,
        config: AIConfig(
            type: .cli,
            command: "pytest",
            args: ["--verbose"]
        )
    )
]
```

### 14.2 Mock Messages

```swift
let mockMessages: [Message] = [
    Message(
        id: "m1",
        agentId: "pm-1",
        agentName: "Claude PM",
        agentRole: .pm,
        content: "收到新的项目需求，正在分析代码架构...",
        timestamp: Date().addingTimeInterval(-7 * 60)
    ),
    Message(
        id: "m2",
        agentId: "dev-1",
        agentName: "Claude 3.5",
        agentRole: .developer,
        content: "已开始编写代码，当前进度 40%",
        timestamp: Date().addingTimeInterval(-5 * 60)
    )
]
```

### 14.3 Mock Tasks

```swift
let mockTasks: [Task] = [
    Task(
        id: "t1",
        title: "实现用户登录功能",
        description: "需要实现用户名/密码登录，包括表单验证",
        assignedTo: "dev-1",
        status: .inProgress,
        priority: .high,
        createdAt: Date().addingTimeInterval(-3600)
    ),
    Task(
        id: "t2",
        title: "设计 UI 界面",
        description: "完成主页面的 UI 设计",
        assignedTo: "dev-2",
        status: .review,
        priority: .medium,
        createdAt: Date().addingTimeInterval(-7200)
    )
]
```

---

## 15. 附录

### 15.1 设计参考

本设计借鉴了以下优秀产品的 UI/UX：

- **Visual Studio Code**：多栏式 IDE 布局、侧边栏设计
- **Xcode**：导航结构、调试面板
- **Slack**：消息流、侧边栏切换
- **Linear**：现代化设计语言、动画效果
- **Raycast**：Mac 原生体验、细节打磨

### 15.2 颜色命名规范

```
使用 Tailwind CSS 的颜色命名系统：
- zinc (中性灰)
- blue (蓝色 - 主色调)
- purple (紫色 - 项目经理)
- green (绿色 - 验收/成功)
- yellow (黄色 - 警告)
- red (红色 - 错误)
- orange (橙色 - 人类用户)

数字等级：
50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950
(从浅到深)
```

### 15.3 组件库推荐

如果使用现成组件库，推荐：

**SwiftUI:**
- 原生组件优先
- 自定义修饰符封装样式

**第三方库 (可选):**
- SwiftUIX (扩展组件)
- CodeEditor (代码编辑器)

---

## 结语

这份设计规范旨在为开发团队提供清晰、完整的 UI 实现指导。遵循这些规范，可以确保最终产品具有：

- ✅ 一致的视觉风格
- ✅ 流畅的交互体验  
- ✅ 专业的 macOS 原生感觉
- ✅ 高效的工作流程

建议在实现过程中：

1. **先搭建整体框架**，再填充细节
2. **频繁进行用户测试**，收集反馈
3. **保持设计的灵活性**，根据实际使用调整
4. **注重性能优化**，确保流畅运行

如有任何设计相关的问题或需要澄清的地方，欢迎随时沟通调整。

---

**文档版本**：1.0  
**最后更新**：2026-03-16  
**适用平台**：macOS 12.0+  
**设计语言**：现代暗色主题 IDE 风格
