import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config/config.js';
import { LocalBridgeClient } from './adapters/localBridgeClient.js';
import { XApiAdapter } from './adapters/xApiAdapter.js';
import { createLogger } from './logging/logger.js';
import { createServer } from './server/createServer.js';
import { registerTools } from './server/registerTools.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ debug: config.debugLogging });

  logger.info('Starting LocalBridgeMCP');

  const localBridgeClient = new LocalBridgeClient({
    baseUrl: config.localbridgeBaseUrl,
    timeoutMs: config.requestTimeoutMs,
    logger,
  });

  const xApiAdapter = new XApiAdapter({
    client: localBridgeClient,
    logger,
    config,
  });

  const deps = {
    config,
    logger,
    xApiAdapter,
  };

  const server = createServer(deps);
  registerTools(server, deps);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('LocalBridgeMCP initialized and connected over stdio');
}

main().catch((error) => {
  console.error('[LocalBridgeMCP] Failed to start', error);
  process.exit(1);
});
