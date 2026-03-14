import { describe, it, expect } from 'vitest';
import { findTweetById, findRepliesSnapshot } from '../../src/capture/extractor';

describe('Tweet Navigation Regression (Thread context)', () => {
    const mockTweetDetailJson = {
        data: {
            threaded_conversation_with_injections_v2: {
                instructions: [
                    {
                        type: 'TimelineAddEntries',
                        entries: [
                            {
                                entryId: 'tweet-1000',
                                content: {
                                    itemContent: {
                                        tweet_results: {
                                            result: {
                                                rest_id: '1000',
                                                core: { user_results: { result: { legacy: { screen_name: 'author_main' } } } },
                                                legacy: { full_text: 'Main tweet text', created_at: 'Fri Mar 13 10:00:00 +0000 2026' }
                                            }
                                        }
                                    }
                                }
                            },
                            {
                                entryId: 'tweet-1001',
                                content: {
                                    itemContent: {
                                        tweet_results: {
                                            result: {
                                                rest_id: '1001',
                                                core: { user_results: { result: { legacy: { screen_name: 'author_reply1' } } } },
                                                legacy: { full_text: 'Reply 1 text', created_at: 'Fri Mar 13 10:05:00 +0000 2026', favorite_count: 5 }
                                            }
                                        }
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        }
    };

    it('should find the main tweet by ID when it exists in the response', () => {
        const tweet = findTweetById(mockTweetDetailJson, '1000');
        expect(tweet).not.toBeNull();
        expect(tweet.id).toBe('1000');
        expect(tweet.authorHandle).toBe('@author_main');
        expect(tweet.text).toBe('Main tweet text');
    });

    it('should find a reply tweet by ID when it exists in the response', () => {
        const tweet = findTweetById(mockTweetDetailJson, '1001');
        expect(tweet).not.toBeNull();
        expect(tweet.id).toBe('1001');
        expect(tweet.authorHandle).toBe('@author_reply1');
    });

    it('should return null when the tweet ID is not in the response', () => {
        const tweet = findTweetById(mockTweetDetailJson, '9999');
        expect(tweet).toBeNull();
    });

    it('should correctly filter replies when navigating between main tweet and reply', () => {
        // 场景 A: 位于主推文页面 (1000)，回复列表中应包含 1001
        const urlMain = 'https://x.com/author_main/status/1000';
        const repliesToMain = findRepliesSnapshot(mockTweetDetailJson, urlMain);
        expect(repliesToMain).toHaveLength(1);
        expect(repliesToMain[0].tweetId).toBe('1001');

        // 场景 B: 位于某条回复页面 (1001)，回复列表中应包含 1000（主推文在回复者的详情页通常会被视为上下文，如果它在列表里的话）
        // 按照当前 findRepliesSnapshot 的逻辑，它会排除 URL 里的那个 ID。
        const urlReply = 'https://x.com/author_reply1/status/1001';
        const repliesToReply = findRepliesSnapshot(mockTweetDetailJson, urlReply);
        expect(repliesToReply).toHaveLength(1);
        expect(repliesToReply[0].tweetId).toBe('1000');
    });
});
