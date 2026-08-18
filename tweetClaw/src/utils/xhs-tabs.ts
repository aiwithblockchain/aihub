import { getLiveTabIdsForPlatform } from './live-tabs';
import { sendMessageToTab } from './message-utils';

const XHS_CREATOR_URL = 'https://creator.xiaohongshu.com/new/note-manager?source=official';

async function pickMinLiveCreatorTab(): Promise<number | null> {
    const creatorTabs = await chrome.tabs.query({ url: ['*://creator.xiaohongshu.com/*'] });
    const liveIds = new Set(await getLiveTabIdsForPlatform('xiaohongshu'));
    const ids = creatorTabs
        .map(t => t.id)
        .filter((id): id is number => id != null && liveIds.has(id));
    if (ids.length) {
        console.log(`[TweetClaw-BG] find existing live creator tab(s): ${JSON.stringify(ids)}`);
    }
    return ids.length ? Math.min(...ids) : null;
}

async function waitSignReady(tabId: number, timeoutMs = 30_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 800));
        try {
            const pong: any = await sendMessageToTab(tabId, { type: 'XHS_PING' });
            if (!pong?.ok) continue;
            const sign: any = await sendMessageToTab(tabId, {
                type: 'XHS_SIGN_TEST',
                url: '/api/sns/web/v2/user/me',
                data: '',
            });
            if (sign?.success && sign?.data?.['x-s'] && sign?.data?.['x-s-common']) {
                console.log(`[TweetClaw-BG] creator tab sign ready: tabId=${tabId}`);
                return true;
            }
            console.log(`[TweetClaw-BG] creator tab not sign ready yet: tabId=${tabId}`);
        } catch {
            // content script 尚未就绪，继续等待
            console.log(`[TweetClaw-BG] creator tab content script not ready yet: tabId=${tabId}`);
        }
    }
    return false;
}

/**
 * 确保存在一个可用的 creator.xiaohongshu.com tab。
 * 只供 XHS 发布 / 上传任务使用；读取类业务不自动开 tab。
 */
export async function ensureXhsCreatorTab(): Promise<number> {
    const existing = await pickMinLiveCreatorTab();
    if (existing != null) {
        if (await waitSignReady(existing)) {
            return existing;
        }
        // 已存在但签名链路未就绪：刷新一次再重试，避免带着未就绪 tab 直接发布。
        console.log(`[TweetClaw-BG] existing creator tab sign not ready, reloading: tabId=${existing}`);
        await chrome.tabs.reload(existing, { bypassCache: true });
        await new Promise(r => setTimeout(r, 3_000));
        if (await waitSignReady(existing)) {
            return existing;
        }
    }

    console.log(`[TweetClaw-BG] opening new creator tab: url=${XHS_CREATOR_URL}`);
    const created = await chrome.tabs.create({ url: XHS_CREATOR_URL, active: false });
    const tabId = created.id!;
    if (await waitSignReady(tabId)) {
        return tabId;
    }
    throw new Error('creator.xiaohongshu.com tab sign function not ready within 30s');
}
