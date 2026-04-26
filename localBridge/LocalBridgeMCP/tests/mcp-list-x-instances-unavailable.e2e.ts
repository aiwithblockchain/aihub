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

  const tempConfigDir = createTempConfigDir({
    localbridgeBaseUrl: 'http://127.0.0.1:1',
    enabledTools: ['list_x_instances'],
    readOnlyMode: false,
    defaultInstanceId: null,
    requestTimeoutMs: 1000,
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

    assert(callResult.isError === true, 'Expected tool call to fail when LocalBridge is unavailable.');
    assert(
      callResult.structuredContent !== undefined,
      'Expected structuredContent in failed tool result.',
    );

    const payload = callResult.structuredContent as {
      success?: boolean;
      error?: {
        code?: string;
      } | null;
    };

    assert(payload.success === false, 'Expected structuredContent.success to be false.');
    assert(payload.error !== null && payload.error !== undefined, 'Expected error payload.');
    assert(
      payload.error.code === 'UPSTREAM_EXECUTION_FAILED' ||
        payload.error.code === 'LOCALBRIDGE_NOT_READY',
      `Unexpected error code: ${payload.error.code ?? 'undefined'}`,
    );

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
    removeTempDir(tempConfigDir);
  }
}

main().catch((error) => {
  console.error('[E2E] MCP unavailable LocalBridge validation failed');
  console.error(error);
  process.exit(1);
});
