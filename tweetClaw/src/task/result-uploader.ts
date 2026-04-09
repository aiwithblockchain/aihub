import { logger } from './logger';

export interface TaskExecutorConfig {
  localBridgeBaseUrl: string;
  clientName: string;
  instanceId: string;
  uploadTimeoutMs?: number;
  fetchTimeoutMs?: number;
}

export interface ResultUploader {
  uploadResult(taskId: string, contentType: string, data: Uint8Array): Promise<string>;
}

export class ResultUploaderImpl implements ResultUploader {
  constructor(private config: TaskExecutorConfig) {}

  async uploadResult(taskId: string, contentType: string, data: Uint8Array, retries = 3): Promise<string> {
    let lastError: any;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutMs = this.config.uploadTimeoutMs || 60000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(
          `${this.config.localBridgeBaseUrl}/api/v1/tasks/${taskId}/result`,
          {
            method: 'POST',
            headers: {
              'Content-Type': contentType,
              'X-Client-Name': this.config.clientName,
              'X-Instance-ID': this.config.instanceId
            },
            body: data,
            signal: controller.signal
          }
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status} - ${await response.text().catch(()=>'')}`);
        }

        const result = await response.json();
        return result.resultRef;
      } catch (error) {
        lastError = error;
        logger.warn(`Upload result failed on attempt ${attempt + 1}/${retries} for task ${taskId}: ${error}`);
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
    logger.error(`Failed to upload result for task ${taskId} after ${retries} attempts`);
    throw lastError;
  }
}
