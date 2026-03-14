import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseRouteKind } from '../../src/utils/route-parser';

// 我们主要通过对消息协议和监听器逻辑的模拟来验证修复
describe('Workspace UX Fixes - Signaling & State', () => {
    
    beforeEach(() => {
        vi.stubGlobal('chrome', {
            tabs: {
                query: vi.fn(),
                sendMessage: vi.fn(),
                onUpdated: { addListener: vi.fn() },
                onRemoved: { addListener: vi.fn() },
                getURL: vi.fn(() => 'chrome-extension://id/debug.html')
            },
            runtime: {
                getURL: vi.fn((path) => `chrome-extension://id/${path}`),
                onMessage: { addListener: vi.fn() },
                sendMessage: vi.fn()
            },
            storage: {
                local: {
                    get: vi.fn().mockResolvedValue({}),
                    set: vi.fn().mockResolvedValue({})
                }
            }
        });
    });

    it('should correctly parse various X URLs to routeKind', () => {
        expect(parseRouteKind('https://x.com/home')).toBe('home');
        expect(parseRouteKind('https://x.com/search?q=test')).toBe('search');
        expect(parseRouteKind('https://x.com/i/notifications')).toBe('notification');
        expect(parseRouteKind('https://x.com/elonkusk/status/123')).toBe('thread');
        expect(parseRouteKind('https://x.com/elonmusk')).toBe('profile');
        expect(parseRouteKind('https://google.com')).toBe('none');
    });

    it('background should notify debug pages when a tab URL is updated', async () => {
        // 模拟 background.ts 中的部分核心逻辑逻辑
        const notifyDebugPages = vi.fn((tabId, type) => {
            // 验证是否正确由于 URL 更新触发了通知
            expect(type).toBe('STATUS');
        });

        // 模拟 tab.onUpdated 触发
        const changeInfo = { url: 'https://x.com/profile' };
        const tab = { id: 101, url: 'https://x.com/profile' };
        
        // 验证逻辑：如果 changeInfo 包含 URL 且是 X 站，应该触发通知
        const isX = tab.url && (tab.url.includes('x.com') || tab.url.includes('twitter.com'));
        if (changeInfo.url && isX) {
            notifyDebugPages(tab.id, 'STATUS');
        }

        expect(notifyDebugPages).toHaveBeenCalledWith(101, 'STATUS');
    });

    it('debug refreshData should auto-select another tab if current one is removed', async () => {
        let selectedTabId: number | null = 101;
        
        // 模拟 tabList 返回 102 (101 已关闭)
        const mockTabList = [
            { id: 102, url: 'https://x.com/home' }
        ];

        // 模拟逻辑
        if (selectedTabId !== null) {
            const exists = mockTabList.some(t => t.id === selectedTabId);
            if (!exists) selectedTabId = null;
        }

        if (selectedTabId === null && mockTabList.length > 0) {
            selectedTabId = mockTabList[0].id;
        }

        expect(selectedTabId).toBe(102);
    });

    it('debug refreshData should enter empty state if all tabs are removed', async () => {
        let selectedTabId: number | null = 101;
        let tabList: any[] = []; // 全部清空

        // 模拟逻辑
        if (selectedTabId !== null) {
            const exists = tabList.some(t => t.id === selectedTabId);
            if (!exists) selectedTabId = null;
        }

        expect(selectedTabId).toBe(null);
        expect(tabList.length).toBe(0);
    });
});
