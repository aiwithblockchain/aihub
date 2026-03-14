import { describe, it, expect, beforeEach } from 'vitest';

// Simulating the logic from debug.ts for unit testing
function renderMismatchWarningLogic(
    tid: number, 
    pageContext: any, 
    lastOpenTweetRequests: Map<number, { screenName: string, tweetId: string, timestamp: number }>
): string {
    const lastRequest = lastOpenTweetRequests.get(tid);
    if (!lastRequest) return '';

    // If we've navigated away from tweet_detail, clear the request
    if (pageContext.scene !== 'tweet_detail') {
        lastOpenTweetRequests.delete(tid);
        return '';
    }

    const currentEntity = pageContext.currentEntity;
    const currentHandle = currentEntity?.authorHandle;
    const currentId = currentEntity?.entityId;

    // If we have an entity ID and it doesn't match the requested one, 
    // it means the user has navigated away from the requested tweet.
    if (currentId && currentId !== lastRequest.tweetId) {
        lastOpenTweetRequests.delete(tid);
        return '';
    }

    if (!currentHandle) return '';

    const cleanRequested = lastRequest.screenName.replace('@', '').toLowerCase();
    const cleanActual = currentHandle.replace('@', '').toLowerCase();

    if (cleanRequested !== cleanActual) {
        return 'warning-displayed';
    }

    return 'no-warning';
}

describe('Open Tweet Author Mismatch Warning', () => {
    let lastOpenTweetRequests: Map<number, { screenName: string, tweetId: string, timestamp: number }>;
    const tid = 101;

    beforeEach(() => {
        lastOpenTweetRequests = new Map();
    });

    it('should not show warning when screenName and authorHandle match', () => {
        lastOpenTweetRequests.set(tid, { screenName: 'jack', tweetId: '20', timestamp: Date.now() });
        const pageContext = {
            scene: 'tweet_detail',
            currentEntity: {
                entityId: '20',
                authorHandle: '@jack'
            }
        };

        const result = renderMismatchWarningLogic(tid, pageContext, lastOpenTweetRequests);
        expect(result).toBe('no-warning');
    });

    it('should show warning when screenName and authorHandle do not match', () => {
        lastOpenTweetRequests.set(tid, { screenName: 'jack', tweetId: '20', timestamp: Date.now() });
        const pageContext = {
            scene: 'tweet_detail',
            currentEntity: {
                entityId: '20',
                authorHandle: '@elonmusk'
            }
        };

        const result = renderMismatchWarningLogic(tid, pageContext, lastOpenTweetRequests);
        expect(result).toBe('warning-displayed');
    });

    it('should ignore case and @ prefix during comparison', () => {
        lastOpenTweetRequests.set(tid, { screenName: '@Jack', tweetId: '20', timestamp: Date.now() });
        const pageContext = {
            scene: 'tweet_detail',
            currentEntity: {
                entityId: '20',
                authorHandle: 'jack'
            }
        };

        const result = renderMismatchWarningLogic(tid, pageContext, lastOpenTweetRequests);
        expect(result).toBe('no-warning');
    });

    it('should not show warning when currentEntity.authorHandle is missing', () => {
        lastOpenTweetRequests.set(tid, { screenName: 'jack', tweetId: '20', timestamp: Date.now() });
        const pageContext = {
            scene: 'tweet_detail',
            currentEntity: {
                entityId: '20',
                authorHandle: null
            }
        };

        const result = renderMismatchWarningLogic(tid, pageContext, lastOpenTweetRequests);
        expect(result).toBe('');
    });

    it('should clear last request and not show warning when scene is not tweet_detail', () => {
        lastOpenTweetRequests.set(tid, { screenName: 'jack', tweetId: '20', timestamp: Date.now() });
        const pageContext = {
            scene: 'profile',
            currentEntity: {
                authorHandle: '@elonmusk'
            }
        };

        const result = renderMismatchWarningLogic(tid, pageContext, lastOpenTweetRequests);
        expect(result).toBe('');
        expect(lastOpenTweetRequests.has(tid)).toBe(false);
    });

    it('should not show warning and clear request when navigating to a different tweetId', () => {
        lastOpenTweetRequests.set(tid, { screenName: 'jack', tweetId: '20', timestamp: Date.now() });
        const pageContext = {
            scene: 'tweet_detail',
            currentEntity: {
                entityId: '21', // Different tweet
                authorHandle: '@elonmusk'
            }
        };

        const result = renderMismatchWarningLogic(tid, pageContext, lastOpenTweetRequests);
        expect(result).toBe('');
        expect(lastOpenTweetRequests.has(tid)).toBe(false);
    });

    it('should not show warning when there is no last request', () => {
        const pageContext = {
            scene: 'tweet_detail',
            currentEntity: {
                authorHandle: '@elonmusk'
            }
        };

        const result = renderMismatchWarningLogic(tid, pageContext, lastOpenTweetRequests);
        expect(result).toBe('');
    });
});
