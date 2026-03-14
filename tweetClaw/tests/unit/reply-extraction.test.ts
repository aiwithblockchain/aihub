import { describe, it, expect } from 'vitest';
import { findRepliesSnapshot } from '../../src/capture/extractor';

describe('Reply Extraction (Replies Snapshot)', () => {
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
                            },
                            {
                                entryId: 'tweet-1002',
                                content: {
                                    itemContent: {
                                        tweet_results: {
                                            result: {
                                                rest_id: '1002',
                                                core: { user_results: { result: { legacy: { screen_name: 'active_user' } } } },
                                                legacy: { full_text: 'Reply 2 text (by me)', created_at: 'Fri Mar 13 10:10:00 +0000 2026', favorite_count: 10 }
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

    it('should extract replies and exclude the main tweet based on pageUrl', () => {
        const pageUrl = 'https://x.com/author_main/status/1000';
        const replies = findRepliesSnapshot(mockTweetDetailJson, pageUrl, '@active_user');

        expect(replies).toHaveLength(2);
        expect(replies.map(r => r.tweetId)).not.toContain('1000');
        expect(replies[0].tweetId).toBe('1001');
        expect(replies[1].tweetId).toBe('1002');
    });

    it('should correctly identify replies by the active account', () => {
        const pageUrl = 'https://x.com/author_main/status/1000';
        const replies = findRepliesSnapshot(mockTweetDetailJson, pageUrl, '@active_user');

        expect(replies[0].isByActiveAccount).toBe(false);
        expect(replies[1].isByActiveAccount).toBe(true);
    });

    it('should extract basic metrics for replies', () => {
        const pageUrl = 'https://x.com/author_main/status/1000';
        const replies = findRepliesSnapshot(mockTweetDetailJson, pageUrl);

        expect(replies[0].likeCount).toBe(5);
        expect(replies[1].likeCount).toBe(10);
    });

    it('should exclude quoted tweets from the main replies list', () => {
        const jsonWithQuote = {
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
                                                    legacy: { 
                                                        full_text: 'Main', 
                                                        quoted_status_result: {
                                                            result: { rest_id: '2000', legacy: { full_text: 'I am a quote' } }
                                                        }
                                                    }
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
                                                result: { rest_id: '1001', legacy: { full_text: 'Reply' } }
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

        const replies = findRepliesSnapshot(jsonWithQuote, 'https://x.com/user/status/1000');
        expect(replies).toHaveLength(1);
        expect(replies[0].tweetId).toBe('1001');
        expect(replies.map(r => r.tweetId)).not.toContain('2000');
    });

    it('should return empty list when no tweets are found', () => {
        const replies = findRepliesSnapshot({ data: {} });
        expect(replies).toEqual([]);
    });

    it('should handle missing activeAccountHandle', () => {
        const pageUrl = 'https://x.com/author_main/status/1000';
        const replies = findRepliesSnapshot(mockTweetDetailJson, pageUrl, null);
        expect(replies[1].isByActiveAccount).toBe(false);
    });

    it('should extract replies from TimelineModule structure', () => {
        const moduleJson = {
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
                                                result: { rest_id: '1000', legacy: { full_text: 'Main' } }
                                            }
                                        }
                                    }
                                },
                                {
                                    entryId: 'conversationthread-1001',
                                    content: {
                                        entryType: 'TimelineTimelineModule',
                                        items: [
                                            {
                                                entryId: 'tweet-1001',
                                                item: {
                                                    itemContent: {
                                                        tweet_results: {
                                                            result: { rest_id: '1001', legacy: { full_text: 'Module Reply' } }
                                                        }
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    ]
                }
            }
        };

        const replies = findRepliesSnapshot(moduleJson, 'https://x.com/user/status/1000');
        expect(replies).toHaveLength(1);
        expect(replies[0].tweetId).toBe('1001');
        expect(replies[0].text).toBe('Module Reply');
    });
});
