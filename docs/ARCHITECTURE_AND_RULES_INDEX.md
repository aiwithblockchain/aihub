# Architecture And Rules Index

这个文件用于给人类和 AI 快速定位当前仓库中最重要的协议文档、执行文档和 API 规范。

## 1. LocalBridge REST API 规范

凡是在 `localBridge/` 下设计、修改、评审对外 REST API，必须先读：

- [API_DESIGN_RULES.md](/Users/hyperorchid/aiwithblockchain/aihub/localBridge/API_DESIGN_RULES.md)
- [AGENTS.md](/Users/hyperorchid/aiwithblockchain/aihub/localBridge/AGENTS.md)

如果执行环境支持 skill，再读：

- [SKILL.md](/Users/hyperorchid/aiwithblockchain/aihub/localBridge/rest-api-governance/SKILL.md)

外部依据摘要：

- [microsoft-rest-summary.md](/Users/hyperorchid/aiwithblockchain/aihub/localBridge/rest-api-governance/references/microsoft-rest-summary.md)

## 2. TweetClaw <-> LocalBridgeMac 第一阶段文档

用于实现 `tweetClaw service worker` 与 `LocalBridgeMac` 的 WebSocket 基础框架，以及第一个“查询当前 X 基础状态”的能力：

- [tweetclaw-localbridgemac-websocket-v1.md](/Users/hyperorchid/aiwithblockchain/aihub/docs/tweetclaw-localbridgemac-websocket-v1.md)
- [tweetclaw-localbridgemac-message-schema-v1.md](/Users/hyperorchid/aiwithblockchain/aihub/docs/tweetclaw-localbridgemac-message-schema-v1.md)
- [tweetclaw-localbridgemac-weak-ai-master-prompt-v1.md](/Users/hyperorchid/aiwithblockchain/aihub/docs/tweetclaw-localbridgemac-weak-ai-master-prompt-v1.md)

## 3. 规则优先级

当多个文档同时存在时，优先级如下：

1. 目录级 `AGENTS.md`
2. 对应模块的权威设计规则文档
3. 对应任务的实施文档
4. skill 文档
5. 参考摘要文档

## 4. 给 AI 的一句话要求

不要直接开始写 API 或协议代码，先找到本文件对应的规则入口，再开始实现。
