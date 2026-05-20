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
    if (request.url !== '/api/v1/x/basic_info?instanceId=test-instance') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end('{"error":"not_found"}');
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        isLoggedIn: true,
        name: 'Test User',
        screenName: 'test_user',
        twitterId: '1234567890',
        verified: false,
        followersCount: 5,
        friendsCount: 12,
        statusesCount: 34,
        avatar: 'https://example.com/avatar.jpg',
        description: 'Test profile',
        createdAt: '2025-01-01T00:00:00Z',
        raw: {
          profile: {
            id: '1234567890',
          },
        },
        updatedAt: 1735689600000,
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
    enabledTools: ['get_x_basic_info'],
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
    const tool = toolsResult.tools.find((item) => item.name === 'get_x_basic_info');
    assert(tool, 'Expected tool get_x_basic_info to be registered.');

    const callResult = await client.callTool({
      name: 'get_x_basic_info',
      arguments: {
        instanceId: 'test-instance',
      },
    });

    assert(!callResult.isError, 'Expected get_x_basic_info tool call to succeed.');
    assert(
      callResult.structuredContent !== undefined,
      'Expected structuredContent in get_x_basic_info result.',
    );

    const payload = callResult.structuredContent as {
      success?: boolean;
      data?: {
        isLoggedIn?: boolean;
        name?: string | null;
        screenName?: string | null;
        twitterId?: string | null;
        verified?: boolean | null;
        followersCount?: number | null;
        friendsCount?: number | null;
        statusesCount?: number | null;
        raw?: unknown;
      } | null;
    };

    assert(payload.success === true, 'Expected structuredContent.success to be true.');
    assert(payload.data !== null && payload.data !== undefined, 'Expected data payload.');
    assert(payload.data.isLoggedIn === true, 'Expected isLoggedIn to be true.');
    assert(payload.data.name === 'Test User', 'Unexpected name.');
    assert(payload.data.screenName === 'test_user', 'Unexpected screenName.');
    assert(payload.data.twitterId === '1234567890', 'Unexpected twitterId.');
    assert(payload.data.verified === false, 'Unexpected verified flag.');
    assert(payload.data.followersCount === 5, 'Unexpected followersCount.');
    assert(payload.data.friendsCount === 12, 'Unexpected friendsCount.');
    assert(payload.data.statusesCount === 34, 'Unexpected statusesCount.');
    assert(payload.data.raw !== undefined, 'Expected raw payload in get_x_basic_info result.');

    console.log(
      JSON.stringify(
        {
          ok: true,
          tool: 'get_x_basic_info',
          screenName: payload.data.screenName,
          isLoggedIn: payload.data.isLoggedIn,
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
  console.error('[E2E] MCP get_x_basic_info validation failed');
  console.error(error);
  process.exit(1);
});
