/**
 * credentials-store.ts - 凭证读写工具模块
 */

import { STORAGE_KEY_CREDENTIALS } from '../capture/consts';
import type { PlatformType } from '../capture/consts';

export interface PlatformCredentials {
    bearerToken: string | null;
    apiEndpoint: string | null;
    lastCapturedHeaders: Record<string, string>;
    lastCapturedAt: number;
    captureCount: number;
}

export interface AllCredentials {
    chatgpt: PlatformCredentials;
    gemini: PlatformCredentials;
    grok: PlatformCredentials;
}

export function emptyCredentials(): PlatformCredentials {
    return {
        bearerToken: null,
        apiEndpoint: null,
        lastCapturedHeaders: {},
        lastCapturedAt: 0,
        captureCount: 0,
    };
}

export function defaultAllCredentials(): AllCredentials {
    return {
        chatgpt: emptyCredentials(),
        gemini: emptyCredentials(),
        grok: emptyCredentials(),
    };
}

export async function loadCredentials(): Promise<AllCredentials> {
    const res = await chrome.storage.local.get(STORAGE_KEY_CREDENTIALS);
    const creds = res[STORAGE_KEY_CREDENTIALS];
    if (creds && typeof creds === 'object' && 'chatgpt' in creds && 'gemini' in creds && 'grok' in creds) {
        return creds as AllCredentials;
    }
    return defaultAllCredentials();
}

export async function saveCredentials(creds: AllCredentials): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY_CREDENTIALS]: creds });
}

export async function clearPlatformCredentials(platform: PlatformType): Promise<void> {
    const creds = await loadCredentials();
    creds[platform].bearerToken = null;
    creds[platform].apiEndpoint = null;
    await saveCredentials(creds);
    console.log(`[aiClaw] 🗑️ Cleared credentials for ${platform}`);
}

// ChatGPT 的 conversation 端点，只有 POST 请求才是真正发消息的接口
const CHATGPT_CONVERSATION_ENDPOINT = 'https://chatgpt.com/backend-api/conversation';

export async function updatePlatformCredentials(
    platform: PlatformType,
    bearerToken: string | null,
    apiUrl: string | null,
    headers: Record<string, string>
): Promise<void> {
    const creds = await loadCredentials();
    const pc = creds[platform];

    pc.lastCapturedAt = Date.now();
    pc.captureCount += 1;

    if (bearerToken) pc.bearerToken = bearerToken;

    // apiEndpoint 只存 POST conversation 端点，不被 GET 请求的 URL 覆盖
    // ChatGPT 的 GET 请求（me、conversations 等）不是发消息用的端点
    if (apiUrl) {
        if (platform === 'chatgpt') {
            // 只有 conversation 端点才更新
            if (apiUrl.includes('backend-api/conversation') && !apiUrl.includes('conversation/')) {
                pc.apiEndpoint = CHATGPT_CONVERSATION_ENDPOINT;
            } else if (!pc.apiEndpoint) {
                // 没有存过任何端点时先存一个基础值，后续会被真实的 conversation 请求覆盖
                pc.apiEndpoint = CHATGPT_CONVERSATION_ENDPOINT;
            }
        } else {
            pc.apiEndpoint = apiUrl;
        }
    }

    // 合并请求头，保留所有捕获到的 oai-* 等关键头
    if (Object.keys(headers).length > 0) {
        pc.lastCapturedHeaders = { ...pc.lastCapturedHeaders, ...headers };
    }

    creds[platform] = pc;
    await saveCredentials(creds);
}
