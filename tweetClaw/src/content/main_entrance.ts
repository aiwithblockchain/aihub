import { MsgType } from '../capture/consts';
import {
    performMutation,
    performLegacyREST,
    fetchUserByScreenName,
    performQuery,
    getAuthHeader,
    getCsrfToken,
    MEDIA_APPEND_CHUNK_SIZE_BYTES
} from '../x_api/twitter_api';
import { findDeepUser } from '../capture/extractor';
import { UserProfile } from '../object/user_info';
import { getTransactionIdFor } from '../x_api/txid';
import { ContentTaskRunner } from './content-task-runner';
import { StartTaskUploadFromBgSessionMessage } from '../task/types';

const MEDIA_TRANSFER_CHUNK_BYTES = 3 * 1024 * 1024;
const contentTaskRunner = new ContentTaskRunner();

/**
 * main_entrance.ts - Content Script Supervisor
 *
 * 职责：
 *  1. 将 injection.js 注入页面上下文
 *  2. 中继 injection → background 的消息（包括 apiUrl、bearerToken）
 *  3. 执行写操作（mutation）—— 唯一合法的写操作执行环境
 */

(function inject() {
    if (document.getElementById('tc_injection')) return;
    const script = document.createElement('script');
    script.id = 'tc_injection';
    script.src = chrome.runtime.getURL('js/injection.js');
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();
})();

window.addEventListener('message', (event) => {
    if (event.data?.source !== 'tweetclaw-injection') return;

    // ── 直接在 Content Script 层捕获 settings.json，立刻写入 storage ──
    // 修复背景：settings.json 是 REST 接口，响应体没有 id_str 字段。
    // background 里的 findViewerSummary 会因为 userId==='' 与 twid cookie uid 不匹配
    // 而 return null，导致 screenName 从未被写入 chrome.storage.local。
    // 解决方式：绕过 background 链路，在 Content Script 自己直接写。
    if (event.data.type === 'SIGNAL_CAPTURED' && event.data.op === 'settings.json') {
        const d = event.data.data;
        const screenName: string | undefined = d?.screen_name;
        const userId: string | undefined = d?.id_str || (d?.id ? String(d.id) : undefined);
        if (screenName) {
            const toStore: Record<string, string> = { screenName };
            if (userId) toStore.userId = userId;
            chrome.storage.local.set(toStore).then(() => {
                console.log(`[TweetClaw-CS] ✅ screenName cached from settings.json: @${screenName}`);
            }).catch(() => {});
        }
    }

    // ── 捕获并缓存 per-operation features ──
    if (event.data.type === 'SIGNAL_CAPTURED' && event.data.features) {
        const op = event.data.op;
        const features = event.data.features;

        // 导入 cacheOperationFeatures 并缓存
        import('../x_api/feature_manager').then(({ cacheOperationFeatures }) => {
            cacheOperationFeatures(op, features).catch(() => {});
        });
    }

    if (event.data.type === 'SIGNAL_CAPTURED') {
        if (!chrome.runtime?.id) return;
        chrome.runtime.sendMessage({
            type: 'CAPTURED_DATA',
            op: event.data.op,
            apiUrl: event.data.apiUrl,                         // ← 真实 API 端点 URL
            pageUrl: event.data.pageUrl || window.location.href, // ← 当前页面 URL
            method: event.data.method,
            requestBody: event.data.requestBody,
            bearerToken: event.data.bearerToken || null,       // ← bearer token（如已从请求头捕获）
            data: event.data.data
        });
    }

    if (event.data.type === 'HOOK_STATUS_REPORT') {
        if (!chrome.runtime?.id) return;
        chrome.runtime.sendMessage({
            type: 'REPORT_HOOK_STATUS',
            status: event.data.status
        });
    }
});

