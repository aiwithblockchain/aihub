import { TaskCancelledException, CancellationToken } from '../task/cancellation-token';
import { ErrorHandler } from '../task/error-handler';
import { logger } from '../task/logger';
import {
  StartTaskUploadFromBgSessionMessage,
  TaskCompletedFromContentMessage,
  TaskFailedFromContentMessage,
  TaskProgressFromContentMessage
} from '../task/types';
import { uint8ArrayToBase64 } from '../task/data-fetcher';
import { ContentUploadExecutor, DIRECT_UPLOAD_THRESHOLD_BYTES } from './content-upload-executor';
import { ContentUploadSessionStore } from './content-upload-session';

interface RunningContentTask {
  taskId: string;
  cancellationToken: CancellationToken;
  startedAt: number;
}

interface ContentTaskRunnerDeps {
  getUploadSessionChunk?: (uploadSessionId: string, chunkIndex: number) => Promise<Blob>;
  sendMessage?: (message: any) => Promise<any>;
  sleep?: (ms: number) => Promise<void>;
}

async function defaultGetUploadSessionChunk(uploadSessionId: string, chunkIndex: number): Promise<Blob> {
  const response = await chrome.runtime.sendMessage({
    type: 'GET_UPLOAD_SESSION_CHUNK',
    uploadSessionId,
    chunkIndex
  });

  if (!response?.success || !response.chunkData) {
    throw new Error(response?.error || `Failed to get upload session chunk ${chunkIndex}`);
  }

  // chunkData 是 number[]（JSON 序列化），需要重建 Uint8Array
  return new Blob([new Uint8Array(response.chunkData)], { type: response.mimeType });
}

async function defaultSendMessage(message: any): Promise<any> {
  return chrome.runtime.sendMessage(message);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toNumberOrDefault(value: unknown, defaultValue: number): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return normalized.includes('timeout')
    || normalized.includes('network')
    || normalized.includes('failed to get upload session chunk')
    || normalized.includes('receiving end does not exist')
    || normalized.includes('message port closed');
}

export class ContentTaskRunner {
  private runningTasks = new Map<string, RunningContentTask>();
  private getUploadSessionChunk: (uploadSessionId: string, chunkIndex: number) => Promise<Blob>;
  private sendMessage: (message: any) => Promise<any>;
  private sleep: (ms: number) => Promise<void>;

  constructor(
    private sessionStore = new ContentUploadSessionStore(),
    private uploadExecutor = new ContentUploadExecutor(),
    deps: ContentTaskRunnerDeps = {}
  ) {
    this.getUploadSessionChunk = deps.getUploadSessionChunk || defaultGetUploadSessionChunk;
    this.sendMessage = deps.sendMessage || defaultSendMessage;
    this.sleep = deps.sleep || defaultSleep;
  }

  startTaskFromBackground(message: StartTaskUploadFromBgSessionMessage): void {
    if (this.runningTasks.has(message.taskId)) {
      throw new Error(`Task is already running in content: ${message.taskId}`);
    }

    this.assertStartMessage(message);

    const runningTask: RunningContentTask = {
      taskId: message.taskId,
      cancellationToken: new CancellationToken(),
      startedAt: Date.now()
    };

    this.runningTasks.set(message.taskId, runningTask);
    void this.runTask(message, runningTask);
  }

  cancelTask(taskId: string): void {
    const task = this.runningTasks.get(taskId);
    if (!task) {
      return;
    }

    task.cancellationToken.cancel();
  }

