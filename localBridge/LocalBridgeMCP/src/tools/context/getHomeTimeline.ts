import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppDeps } from '../../server/createServer.js';
import { mapError } from '../../errors/mapError.js';
import { getHomeTimelineInputSchema } from '../../schemas/contextSchemas.js';
import { buildMeta } from '../../utils/buildMeta.js';
import { errorResult, successResult } from '../../utils/toolResult.js';

export function registerGetHomeTimelineTool(
  server: McpServer,
  deps: AppDeps,
): void {
  server.registerTool(
    'get_home_timeline',
    {
      description: 'Get the current X home timeline raw payload.',
      inputSchema: getHomeTimelineInputSchema,
    },
    async (input) => {
      const meta = buildMeta();

      try {
        const timeline = await deps.xApiAdapter.getHomeTimeline(input.timeoutMs);

        deps.logger.info('get_home_timeline succeeded');

        return successResult(
          {
            raw: timeline,
          },
          meta,
        );
      } catch (error) {
        const mapped = mapError(error);

        deps.logger.error('get_home_timeline failed', {
          code: mapped.code,
          message: mapped.message,
        });

        return errorResult(mapped, meta);
      }
    },
  );
}
