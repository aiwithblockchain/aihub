import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LocalBridgeMcpConfig } from '../config/types.js';
import type { XApiAdapter } from '../adapters/xApiAdapter.js';
import type { Logger } from '../logging/logger.js';

export interface AppDeps {
  config: LocalBridgeMcpConfig;
  logger: Logger;
  xApiAdapter: XApiAdapter;
}

export function createServer(_deps: AppDeps): McpServer {
  return new McpServer({
    name: 'localbridge-mcp',
    version: '0.1.0',
  });
}
