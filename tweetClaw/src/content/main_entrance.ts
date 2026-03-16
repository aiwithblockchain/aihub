import { MsgType } from '../capture/consts';
import { performMutation, performLegacyREST } from '../x_api/twitter_api';

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
                const { fetchUserByRestId, fetchUserByUsername } = await import('../x_api/twitter_api');
                let profile = null;
                
                // 优先使用 fetchUserByUsername (UserByScreenName)，因为该 API 的 QueryId (ck5KkZ8t...) 极其稳定且在 TweetCat 中得到验证
                if (message.screenName) {
                    console.log('[TweetClaw-CS] Attempting UserByScreenName for:', message.screenName);
                    profile = await fetchUserByUsername(message.screenName);
                }
                
                // 如果没有 handle 或失败，再尝试 UserByRestId (虽然其 QueryId 经常变动导致 404)
                if (!profile) {
                    console.log('[TweetClaw-CS] Attempting UserByRestId for UID:', message.uid);
                    profile = await fetchUserByRestId(message.uid);
                }
                
                sendResponse({ profile });
            } catch (err) {
                console.error('[TweetClaw-CS] FETCH_SETTINGS_AND_PROFILE fail:', err);
                sendResponse(null);
            }
        })();
        return true;
    }
    return false;
});

console.log('[TweetClaw-CS] Active.');
