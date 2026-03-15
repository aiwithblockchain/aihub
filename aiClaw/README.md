# aiClaw 🦎

aiClaw 是一款创新的浏览器扩展程序，旨在通过浏览器端实现对主流 AI 平台（ChatGPT, Gemini, Grok）的自动化调度与协作。它是 **aiHub** 生态系统中的关键执行组件。

## 🎯 项目定位

aiClaw 作为“浏览器端 AI 代理集线器”，其核心定位是：
- **桥接器**：连接外部任务中心与浏览器内的 AI 会话。
- **调度员**：在用户已登录的浏览器环境下，自动分发并执行 AI 指令。
- **协作员**：将 ChatGPT、Gemini 和 Grok 的能力串联起来，完成复杂的自动化流程。

## 🚀 核心功能

1. **三位一体支持**：同时支持在浏览器中运行的 ChatGPT、Google Gemini 和 xAI Grok。
2. **长连接任务领取**：通过 WebSocket 与 `localBridge` 保持即时通信，实现任务的秒级推送。
3. **无缝集成**：利用用户现有的浏览器登录状态，无需额外 API Key，直接与原生 AI 网页进行交互。
4. **自动化执行**：接收来自任务中心的命令，自动在对应平台输入提示词（Prompt）并获取反馈。

## 🏗 工作原理

aiClaw 并不直接调用 AI 的后端 API，而是模仿用户在浏览器中的交互行为：
1. **连接**：启动后，扩展程序会尝试连接到本地运行的 `localBridge` 服务（通常位于 `aihub/localBridge`）。
2. **监听**：通过 WebSocket 协议订阅任务队列。
3. **分发**：一旦有新任务，aiClaw 会识别目标平台（如 ChatGPT），并在对应的标签页中注入并执行操作。
4. **反馈**：将 AI 的执行结果通过 WebSocket 传回任务中心。

## 🛠 开发与运行环境

- **浏览器扩展**：基于 Manifesto V3 标准开发。
- **任务中转**：依赖 `/Users/wesley/aiwithblockchain/aihub/localBridge` 提供的服务。
- **通信协议**：WebSocket。

## 📝 快速开始

1. **启动 Local Bridge**：确保 `localBridge` 服务已在本地启动并监听 WebSocket 端口。
2. **登录 AI 平台**：在浏览器中登录您的 ChatGPT、Gemini 和 Grok 账号。
3. **加载 aiClaw**：
   - 打开 Chrome 浏览器，进入 `chrome://extensions/`。
   - 开启“开发者模式”。
   - 点击“加载已解压的扩展程序”，选择 `aiClaw` 目录。
4. **开始协作**：通过任务中心下发指令，观察 AI 们的精彩表现。

---

*aiClaw - 让浏览器里的 AI 为你所用。*
