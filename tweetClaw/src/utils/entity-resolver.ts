import { TweetEntity, CurrentEntity, EntitySource } from '../types/entity';
import { extractTweetId } from './route-parser';

export function resolveTweetEntity(
    url: string,
    featuredTweet: any | null,
    activeAccountHandle: string | null
): CurrentEntity {
    const tweetId = extractTweetId(url);
    if (!tweetId) return null;

    let entity: TweetEntity = {
        entityType: 'tweet',
        entityId: tweetId,
        authorHandle: null,
        authorName: null,
        authorId: null,
        text: null,
        createdAt: null,
        likeCount: null,
        replyCount: null,
        retweetCount: null,
        bookmarkCount: null,
        isOwnedByActiveAccount: false,
        source: 'url_only'
    };

    if (featuredTweet && (featuredTweet.id === tweetId || !featuredTweet.id)) {
        // Alignment with extractor fields
        entity.authorHandle = featuredTweet.authorHandle || null;
        entity.authorName = featuredTweet.authorName || null;
        entity.authorId = featuredTweet.authorId || null;
        entity.text = featuredTweet.text || null;
        entity.createdAt = featuredTweet.createdAt || null;
        entity.likeCount = featuredTweet.likeCount ?? null;
        entity.replyCount = featuredTweet.replyCount ?? null;
        entity.retweetCount = featuredTweet.repostCount ?? null;
        entity.bookmarkCount = featuredTweet.bookmarkCount ?? null;
        
        entity.source = 'merged';
    }

    if (activeAccountHandle && entity.authorHandle) {
        const cleanActive = activeAccountHandle.replace('@', '').toLowerCase();
        const cleanAuthor = entity.authorHandle.replace('@', '').toLowerCase();
        entity.isOwnedByActiveAccount = cleanActive === cleanAuthor;
    }

    return entity;
}
