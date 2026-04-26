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
    if (request.url !== '/api/v1/x/timeline') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end('{"error":"not_found"}');
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        instructions: [
          {
            type: 'TimelineAddEntries',
            entries: [
              {
                entryId: 'tweet-1',
                content: {
                  itemContent: {
                    tweet_results: {
                      result: {
                        rest_id: '111',
                        legacy: {
                          full_text: 'Hello from timeline',
                          user_id_str: '42',
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        ],
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
    enabledTools: ['get_home_timeline'],
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
    const tool = toolsResult.tools.find((item) => item.name === 'get_home_timeline');
    assert(tool, 'Expected tool get_home_timeline to be registered.');

    const callResult = await client.callTool({
      name: 'get_home_timeline',
      arguments: {},
    });

    assert(!callResult.isError, 'Expected get_home_timeline tool call to succeed.');
    assert(
      callResult.structuredContent !== undefined,
      'Expected structuredContent in get_home_timeline result.',
    );

    const payload = callResult.structuredContent as {
      success?: boolean;
      data?: {
        raw?: {
          instructions?: Array<{
            entries?: unknown[];
          }>;
        } | null;
      } | null;
    };

    assert(payload.success === true, 'Expected structuredContent.success to be true.');
    assert(payload.data !== null && payload.data !== undefined, 'Expected data payload.');
    assert(payload.data.raw !== null && payload.data.raw !== undefined, 'Expected raw payload.');
    assert(Array.isArray(payload.data.raw.instructions), 'Expected raw.instructions to be an array.');
    assert(payload.data.raw.instructions.length === 1, 'Unexpected instructions length.');
    assert(
      Array.isArray(payload.data.raw.instructions[0]?.entries),
      'Expected first instruction entries to be an array.',
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          tool: 'get_home_timeline',
          instructionCount: payload.data.raw.instructions.length,
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
  console.error('[E2E] MCP get_home_timeline validation failed');
  console.error(error);
  process.exit(1);
});
