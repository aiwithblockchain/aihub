import { describe, it, expect } from 'vitest';
import { derivePageContext } from '../../src/utils/scene-parser';

describe('Scene Parser - derivePageContext', () => {
    it('should return no_tab when url is missing', () => {
        const context = derivePageContext(undefined, false, false);
        expect(context.scene).toBe('no_tab');
        expect(context.availableActions).toContain('open_x_tab');
    });

    it('should return not_x when url is not an X URL', () => {
        const context = derivePageContext('https://google.com', false, false);
        expect(context.scene).toBe('not_x');
        expect(context.availableActions).toContain('open_x_tab');
    });

    it('should return login_required when X URL but not logged in', () => {
        const context = derivePageContext('https://x.com/home', false, false);
        expect(context.scene).toBe('login_required');
        expect(context.availableActions).toContain('refresh_session');
    });

    it('should prioritize known scene over identity_resolving when logged in', () => {
        const context = derivePageContext('https://x.com/home', false, true);
        expect(context.scene).toBe('home');
        expect(context.availableActions).toContain('read_home_timeline');
    });

    it('should return home scene for X home URL with session', () => {
        const context = derivePageContext('https://x.com/home', true, true);
        expect(context.scene).toBe('home');
        expect(context.availableActions).toContain('read_home_timeline');
    });

    it('should return profile scene for X profile URL with session', () => {
        const context = derivePageContext('https://x.com/elonmusk', true, true);
        expect(context.scene).toBe('profile');
        expect(context.availableActions).toContain('list_profile_tweets');
    });

    it('should return tweet_detail scene for X status URL with session', () => {
        const context = derivePageContext('https://x.com/elonmusk/status/123456', true, true);
        expect(context.scene).toBe('tweet_detail');
        expect(context.availableActions).toContain('like_tweet');
        expect(context.availableActions).toContain('list_tweet_replies');
    });

    it('should return search scene for X search URL with session', () => {
        const context = derivePageContext('https://x.com/search?q=openclaw', true, true);
        expect(context.scene).toBe('search');
        expect(context.availableActions).toContain('search_tweets');
    });

    it('should return notification scene for X notifications URL with session', () => {
        const context = derivePageContext('https://x.com/notifications', true, true);
        expect(context.scene).toBe('notification');
        expect(context.availableActions).toContain('read_notifications');
        expect(context.currentEntity).toBeNull();
    });

    it('should include currentEntity in tweet_detail scene', () => {
        const url = 'https://x.com/user/status/123';
        const context = derivePageContext(url, true, true);
        expect(context.scene).toBe('tweet_detail');
        expect(context.currentEntity).not.toBeNull();
        expect(context.currentEntity?.entityId).toBe('123');
        expect(context.entityId).toBe('123');
        expect(context.entityType).toBe('tweet');
    });

    it('should include merged entity data in tweet_detail when featuredTweet provided', () => {
        const url = 'https://x.com/user/status/123';
        const featuredTweet = { tweetId: '123', authorHandle: '@tester', text: 'tweet content' };
        const context = derivePageContext(url, true, true, featuredTweet, '@tester');
        
        expect(context.currentEntity?.source).toBe('merged');
        expect(context.currentEntity?.authorHandle).toBe('@tester');
        expect(context.currentEntity?.isOwnedByActiveAccount).toBe(true);
    });
});
