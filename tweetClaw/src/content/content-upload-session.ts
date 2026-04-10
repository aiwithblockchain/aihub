import { ContentUploadSession } from '../task/types';

export class ContentUploadSessionStore {
  private sessions = new Map<string, ContentUploadSession>();

  createSession(taskId: string, mimeType: string, totalBytes: number, expectedChunkCount: number): ContentUploadSession {
    const session: ContentUploadSession = {
      taskId,
      mimeType,
      totalBytes,
      expectedChunkCount,
      chunks: [],
      receivedBytes: 0,
      receivedChunkCount: 0,
      releasedBytes: 0,
      createdAt: Date.now(),
      ready: false
    };
    this.sessions.set(taskId, session);
    return session;
  }

  appendChunk(taskId: string, chunkIndex: number, chunk: Blob): ContentUploadSession {
    const session = this.sessions.get(taskId);
    if (!session) {
      throw new Error(`Content upload session not found: ${taskId}`);
    }

    if (session.ready) {
      throw new Error(`Cannot append chunk to ready session: ${taskId}`);
    }

    if (chunkIndex !== session.receivedChunkCount) {
      throw new Error(`Content upload chunk out of order: expected ${session.receivedChunkCount}, got ${chunkIndex}`);
    }

    if (session.receivedChunkCount >= session.expectedChunkCount) {
      throw new Error(`Content upload chunk overflow: expected ${session.expectedChunkCount} chunks`);
    }

    if (session.receivedBytes + chunk.size > session.totalBytes) {
      throw new Error(`Content upload size overflow: expected ${session.totalBytes} bytes`);
    }

    session.chunks.push(chunk);
    session.receivedBytes += chunk.size;
    session.receivedChunkCount += 1;
    return session;
  }

  markReady(taskId: string): ContentUploadSession {
    const session = this.sessions.get(taskId);
    if (!session) {
      throw new Error(`Content upload session not found: ${taskId}`);
    }

    if (session.receivedChunkCount !== session.expectedChunkCount) {
      throw new Error(`Content upload chunk count mismatch: expected ${session.expectedChunkCount} chunks but received ${session.receivedChunkCount}`);
    }

    if (session.receivedBytes !== session.totalBytes) {
      throw new Error(`Content upload size mismatch: expected ${session.totalBytes} bytes but received ${session.receivedBytes}`);
    }

    session.ready = true;
    return session;
  }

  releaseChunk(taskId: string, chunkIndex: number): ContentUploadSession {
    const session = this.sessions.get(taskId);
    if (!session) {
      throw new Error(`Content upload session not found: ${taskId}`);
    }

    const current = session.chunks[chunkIndex];
    if (!current) {
      throw new Error(`Content upload chunk not found: ${taskId}/${chunkIndex}`);
    }

    const size = current.size;
    session.chunks[chunkIndex] = new Blob([], { type: session.mimeType });
    session.releasedBytes += size;
    return session;
  }

  getSession(taskId: string): ContentUploadSession | null {
    return this.sessions.get(taskId) || null;
  }

  release(taskId: string): void {
    this.sessions.delete(taskId);
  }
}
