import { describe, it, expect } from 'vitest';
import { findFeaturedTweet } from '../../src/capture/extractor';

describe('Featured Tweet Selection (TweetDetail logic)', () => {
    const mockDetailJson = {
        data: {
            threaded_conversation_with_injections_v2: {
                instructions: [
                    {
                        type: 'TimelineAddEntries',
                        entries: [
                            {
                                entryId: 'tweet-main',
                                content: {
                                    itemContent: {
                                        tweet_results: {
                                            result: {
                                                rest_id: '111',
                                                core: { user_results: { result: { rest_id: 'u1', legacy: { screen_name: 'main_author', name: 'Main' } } } },
                                                legacy: { full_text: 'Main tweet content', created_at: 'Wed Mar 11 10:00:00 +0000 2026' }
                                            }
                                        }
                                    }
                                }
                            },
                            {
                                entryId: 'tweet-reply',
                                content: {
                                    itemContent: {
                                        tweet_results: {
                                            result: {
                                                rest_id: '222',
                                                core: { user_results: { result: { rest_id: 'u2', legacy: { screen_name: 'reply_author', name: 'Reply' } } } },
                                                legacy: { full_text: 'I am a reply', created_at: 'Wed Mar 11 10:05:00 +0000 2026' }
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

    it('should select the tweet matching the status ID from pageUrl', () => {
        // We are on the reply's page
        const pageUrl = 'https://x.com/someone/status/222';
        const featured = findFeaturedTweet(mockDetailJson, pageUrl);

        expect(featured).not.toBeNull();
        expect(featured?.id).toBe('222');
        expect(featured?.authorHandle).toBe('@reply_author');
        expect(featured?.text).toBe('I am a reply');
    });

    it('should select the main tweet if pageUrl matches main ID', () => {
        const pageUrl = 'https://x.com/someone/status/111';
        const featured = findFeaturedTweet(mockDetailJson, pageUrl);

        expect(featured).not.toBeNull();
        expect(featured?.id).toBe('111');
        expect(featured?.authorHandle).toBe('@main_author');
    });

    it('should fallback to the first tweet if no match is found for pageUrl', () => {
        const pageUrl = 'https://x.com/someone/status/999'; // No match
        const featured = findFeaturedTweet(mockDetailJson, pageUrl);

        expect(featured).not.toBeNull();
        expect(featured?.id).toBe('111'); // First one in entries
    });

    it('should fallback to the first tweet if no pageUrl is provided', () => {
        const featured = findFeaturedTweet(mockDetailJson);
        expect(featured?.id).toBe('111');
    });
});
