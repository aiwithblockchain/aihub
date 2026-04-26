# LocalBridgeMCP 首版 package.json / tsconfig / README / .gitignore 草案

## 1. 文档目标

本文档提供 `LocalBridgeMCP` 首版初始化时最先需要落地的 4 个基础文件草案：

- `package.json`
- `tsconfig.json`
- `README.md`
- `.gitignore`

这份文档的定位不是讨论方案，而是提供一套**接近可直接复制使用**的初始内容，帮助你更快创建 `LocalBridgeMCP` 项目。

目标是：

> **让你在创建 `LocalBridgeMCP` 目录后，可以先把这 4 个文件落下去，再开始写 `src/` 里的代码。**

---

## 2. 使用前提

这份草案基于以下假设：

- `LocalBridgeMCP` 将作为一个独立 TypeScript 项目存在
- 项目位置建议为 `localBridge/apple/LocalBridgeMCP`
- `LocalBridgeMac` 继续作为能力引擎
- `LocalBridgeMCP` 第一阶段通过 LocalBridge 已有 REST API 调用能力
- 第一阶段目标是快速做出可运行 MCP server，而不是一次性做完全部治理与工程化

因此，这里的内容会偏：

- 简洁
- 严格
- 可运行
- 易于后续扩展

---

## 3. `package.json` 草案

下面是一版适合第一阶段的 `package.json` 草案。

```json
{
  "name": "localbridge-mcp",
  "version": "0.1.0",
  "private": true,
  "description": "MCP adapter layer for LocalBridgeMac, exposing X/Twitter capabilities via MCP tools.",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.10.1",
    "eslint": "^9.17.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  },
  "engines": {
    "node": ">=20"
  }
}
```

---

## 3.1 `package.json` 字段说明

### `name`
建议使用：
- `localbridge-mcp`

简单清晰，和项目目标一致。

### `private`
建议第一阶段设置为 `true`。

原因：
- 当前不是 npm 包发布项目
- 避免误发布

### `type`
建议使用：
- `module`

这样更适合现代 Node + TypeScript 项目。

---

## 3.2 scripts 说明

### `dev`
```json
"dev": "tsx watch src/index.ts"
```
用于本地开发时直接监听运行。

### `build`
```json
"build": "tsc -p tsconfig.json"
```
用于构建 `dist` 输出。

### `start`
```json
"start": "node dist/index.js"
```
用于运行已构建版本。

### `typecheck`
```json
"typecheck": "tsc --noEmit"
```
用于只做类型检查。

### `lint`
```json
"lint": "eslint ."
```
先保留，哪怕你第一天还没配完整 eslint，也建议预留脚本名，便于后续接入。

---

## 3.3 依赖说明

### `@modelcontextprotocol/sdk`
用于 MCP server 本身。

### `zod`
用于：
- tool 参数 schema
- 配置校验
- 更稳定的输入错误处理

第一阶段就很值得引入。

---

## 3.4 为什么暂时不放太多依赖

第一阶段不建议一开始就加入：
- 太重的日志框架
- 太重的测试框架
- 太多 HTTP 工具库
- 太多构建工具链

原因是当前核心目标只有一个：

> **尽快跑通 MCP server + LocalBridge adapter + 首个 tool。**

所以依赖越少越好。

---

## 4. `tsconfig.json` 草案

下面是一版适合第一阶段的 `tsconfig.json` 草案。

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

---

## 4.1 配置说明

### `target: ES2022`
适合 Node 20+ 的现代运行环境。

### `module: NodeNext`
适合你这里的现代 ESM 项目结构。

### `rootDir` / `outDir`
明确：
- 源码在 `src`
- 输出到 `dist`

### `strict: true`
建议一开始就开。

因为 MCP tool 层大量处理：
- JSON
- schema
- route params
- HTTP responses

类型松了，后面很容易乱。

### `noUncheckedIndexedAccess`
这个开关虽然会稍微严格一些，但很适合处理外部数据时尽早暴露不确定性。

---

## 4.2 第一阶段不建议做的 tsconfig 复杂化

先不要急着加：
- path alias
- monorepo tsconfig
- 多 target 构建
- 浏览器兼容配置

第一阶段目标只是：
- 开发顺手
- 构建简单
- 类型明确

---

## 5. `.gitignore` 草案

下面是一版适合 `LocalBridgeMCP` 的 `.gitignore` 草案。

```gitignore
node_modules/
dist/
.env
.DS_Store
*.log
coverage/
.tmp/
tmp/
debug-output/
```

---

## 5.1 忽略项说明

### `node_modules/`
依赖目录，必须忽略。

### `dist/`
构建输出目录，必须忽略。

### `.env`
如果后续放本地配置或调试开关，避免误提交。

### `*.log`
本地日志不应进入版本库。

