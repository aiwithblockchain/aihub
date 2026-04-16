export interface StartTaskRequest {
  taskId: string;
  taskKind: string;
  inputRef?: string;
  params: Record<string, any>;
}

export interface CancelTaskRequest {
  taskId: string;
}

export interface InputMetadata {
  totalParts: number;
  totalBytes: number;
  contentType: string;
}

export interface BackgroundTaskParams extends Record<string, any> {
  tabId?: number;
  totalParts: number;
  totalBytes: number;
  contentType: string;
  executionEnv?: 'content' | string;
  deliveryMode?: 'bg_session_to_content_session' | string;
}

export interface PreparedTaskInput {
  mimeType: string;
  totalBytes: number;
  transferChunks: string[];
  transferChunkCount: number;
}

export interface BackgroundTaskSession {
  sessionId: string;
  taskId: string;
  mimeType: string;
  totalBytes: number;
  transferChunkCount: number;
  transferChunks: string[];
  createdAt: number;
}

export interface ContentUploadSession {
  taskId: string;
  mimeType: string;
  totalBytes: number;
  expectedChunkCount: number;
  chunks: Blob[];
  receivedBytes: number;
  receivedChunkCount: number;
  releasedBytes: number;
  createdAt: number;
  ready: boolean;
}

export interface StartTaskUploadFromBgSessionMessage {
  type: 'START_TASK_UPLOAD_FROM_BG_SESSION';
  taskId: string;
  uploadSessionId: string;
  mimeType: string;
  totalBytes: number;
  transferChunkCount: number;
  params: Record<string, any>;
}

export interface TaskProgressFromContentMessage {
  type: 'TASK_PROGRESS_FROM_CONTENT';
  taskId: string;
  phase: string;
  progress: number;
}

export interface TaskCompletedFromContentMessage {
  type: 'TASK_COMPLETED_FROM_CONTENT';
  taskId: string;
  contentType: string;
  resultBase64: string;
}

export interface TaskFailedFromContentMessage {
  type: 'TASK_FAILED_FROM_CONTENT';
  taskId: string;
  phase: string;
  errorCode: string;
  errorMessage: string;
}

export interface TaskCancelledFromContentMessage {
  type: 'TASK_CANCELLED_FROM_CONTENT';
  taskId: string;
}

export interface ExecutorCallbacks {
  onProgress(phase: string, progress: number): void;
  checkCancellation(): void;
  onChunkUploaded?(chunkIndex: number, releasedBytes: number): void;
}

export interface TaskInputReader {
  getMetadata(): InputMetadata;
  readPart(partIndex: number): Promise<Uint8Array>;
  [Symbol.asyncIterator](): AsyncIterator<Uint8Array>;
}

export interface BusinessExecutor {
  execute(
    inputReader: TaskInputReader,
    params: Record<string, any>,
    callbacks: ExecutorCallbacks
  ): Promise<Uint8Array>;
}

export interface TaskContext {
  taskId: string;
  taskKind: string;
  cancellationToken: import('./cancellation-token').CancellationToken;
  startedAt: number;
  phase: string;
  progress: number;
  tabId?: number;
  uploadSessionId?: string;
  contentType?: string;
}
