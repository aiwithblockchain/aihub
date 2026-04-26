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

    assert(Array.isArray(toolsResult.tools), 'Expected tools array from MCP server.');
    assert(toolsResult.tools.length > 0, 'Expected at least one registered MCP tool.');

    const listXInstancesTool = toolsResult.tools.find(
      (tool) => tool.name === 'list_x_instances',
    );
    const getXStatusTool = toolsResult.tools.find((tool) => tool.name === 'get_x_status');
    const getXBasicInfoTool = toolsResult.tools.find(
      (tool) => tool.name === 'get_x_basic_info',
    );
    const getHomeTimelineTool = toolsResult.tools.find(
      (tool) => tool.name === 'get_home_timeline',
    );
    const getTweetTool = toolsResult.tools.find((tool) => tool.name === 'get_tweet');

    assert(listXInstancesTool, 'Expected list_x_instances in tools/list response.');
    assert(
      listXInstancesTool.description ===
        'List all currently connected tweetClaw X instances available through LocalBridge.',
      'Unexpected description for list_x_instances.',
    );

    assert(getXStatusTool, 'Expected get_x_status in tools/list response.');
    assert(
      getXStatusTool.description ===
        'Get the current X browser status, including tabs, active page, and login state.',
      'Unexpected description for get_x_status.',
    );

    assert(getXBasicInfoTool, 'Expected get_x_basic_info in tools/list response.');
    assert(
      getXBasicInfoTool.description ===
        'Get the current logged-in X account basic profile information.',
      'Unexpected description for get_x_basic_info.',
    );

    assert(getHomeTimelineTool, 'Expected get_home_timeline in tools/list response.');
    assert(
      getHomeTimelineTool.description === 'Get the current X home timeline raw payload.',
      'Unexpected description for get_home_timeline.',
    );

    assert(getTweetTool, 'Expected get_tweet in tools/list response.');
    assert(
      getTweetTool.description === 'Get the current X tweet detail raw payload by tweet ID.',
      'Unexpected description for get_tweet.',
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          toolCount: toolsResult.tools.length,
          toolNames: toolsResult.tools.map((tool) => tool.name),
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
  console.error('[E2E] MCP tools/list validation failed');
  console.error(error);
  process.exit(1);
});
