import { BusinessExecutor, ExecutorCallbacks, TaskInputReader } from '../types';
import { getAuthHeader, getCsrfToken } from '../../x_api/twitter_api';
import { getTransactionIdFor } from '../../x_api/txid';
import { logger } from '../logger';

export class MediaUploadExecutor implements BusinessExecutor {
  async execute(
    inputReader: TaskInputReader,
    params: Record<string, any>,
    callbacks: ExecutorCallbacks
  ): Promise<Uint8Array> {
    const metadata = inputReader.getMetadata();
    const mimeType = metadata.contentType || params.contentType || 'video/mp4';
    const tabId = params.tabId;
    const totalBytes = metadata.totalBytes;
    
    // Auth
    const bearer = await getAuthHeader();
    const csrf = (await getCsrfToken()) as string;

    const isVideo = mimeType.startsWith('video/');
    const mediaCategory = isVideo ? 'tweet_video' : 'tweet_image';

    // Phase 1: INIT
    callbacks.onProgress('init', 0);
    callbacks.checkCancellation();
    const mediaTypeEnc = encodeURIComponent(mimeType);
    const initUrl = `https://upload.x.com/i/media/upload.json?command=INIT&total_bytes=${totalBytes}&media_type=${mediaTypeEnc}&media_category=${mediaCategory}`;
    const initTxid = await getTransactionIdFor('POST', '/i/media/upload.json');
    
    const initResponse = await fetch(initUrl, {
        method: 'POST',
        headers: {
            'authorization': bearer,
            'x-csrf-token': csrf,
            'x-client-transaction-id': initTxid,
            'x-twitter-auth-type': 'OAuth2Session',
        },
        credentials: 'include'
    });

    if (!initResponse.ok) {
        throw new Error(`Media upload INIT failed: ${initResponse.status} ${await initResponse.text()}`);
    }
    const initData = await initResponse.json();
    const mediaId = initData.media_id_string;
    logger.info(`[MediaUploadExecutor] INIT success, media_id=${mediaId}`);

    // Phase 2: APPEND
    callbacks.onProgress('append', 0.1);
    let segmentIndex = 0;
    
    for await (const chunk of inputReader) {
        callbacks.checkCancellation();
        
        const appendUrl = 'https://upload.x.com/i/media/upload.json';
        const appendTxid = await getTransactionIdFor('POST', '/i/media/upload.json');

        const formData = new FormData();
        formData.append('command', 'APPEND');
        formData.append('media_id', mediaId);
        formData.append('segment_index', String(segmentIndex));
        // Use a Blob to convert Uint8Array properly for FormData
        formData.append('media', new Blob([chunk], { type: mimeType }), `chunk-${segmentIndex}`);

        const appendResponse = await fetch(appendUrl, {
            method: 'POST',
            headers: {
                'authorization': bearer,
                'x-csrf-token': csrf,
                'x-client-transaction-id': appendTxid,
                'x-twitter-auth-type': 'OAuth2Session',
            },
            body: formData,
            credentials: 'include'
        });

        if (!appendResponse.ok) {
            throw new Error(`Media upload APPEND failed at segment ${segmentIndex}: ${appendResponse.status} ${await appendResponse.text()}`);
        }
        
        segmentIndex++;
        const progress = 0.1 + (0.8 * segmentIndex / metadata.totalParts);
        callbacks.onProgress('append', progress);
    }

    // Phase 3: FINALIZE
    callbacks.onProgress('finalize', 0.9);
    callbacks.checkCancellation();
    const finalizeUrl = `https://upload.x.com/i/media/upload.json?command=FINALIZE&media_id=${mediaId}`;
    const finalizeTxid = await getTransactionIdFor('POST', '/i/media/upload.json');

    const finalizeResponse = await fetch(finalizeUrl, {
        method: 'POST',
        headers: {
            'authorization': bearer,
            'x-csrf-token': csrf,
            'x-client-transaction-id': finalizeTxid,
            'x-twitter-auth-type': 'OAuth2Session',
        },
        credentials: 'include'
    });

    if (!finalizeResponse.ok) {
        throw new Error(`Media upload FINALIZE failed: ${finalizeResponse.status} ${await finalizeResponse.text()}`);
    }

    // Phase 4: STATUS (Video only fallback hook)
    if (isVideo) {
      logger.info(`[MediaUploadExecutor] Video detected, waiting for processing...`);
      let processingComplete = false;
      let attempts = 0;
      const maxAttempts = params.videoPollingAttempts || 60;
      const pollDelayMs = params.videoPollingDelayMs || 5000;
      
      while (!processingComplete && attempts < maxAttempts) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollDelayMs));
          callbacks.checkCancellation();
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // fixed query timeout

          const statusUrl = `https://upload.x.com/i/media/upload.json?command=STATUS&media_id=${mediaId}`;
          const statusTxid = await getTransactionIdFor('GET', '/i/media/upload.json');
          try {
              const statusResponse = await fetch(statusUrl, {
                  method: 'GET',
                  headers: {
                      'authorization': bearer,
                      'x-csrf-token': csrf,
                      'x-client-transaction-id': statusTxid,
                      'x-twitter-auth-type': 'OAuth2Session',
                  },
                  credentials: 'include',
                  signal: controller.signal
              });
              
              if (statusResponse.ok) {
                  const statusData = await statusResponse.json();
                  logger.debug(`[MediaUploadExecutor] Poll status state:`, statusData.processing_info?.state);
                  if (statusData.processing_info?.state === 'succeeded') {
                      processingComplete = true;
                  } else if (statusData.processing_info?.state === 'failed') {
                      throw new Error(`Video processing failed`);
                  }
              }
          } catch(e: any) {
              logger.warn(`[MediaUploadExecutor] Status polling error on attempt ${attempts}`, e);
          } finally {
              clearTimeout(timeoutId);
          }
      }
    }

    callbacks.onProgress('done', 1.0);
    return new TextEncoder().encode(JSON.stringify({ mediaId }));
  }
}
