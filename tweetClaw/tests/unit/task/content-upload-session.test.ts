import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ContentUploadSessionStore } from '../../../src/content/content-upload-session';
import { DataFetcher } from '../../../src/task/data-fetcher';
import { BACKGROUND_TO_CONTENT_TRANSFER_CHUNK_BYTES } from '../../../src/task/background-session-store';

describe('ContentUploadSessionStore', () => {
  it('collects chunks independently from background sessions', () => {
    const store = new ContentUploadSessionStore();
    const session = store.createSession('task-1', 'video/mp4', 6, 2);

    store.appendChunk('task-1', 0, new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' }));
    store.appendChunk('task-1', 1, new Blob([new Uint8Array([4, 5, 6])], { type: 'video/mp4' }));
    store.markReady('task-1');

    expect(session.chunks).toHaveLength(2);
    expect(session.receivedBytes).toBe(6);
    expect(session.receivedChunkCount).toBe(2);
    expect(session.ready).toBe(true);
  });

  it('rejects out-of-order chunks and mismatched totals', () => {
    const store = new ContentUploadSessionStore();
    store.createSession('task-2', 'video/mp4', 6, 2);

    expect(() => store.appendChunk('task-2', 1, new Blob([new Uint8Array([1, 2, 3])]))).toThrow('out of order');

    store.appendChunk('task-2', 0, new Blob([new Uint8Array([1, 2, 3])]));
    expect(() => store.markReady('task-2')).toThrow('chunk count mismatch');
  });

  it('releases uploaded chunk memory after append succeeds', () => {
    const store = new ContentUploadSessionStore();
    const session = store.createSession('task-3', 'video/mp4', 3, 1);
    store.appendChunk('task-3', 0, new Blob([new Uint8Array([1, 2, 3])]));
    store.markReady('task-3');
    store.releaseChunk('task-3', 0);

    expect(session.chunks[0].size).toBe(0);
    expect(session.releasedBytes).toBe(3);
  });
});

describe('DataFetcher.fetchAndChunkTaskInput', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('re-chunks fetched input for background-to-content transfer', async () => {
    const fetcher = new DataFetcher('http://mock', 'client', 'inst');
    const rawBytes = new Uint8Array(BACKGROUND_TO_CONTENT_TRANSFER_CHUNK_BYTES + 32).fill(9);

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(rawBytes.buffer)
    });

    const prepared = await fetcher.fetchAndChunkTaskInput('task-123', {
      totalParts: 1,
      totalBytes: rawBytes.length,
      contentType: 'video/mp4'
    });

    expect(prepared.totalBytes).toBe(rawBytes.length);
    expect(prepared.mimeType).toBe('video/mp4');
    expect(prepared.transferChunkCount).toBe(2);
    expect(prepared.transferChunks[0].length).toBeGreaterThan(prepared.transferChunks[1].length);
  });
});
