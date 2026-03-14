import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceTools } from '../../src/tools/workspace-tools';
import { WorkspaceManager } from '../../src/session/workspace-manager';

describe('WorkspaceTools (Layer 4) - Browser Navigation', () => {
    let tools: WorkspaceTools;
    let manager: WorkspaceManager;

    beforeEach(() => {
        manager = new WorkspaceManager();
        tools = new WorkspaceTools(manager);

        // Mock chrome API
        vi.stubGlobal('chrome', {
            runtime: {
                sendMessage: vi.fn(),
                lastError: null
            }
        });
        vi.clearAllMocks();
    });

    describe('browser_navigate_tab', () => {
        it('1. 合法 X URL 导航成功', async () => {
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'NAVIGATE_X_TAB' && msg.url.includes('x.com')) {
                    cb({ ok: true, tabId: 101, url: msg.url });
                }
            });
            
            const url = 'https://x.com/home';
            const response = await tools.browser_navigate_tab({ tabId: 101, url });
            
            expect(response.ok).toBe(true);
            expect(response.data?.tabId).toBe(101);
            expect(response.data?.url).toBe(url);
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'NAVIGATE_X_TAB', url }),
                expect.any(Function)
            );
        });

        it('2. 非 X URL 被拒绝 (Policy check in tools)', async () => {
            const url = 'https://google.com';
            const response = await tools.browser_navigate_tab({ tabId: 101, url });
            
            expect(response.ok).toBe(false);
            expect(response.error?.code).toBe('POLICY_DENIED');
            expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
        });

        it('3. 缺失参数返回错误', async () => {
            // @ts-ignore
            const response1 = await tools.browser_navigate_tab({ url: 'https://x.com' });
            expect(response1.ok).toBe(false);
            expect(response1.error?.code).toBe('INVALID_PARAMETERS');

            // @ts-ignore
            const response2 = await tools.browser_navigate_tab({ tabId: 101 });
            expect(response2.ok).toBe(false);
            expect(response2.error?.code).toBe('INVALID_PARAMETERS');
        });

        it('4. Background 返回错误时正确映射 (e.g. Tab not found)', async () => {
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'NAVIGATE_X_TAB') {
                    cb({ ok: false, error: 'No tab with id: 999' });
                }
            });
            
            const response = await tools.browser_navigate_tab({ tabId: 999, url: 'https://x.com' });
            expect(response.ok).toBe(false);
            expect(response.error?.code).toBe('NO_BOUND_TAB');
        });
    });

    describe('x_open_tweet_detail', () => {
        it('1. 合法参数正确拼接 URL 并导航', async () => {
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'NAVIGATE_X_TAB') cb({ ok: true, tabId: 101, url: msg.url });
            });
            
            const response = await tools.x_open_tweet_detail({ 
                tabId: 101, 
                screenName: 'jack', 
                tweetId: '20' 
            });
            
            expect(response.ok).toBe(true);
            expect(response.data?.url).toBe('https://x.com/jack/status/20');
        });

        it('2. 非法 tweetId 被拒绝 (非数字)', async () => {
            const response = await tools.x_open_tweet_detail({ 
                tabId: 101, 
                screenName: 'jack', 
                tweetId: 'abc' 
            });
            expect(response.ok).toBe(false);
            expect(response.error?.code).toBe('INVALID_PARAMETERS');
        });

        it('3. 非法 screenName 被拒绝 (含空格或/)', async () => {
            const response1 = await tools.x_open_tweet_detail({ 
                tabId: 101, 
                screenName: 'jack doe', 
                tweetId: '20' 
            });
            expect(response1.ok).toBe(false);

            const response2 = await tools.x_open_tweet_detail({ 
                tabId: 101, 
                screenName: 'jack/doe', 
                tweetId: '20' 
            });
            expect(response2.ok).toBe(false);
        });

        it('4. 缺失参数被拒绝', async () => {
             // @ts-ignore
            const response = await tools.x_open_tweet_detail({ tabId: 101, screenName: 'jack' });
            expect(response.ok).toBe(false);
        });
    });
});
