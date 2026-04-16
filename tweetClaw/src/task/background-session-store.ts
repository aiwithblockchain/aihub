import { BackgroundTaskSession } from './types';

export const LEGACY_MEDIA_TRANSFER_CHUNK_BYTES = 3 * 1024 * 1024;
export const BACKGROUND_TO_CONTENT_TRANSFER_CHUNK_BYTES = 30 * 1024 * 1024;

interface CreateBackgroundSessionInput {
  sessionId?: string;
  taskId: string;
  mimeType: string;
  totalBytes: number;
  transferChunks: string[];
}

function createSessionId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function estimateDecodedBytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : (base64.endsWith('=') ? 1 : 0);
  return Math.floor((base64.length * 3) / 4) - padding;
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
      transferChunks: [...input.transferChunks],
      transferChunkCount: input.transferChunks.length,
      createdAt: Date.now()
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  createSessionFromBase64(mediaData: string, mimeType: string, chunkBytes = LEGACY_MEDIA_TRANSFER_CHUNK_BYTES): BackgroundTaskSession {
    const totalBytes = estimateDecodedBytes(mediaData);
    const base64CharsPerChunk = (chunkBytes / 3) * 4;
    const transferChunks: string[] = [];

    for (let start = 0; start < mediaData.length; start += base64CharsPerChunk) {
      transferChunks.push(mediaData.slice(start, start + base64CharsPerChunk));
    }

    return this.createSession({
      sessionId: createSessionId('upload'),
      taskId: createSessionId('upload_task'),
      mimeType,
      totalBytes,
      transferChunks
    });
  }

  getSession(sessionId: string): BackgroundTaskSession | null {
    return this.sessions.get(sessionId) || null;
  }

  getChunk(sessionId: string, chunkIndex: number) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const chunkBase64 = session.transferChunks[chunkIndex];
    if (!chunkBase64) {
      return null;
    }

    return {
      chunkBase64,
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
