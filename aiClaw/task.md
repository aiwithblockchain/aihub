# aiClaw 初始化工程任务书

> **目标**：基于 `tweetClaw` 的技术架构，搭建 `aiClaw` 浏览器扩展工程骨架，并完成第一个简单的端到端验证——在 Grok、ChatGPT、Gemini 的页面 content script 环境中打印一条注入成功日志。

---

## 前置知识

- **参考工程路径**：`/Users/wesley/aiwithblockchain/aihub/tweetClaw`（以下简称 `tweetClaw`）
- **目标工程路径**：`/Users/wesley/aiwithblockchain/aihub/aiClaw`（以下简称 `aiClaw`）
- `tweetClaw` 使用的技术栈：TypeScript + Webpack + Manifest V3 浏览器扩展
- `tweetClaw` 的源码在 `src/` 目录，编译后的产物输出到 `dist/js/` 目录
- `dist/` 目录即为浏览器加载扩展时的安装目录（包含 `manifest.json`、图片、静态资源、以及编译后的 JS）

---

## 任务一：复制 tweetClaw 的目录结构（仅目录，不含文件）

### 目标

在 `aiClaw` 中创建与 `tweetClaw` 相同的目录结构骨架。

### tweetClaw 的完整目录结构（仅目录）

```
tweetClaw/
├── dist/
│   ├── images/
│   └── vendor/
├── src/
│   ├── content/
│   └── service_work/
└── tests/
    └── unit/
```

### 具体步骤

1. 在 `aiClaw/` 下创建以下目录（使用 `mkdir -p` 命令，这样即使父目录不存在也会自动创建）：

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw

mkdir -p dist/images
mkdir -p dist/vendor
mkdir -p src/content
mkdir -p src/service_work
mkdir -p tests/unit
```

2. **注意**：`tweetClaw` 中还有 `src/capture/`、`src/debug/`、`src/fixtures/`、`src/session/`、`src/shims/`、`src/tools/`、`src/types/`、`src/utils/`、`src/x_api/` 等子目录。这些是 tweetClaw 专门为 X (Twitter) 设计的业务目录，**不需要复制**。aiClaw 只需要最基本的 `src/content/` 和 `src/service_work/` 目录即可。

### 自我验证

运行以下命令，检查输出是否包含上述所有目录：

```bash
find /Users/wesley/aiwithblockchain/aihub/aiClaw -type d | sort
```

期望输出应包含（忽略 `.git` 等隐藏目录）：

```
/Users/wesley/aiwithblockchain/aihub/aiClaw
/Users/wesley/aiwithblockchain/aihub/aiClaw/dist
/Users/wesley/aiwithblockchain/aihub/aiClaw/dist/images
/Users/wesley/aiwithblockchain/aihub/aiClaw/dist/vendor
/Users/wesley/aiwithblockchain/aihub/aiClaw/src
/Users/wesley/aiwithblockchain/aihub/aiClaw/src/content
/Users/wesley/aiwithblockchain/aihub/aiClaw/src/service_work
/Users/wesley/aiwithblockchain/aihub/aiClaw/tests
/Users/wesley/aiwithblockchain/aihub/aiClaw/tests/unit
```

---

## 任务二：搭建与 tweetClaw 相同的编译架构

### 目标

让 aiClaw 拥有和 tweetClaw 一样的 TypeScript + Webpack 编译流程：TS 源码在 `src/` 中编写 → Webpack 编译 → 产物输出到 `dist/js/` → 浏览器从 `dist/` 目录加载扩展。

### 步骤 2.1：创建 `package.json`

在 `aiClaw/` 根目录创建 `package.json`，内容如下：

```json
{
  "name": "aiClaw",
  "version": "0.1.0",
  "description": "Browser extension to interact with ChatGPT, Gemini, and Grok via localBridge.",
  "private": true,
  "scripts": {
    "build:d": "webpack --mode development --stats-error-details",
    "build:r": "webpack --mode production --stats-error-details",
    "test": "vitest run"
  },
  "dependencies": {
    "webextension-polyfill": "^0.12.0"
  },
  "devDependencies": {
    "@types/chrome": "^0.1.37",
    "@types/node": "^20.0.0",
    "@types/webextension-polyfill": "^0.12.0",
    "copy-webpack-plugin": "^12.0.0",
    "ts-loader": "^9.5.0",
    "typescript": "^5.0.0",
    "vitest": "^1.3.0",
    "webpack": "^5.90.0",
    "webpack-cli": "^5.1.0"
  }
}
```

**注意**：
- 与 tweetClaw 的区别：移除了 `x-client-transaction-id` 依赖（那是 X 平台专属的）。
- `scripts` 中的 `build:d`（开发构建）和 `build:r`（生产构建）命令与 tweetClaw 完全一致。

### 步骤 2.2：创建 `tsconfig.json`

在 `aiClaw/` 根目录创建 `tsconfig.json`，内容如下（与 tweetClaw 完全一致）：

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "lib": [
            "ES2022",
            "DOM"
        ],
        "strict": false,
        "skipLibCheck": true,
        "esModuleInterop": true,
        "forceConsistentCasingInFileNames": true,
        "outDir": "./dist/js",
        "baseUrl": ".",
        "paths": {
            "*": [
                "node_modules/*"
            ]
        }
    },
    "include": [
        "src/**/*"
    ],
    "exclude": [
        "node_modules",
        "dist"
    ]
}
```

