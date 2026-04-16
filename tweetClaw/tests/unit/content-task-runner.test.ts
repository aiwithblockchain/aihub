import { describe, expect, it, vi } from 'vitest';
import { ContentTaskRunner } from '../../src/content/content-task-runner';
import { ContentUploadSessionStore } from '../../src/content/content-upload-session';

describe('ContentTaskRunner', () => {
  it('retries chunk fetch before continuing', async () => {
    const getUploadSessionChunk = vi.fn()
      .mockRejectedValueOnce(new Error('Failed to get upload session chunk 0'))
      .mockResolvedValueOnce(Buffer.from([1, 2, 3]).toString('base64'));
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const executeDirectUpload = vi.fn().mockResolvedValue(new TextEncoder().encode(JSON.stringify({ mediaId: 'm1' })));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const runner = new ContentTaskRunner(
      new ContentUploadSessionStore(),
      { executeDirectUpload, executeFromContentSession: vi.fn() } as any,
      { getUploadSessionChunk, sendMessage, sleep }
    );

    runner.startTaskFromBackground({
      type: 'START_TASK_UPLOAD_FROM_BG_SESSION',
      taskId: 'task-1',
      uploadSessionId: 'bg-1',
      mimeType: 'image/png',
      totalBytes: 3,
      transferChunkCount: 1,
      params: {
        contentChunkRetryCount: 2,
        contentChunkRetryDelayMs: 0
      }
    });

    await vi.waitFor(() => {
      expect(getUploadSessionChunk).toHaveBeenCalledTimes(2);
      expect(executeDirectUpload).toHaveBeenCalledTimes(1);
    });

    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'TASK_COMPLETED_FROM_CONTENT', taskId: 'task-1' }));
  });

  it('reports failed when session integrity validation fails', async () => {
    const getUploadSessionChunk = vi.fn().mockResolvedValue(Buffer.from([1, 2, 3]).toString('base64'));
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    const runner = new ContentTaskRunner(
      new ContentUploadSessionStore(),
      { executeDirectUpload: vi.fn(), executeFromContentSession: vi.fn() } as any,
      { getUploadSessionChunk, sendMessage, sleep: vi.fn().mockResolvedValue(undefined) }
    );

    runner.startTaskFromBackground({
      type: 'START_TASK_UPLOAD_FROM_BG_SESSION',
      taskId: 'task-2',
      uploadSessionId: 'bg-2',
      mimeType: 'image/png',
      totalBytes: 4,
      transferChunkCount: 1,
      params: {}
    });

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'TASK_FAILED_FROM_CONTENT',
        taskId: 'task-2',
        errorCode: 'INPUT_VALIDATION_ERROR'
      }));
    });
  });

  it('retries completion event delivery before succeeding', async () => {
    const getUploadSessionChunk = vi.fn().mockResolvedValue(Buffer.from([1, 2, 3]).toString('base64'));
    const sendMessage = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('message port closed'))
      .mockResolvedValue(undefined);
    const executeDirectUpload = vi.fn().mockResolvedValue(new TextEncoder().encode(JSON.stringify({ mediaId: 'm2' })));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const runner = new ContentTaskRunner(
      new ContentUploadSessionStore(),
      { executeDirectUpload, executeFromContentSession: vi.fn() } as any,
      { getUploadSessionChunk, sendMessage, sleep }
    );

    runner.startTaskFromBackground({
      type: 'START_TASK_UPLOAD_FROM_BG_SESSION',
      taskId: 'task-3',
      uploadSessionId: 'bg-3',
      mimeType: 'image/png',
      totalBytes: 3,
      transferChunkCount: 1,
      params: {
        contentEventRetryCount: 2,
        contentEventRetryDelayMs: 0
      }
    });

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'TASK_COMPLETED_FROM_CONTENT', taskId: 'task-3' }));
    });

    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalled();
  });

  it('rejects invalid start messages synchronously', () => {
    const runner = new ContentTaskRunner(
      new ContentUploadSessionStore(),
      { executeDirectUpload: vi.fn(), executeFromContentSession: vi.fn() } as any,
      { getUploadSessionChunk: vi.fn(), sendMessage: vi.fn(), sleep: vi.fn() }
    );

    expect(() => runner.startTaskFromBackground({
      type: 'START_TASK_UPLOAD_FROM_BG_SESSION',
      taskId: 'task-4',
      uploadSessionId: 'bg-4',
      mimeType: 'image/png',
      totalBytes: 0,
      transferChunkCount: 0,
      params: {}
    })).toThrow('Invalid totalBytes');
  });
});
