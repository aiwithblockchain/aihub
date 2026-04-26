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

  const upstreamServer = createServer((_request, response) => {
    setTimeout(() => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('[]');
    }, 500);
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
    enabledTools: ['list_x_instances'],
    readOnlyMode: false,
    defaultInstanceId: null,
    requestTimeoutMs: 100,
    debugLogging: true,
    exposeRawPayload: true,
  });

  const transport = createTransportWithCwd(tempConfigDir);
  pipeTransportStderr(transport);

  const client = createClient();

  try {
    await client.connect(transport);

    const callResult = await client.callTool({
      name: 'list_x_instances',
      arguments: {},
    });

    assert(callResult.isError === true, 'Expected tool call to fail on upstream timeout.');
    assert(
      callResult.structuredContent !== undefined,
      'Expected structuredContent in timeout tool result.',
    );

    const payload = callResult.structuredContent as {
      success?: boolean;
      error?: {
        code?: string;
        message?: string;
      } | null;
    };

    assert(payload.success === false, 'Expected structuredContent.success to be false.');
    assert(payload.error !== null && payload.error !== undefined, 'Expected timeout error payload.');
    assert(payload.error.code === 'TIMEOUT', `Unexpected error code: ${payload.error.code ?? 'undefined'}`);

    console.log(
      JSON.stringify(
        {
          ok: true,
          tool: 'list_x_instances',
          expectedFailure: true,
          errorCode: payload.error.code,
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
  console.error('[E2E] MCP timeout validation failed');
  console.error(error);
  process.exit(1);
});
