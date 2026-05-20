import { ErrorCodes } from '../errors/codes.js';
import { McpToolError } from '../errors/McpToolError.js';
import type { Logger } from '../logging/logger.js';

export interface LocalBridgeClientOptions {
  baseUrl: string;
  timeoutMs: number;
  logger: Logger;
}

export class LocalBridgeClient {
  constructor(private readonly options: LocalBridgeClientOptions) {}

  async get<T>(path: string, timeoutMs?: number): Promise<T> {
    const url = new URL(path, this.options.baseUrl).toString();
    const controller = new AbortController();
    const effectiveTimeoutMs = timeoutMs ?? this.options.timeoutMs;
    const timeoutHandle = setTimeout(() => controller.abort(), effectiveTimeoutMs);

    try {
      this.options.logger.debug('LocalBridge GET request', {
        url,
        timeoutMs: effectiveTimeoutMs,
      });

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new McpToolError({
          code: ErrorCodes.LOCALBRIDGE_NOT_READY,
          message: `LocalBridge request failed: ${response.status} ${response.statusText}`,
          details: {
            url,
            status: response.status,
            statusText: response.statusText,
          },
        });
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new McpToolError({
          code: ErrorCodes.TIMEOUT,
          message: 'LocalBridge request timed out.',
          details: {
            url,
            timeoutMs: effectiveTimeoutMs,
          },
        });
      }

      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
