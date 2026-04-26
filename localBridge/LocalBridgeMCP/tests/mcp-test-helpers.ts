import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const projectRoot = path.resolve(__dirname, '..');
export const serverEntry = path.join(projectRoot, 'dist', 'index.js');

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function ensureBuiltServer(): void {
  assert(
    existsSync(serverEntry),
    "dist/index.js not found. Run 'npm run build' before executing this test.",
  );
}

export function getSpawnEnv(): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  return env;
}

export function pipeTransportStderr(transport: StdioClientTransport): void {
  const stderrStream = transport.stderr;
  if (stderrStream !== null) {
    stderrStream.on('data', (chunk) => {
      process.stderr.write(chunk);
    });
  }
}

export function createClient(): Client {
  return new Client({
    name: 'localbridge-mcp-e2e-test-client',
    version: '0.1.0',
  });
}

export function createDefaultTransport(): StdioClientTransport {
  return new StdioClientTransport({
    command: 'node',
    args: [serverEntry],
    cwd: projectRoot,
    env: getSpawnEnv(),
    stderr: 'pipe',
  });
}

export function createTempConfigDir(config: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'localbridge-mcp-test-'));
  writeFileSync(
    path.join(dir, 'localbridge-mcp.config.json'),
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8',
  );
  return dir;
}

export function createTransportWithCwd(cwd: string): StdioClientTransport {
  return new StdioClientTransport({
    command: 'node',
    args: [serverEntry],
    cwd,
    env: getSpawnEnv(),
    stderr: 'pipe',
  });
}

export function removeTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
