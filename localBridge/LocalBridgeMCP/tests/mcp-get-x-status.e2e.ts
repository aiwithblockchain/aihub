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
    if (request.url !== '/api/v1/x/status?instanceId=test-instance') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end('{"error":"not_found"}');
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        tabs: [
          {
            tabId: 123456789,
            url: 'https://x.com/home',
            active: true,
          },
        ],
        activeXUrl: 'https://x.com/home',
        hasXTabs: true,
        isLoggedIn: true,
        activeXTabId: 123456789,
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
    enabledTools: ['get_x_status'],
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
    const tool = toolsResult.tools.find((item) => item.name === 'get_x_status');
    assert(tool, 'Expected tool get_x_status to be registered.');

    const callResult = await client.callTool({
      name: 'get_x_status',
      arguments: {
        instanceId: 'test-instance',
      },
    });

    assert(!callResult.isError, 'Expected get_x_status tool call to succeed.');
    assert(
      callResult.structuredContent !== undefined,
      'Expected structuredContent in get_x_status result.',
    );

    const payload = callResult.structuredContent as {
      success?: boolean;
      data?: {
        tabs?: unknown[];
        hasXTabs?: boolean;
        isLoggedIn?: boolean;
        activeXUrl?: string | null;
        activeXTabId?: number | null;
        raw?: unknown;
      } | null;
    };

    assert(payload.success === true, 'Expected structuredContent.success to be true.');
    assert(payload.data !== null && payload.data !== undefined, 'Expected data payload.');
    assert(Array.isArray(payload.data.tabs), 'Expected data.tabs to be an array.');
    assert(payload.data.hasXTabs === true, 'Expected hasXTabs to be true.');
    assert(payload.data.isLoggedIn === true, 'Expected isLoggedIn to be true.');
    assert(payload.data.activeXUrl === 'https://x.com/home', 'Unexpected activeXUrl.');
    assert(payload.data.activeXTabId === 123456789, 'Unexpected activeXTabId.');
    assert(payload.data.raw !== undefined, 'Expected raw payload in get_x_status result.');

    console.log(
      JSON.stringify(
        {
          ok: true,
          tool: 'get_x_status',
          tabCount: payload.data.tabs.length,
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
  console.error('[E2E] MCP get_x_status validation failed');
  console.error(error);
  process.exit(1);
});
