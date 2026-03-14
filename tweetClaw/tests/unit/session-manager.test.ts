import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from '../../src/session/session-manager';
import { parseRouteKind } from '../../src/utils/route-parser';

describe('SessionManager (Layer 1)', () => {
    let manager: SessionManager;

    beforeEach(() => {
        manager = new SessionManager();
        
        // Mock chrome API
        vi.stubGlobal('chrome', {
            tabs: {
                query: vi.fn(),
                get: vi.fn(),
            },
            runtime: {
                sendMessage: vi.fn((msg, callback) => {
                    if (callback) callback({ ok: true });
                }),
                lastError: null
            }
        });
        vi.clearAllMocks();
    });

    it('should return connected status even with no tabs', async () => {
        vi.mocked(chrome.tabs.query).mockResolvedValue([]);
        const status = await manager.getSessionStatus();

        expect(status.connected).toBe(true);
        expect(status.tabBound).toBe(false);
        expect(status.routeKind).toBe('none');
    });

    it('should detect a valid X tab even if handle is not resolved', async () => {
        vi.mocked(chrome.tabs.query).mockResolvedValue([
            { id: 1, url: 'https://x.com/home', active: true }
        ] as any);
        vi.mocked(chrome.tabs.get).mockResolvedValue({ id: 1, url: 'https://x.com/home' } as any);
        vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
            if (msg.type === 'GET_SESSION_STATUS') cb({ connected: true, account: null });
        });

        const status = await manager.getSessionStatus();
        expect(status.tabBound).toBe(true);
        expect(status.routeKind).toBe('home');
        expect(status.sessionValid).toBe(false); 
        expect(status.account).toBe(null);
    });

    it('should show sessionValid and account when handle IS resolved', async () => {
        vi.mocked(chrome.tabs.query).mockResolvedValue([
            { id: 1, url: 'https://x.com/home', active: true }
        ] as any);
        vi.mocked(chrome.tabs.get).mockResolvedValue({ id: 1, url: 'https://x.com/home' } as any);
        vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
            if (msg.type === 'GET_SESSION_STATUS') cb({ account: { handle: '@user' } });
        });

        const status = await manager.getSessionStatus();
        expect(status.sessionValid).toBe(true);
        expect(status.account?.handle).toBe('@user');
    });

    it('should correctly parse routeKind for different URLs', async () => {
        expect(parseRouteKind('https://x.com/home')).toBe('home');
        expect(parseRouteKind('https://twitter.com/search?q=test')).toBe('search');
        expect(parseRouteKind('https://x.com/elonmusk/status/123')).toBe('thread');
        expect(parseRouteKind('https://x.com/notifications')).toBe('notification');
        expect(parseRouteKind('https://x.com/elonmusk')).toBe('profile');
        expect(parseRouteKind('https://google.com')).toBe('none');
    });
});
