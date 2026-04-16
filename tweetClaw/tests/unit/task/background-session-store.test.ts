import { describe, expect, it } from 'vitest';
import {
  BackgroundSessionStore,
  BACKGROUND_TO_CONTENT_TRANSFER_CHUNK_BYTES,
  LEGACY_MEDIA_TRANSFER_CHUNK_BYTES
} from '../../../src/task/background-session-store';

describe('BackgroundSessionStore', () => {
  it('stores pre-chunked task sessions and serves chunks by index', () => {
    const store = new BackgroundSessionStore();
    const session = store.createSession({
      sessionId: 'task-1',
      taskId: 'task-1',
      mimeType: 'video/mp4',
      totalBytes: 12,
      transferChunks: ['YWJj', 'ZGVm']
    });

    expect(session.transferChunkCount).toBe(2);
    expect(store.getChunk('task-1', 0)?.chunkBase64).toBe('YWJj');
    expect(store.getChunk('task-1', 1)?.chunkBase64).toBe('ZGVm');

    store.release('task-1');
    expect(store.getChunk('task-1', 0)).toBeNull();
  });

  it('splits legacy base64 uploads into fixed-size transfer chunks', () => {
    const store = new BackgroundSessionStore();
    const rawBytes = new Uint8Array(LEGACY_MEDIA_TRANSFER_CHUNK_BYTES + 16).fill(7);
    const mediaData = Buffer.from(rawBytes).toString('base64');

    const session = store.createSessionFromBase64(mediaData, 'video/mp4');

    expect(session.totalBytes).toBe(rawBytes.length);
    expect(session.transferChunkCount).toBe(2);
  });

  it('keeps task transfer chunks within the background-to-content boundary', () => {
    const store = new BackgroundSessionStore();
    const rawBytes = new Uint8Array(BACKGROUND_TO_CONTENT_TRANSFER_CHUNK_BYTES + 8).fill(3);
    const chunkA = Buffer.from(rawBytes.subarray(0, BACKGROUND_TO_CONTENT_TRANSFER_CHUNK_BYTES)).toString('base64');
    const chunkB = Buffer.from(rawBytes.subarray(BACKGROUND_TO_CONTENT_TRANSFER_CHUNK_BYTES)).toString('base64');

    const session = store.createSession({
      taskId: 'task-2',
      mimeType: 'video/mp4',
      totalBytes: rawBytes.length,
      transferChunks: [chunkA, chunkB]
    });

    expect(session.transferChunkCount).toBe(2);
    expect(store.getChunk(session.sessionId, 1)?.chunkBase64).toBe(chunkB);
  });
});