### 步骤 2.3：创建 `webpack.config.js`

在 `aiClaw/` 根目录创建 `webpack.config.js`，内容如下：

```javascript
const path = require('path');

module.exports = (env, argv) => {
    const mode = argv.mode || 'development';

    return {
        mode,
        devtool: mode === 'development' ? 'inline-source-map' : false,
        entry: {
            background: path.resolve(__dirname, 'src/service_work/background.ts'),
            content: path.resolve(__dirname, 'src/content/main_entrance.ts'),
        },
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'js/[name].js',
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
            ],
        },
        resolve: {
            extensions: ['.ts', '.js'],
        },
    };
};
```

**与 tweetClaw 的区别**：
- entry 只有 2 个入口文件：`background` 和 `content`。tweetClaw 有 4 个（还有 `injection` 和 `debug`），aiClaw 暂时不需要。
- 去掉了 tweetClaw 中的 `alias`（linkedom shim）和 `fallback`（canvas/process），因为 aiClaw 不需要它们。

### 步骤 2.4：创建 `vitest.config.ts`

在 `aiClaw/` 根目录创建 `vitest.config.ts`，内容如下（与 tweetClaw 完全一致）：

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
    },
});
```

### 步骤 2.5：创建 `dist/manifest.json`

这是浏览器扩展的核心配置文件，放在 `dist/` 目录中（因为 `dist/` 才是浏览器实际加载的目录）。

在 `aiClaw/dist/` 下创建 `manifest.json`，内容如下：

```json
{
  "manifest_version": 3,
  "name": "aiClaw",
  "version": "0.1.0",
  "description": "aiClaw: Browser agent hub for ChatGPT, Gemini, and Grok.",
  "background": {
    "service_worker": "js/background.js"
  },
  "icons": {
    "16": "images/logo_16.png",
    "48": "images/logo_48.png",
    "128": "images/logo_128.png"
  },
  "content_scripts": [
    {
      "matches": [
        "https://chatgpt.com/*",
        "https://chat.openai.com/*"
      ],
      "js": [
        "js/content.js"
      ],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "https://gemini.google.com/*"
      ],
      "js": [
        "js/content.js"
      ],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "https://grok.com/*",
        "https://x.com/i/grok*"
      ],
      "js": [
        "js/content.js"
      ],
      "run_at": "document_idle"
    }
  ],
  "permissions": [
    "storage",
    "tabs",
    "activeTab"
  ],
  "host_permissions": [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://gemini.google.com/*",
    "https://grok.com/*",
    "https://x.com/i/grok*",
    "ws://localhost/*",
    "ws://127.0.0.1/*"
  ]
}
```

**关键说明**：
- `content_scripts` 部分定义了 3 组匹配规则，分别对应 ChatGPT、Gemini、Grok 的网页。
- 所有 3 组都会注入同一个 `js/content.js` 文件（该文件由 `src/content/main_entrance.ts` 编译生成）。
- `run_at` 设为 `document_idle`，表示在页面加载完成后注入（比 tweetClaw 的 `document_start` 更安全、更稳定）。
- `host_permissions` 额外包含 `ws://localhost/*` 和 `ws://127.0.0.1/*`，用于未来与 localBridge 的 WebSocket 通信。

