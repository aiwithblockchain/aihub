import { describe, it, expect } from 'vitest';
import { findProfileTweetsSnapshot } from '../../src/capture/extractor';

describe('Profile Tweets Extraction', () => {
    const mockUserTweetsJson = {
        data: {
            user: {
                result: {
                    timeline_v2: {
                        timeline: {
                            instructions: [
                                {
                                    type: 'TimelineAddEntries',
                                    entries: [
                                        {
                                            entryId: 'tweet-profile-1',
                                            content: {
                                                itemContent: {
                                                    tweet_results: {
                                                        result: {
                                                            rest_id: 'p1',
                                                            core: { user_results: { result: { legacy: { screen_name: 'target_user' } } } },
                                                            legacy: { 
                                                                full_text: 'Profile tweet 1', 
                                                                created_at: 'Fri Mar 13 10:00:00 +0000 2026',
                                                                favorite_count: 100,
                                                                reply_count: 10,
                                                                retweet_count: 20
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        },
                                        {
                                            entryId: 'tweet-profile-2',
                                            content: {
                                                itemContent: {
                                                    tweet_results: {
                                                        result: {
                                                            rest_id: 'p2',
                                                            core: { user_results: { result: { legacy: { screen_name: 'target_user' } } } },
                                                            legacy: { 
                                                                full_text: 'Profile tweet 2', 
                                                                created_at: 'Fri Mar 13 10:05:00 +0000 2026',
                                                                favorite_count: 200,
                                                                reply_count: 20,
                                                                retweet_count: 40
                                                            }
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
                }
            }
        }
    };

    it('should extract profile tweets with correct fields', () => {
        const tweets = findProfileTweetsSnapshot(mockUserTweetsJson);

        expect(tweets).toHaveLength(2);
        expect(tweets[0].tweetId).toBe('p1');
        expect(tweets[0].authorHandle).toBe('@target_user');
        expect(tweets[0].text).toBe('Profile tweet 1');
        expect(tweets[0].likeCount).toBe(100);
        expect(tweets[0].replyCount).toBe(10);
        expect(tweets[0].repostCount).toBe(20);
    });

    it('should correctly identify owned tweets', () => {
        const tweets = findProfileTweetsSnapshot(mockUserTweetsJson, '@target_user');
        expect(tweets[0].isOwnedByActiveAccount).toBe(true);
        expect(tweets[1].isOwnedByActiveAccount).toBe(true);

        const othersTweets = findProfileTweetsSnapshot(mockUserTweetsJson, '@another_user');
        expect(othersTweets[0].isOwnedByActiveAccount).toBe(false);
    });

    it('should handle empty responses', () => {
        const tweets = findProfileTweetsSnapshot({ data: {} });
        expect(tweets).toEqual([]);
    });

    it('should deduplicate tweets by tweetId', () => {
        const duplicateJson = {
            data: {
                user: {
                    result: {
                        timeline_v2: {
                            timeline: {
                                instructions: [
                                    {
                                        type: 'TimelineAddEntries',
                                        entries: [
                                            {
                                                entryId: 'tweet-1',
                                                content: { itemContent: { tweet_results: { result: { rest_id: 'dup1', legacy: { full_text: 'text', created_at: 'now' } } } } }
                                            },
                                            {
                                                entryId: 'tweet-2',
                                                content: { itemContent: { tweet_results: { result: { rest_id: 'dup1', legacy: { full_text: 'text', created_at: 'now' } } } } }
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        };

        const tweets = findProfileTweetsSnapshot(duplicateJson);
        expect(tweets).toHaveLength(1);
        expect(tweets[0].tweetId).toBe('dup1');
    });
});
