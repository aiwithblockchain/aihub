# TweetClaw Popup 重构方案

> 版本：v1.0 | 日期：2026-06-02 | 状态：待评审

---

## 一、问题分析

### 1.1 当前架构的核心缺陷

当前 popup 的信息架构存在一个根本性错误：**WebSocket 连接配置被埋在 "X (Twitter)" 模块入口之后**。

```
当前流程（错误）：
Main View → 点击 X 卡片 → X Settings View（含 WS Host / Port / REST Port）
```

这个设计有三个问题：

1. **归属错误**：WS/REST 连接是全局基础设施，所有平台（X、小红书、Reddit、Discord）共用同一个 LocalBridge 连接。把它放在 X 模块下，暗示它只服务于 Twitter，是错误的语义。

2. **可发现性差**：新用户打开插件看到平台列表，不知道去哪里配置连接。唯一的入口是点击 X 卡片，但这一点并不直觉。

3. **扩展性差**：随着平台增多，每个平台的"入口"会越来越多，用户完全不知道连接状态在哪里管理。

### 1.2 UI 视觉问题

- 大量 `style=""` 内联样式，无设计 token，维护困难
- 平台图标使用 emoji（`𝕏`、`🤖`、`💬`、`📕`），在不同系统渲染不一致
- Capabilities 列表使用 emoji 图标（`🔗`、`📖`、`👤`），不符合专业工具定位
- 缺乏视觉层次，所有区块间距和字号缺乏系统性
- Banner 区块视觉权重过重，干扰主要操作

### 1.3 平台状态不一致

代码中 XHS（小红书）已有实质性实现（`xhs-api.ts`、`xhs-extractor.ts`），但 UI 中仍标注为 "Coming Soon"，对用户产生误导。

---

## 二、新信息架构

### 2.1 视图结构

```
┌──────────────────────────────────────────────┐
│                  VIEW 1: 主界面               │
│  ┌────────────────────────────────────────┐  │
│  │  Header: Logo + TweetClaw + ⚙ 设置     │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │  Bridge 连接状态（全局）                │  │
│  │  ● Connected  ws://127.0.0.1:10086     │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │  平台列表                               │  │
│  │  [X]     Active     →                  │  │
│  │  [XHS]   Active     →                  │  │
│  │  [Reddit]  Pending                     │  │
│  │  [Discord] Pending                     │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │  Footer: Debug Interface               │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│            VIEW 2: 全局设置（新增）            │
│  ← 返回    Bridge 设置                        │
│  ┌────────────────────────────────────────┐  │
│  │  连接配置                               │  │
│  │  IP 地址    [127.0.0.1            ]    │  │
│  │  WS 端口    [10086                ]    │  │
│  │  REST 端口  [10088                ]    │  │
│  │  [重新连接]        [保存并重连]         │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │  实例名称                               │  │
│  │  名称       [User-1234            ]    │  │
│  │  [保存名称]                             │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│           VIEW 3: 平台详情（保留/优化）        │
│  ← 返回    X (Twitter)                        │
│  ┌────────────────────────────────────────┐  │
│  │  平台能力说明                           │  │
│  │  - 绑定 X 会话到 AI 代理               │  │
│  │  - 读取时间线和搜索结果                 │  │
│  │  - 执行操作（点赞、转发、发帖...）      │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### 2.2 关键变化对比

| 项目 | 当前 | 新方案 |
|------|------|--------|
| 连接设置入口 | X 卡片 → 设置页 | Header 齿轮图标 → 全局设置页 |
| 连接状态显示位置 | X 设置页内 | 主界面常驻显示 |
| XHS 状态 | Coming Soon | Active（与代码一致）|
| 导航方式 | 单一入口（X卡片） | Header 全局设置 + 平台卡片详情 |
| 图标 | emoji | SVG（Heroicons/Lucide）|

---

## 三、设计系统

### 3.1 定位

**Industrial-Minimal**：为开发者和 AI 工程师设计的精密工具，不是消费类应用。视觉上克制、信息密度适中、每个元素都有功能性目的。

### 3.2 颜色 Token

```css
:root {
  /* Backgrounds */
  --color-bg:           #090d14;   /* 主背景 */
  --color-surface:      #0f1623;   /* 卡片/区块背景 */
  --color-surface-2:    #141e2e;   /* 悬浮/激活区块 */
  --color-surface-hover:#1a2438;   /* Hover 状态 */

  /* Borders */
  --color-border:       #1e2d42;   /* 默认边框 */
  --color-border-strong:#2a3f5c;   /* 强调边框 */

  /* Brand / Interactive */
  --color-primary:      #1d9bf0;   /* 主色（X blue） */
  --color-primary-hover:#1a8cd8;
  --color-primary-dim:  rgba(29,155,240,0.12);

  /* Semantic */
  --color-success:      #22c55e;
  --color-success-dim:  rgba(34,197,94,0.12);
  --color-error:        #ef4444;
  --color-error-dim:    rgba(239,68,68,0.12);
  --color-warning:      #f59e0b;
  --color-pending:      #475569;

  /* Text */
  --color-text-primary: #e8edf5;
  --color-text-secondary:#8899aa;
  --color-text-muted:   #4a5568;
}
```

### 3.3 字体

```css
/* UI 文本 */
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