### 步骤 2.6：安装依赖

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw
npm install
```

### 自我验证

运行以下命令检查编译是否能通过（这一步要在任务三和任务四的源码文件都创建之后才能执行）：

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw
npm run build:d
```

预期结果：
- 命令执行成功，无报错。
- `dist/js/` 目录下出现 `background.js` 和 `content.js` 两个文件。

验证文件是否生成：

```bash
ls -la /Users/wesley/aiwithblockchain/aihub/aiClaw/dist/js/
```

应该看到 `background.js` 和 `content.js`。

---

## 任务三：复制版本升级脚本

### 目标

将 tweetClaw 的版本升级脚本 `bump_version.sh` 和打包脚本 `zip.sh` 复制到 aiClaw，并修改其中的项目名称引用。

### 步骤 3.1：创建 `bump_version.sh`

在 `aiClaw/` 根目录创建 `bump_version.sh`，内容如下：

```bash
#!/bin/bash

# 版本号递增脚本 for aiClaw
# 用法:
#   ./bump_version.sh [major|minor|patch]  默认: patch

# 定义文件路径
PACKAGE_JSON="package.json"
MANIFEST_JSON="dist/manifest.json"

# 检查文件是否存在
if [ ! -f "$PACKAGE_JSON" ]; then
    echo "错误: $PACKAGE_JSON 文件不存在"
    exit 1
fi

if [ ! -f "$MANIFEST_JSON" ]; then
    echo "错误: $MANIFEST_JSON 文件不存在"
    exit 1
fi

# 默认更新类型为 patch
UPDATE_TYPE="patch"
if [ $# -ge 1 ]; then
    case "$1" in
        major|minor|patch)
            UPDATE_TYPE="$1"
            ;;
        *)
            echo "错误: 无效的更新类型 '$1'"
            echo "用法: $0 [major|minor|patch]"
            exit 1
            ;;
    esac
fi

# 从 package.json 中提取当前版本
CURRENT_VERSION=$(grep -o '"version": *"[^"]*"' "$PACKAGE_JSON" | head -1 | cut -d'"' -f4)

if [ -z "$CURRENT_VERSION" ]; then
    echo "错误: 无法从 $PACKAGE_JSON 中提取版本号"
    exit 1
fi

echo "当前版本: $CURRENT_VERSION"

# 分割版本号
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"

# 检查版本号格式是否正确
if [ ${#VERSION_PARTS[@]} -ne 3 ]; then
    echo "错误: 版本号格式不正确，应为 major.minor.patch"
    exit 1
fi

# 根据更新类型递增版本号
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

case "$UPDATE_TYPE" in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        echo "更新类型: 主版本 (major)"
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        echo "更新类型: 次版本 (minor)"
        ;;
    patch)
        PATCH=$((PATCH + 1))
        echo "更新类型: 修订版本 (patch)"
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "新版本: $NEW_VERSION"

# 更新文件中的版本号
if command -v jq >/dev/null 2>&1; then
    # 如果系统安装了 jq，使用 jq 来更新（更安全的方法）
    jq --arg new_version "$NEW_VERSION" '.version = $new_version' "$PACKAGE_JSON" > temp.json && mv temp.json "$PACKAGE_JSON"
    jq --arg new_version "$NEW_VERSION" '.version = $new_version' "$MANIFEST_JSON" > temp.json && mv temp.json "$MANIFEST_JSON"
else
    # 如果没有 jq，使用 sed 来更新
    sed -i.bak -E "s/\"version\": \"[0-9]+\.[0-9]+\.[0-9]+\"/\"version\": \"$NEW_VERSION\"/g" "$PACKAGE_JSON"
    sed -i.bak -E "s/\"version\": \"[0-9]+\.[0-9]+\.[0-9]+\"/\"version\": \"$NEW_VERSION\"/g" "$MANIFEST_JSON"

    # 清理备份文件
    rm -f "$PACKAGE_JSON.bak" "$MANIFEST_JSON.bak"
fi

# 验证更新
UPDATED_PACKAGE_VERSION=$(grep -o '"version": *"[^"]*"' "$PACKAGE_JSON" | head -1 | cut -d'"' -f4)
UPDATED_MANIFEST_VERSION=$(grep -o '"version": *"[^"]*"' "$MANIFEST_JSON" | head -1 | cut -d'"' -f4)

if [ "$UPDATED_PACKAGE_VERSION" = "$NEW_VERSION" ] && [ "$UPDATED_MANIFEST_VERSION" = "$NEW_VERSION" ]; then
    echo "✅ 版本号已成功更新为: $NEW_VERSION"
    echo "✅ $PACKAGE_JSON 版本: $UPDATED_PACKAGE_VERSION"
    echo "✅ $MANIFEST_JSON 版本: $UPDATED_MANIFEST_VERSION"
else
    echo "❌ 版本号更新失败"
    echo "package.json 版本: $UPDATED_PACKAGE_VERSION"
    echo "manifest.json 版本: $UPDATED_MANIFEST_VERSION"
    exit 1
fi
```

