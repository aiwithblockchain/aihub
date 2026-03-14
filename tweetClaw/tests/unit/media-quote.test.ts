import { describe, it, expect } from 'vitest';
import { extractTweetsFromTimeline } from '../../src/capture/timeline-extractor';

describe('Media and Quote Extraction', () => {
    it('should extract photo media details', () => {
        const mockJson = {
            instructions: [{
                type: 'TimelineAddEntries',
                entries: [{
                    content: {
                        itemContent: {
                            tweet_results: {
                                result: {
                                    legacy: {
                                        id_str: 'm1',
                                        full_text: 'Tweet with photo',
                                        extended_entities: {
                                            media: [{
                                                type: 'photo',
                                                media_url_https: 'https://pbs.twimg.com/media/F1.jpg',
                                                original_info: { width: 1200, height: 800 }
                                            }]
                                        }
                                    }
                                }
                            }
                        }
                    }
                }]
            }]
        };

        const tweets = extractTweetsFromTimeline(mockJson);
        expect(tweets).toHaveLength(1);
        expect(tweets[0].media).toHaveLength(1);
        expect(tweets[0].media![0].type).toBe('photo');
        expect(tweets[0].media_count).toBe(1);
    });

    it('should extract video media details with variants', () => {
        const mockJson = {
            instructions: [{
                type: 'TimelineAddEntries',
                entries: [{
                    content: {
                        itemContent: {
                            tweet_results: {
                                result: {
                                    legacy: {
                                        id_str: 'v1',
                                        full_text: 'Tweet with video',
                                        extended_entities: {
                                            media: [{
                                                type: 'video',
                                                media_url_https: 'https://pbs.twimg.com/video_thumb.jpg',
                                                video_info: {
                                                    duration_ms: 30000,
                                                    variants: [
                                                        { url: 'https://video.com/v.mp4', content_type: 'video/mp4' }
                                                    ]
                                                }
                                            }]
                                        }
                                    }
                                }
                            }
                        }
                    }
                }]
            }]
        };

        const tweets = extractTweetsFromTimeline(mockJson);
        expect(tweets[0].media![0].type).toBe('video');
        expect(tweets[0].media![0].duration_ms).toBe(30000);
        expect(tweets[0].media![0].variant_urls).toContain('https://video.com/v.mp4');
    });

    it('should extract quoted tweet details', () => {
        const mockJson = {
            instructions: [{
                type: 'TimelineAddEntries',
                entries: [{
                    content: {
                        itemContent: {
                            tweet_results: {
                                result: {
                                    legacy: {
                                        id_str: 'q1',
                                        full_text: 'This is a quote!',
                                    },
                                    quoted_status_result: {
                                        result: {
                                            core: {
                                                user_results: {
                                                    result: {
                                                        legacy: {
                                                            screen_name: 'original_author',
                                                            name: 'Original Name'
                                                        }
                                                    }
                                                }
                                            },
                                            legacy: {
                                                id_str: 'o1',
                                                full_text: 'Original tweet content',
                                                created_at: 'Mon Mar 09 10:00:00 +0000 2026'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }]
            }]
        };

        const tweets = extractTweetsFromTimeline(mockJson);
        expect(tweets).toHaveLength(1);
        expect(tweets[0].quoted_tweet).toBeDefined();
        expect(tweets[0].quoted_tweet!.tweetId).toBe('o1');
    });

    it('should handle nested quoted tweet without infinite recursion (depth 1)', () => {
        const mockJson = {
            instructions: [{
                type: 'TimelineAddEntries',
                entries: [{
                    content: {
                        itemContent: {
                            tweet_results: {
                                result: {
                                    legacy: { id_str: 't1', full_text: 'Top Level' },
                                    quoted_status_result: {
                                        result: {
                                            legacy: { id_str: 't2', full_text: 'Mid Level' },
                                            quoted_status_result: {
                                                result: {
                                                    legacy: { id_str: 't3', full_text: 'Deep Level' }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }]
            }]
        };

        const tweets = extractTweetsFromTimeline(mockJson);
        expect(tweets[0].tweetId).toBe('t1');
        expect(tweets[0].quoted_tweet!.tweetId).toBe('t2');
        expect(tweets[0].quoted_tweet!.quoted_tweet).toBeUndefined();
    });
});