/* Mono（URL、端口、版本号） */
font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
```

不引入外部字体（popup 性能优先，避免 FOUT）。

### 3.4 间距系统

基础单位：4px

| Token | 值 |
|-------|----|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |

### 3.5 圆角系统

| Token | 值 | 用途 |
|-------|----|------|
| `--radius-sm` | 6px | 输入框、小按钮 |
| `--radius-md` | 10px | 卡片 |
| `--radius-lg` | 14px | 大卡片、平台卡片 |
| `--radius-full` | 9999px | 徽章、状态点 |

### 3.6 字号系统

| 用途 | 字号 | 字重 |
|------|------|------|
| 页面标题 H1 | 16px | 700 |
| 区块标题 H2 | 14px | 700 |
| Section Label | 10px | 700, uppercase, 0.08em |
| 正文 | 13px | 400 |
| 辅助文字 | 11px | 400 |
| Mono（端口/URL）| 12px | 400 |

### 3.7 图标规范

- **全部使用 SVG 内联图标**，不使用 emoji
- 尺寸：UI 图标 16×16，平台图标 20×20，导航图标 18×18
- 推荐来源：Lucide Icons（MIT 许可）
- 平台图标：使用各平台官方品牌 SVG（X logo、小红书 logo）

### 3.8 状态指示点

```css
.status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.connected {
  background: var(--color-success);
  box-shadow: 0 0 0 3px var(--color-success-dim);
  animation: pulse 2s ease-in-out infinite;
}
.status-dot.disconnected {
  background: var(--color-error);
  box-shadow: 0 0 0 3px var(--color-error-dim);
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 3px var(--color-success-dim); }
  50%       { box-shadow: 0 0 0 5px transparent; }
}
```

---

## 四、各视图组件规格

### 4.1 View 1 — 主界面

**Header 区块**
```
高度：52px
左侧：logo 32×32（border-radius: 8px）+ TweetClaw（16px/700）
右侧：⚙ 齿轮图标按钮（18×18 SVG，点击跳转全局设置）
背景：linear-gradient(180deg, #0f1623 0%, #090d14 100%)
底边：1px solid var(--color-border)
```

**Bridge Status 卡片**
```
位置：Header 正下方，padding: 12px 16px
内容：
  左侧 — 状态点（8px，connected/disconnected）
  中间 — 状态文字（13px/600）+ URL（12px mono, muted）
  右侧 — 版本号（10px, muted）
背景：var(--color-surface)
边框：1px solid var(--color-border)
边框-connected：1px solid rgba(34,197,94,0.3)
边框-radius：var(--radius-md)
margin：12px 16px
```

**平台列表**
```
padding: 0 16px 8px
gap: 8px

每张平台卡片：
  padding: 10px 12px
  background: var(--color-surface)
  border: 1px solid var(--color-border)
  border-radius: var(--radius-lg)
  cursor: pointer（Active 平台）/ default（Pending）
  transition: all 0.15s ease

  左侧：
    平台图标容器 32×32（background: var(--color-bg), border-radius: 8px）
    平台名称（14px/600）+ 副标题（11px, muted）

  右侧：
    Active：绿色徽章 + 右箭头 SVG（16px, secondary）
    Pending：灰色徽章

  Hover（Active only）：
    background: var(--color-surface-hover)
    border-color: var(--color-border-strong)
    translateY(-1px)

  Disabled（Pending）：
    opacity: 0.5
    pointer-events: none
```

**徽章样式**
```css
.badge-active {
  background: var(--color-success-dim);
  color: var(--color-success);
  border: 1px solid rgba(34,197,94,0.25);
  font-size: 10px; font-weight: 700;
  padding: 2px 7px; border-radius: 4px;
  text-transform: uppercase;
}
.badge-pending {
  background: rgba(71,85,105,0.3);
  color: var(--color-pending);
  font-size: 10px; font-weight: 600;
  padding: 2px 7px; border-radius: 4px;
}
```

**Footer**
```
padding: 10px 16px 14px
text-align: center
debug link: 11px, var(--color-text-muted), hover: var(--color-text-secondary)
```

### 4.2 View 2 — 全局设置（新增）

**Header-with-back**
```
高度：48px
左侧：← 返回按钮（SVG 18×18）
中间：Bridge 设置（14px/700）
```

**连接配置卡片**
```
Section label：CONNECTION
background: var(--color-surface)
border: 1px solid var(--color-border)
border-radius: var(--radius-md)
padding: 12px

输入框样式：
  width: 100%
  background: var(--color-bg)
  border: 1px solid var(--color-border)
  border-radius: var(--radius-sm)
  color: var(--color-text-primary)
  padding: 8px 10px
  font-size: 13px
  transition: border-color 0.15s, box-shadow 0.15s
  focus: border-color var(--color-primary), box-shadow: 0 0 0 3px var(--color-primary-dim)

按钮行（gap: 8px）：
  [重新连接]     flex:1, background: var(--color-success), border-radius: var(--radius-sm)
  [保存并重连]   flex:1, background: var(--color-primary), border-radius: var(--radius-sm)
  两者：font-size:13px, font-weight:600, padding:9px, color:#fff, cursor:pointer
```

**实例名称卡片**
```
与连接配置卡片样式相同，独立 Section label：INSTANCE
输入框 + [保存名称] 全宽按钮
```

### 4.3 View 3 — 平台详情

**X (Twitter) 详情**
```
Header-with-back + 平台名称
Section：CAPABILITIES
ul 列表（SVG 图标 + 文字，不用 emoji）
可选：平台特定设置（当前 X 无特定配置）
```

**Xiaohongshu 详情**
```
同上，添加 XHS 特有的能力说明
```

---

## 五、实施计划

### Phase 1：提取 CSS 到 Class（无功能变化）

**目标**：消除所有内联 `style=""`，建立 CSS token 体系。不改变任何功能逻辑。

- 在 `popup.html` `<style>` 块中定义所有 CSS 变量（token）
- 将 xSettingsView 中所有内联 style 提取为 class
- 替换 emoji 图标为 SVG

**验证**：页面外观与改前完全一致，TypeScript 逻辑无需修改。

### Phase 2：UX 架构重构

**目标**：实现新的三视图结构，全局设置独立。

1. 在 `popup.html` 新增 `globalSettingsView` div（原 xSettingsView 中的连接配置/实例名称部分迁移至此）
2. Header 新增齿轮图标按钮 `#btnSettings`，点击跳转到 globalSettingsView
3. 主界面新增常驻 Bridge Status 卡片（连接状态 + URL，从 background 轮询）
4. 更新 `popup.ts`：
   - 新增 `globalSettingsView` 的显示/隐藏逻辑
   - `#btnSettings` 事件监听
   - 主界面 `refreshStatus()` 独立运行（不依赖 xSettingsView 可见性）
5. XHS 平台卡片状态从 "Coming Soon / Pending" 改为 "Active"，添加点击跳转 View 3

### Phase 3：视觉精修

**目标**：应用完整设计系统，完成 UI polish。

- 应用新配色 token（更深的背景、更精细的边框层次）
- 状态点添加脉冲动画（connected 时）
- 所有交互元素添加 `cursor-pointer` + 平滑 transition
- 平台卡片 hover 效果精修（translateY + border-color）
- 移除 Companion Banner（或降权为 footer 级别的文字链接）
- 字号/字重系统化

### Phase 4：i18n 同步

- 新增 `settings.title`（Bridge 设置）、`settings.connection.title`（连接配置）等 key
- 更新 XHS 平台状态文案（`platform.xiaohongshu.status` 从 "即将推出" → "活跃桥接"）
- 同步更新 `translations.ts` 的 zh/en 双语

---

## 六、受影响文件

| 文件 | 改动类型 |
|------|----------|
| `dist/popup.html` | 主要重构（结构 + 样式） |
| `src/popup/popup.ts` | 新增 globalSettingsView 逻辑 |
| `src/utils/translations.ts` | 新增/修改 i18n key |

> `dist/popup.html` 是直接部署的 HTML 文件（无构建步骤），TypeScript 编译输出为 `dist/js/popup.js`。

---

## 七、验收标准

- [ ] 主界面常驻显示 Bridge 连接状态（无需进入任何子页面）
- [ ] 全局设置通过 Header 齿轮图标访问，与平台卡片解耦
- [ ] XHS 显示为 Active 状态
- [ ] 无 emoji 图标（全部替换为 SVG）
- [ ] 无内联 style=""（全部提取为 class）
- [ ] 所有可点击元素有 `cursor-pointer` + hover 状态 + transition
- [ ] i18n 覆盖所有新增文案
- [ ] 视觉对比度满足 WCAG AA（文字对背景 ≥ 4.5:1）

---

*下一步：评审此方案后，依据 Phase 1 → 4 顺序实施，每个 Phase 独立 PR，方便 review 和回滚。*
