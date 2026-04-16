import { describe, it, expect } from 'vitest';
import { CancellationToken, TaskCancelledException } from '../../../src/task/cancellation-token';

describe('CancellationToken', () => {
  it('should not be cancelled initially', () => {
    const token = new CancellationToken();
    expect(token.isCancelled()).toBe(false);
    expect(() => token.check()).not.toThrow();
  });

  it('should be cancelled after cancel()', () => {
    const token = new CancellationToken();
    token.cancel();
    expect(token.isCancelled()).toBe(true);
  });

  it('should throw TaskCancelledException on check()', () => {
    const token = new CancellationToken();
    token.cancel();
    expect(() => token.check()).toThrow(TaskCancelledException);
  });
});
