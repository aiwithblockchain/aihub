export type Platform = 'twitter' | 'xiaohongshu' | 'unknown';

export function detectPlatform(url: string): Platform {
  if (url.includes('x.com') || url.includes('twitter.com')) {
    return 'twitter';
  }
  if (url.includes('xiaohongshu.com')) {
    return 'xiaohongshu';
  }
  return 'unknown';
}

export function isTwitter(url: string): boolean {
  return detectPlatform(url) === 'twitter';
}

export function isXiaohongshu(url: string): boolean {
  return detectPlatform(url) === 'xiaohongshu';
}
