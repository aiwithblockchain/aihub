import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppDeps } from '../../server/createServer.js';
import { mapError } from '../../errors/mapError.js';
import { getTweetInputSchema } from '../../schemas/contextSchemas.js';
import { buildMeta } from '../../utils/buildMeta.js';
import { errorResult, successResult } from '../../utils/toolResult.js';

export function registerGetTweetTool(server: McpServer, deps: AppDeps): void {
  server.registerTool(
    'get_tweet',
    {
      description: 'Get the current X tweet detail raw payload by tweet ID.',
      inputSchema: getTweetInputSchema,
    },
    async (input) => {
      const meta = buildMeta();

      try {
        const tweet = await deps.xApiAdapter.getTweet(
          input.tweetId,
          input.instanceId,
          input.timeoutMs,
        );

        deps.logger.info('get_tweet succeeded', {
          tweetId: input.tweetId,
          instanceId: input.instanceId ?? null,
        });

        return successResult(
          {
            tweetId: input.tweetId,
            raw: tweet,
          },
          meta,
        );
      } catch (error) {
        const mapped = mapError(error);

        deps.logger.error('get_tweet failed', {
          code: mapped.code,
          message: mapped.message,
          tweetId: input.tweetId,
          instanceId: input.instanceId ?? null,
        });

        return errorResult(mapped, meta);
      }
    },
  );
}