### 步骤 3.2：创建 `zip.sh`

在 `aiClaw/` 根目录创建 `zip.sh`，内容如下：

```bash
cd dist
zip -r ../dist.zip ./*
cd ..
```

### 步骤 3.3：赋予脚本可执行权限

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw
chmod +x bump_version.sh
chmod +x zip.sh
```

### 自我验证

1. 检查文件是否存在且可执行：

```bash
ls -la /Users/wesley/aiwithblockchain/aihub/aiClaw/bump_version.sh
ls -la /Users/wesley/aiwithblockchain/aihub/aiClaw/zip.sh
```

应该看到权限中包含 `x`（可执行）。

2. **不要立即运行 `bump_version.sh`**，因为它会修改版本号。只需确认文件已创建且可执行即可。

---

## 任务四：编写 content script 和 background script 源码

### 目标

编写最简单的 TypeScript 源码，使 aiClaw 能在 ChatGPT、Gemini、Grok 的网页中注入 content script 并打印一条日志，证明代码注入成功。

### 步骤 4.1：创建 `src/content/main_entrance.ts`

在 `aiClaw/src/content/` 下创建 `main_entrance.ts`，内容如下：

```typescript
/**
 * main_entrance.ts - aiClaw Content Script
 *
 * 此脚本会被自动注入到 ChatGPT、Gemini、Grok 的网页中。
 * 当前任务：打印一条日志，证明 content script 已成功注入。
 */

// 识别当前所在的 AI 平台
function detectPlatform(): string {
    const hostname = window.location.hostname;

    if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
        return 'ChatGPT';
    }
    if (hostname.includes('gemini.google.com')) {
        return 'Gemini';
    }
    if (hostname.includes('grok.com') || hostname.includes('x.com')) {
        return 'Grok';
    }

    return 'Unknown';
}

const platform = detectPlatform();
const timestamp = new Date().toISOString();

console.log(
    `%c[aiClaw] ✅ Content script successfully injected into ${platform} at ${timestamp}`,
    'color: #4ade80; font-weight: bold; font-size: 14px; background: #1a1a2e; padding: 4px 8px; border-radius: 4px;'
);

console.log(`[aiClaw] Platform: ${platform}`);
console.log(`[aiClaw] URL: ${window.location.href}`);
console.log(`[aiClaw] Document readyState: ${document.readyState}`);
```

### 步骤 4.2：创建 `src/service_work/background.ts`

在 `aiClaw/src/service_work/` 下创建 `background.ts`，内容如下：

```typescript
/**
 * background.ts - aiClaw Background Service Worker
 *
 * 此脚本在浏览器扩展后台运行。
 * 当前任务：打印一条日志，证明 service worker 已启动。
 */

console.log(
    '%c[aiClaw] 🚀 Background service worker started.',
    'color: #60a5fa; font-weight: bold; font-size: 13px;'
);

// 扩展安装或更新时触发
chrome.runtime.onInstalled.addListener(() => {
    console.log('[aiClaw] Extension installed or updated.');
});
```

### 步骤 4.3：编译项目

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw
npm run build:d
```

