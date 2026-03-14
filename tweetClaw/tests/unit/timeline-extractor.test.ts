import { describe, it, expect } from 'vitest';
import { extractTweetsFromTimeline } from '../../src/capture/timeline-extractor';

describe('Timeline Extractor (L3 Capture)', () => {
    it('should extract tweets from a standard HomeTimeline URT JSON', () => {
        const mockJson = {
            data: {
                home: {
                    home_timeline_urt: {
                        instructions: [
                            {
                                type: 'TimelineAddEntries',
                                entries: [
                                    {
                                        entryId: 'tweet-1',
                                        content: {
                                            itemContent: {
                                                tweet_results: {
                                                    result: {
                                                        __typename: 'Tweet',
                                                        rest_id: '123456789',
                                                        core: {
                                                            user_results: {
                                                                result: {
                                                                    __typename: 'User',
                                                                    legacy: {
                                                                        screen_name: 'test_user',
                                                                        name: 'Real Name'
                                                                    }
                                                                }
                                                            }
                                                        },
                                                        legacy: {
                                                            full_text: 'Hello world!',
                                                            created_at: 'Tue Mar 10 10:00:00 +0000 2026',
                                                            retweet_count: 77,
                                                            favorite_count: 100
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
        };

        const tweets = extractTweetsFromTimeline(mockJson);

        expect(tweets).toHaveLength(1);
        expect(tweets[0].authorHandle).toBe('@test_user');
        expect(tweets[0].authorName).toBe('Real Name');
        expect(tweets[0].repostCount).toBe(77);
    });

    it('should return empty array for invalid JSON structure', () => {
        const result = extractTweetsFromTimeline({ some: 'garbage' });
        expect(result).toEqual([]);
    });

    it('should handle missing interaction counts with default values (null)', () => {
        const mockJson = {
            data: {
                home: {
                    home_timeline_urt: {
                        instructions: [
                            {
                                type: 'TimelineAddEntries',
                                entries: [
                                    {
                                        content: {
                                            itemContent: {
                                                tweet_results: {
                                                    result: {
                                                        __typename: 'Tweet',
                                                        rest_id: '999',
                                                        legacy: { full_text: 'No interactions here' }
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
        };

        const tweets = extractTweetsFromTimeline(mockJson);
        expect(tweets[0].likeCount).toBe(null);
    });
});
