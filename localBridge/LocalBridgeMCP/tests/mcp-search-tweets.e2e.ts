import { createServer } from 'node:http';
import {
  assert,
  createClient,
  createTempConfigDir,
  createTransportWithCwd,
  ensureBuiltServer,
  pipeTransportStderr,
  removeTempDir,
} from './mcp-test-helpers.js';

async function main(): Promise<void> {
  ensureBuiltServer();

  const upstreamServer = createServer((request, response) => {
    if (
      request.url !==
      '/api/v1/x/search?query=open+claw&count=2&cursor=CURSOR_1&instanceId=test-instance&tabId=321'
    ) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end('{"error":"not_found"}');
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        data: {
          data: {
            search_by_raw_query: {
              search_timeline: {
                timeline: {
                  instructions: [
                    {
                      type: 'TimelineAddEntries',
                      entries: [
                        {
                          entryId: 'tweet-111',
                          content: {
                            itemContent: {
                              tweet_results: {
                                result: {
                                  rest_id: '111',
                                  legacy: {
                                    full_text: 'First search result',
                                  },
                                },
                              },
                            },
                          },
                        },
                        {
                          entryId: 'tweet-222',
                          content: {
                            itemContent: {
                              tweet_results: {
                                result: {
                                  rest_id: '222',
                                  legacy: {
                                    full_text: 'Second search result',
                                  },
                                },
                              },
                            },
                          },
                        },
                      ],
                    },
                  ],
                  metadata: {
                    cursor: 'NEXT_CURSOR_2',
                  },
                },
              },
            },
          },
        },
      }),
    );
  });

  await new Promise<void>((resolve, reject) => {
    upstreamServer.once('error', reject);
    upstreamServer.listen(0, '127.0.0.1', () => resolve());
  });

  const address = upstreamServer.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Failed to determine temporary upstream server address.');
  }

  const tempConfigDir = createTempConfigDir({
    localbridgeBaseUrl: `http://127.0.0.1:${address.port}`,
    enabledTools: ['search_tweets'],
    readOnlyMode: false,
    defaultInstanceId: null,
    requestTimeoutMs: 30000,
    debugLogging: true,
    exposeRawPayload: true,
  });

  const transport = createTransportWithCwd(tempConfigDir);
  pipeTransportStderr(transport);

  const client = createClient();

  try {
    await client.connect(transport);

    const toolsResult = await client.listTools();
    const tool = toolsResult.tools.find((item) => item.name === 'search_tweets');
    assert(tool, 'Expected tool search_tweets to be registered.');

    const callResult = await client.callTool({
      name: 'search_tweets',
      arguments: {
        query: 'open claw',
        count: 2,
        cursor: 'CURSOR_1',
        instanceId: 'test-instance',
        tabId: 321,
      },
    });

    assert(!callResult.isError, 'Expected search_tweets tool call to succeed.');
    assert(
      callResult.structuredContent !== undefined,
      'Expected structuredContent in search_tweets result.',
    );

    const payload = callResult.structuredContent as {
      success?: boolean;
      data?: {
        raw?: {
          data?: {
            data?: {
              search_by_raw_query?: {
                search_timeline?: {
                  timeline?: {
                    instructions?: Array<{
                      entries?: Array<{
                        content?: {
                          itemContent?: {
                            tweet_results?: {
                              result?: {
                                rest_id?: string;
                                legacy?: {
                                  full_text?: string;
                                };
                              };
                            };
                          };
                        };
                      }>;
                    }>;
                    metadata?: {
                      cursor?: string;
                    };
                  };
                };
              };
            };
          };
        } | null;
        summary?: {
          query?: string;
          tweetCount?: number | null;
          nextCursor?: string | null;
        };
      } | null;
      meta?: {
        instanceId?: string | null;
        tabId?: string | null;
      };
    };

    assert(payload.success === true, 'Expected structuredContent.success to be true.');
    assert(payload.data !== null && payload.data !== undefined, 'Expected data payload.');
    assert(payload.data.raw !== null && payload.data.raw !== undefined, 'Expected raw payload.');
    assert(payload.data.summary?.query === 'open claw', 'Unexpected summary query.');
    assert(payload.data.summary?.tweetCount === 2, 'Unexpected summary tweetCount.');
    assert(payload.data.summary?.nextCursor === 'NEXT_CURSOR_2', 'Unexpected summary nextCursor.');
    assert(payload.meta?.instanceId === 'test-instance', 'Unexpected meta instanceId.');
    assert(payload.meta?.tabId === '321', 'Unexpected meta tabId.');

    const instructions =
      payload.data.raw.data?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions;
    assert(Array.isArray(instructions), 'Expected instructions array.');
    assert(instructions.length === 1, 'Unexpected instructions length.');

    const entries = instructions[0]?.entries;
    assert(Array.isArray(entries), 'Expected entries array.');
    assert(entries.length === 2, 'Unexpected entries length.');
    assert(
      entries[0]?.content?.itemContent?.tweet_results?.result?.rest_id === '111',
      'Unexpected first search result rest_id.',
    );
    assert(
      entries[1]?.content?.itemContent?.tweet_results?.result?.legacy?.full_text ===
        'Second search result',
      'Unexpected second search result full_text.',
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          tool: 'search_tweets',
          query: payload.data.summary?.query,
          tweetCount: payload.data.summary?.tweetCount,
          nextCursor: payload.data.summary?.nextCursor,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
    await new Promise<void>((resolve, reject) => {
      upstreamServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    removeTempDir(tempConfigDir);
  }
}

main().catch((error) => {
  console.error('[E2E] MCP search_tweets validation failed');
  console.error(error);
  process.exit(1);
});
