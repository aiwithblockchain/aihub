import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppDeps } from '../../server/createServer.js';
import { mapError } from '../../errors/mapError.js';
import { getXStatusInputSchema } from '../../schemas/contextSchemas.js';
import { buildMeta } from '../../utils/buildMeta.js';
import { errorResult, successResult } from '../../utils/toolResult.js';

export function registerGetXStatusTool(server: McpServer, deps: AppDeps): void {
  server.registerTool(
    'get_x_status',
    {
      description:
        'Get the current X browser status, including tabs, active page, and login state.',
      inputSchema: getXStatusInputSchema,
    },
    async (input) => {
      const meta = buildMeta();

      try {
        const status = await deps.xApiAdapter.getStatus(input.timeoutMs);

        deps.logger.info('get_x_status succeeded', {
          hasXTabs: status.hasXTabs,
          isLoggedIn: status.isLoggedIn,
          tabCount: status.tabs.length,
        });

        return successResult(
          {
            ...status,
            raw: status,
          },
          meta,
        );
      } catch (error) {
        const mapped = mapError(error);

        deps.logger.error('get_x_status failed', {
          code: mapped.code,
          message: mapped.message,
        });

        return errorResult(mapped, meta);
      }
    },
  );
}
