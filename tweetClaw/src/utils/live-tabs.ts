/**
 * 存活健康表共享工具。
 *
 * background 与 task-executor 都会读取 per-tab 存活信息；content script 负责写入。
 * 键格式统一为 `tweetclaw:alive:<platform>:<tabId>`，值是最新存活时间戳。
 */

export const TWEETCLAW_ALIVE_KEY_PREFIX = 'tweetclaw:alive:';
export const TWEETCLAW_TAB_STALE_AFTER_MS = 60_000; // 3 × LIVE_INTERVAL_MS

export interface TabAccountInfo {
  username?: string | null;
  userId?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export type TabLoginState = 'logged_in' | 'logged_out' | 'unknown';

export interface AliveEntry {
  ts: number;
  state: TabLoginState;
  account?: TabAccountInfo;
  url?: string;
  role?: 'main' | 'creator';
  loggedOutCount?: number;
}

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

        const ts = typeof value === 'number' ? value : (value as AliveEntry)?.ts;
        if (typeof ts === 'number' && now - ts <= TWEETCLAW_TAB_STALE_AFTER_MS) {
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

function parseAliveEntry(value: unknown): AliveEntry | null {
    if (typeof value === 'number') {
        return { ts: value, state: 'unknown' };
    }
    if (value && typeof value === 'object' && typeof (value as AliveEntry).ts === 'number') {
        return value as AliveEntry;
    }
    return null;
}

function isCreatorXhsUrl(url?: string): boolean {
    return !!url && url.includes('creator.xiaohongshu.com');
}

/**
 * 从健康表聚合当前 online 账号。
 * XHS 只以 main tab（非 creator）的账号信息为准；creator tab 仅保留健康记录。
 */
export async function getLiveAccounts(): Promise<Record<string, TabAccountInfo>> {
    const all = await chrome.storage.session.get(null);
    const now = Date.now();
    const latestByPlatform = new Map<string, { ts: number; account?: TabAccountInfo }>();

    for (const [key, value] of Object.entries(all)) {
        if (!key.startsWith(TWEETCLAW_ALIVE_KEY_PREFIX)) continue;
        const parts = key.slice(TWEETCLAW_ALIVE_KEY_PREFIX.length).split(':');
        if (parts.length !== 2) continue;

        const platform = parts[0];
        const entry = parseAliveEntry(value);
        if (!entry || now - entry.ts > TWEETCLAW_TAB_STALE_AFTER_MS) continue;
        if (entry.state !== 'logged_in' || !entry.account) continue;
        if (platform === 'xiaohongshu' && isCreatorXhsUrl(entry.url)) continue;

        const prev = latestByPlatform.get(platform);
        if (!prev || entry.ts > prev.ts) {
            latestByPlatform.set(platform, { ts: entry.ts, account: entry.account });
        }
    }

    const result: Record<string, TabAccountInfo> = {};
    for (const [platform, value] of latestByPlatform) {
        if (value.account) result[platform] = value.account;
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
        const entry = parseAliveEntry(value);
        if (!entry || now - entry.ts > TWEETCLAW_TAB_STALE_AFTER_MS) {
            staleKeys.push(key);
        }
    }

    if (staleKeys.length) {
        await chrome.storage.session.remove(staleKeys);
    }
}
