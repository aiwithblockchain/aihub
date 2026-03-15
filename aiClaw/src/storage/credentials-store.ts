/**
 * credentials-store.ts - 凭证读写工具模块
 *
 * 从 background.ts 中抽取，避免 adapter 直接依赖 Service Worker。
 * 所有凭证的读写操作都通过此模块进行。
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
    if (apiUrl) pc.apiEndpoint = apiUrl;
    if (Object.keys(headers).length > 0) pc.lastCapturedHeaders = headers;

    creds[platform] = pc;
    await saveCredentials(creds);
}
