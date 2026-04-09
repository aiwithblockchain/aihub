import { InputMetadata, TaskInputReader } from './types';
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
  constructor(private config: DataFetcherConfig) {}

  createInputReader(taskId: string, metadata: InputMetadata): TaskInputReader {
    return new TaskInputReaderImpl(taskId, metadata, this.config);
  }
}
