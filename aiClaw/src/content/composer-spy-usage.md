# 如何使用 Composer Spy 分析各 AI 平台的请求

`composer-spy.ts` / `composer-spy.js` 是一段可以直接在浏览器的开发者工具（DevTools）中运行的追踪脚本。

此脚本的主要作用是：
- 记录文本输入框的修改和焦点状态。
- 监听发送按钮、停止按钮何时在 DOM 中出现和属性如何变更（例如从 `disabled` 变为可用）。
- 监听回复生成时候新元素插入的情况。
- 最后将整个交互链路导出为 JSON 以便完美匹配和分析该 AI 平台的 DOM 树状态变化。

由于之前的 `composer-spy.js` 是专为 ChatGPT 写死的（寻找 `#prompt-textarea` 等），我已经修改了它，让它现在会自动兼容 `Gemini`、`Grok` 以及回退到监控 `document.body`。

## 操作步骤

1. **准备代码**：
   你可以打开你在 `aiClaw/src/content/composer-spy.ts` (或如果编译后则为 `.js` 版本) 的代码全文，将它的所有代码复制到剪贴板。如果是 `.ts` 可以在你的 IDE 中通过编译后的 js 文件或者去除开头的类型声明来复制。
   
   > 提示：如果只需在浏览器 Console 运行，最简单的方式是将 `composer-spy.ts` 转议成合法的 `.js` 或直接使用我刚才更新过的代码（去掉了特殊的 TypeScript 专属类型标记）。

2. **在目标平台注入追踪脚本**：
   - 打开浏览器，进入目标平台（例如：https://gemini.google.com/app 或 https://grok.com/）
   - 按下 `F12` 或 `Command + Option + I`（Mac）打开 **开发者工具 (DevTools)**。
   - 切换到 **Console (控制台)** 标签页。
   - 将完全的 `composer-spy.js` 代码粘贴进去并按下回车执行。
   
3. **模拟人工操作**：
   - 此时 Console 里应该会打印出提示框，显示 `ACSpy 已启动 ✅`。
   - 现在你像正常人一样：点击输入框，输入一句测试问题（例如 `"Hello, testing"`）。
   - 点击原生的发送按钮。
   - 等待 AI 完全回复完毕（直到回答全部打完且生成状态结束）。

4. **导出 JSON 分析日志**：
   - 确认 AI 回答结束后，在 DevTools 的 **Console** 里输入以下命令并回车：
     ```javascript
     window.__acSpyDump()
     ```
   - 脚本会自动把按时间线的完整操作节点打印成一段长的 JSON 数组，并且如果成功的话，还会自动**复制到剪贴板**。
   - 如果没有复制成功，你可以手动复制 Console 吐出来的 JSON 内容。

5. **把日志发给 Claude/Antigravity**：
   - 将这份 JSON 给到我这里，我就可以完美无误差地为你重构和加固 Gemini 或 Grok 的 Adapter DOM 查找逻辑。
