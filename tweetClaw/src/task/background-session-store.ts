import { BackgroundTaskSession } from './types';

export const LEGACY_MEDIA_TRANSFER_CHUNK_BYTES = 3 * 1024 * 1024;
export const BACKGROUND_TO_CONTENT_TRANSFER_CHUNK_BYTES = 2 * 1024 * 1024;  // 2MB，低于 4MB 限制

interface CreateBackgroundSessionInput {
  sessionId?: string;
  taskId: string;
  mimeType: string;
  totalBytes: number;
  transferChunks: Uint8Array[];
}

function createSessionId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export class BackgroundSessionStore {
  private sessions = new Map<string, BackgroundTaskSession>();

  createSession(input: CreateBackgroundSessionInput): BackgroundTaskSession {
    const sessionId = input.sessionId || createSessionId('bg_session');
    const session: BackgroundTaskSession = {
      sessionId,
      taskId: input.taskId,
      mimeType: input.mimeType,
      totalBytes: input.totalBytes,
      transferChunks: input.transferChunks,
      transferChunkCount: input.transferChunks.length,
      createdAt: Date.now()
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): BackgroundTaskSession | null {
    return this.sessions.get(sessionId) || null;
  }

  getChunk(sessionId: string, chunkIndex: number) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const chunkData = session.transferChunks[chunkIndex];
    if (!chunkData) {
      return null;
    }

    return {
      chunkData,
      totalBytes: session.totalBytes,
      mimeType: session.mimeType,
      transferChunkCount: session.transferChunkCount
    };
  }

  release(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  clear(): void {
    this.sessions.clear();
  }
}
