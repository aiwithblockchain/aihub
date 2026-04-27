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
    if (request.url !== '/api/v1/x/tweets/111/replies?cursor=CURSOR_1') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end('{"error":"not_found"}');
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        data: {
          threaded_conversation_with_injections_v2: {
            instructions: [
              {
                type: 'TimelineAddEntries',
                entries: [
                  {
                    entryId: 'conversationthread-222',
                    content: {
                      itemContent: {
                        tweet_results: {
                          result: {
                            rest_id: '222',
                            legacy: {
                              full_text: 'First reply',
                            },
                          },
                        },
                      },
                    },
                  },
                  {
                    entryId: 'conversationthread-333',
                    content: {
                      items: [
                        {
                          item: {
                            itemContent: {
                              tweet_results: {
                                result: {
                                  rest_id: '333',
                                  legacy: {
                                    full_text: 'Nested reply',
                                  },
                                },
                              },
                            },
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            ],
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
    enabledTools: ['get_tweet_replies'],
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
    const tool = toolsResult.tools.find((item) => item.name === 'get_tweet_replies');
    assert(tool, 'Expected tool get_tweet_replies to be registered.');

    const callResult = await client.callTool({
      name: 'get_tweet_replies',
      arguments: {
        tweetId: '111',
        cursor: 'CURSOR_1',
      },
    });

    assert(!callResult.isError, 'Expected get_tweet_replies tool call to succeed.');
    assert(
      callResult.structuredContent !== undefined,
      'Expected structuredContent in get_tweet_replies result.',
    );

    const payload = callResult.structuredContent as {
      success?: boolean;
      data?: {
        tweetId?: string;
        cursor?: string | null;
        raw?: {
          data?: {
            threaded_conversation_with_injections_v2?: {
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
                    items?: Array<{
                      item?: {
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
                  };
                }>;
              }>;
            };
          };
        } | null;
      } | null;
    };

    assert(payload.success === true, 'Expected structuredContent.success to be true.');
    assert(payload.data !== null && payload.data !== undefined, 'Expected data payload.');
    assert(payload.data.tweetId === '111', 'Unexpected tweetId.');
    assert(payload.data.cursor === 'CURSOR_1', 'Unexpected cursor.');
    assert(payload.data.raw !== null && payload.data.raw !== undefined, 'Expected raw payload.');

    const instructions = payload.data.raw.data?.threaded_conversation_with_injections_v2?.instructions;
    assert(Array.isArray(instructions), 'Expected instructions array.');
    assert(instructions.length === 1, 'Unexpected instructions length.');

    const entries = instructions[0]?.entries;
    assert(Array.isArray(entries), 'Expected entries array.');
    assert(entries.length === 2, 'Unexpected entries length.');
    assert(
      entries[0]?.content?.itemContent?.tweet_results?.result?.rest_id === '222',
      'Unexpected direct reply rest_id.',
    );
    assert(
      entries[0]?.content?.itemContent?.tweet_results?.result?.legacy?.full_text === 'First reply',
      'Unexpected direct reply full_text.',
    );
    assert(
      entries[1]?.content?.items?.[0]?.item?.itemContent?.tweet_results?.result?.rest_id === '333',
      'Unexpected nested reply rest_id.',
    );
    assert(
      entries[1]?.content?.items?.[0]?.item?.itemContent?.tweet_results?.result?.legacy?.full_text ===
        'Nested reply',
      'Unexpected nested reply full_text.',
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          tool: 'get_tweet_replies',
          tweetId: payload.data.tweetId,
          cursor: payload.data.cursor,
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
  console.error('[E2E] MCP get_tweet_replies validation failed');
  console.error(error);
  process.exit(1);
});
