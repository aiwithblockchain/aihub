import { MsgType } from '../capture/consts';
import { performMutation, performLegacyREST, fetchUserByScreenName } from '../x_api/twitter_api';
import { findDeepUser } from '../capture/extractor';

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

    if (event.data.type === 'SIGNAL_CAPTURED') {
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
        chrome.runtime.sendMessage({
            type: 'REPORT_HOOK_STATUS',
            status: event.data.status
        });
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MsgType.PING || message.type === 'TC_PING') {
        sendResponse({ ok: true, url: window.location.href, context: 'CONTENT_SCRIPT' });
        return true;
    }

    if (message.type === MsgType.EXECUTE_ACTION) {
        let op = '';
        let vars: any = { tweet_id: message.tweetId };

        switch (message.action) {
            case 'like':     op = 'FavoriteTweet'; break;
            case 'retweet':  op = 'CreateRetweet'; vars.dark_request = false; break;
            case 'bookmark': op = 'CreateBookmark'; break;
            case 'follow':   op = 'CreateFriendship'; vars = { user_id: message.userId }; break;
            case 'unfollow': op = 'DestroyFriendship'; vars = { user_id: message.userId }; break;
            case 'post_tweet':
                // 发布新推文
                op = 'CreateTweet';
                vars = {
                    tweet_text: message.text || '',
                    media: {
                        media_entities: [],
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
                        media_entities: [],
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

                // 用容错递归解析拿到 user result 对象
                const userResult = findDeepUser(json);
                if (!userResult) throw new Error('findDeepUser returned null');

                sendResponse({ success: true, raw: userResult });
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
                const { findDeepUser } = await import('../capture/extractor');
                const userResult = findDeepUser(json);
                if (!userResult) throw new Error('User not found or unavailable');

                const legacy = userResult?.legacy ?? {};
                const data = {
                    userId: userResult?.rest_id || '',
                    screenName: legacy.screen_name || '',
                    name: legacy.name || '',
                    description: legacy.description || '',
                    followersCount: legacy.followers_count,
                    friendsCount: legacy.friends_count,
                    statusesCount: legacy.statuses_count,
                    verified: userResult?.is_blue_verified || legacy.verified || false,
                    createdAt: legacy.created_at || '',
                    avatar: (legacy.profile_image_url_https || '').replace('_normal', '')
                };
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
