export type EntitySource = 'url_only' | 'capture_only' | 'merged';

export interface TweetEntity {
    entityType: 'tweet';
    entityId: string;
    authorHandle: string | null;
    authorName: string | null;
    authorId: string | null;
    text: string | null;
    createdAt: string | null;
    likeCount: number | null;
    replyCount: number | null;
    retweetCount: number | null;
    bookmarkCount: number | null;
    isOwnedByActiveAccount: boolean;
    source: EntitySource;
}

export interface ReplyEntity {
    tweetId: string;
    authorHandle: string | null;
    authorName: string | null;
    authorId: string | null;
    text: string | null;
    createdAt: string | null;
    likeCount: number | null;
    replyCount: number | null;
    repostCount: number | null;
    isByActiveAccount: boolean;
}

export interface ProfileTweetEntity {
    tweetId: string;
    authorHandle: string | null;
    authorName: string | null;
    text: string | null;
    createdAt: string | null;
    likeCount: number | null;
    replyCount: number | null;
    repostCount: number | null;
    isOwnedByActiveAccount: boolean;
}

export type CurrentEntity = TweetEntity | null;
