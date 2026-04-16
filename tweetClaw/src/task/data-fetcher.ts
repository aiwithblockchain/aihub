import { InputMetadata, PreparedTaskInput, TaskInputReader } from './types';
import { BACKGROUND_TO_CONTENT_TRANSFER_CHUNK_BYTES } from './background-session-store';
import { logger } from './logger';

export interface DataFetcherConfig {
  baseUrl: string;
  clientName: string;
  instanceId: string;
  fetchTimeoutMs?: number;
}

export class TaskInputReaderImpl implements TaskInputReader {
  constructor(
    private taskId: string,
    private metadata: InputMetadata,
    private config: DataFetcherConfig
  ) {}

  getMetadata(): InputMetadata {
    return this.metadata;
  }

  async readPart(partIndex: number, retries = 3): Promise<Uint8Array> {
    if (partIndex < 0 || partIndex >= this.metadata.totalParts) {
      throw new Error(`Invalid part index: ${partIndex}`);
    }

    let lastError: any;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutMs = this.config.fetchTimeoutMs || 30000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(
          `${this.config.baseUrl}/api/v1/tasks/${this.taskId}/input/${partIndex}`,
          {
            headers: {
              'X-Client-Name': this.config.clientName,
              'X-Instance-ID': this.config.instanceId
            },
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to fetch part ${partIndex}: ${response.status}`);
        }

        return new Uint8Array(await response.arrayBuffer());
      } catch (error) {
        lastError = error;
        logger.warn(`Fetch part ${partIndex} failed on attempt ${attempt + 1}/${retries}: ${error}`);
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
    logger.error(`Failed to fetch part ${partIndex} after ${retries} attempts`);
    throw lastError;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
    let downloadedBytes = 0;
    for (let i = 0; i < this.metadata.totalParts; i++) {
      const part = await this.readPart(i);
      downloadedBytes += part.length;
      yield part;
    }
    if (this.metadata.totalBytes > 0 && downloadedBytes !== this.metadata.totalBytes) {
      throw new Error(`Data integrity error: expected ${this.metadata.totalBytes} bytes but downloaded ${downloadedBytes}`);
    }
  }
}

export class DataFetcher {
  private config: DataFetcherConfig;

  constructor(config: DataFetcherConfig);
  constructor(baseUrl: string, clientName: string, instanceId: string, fetchTimeoutMs?: number);
  constructor(
    configOrBaseUrl: DataFetcherConfig | string,
    clientName?: string,
    instanceId?: string,
    fetchTimeoutMs?: number
  ) {
    if (typeof configOrBaseUrl === 'string') {
      this.config = {
        baseUrl: configOrBaseUrl,
        clientName: clientName || '',
        instanceId: instanceId || '',
        fetchTimeoutMs
      };
      return;
    }

    this.config = configOrBaseUrl;
  }

  createInputReader(taskId: string, metadata: InputMetadata): TaskInputReader {
    return new TaskInputReaderImpl(taskId, metadata, this.config);
  }

  async fetchAndChunkTaskInput(
    taskId: string,
    metadata: InputMetadata,
    onProgress?: (phase: string, progress: number) => void
  ): Promise<PreparedTaskInput> {
    const reader = this.createInputReader(taskId, metadata);
    const transferChunks: string[] = [];
    let buffered: Uint8Array<any> = new Uint8Array(0);
    let downloadedBytes = 0;

    for (let partIndex = 0; partIndex < metadata.totalParts; partIndex++) {
      const part = await reader.readPart(partIndex);
      downloadedBytes += part.length;
      buffered = concatUint8Arrays(buffered, part);

      while (buffered.length >= BACKGROUND_TO_CONTENT_TRANSFER_CHUNK_BYTES) {
        const chunk = buffered.slice(0, BACKGROUND_TO_CONTENT_TRANSFER_CHUNK_BYTES);
        transferChunks.push(uint8ArrayToBase64(chunk));
        buffered = buffered.slice(BACKGROUND_TO_CONTENT_TRANSFER_CHUNK_BYTES);
      }

      const progress = metadata.totalBytes > 0
        ? Math.min(downloadedBytes / metadata.totalBytes, 1)
        : Math.min((partIndex + 1) / Math.max(metadata.totalParts, 1), 1);
      onProgress?.('fetch_input', progress);
    }

    if (buffered.length > 0) {
      transferChunks.push(uint8ArrayToBase64(buffered));
    }

    if (metadata.totalBytes > 0 && downloadedBytes !== metadata.totalBytes) {
      throw new Error(`Data integrity error: expected ${metadata.totalBytes} bytes but downloaded ${downloadedBytes}`);
    }

    logger.info(`[DataFetcher] Prepared task input, taskId=${taskId}, totalBytes=${downloadedBytes}, transferChunkCount=${transferChunks.length}`);

    return {
      mimeType: metadata.contentType || 'application/octet-stream',
      totalBytes: downloadedBytes,
      transferChunks,
      transferChunkCount: transferChunks.length
    };
  }
}

function concatUint8Arrays(left: Uint8Array<any>, right: Uint8Array<any>): Uint8Array<any> {
  if (left.length === 0) {
    return new Uint8Array(right);
  }
  if (right.length === 0) {
    return new Uint8Array(left);
  }

  const combined = new Uint8Array(left.length + right.length);
  combined.set(left, 0);
  combined.set(right, left.length);
  return combined;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}
