import { describe, it, expect } from 'vitest';
import { ErrorHandler } from '../../../src/task/error-handler';
import { TaskCancelledException } from '../../../src/task/cancellation-token';

describe('ErrorHandler', () => {
  it('should handle TaskCancelledException', () => {
    const err = new TaskCancelledException();
    const result = ErrorHandler.handleError(err, 'append');
    expect(result.errorCode).toBe('TASK_CANCELLED');
    expect(result.phase).toBe('append');
  });

  it('should classify network errors', () => {
    const result = ErrorHandler.handleError(new Error('fetch timeout'), 'init');
    expect(result.errorCode).toBe('NETWORK_ERROR');
  });

  it('should classify auth errors', () => {
    const result = ErrorHandler.handleError(new Error('unauthorized access 403'), 'init');
    expect(result.errorCode).toBe('AUTH_ERROR');
  });

  it('should classify input fetch errors', () => {
    const result = ErrorHandler.handleError(new Error('Failed to fetch part 0: 500'), 'init');
    expect(result.errorCode).toBe('INPUT_FETCH_ERROR');
  });

  it('should default to TASK_EXECUTION_ERROR', () => {
    const result = ErrorHandler.handleError(new Error('Unexpected arbitrary bug'), 'finalize');
    expect(result.errorCode).toBe('TASK_EXECUTION_ERROR');
  });
});
