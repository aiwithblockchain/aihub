/**
 * Timeline Extraction Logic
 * Robust version for Author Handle, Interaction Stats, Media, and Quotes.
 */

export interface TweetMedia {
    type: 'photo' | 'video' | 'animated_gif' | 'unknown';
    url: string;
    width?: number;
    height?: number;
    duration_ms?: number;
    variant_urls?: string[];
}

export interface MinimalTweet {
    tweetId: string;
    authorHandle: string;
    authorName: string;
    authorId: string;
    text: string;
    createdAt: string | null;
    replyCount: number | null;
    repostCount: number | null;
    likeCount: number | null;
    bookmarkCount: number | null;
    media?: TweetMedia[];
    media_count?: number;
    quoted_tweet?: MinimalTweet;
}

export interface TimelineCursors {
    next: string | null;
    previous: string | null;
}

/**
 * Recursively searches for the 'instructions' array.
 */
function findInstructionsRecursive(obj: any): any[] | null {
    if (!obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj.instructions)) return obj.instructions;

    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            const found = findInstructionsRecursive(obj[key]);
            if (found) return found;
        }
    }
    return null;
}

/**
 * Extracts a list of normalized tweets from any Timeline-like GraphQL response.
 * Works for Home, Search, and TweetDetail (Thread).
 */
export function extractTweetsFromTimeline(json: any): MinimalTweet[] {
    const tweets: MinimalTweet[] = [];
    try {
        const instructions = findInstructionsRecursive(json) || [];
        const instrTypes = instructions.map((i: any) => i.type);
        const entryTypes: string[] = [];
        let normalItemCount = 0;
        let moduleItemCount = 0;

        for (const instr of instructions) {
            if (instr.type === 'TimelineAddEntries' || instr.type === 'TimelineReplaceEntry') {
                const entries = instr.entries || (instr.entry ? [instr.entry] : []);
                for (const entry of entries) {
                    const entryType = entry?.content?.entryType;
                    if (entryType) entryTypes.push(entryType);

                    // Normal Item
                    const result = entry?.content?.itemContent?.tweet_results?.result
                        || entry?.content?.content?.tweet_results?.result;
                    if (result) {
                        normalItemCount++;
                        const tweet = parseTweetResult(result);
                        if (tweet) {
                            tweets.push(tweet);
                        }
                    }

                    // Module Items (Common in TweetDetail for replies)
                    const items = entry?.content?.items;
                    if (Array.isArray(items)) {
                        for (const item of items) {
                            const itemResult = item.item?.itemContent?.tweet_results?.result;
                            if (itemResult) {
                                moduleItemCount++;
                                const t = parseTweetResult(itemResult);
                                if (t) tweets.push(t);
                            }
                        }
                    }
                }
            }
        }

        console.log(`[TweetClaw-Extractor] extractTweetsFromTimeline: instructions=[${instrTypes.join(',')}] entryTypes=[${entryTypes.join(',')}] normalItems=${normalItemCount} moduleItems=${moduleItemCount} tweets=${tweets.length}`);
    } catch (e) {
        console.warn('[TweetClaw-Extractor] Error in extractTweetsFromTimeline', e);
    }
    return tweets;
}

export function extractTimelineCursors(json: any): TimelineCursors {
    let next: string | null = null;
    let previous: string | null = null;

    try {
        const instructions = findInstructionsRecursive(json) || [];
        const instrTypes = instructions.map((i: any) => i.type);
        const entryTypes: string[] = [];
        let cursorCount = 0;

        for (const instr of instructions) {
            if (instr.type !== 'TimelineAddEntries' && instr.type !== 'TimelineReplaceEntry') {
                continue;
            }

            const entries = instr.entries || (instr.entry ? [instr.entry] : []);
            for (const entry of entries) {
                const entryType = entry?.content?.entryType;
                if (entryType) entryTypes.push(entryType);

                const cursorNode = entry?.content?.entryType === 'TimelineTimelineCursor'
                    ? entry.content
                    : null;
                if (!cursorNode?.value) continue;

                cursorCount++;
                if (cursorNode.cursorType === 'Bottom') {
                    next = cursorNode.value;
                } else if (cursorNode.cursorType === 'Top') {
                    previous = cursorNode.value;
                }
            }
        }

        console.log(`[TweetClaw-Extractor] extractTimelineCursors: instructions=[${instrTypes.join(',')}] entryTypes=[${entryTypes.join(',')}] cursors=${cursorCount} next=${next ? 'yes' : 'no'} previous=${previous ? 'yes' : 'no'}`);
    } catch (e) {
        console.warn('[TweetClaw-Extractor] Error in extractTimelineCursors', e);
    }

    return { next, previous };
}

