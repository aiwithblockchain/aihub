import express from 'express';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Server } from 'http';
import * as path from 'path';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

let isConfigured = false;

// 配置 API
app.post('/api/config', (req, res) => {
  const { apiKey, baseURL } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API Key 不能为空' });
  }

  // 在 SDK 启动之前注入环境变量
  process.env.ANTHROPIC_API_KEY = apiKey;
  if (baseURL) {
    process.env.ANTHROPIC_BASE_URL = baseURL;
  }

  isConfigured = true;
  res.json({ success: true });
});

// 对话 API
app.post('/api/chat', async (req, res) => {
  if (!isConfigured) {
    return res.status(400).json({ error: '未配置 API，请先在设置中配置' });
  }

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: '消息不能为空' });
  }

  let response = '';

  try {
    // SDK 会从 process.env 读取配置
    for await (const msg of query({
      prompt: message,
      options: {
        allowedTools: [],
        permissionMode: 'acceptEdits'
      }
    })) {
      if (msg.type === 'assistant' && msg.message?.content) {
        for (const block of msg.message.content) {
          if ('text' in block) {
            response += block.text;
          }
        }
      }
    }
    res.json({ response });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || '请求失败' });
  }
});

// 导出 startServer 函数供 Electron 主进程调用
export function startServer(port: number = 0): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      console.log(`Server running on http://localhost:${actualPort}`);
      resolve({ server, port: actualPort });
    });
  });
}

// 如果直接运行此文件（非 import），启动服务器
if (require.main === module) {
  startServer(3000);
}
