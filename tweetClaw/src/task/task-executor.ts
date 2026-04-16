import { LocalBridgeSocket } from '../bridge/local-bridge-socket';
import { CancellationToken, TaskCancelledException } from './cancellation-token';
import { BackgroundSessionStore } from './background-session-store';
import { DataFetcher } from './data-fetcher';
import { ErrorHandler } from './error-handler';
import { logger } from './logger';
import { ResultUploaderImpl, TaskExecutorConfig } from './result-uploader';
import { BackgroundTaskParams, StartTaskRequest, TaskContext } from './types';

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class BackgroundTaskCoordinator {
  private runningTasks = new Map<string, TaskContext>();
  private dataFetcher: DataFetcher;
  private resultUploader: ResultUploaderImpl;

  constructor(
    private socket: LocalBridgeSocket,
    private config: TaskExecutorConfig,
    private backgroundSessionStore: BackgroundSessionStore = new BackgroundSessionStore()
  ) {
    this.dataFetcher = new DataFetcher({
      baseUrl: config.localBridgeBaseUrl,
      clientName: config.clientName,
      instanceId: config.instanceId,
      fetchTimeoutMs: config.fetchTimeoutMs
    });
    this.resultUploader = new ResultUploaderImpl(config);
  }

  public handleDisconnect(): void {
    logger.info('[BackgroundTaskCoordinator] WebSocket disconnected, cancelling all running tasks');

    for (const [taskId, context] of this.runningTasks) {
      context.cancellationToken.cancel();
      if (context.tabId) {
        void chrome.tabs.sendMessage(context.tabId, {
          type: 'CANCEL_CONTENT_TASK',
          taskId
        }).catch(() => {});
      }
      if (context.uploadSessionId) {
        this.backgroundSessionStore.release(context.uploadSessionId);
      }
    }

    this.runningTasks.clear();
  }

  async startTask(request: StartTaskRequest): Promise<void> {
    const taskId = request.taskId;
    if (this.runningTasks.has(taskId)) {
      logger.warn(`[BackgroundTaskCoordinator] Task ${taskId} is already running`);
      return;
    }

    const cancellationToken = new CancellationToken();
    const context: TaskContext = {
      taskId,
      taskKind: request.taskKind,
      cancellationToken,
      startedAt: Date.now(),
      phase: 'init',
      progress: 0
    };
    this.runningTasks.set(taskId, context);

    try {
      if (request.taskKind !== 'x.media_upload') {
        throw new Error(`Unknown taskKind: ${request.taskKind}`);
      }

      const params = (request.params || {}) as BackgroundTaskParams;
      this.assertSupportedRequestParams(params);

      const tabId = await this.resolveTargetTab(params.tabId);
      context.tabId = tabId;

      const preparedInput = await this.dataFetcher.fetchAndChunkTaskInput(
        taskId,
        {
          totalParts: Number(params.totalParts || 0),
          totalBytes: Number(params.totalBytes || 0),
          contentType: params.contentType || 'application/octet-stream'
        },
        (phase, progress) => this.handleLocalProgress(context, phase, progress * 0.45)
      );
      cancellationToken.check();

      const session = this.backgroundSessionStore.createSession({
        sessionId: taskId,
        taskId,
        mimeType: preparedInput.mimeType,
        totalBytes: preparedInput.totalBytes,
        transferChunks: preparedInput.transferChunks
      });

      context.uploadSessionId = session.sessionId;
      context.contentType = session.mimeType;
      this.handleLocalProgress(context, 'dispatch_to_content', 0.5);

      const startResponse = await chrome.tabs.sendMessage(tabId, {
        type: 'START_TASK_UPLOAD_FROM_BG_SESSION',
        taskId,
        uploadSessionId: session.sessionId,
        mimeType: session.mimeType,
        totalBytes: session.totalBytes,
        transferChunkCount: session.transferChunkCount,
        params
      }).catch((error: any) => {
        throw new Error(`Failed to start content task: ${error?.message || String(error)}`);
      });

      cancellationToken.check();

      if (!startResponse?.success) {
        throw new Error(startResponse?.error || 'Content task rejected start request');
      }

      this.handleLocalProgress(context, 'waiting_content', 0.55);
      logger.info(`[BackgroundTaskCoordinator] Task dispatched to content, taskId=${taskId}, tabId=${tabId}`);
    } catch (error: any) {
      this.cleanupTask(taskId);
      if (error instanceof TaskCancelledException) {
        this.reportCancelled(taskId, context.phase);
      } else {
        logger.error(`[BackgroundTaskCoordinator] Task start failed [${taskId}]`, error);
        const taskError = ErrorHandler.handleError(error, context.phase);
        this.reportFailed(taskId, taskError.phase, taskError.errorCode, taskError.errorMessage);
      }
    }
  }

  async cancelTask(taskId: string): Promise<void> {
    const context = this.runningTasks.get(taskId);
    if (!context) {
      logger.warn(`[BackgroundTaskCoordinator] Cannot cancel task ${taskId}: not running`);
      return;
    }

    context.cancellationToken.cancel();

    if (context.tabId) {
      await chrome.tabs.sendMessage(context.tabId, {
        type: 'CANCEL_CONTENT_TASK',
        taskId
      }).catch(error => {
        logger.warn(`[BackgroundTaskCoordinator] Failed to notify content cancellation for task ${taskId}: ${error}`);
      });
    }

    if (context.phase === 'init' || context.phase === 'fetch_input' || context.phase === 'dispatch_to_content') {
      this.cleanupTask(taskId);
      this.reportCancelled(taskId, context.phase);
    }
  }

  handleContentProgress(taskId: string, phase: string, progress: number): void {
    const context = this.runningTasks.get(taskId);
    if (!context) {
      return;
    }

    context.phase = phase;
    context.progress = progress;
    this.reportProgress(taskId, phase, progress);
  }

  async handleContentCompleted(taskId: string, resultBase64: string, contentType: string): Promise<void> {
    const context = this.runningTasks.get(taskId);
    if (!context) {
      return;
    }

    try {
      context.cancellationToken.check();
      context.phase = 'uploading_result';
      context.progress = 0.95;
      this.reportProgress(taskId, context.phase, context.progress);

      const resultData = base64ToUint8Array(resultBase64);
      const resultRef = await this.resultUploader.uploadResult(taskId, contentType || 'application/json', resultData);

      this.cleanupTask(taskId);
      this.reportCompleted(taskId, resultRef);
    } catch (error: any) {
      this.cleanupTask(taskId);
      if (error instanceof TaskCancelledException) {
        this.reportCancelled(taskId, context.phase);
      } else {
        logger.error(`[BackgroundTaskCoordinator] Result upload failed [${taskId}]`, error);
        const taskError = ErrorHandler.handleError(error, context.phase);
        this.reportFailed(taskId, taskError.phase, taskError.errorCode, taskError.errorMessage);
      }
    }
  }

  handleContentFailed(taskId: string, phase: string, errorCode: string, errorMessage: string): void {
    if (!this.runningTasks.has(taskId)) {
      return;
    }
    this.cleanupTask(taskId);
    this.reportFailed(taskId, phase, errorCode, errorMessage);
  }

  handleContentCancelled(taskId: string): void {
    const context = this.runningTasks.get(taskId);
    if (!context) {
      return;
    }

    this.cleanupTask(taskId);
    this.reportCancelled(taskId, context.phase);
  }

  getTaskStatus(taskId: string): TaskContext | null {
    return this.runningTasks.get(taskId) || null;
  }

  private assertSupportedRequestParams(params: BackgroundTaskParams): void {
    if (params.executionEnv && params.executionEnv !== 'content') {
      throw new Error(`Unsupported executionEnv: ${params.executionEnv}`);
    }

    if (params.deliveryMode && params.deliveryMode !== 'bg_session_to_content_session') {
      throw new Error(`Unsupported deliveryMode: ${params.deliveryMode}`);
    }
  }

  private async resolveTargetTab(preferredTabId?: number): Promise<number> {
    if (preferredTabId) {
      return preferredTabId;
    }

    const xTabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    const targetTab = xTabs.find(tab => tab.active) || xTabs[0];
    if (!targetTab?.id) {
      throw new Error('No x.com tab found for task execution');
    }

    return targetTab.id;
  }

  private handleLocalProgress(context: TaskContext, phase: string, progress: number): void {
    context.phase = phase;
    context.progress = progress;
    this.reportProgress(context.taskId, phase, progress);
  }

  private cleanupTask(taskId: string): void {
    const context = this.runningTasks.get(taskId);
    if (!context) {
      return;
    }

    if (context.uploadSessionId) {
      this.backgroundSessionStore.release(context.uploadSessionId);
    }
    this.runningTasks.delete(taskId);
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
      payload: { taskId, state: 'cancelled', phase: phase || 'done' }
    });
  }
}

export { BackgroundTaskCoordinator as TaskExecutor };
