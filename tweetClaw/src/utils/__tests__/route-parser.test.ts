import { describe, it, expect } from 'vitest';
import { parseRouteKind } from '../route-parser';

describe('route-parser', () => {
  describe('Twitter routes', () => {
    it('should parse Twitter home', () => {
      expect(parseRouteKind('https://x.com/home')).toBe('home');
      expect(parseRouteKind('https://x.com/')).toBe('home');
    });

    it('should parse Twitter thread', () => {
      expect(parseRouteKind('https://x.com/user/status/123')).toBe('thread');
    });

    it('should parse Twitter profile', () => {
      expect(parseRouteKind('https://x.com/username')).toBe('profile');
    });
  });

  describe('Xiaohongshu routes', () => {
    it('should parse XHS explore', () => {
      expect(parseRouteKind('https://www.xiaohongshu.com/')).toBe('xhs_explore');
      expect(parseRouteKind('https://www.xiaohongshu.com/explore')).toBe('xhs_explore');
    });

    it('should parse XHS note', () => {
      expect(parseRouteKind('https://www.xiaohongshu.com/explore/123abc')).toBe('xhs_note');
    });

    it('should parse XHS user', () => {
      expect(parseRouteKind('https://www.xiaohongshu.com/user/profile/456def')).toBe('xhs_user');
    });
  });
});
