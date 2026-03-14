import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionTools } from '../../src/tools/session-tools';
import { SessionManager } from '../../src/session/session-manager';

describe('Layer 2 Signals - Verification Flow', () => {
    let tools: SessionTools;
    let manager: SessionManager;

    beforeEach(() => {
        manager = new SessionManager();
        tools = new SessionTools(manager);

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

    describe('x_get_active_account logic flow', () => {
        it('session should be valid even when handle is NOT yet captured', async () => {
            vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://x.com/home' }] as any);
            vi.mocked(chrome.tabs.get).mockResolvedValue({ id: 1, url: 'https://x.com/home' } as any);
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'GET_SESSION_STATUS') cb({ connected: true, account: null });
            });

            const response = await tools.x_session_status();
            expect(response.ok).toBe(true);
            expect(response.data?.tabBound).toBe(true);
            expect(response.data?.account).toBe(null);
        });

        it('returns ok:true when a handle signal is captured', async () => {
            vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://x.com/home' }] as any);
            vi.mocked(chrome.tabs.get).mockResolvedValue({ id: 1, url: 'https://x.com/home' } as any);
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'GET_SESSION_STATUS') cb({ account: { handle: '@real_user' } });
            });

            const response = await tools.x_get_active_account();
            expect(response.ok).toBe(true);
            expect(response.data?.account.handle).toBe('@real_user');
        });

        it('prioritizes explicit targetTabId over currently active tab', async () => {
            vi.mocked(chrome.tabs.get).mockResolvedValue({ id: 99, url: 'https://x.com/pro' } as any);
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'GET_SESSION_STATUS') cb({ account: null });
            });

            const response = await tools.x_session_status({ tabId: 99 });
            expect(response.ok).toBe(true);
            expect(response.data?.tabBound).toBe(true);
            expect(response.data?.routeKind).toBe('profile');
        });
    });
});
