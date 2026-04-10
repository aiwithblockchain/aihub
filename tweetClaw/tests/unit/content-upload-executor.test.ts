import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentUploadExecutor } from '../../src/content/content-upload-executor';

describe('ContentUploadExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).FileReader = class MockFileReader {
      result: string | null = null;
      error: Error | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL(blob: Blob) {
        blob.arrayBuffer().then(buffer => {
          this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
          this.onload?.();
        }).catch(error => {
          this.error = error;
          this.onerror?.();
        });
      }
    };
  });

  it('reuses direct upload path for small ready sessions', async () => {
    const uploadMediaFn = vi.fn().mockResolvedValueOnce('media-123');
    const executor = new ContentUploadExecutor({
      uploadMediaFn
    });
    const onProgress = vi.fn();
    const onChunkUploaded = vi.fn();

    const result = await executor.executeDirectUpload({
      taskId: 'task-1',
      mimeType: 'image/png',
      totalBytes: 4,
      expectedChunkCount: 1,
      chunks: [new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' })],
      receivedBytes: 4,
      receivedChunkCount: 1,
      releasedBytes: 0,
      createdAt: Date.now(),
      ready: true
    }, {
      onProgress,
      onChunkUploaded,
      checkCancellation: vi.fn()
    });

    expect(uploadMediaFn).toHaveBeenCalledTimes(1);
    expect(onChunkUploaded).toHaveBeenCalledWith(0, 4);
    expect(onProgress).toHaveBeenCalledWith('prepare_small_upload', 0.2);
    expect(onProgress).toHaveBeenCalledWith('direct_upload', 0.6);
    expect(new TextDecoder().decode(result)).toContain('media-123');
  });

  it('runs INIT/APPEND/FINALIZE/STATUS for large uploads', async () => {
    const pageUploadProxy = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: { media_id_string: 'media-large' } })
      .mockResolvedValueOnce({ ok: true, text: '', json: {} })
      .mockResolvedValueOnce({ ok: true, text: '', json: {} })
      .mockResolvedValueOnce({ ok: true, text: '', json: {} })
      .mockResolvedValueOnce({ ok: true, text: '', json: { processing_info: { state: 'succeeded' } } });

    const executor = new ContentUploadExecutor({
      pageUploadProxy,
      getAuthHeaderFn: vi.fn().mockResolvedValue('Bearer token'),
      getCsrfTokenFn: vi.fn().mockResolvedValue('csrf'),
      getTransactionIdForFn: vi.fn().mockResolvedValue('txid')
    });

    const onProgress = vi.fn();
    const onChunkUploaded = vi.fn();
    const result = await executor.executeFromContentSession({
      taskId: 'task-2',
      mimeType: 'video/mp4',
      totalBytes: 6,
      expectedChunkCount: 2,
      chunks: [
        new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' }),
        new Blob([new Uint8Array([4, 5, 6])], { type: 'video/mp4' })
      ],
      receivedBytes: 6,
      receivedChunkCount: 2,
      releasedBytes: 0,
      createdAt: Date.now(),
      ready: true
    }, {
      appendTimeoutMs: 43210,
      videoPollingAttempts: 2,
      videoPollingDelayMs: 0
    }, {
      onProgress,
      onChunkUploaded,
      checkCancellation: vi.fn()
    });

    expect(pageUploadProxy).toHaveBeenCalledTimes(5);
    expect(pageUploadProxy.mock.calls[0][0].url).toContain('command=INIT');
    expect(pageUploadProxy.mock.calls[1][0].kind).toBe('append');
    expect(pageUploadProxy.mock.calls[1][0].timeoutMs).toBe(43210);
    expect(pageUploadProxy.mock.calls[3][0].url).toContain('command=FINALIZE');
    expect(pageUploadProxy.mock.calls[4][0].url).toContain('command=STATUS');
    expect(onChunkUploaded).toHaveBeenCalledTimes(2);
    expect(new TextDecoder().decode(result)).toContain('media-large');
  });

  it('fails when video processing polling is exhausted', async () => {
    const pageUploadProxy = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: { media_id_string: 'media-large' } })
      .mockResolvedValueOnce({ ok: true, text: '', json: {} })
      .mockResolvedValueOnce({ ok: true, text: '', json: {} })
      .mockResolvedValueOnce({ ok: true, text: '', json: { processing_info: { state: 'pending' } } })
      .mockResolvedValueOnce({ ok: true, text: '', json: { processing_info: { state: 'in_progress' } } });

    const executor = new ContentUploadExecutor({
      pageUploadProxy,
      getAuthHeaderFn: vi.fn().mockResolvedValue('Bearer token'),
      getCsrfTokenFn: vi.fn().mockResolvedValue('csrf'),
      getTransactionIdForFn: vi.fn().mockResolvedValue('txid')
    });

    await expect(executor.executeFromContentSession({
      taskId: 'task-3',
      mimeType: 'video/mp4',
      totalBytes: 3,
      expectedChunkCount: 1,
      chunks: [new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' })],
      receivedBytes: 3,
      receivedChunkCount: 1,
      releasedBytes: 0,
      createdAt: Date.now(),
      ready: true
    }, {
      videoPollingAttempts: 2,
      videoPollingDelayMs: 0
    }, {
      onProgress: vi.fn(),
      onChunkUploaded: vi.fn(),
      checkCancellation: vi.fn()
    })).rejects.toThrow('Video processing polling exhausted');
  });
});
