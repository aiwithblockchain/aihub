import { describe, it, expect } from 'vitest';
import { detectPlatform, isTwitter, isXiaohongshu } from '../platform-detector';

describe('platform-detector', () => {
  it('should detect Twitter platform', () => {
    expect(detectPlatform('https://x.com/home')).toBe('twitter');
    expect(detectPlatform('https://twitter.com/user')).toBe('twitter');
    expect(isTwitter('https://x.com/home')).toBe(true);
  });

  it('should detect Xiaohongshu platform', () => {
    expect(detectPlatform('https://www.xiaohongshu.com/explore')).toBe('xiaohongshu');
    expect(isXiaohongshu('https://www.xiaohongshu.com/explore')).toBe(true);
  });

  it('should return unknown for unrecognized URLs', () => {
    expect(detectPlatform('https://example.com')).toBe('unknown');
    expect(detectPlatform('')).toBe('unknown');
  });
});
