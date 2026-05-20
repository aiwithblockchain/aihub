import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppDeps } from '../../server/createServer.js';
import { mapError } from '../../errors/mapError.js';
import { getTweetRepliesInputSchema } from '../../schemas/contextSchemas.js';
import { buildMeta } from '../../utils/buildMeta.js';
import { errorResult, successResult } from '../../utils/toolResult.js';

export function registerGetTweetRepliesTool(
  server: McpServer,
  deps: AppDeps,
): void {
  server.registerTool(
    'get_tweet_replies',
    {
      description:
        'Get the current X tweet replies raw payload by tweet ID, with optional cursor pagination.',
      inputSchema: getTweetRepliesInputSchema,
    },
    async (input) => {
      const meta = buildMeta();

      try {
        const replies = await deps.xApiAdapter.getTweetReplies(
          input.tweetId,
          input.cursor,
          input.instanceId,
          input.timeoutMs,
        );

        deps.logger.info('get_tweet_replies succeeded', {
          tweetId: input.tweetId,
          hasCursor: input.cursor !== undefined,
          instanceId: input.instanceId ?? null,
        });

        return successResult(
          {
            tweetId: input.tweetId,
            cursor: input.cursor ?? null,
            raw: replies,
          },
          meta,
        );
      } catch (error) {
        const mapped = mapError(error);

        deps.logger.error('get_tweet_replies failed', {
          code: mapped.code,
          message: mapped.message,
          tweetId: input.tweetId,
          hasCursor: input.cursor !== undefined,
          instanceId: input.instanceId ?? null,
        });

        return errorResult(mapped, meta);
      }
    },
  );
}
