import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppDeps } from './createServer.js';
import { registerListXInstancesTool } from '../tools/context/listXInstances.js';

export function registerTools(server: McpServer, deps: AppDeps): void {
  const enabledTools = deps.config.enabledTools;

  if (enabledTools === null || enabledTools.includes('list_x_instances')) {
    registerListXInstancesTool(server, deps);
  }
}
