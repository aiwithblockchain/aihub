import { __DBK_query_id_map, __DBK_bearer_token } from '../capture/consts';
import { buildFeatures, extractMissingFeature } from './feature_manager';
import { getTransactionIdFor } from './txid';

/**
 * Twitter API Client
 * Designed to run in Content Script (for cookies) and Background (for harvesting).
 */

async function getAuthHeader(): Promise<string> {
    const res = await chrome.storage.local.get(__DBK_bearer_token);
    return (res[__DBK_bearer_token] as string) || "";
}

async function getCsrfToken(): Promise<string> {
    // Content script: read from document.cookie
    // Background: read from chrome.cookies
    if (typeof document !== 'undefined' && document.cookie) {
        const match = document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/);
        if (match) return match[1];
    }
    
    return new Promise((resolve) => {
        chrome.cookies.get({ url: 'https://x.com', name: 'ct0' }, (cookie) => {
            resolve(cookie ? cookie.value : "");
        });
    });
}

async function getUrlWithQueryId(op: string): Promise<{ url: string, path: string } | null> {
    const res = await chrome.storage.local.get(__DBK_query_id_map);
    const map = (res[__DBK_query_id_map] || {}) as Record<string, string>;
    const queryId = map[op];
    if (!queryId) return null;
    const url = `https://x.com/i/api/graphql/${queryId}/${op}`;
    const path = `/i/api/graphql/${queryId}/${op}`;
    return { url, path };
}

export async function performMutation(op: string, variables: any, retryCount = 0): Promise<any> {
    const target = await getUrlWithQueryId(op);
    if (!target) throw new Error(`Missing harvested queryId for operation: ${op}`);

    const bearer = await getAuthHeader();
    const csrf = await getCsrfToken();

    // TweetCat txid logic
    const txid = await getTransactionIdFor('POST', target.path);

    const headers: Record<string, string> = {
        'authorization': bearer,
        'x-csrf-token': csrf as string,
        'x-client-transaction-id': txid,
        'content-type': 'application/json',
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-client-language': 'zh-cn',
        'referer': 'https://x.com/',
        'accept': '*/*'
    };

    // Some operations (like CreateBookmark, DeleteBookmark) don't need features
    const operationsWithoutFeatures = ['CreateBookmark', 'DeleteBookmark'];
    const needsFeatures = !operationsWithoutFeatures.includes(op);

    const payload: any = {
        variables,
        queryId: target.url.split('/')[6]  // Fix: should be index 6, not 5
    };

    // Only add features if needed
    if (needsFeatures) {
        const features = await buildFeatures(op);
        payload.features = features;
        console.log(`[TwitterAPI] ${op} request with features:`, Object.keys(features));
    } else {
        console.log(`[TwitterAPI] ${op} request without features`);
    }

    const response = await fetch(target.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        credentials: 'include'
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`[TwitterAPI] ${op} failed (${response.status}):`, text);

        // Try to extract missing feature from error response
        const missingFeature = await extractMissingFeature(text);

        // If we found a missing feature and haven't retried yet, retry with the new feature
        if (missingFeature && retryCount === 0) {
            console.warn(`[TwitterAPI] ${op} missing feature: ${missingFeature}, retrying...`);
            return performMutation(op, variables, retryCount + 1);
        }

        throw new Error(`X API Error ${response.status} for ${op}: ${text}`);
    }

    return await response.json();
}

/**
 * 专门处理推特老旧的 1.1 REST API（如 friendships/create.json）
 * 这些接口不使用 GraphQL，也不需要 queryId。
 */
export async function performLegacyREST(path: string, params: Record<string, string>) {
    const bearer = await getAuthHeader();
    const csrf = await getCsrfToken();
    const txid = await getTransactionIdFor('POST', path);

    const headers: Record<string, string> = {
        'authorization': bearer,
        'x-csrf-token': csrf as string,
        'x-client-transaction-id': txid,
        'content-type': 'application/x-www-form-urlencoded',
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
        'referer': 'https://x.com/',
        'accept': '*/*'
    };

    const url = `https://x.com${path}`;
    const body = new URLSearchParams(params).toString();

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        credentials: 'include'
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`X Legacy API Error ${response.status} for ${path}: ${text}`);
    }

    return await response.json();
}

/**
 * 使用稳定的 QueryId 抓取用户资料（绕过哈希变动问题）
 * 仅供在 Content Script 环境（由于 Cookie 权限问题）使用
 */
