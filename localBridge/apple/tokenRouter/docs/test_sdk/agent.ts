import { query } from "@anthropic-ai/claude-agent-sdk";

// 配置 API（在 SDK 启动之前注入环境变量）
process.env.ANTHROPIC_API_KEY = "sk-6b5c75e5936bdf29226a90ac11ba1ec46248eee8b7af7ca01cf609fa9e355e10";
process.env.ANTHROPIC_BASE_URL = "https://api.lycloud.top";

// 简单的消息发送和接收示例
async function sendMessage(userMessage: string) {
  console.log(`\n发送消息: ${userMessage}\n`);
  console.log("Claude 回应:");
  console.log("---");

  // SDK 会从 process.env 读取配置
  for await (const message of query({
    prompt: userMessage,
    options: {
      allowedTools: [],
      permissionMode: "acceptEdits"
    }
  })) {
    if (message.type === "assistant" && message.message?.content) {
      for (const block of message.message.content) {
        if ("text" in block) {
          console.log(block.text);
        }
      }
    } else if (message.type === "result") {
      console.log(`\n---\n完成: ${message.subtype}`);
    }
  }
}

// 主函数
async function main() {
  const userMessage = process.argv[2] || "你好，请介绍一下你自己";
  await sendMessage(userMessage);
}

main().catch(console.error);