  private async runTask(message: StartTaskUploadFromBgSessionMessage, task: RunningContentTask): Promise<void> {
    const startedAt = Date.now();

    try {
      logger.info(`[ContentTaskRunner] start streaming upload, taskId=${message.taskId}, totalBytes=${message.totalBytes}, chunkCount=${message.transferChunkCount}`);

      const callbacks = {
        onProgress: (phase: string, progress: number) => {
          this.reportProgress({
            type: 'TASK_PROGRESS_FROM_CONTENT',
            taskId: message.taskId,
            phase,
            progress
          });
        },
        checkCancellation: () => task.cancellationToken.check(),
        onChunkUploaded: (chunkIndex: number, releasedBytes: number) => {
          logger.debug(`[ContentTaskRunner] uploaded chunk, taskId=${message.taskId}, chunkIndex=${chunkIndex}, releasedBytes=${releasedBytes}`);
        }
      };

      const getChunk = async (chunkIndex: number): Promise<Blob> => {
        this.reportProgress({
          type: 'TASK_PROGRESS_FROM_CONTENT',
          taskId: message.taskId,
          phase: 'receiving_input',
          progress: 0.15 * ((chunkIndex + 1) / Math.max(message.transferChunkCount, 1))
        });
        return await this.fetchChunkWithRetry(message, chunkIndex, task.cancellationToken);
      };

      let resultData: Uint8Array;

      if (message.totalBytes <= DIRECT_UPLOAD_THRESHOLD_BYTES) {
        const session = this.sessionStore.createSession(
          message.taskId,
          message.mimeType,
          message.totalBytes,
          message.transferChunkCount
        );
        for (let chunkIndex = 0; chunkIndex < message.transferChunkCount; chunkIndex++) {
          task.cancellationToken.check();
          const chunkBlob = await getChunk(chunkIndex);
          this.sessionStore.appendChunk(message.taskId, chunkIndex, chunkBlob);
        }
        this.sessionStore.markReady(message.taskId);
        resultData = await this.uploadExecutor.executeDirectUpload(session, callbacks);
      } else {
        resultData = await this.uploadExecutor.executeStreaming(
          message.totalBytes,
          message.mimeType,
          message.transferChunkCount,
          message.taskId,
          message.params || {},
          callbacks,
          getChunk
        );
      }

      task.cancellationToken.check();

      const completedMessage: TaskCompletedFromContentMessage = {
        type: 'TASK_COMPLETED_FROM_CONTENT',
        taskId: message.taskId,
        contentType: 'application/json',
        resultBase64: uint8ArrayToBase64(resultData)
      };
      await this.sendMessageWithRetry(completedMessage, message, task.cancellationToken);
    } catch (error: any) {
      if (error instanceof TaskCancelledException) {
        await this.sendMessageWithRetry({
          type: 'TASK_CANCELLED_FROM_CONTENT',
          taskId: message.taskId
        }, message, task.cancellationToken, false).catch(reportError => {
          logger.warn(`[ContentTaskRunner] Failed to report cancellation, taskId=${message.taskId}: ${reportError}`);
        });
      } else {
        const taskError = ErrorHandler.handleError(error, 'content_execution');
        const failedMessage: TaskFailedFromContentMessage = {
          type: 'TASK_FAILED_FROM_CONTENT',
          taskId: message.taskId,
          phase: taskError.phase,
          errorCode: taskError.errorCode,
          errorMessage: taskError.errorMessage
        };
        await this.sendMessageWithRetry(failedMessage, message, task.cancellationToken, false).catch(reportError => {
          logger.warn(`[ContentTaskRunner] Failed to report failure, taskId=${message.taskId}: ${reportError}`);
        });
        logger.error(`[ContentTaskRunner] Task failed, taskId=${message.taskId}`, error);
      }
    } finally {
      this.sessionStore.release(message.taskId);
      this.runningTasks.delete(message.taskId);
      logger.info(`[ContentTaskRunner] Task finished, taskId=${message.taskId}, elapsedMs=${Date.now() - task.startedAt}`);
    }
  }

  private async fetchChunkWithRetry(
    message: StartTaskUploadFromBgSessionMessage,
    chunkIndex: number,
    cancellationToken: CancellationToken
  ): Promise<Blob> {
    const retryCount = toNumberOrDefault(message.params?.contentChunkRetryCount, 3);
    const retryDelayMs = toNumberOrDefault(message.params?.contentChunkRetryDelayMs, 500);

    let lastError: unknown;
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      cancellationToken.check();
      try {
        return await this.getUploadSessionChunk(message.uploadSessionId, chunkIndex);
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error) || attempt === retryCount) {
          break;
        }
        logger.warn(`[ContentTaskRunner] chunk fetch retry, taskId=${message.taskId}, chunkIndex=${chunkIndex}, attempt=${attempt}/${retryCount}, error=${error}`);
        await this.sleep(retryDelayMs * attempt);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async sendMessageWithRetry(
    runtimeMessage: any,
    message: StartTaskUploadFromBgSessionMessage,
    cancellationToken: CancellationToken,
    checkCancellation = true
  ): Promise<void> {
    const retryCount = toNumberOrDefault(message.params?.contentEventRetryCount, 3);
    const retryDelayMs = toNumberOrDefault(message.params?.contentEventRetryDelayMs, 300);

    let lastError: unknown;
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      if (checkCancellation) {
        cancellationToken.check();
      }
      try {
        await this.sendMessage(runtimeMessage);
        return;
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error) || attempt === retryCount) {
          break;
        }
        logger.warn(`[ContentTaskRunner] send message retry, taskId=${message.taskId}, type=${runtimeMessage.type}, attempt=${attempt}/${retryCount}, error=${error}`);
        await this.sleep(retryDelayMs * attempt);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private assertStartMessage(message: StartTaskUploadFromBgSessionMessage): void {
    if (!message.taskId) {
      throw new Error('taskId is required');
    }
    if (!message.uploadSessionId) {
      throw new Error('uploadSessionId is required');
    }
    if (!message.mimeType) {
      throw new Error('mimeType is required');
    }
    if (!Number.isFinite(message.totalBytes) || message.totalBytes <= 0) {
      throw new Error(`Invalid totalBytes: ${message.totalBytes}`);
    }
    if (!Number.isInteger(message.transferChunkCount) || message.transferChunkCount <= 0) {
      throw new Error(`Invalid transferChunkCount: ${message.transferChunkCount}`);
    }
  }

  private reportProgress(message: TaskProgressFromContentMessage): void {
    void this.sendMessage(message).catch(error => {
      logger.warn(`[ContentTaskRunner] Failed to report progress for task ${message.taskId}: ${error}`);
    });
  }
}
