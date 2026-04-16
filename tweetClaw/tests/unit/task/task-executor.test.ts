import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskExecutor } from '../../../src/task/task-executor';
import { LocalBridgeSocket } from '../../../src/bridge/local-bridge-socket';
import { TaskExecutorConfig } from '../../../src/task/result-uploader';

describe('TaskExecutor', () => {
  let mockSocket: any;
  let config: TaskExecutorConfig;
  
  beforeEach(() => {
    mockSocket = { send: vi.fn(), on: vi.fn() };
    config = { localBridgeBaseUrl: 'http://mock', clientName: 'client', instanceId: 'inst' };
  });

  it('should initialize and register map correctly', async () => {
    const executor = new TaskExecutor(mockSocket as any, config);
    expect(executor).toBeDefined();
  });

  it('should cancel running tasks on disconnect', () => {
    const executor = new TaskExecutor(mockSocket as any, config);
    
    // forcefully mock a running task
    const mockContext = {
      taskId: 't-123',
      cancellationToken: { cancel: vi.fn() }
    };
    (executor as any).runningTasks.set('t-123', mockContext);
    
    executor.handleDisconnect();
    
    expect(mockContext.cancellationToken.cancel).toHaveBeenCalled();
    expect((executor as any).runningTasks.size).toBe(0);
  });
});
