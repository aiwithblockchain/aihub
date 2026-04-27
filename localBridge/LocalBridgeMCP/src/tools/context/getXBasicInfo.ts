import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppDeps } from '../../server/createServer.js';
import { mapError } from '../../errors/mapError.js';
import { getXBasicInfoInputSchema } from '../../schemas/contextSchemas.js';
import { buildMeta } from '../../utils/buildMeta.js';
import { errorResult, successResult } from '../../utils/toolResult.js';

export function registerGetXBasicInfoTool(
  server: McpServer,
  deps: AppDeps,
): void {
  server.registerTool(
    'get_x_basic_info',
    {
      description:
        'Get the current logged-in X account basic profile information.',
      inputSchema: getXBasicInfoInputSchema,
    },
    async (input) => {
      const meta = buildMeta();

      try {
        const basicInfo = await deps.xApiAdapter.getBasicInfo(input.instanceId, input.timeoutMs);

        deps.logger.info('get_x_basic_info succeeded', {
          isLoggedIn: basicInfo.isLoggedIn,
          screenName: basicInfo.screenName ?? null,
          instanceId: input.instanceId ?? null,
        });

        return successResult(
          {
            ...basicInfo,
            raw: basicInfo.raw ?? basicInfo,
          },
          meta,
        );
      } catch (error) {
        const mapped = mapError(error);

        deps.logger.error('get_x_basic_info failed', {
          code: mapped.code,
          message: mapped.message,
          instanceId: input.instanceId ?? null,
        });

        return errorResult(mapped, meta);
      }
    },
  );
}