async function getUploadSessionChunk(uploadSessionId: string, chunkIndex: number): Promise<Blob> {
    console.log(`[TweetClaw-CS] requesting upload chunk, sessionId=${uploadSessionId}, chunkIndex=${chunkIndex}`);
    const response = await chrome.runtime.sendMessage({
        type: 'GET_UPLOAD_SESSION_CHUNK',
        uploadSessionId,
        chunkIndex
    });

    if (!response?.success || !response.chunkData) {
        console.error(`[TweetClaw-CS] upload chunk failed, sessionId=${uploadSessionId}, chunkIndex=${chunkIndex}, error=${response?.error || 'unknown'}`);
        throw new Error(response?.error || 'Failed to get upload session chunk');
    }

    console.log(`[TweetClaw-CS] upload chunk received, sessionId=${uploadSessionId}, chunkIndex=${chunkIndex}, chunkDataLength=${response.chunkData.length}`);
    return new Blob([new Uint8Array(response.chunkData)], { type: response.mimeType });
}

async function releaseUploadSession(uploadSessionId: string): Promise<void> {
    console.log(`[TweetClaw-CS] releasing upload session, sessionId=${uploadSessionId}`);
    await chrome.runtime.sendMessage({
        type: 'RELEASE_UPLOAD_SESSION',
        uploadSessionId
    }).catch(() => {});
}

