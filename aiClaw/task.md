# Phase 1 任务书：凭证捕获链路

> **状态**：任务 1~7 已由上一个 AI 完成并编译通过。你只需要执行**任务 8（总体自检）**。

---

## 任务 1 ~ 7：已完成 ✅

以下任务已全部完成，编译验证已通过：

- ✅ 任务 1：`src/capture/consts.ts` — 常量、类型、平台匹配工具函数
- ✅ 任务 2：`src/capture/injection.ts` — MAIN world fetch/XHR hook
- ✅ 任务 3：`webpack.config.js` — 添加 injection 入口
- ✅ 任务 4：`dist/manifest.json` — 添加 web_accessible_resources + webRequest + document_start
- ✅ 任务 5：`src/content/main_entrance.ts` — 注入 injection.js + 消息中继
- ✅ 任务 6：`src/service_work/background.ts` — 凭证存储 + webRequest 补充拦截
- ✅ 任务 7：编译通过（`npm run build:d` 成功）

**你不需要重做以上任务。请直接执行下面的任务 8。**

---

## 任务 8：总体自检（你的工作）

### 目标

对 Phase 1 的全部工作做一次完整自检，确认一切就绪。

### 自检步骤

#### 8.1 文件完整性检查

运行以下命令，确认所有必要文件都存在：

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw

echo "=== 源码文件 ==="
test -f src/capture/consts.ts && echo "✅ src/capture/consts.ts" || echo "❌ src/capture/consts.ts"
test -f src/capture/injection.ts && echo "✅ src/capture/injection.ts" || echo "❌ src/capture/injection.ts"
test -f src/content/main_entrance.ts && echo "✅ src/content/main_entrance.ts" || echo "❌ src/content/main_entrance.ts"
test -f src/service_work/background.ts && echo "✅ src/service_work/background.ts" || echo "❌ src/service_work/background.ts"

echo ""
echo "=== 配置文件 ==="
test -f webpack.config.js && echo "✅ webpack.config.js" || echo "❌ webpack.config.js"
test -f dist/manifest.json && echo "✅ dist/manifest.json" || echo "❌ dist/manifest.json"
test -f package.json && echo "✅ package.json" || echo "❌ package.json"
test -f tsconfig.json && echo "✅ tsconfig.json" || echo "❌ tsconfig.json"

echo ""
echo "=== 编译产物 ==="
test -f dist/js/background.js && echo "✅ dist/js/background.js" || echo "❌ dist/js/background.js"
test -f dist/js/content.js && echo "✅ dist/js/content.js" || echo "❌ dist/js/content.js"
test -f dist/js/injection.js && echo "✅ dist/js/injection.js" || echo "❌ dist/js/injection.js"
```

**期望**：所有 11 项都显示 ✅。

#### 8.2 编译验证

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw
npm run build:d 2>&1 | tail -5
```

**期望**：最后几行应包含 `compiled successfully` 字样，exit code 为 0。

#### 8.3 三层架构通信链路逻辑检查

逐个验证三层的关键代码路径是否衔接正确：

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw

echo "=== 链路 1：injection.ts → postMessage ==="
grep "window.postMessage" src/capture/injection.ts | head -3
echo ""

echo "=== 链路 2：main_entrance.ts 监听 postMessage → chrome.runtime.sendMessage ==="
grep "addEventListener.*message" src/content/main_entrance.ts
grep "chrome.runtime.sendMessage" src/content/main_entrance.ts | head -3
echo ""

echo "=== 链路 3：background.ts 监听 chrome.runtime.onMessage → 存储凭证 ==="
grep "onMessage.addListener" src/service_work/background.ts
grep "updatePlatformCredentials" src/service_work/background.ts | head -3
echo ""

echo "=== 链路 4：postMessage source 标识一致性 ==="
echo "injection.ts 中的 source 值:"
grep "source:" src/capture/injection.ts | head -1
echo "main_entrance.ts 中的 source 检查值:"
grep "INJECTION_SOURCE" src/content/main_entrance.ts | head -1
echo "consts.ts 中 INJECTION_SOURCE 的定义:"
grep "INJECTION_SOURCE" src/capture/consts.ts
```

**期望**：
- 链路 1：能看到 `window.postMessage({source: 'aiclaw-injection', ...`
- 链路 2：能看到 `addEventListener('message'` 和 `chrome.runtime.sendMessage`
- 链路 3：能看到 `onMessage.addListener` 和 `updatePlatformCredentials`
- 链路 4：injection.ts 中的 `source: 'aiclaw-injection'` 应与 consts.ts 中的 `INJECTION_SOURCE = 'aiclaw-injection'` 一致

#### 8.4 manifest.json 关键配置检查

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw

echo "=== content_scripts 匹配域名 ==="
grep -A2 '"matches"' dist/manifest.json

echo ""
echo "=== web_accessible_resources ==="
grep -A10 "web_accessible_resources" dist/manifest.json

echo ""
echo "=== permissions ==="
grep -A6 '"permissions"' dist/manifest.json
```

**期望**：
- `matches` 中包含 `chatgpt.com`、`gemini.google.com`、`grok.com`
- `web_accessible_resources` 中包含 `js/injection.js`
- `permissions` 中包含 `storage`、`tabs`、`activeTab`、`webRequest`

#### 8.5 编译产物关键字符串检查

```bash
cd /Users/wesley/aiwithblockchain/aihub/aiClaw

echo "--- 检查 injection.js ---"
grep -c "aiclaw-injection" dist/js/injection.js && echo "✅ injection source tag" || echo "❌"
grep -c "__ac_fetch_patched" dist/js/injection.js && echo "✅ fetch hook flag" || echo "❌"

echo "--- 检查 content.js ---"
grep -c "ac_injection" dist/js/content.js && echo "✅ injection loading" || echo "❌"
grep -c "CREDENTIALS_CAPTURED" dist/js/content.js && echo "✅ credential relay" || echo "❌"

echo "--- 检查 background.js ---"
grep -c "ac_credentials" dist/js/background.js && echo "✅ credential storage" || echo "❌"
grep -c "webRequest" dist/js/background.js && echo "✅ webRequest logic" || echo "❌"
```

**期望**：所有项目都显示 ✅。

#### 8.6 自检结果汇总

如果以上 8.1 ~ 8.5 全部通过，请输出以下总结：

```
═══════════════════════════════════════════
   Phase 1 自检结果：全部通过 ✅
═══════════════════════════════════════════

完成的工作：
1. ✅ src/capture/consts.ts - 常量、类型、平台匹配工具函数
2. ✅ src/capture/injection.ts - MAIN world fetch/XHR hook
3. ✅ webpack.config.js - 添加 injection 入口
4. ✅ dist/manifest.json - 添加 web_accessible_resources + webRequest + document_start
5. ✅ src/content/main_entrance.ts - 注入 injection.js + 消息中继
6. ✅ src/service_work/background.ts - 凭证存储 + webRequest 补充拦截
7. ✅ 编译通过，三个 JS 产物完整
8. ✅ 总体自检通过

下一步：在浏览器中加载扩展，打开 ChatGPT 并正常发一条消息，
检查 service worker console 是否出现凭证捕获日志。
```

如果有任何一项失败，请指出失败项并尝试修复后重新验证。
