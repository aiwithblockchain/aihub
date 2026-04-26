import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppDeps } from '../../server/createServer.js';
import { mapError } from '../../errors/mapError.js';
import { listXInstancesInputSchema } from '../../schemas/contextSchemas.js';
import { buildMeta } from '../../utils/buildMeta.js';
import { errorResult, successResult } from '../../utils/toolResult.js';

export function registerListXInstancesTool(
  server: McpServer,
  deps: AppDeps,
): void {
  server.registerTool(
    'list_x_instances',
    {
      description:
        'List all currently connected tweetClaw X instances available through LocalBridge.',
      inputSchema: listXInstancesInputSchema,
    },
    async (input) => {
      const meta = buildMeta();

      try {
        const instances = await deps.xApiAdapter.listInstances(input.timeoutMs);

        deps.logger.info('list_x_instances succeeded', {
          count: instances.length,
        });

        return successResult(
          {
            instances,
          },
          meta,
        );
      } catch (error) {
        const mapped = mapError(error);

        deps.logger.error('list_x_instances failed', {
          code: mapped.code,
          message: mapped.message,
        });

        return errorResult(mapped, meta);
      }
    },
  );
}