/**
 * Normalizes a single Tweet result from X's GraphQL response.
 * Supports recursion for Quote Tweets (1 level deep).
 */
function parseTweetResult(result: any, depth: number = 0): MinimalTweet | null {
    let data = result;
    // Handle nested results
    if (data.tweet) data = data.tweet;
    if (data.result) data = data.result;

    if (!data || !data.legacy) return null;

    // Handle Retweets: Prefer original tweet for text, metrics, and author if available
    let legacy = data.legacy;
    let core = data.core;
    const retweetedResult = data.retweeted_status_result?.result || legacy.retweeted_status_result?.result;
    if (retweetedResult) {
        const rLegacy = retweetedResult.legacy || retweetedResult.tweet?.legacy;
        const rCore = retweetedResult.core || retweetedResult.tweet?.core;
        if (rLegacy) legacy = rLegacy;
        if (rCore) core = rCore;
    }

    // 1. Author Info
    let authorHandle = 'unknown';
    let authorName = 'unknown';

    const userResult = core?.user_results?.result;
    const userLegacy = userResult?.legacy || userResult?.user?.legacy || userResult?.user_results?.result?.legacy || data.core?.user_results?.result?.legacy;

    if (userLegacy?.screen_name) {
        authorHandle = `@${userLegacy.screen_name}`;
        authorName = userLegacy.name || authorHandle;
    } else {
        const foundHandle = findFirstScreenName(data) || findFirstScreenName(core);
        if (foundHandle) authorHandle = `@${foundHandle}`;
        const foundName = findFirstAuthorName(data) || findFirstAuthorName(core);
        if (foundName) authorName = foundName;
    }

    // 2. Interaction Metrics
    const tweet: MinimalTweet = {
        tweetId: legacy.id_str || data.rest_id,
        authorHandle,
        authorName,
        authorId: userResult?.rest_id || 'unknown',
        text: legacy.full_text || '',
        createdAt: legacy.created_at || null,
        replyCount: legacy.reply_count ?? data.reply_count ?? null,
        repostCount: legacy.retweet_count ?? legacy.repost_count ?? data.retweet_count ?? null,
        likeCount: legacy.favorite_count ?? data.favorite_count ?? null,
        bookmarkCount: legacy.bookmark_count ?? data.bookmark_count ?? null,
    };

    // 3. Media Extraction (Photos, Videos, GIFs)
    const mediaItems = legacy.extended_entities?.media || legacy.entities?.media || [];
    if (mediaItems.length > 0) {
        tweet.media = mediaItems.map((m: any) => {
            const item: TweetMedia = {
                type: m.type === 'photo' ? 'photo' : (m.type === 'video' ? 'video' : (m.type === 'animated_gif' ? 'animated_gif' : 'unknown')),
                url: m.media_url_https,
                width: m.original_info?.width,
                height: m.original_info?.height,
            };
            if (m.video_info) {
                item.duration_ms = m.video_info.duration_ms;
                if (m.video_info.variants) {
                    item.variant_urls = m.video_info.variants
                        .filter((v: any) => v.url)
                        .map((v: any) => v.url);
                }
            }
            return item;
        });
        tweet.media_count = tweet.media?.length || 0;
    }

    // 4. Quote Tweet Expansion (Limit depth to 1)
    if (depth === 0) {
        const quotedResult = data.quoted_status_result || legacy.quoted_status_result;
        if (quotedResult) {
            const quotedTweet = parseTweetResult(quotedResult, 1);
            if (quotedTweet) {
                tweet.quoted_tweet = quotedTweet;
            }
        }
    }

    return tweet;
}

/**
 * Helper to find the first screen_name in a user-related sub-object.
 */
function findFirstScreenName(obj: any): string | null {
    if (!obj || typeof obj !== 'object') return null;
    if (obj.screen_name) return obj.screen_name;
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const found = findFirstScreenName(obj[key]);
            if (found) return found;
        }
    }
    return null;
}

/**
 * Helper to find the first 'name' in a user-related sub-object.
 */
function findFirstAuthorName(obj: any): string | null {
    if (!obj || typeof obj !== 'object') return null;
    if (obj.name) return obj.name;
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const found = findFirstAuthorName(obj[key]);
            if (found) return found;
        }
    }
    return null;
}
