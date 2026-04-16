export class TaskCancelledException extends Error {
  constructor() {
    super('Task was cancelled');
    this.name = 'TaskCancelledException';
  }
}

export class CancellationToken {
  private cancelled = false;
  
  cancel(): void {
    this.cancelled = true;
  }
  
  check(): void {
    if (this.cancelled) {
      throw new TaskCancelledException();
    }
  }
  
  isCancelled(): boolean {
    return this.cancelled;
  }
}
