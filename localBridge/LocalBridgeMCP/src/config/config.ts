import fs from 'node:fs';
import path from 'node:path';
import { defaultConfig } from './defaults.js';
import type { LocalBridgeMcpConfig } from './types.js';

const DEFAULT_CONFIG_FILE = 'localbridge-mcp.config.json';

export function loadConfig(configPath?: string): LocalBridgeMcpConfig {
  const resolvedPath = configPath ?? path.resolve(process.cwd(), DEFAULT_CONFIG_FILE);

  let fileConfig: Partial<LocalBridgeMcpConfig> = {};

  if (fs.existsSync(resolvedPath)) {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    fileConfig = JSON.parse(raw) as Partial<LocalBridgeMcpConfig>;
  }

  const config: LocalBridgeMcpConfig = {
    ...defaultConfig,
    ...fileConfig,
  };

  validateConfig(config);
  return config;
}

function validateConfig(config: LocalBridgeMcpConfig): void {
  if (!config.localbridgeBaseUrl) {
    throw new Error('localbridgeBaseUrl is required');
  }

  if (config.requestTimeoutMs <= 0) {
    throw new Error('requestTimeoutMs must be greater than 0');
  }

  if (config.enabledTools !== null && !Array.isArray(config.enabledTools)) {
    throw new Error('enabledTools must be an array or null');
  }
}
