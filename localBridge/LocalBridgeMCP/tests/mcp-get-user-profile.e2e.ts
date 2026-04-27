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
    if (request.url !== '/api/v1/x/users?screenName=test_user') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end('{"error":"not_found"}');
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        data: {
          user: {
            result: {
              rest_id: '42',
              legacy: {
                screen_name: 'test_user',
                name: 'Test User',
                description: 'Testing profile',
                followers_count: 123,
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
    enabledTools: ['get_user_profile'],
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
    const tool = toolsResult.tools.find((item) => item.name === 'get_user_profile');
    assert(tool, 'Expected tool get_user_profile to be registered.');

    const callResult = await client.callTool({
      name: 'get_user_profile',
      arguments: {
        screenName: 'test_user',
      },
    });

    assert(!callResult.isError, 'Expected get_user_profile tool call to succeed.');
    assert(
      callResult.structuredContent !== undefined,
      'Expected structuredContent in get_user_profile result.',
    );

    const payload = callResult.structuredContent as {
      success?: boolean;
      data?: {
        screenName?: string;
        raw?: {
          data?: {
            user?: {
              result?: {
                rest_id?: string;
                legacy?: {
                  screen_name?: string;
                  name?: string;
                  description?: string;
                  followers_count?: number;
                };
              };
            };
          };
        } | null;
      } | null;
    };

    assert(payload.success === true, 'Expected structuredContent.success to be true.');
    assert(payload.data !== null && payload.data !== undefined, 'Expected data payload.');
    assert(payload.data.screenName === 'test_user', 'Unexpected screenName.');
    assert(payload.data.raw !== null && payload.data.raw !== undefined, 'Expected raw payload.');
    assert(payload.data.raw.data?.user?.result?.rest_id === '42', 'Unexpected user rest_id.');
    assert(
      payload.data.raw.data?.user?.result?.legacy?.screen_name === 'test_user',
      'Unexpected user screen_name.',
    );
    assert(
      payload.data.raw.data?.user?.result?.legacy?.name === 'Test User',
      'Unexpected user name.',
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          tool: 'get_user_profile',
          screenName: payload.data.screenName,
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
  console.error('[E2E] MCP get_user_profile validation failed');
  console.error(error);
  process.exit(1);
});