### `coverage/`
如果后续接入测试覆盖率工具，提前预留。

### `.tmp/` / `tmp/` / `debug-output/`
给后续本地调试留空间。

---

## 5.2 如果你把 `LocalBridgeMCP` 放入主仓库

建议顺便检查仓库根 `.gitignore`，确保不会因为子项目新增 Node 工程而把：
- `node_modules`
- `dist`
- 调试输出

误提交到仓库中。

---

## 6. `README.md` 草案

下面是一版适合第一阶段的 `README.md` 草案。

```md
# LocalBridgeMCP

LocalBridgeMCP is the MCP adapter layer for LocalBridgeMac.

It exposes LocalBridge's existing X/Twitter capabilities as MCP tools for upstream MCP clients such as Claude Desktop, Cursor, and other agent products.

## Goals

- Keep LocalBridgeMac unchanged as the capability engine
- Add MCP support as a separate adapter layer
- Reuse LocalBridge's existing REST APIs
- Gradually evolve toward an xmcp-style architecture

## Current Scope

First phase focuses on:

- MCP server bootstrapping
- LocalBridge REST adapter
- Initial X context/read/write tools
- Unified tool input/output structure
- Minimal governance features such as read-only mode and tool allowlist

## Prerequisites

Before running LocalBridgeMCP, make sure:

- LocalBridgeMac is running
- LocalBridge REST API is reachable
- At least one tweetClaw instance is connected
- X/Twitter is logged in if you want to use read/write account-specific tools

## Project Structure

```text
src/
  config/
  server/
  adapters/
  tools/
  schemas/
  errors/
  logging/
  utils/
```

## Development

Install dependencies:

```bash
npm install
```

Run in development mode:

```bash
npm run dev
```

Type check:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

Run built output:

```bash
npm run start
```

## Configuration

The MCP server will use its own configuration and will connect to LocalBridgeMac via HTTP.

Planned core config fields include:

- `localbridgeBaseUrl`
- `enabledTools`
- `readOnlyMode`
- `defaultInstanceId`
- `requestTimeoutMs`
- `debugLogging`
- `exposeRawPayload`

## First Milestone

The first milestone is to make the MCP server boot and successfully expose a working `list_x_instances` tool backed by the existing LocalBridge REST API.
```

---

## 6.1 README 为什么建议先用英文

不是必须，但有两个现实好处：

1. MCP 生态里的示例和协作语境通常更偏英文
2. 如果后续 tool 描述、项目结构、外部协作会涉及英文，README 用英文会更自然

当然，如果你更习惯中文，也完全可以保留中文版 README。

---

## 6.2 README 第一版不要写太满

第一版 README 的目标不是完整文档，而是：
- 解释项目定位
- 告诉别人怎么跑
- 说明依赖前提
- 给未来自己留上下文

不要在 README 一开始就写太多实现细节。

---

## 7. 建议新增但可稍后补的基础文件

除了这 4 个文件，后续很快还需要创建：

- `src/index.ts`
- `src/config/types.ts`
- `src/config/defaults.ts`
- `src/config/config.ts`
- `src/server/createServer.ts`
- `src/server/registerTools.ts`

但从初始化顺序上看，先把 `package.json`、`tsconfig.json`、`.gitignore`、`README.md` 建好，是最自然的第一步。

---

## 8. 初始化后的建议动作

如果你按这份草案先落下 4 个文件，接下来建议马上做：

### Step 1
运行：
- `npm install`

确认依赖能装好。

### Step 2
创建：
- `src/index.ts`

哪怕先只写一个最小入口。

### Step 3
创建：
- `src/config/`
- `src/server/`
- `src/adapters/`
- `src/tools/`

把目录骨架搭好。

### Step 4
先实现：
- `localBridgeClient.ts`
- `xApiAdapter.ts`
- `listXInstances.ts`

目标是尽快跑通第一条真实链路。

---

## 9. 最终建议

对于 `LocalBridgeMCP` 的首版基础文件，不要追求“企业级完美初始化模板”，而应该追求：

- 简单
- 严格
- 可运行
- 方便扩展

所以最合适的策略是：

> **先用最小但规范的 `package.json`、`tsconfig.json`、`.gitignore` 和 `README.md` 把项目骨架搭起来，再围绕 MCP server 入口、REST adapter 和 `list_x_instances` 逐步推进。**

---

## 10. 一句话总结

> `LocalBridgeMCP` 首版最适合采用一套轻量、现代、严格的 TypeScript 初始化配置：`package.json` 负责最小运行脚本和 MCP 基础依赖，`tsconfig.json` 保持严格和简单，`.gitignore` 屏蔽依赖与构建产物，`README.md` 用来固定项目定位与启动方式，从而让项目能快速进入真正的 MCP 开发阶段。
