import { describe, it, expect } from 'vitest';
import { resolveTweetEntity } from '../../src/utils/entity-resolver';

describe('Entity Resolver', () => {
    it('should return null if URL is not a tweet detail page', () => {
        const entity = resolveTweetEntity('https://x.com/home', null, null);
        expect(entity).toBeNull();
    });

    it('should return url_only entity when no featuredTweet is provided', () => {
        const url = 'https://x.com/user/status/123456789';
        const entity = resolveTweetEntity(url, null, null);
        
        expect(entity).not.toBeNull();
        expect(entity?.entityType).toBe('tweet');
        expect(entity?.entityId).toBe('123456789');
        expect(entity?.source).toBe('url_only');
        expect(entity?.authorHandle).toBeNull();
    });

    it('should merge data when featuredTweet matches current URL ID', () => {
        const url = 'https://x.com/user/status/123';
        const featuredTweet = {
            id: '123',
            authorHandle: '@testuser',
            text: 'Hello world',
            likeCount: 10
        };
        const entity = resolveTweetEntity(url, featuredTweet, null);
        
        expect(entity?.source).toBe('merged');
        expect(entity?.entityId).toBe('123');
        expect(entity?.authorHandle).toBe('@testuser');
        expect(entity?.text).toBe('Hello world');
        expect(entity?.likeCount).toBe(10);
    });

    it('should correctly determine isOwnedByActiveAccount', () => {
        const url = 'https://x.com/user/status/123';
        const featuredTweet = {
            id: '123',
            authorHandle: '@testuser'
        };
        
        const entityOwned = resolveTweetEntity(url, featuredTweet, '@testuser');
        expect(entityOwned?.isOwnedByActiveAccount).toBe(true);

        const entityNotOwned = resolveTweetEntity(url, featuredTweet, '@otheruser');
        expect(entityNotOwned?.isOwnedByActiveAccount).toBe(false);

        // Test case insensitive and @ prefix
        const entityOwnedMixed = resolveTweetEntity(url, featuredTweet, 'TestUser');
        expect(entityOwnedMixed?.isOwnedByActiveAccount).toBe(true);
    });
});
