import { RouteKind } from '../types/session';
import { detectPlatform } from './platform-detector';

export function parseRouteKind(url: string): RouteKind {
    const platform = detectPlatform(url);

    if (platform === 'xiaohongshu') {
        return parseXhsRoute(url);
    }

    if (platform === 'twitter') {
        return parseTwitterRoute(url);
    }

    if (platform === 'unknown') {
        return 'none';
    }

    return 'unknown';
}

function parseTwitterRoute(url: string): RouteKind {
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

function parseXhsRoute(url: string): RouteKind {
    try {
        const u = new URL(url);
        const path = u.pathname;

        if (path === '/' || path === '/explore') return 'xhs_explore';
        if (path.startsWith('/explore/')) return 'xhs_note';
        if (path.startsWith('/user/profile/')) return 'xhs_user';

        return 'unknown';
    } catch {
        return 'unknown';
    }
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
