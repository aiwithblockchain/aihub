import { describe, it, expect, vi, beforeEach } from 'vitest';
import { derivePageContext } from '../../src/utils/scene-parser';

describe('Session Invalidation Logic', () => {
    it('should return login_required when isLoggedIn is false even if hasSession was true', () => {
        // 模拟旧的 hasSession 残留，但 isLoggedIn 已经变为 false (cookie 被删)
        const context = derivePageContext('https://x.com/home', true, false);
        expect(context.scene).toBe('login_required');
        // 关键：不能因为 hasSession 为 true 就跳过 login_required
    });

    it('should prioritize known scene over identity_resolving when isLoggedIn is true but hasSession is false', () => {
        const context = derivePageContext('https://x.com/home', false, true);
        expect(context.scene).toBe('home');
    });

    it('should return home when both are true', () => {
        const context = derivePageContext('https://x.com/home', true, true);
        expect(context.scene).toBe('home');
    });
});