async function pageUploadProxy(payload: any): Promise<any> {
    const requestId = `upload_proxy_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    console.log(`[TweetClaw-CS] page proxy dispatch, requestId=${requestId}, kind=${payload.kind}, method=${payload.method}, url=${payload.url}`);

    return new Promise((resolve, reject) => {
        const timeoutMs = payload.kind === 'append' ? 120000 : 30000;
        const timeout = setTimeout(() => {
            document.removeEventListener('tweetclaw:upload-proxy-response', onMessage as EventListener);
            console.error(`[TweetClaw-CS] page proxy timeout, requestId=${requestId}, kind=${payload.kind}, url=${payload.url}`);
            reject(new Error('Timed out waiting for page upload proxy response'));
        }, timeoutMs);

        function onMessage(event: Event) {
            const detail = (event as CustomEvent).detail;
            if (!detail || detail.requestId !== requestId) return;

            clearTimeout(timeout);
            document.removeEventListener('tweetclaw:upload-proxy-response', onMessage as EventListener);
            console.log(`[TweetClaw-CS] page proxy response, requestId=${requestId}, ok=${Boolean(detail.ok)}, status=${detail.status ?? 'n/a'}`);

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
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MsgType.PING || message.type === 'TC_PING') {
        sendResponse({ ok: true, url: window.location.href, context: 'CONTENT_SCRIPT' });
        return true;
    }

    if (message.type === 'CHECK_LOGIN') {
        console.log('[TweetClaw-CS][A41] CHECK_LOGIN received, tabId=', message.tabId);
        (async () => {
            try {
                const btn = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
                console.log('[TweetClaw-CS][A41] Twitter SideNav_AccountSwitcher_Button found=', !!btn);
                if (!btn) {
                    sendResponse({ loggedIn: false, platform: 'twitter', tabId: message.tabId ?? null });
                    return;
                }
                // 限定在 btn 子树内，避免命中 feed 流里其他用户的同名 testid 容器
                const avatarContainer = btn.querySelector('[data-testid^="UserAvatar-Container-"]');
                const username = avatarContainer
                    ?.getAttribute('data-testid')
                    ?.replace('UserAvatar-Container-', '') || null;

                // 1. 优先从 <img> 提取 displayName 和 avatarUrl
                let img = btn.querySelector('img[alt][src*="pbs.twimg.com/profile_images"]');
                // Fallback: 尝试更宽松的选择器（不限制 pbs.twimg.com）
                if (!img) {
                    img = btn.querySelector('img[alt]');
                }
                let displayName = img?.getAttribute('alt') || null;
                let avatarUrl = img?.getAttribute('src') || null;

                // 2. Fallback: 从 background-image div 提取 avatarUrl（img 尚未渲染时）
                if (!avatarUrl) {
                    const bgDiv = btn.querySelector('div[style*="pbs.twimg.com/profile_images"]');
                    if (bgDiv) {
                        const style = bgDiv.getAttribute('style') || '';
                        const match = style.match(/url\(["']?(https:\/\/pbs\.twimg\.com\/profile_images\/[^"')\s]+)["']?\)/);
                        if (match) avatarUrl = match[1];
                    }
                }

                // 3. Fallback: 从侧边栏文字提取 displayName（不含 @handle 的那个 div）
                if (!displayName) {
                    const nameDivs = Array.from(btn.querySelectorAll('div[dir="ltr"]'));
                    for (const div of nameDivs) {
                        const text = div.textContent?.trim();
                        if (text && !text.startsWith('@') && text !== username) {
                            displayName = text;
                            break;
                        }
                    }
                }

                // 4. 最终 fallback: 如果还是没有 avatarUrl，尝试查找任何 img
                if (!avatarUrl) {
                    const anyImg = btn.querySelector('img[src]');
                    const src = anyImg?.getAttribute('src');
                    if (src && (src.includes('profile_images') || src.includes('avatar'))) {
                        avatarUrl = src;
                    }
                }

                // 4. 获取 userId：优先 chrome.storage.local（settings.json 拦截写入），fallback 到 twid cookie
                let userId: string | null = null;
                if (username) {
                    try {
                        const stored = await chrome.storage.local.get(['userId', 'screenName']);
                        // screenName 可能带 @ 前缀，统一去掉再比较
                        const storedSn = (stored.screenName as string | undefined)?.replace(/^@/, '');
                        if (storedSn === username && stored.userId) {
                            userId = String(stored.userId);
                        }
                    } catch {}
                }
                // Fallback: twid cookie 是 HttpOnly，CS 读不到，通过 background 读取
                if (!userId) {
                    try {
                        const resp = await chrome.runtime.sendMessage({ type: 'GET_AUTH_UID' });
                        if (resp?.uid) {
                            userId = String(resp.uid);
                            console.log('[TweetClaw-CS][A41] userId from twid cookie:', userId);
                        }
                    } catch {}
                }

                console.log('[TweetClaw-CS][A41] Twitter logged_in, username=', username, 'displayName=', displayName, 'userId=', userId);
                sendResponse({
                    loggedIn: true,
                    platform: 'twitter',
                    tabId: message.tabId ?? null,
                    account: { username, userId, displayName, avatarUrl },
                });
            } catch (e: any) {
                console.warn('[TweetClaw-CS][A41] Twitter CHECK_LOGIN error:', e?.message || String(e));
                sendResponse({ loggedIn: false, platform: 'twitter', tabId: message.tabId ?? null, error: String(e) });
            }
        })();
        return true;
    }

    if (message.type === MsgType.EXECUTE_ACTION) {
        let op = '';
        let vars: any = { tweet_id: message.tweetId };

        switch (message.action) {
            case 'like':     op = 'FavoriteTweet'; break;
            case 'retweet':  op = 'CreateRetweet'; break;
            case 'bookmark': op = 'CreateBookmark'; break;
            case 'follow':   op = 'CreateFriendship'; vars = { user_id: message.userId }; break;
            case 'unfollow': op = 'DestroyFriendship'; vars = { user_id: message.userId }; break;
            case 'post_tweet':
                // 发布新推文
                op = 'CreateTweet';
                vars = {
                    tweet_text: message.text || '',
                    media: {
                        media_entities: (message.media_ids || []).map((id: string) => ({ media_id: id, tagged_users: [] })),
                        possibly_sensitive: false
                    },
                    semantic_annotation_ids: [],
                    broadcast: true,
                    disallowed_reply_options: null
                };
                break;
            case 'reply_tweet':
                // 回复推文
                op = 'CreateTweet';
                vars = {
                    tweet_text: message.text || '',
                    reply: {
                        in_reply_to_tweet_id: message.tweetId,
                        exclude_reply_user_ids: []
                    },
                    media: {
                        media_entities: (message.media_ids || []).map((id: string) => ({ media_id: id, tagged_users: [] })),
                        possibly_sensitive: false
                    },
                    semantic_annotation_ids: [],
                    broadcast: true,
                    disallowed_reply_options: null
                };
                break;
            case 'quote_tweet':
                // 引用转发：本质上是 CreateTweet + attachment_url
                op = 'CreateTweet';
                vars = {
                    tweet_text: message.text || '',
                    attachment_url: message.attachmentUrl || '',
                    media: {
                        media_entities: (message.media_ids || []).map((id: string) => ({ media_id: id, tagged_users: [] })),
                        possibly_sensitive: false
                    },
                    semantic_annotation_ids: [],
                    broadcast: true,
                    disallowed_reply_options: null
                };
                break;
            case 'unlike':
                op = 'UnfavoriteTweet';
                vars = { tweet_id: message.tweetId };
                break;
            case 'unretweet':
                op = 'DeleteRetweet';
                vars = { source_tweet_id: message.tweetId };
                break;
            case 'unbookmark':
                op = 'DeleteBookmark';
                vars = { tweet_id: message.tweetId };
                break;
            case 'delete_tweet':
                op = 'DeleteTweet';
                vars = { tweet_id: message.tweetId };
                break;
        }

        if (op) {
            // 针对 Follow/Unfollow 特殊处理：如果还没抓到 GraphQL Hash，直接走 1.1 REST 降级方案
            if (message.action === 'follow' || message.action === 'unfollow') {
                const path = message.action === 'follow' ? '/i/api/1.1/friendships/create.json' : '/i/api/1.1/friendships/destroy.json';

                // 尝试执行，如果 performMutation 报错说明没哈希，我们就直接走 legacy
                performMutation(op, vars)
                    .then(res => sendResponse({ ok: true, data: res }))
                    .catch(() => {
                        console.log(`[TweetClaw-CS] 🔄 Fallback to Legacy REST: ${path}`);
                        performLegacyREST(path, { user_id: message.userId })
                            .then(res => sendResponse({ ok: true, data: res }))
                            .catch(err => sendResponse({ ok: false, error: err.message }));
                    });
                return true;
            }

            performMutation(op, vars)
                .then(res => sendResponse({ ok: true, data: res }))
                .catch(err => sendResponse({ ok: false, error: err.message }));
            return true;
        }
    }

    if (message.type === 'FETCH_SETTINGS_AND_PROFILE') {
        (async () => {
            try {
                // 第一步：从 storage 读 screenName
                const stored = await chrome.storage.local.get(['screenName', 'userId']);
                let screenName = stored.screenName as string | undefined;

                // 第二步：如果 storage 里还没有（injection 还没完成拦截），
                // 监听 postMessage 最多等待 4 秒，等 settings.json 被拦截
                if (!screenName) {
                    console.log('[TweetClaw-CS] screenName not in storage, waiting up to 4s for injection...');
                    screenName = await new Promise<string | undefined>((resolve) => {
                        const timer = setTimeout(() => {
                            window.removeEventListener('message', onMsg);
                            resolve(undefined);
                        }, 4000);

                        function onMsg(e: MessageEvent) {
                            if (
                                e.data?.source === 'tweetclaw-injection' &&
                                e.data?.type === 'SIGNAL_CAPTURED' &&
                                e.data?.op === 'settings.json' &&
                                e.data?.data?.screen_name
                            ) {
                                clearTimeout(timer);
                                window.removeEventListener('message', onMsg);
                                const sn: string = e.data.data.screen_name;
                                const uid: string | undefined =
                                    e.data.data.id_str ||
                                    (e.data.data.id ? String(e.data.data.id) : undefined);
                                const toStore: Record<string, string> = { screenName: sn };
                                if (uid) toStore.userId = uid;
                                chrome.storage.local.set(toStore).catch(() => {});
                                resolve(sn);
                            }
                        }
                        window.addEventListener('message', onMsg);
                    });
                }

                if (!screenName) throw new Error('screenName not found in storage');

                console.log(`[TweetClaw-CS] Fetching profile for @${screenName}...`);
                const json = await fetchUserByScreenName(screenName);

                // 直接返回推特原始响应，不做任何解析
                sendResponse({ success: true, raw: json });
            } catch (e: any) {
                console.error('[TweetClaw-CS] FETCH_SETTINGS_AND_PROFILE fail:', e);
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true; // 保持异步 sendResponse 通道
    }

    if (message.type === 'FETCH_USER_PROFILE_BY_SCREEN_NAME') {
        (async () => {
            try {
                const cleanName = (message.screenName as string).replace('@', '');
                const json = await fetchUserByScreenName(cleanName);

                // 直接透传原始 JSON，不再解析字段
                sendResponse({ success: true, data: json });
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (message.type === 'FETCH_TWEET_REPLIES_PAGE') {
        (async () => {
            try {
                const tweetId = String(message.tweetId || '').trim();
                const cursor = typeof message.cursor === 'string' ? message.cursor.trim() : '';
                if (!tweetId) throw new Error('tweetId is required');
                console.log(`[TweetClaw-CS] FETCH_TWEET_REPLIES_PAGE start tweetId=${tweetId} cursor=${cursor || '<nil>'}`);

                const variables: Record<string, any> = {
                    focalTweetId: tweetId,
                    with_rux_injections: false,
                    includePromotedContent: true,
                    withCommunity: true,
                    withQuickPromoteEligibilityTweetFields: true,
                    withBirdwatchNotes: true,
                    withVoice: true,
                    rankingMode: 'Relevance'
                };

                if (cursor) {
                    variables.cursor = cursor;
                }

                const data = await performQuery('TweetDetail', variables);
                console.log(`[TweetClaw-CS] FETCH_TWEET_REPLIES_PAGE success tweetId=${tweetId} cursor=${cursor || '<nil>'}`);
                sendResponse({
                    success: true,
                    data,
                    pageUrl: window.location.href,
                    requestCursor: cursor || null
                });
            } catch (e: any) {
                console.error(`[TweetClaw-CS] FETCH_TWEET_REPLIES_PAGE failed tweetId=${message.tweetId || '<nil>'} cursor=${message.cursor || '<nil>'}`, e);
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (message.type === 'SEARCH_TIMELINE') {
        (async () => {
            try {
                const query = String(message.query || '').trim();
                const cursor = message.cursor ? String(message.cursor).trim() : '';
                const count = message.count || 20;
                if (!query) throw new Error('query is required');
                console.log(`[TweetClaw-CS] SEARCH_TIMELINE start query="${query}" cursor=${cursor || '<nil>'} count=${count}`);

                const variables: Record<string, any> = {
                    rawQuery: query,
                    count: count,
                    querySource: 'typed_query',
                    product: 'Top',
                    withGrokTranslatedBio: false
                };

                if (cursor) {
                    variables.cursor = cursor;
                }

                const data = await performQuery('SearchTimeline', variables);
                console.log(`[TweetClaw-CS] SEARCH_TIMELINE success query="${query}" cursor=${cursor || '<nil>'}`);
                sendResponse({
                    success: true,
                    data,
                    pageUrl: window.location.href
                });
            } catch (e: any) {
                console.error(`[TweetClaw-CS] SEARCH_TIMELINE failed query="${message.query || '<nil>'}" cursor=${message.cursor || '<nil>'}`, e);
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    // ══════════════════════════════════════════════════════════════════
    // 新增：AI-Oriented 实时 API 调用处理器
    // ══════════════════════════════════════════════════════════════════

    if (message.type === 'FETCH_HOME_TIMELINE') {
        (async () => {
            try {
                const data = await performQuery('HomeLatestTimeline', {
                    count: 20,
                    includePromotedContent: true,
                    latestControlAvailable: true,
                    requestContext: 'launch',
                    withCommunity: true
                });
                sendResponse({ success: true, data });
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (message.type === 'FETCH_TWEET_REPLIES') {
        (async () => {
            try {
                const variables: any = {
                    focalTweetId: message.tweetId,
                    with_rux_injections: false,
                    includePromotedContent: true,
                    withCommunity: true,
                    withQuickPromoteEligibilityTweetFields: true,
                    withBirdwatchNotes: true,
                    withVoice: true,
                    rankingMode: 'Relevance'
                };
                if (message.cursor) {
                    variables.cursor = message.cursor;
                }
                const data = await performQuery('TweetDetail', variables);
                sendResponse({ success: true, data });
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (message.type === 'FETCH_TWEET_DETAIL') {
        (async () => {
            try {
                const data = await performQuery('TweetDetail', {
                    focalTweetId: message.tweetId,
                    with_rux_injections: false,
                    includePromotedContent: true,
                    withCommunity: true,
                    withQuickPromoteEligibilityTweetFields: true,
                    withBirdwatchNotes: true,
                    withVoice: true
                });
                sendResponse({ success: true, data });
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (message.type === 'FETCH_USER_PROFILE') {
        (async () => {
            try {
                const cleanName = message.screenName.replace('@', '');
                const data = await fetchUserByScreenName(cleanName);
                sendResponse({ success: true, data });
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (message.type === 'FETCH_SEARCH_TIMELINE') {
        (async () => {
            try {
                const variables: any = {
                    rawQuery: message.query || '',
                    count: message.count || 20,
                    querySource: 'typed_query',
                    product: 'Top',
                    withGrokTranslatedBio: false
                };
                if (message.cursor) {
                    variables.cursor = message.cursor;
                }
                const data = await performQuery('SearchTimeline', variables);
                sendResponse({ success: true, data });
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (message.type === 'FETCH_USER_TWEETS') {
        (async () => {
            try {
                const variables: any = {
                    userId: message.userId,
                    count: message.count || 20,
                    includePromotedContent: true,
                    withQuickPromoteEligibilityTweetFields: true,
                    withVoice: true
                };
                if (message.cursor) {
                    variables.cursor = message.cursor;
                }
                const data = await performQuery('UserTweets', variables);
                sendResponse({ success: true, data });
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (message.type === 'START_TASK_UPLOAD_FROM_BG_SESSION') {
        try {
            const taskMessage = message as StartTaskUploadFromBgSessionMessage;
            if (!taskMessage.taskId || !taskMessage.uploadSessionId || !taskMessage.mimeType || !taskMessage.totalBytes) {
                throw new Error('taskId, uploadSessionId, mimeType and totalBytes are required');
            }

            contentTaskRunner.startTaskFromBackground(taskMessage);
            sendResponse({ success: true });
        } catch (e: any) {
            console.error('[TweetClaw-CS] START_TASK_UPLOAD_FROM_BG_SESSION rejected:', e);
            sendResponse({ success: false, error: e?.message || String(e) });
        }
        return true;
    }

    if (message.type === 'CANCEL_CONTENT_TASK') {
        contentTaskRunner.cancelTask(String(message.taskId || ''));
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'FETCH_FOLLOWERS_PAGE') {
        (async () => {
            try {
                const variables: any = {
                    userId: message.userId,
                    count: message.count || 20,
                    includePromotedContent: false,
                    withGrokTranslatedBio: false,
                };
                if (message.cursor) variables.cursor = message.cursor;
                const data = await performQuery('Followers', variables);
                sendResponse({ success: true, data });
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (message.type === 'FETCH_FOLLOWING_PAGE') {
        (async () => {
            try {
                const variables: any = {
                    userId: message.userId,
                    count: message.count || 20,
                    includePromotedContent: false,
                    withGrokTranslatedBio: false,
                };
                if (message.cursor) variables.cursor = message.cursor;
                const data = await performQuery('Following', variables);
                sendResponse({ success: true, data });
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (message.type === 'FETCH_BLUE_VERIFIED_FOLLOWERS_PAGE') {
        (async () => {
            try {
                const variables: any = {
                    userId: message.userId,
                    count: message.count || 20,
                    includePromotedContent: false,
                    withGrokTranslatedBio: false,
                };
                if (message.cursor) variables.cursor = message.cursor;
                const data = await performQuery('BlueVerifiedFollowers', variables);
                sendResponse({ success: true, data });
            } catch (e: any) {
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    return false;
});

console.log('[TweetClaw-CS] Active.');
