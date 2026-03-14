import { isGuestHandle } from './consts';
import { extractTweetsFromTimeline } from './timeline-extractor';
import { extractTweetId } from '../utils/route-parser';

// ─────────────────────────────────────────────────────────────────────────────
// 仅受信任的 identity 操作（不接受普通用户主页 fetch 作为身份来源）
// ─────────────────────────────────────────────────────────────────────────────
const TRUSTED_IDENTITY_OPS = new Set([
    'AuthenticatedUserQuery',
    'Viewer',
    'AccountSettings',
    'settings.json',
    'VerifyCredentials'
]);

export function isTrustableIdentityOp(op: string): boolean {
    return TRUSTED_IDENTITY_OPS.has(op);
}

// ─────────────────────────────────────────────────────────────────────────────
// getOpName: 从 API URL 解析 operationName
// ─────────────────────────────────────────────────────────────────────────────
export function getOpName(url: string): string | null {
    if (!url) return null;
    // GraphQL: /i/api/graphql/{queryId}/{OperationName}[?...]
    const gqlMatch = url.match(/\/graphql\/[^\/]+\/([^?&/\s]+)/);
    if (gqlMatch) return gqlMatch[1];
    // REST 1.1 特殊映射
    if (url.includes('/account/settings.json')) return 'settings.json';
    if (url.includes('/account/verify_credentials.json')) return 'VerifyCredentials';
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// findScreenNameRecursive: 递归搜索 screen_name（非 guest）
// ─────────────────────────────────────────────────────────────────────────────
export function findScreenNameRecursive(obj: any, depth = 0): string | null {
    if (!obj || typeof obj !== 'object' || depth > 6) return null;
    if (typeof obj.screen_name === 'string' && !isGuestHandle(obj.screen_name)) {
        return obj.screen_name;
    }
    for (const key of Object.keys(obj)) {
        const val = (obj as any)[key];
        if (val && typeof val === 'object') {
            const found = findScreenNameRecursive(val, depth + 1);
            if (found) return found;
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// findViewerSummary: 从截获的响应体中提取当前登录账号信息
//
// 信任的来源：
//   1. v1.1 REST：settings.json / verify_credentials.json（扁平结构）
//   2. GraphQL viewer / authenticated_user_info 路径
//
// 不信任：
//   - data.data?.user?.result（UserByScreenName 等普通用户主页响应）
//     → 避免把 NASA 主页误认为是"当前登录用户"
// ─────────────────────────────────────────────────────────────────────────────
export function findViewerSummary(
    data: any,
    targetUid?: string
): { handle: string; userId: string; displayName: string; verified: boolean } | null {
    if (!data) return null;

    const extract = (obj: any) => {
        if (!obj || !obj.legacy) return null;
        const handle = obj.legacy.screen_name;
        const userId = obj.rest_id;
        
        // Safety: If it matches our confirmed UID (from twid cookie), it's the user, not a guest
        const isActuallyViewer = targetUid && userId === targetUid;
        if (isGuestHandle(handle) && !isActuallyViewer) return null;
        
        if (targetUid && userId !== targetUid) return null;
        return {
            handle: `@${handle}`,
            userId: userId,
            displayName: obj.legacy.name,
            verified: obj.legacy.verified || false
        };
    };

    // 1. v1.1 REST 扁平结构（settings.json / verify_credentials.json）
    //    settings.json 仅在登录后可见，里面的 handle 只要存在就是真实的
    if (data.screen_name) {
        const userId = data.id_str || data.id?.toString() || '';
        const isActuallyViewer = targetUid && userId === targetUid;
        if (isGuestHandle(data.screen_name) && !isActuallyViewer) return null;
        
        return {
            handle: `@${data.screen_name}`,
            userId: userId,
            displayName: data.name || '',
            verified: data.verified || false
        };
    }

    // 2. GraphQL viewer / authenticated_user_info 路径
    const viewerBlock =
        data.data?.viewer ||
        data.data?.authenticated_user_info;

    if (viewerBlock) {
        if (viewerBlock.user_results?.result) return extract(viewerBlock.user_results.result);
        const summary = extract(viewerBlock);
        if (summary) return summary;
    }

    // 3. 特殊兜底：如果是 UserByScreenName 但恰好是 viewer 自己（此路径较少见）
    if (data.data?.user?.result && targetUid && data.data.user.result.rest_id === targetUid) {
        return extract(data.data.user.result);
    }

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// findFeaturedTweet: 从响应体中提取一条代表性推文（用于 debug / quick action）
// ─────────────────────────────────────────────────────────────────────────────
export function findFeaturedTweet(
    data: any,
    pageUrl?: string
): { 
    id: string; 
    text: string; 
    authorHandle: string; 
    authorName: string; 
    authorId: string;
    createdAt: string;
    likeCount: number;
    replyCount: number;
    repostCount: number;
    bookmarkCount: number;
} | null {
    try {
        const tweets = extractTweetsFromTimeline(data);
        if (tweets.length === 0) return null;

        // 如果提供了 pageUrl，尝试匹配 status ID (用于 tweet_detail 场景选中主推文)
        const targetId = pageUrl ? extractTweetId(pageUrl) : null;
        let best = targetId ? tweets.find(t => t.tweetId === targetId) : null;
        
        // 如果没找到匹配的，或者不是详情页，选第一个
        if (!best) {
            best = tweets[0];
        }

        if (!best) return null;

        return {
            id: best.tweetId,
            text: best.text || '',
            authorHandle: best.authorHandle || '',
            authorName: best.authorName || '',
            authorId: best.authorId || '',
            createdAt: best.createdAt || '',
            likeCount: best.likeCount ?? 0,
            replyCount: best.replyCount ?? 0,
            repostCount: best.repostCount ?? 0,
            bookmarkCount: best.bookmarkCount ?? 0
        };
    } catch (e) {
        console.warn('[TweetClaw-Extractor] Error in findFeaturedTweet', e);
    }
    return null;
}

/**
 * 寻找响应体中特定 ID 的推文
 * 用于当当前 URL 与已缓存的 featuredTweet 不匹配时，重新从原始响应中找回主推文
 */
export function findTweetById(data: any, tweetId: string): any | null {
    try {
        const tweets = extractTweetsFromTimeline(data);
        const match = tweets.find(t => t.tweetId === tweetId);
        if (!match) return null;

        return {
            id: match.tweetId,
            text: match.text || '',
            authorHandle: match.authorHandle || '',
            authorName: match.authorName || '',
            authorId: match.authorId || '',
            createdAt: match.createdAt || '',
            likeCount: match.likeCount ?? 0,
            replyCount: match.replyCount ?? 0,
            repostCount: match.repostCount ?? 0,
            bookmarkCount: match.bookmarkCount ?? 0
        };
    } catch (e) {
        console.warn('[TweetClaw-Extractor] Error in findTweetById', e);
    }
    return null;
}

/**
 * 从响应体中提取回复列表（快照）
 */
export function findRepliesSnapshot(
    data: any,
    pageUrl?: string,
    activeAccountHandle?: string | null
): any[] {
    try {
        const tweets = extractTweetsFromTimeline(data);
        if (tweets.length === 0) return [];

        const targetId = pageUrl ? extractTweetId(pageUrl) : null;
        
        // 过滤逻辑：
        // 1. 排除主推文 (targetId)
        // 2. 这里的 tweets 是拍平的列表，TimelineAddEntries 里的顺序通常就是回复顺序
        // 3. 结果中可能包含主推文本身（如果有的话），我们要排除它
        const replies = tweets.filter(t => t.tweetId !== targetId);

        // 去重
        const seen = new Set<string>();
        const unique: typeof tweets = [];
        for (const t of replies) {
            if (!seen.has(t.tweetId)) {
                seen.add(t.tweetId);
                unique.push(t);
            }
        }

        return unique.map(t => ({
            tweetId: t.tweetId,
            authorHandle: t.authorHandle,
            authorName: t.authorName,
            authorId: t.authorId,
            text: t.text,
            createdAt: t.createdAt,
            likeCount: t.likeCount,
            replyCount: t.replyCount,
            repostCount: t.repostCount,
            isByActiveAccount: activeAccountHandle ? t.authorHandle === activeAccountHandle : false
        }));
    } catch (e) {
        console.warn('[TweetClaw-Extractor] Error in findRepliesSnapshot', e);
    }
    return [];
}

/**
 * 从响应体中提取 Profile 场景下的推文列表（快照）
 */
export function findProfileTweetsSnapshot(
    data: any,
    activeAccountHandle?: string | null
): any[] {
    try {
        const tweets = extractTweetsFromTimeline(data);
        if (tweets.length === 0) return [];

        // 去重
        const seen = new Set<string>();
        const unique: typeof tweets = [];
        for (const t of tweets) {
            if (!seen.has(t.tweetId)) {
                seen.add(t.tweetId);
                unique.push(t);
            }
        }

        return unique.map(t => ({
            tweetId: t.tweetId,
            authorHandle: t.authorHandle,
            authorName: t.authorName,
            text: t.text,
            createdAt: t.createdAt,
            likeCount: t.likeCount,
            replyCount: t.replyCount,
            repostCount: t.repostCount,
            isOwnedByActiveAccount: activeAccountHandle ? t.authorHandle === activeAccountHandle : false
        }));
    } catch (e) {
        console.warn('[TweetClaw-Extractor] Error in findProfileTweetsSnapshot', e);
    }
    return [];
}
