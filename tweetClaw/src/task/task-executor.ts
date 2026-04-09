import { LocalBridgeSocket } from '../bridge/local-bridge-socket';
import { StartTaskRequest, CancelTaskRequest, TaskContext, BusinessExecutor, ExecutorCallbacks } from './types';
import { CancellationToken, TaskCancelledException } from './cancellation-token';
import { ErrorHandler } from './error-handler';
import { DataFetcher } from './data-fetcher';
import { ResultUploaderImpl, TaskExecutorConfig } from './result-uploader';
import { MediaUploadExecutor } from './executors/media-upload-executor';
import { logger } from './logger';

export class TaskExecutor {
  private runningTasks: Map<string, TaskContext> = new Map();
  private dataFetcher: DataFetcher;
  private resultUploader: ResultUploaderImpl;

  constructor(
    private socket: LocalBridgeSocket,
    private config: TaskExecutorConfig
  ) {
    this.dataFetcher = new DataFetcher({
      baseUrl: config.localBridgeBaseUrl,
      clientName: config.clientName,
      instanceId: config.instanceId,
      fetchTimeoutMs: config.fetchTimeoutMs
    });
    this.resultUploader = new ResultUploaderImpl(config);
    
    // Fallback disconnection hook (can also be invoked by original caller via handleDisconnect)
  }
  
  public handleDisconnect(): void {
    logger.info('[TaskExecutor] WebSocket disconnected, cancelling all running tasks');
    for (const [taskId, context] of this.runningTasks) {
      try {
        context.cancellationToken.cancel();
        logger.info(`[TaskExecutor] Cancelled task ${taskId} due to disconnect`);
      } catch (error) {
        logger.error(`[TaskExecutor] Error cancelling task ${taskId}:`, error);
      }
    }
    this.runningTasks.clear();
  }

  private resolveExecutor(taskKind: string): BusinessExecutor {
    switch (taskKind) {
      case 'x.media_upload':
        return new MediaUploadExecutor();
      default:
        throw new Error(`Unknown taskKind: ${taskKind}`);
    }
  }

  async startTask(request: StartTaskRequest): Promise<void> {
    const taskId = request.taskId;
    logger.info(`[TaskExecutor] Starting task ${taskId} of kind ${request.taskKind}`);

    if (this.runningTasks.has(taskId)) {
      logger.warn(`[TaskExecutor] Task ${taskId} is already running`);
      return;
    }

    const cancellationToken = new CancellationToken();
    const executor = this.resolveExecutor(request.taskKind);

    const context: TaskContext = {
      taskId,
      taskKind: request.taskKind,
      executor,
      cancellationToken,
      startedAt: Date.now(),
      phase: 'init',
      progress: 0.0
    };

    this.runningTasks.set(taskId, context);

    try {
      const inputMetadata = {
        totalParts: request.params.totalParts || 0,
        totalBytes: request.params.totalBytes || 0,
        contentType: request.params.contentType || 'application/octet-stream'
      };

      const inputReader = this.dataFetcher.createInputReader(taskId, inputMetadata);

      const callbacks: ExecutorCallbacks = {
        onProgress: (phase: string, progress: number) => {
          context.phase = phase;
          context.progress = progress;
          this.reportProgress(taskId, phase, progress);
        },
        checkCancellation: () => {
          cancellationToken.check();
        }
      };

      // 1. Execute task
      const resultData = await executor.execute(inputReader, request.params, callbacks);
      cancellationToken.check();

      // 2. Upload Result
      context.phase = 'uploading_result';
      const resultRef = await this.resultUploader.uploadResult(taskId, 'application/json', resultData);
      cancellationToken.check();

      // 3. Complete
      this.runningTasks.delete(taskId);
      this.reportCompleted(taskId, resultRef);

    } catch (error: any) {
      this.runningTasks.delete(taskId);
      if (error instanceof TaskCancelledException) {
        this.reportCancelled(taskId, context.phase);
      } else {
        logger.error(`[TaskExecutor] Task Error [${taskId}]:`, error);
        const taskError = ErrorHandler.handleError(error, context.phase);
        this.reportFailed(taskId, taskError.phase, taskError.errorCode, taskError.errorMessage);
      }
    }
  }

  async cancelTask(taskId: string): Promise<void> {
    logger.info(`[TaskExecutor] Cancelling task ${taskId}`);
    const context = this.runningTasks.get(taskId);
    if (!context) {
      logger.warn(`[TaskExecutor] Cannot cancel task ${taskId}: not running`);
      return;
    }
    context.cancellationToken.cancel();
  }

  getTaskStatus(taskId: string): TaskContext | null {
    return this.runningTasks.get(taskId) || null;
  }

  private reportProgress(taskId: string, phase: string, progress: number): void {
    this.socket.send({
      id: `task_prog_${taskId}_${Date.now()}`,
      type: 'event.task_progress',
      source: 'tweetClaw',
      target: 'LocalBridgeMac',
      timestamp: Date.now(),
      payload: { taskId, state: 'running', phase, progress }
    });
  }

  private reportFailed(taskId: string, phase: string, errorCode: string, errorMessage: string): void {
    this.socket.send({
      id: `task_fail_${taskId}_${Date.now()}`,
      type: 'event.task_failed',
      source: 'tweetClaw',
      target: 'LocalBridgeMac',
      timestamp: Date.now(),
      payload: { taskId, state: 'failed', phase, errorCode, errorMessage }
    });
  }

  private reportCompleted(taskId: string, resultRef: string): void {
    this.socket.send({
      id: `task_comp_${taskId}_${Date.now()}`,
      type: 'event.task_completed',
      source: 'tweetClaw',
      target: 'LocalBridgeMac',
      timestamp: Date.now(),
      payload: { taskId, state: 'completed', phase: 'done', resultRef }
    });
  }

  private reportCancelled(taskId: string, phase: string): void {
    this.socket.send({
      id: `task_canc_${taskId}_${Date.now()}`,
      type: 'event.task_cancelled',
      source: 'tweetClaw',
      target: 'LocalBridgeMac',
      timestamp: Date.now(),
      payload: { taskId, state: 'cancelled', phase: 'done' }
    });
  }
}
