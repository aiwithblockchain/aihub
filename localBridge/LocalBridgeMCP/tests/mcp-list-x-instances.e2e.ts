import {
  assert,
  createClient,
  createDefaultTransport,
  ensureBuiltServer,
  pipeTransportStderr,
} from './mcp-test-helpers.js';

async function main(): Promise<void> {
  ensureBuiltServer();

  const transport = createDefaultTransport();
  pipeTransportStderr(transport);

  const client = createClient();

  try {
    await client.connect(transport);

    const toolsResult = await client.listTools();
    const tool = toolsResult.tools.find((item) => item.name === 'list_x_instances');

    assert(tool, 'Expected tool list_x_instances to be registered.');

    const callResult = await client.callTool({
      name: 'list_x_instances',
      arguments: {},
    });

    assert(!callResult.isError, 'Tool call failed. Check LocalBridge availability and MCP logs.');
    assert(
      callResult.structuredContent !== undefined,
      'Expected structuredContent in tool result.',
    );

    const payload = callResult.structuredContent as {
      success?: boolean;
      data?: {
        instances?: unknown[];
      } | null;
    };

    assert(payload.success === true, 'Expected structuredContent.success to be true.');
    assert(payload.data !== null && payload.data !== undefined, 'Expected data payload.');
    assert(Array.isArray(payload.data.instances), 'Expected data.instances to be an array.');

    console.log(
      JSON.stringify(
        {
          ok: true,
          tool: 'list_x_instances',
          instanceCount: payload.data.instances.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('[E2E] MCP list_x_instances validation failed');
  console.error(error);
  process.exit(1);
});
