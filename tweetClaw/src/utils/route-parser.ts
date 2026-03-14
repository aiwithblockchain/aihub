import { RouteKind } from '../types/session';

export function parseRouteKind(url: string): RouteKind {
    if (!url || !(url.includes('x.com') || url.includes('twitter.com'))) return 'none';
    try {
        const u = new URL(url);
        const path = u.pathname;
        if (path === '/home' || path === '/') return 'home';
        if (path.includes('/search')) return 'search';
        if (path.includes('/status/')) return 'thread';
        if (path.includes('/notifications')) return 'notification';
        return 'profile';
    } catch { return 'unknown'; }
}

export function extractTweetId(url: string): string | null {
    if (!url) return null;
    try {
        const u = new URL(url);
        const match = u.pathname.match(/\/status\/(\d+)/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}
