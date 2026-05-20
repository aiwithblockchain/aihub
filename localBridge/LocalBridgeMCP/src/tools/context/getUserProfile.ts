import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppDeps } from '../../server/createServer.js';
import { mapError } from '../../errors/mapError.js';
import { getUserProfileInputSchema } from '../../schemas/contextSchemas.js';
import { buildMeta } from '../../utils/buildMeta.js';
import { errorResult, successResult } from '../../utils/toolResult.js';

export function registerGetUserProfileTool(
  server: McpServer,
  deps: AppDeps,
): void {
  server.registerTool(
    'get_user_profile',
    {
      description: 'Get the current X user profile raw payload by screen name.',
      inputSchema: getUserProfileInputSchema,
    },
    async (input) => {
      const meta = buildMeta();

      try {
        const profile = await deps.xApiAdapter.getUserProfile(
          input.screenName,
          input.instanceId,
          input.timeoutMs,
        );

        deps.logger.info('get_user_profile succeeded', {
          screenName: input.screenName,
          instanceId: input.instanceId ?? null,
        });

        return successResult(
          {
            screenName: input.screenName,
            raw: profile,
          },
          meta,
        );
      } catch (error) {
        const mapped = mapError(error);

        deps.logger.error('get_user_profile failed', {
          code: mapped.code,
          message: mapped.message,
          screenName: input.screenName,
          instanceId: input.instanceId ?? null,
        });

        return errorResult(mapped, meta);
      }
    },
  );
}
