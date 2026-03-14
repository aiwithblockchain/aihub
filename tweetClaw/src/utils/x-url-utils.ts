/**
 * x-url-utils.ts - Shared helpers for X URL generation and validation.
 */

export function validateTweetDetailParams(screenName: string, tweetId: string): { ok: boolean, error?: string } {
    if (!screenName) return { ok: false, error: 'screenName is required' };
    if (!tweetId) return { ok: false, error: 'tweetId is required' };

    if (screenName.includes(' ') || screenName.includes('/')) {
        return { ok: false, error: 'Invalid screenName: must not contain spaces or slashes.' };
    }
    if (!/^\d+$/.test(tweetId)) {
        return { ok: false, error: 'Invalid tweetId: must be a numeric string.' };
    }

    return { ok: true };
}

export function formatTweetDetailUrl(screenName: string, tweetId: string): string {
    const cleanedHandle = screenName.startsWith('@') ? screenName.slice(1) : screenName;
    return `https://x.com/${cleanedHandle}/status/${tweetId}`;
}
