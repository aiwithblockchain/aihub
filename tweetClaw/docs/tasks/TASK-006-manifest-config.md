# TASK-006: Manifest 和构建配置

**优先级:** P2  
**预计时间:** 0.5天  
**依赖:** TASK-003

## 目标

更新 manifest.json 和 webpack 配置,使扩展支持小红书平台。

## 实现内容

### 1. 查找并更新 manifest.json

首先需要找到 manifest.json 的位置(可能在 `public/` 或项目根目录)。

**更新内容:**

```json
{
  "manifest_version": 3,
  "name": "TweetClaw",
  "version": "0.6.0",
  "description": "Powerful agentic tool for X and Xiaohongshu web session binding.",
  
  "permissions": [
    "storage",
    "cookies",
    "webRequest"
  ],
  
  "host_permissions": [
    "https://x.com/*",
    "https://twitter.com/*",
    "https://www.xiaohongshu.com/*",
    "https://edith.xiaohongshu.com/*"
  ],
  
  "content_scripts": [
    {
      "matches": [
        "https://x.com/*",
        "https://twitter.com/*"
      ],
      "js": ["js/content.js"],
      "run_at": "document_start"
    },
    {
      "matches": [
        "https://www.xiaohongshu.com/*"
      ],
      "js": ["js/content-xhs.js"],
      "run_at": "document_start"
    }
  ],
  
  "web_accessible_resources": [
    {
      "resources": ["js/injection.js"],
      "matches": ["https://x.com/*", "https://twitter.com/*"]
    },
    {
      "resources": ["js/xhs-injection.js"],
      "matches": ["https://www.xiaohongshu.com/*"]
    }
  ],
  
  "background": {
    "service_worker": "js/background.js"
  },
  
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

### 2. 更新 webpack.config.js

在现有配置基础上添加小红书相关的入口:

```javascript
module.exports = {
  // ... 现有配置
  
  entry: {
    background: './src/service_work/background.ts',
    content: './src/content/main_entrance.ts',
    injection: './src/capture/injection.ts',
    popup: './src/popup/popup.ts',
    
    // 新增小红书入口
    'content-xhs': './src/content/xhs-main-entrance.ts',
    'xhs-injection': './src/platforms/xiaohongshu/xhs-injection.ts',
  },
  
  output: {
    path: path.resolve(__dirname, 'dist/js'),
    filename: '[name].js',
  },
  
  // ... 其他配置保持不变
};
```

### 3. 更新 package.json 版本

```json
{
  "name": "TweetClaw",
  "version": "0.6.0",
  "description": "Powerful agentic tool for X and Xiaohongshu web session binding.",
  // ... 其他配置
}
```

### 4. 创建构建脚本(可选)

**文件:** `scripts/build-xhs.sh`

```bash
#!/bin/bash
set -e

echo "Building TweetClaw with Xiaohongshu support..."

# 清理旧构建
rm -rf dist/

# TypeScript 编译检查
echo "Running TypeScript check..."
npx tsc --noEmit

# Webpack 构建
echo "Building with webpack..."
npm run build:r

echo "Build complete! Extension ready at dist/"
echo "Load unpacked extension from: $(pwd)/dist"
```

## 验收标准

- [ ] manifest.json 更新完成,包含小红书域名权限
- [ ] webpack.config.js 添加小红书入口点
- [ ] package.json 版本号更新为 0.6.0
- [ ] 构建成功,生成所有必需的 js 文件
- [ ] 在 Chrome 中加载扩展无错误
- [ ] 访问小红书时内容脚本正确注入

## 测试方法

```bash
# 构建扩展
npm run build:r

# 检查生成的文件
ls -la dist/js/
# 应该看到:
# - background.js
# - content.js
# - injection.js
# - content-xhs.js
# - xhs-injection.js
# - popup.js

# 在 Chrome 中测试:
# 1. 打开 chrome://extensions/
# 2. 启用"开发者模式"
# 3. 点击"加载已解压的扩展程序"
# 4. 选择 dist/ 目录
# 5. 访问 https://www.xiaohongshu.com/
# 6. 打开控制台,应该看到 "[XhsClaw-Page] System initialized."
```

## 注意事项

- manifest v3 要求 service worker 而不是 background page
- `run_at: "document_start"` 确保脚本在页面加载前注入
- `web_accessible_resources` 必须配置,否则注入脚本无法加载
- 确保所有路径与实际文件结构匹配
- 构建后的文件应该在 `dist/js/` 目录下