export async function fetchUserByScreenName(screenName: string): Promise<any> {
    const STABLE_HASH = 'ck5KkZ8t5cOmoLssopN99Q';
    const variables = {
        screen_name: screenName,
        withSafetyModeUserFields: true,
    };
    const features = {
        hidden_profile_likes_enabled: true,
        hidden_profile_subscriptions_enabled: true,
        responsive_web_graphql_exclude_directive_enabled: true,
        verified_phone_label_enabled: false,
        subscriptions_verification_info_is_identity_verified_enabled: true,
        subscriptions_verification_info_verified_since_enabled: true,
        highlights_tweets_tab_ui_enabled: true,
        responsive_web_twitter_article_notes_tab_enabled: false,
        creator_subscriptions_tweet_preview_api_enabled: true,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        responsive_web_graphql_timeline_navigation_enabled: true,
    };

    const params = new URLSearchParams();
    params.append('variables', JSON.stringify(variables));
    params.append('features', JSON.stringify(features));

    const url = `https://x.com/i/api/graphql/${STABLE_HASH}/UserByScreenName?${params.toString()}`;

    // 优先使用动态 harvested 的 Bearer Token，fallback 到写死的默认值
    const bearerFromStorage = await getAuthHeader();
    const FALLBACK_BEARER = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
    const bearer = bearerFromStorage || FALLBACK_BEARER;

    // CSRF Token（仅限内容脚本上下文，document.cookie 可访问）
    const csrfToken = await getCsrfToken();

    console.log(`[TwitterAPI] fetchUserByScreenName: bearer=${bearer ? 'present' : 'MISSING'}, csrf=${csrfToken ? 'present' : 'MISSING'}`);

    const headers: Record<string, string> = {
        'authorization': bearer,
        'x-csrf-token': csrfToken,
        'content-type': 'application/json',
        'x-twitter-active-user': 'yes',
        'x-twitter-client-language': 'en',
        'referer': 'https://x.com/',
        'accept': '*/*'
    };

    console.log('[TwitterAPI] fetchUserByScreenName: sending fetch...');
    let response: Response;
    try {
        response = await fetch(url, {
            method: 'GET',
            headers,
            credentials: 'include'
        });
    } catch (networkErr: any) {
        console.error('[TwitterAPI] fetchUserByScreenName: network error', networkErr);
        throw networkErr;
    }

    console.log(`[TwitterAPI] fetchUserByScreenName: response status ${response.status}`);

    if (!response.ok) {
        const errText = await response.text();
        console.error(`[TwitterAPI] fetchUserByScreenName: ${response.status}`, errText.slice(0, 200));
        throw new Error(`UserByScreenName failed: ${response.status}`);
    }

    const json = await response.json();
    console.log('[TwitterAPI] fetchUserByScreenName: got JSON, keys=', Object.keys(json));
    return json;
}

export async function performQuery(op: string, variables: any, retryCount = 0): Promise<any> {
    const target = await getUrlWithQueryId(op);
    if (!target) throw new Error(`Missing harvested queryId for operation: ${op}`);

    const bearer = await getAuthHeader();
    const csrf = await getCsrfToken();
    const features = await buildFeatures(op);

    // Add transaction ID for GET requests (same as performMutation)
    const txid = await getTransactionIdFor('GET', target.path);

    const params = new URLSearchParams();
    params.append('variables', JSON.stringify(variables));
    params.append('features', JSON.stringify(features));

    const url = `${target.url}?${params.toString()}`;

    const headers: Record<string, string> = {
        'authorization': bearer,
        'x-csrf-token': csrf as string,
        'x-client-transaction-id': txid,
        'content-type': 'application/json',
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-client-language': 'en',
        'referer': 'https://x.com/',
        'accept': '*/*'
    };

    const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include'
    });

    if (!response.ok) {
        const text = await response.text();
        await extractMissingFeature(text);

        // For 404 errors, retry once with fresh features
        if (response.status === 404 && retryCount === 0) {
            console.warn(`[TwitterAPI] ${op} query returned 404, retrying with fresh features...`);
            await new Promise(resolve => setTimeout(resolve, 500));
            return performQuery(op, variables, retryCount + 1);
        }

        throw new Error(`X API Error ${response.status} for ${op}: ${text}`);
    }

    const result = await response.json();
    console.log(`[TwitterAPI] GraphQL ${op} Response:`, result);
    return result;
}

/**
 * 根据用户名获取完整的用户 Profile 信息
 */
export async function fetchUserByUsername(username: string) {
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    const data = await performQuery('UserByScreenName', {
        screen_name: cleanUsername,
        withSafetyModeUserFields: true
    });
    
    // 从复杂的 GraphQL 响应中提取用户对象
    const userResult = data?.data?.user?.result;
    if (!userResult || userResult.__typename === 'UserUnavailable') {
        return null;
    }
    
    return userResult;
}

/**
 * 根据 User ID 获取完整的用户 Profile 信息 (UserByRestId)
 */
