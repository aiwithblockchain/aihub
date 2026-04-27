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

  const instanceId = process.env.LOCALBRIDGE_TEST_INSTANCE_ID;
  assert(
    typeof instanceId === 'string' && instanceId.length > 0,
    'LOCALBRIDGE_TEST_INSTANCE_ID is required for real integration validation.',
  );

  const tempConfigDir = createTempConfigDir({
    localbridgeBaseUrl: 'http://127.0.0.1:10088',
    enabledTools: null,
    readOnlyMode: false,
    defaultInstanceId: instanceId,
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
    const toolNames = toolsResult.tools.map((tool) => tool.name);

    assert(toolNames.includes('list_x_instances'), 'Expected list_x_instances tool.');
    assert(toolNames.includes('get_x_status'), 'Expected get_x_status tool.');
    assert(toolNames.includes('get_x_basic_info'), 'Expected get_x_basic_info tool.');
    assert(toolNames.includes('get_home_timeline'), 'Expected get_home_timeline tool.');
    assert(toolNames.includes('get_tweet'), 'Expected get_tweet tool.');
    assert(toolNames.includes('get_tweet_replies'), 'Expected get_tweet_replies tool.');
    assert(toolNames.includes('get_user_profile'), 'Expected get_user_profile tool.');

    const listInstances = await client.callTool({
      name: 'list_x_instances',
      arguments: {},
    });
    assert(!listInstances.isError, 'Expected list_x_instances to succeed.');

    const listPayload = listInstances.structuredContent as {
      success?: boolean;
      data?: {
        instances?: Array<{
          instanceId?: string;
        }>;
      } | null;
    };
    assert(listPayload.success === true, 'Expected list_x_instances success.');
    assert(Array.isArray(listPayload.data?.instances), 'Expected instances array.');
    assert(
      listPayload.data.instances.some((item) => item.instanceId === instanceId),
      'Expected configured instanceId to exist in list_x_instances result.',
    );

    const statusResult = await client.callTool({
      name: 'get_x_status',
      arguments: {
        instanceId,
      },
    });
    assert(!statusResult.isError, 'Expected get_x_status to succeed.');
    const statusPayload = statusResult.structuredContent as {
      success?: boolean;
      data?: {
        hasXTabs?: boolean;
        tabs?: unknown[];
      } | null;
    };
    assert(statusPayload.success === true, 'Expected get_x_status success.');
    assert(statusPayload.data !== null && statusPayload.data !== undefined, 'Expected status data.');
    assert(statusPayload.data.hasXTabs === true, 'Expected hasXTabs to be true.');
    assert(Array.isArray(statusPayload.data.tabs), 'Expected tabs array.');

    const basicInfoResult = await client.callTool({
      name: 'get_x_basic_info',
      arguments: {
        instanceId,
      },
    });
    assert(!basicInfoResult.isError, 'Expected get_x_basic_info to succeed.');
    const basicInfoPayload = basicInfoResult.structuredContent as {
      success?: boolean;
      data?: {
        raw?: {
          data?: {
            user?: {
              result?: {
                rest_id?: string;
                core?: {
                  screen_name?: string;
                };
                legacy?: {
                  screen_name?: string;
                };
              };
            };
          };
        } | null;
      } | null;
    };
    assert(basicInfoPayload.success === true, 'Expected get_x_basic_info success.');
    assert(
      basicInfoPayload.data?.raw?.data?.user?.result?.rest_id !== undefined,
      'Expected basic info raw payload to contain user rest_id.',
    );

    const timelineResult = await client.callTool({
      name: 'get_home_timeline',
      arguments: {
        instanceId,
      },
    });
    assert(!timelineResult.isError, 'Expected get_home_timeline to succeed.');
    const timelinePayload = timelineResult.structuredContent as {
      success?: boolean;
      data?: {
        raw?: {
          success?: boolean;
          data?: {
            data?: {
              home?: {
                home_timeline_urt?: {
                  instructions?: unknown[];
                };
              };
            };
          };
        } | null;
      } | null;
    };
    assert(timelinePayload.success === true, 'Expected get_home_timeline success.');
    assert(
      Array.isArray(
        timelinePayload.data?.raw?.data?.data?.home?.home_timeline_urt?.instructions,
      ),
      'Expected timeline instructions array in raw payload.',
    );

    const resolvedScreenName =
      basicInfoPayload.data?.raw?.data?.user?.result?.legacy?.screen_name ??
      basicInfoPayload.data?.raw?.data?.user?.result?.core?.screen_name;
    assert(
      typeof resolvedScreenName === 'string' && resolvedScreenName.length > 0,
      'Expected to resolve screen name from basic info raw payload.',
    );

    const userProfileResult = await client.callTool({
      name: 'get_user_profile',
      arguments: {
        screenName: resolvedScreenName,
        instanceId,
      },
    });
    assert(!userProfileResult.isError, 'Expected get_user_profile to succeed.');
    const userProfilePayload = userProfileResult.structuredContent as {
      success?: boolean;
      data?: {
        screenName?: string;
        raw?: {
          success?: boolean;
          data?: {
            data?: {
              user?: {
                result?: {
                  rest_id?: string;
                };
              };
            };
          };
        } | null;
      } | null;
    };
    assert(userProfilePayload.success === true, 'Expected get_user_profile success.');
    assert(
      userProfilePayload.data?.screenName === resolvedScreenName,
      'Expected returned screenName to match queried screenName.',
    );
    assert(
      userProfilePayload.data?.raw?.data?.data?.user?.result?.rest_id !== undefined,
      'Expected user profile raw payload to contain user rest_id.',
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: 'real-localbridge-integration',
          instanceId,
          screenName: resolvedScreenName,
          verifiedTools: [
            'list_x_instances',
            'get_x_status',
            'get_x_basic_info',
            'get_home_timeline',
            'get_user_profile',
          ],
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
  console.error('[E2E] MCP real LocalBridge integration validation failed');
  console.error(error);
  process.exit(1);
});
