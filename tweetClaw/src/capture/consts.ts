export const __DBK_query_id_map = 'tc_query_id_map';
export const __DBK_bearer_token = 'tc_bearer_token';
export const __DBK_dynamic_features = 'tc_dynamic_features';

export enum MsgType {
    PING = 'PING',
    EXECUTE_ACTION = 'EXECUTE_ACTION'
}

export const watchedOps = [
    'UserTweets',
    'HomeTimeline',
    'HomeLatestTimeline',
    'TweetDetail',
    'UserByScreenName',
    'ProfileSpotlightsQuery',
    'AccountSettings',
    'AuthenticatedUserQuery',
    'Viewer',
    'VerifyCredentials',
    'CreateFriendship',
    'DestroyFriendship',
    'CreateBookmark',
    'DeleteBookmark',
    'Followers',
    'Following',
    'SearchTimeline',
    'FavoriteTweet',
    'UnfavoriteTweet',
    'CreateRetweet',
    'DeleteRetweet',
    'ListLatestTweetsTimeline',
    'TimelineHome',
    'AccountUserQuery',
    'UserByRestId',
    'CreateTweet',    // 新增：发推文（含回复）
    'DeleteTweet',    // 新增：删除推文
    'DeleteRetweet'   // 新增：取消转发
];

export const defaultQueryKeyMap: Record<string, string> = {
    'UserByScreenName': 'ck5KkZ8t5cOmoLssopN99Q',
    'UserTweets': 'E8Wq-_jFSaU7hxVcuOPR9g',
    'HomeLatestTimeline': 'SFxmNKWfN9ySJcXG_tjX8g',
    'HomeTimeline': 'DXmgQYmIft1oLP6vMkJixw',
    'TweetDetail': 'iFEr5AcP121Og4wx9Yqo3w',
    'SearchTimeline': '4fpceYZ6-YQCx_JSl_Cn_A',
    'CreateBookmark': 'aoDbu3RHznuiSkQ9aNM67Q',
    'DeleteBookmark': 'Wlmlj2-xzyS1GN3a6cj-mQ',
    'Following': 'SaWqzw0TFAWMx1nXWjXoaQ',
    'Followers': 'i6PPdIMm1MO7CpAqjau7sw',
    'FavoriteTweet': 'lI07N6Otwv1PhnEgXILM7A',
    'UnfavoriteTweet': 'ZYKSe-w7KEslx3JhSIk5LA',
    'CreateRetweet': 'mbRO74GrOvSfRcJnlMapnQ',
    'CreateFriendship': '66v9_S_vThhArew_99v9_v9',
    'DestroyFriendship': 'Opv7_p8AunMhJvD8X8c9rw',
    'UserByRestId': 'LJYI_VvTFAZf7PAdT0eWmA',
    'CreateTweet': 'zkcFc6F-RKRgWN8HUkJfZg',    // 新增：已确认（2025-05）
    'DeleteTweet': 'nxpZCY2K-I6QoFHAHeojFQ',     // 新增：已确认（2025-05）
    'DeleteRetweet': 'ZyZigVsNiFO6v1dEks1eWg'     // 新增：已确认（2025-05）
};

/**
 * 识别 X 游客账号（Guest Token）
 *
 * X 的 guest token handle 特征：
 *   - 恰好 15 个字符
 *   - 全部是小写字母 + 数字（无大写字母、无下划线）
 *   - 含有至少一个数字
 *
 * 真实用户 handle 可以包含大写字母或下划线，不会被误判。
 * 例如误判案例：1DU1Gf7oElR2h28 → 含大写 → 不是 guest ✓
 */
export function isGuestHandle(h: string | null | undefined): boolean {
    if (!h) return false;
    const clean = h.startsWith('@') ? h.substring(1) : h;
    
    // Guest handles are random 15-char strings (e.g., 'xyz1234abc5678z' or '123456789012345')
    // Real users like 'web3bridgeninja' (15 chars, lowercase, 1 digit) are common false positives.
    if (clean.length !== 15 || !/^[a-z0-9]+$/.test(clean)) return false;

    const digits = (clean.match(/\d/g) || []).length;
    const hasVowels = /[aeiou]/.test(clean);

    // Heuristics:
    // 1. All numeric is definitely a guest token
    if (/^\d+$/.test(clean)) return true;
    
    // 2. Alphanumeric with high digit count (>= 3) and no vowels is very likely a guest
    if (digits >= 2 && !hasVowels) return true;
    
    // 3. Very high digit count (>= 5) is also a red flag even with vowels
    if (digits >= 5) return true;

    return false;
}
