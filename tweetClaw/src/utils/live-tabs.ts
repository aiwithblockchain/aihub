/**
 * 存活健康表共享工具。
 *
 * background 与 task-executor 都会读取 per-tab 存活信息；content script 负责写入。
 * 键格式统一为 `tweetclaw:alive:<platform>:<tabId>`，值是最新存活时间戳。
 */

export const TWEETCLAW_ALIVE_KEY_PREFIX = 'tweetclaw:alive:';
export const TWEETCLAW_TAB_STALE_AFTER_MS = 60_000; // 3 × LIVE_INTERVAL_MS

export async function getLiveTabs(): Promise<Record<string, number[]>> {
    const all = await chrome.storage.session.get(null);
    const now = Date.now();
    const result: Record<string, number[]> = {};
    const staleKeys: string[] = [];

    for (const [key, value] of Object.entries(all)) {
        if (!key.startsWith(TWEETCLAW_ALIVE_KEY_PREFIX)) continue;
        const parts = key.slice(TWEETCLAW_ALIVE_KEY_PREFIX.length).split(':');
        if (parts.length !== 2) continue;

        const platform = parts[0];
        const tabId = Number(parts[1]);
        if (!Number.isInteger(tabId) || tabId <= 0) continue;

        if (typeof value === 'number' && now - value <= TWEETCLAW_TAB_STALE_AFTER_MS) {
            (result[platform] ||= []).push(tabId);
        } else {
            staleKeys.push(key);
        }
    }

    if (staleKeys.length) {
        void chrome.storage.session.remove(staleKeys).catch(() => {});
    }
    return result;
}

export async function getLiveTabIdsForPlatform(platform: string): Promise<number[]> {
    const liveTabs = await getLiveTabs();
    return liveTabs[platform] ?? [];
}

export async function pruneStaleHealthEntries(): Promise<void> {
    const all = await chrome.storage.session.get(null);
    const now = Date.now();
    const staleKeys: string[] = [];

    for (const [key, value] of Object.entries(all)) {
        if (!key.startsWith(TWEETCLAW_ALIVE_KEY_PREFIX)) continue;
        if (typeof value !== 'number' || now - value > TWEETCLAW_TAB_STALE_AFTER_MS) {
            staleKeys.push(key);
        }
    }

    if (staleKeys.length) {
        await chrome.storage.session.remove(staleKeys);
    }
}
