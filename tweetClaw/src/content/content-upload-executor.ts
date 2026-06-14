import { ExecutorCallbacks, ContentUploadSession } from '../task/types';
import { logger } from '../task/logger';
import {
  getAuthHeader,
  getCsrfToken,
  MEDIA_APPEND_CHUNK_SIZE_BYTES
} from '../x_api/twitter_api';
import { getTransactionIdFor } from '../x_api/txid';

export const DIRECT_UPLOAD_THRESHOLD_BYTES = 64 * 1024 * 1024;
export const DEFAULT_APPEND_TIMEOUT_MS = 120000;
export const DEFAULT_RAW_REQUEST_TIMEOUT_MS = 30000;

function toNumberOrDefault(value: unknown, defaultValue: number): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

type PageUploadProxy = (payload: any) => Promise<any>;

interface ContentUploadExecutorDeps {
  pageUploadProxy?: PageUploadProxy;
  getAuthHeaderFn?: typeof getAuthHeader;
  getCsrfTokenFn?: typeof getCsrfToken;
  getTransactionIdForFn?: typeof getTransactionIdFor;
}

function createPageUploadProxy(): PageUploadProxy {
  return async (payload: any): Promise<any> => {
    const requestId = `upload_proxy_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    return new Promise((resolve, reject) => {
      const timeoutMs = toNumberOrDefault(
        payload.timeoutMs,
        payload.kind === 'append' ? DEFAULT_APPEND_TIMEOUT_MS : DEFAULT_RAW_REQUEST_TIMEOUT_MS
      );
      const timeout = setTimeout(() => {
        document.removeEventListener('tweetclaw:upload-proxy-response', onMessage as EventListener);
        reject(new Error('Timed out waiting for page upload proxy response'));
      }, timeoutMs);

      function onMessage(event: Event) {
        const detail = (event as CustomEvent).detail;
        if (!detail || detail.requestId !== requestId) return;

        clearTimeout(timeout);
        document.removeEventListener('tweetclaw:upload-proxy-response', onMessage as EventListener);

        if (detail.ok) {
          resolve(detail);
          return;
        }

        reject(new Error(detail.error || `Upload proxy request failed (${detail.status ?? 'unknown'})`));
      }

      document.addEventListener('tweetclaw:upload-proxy-response', onMessage as EventListener);
      document.dispatchEvent(new CustomEvent('tweetclaw:upload-proxy-request', {
        detail: {
          requestId,
          payload
        }
      }));
    });
  };
}

function buildTaskResult(mediaId: string): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ mediaId }));
}

function splitBlobIntoSegments(blob: Blob, segmentBytes: number, mimeType: string): Blob[] {
  if (blob.size === 0) {
    return [new Blob([], { type: mimeType })];
  }

  const segments: Blob[] = [];
  for (let start = 0; start < blob.size; start += segmentBytes) {
    const end = Math.min(start + segmentBytes, blob.size);
    segments.push(blob.slice(start, end, mimeType));
  }
  return segments;
}

export class ContentUploadExecutor {
  private pageUploadProxy: PageUploadProxy;
  private getAuthHeaderFn: typeof getAuthHeader;
  private getCsrfTokenFn: typeof getCsrfToken;
  private getTransactionIdForFn: typeof getTransactionIdFor;

  constructor(deps: ContentUploadExecutorDeps = {}) {
    this.pageUploadProxy = deps.pageUploadProxy || createPageUploadProxy();
    this.getAuthHeaderFn = deps.getAuthHeaderFn || getAuthHeader;
    this.getCsrfTokenFn = deps.getCsrfTokenFn || getCsrfToken;
    this.getTransactionIdForFn = deps.getTransactionIdForFn || getTransactionIdFor;
  }

  async executeDirectUpload(
    session: ContentUploadSession,
    callbacks: ExecutorCallbacks
  ): Promise<Uint8Array> {
    this.assertReadySession(session);

    const startedAt = Date.now();
    callbacks.checkCancellation();
    callbacks.onProgress('prepare_small_upload', 0.2);

    const mergedBlob = new Blob(session.chunks, { type: session.mimeType });
    logger.info(`[ContentUploadExecutor] direct upload: blob merged, taskId=${session.taskId}, bytes=${mergedBlob.size}, elapsedMs=${Date.now() - startedAt}`);

    for (let chunkIndex = 0; chunkIndex < session.chunks.length; chunkIndex++) {
      callbacks.onChunkUploaded?.(chunkIndex, session.chunks[chunkIndex].size);
    }

    callbacks.checkCancellation();
    callbacks.onProgress('init', 0.3);

    // Use page upload proxy for better performance instead of Content Script fetch()
    const bearer = await this.getAuthHeaderFn();
    const csrf = await this.getCsrfTokenFn();
    const isVideo = session.mimeType.startsWith('video/');
    const mediaCategory = isVideo ? 'tweet_video' : 'tweet_image';

    const uploadStartTime = Date.now();
    logger.info(`[ContentUploadExecutor] direct upload: starting via page proxy, taskId=${session.taskId}, bytes=${mergedBlob.size}`);

    // INIT
    const initUrl = `https://upload.x.com/i/media/upload.json?command=INIT&total_bytes=${mergedBlob.size}&media_type=${encodeURIComponent(session.mimeType)}&media_category=${mediaCategory}`;
    const initTxid = await this.getTransactionIdForFn('POST', '/i/media/upload.json');
    const initStartTime = Date.now();

    const initResult = await this.pageUploadProxy({
      kind: 'raw',
      url: initUrl,
      method: 'POST',
      headers: {
        authorization: bearer,
        'x-csrf-token': csrf,
        'x-client-transaction-id': initTxid,
        'x-twitter-auth-type': 'OAuth2Session'
      }
    });

    if (!initResult.ok) {
      throw new Error(`Media upload INIT failed: ${initResult.status} ${initResult.text || ''}`);
    }

    const mediaId = initResult.json?.media_id_string;
    if (!mediaId) {
      throw new Error('Media upload INIT did not return media_id_string');
    }

    logger.info(`[ContentUploadExecutor] direct upload: INIT success, mediaId=${mediaId}, elapsedMs=${Date.now() - initStartTime}`);

    callbacks.checkCancellation();
    callbacks.onProgress('append', 0.5);

    // APPEND
    const totalSegments = Math.max(1, Math.ceil(mergedBlob.size / MEDIA_APPEND_CHUNK_SIZE_BYTES));
    logger.info(`[ContentUploadExecutor] direct upload: APPEND start, segments=${totalSegments}`);

    for (let segmentIndex = 0; segmentIndex < totalSegments; segmentIndex++) {
      callbacks.checkCancellation();

      const start = segmentIndex * MEDIA_APPEND_CHUNK_SIZE_BYTES;
      const end = Math.min(start + MEDIA_APPEND_CHUNK_SIZE_BYTES, mergedBlob.size);
      const chunk = mergedBlob.slice(start, end, session.mimeType);

      const appendTxid = await this.getTransactionIdForFn('POST', '/i/media/upload.json');
      const appendStartTime = Date.now();

      const appendResult = await this.pageUploadProxy({
        kind: 'append',
        url: 'https://upload.x.com/i/media/upload.json',
        method: 'POST',
        headers: {
          authorization: bearer,
          'x-csrf-token': csrf,
          'x-client-transaction-id': appendTxid,
          'x-twitter-auth-type': 'OAuth2Session'
        },
        command: 'APPEND',
        mediaId,
        segmentIndex,
        mimeType: session.mimeType,
        chunkBlob: chunk,
        timeoutMs: DEFAULT_APPEND_TIMEOUT_MS
      });

      if (!appendResult.ok) {
        throw new Error(`Media upload APPEND failed at segment ${segmentIndex}: ${appendResult.status} ${appendResult.text || ''}`);
      }

      const appendElapsedMs = Date.now() - appendStartTime;
      logger.info(`[ContentUploadExecutor] direct upload: APPEND segment=${segmentIndex + 1}/${totalSegments} success, bytes=${chunk.size}, elapsedMs=${appendElapsedMs}`);
      callbacks.onProgress('append', 0.5 + (0.35 * (segmentIndex + 1) / totalSegments));
    }

    callbacks.checkCancellation();
    callbacks.onProgress('finalize', 0.9);

    // FINALIZE
    const finalizeUrl = `https://upload.x.com/i/media/upload.json?command=FINALIZE&media_id=${mediaId}`;
    const finalizeTxid = await this.getTransactionIdForFn('POST', '/i/media/upload.json');
    const finalizeStartTime = Date.now();

    const finalizeResult = await this.pageUploadProxy({
      kind: 'raw',
      url: finalizeUrl,
      method: 'POST',
      headers: {
        authorization: bearer,
        'x-csrf-token': csrf,
        'x-client-transaction-id': finalizeTxid,
        'x-twitter-auth-type': 'OAuth2Session'
      }
    });

    if (!finalizeResult.ok) {
      throw new Error(`Media upload FINALIZE failed: ${finalizeResult.status} ${finalizeResult.text || ''}`);
    }

    logger.info(`[ContentUploadExecutor] direct upload: FINALIZE success, elapsedMs=${Date.now() - finalizeStartTime}`);

    // Wait for video processing if needed
    await this.waitForVideoProcessingIfNeeded(mediaId, isVideo, bearer, csrf, {}, callbacks);

    const uploadElapsedMs = Date.now() - uploadStartTime;
    logger.info(`[ContentUploadExecutor] direct upload: page proxy upload completed, taskId=${session.taskId}, mediaId=${mediaId}, uploadElapsedMs=${uploadElapsedMs}`);
    logger.info(`[ContentUploadExecutor] direct upload completed, taskId=${session.taskId}, bytes=${session.totalBytes}, elapsedMs=${Date.now() - startedAt}`);

    callbacks.onProgress('done', 1);
    return buildTaskResult(mediaId);
  }

  async executeFromContentSession(
    session: ContentUploadSession,
    params: Record<string, unknown>,
    callbacks: ExecutorCallbacks
  ): Promise<Uint8Array> {
    this.assertReadySession(session);

    const startedAt = Date.now();
    const bearer = await this.getAuthHeaderFn();
    const csrf = await this.getCsrfTokenFn();
    const isVideo = session.mimeType.startsWith('video/');
    const mediaCategory = isVideo ? 'tweet_video' : 'tweet_image';
    const appendTimeoutMs = toNumberOrDefault(params.appendTimeoutMs, DEFAULT_APPEND_TIMEOUT_MS);
    const appendChunkBytes = Math.max(
      1,
      toNumberOrDefault(params.appendChunkBytes, MEDIA_APPEND_CHUNK_SIZE_BYTES)
    );
    const appendSegmentCount = session.chunks.reduce(
      (total, chunk) => total + Math.max(1, Math.ceil(chunk.size / appendChunkBytes)),
      0
    );
    logger.info(
      `[ContentUploadExecutor] large upload start, taskId=${session.taskId}, bytes=${session.totalBytes}, chunks=${session.chunks.length}, appendChunkBytes=${appendChunkBytes}, appendSegments=${appendSegmentCount}, mimeType=${session.mimeType}`
    );

    callbacks.checkCancellation();
    callbacks.onProgress('init', 0.2);

    const initUrl = `https://upload.x.com/i/media/upload.json?command=INIT&total_bytes=${session.totalBytes}&media_type=${encodeURIComponent(session.mimeType)}&media_category=${mediaCategory}`;
    const initTxid = await this.getTransactionIdForFn('POST', '/i/media/upload.json');
    const initResult = await this.pageUploadProxy({
      kind: 'raw',
      url: initUrl,
      method: 'POST',
      headers: {
        authorization: bearer,
        'x-csrf-token': csrf,
        'x-client-transaction-id': initTxid,
        'x-twitter-auth-type': 'OAuth2Session'
      }
    });

    if (!initResult.ok) {
      throw new Error(`Media upload INIT failed: ${initResult.status} ${initResult.text || ''}`);
    }

    const mediaId = initResult.json?.media_id_string;
    if (!mediaId) {
      throw new Error('Media upload INIT did not return media_id_string');
    }

    let appendSegmentIndex = 0;
    for (let chunkIndex = 0; chunkIndex < session.chunks.length; chunkIndex++) {
      callbacks.checkCancellation();
      const chunk = session.chunks[chunkIndex];
      const appendSegments = splitBlobIntoSegments(chunk, appendChunkBytes, session.mimeType);

      for (const appendSegment of appendSegments) {
        callbacks.checkCancellation();
        const appendTxid = await this.getTransactionIdForFn('POST', '/i/media/upload.json');
        const appendStartedAt = Date.now();

        const appendResult = await this.pageUploadProxy({
          kind: 'append',
          url: 'https://upload.x.com/i/media/upload.json',
          method: 'POST',
          headers: {
            authorization: bearer,
            'x-csrf-token': csrf,
            'x-client-transaction-id': appendTxid,
            'x-twitter-auth-type': 'OAuth2Session'
          },
          command: 'APPEND',
          mediaId,
          segmentIndex: appendSegmentIndex,
          mimeType: session.mimeType,
          chunkBlob: appendSegment,
          timeoutMs: appendTimeoutMs
        });

        if (!appendResult.ok) {
          throw new Error(`Media upload APPEND failed at segment ${appendSegmentIndex}: ${appendResult.status} ${appendResult.text || ''}`);
        }

        appendSegmentIndex += 1;
        callbacks.onProgress('append', 0.2 + (0.7 * appendSegmentIndex / appendSegmentCount));
        logger.debug(
          `[ContentUploadExecutor] append complete, taskId=${session.taskId}, segment=${appendSegmentIndex}/${appendSegmentCount}, bytes=${appendSegment.size}, sourceChunk=${chunkIndex + 1}/${session.chunks.length}, elapsedMs=${Date.now() - appendStartedAt}`
        );
      }

      callbacks.onChunkUploaded?.(chunkIndex, chunk.size);
    }

    callbacks.checkCancellation();
    callbacks.onProgress('finalize', 0.92);

    const finalizeUrl = `https://upload.x.com/i/media/upload.json?command=FINALIZE&media_id=${mediaId}`;
    const finalizeTxid = await this.getTransactionIdForFn('POST', '/i/media/upload.json');
    const finalizeResult = await this.pageUploadProxy({
      kind: 'raw',
      url: finalizeUrl,
      method: 'POST',
      headers: {
        authorization: bearer,
        'x-csrf-token': csrf,
        'x-client-transaction-id': finalizeTxid,
        'x-twitter-auth-type': 'OAuth2Session'
      }
    });

    if (!finalizeResult.ok) {
      throw new Error(`Media upload FINALIZE failed: ${finalizeResult.status} ${finalizeResult.text || ''}`);
    }

    await this.waitForVideoProcessingIfNeeded(mediaId, isVideo, bearer, csrf, params, callbacks);

    logger.info(`[ContentUploadExecutor] large upload completed, taskId=${session.taskId}, mediaId=${mediaId}, releasedBytes=${session.releasedBytes}, elapsedMs=${Date.now() - startedAt}`);
    callbacks.onProgress('done', 1);
    return buildTaskResult(mediaId);
  }

  private assertReadySession(session: ContentUploadSession): void {
    if (!session.ready) {
      throw new Error(`Content session is not ready: ${session.taskId}`);
    }
    if (session.receivedBytes !== session.totalBytes) {
      throw new Error(`Content session size mismatch: expected ${session.totalBytes} bytes but received ${session.receivedBytes}`);
    }
    if (session.receivedChunkCount !== session.expectedChunkCount) {
      throw new Error(`Content session chunk count mismatch: expected ${session.expectedChunkCount} chunks but received ${session.receivedChunkCount}`);
    }
  }

  async executeStreaming(
    totalBytes: number,
    mimeType: string,
    expectedChunkCount: number,
    taskId: string,
    params: Record<string, unknown>,
    callbacks: ExecutorCallbacks,
    getChunk: (chunkIndex: number) => Promise<Blob>
  ): Promise<Uint8Array> {
    const startedAt = Date.now();
    const bearer = await this.getAuthHeaderFn();
    const csrf = await this.getCsrfTokenFn();
    const isVideo = mimeType.startsWith('video/');
    const mediaCategory = isVideo ? 'tweet_video' : 'tweet_image';
    const appendTimeoutMs = toNumberOrDefault(params.appendTimeoutMs, DEFAULT_APPEND_TIMEOUT_MS);
    const appendChunkBytes = Math.max(1, toNumberOrDefault(params.appendChunkBytes, MEDIA_APPEND_CHUNK_SIZE_BYTES));

    logger.info(`[ContentUploadExecutor] streaming upload start, taskId=${taskId}, bytes=${totalBytes}, expectedChunks=${expectedChunkCount}, mimeType=${mimeType}`);

    callbacks.checkCancellation();
    callbacks.onProgress('init', 0.2);

    const initUrl = `https://upload.x.com/i/media/upload.json?command=INIT&total_bytes=${totalBytes}&media_type=${encodeURIComponent(mimeType)}&media_category=${mediaCategory}`;
    const initTxid = await this.getTransactionIdForFn('POST', '/i/media/upload.json');
    const initResult = await this.pageUploadProxy({
      kind: 'raw',
      url: initUrl,
      method: 'POST',
      headers: {
        authorization: bearer,
        'x-csrf-token': csrf,
        'x-client-transaction-id': initTxid,
        'x-twitter-auth-type': 'OAuth2Session'
      }
    });

    if (!initResult.ok) {
      throw new Error(`Media upload INIT failed: ${initResult.status} ${initResult.text || ''}`);
    }

    const mediaId = initResult.json?.media_id_string;
    if (!mediaId) {
      throw new Error('Media upload INIT did not return media_id_string');
    }

    let appendSegmentIndex = 0;
    let totalSegments = 0;

    for (let chunkIndex = 0; chunkIndex < expectedChunkCount; chunkIndex++) {
      callbacks.checkCancellation();

      const chunk = await getChunk(chunkIndex);
      const appendSegments = splitBlobIntoSegments(chunk, appendChunkBytes, mimeType);
      totalSegments += appendSegments.length;

      for (const appendSegment of appendSegments) {
        callbacks.checkCancellation();
        const appendTxid = await this.getTransactionIdForFn('POST', '/i/media/upload.json');

        const appendResult = await this.pageUploadProxy({
          kind: 'append',
          url: 'https://upload.x.com/i/media/upload.json',
          method: 'POST',
          headers: {
            authorization: bearer,
            'x-csrf-token': csrf,
            'x-client-transaction-id': appendTxid,
            'x-twitter-auth-type': 'OAuth2Session'
          },
          command: 'APPEND',
          mediaId,
          segmentIndex: appendSegmentIndex,
          mimeType,
          chunkBlob: appendSegment,
          timeoutMs: appendTimeoutMs
        });

        if (!appendResult.ok) {
          throw new Error(`Media upload APPEND failed at segment ${appendSegmentIndex}: ${appendResult.status} ${appendResult.text || ''}`);
        }

        appendSegmentIndex += 1;
        const estimatedTotal = Math.max(totalSegments, Math.ceil(expectedChunkCount * appendSegmentIndex / (chunkIndex + 1)));
        callbacks.onProgress('append', 0.2 + (0.7 * appendSegmentIndex / estimatedTotal));
      }

      callbacks.onChunkUploaded?.(chunkIndex, chunk.size);
    }

    callbacks.checkCancellation();
    callbacks.onProgress('finalize', 0.92);

    const finalizeUrl = `https://upload.x.com/i/media/upload.json?command=FINALIZE&media_id=${mediaId}`;
    const finalizeTxid = await this.getTransactionIdForFn('POST', '/i/media/upload.json');
    const finalizeResult = await this.pageUploadProxy({
      kind: 'raw',
      url: finalizeUrl,
      method: 'POST',
      headers: {
        authorization: bearer,
        'x-csrf-token': csrf,
        'x-client-transaction-id': finalizeTxid,
        'x-twitter-auth-type': 'OAuth2Session'
      }
    });

    if (!finalizeResult.ok) {
      throw new Error(`Media upload FINALIZE failed: ${finalizeResult.status} ${finalizeResult.text || ''}`);
    }

    await this.waitForVideoProcessingIfNeeded(mediaId, isVideo, bearer, csrf, params, callbacks);

    logger.info(`[ContentUploadExecutor] streaming upload completed, taskId=${taskId}, mediaId=${mediaId}, elapsedMs=${Date.now() - startedAt}`);
    callbacks.onProgress('done', 1);
    return buildTaskResult(mediaId);
  }

  private async waitForVideoProcessingIfNeeded(
    mediaId: string,
    isVideo: boolean,
    bearer: string,
    csrf: string,
    params: Record<string, unknown>,
    callbacks: ExecutorCallbacks
  ): Promise<void> {
    if (!isVideo) {
      return;
    }

    const maxAttempts = toNumberOrDefault(params.videoPollingAttempts, 60);
    const pollDelayMs = toNumberOrDefault(params.videoPollingDelayMs, 5000);

    let lastState = 'unknown';
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      callbacks.checkCancellation();
      await new Promise(resolve => setTimeout(resolve, pollDelayMs));

      const statusUrl = `https://upload.x.com/i/media/upload.json?command=STATUS&media_id=${mediaId}`;
      const statusTxid = await this.getTransactionIdForFn('GET', '/i/media/upload.json');
      const statusResult = await this.pageUploadProxy({
        kind: 'raw',
        url: statusUrl,
        method: 'GET',
        headers: {
          authorization: bearer,
          'x-csrf-token': csrf,
          'x-client-transaction-id': statusTxid,
          'x-twitter-auth-type': 'OAuth2Session'
        }
      });

      if (!statusResult.ok) {
        throw new Error(`Media upload STATUS failed: ${statusResult.status} ${statusResult.text || ''}`);
      }

      const state = statusResult.json?.processing_info?.state;
      lastState = state || 'unknown';
      callbacks.onProgress('processing', 0.94 + (0.05 * (attempts + 1) / maxAttempts));

      if (state === 'succeeded' || !state) {
        return;
      }

      if (state === 'failed') {
        throw new Error(`Video processing failed: ${statusResult.json?.processing_info?.error?.message || 'unknown error'}`);
      }
    }

    throw new Error(`Video processing polling exhausted: mediaId=${mediaId}, lastState=${lastState}, attempts=${maxAttempts}`);
  }
}