### 自我验证

1. 编译必须成功（exit code 0），无错误信息。

2. 检查编译产物是否生成：

```bash
ls -la /Users/wesley/aiwithblockchain/aihub/aiClaw/dist/js/
```

预期输出应包含：
- `background.js`
- `content.js`

3. 检查 `content.js` 中是否包含关键字符串：

```bash
grep "aiClaw" /Users/wesley/aiwithblockchain/aihub/aiClaw/dist/js/content.js
```

应该能找到包含 `[aiClaw]` 的字符串。

4. 检查 `background.js` 中是否包含关键字符串：

```bash
grep "aiClaw" /Users/wesley/aiwithblockchain/aihub/aiClaw/dist/js/background.js
```

应该能找到包含 `[aiClaw]` 的字符串。

---

## 任务四（附加）：在浏览器中手动验证

> 此步骤需要人工操作浏览器来完成，AI 可以输出指引文字但无法自动完成。

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`。
2. 开启右上角的 **「开发者模式」** 开关。
3. 点击 **「加载已解压的扩展程序」**，选择 `/Users/wesley/aiwithblockchain/aihub/aiClaw/dist` 目录。
4. 如果提示图标文件缺失（`images/logo_16.png` 等），这是正常的，不影响功能。可以忽略该警告。
5. 打开以下三个网站：
   - `https://chatgpt.com`
   - `https://gemini.google.com`
   - `https://grok.com`
6. 在每个页面按 `F12` 打开开发者工具 → Console 面板。
7. 检查 Console 是否输出了：
   ```
   [aiClaw] ✅ Content script successfully injected into ChatGPT at ...
   ```
   （Gemini 和 Grok 页面分别显示对应的平台名称）

---

## 完工检查清单

完成所有任务后，`aiClaw/` 的目录结构应如下（不含 `node_modules` 和 `.git`）：

```
aiClaw/
├── README.md
├── task.md                       ← 你正在阅读的这个文件
├── bump_version.sh               ← 可执行
├── zip.sh                        ← 可执行
├── package.json
├── package-lock.json             ← npm install 后自动生成
├── tsconfig.json
├── vitest.config.ts
├── webpack.config.js
├── dist/
│   ├── manifest.json             ← 浏览器扩展核心配置
│   ├── images/                   ← 空目录，给未来放图标
│   ├── vendor/                   ← 空目录，给未来放第三方库
│   └── js/
│       ├── background.js         ← webpack 编译产物
│       └── content.js            ← webpack 编译产物
├── src/
│   ├── content/
│   │   └── main_entrance.ts      ← content script 源码
│   └── service_work/
│       └── background.ts         ← background service worker 源码
└── tests/
    └── unit/                     ← 空目录，给未来放单测
```

### 最终验证命令

依次运行以下命令，每条命令都应成功通过：

```bash
# 1. 检查目录结构
find /Users/wesley/aiwithblockchain/aihub/aiClaw -type d -not -path '*/node_modules/*' -not -path '*/.git/*' | sort

# 2. 检查编译
cd /Users/wesley/aiwithblockchain/aihub/aiClaw && npm run build:d

# 3. 检查编译产物
test -f dist/js/background.js && echo "✅ background.js exists" || echo "❌ background.js missing"
test -f dist/js/content.js && echo "✅ content.js exists" || echo "❌ content.js missing"

# 4. 检查 shell 脚本可执行
test -x bump_version.sh && echo "✅ bump_version.sh is executable" || echo "❌ bump_version.sh not executable"
test -x zip.sh && echo "✅ zip.sh is executable" || echo "❌ zip.sh not executable"

# 5. 检查关键文件存在
test -f dist/manifest.json && echo "✅ dist/manifest.json exists" || echo "❌ dist/manifest.json missing"
test -f package.json && echo "✅ package.json exists" || echo "❌ package.json missing"
test -f tsconfig.json && echo "✅ tsconfig.json exists" || echo "❌ tsconfig.json missing"
test -f webpack.config.js && echo "✅ webpack.config.js exists" || echo "❌ webpack.config.js missing"
```

所有输出都应显示 ✅。如果任何一项显示 ❌，请回到对应的任务步骤检查哪里遗漏了。
