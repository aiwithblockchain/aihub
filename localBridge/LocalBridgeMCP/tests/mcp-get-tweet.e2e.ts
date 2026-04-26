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
    if (request.url !== '/api/v1/x/tweets/111') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end('{"error":"not_found"}');
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        data: {
          tweetResult: {
            result: {
              rest_id: '111',
              legacy: {
                full_text: 'Hello from tweet detail',
                favorite_count: 7,
              },
              core: {
                user_results: {
                  result: {
                    rest_id: '42',
                    legacy: {
                      screen_name: 'test_user',
                    },
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
    enabledTools: ['get_tweet'],
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
    const tool = toolsResult.tools.find((item) => item.name === 'get_tweet');
    assert(tool, 'Expected tool get_tweet to be registered.');

    const callResult = await client.callTool({
      name: 'get_tweet',
      arguments: {
        tweetId: '111',
      },
    });

    assert(!callResult.isError, 'Expected get_tweet tool call to succeed.');
    assert(
      callResult.structuredContent !== undefined,
      'Expected structuredContent in get_tweet result.',
    );

    const payload = callResult.structuredContent as {
      success?: boolean;
      data?: {
        tweetId?: string;
        raw?: {
          data?: {
            tweetResult?: {
              result?: {
                rest_id?: string;
                legacy?: {
                  full_text?: string;
                };
              };
            };
          };
        } | null;
      } | null;
    };

    assert(payload.success === true, 'Expected structuredContent.success to be true.');
    assert(payload.data !== null && payload.data !== undefined, 'Expected data payload.');
    assert(payload.data.tweetId === '111', 'Unexpected tweetId.');
    assert(payload.data.raw !== null && payload.data.raw !== undefined, 'Expected raw payload.');
    assert(
      payload.data.raw.data?.tweetResult?.result?.rest_id === '111',
      'Unexpected tweet rest_id.',
    );
    assert(
      payload.data.raw.data?.tweetResult?.result?.legacy?.full_text ===
        'Hello from tweet detail',
      'Unexpected tweet full_text.',
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          tool: 'get_tweet',
          tweetId: payload.data.tweetId,
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
  console.error('[E2E] MCP get_tweet validation failed');
  console.error(error);
  process.exit(1);
});
