# TweetClaw Popup 架构技术文档

> 文档类型：技术参考 | 归档日期：2026-06-04

---

## 一、架构概述

Popup 采用三层视图架构，将全局连接配置从平台模块中分离。

### 1.1 视图结构

```
VIEW 1: 主界面
├── Header: Logo + TweetClaw + ⚙ 设置
├── Bridge 连接状态（全局）
├── 平台列表
│   ├── [X]     Active     →
│   ├── [XHS]   Active     →
│   ├── [Reddit]  Pending
│   └── [Discord] Pending
└── Footer: Debug Interface

VIEW 2: 全局设置（新增）
├── 返回按钮
├── Bridge 设置
│   ├── IP 地址
│   ├── WS 端口
│   ├── REST 端口
│   └── 连接按钮
└── 实例名称设置

VIEW 3: 平台详情
├── 返回按钮
├── 平台名称
└── 平台能力说明
```

### 1.2 导航关系

| 入口 | 目标视图 |
|------|---------|
| Header 齿轮图标 | 全局设置页 |
| 平台卡片点击 | 平台详情页 |
| 返回按钮 | 主界面 |

---

## 二、设计系统

### 2.1 定位

**Industrial-Minimal**：为开发者和 AI 工程师设计的精密工具。视觉克制、信息密度适中、每个元素都有功能性目的。

### 2.2 颜色 Token

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
  --color-text-primary:   #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-text-muted:     #64748b;
}
```

### 2.3 字体 Token

```css
:root {
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  
  --text-xs:   11px / 14px;    /* 辅助信息 */
  --text-sm:   13px / 18px;    /* 次要文本 */
  --text-base: 14px / 20px;    /* 正文 */
  --text-lg:   16px / 22px;    /* 标题 */
  --text-xl:   18px / 24px;    /* 大标题 */
}
```

### 2.4 间距 Token

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
}
```

---

## 三、组件规范

### 3.1 平台卡片

```html
<div class="platform-card">
  <div class="platform-icon">
    <!-- SVG 图标，不用 emoji -->
  </div>
  <div class="platform-info">
    <span class="platform-name">X (Twitter)</span>
    <span class="platform-status status-active">Active</span>
  </div>
  <div class="platform-arrow">
    <!-- 右箭头 SVG -->
  </div>
</div>
```

**样式要点：**
- `cursor-pointer` 必须存在
- Hover 状态：`background: var(--color-surface-hover)` + `transition: 150ms`
- 状态颜色：Active=success, Pending=pending, Error=error

### 3.2 连接状态指示器

```html
<div class="connection-status">
  <span class="status-dot status-connected"></span>
  <span class="status-text">Connected</span>
  <span class="status-detail">ws://127.0.0.1:10086</span>
</div>
```

**状态样式：**
```css
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.status-connected { background: var(--color-success); }
.status-disconnected { background: var(--color-error); }
.status-pending { background: var(--color-pending); }
```

### 3.3 设置表单

```html
<div class="settings-form">
  <label class="form-label">IP 地址</label>
  <input type="text" class="form-input" value="127.0.0.1" />
  
  <label class="form-label">WS 端口</label>
  <input type="number" class="form-input" value="10086" />
  
  <div class="form-actions">
    <button class="btn btn-secondary">重新连接</button>
    <button class="btn btn-primary">保存并重连</button>
  </div>
</div>
```

---

## 四、平台状态定义

| 状态 | 含义 | 颜色 |
|------|------|------|
| Active | 有已登录的 tab，功能可用 | success |
| Pending | 无活跃 tab，等待用户打开平台页面 | pending |
| Error | 连接失败或认证失效 | error |

---

## 五、图标规范

### 5.1 图标来源

使用 **Heroicons** 或 **Lucide** SVG 图标，禁止使用 emoji。

### 5.2 平台图标映射

| 平台 | 图标 |
|------|------|
| X (Twitter) | X Logo SVG |
| XHS (小红书) | 书本/笔记图标 |
| Reddit | Reddit Logo SVG |
| Discord | Discord Logo SVG |

### 5.3 功能图标

| 功能 | 图标 |
|------|------|
| 设置 | gear / settings |
| 连接状态 | signal / wifi |
| 返回 | arrow-left |
| 前进 | arrow-right |

---

## 六、响应式断点

Popup 宽度固定为 **360px**，内部布局无需响应式断点。

---

## 七、可访问性

### 7.1 必须实现

- 所有交互元素有 `focus:outline` 状态
- 状态指示器不依赖颜色唯一传递信息（配合文字）
- 图标有 `aria-label`
- 表单 label 与 input 正确关联

### 7.2 动效限制

```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
}
```

---

## 八、文件结构

```
src/popup/
├── index.html           # 入口 HTML
├── popup.ts             # 主逻辑
├── styles/
│   ├── main.css         # 全局样式 + Token
│   ├── components.css   # 组件样式
│   └── views.css        # 视图特定样式
└── views/
    ├── main-view.ts     # 主界面
    ├── settings-view.ts # 全局设置
    └── platform-view.ts # 平台详情
```

---

## 九、消息通信

### 9.1 Background → Popup

```typescript
// 连接状态更新
chrome.runtime.sendMessage({
  type: 'CONNECTION_STATUS_UPDATE',
  status: 'connected' | 'disconnected',
  wsUrl: 'ws://127.0.0.1:10086'
});
```

### 9.2 Popup → Background

```typescript
// 请求连接状态
chrome.runtime.sendMessage({ type: 'GET_CONNECTION_STATUS' });

// 更新连接配置
chrome.runtime.sendMessage({
  type: 'UPDATE_CONNECTION_CONFIG',
  host: '127.0.0.1',
  wsPort: 10086,
  restPort: 10088
});

// 重新连接
chrome.runtime.sendMessage({ type: 'RECONNECT' });
```