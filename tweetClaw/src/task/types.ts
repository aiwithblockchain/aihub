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

export interface ExecutorCallbacks {
  onProgress(phase: string, progress: number): void;
  checkCancellation(): void;
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
  executor: BusinessExecutor;
  cancellationToken: import('./cancellation-token').CancellationToken;
  startedAt: number;
  phase: string;
  progress: number;
}