export async function fetchUserByRestId(userId: string) {
    const data = await performQuery('UserByRestId', {
        userId: userId,
        withSafetyModeUserFields: true
    });

    const userResult = data?.data?.user?.result;
    if (!userResult || userResult.__typename === 'UserUnavailable') {
        return null;
    }

    return userResult;
}

/**
 * 媒体上传 API - 三步流程
 * 1. INIT: 初始化上传,获取 media_id
 * 2. APPEND: 上传媒体数据
 * 3. FINALIZE: 完成上传
 */

interface MediaUploadInitResponse {
    media_id: number;
    media_id_string: string;
    expires_after_secs: number;
}

interface MediaUploadFinalizeResponse {
    media_id: number;
    media_id_string: string;
    size: number;
    expires_after_secs: number;
    image?: {
        image_type: string;
        w: number;
        h: number;
    };
}

/**
 * 上传媒体文件(图片)
 * @param mediaData Base64 编码的媒体数据
 * @param mimeType MIME 类型,如 image/png, image/jpeg
 * @returns media_id_string
 */
export async function uploadMedia(mediaData: string, mimeType: string): Promise<string> {
    const bearer = await getAuthHeader();
    const csrf = await getCsrfToken();

    // 将 base64 转换为 Blob
    const byteString = atob(mediaData);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeType });
    const totalBytes = blob.size;

    // 根据 MIME 类型确定 media_category
    const isVideo = mimeType.startsWith('video/');
    const mediaCategory = isVideo ? 'tweet_video' : 'tweet_image';

    // 步骤 1: INIT
    const mediaType = encodeURIComponent(mimeType);
    const initUrl = `https://upload.x.com/i/media/upload.json?command=INIT&total_bytes=${totalBytes}&media_type=${mediaType}&media_category=${mediaCategory}`;

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
        const text = await initResponse.text();
        throw new Error(`Media upload INIT failed: ${initResponse.status} ${text}`);
    }

    const initData: MediaUploadInitResponse = await initResponse.json();
    const mediaId = initData.media_id_string;

    console.log(`[TwitterAPI] Media upload INIT success, media_id=${mediaId}`);

    // 步骤 2: APPEND
    const appendUrl = `https://upload.x.com/i/media/upload.json?command=APPEND&media_id=${mediaId}&segment_index=0`;
    const appendTxid = await getTransactionIdFor('POST', '/i/media/upload.json');

    const formData = new FormData();
    formData.append('media', blob, 'blob');

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
        const text = await appendResponse.text();
        throw new Error(`Media upload APPEND failed: ${appendResponse.status} ${text}`);
    }

    console.log(`[TwitterAPI] Media upload APPEND success`);

    // 步骤 3: FINALIZE
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
        const text = await finalizeResponse.text();
        throw new Error(`Media upload FINALIZE failed: ${finalizeResponse.status} ${text}`);
    }

    const finalizeData: MediaUploadFinalizeResponse = await finalizeResponse.json();
    console.log(`[TwitterAPI] Media upload FINALIZE success, media_id=${finalizeData.media_id_string}`);

    // 步骤 4: 如果是视频,需要轮询 STATUS 等待处理完成
    if (isVideo) {
        console.log(`[TwitterAPI] Video detected, waiting for processing...`);
        let processingComplete = false;
        let attempts = 0;
        const maxAttempts = 60; // 最多等待 60 次 (约 5 分钟)

        while (!processingComplete && attempts < maxAttempts) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 5000)); // 等待 5 秒

            const statusUrl = `https://upload.x.com/i/media/upload.json?command=STATUS&media_id=${mediaId}`;
            const statusTxid = await getTransactionIdFor('GET', '/i/media/upload.json');

            const statusResponse = await fetch(statusUrl, {
                method: 'GET',
                headers: {
                    'authorization': bearer,
                    'x-csrf-token': csrf,
                    'x-client-transaction-id': statusTxid,
                    'x-twitter-auth-type': 'OAuth2Session',
                },
                credentials: 'include'
            });

            if (!statusResponse.ok) {
                console.warn(`[TwitterAPI] STATUS check failed: ${statusResponse.status}`);
                break;
            }

            const statusData: any = await statusResponse.json();
            console.log(`[TwitterAPI] Video processing status: ${statusData.processing_info?.state || 'unknown'}`);

            if (statusData.processing_info?.state === 'succeeded') {
                processingComplete = true;
                console.log(`[TwitterAPI] Video processing completed successfully`);
            } else if (statusData.processing_info?.state === 'failed') {
                throw new Error(`Video processing failed: ${statusData.processing_info?.error?.message || 'unknown error'}`);
            }
            // 如果是 'pending' 或 'in_progress',继续轮询
        }

        if (!processingComplete) {
            console.warn(`[TwitterAPI] Video processing timeout after ${attempts} attempts`);
        }
    }

    return finalizeData.media_id_string;
}
