import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceTools } from '../../src/tools/workspace-tools';
import { WorkspaceManager } from '../../src/session/workspace-manager';

describe('WorkspaceTools (Layer 4) - Workspace Control', () => {
    let tools: WorkspaceTools;
    let manager: WorkspaceManager;

    beforeEach(() => {
        manager = new WorkspaceManager();
        tools = new WorkspaceTools(manager);

        // Mock chrome API
        vi.stubGlobal('chrome', {
            tabs: {
                query: vi.fn(),
                get: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
                remove: vi.fn(),
            },
            windows: {
                update: vi.fn(),
            },
            runtime: {
                sendMessage: vi.fn(),
                lastError: null
            }
        });
        vi.clearAllMocks();
    });

    describe('browser_create_x_tab', () => {
        it('creates a new tab and returns WorkspaceTab via background message', async () => {
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'CREATE_X_TAB') cb({ ok: true, tabId: 101 });
            });
            
            const response = await tools.browser_create_x_tab();
            expect(response.ok).toBe(true);
            expect(response.data?.tabId).toBe(101);
            expect(response.data?.routeKind).toBe('home');
        });
    });

    describe('browser_list_x_tabs', () => {
        it('lists multiple X tabs from background status', async () => {
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'LIST_ALL_X_TABS') {
                    cb([
                        { id: 101, url: 'https://x.com/home', active: true, account: { handle: '@user1' } },
                        { id: 102, url: 'https://x.com/user2/status/123', active: false, account: null }
                    ]);
                }
            });

            const response = await tools.browser_list_x_tabs();
            expect(response.ok).toBe(true);
            expect(response.data?.tabs).toHaveLength(2);
            expect(response.data?.tabs[0].accountHandle).toBe('@user1');
            expect(response.data?.tabs[1].routeKind).toBe('thread');
        });
    });

    describe('browser_focus_tab', () => {
        it('focuses a tab successfully via background', async () => {
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'FOCUS_X_TAB') cb({ ok: true });
            });
            
            const response = await tools.browser_focus_tab({ tabId: 101 });
            expect(response.ok).toBe(true);
            expect(response.data?.active).toBe(true);
        });

        it('returns error if background fails to focus', async () => {
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'FOCUS_X_TAB') cb({ ok: false, error: 'Tab not found' });
            });
            
            const response = await tools.browser_focus_tab({ tabId: 999 });
            expect(response.ok).toBe(false);
            expect(response.error?.code).toBe('NO_BOUND_TAB');
        });
    });

    describe('browser_close_tab', () => {
        it('closes a tab via background', async () => {
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'CLOSE_X_TAB') cb({ ok: true });
            });
            
            const response = await tools.browser_close_tab({ tabId: 101 });
            expect(response.ok).toBe(true);
            expect(response.data?.closed).toBe(true);
        });

        it('returns success even if tab already closed (idempotent)', async () => {
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'CLOSE_X_TAB') cb({ ok: true, warning: 'Tab already closed' });
            });
            
            const response = await tools.browser_close_tab({ tabId: 101 });
            expect(response.ok).toBe(true);
            expect(response.data?.closed).toBe(true);
        });
    });
});
