import { ExecutorCallbacks, ContentUploadSession } from '../task/types';
import { logger } from '../task/logger';
import { getAuthHeader, getCsrfToken, uploadMedia } from '../x_api/twitter_api';
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
  uploadMediaFn?: typeof uploadMedia;
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

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob as base64'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

function buildTaskResult(mediaId: string): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ mediaId }));
}

export class ContentUploadExecutor {
  private pageUploadProxy: PageUploadProxy;
  private uploadMediaFn: typeof uploadMedia;
  private getAuthHeaderFn: typeof getAuthHeader;
  private getCsrfTokenFn: typeof getCsrfToken;
  private getTransactionIdForFn: typeof getTransactionIdFor;

  constructor(deps: ContentUploadExecutorDeps = {}) {
    this.pageUploadProxy = deps.pageUploadProxy || createPageUploadProxy();
    this.uploadMediaFn = deps.uploadMediaFn || uploadMedia;
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
    const mediaBase64 = await blobToBase64(mergedBlob);

    for (let chunkIndex = 0; chunkIndex < session.chunks.length; chunkIndex++) {
      callbacks.onChunkUploaded?.(chunkIndex, session.chunks[chunkIndex].size);
    }

    callbacks.checkCancellation();
    callbacks.onProgress('direct_upload', 0.6);

    const mediaId = await this.uploadMediaFn(mediaBase64, session.mimeType);
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
    logger.info(`[ContentUploadExecutor] large upload start, taskId=${session.taskId}, bytes=${session.totalBytes}, chunks=${session.chunks.length}, mimeType=${session.mimeType}`);

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

    for (let segmentIndex = 0; segmentIndex < session.chunks.length; segmentIndex++) {
      callbacks.checkCancellation();
      const chunk = session.chunks[segmentIndex];
      const appendTxid = await this.getTransactionIdForFn('POST', '/i/media/upload.json');
      const chunkBase64 = await blobToBase64(chunk);
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
        segmentIndex,
        mimeType: session.mimeType,
        chunkBase64,
        timeoutMs: appendTimeoutMs
      });

      if (!appendResult.ok) {
        throw new Error(`Media upload APPEND failed at segment ${segmentIndex}: ${appendResult.status} ${appendResult.text || ''}`);
      }

      callbacks.onChunkUploaded?.(segmentIndex, chunk.size);
      callbacks.onProgress('append', 0.2 + (0.7 * (segmentIndex + 1) / session.chunks.length));
      logger.debug(`[ContentUploadExecutor] append complete, taskId=${session.taskId}, segment=${segmentIndex + 1}/${session.chunks.length}, bytes=${chunk.size}, elapsedMs=${Date.now() - appendStartedAt}`);
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
