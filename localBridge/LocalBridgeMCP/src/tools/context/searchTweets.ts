import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppDeps } from '../../server/createServer.js';
import { mapError } from '../../errors/mapError.js';
import { searchTweetsInputSchema } from '../../schemas/contextSchemas.js';
import { buildMeta } from '../../utils/buildMeta.js';
import { errorResult, successResult } from '../../utils/toolResult.js';

function extractTweetCount(raw: unknown): number | null {
  const instructions =
    typeof raw === 'object' &&
    raw !== null &&
    'data' in raw &&
    typeof raw.data === 'object' &&
    raw.data !== null &&
    'data' in raw.data &&
    typeof raw.data.data === 'object' &&
    raw.data.data !== null &&
    'search_by_raw_query' in raw.data.data &&
    typeof raw.data.data.search_by_raw_query === 'object' &&
    raw.data.data.search_by_raw_query !== null &&
    'search_timeline' in raw.data.data.search_by_raw_query &&
    typeof raw.data.data.search_by_raw_query.search_timeline === 'object' &&
    raw.data.data.search_by_raw_query.search_timeline !== null &&
    'timeline' in raw.data.data.search_by_raw_query.search_timeline &&
    typeof raw.data.data.search_by_raw_query.search_timeline.timeline === 'object' &&
    raw.data.data.search_by_raw_query.search_timeline.timeline !== null &&
    'instructions' in raw.data.data.search_by_raw_query.search_timeline.timeline
      ? raw.data.data.search_by_raw_query.search_timeline.timeline.instructions
      : null;

  if (!Array.isArray(instructions)) {
    return null;
  }

  return instructions
    .flatMap((instruction) => {
      if (
        typeof instruction !== 'object' ||
        instruction === null ||
        !('entries' in instruction) ||
        !Array.isArray(instruction.entries)
      ) {
        return [];
      }

      return instruction.entries;
    })
    .filter((entry) => {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        !('content' in entry) ||
        typeof entry.content !== 'object' ||
        entry.content === null ||
        !('itemContent' in entry.content) ||
        typeof entry.content.itemContent !== 'object' ||
        entry.content.itemContent === null ||
        !('tweet_results' in entry.content.itemContent) ||
        typeof entry.content.itemContent.tweet_results !== 'object' ||
        entry.content.itemContent.tweet_results === null ||
        !('result' in entry.content.itemContent.tweet_results) ||
        typeof entry.content.itemContent.tweet_results.result !== 'object' ||
        entry.content.itemContent.tweet_results.result === null ||
        !('rest_id' in entry.content.itemContent.tweet_results.result)
      ) {
        return false;
      }

      const { rest_id: restId } = entry.content.itemContent.tweet_results.result as {
        rest_id?: unknown;
      };
      return typeof restId === 'string' && restId.length > 0;
    }).length;
}

function extractNextCursor(raw: unknown): string | null {
  const candidate =
    typeof raw === 'object' &&
    raw !== null &&
    'data' in raw &&
    typeof raw.data === 'object' &&
    raw.data !== null &&
    'data' in raw.data &&
    typeof raw.data.data === 'object' &&
    raw.data.data !== null &&
    'search_by_raw_query' in raw.data.data &&
    typeof raw.data.data.search_by_raw_query === 'object' &&
    raw.data.data.search_by_raw_query !== null &&
    'search_timeline' in raw.data.data.search_by_raw_query &&
    typeof raw.data.data.search_by_raw_query.search_timeline === 'object' &&
    raw.data.data.search_by_raw_query.search_timeline !== null &&
    'timeline' in raw.data.data.search_by_raw_query.search_timeline &&
    typeof raw.data.data.search_by_raw_query.search_timeline.timeline === 'object' &&
    raw.data.data.search_by_raw_query.search_timeline.timeline !== null &&
    'metadata' in raw.data.data.search_by_raw_query.search_timeline.timeline &&
    typeof raw.data.data.search_by_raw_query.search_timeline.timeline.metadata === 'object' &&
    raw.data.data.search_by_raw_query.search_timeline.timeline.metadata !== null &&
    'cursor' in raw.data.data.search_by_raw_query.search_timeline.timeline.metadata
      ? raw.data.data.search_by_raw_query.search_timeline.timeline.metadata.cursor
      : null;

  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
}

export function registerSearchTweetsTool(server: McpServer, deps: AppDeps): void {
  server.registerTool(
    'search_tweets',
    {
      description: 'Search X tweets by query, with optional count, cursor, instance, and tab routing.',
      inputSchema: searchTweetsInputSchema,
    },
    async (input) => {
      const meta = buildMeta({
        instanceId: input.instanceId ?? null,
        tabId: input.tabId !== undefined ? String(input.tabId) : null,
      });

      try {
        const result = await deps.xApiAdapter.searchTweets(
          input.query,
          input.count,
          input.cursor,
          input.instanceId,
          input.tabId,
          input.timeoutMs,
        );

        deps.logger.info('search_tweets succeeded', {
          query: input.query,
          count: input.count ?? null,
          hasCursor: input.cursor !== undefined,
          instanceId: input.instanceId ?? null,
          tabId: input.tabId ?? null,
        });

        return successResult(
          {
            raw: result,
            summary: {
              query: input.query,
              tweetCount: extractTweetCount(result),
              nextCursor: extractNextCursor(result),
            },
          },
          meta,
        );
      } catch (error) {
        const mapped = mapError(error);

        deps.logger.error('search_tweets failed', {
          code: mapped.code,
          message: mapped.message,
          query: input.query,
          count: input.count ?? null,
          hasCursor: input.cursor !== undefined,
          instanceId: input.instanceId ?? null,
          tabId: input.tabId ?? null,
        });

        return errorResult(mapped, meta);
      }
    },
  );
}
