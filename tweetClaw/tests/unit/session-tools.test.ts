import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionTools } from '../../src/tools/session-tools';
import { SessionManager } from '../../src/session/session-manager';

describe('SessionTools (Layer 4) - Integration/Contract', () => {
    let tools: SessionTools;
    let manager: SessionManager;

    beforeEach(() => {
        manager = new SessionManager();
        tools = new SessionTools(manager);

        // Mock chrome API
        vi.stubGlobal('chrome', {
            tabs: {
                query: vi.fn().mockResolvedValue([]),
                get: vi.fn(),
                sendMessage: vi.fn(),
            },
            runtime: {
                sendMessage: vi.fn((msg, callback) => {
                    if (callback) {
                        if (msg.type === 'GET_SESSION_STATUS') callback({ account: null });
                        else if (msg.type === 'GET_TAB_DATA') callback({ data: {} });
                        else callback({ ok: true });
                    }
                }),
                lastError: null
            }
        });
        vi.clearAllMocks();
    });

    describe('x_session_status', () => {
        it('returns success envelope when tab is bound', async () => {
            vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://x.com/home' }] as any);
            vi.mocked(chrome.tabs.get).mockResolvedValue({ id: 1, url: 'https://x.com/home' } as any);
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'GET_SESSION_STATUS') cb({ connected: true, account: null });
            });

            const response = await tools.x_session_status();
            expect(response.ok).toBe(true);
            expect(response.data?.tabBound).toBe(true);
        });
    });

    describe('x_get_active_account', () => {
        it('returns success if handle is captured', async () => {
            vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://x.com/home' }] as any);
            vi.mocked(chrome.tabs.get).mockResolvedValue({ id: 1, url: 'https://x.com/home' } as any);
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'GET_SESSION_STATUS') cb({ account: { handle: '@jdoe' } });
            });

            const response = await tools.x_get_active_account();
            expect(response.ok).toBe(true);
            expect(response.data?.account.handle).toBe('@jdoe');
        });
    });

    describe('x_read_home_timeline', () => {
        it('returns tweets if they have been captured', async () => {
            vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://x.com/home' }] as any);
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'GET_TAB_DATA') {
                    cb({ 
                        data: { 
                            HomeTimeline: { 
                                data: { 
                                    home: { 
                                        home_timeline_urt: { 
                                            instructions: [{
                                                type: 'TimelineAddEntries',
                                                entries: [{
                                                    content: {
                                                        itemContent: {
                                                            tweet_results: { result: { core: {}, legacy: { id_str: '123' } } }
                                                        }
                                                    }
                                                }]
                                            }] 
                                        } 
                                    } 
                                } 
                            } 
                        } 
                    });
                }
            });

            const response = await tools.x_read_home_timeline();
            expect(response.ok).toBe(true);
            // extractTweetsFromTimeline expects a nested structure
            expect(response.data?.tweets).toHaveLength(1);
        });
    });

    describe('x_get_tweet_details', () => {
        it('returns tweets if they have been captured', async () => {
            vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://x.com/home' }] as any);
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'GET_TAB_DATA') {
                    cb({ 
                        data: { 
                            TweetDetail: { 
                                data: { 
                                    threaded_conversation_with_injections_v2: { 
                                        instructions: [{
                                            type: 'TimelineAddEntries',
                                            entries: [{
                                                content: {
                                                    itemContent: {
                                                        tweet_results: { result: { core: {}, legacy: { id_str: '123' } } }
                                                    }
                                                }
                                            }]
                                        }] 
                                    } 
                                } 
                            } 
                        } 
                    });
                }
            });

            const response = await tools.x_get_tweet_details();
            expect(response.ok).toBe(true);
            expect(response.data?.tweets).toHaveLength(1);
        });
    });

    describe('x_list_profile_tweets', () => {
        it('returns tweets when in profile scene with snapshots', async () => {
            vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://x.com/profile' }] as any);
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'GET_PAGE_CONTEXT') {
                    cb({ 
                        scene: 'profile',
                        profileTweetsSnapshot: [{
                            tweetId: 'prof_1',
                            authorHandle: '@prof',
                            text: 'hello prof',
                            isOwnedByActiveAccount: true
                        }]
                    });
                }
            });

            const response = await tools.x_list_profile_tweets();
            expect(response.ok).toBe(true);
            expect(response.data?.tweets).toHaveLength(1);
            expect(response.data?.tweets[0].tweetId).toBe('prof_1');
        });

        it('fails if not in profile scene', async () => {
            vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://x.com/home' }] as any);
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'GET_PAGE_CONTEXT') {
                    cb({ scene: 'home' });
                }
            });

            const response = await tools.x_list_profile_tweets();
            expect(response.ok).toBe(false);
            expect(response.error?.code).toBe('RESOURCE_UNAVAILABLE');
            expect(response.error?.message).toContain('Current scene: home');
        });

        it('fails if no snapshots captured', async () => {
            vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://x.com/profile' }] as any);
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'GET_PAGE_CONTEXT') {
                    cb({ scene: 'profile', profileTweetsSnapshot: [] });
                }
            });

            const response = await tools.x_list_profile_tweets();
            expect(response.ok).toBe(false);
            expect(response.error?.code).toBe('RESOURCE_UNAVAILABLE');
            expect(response.error?.message).toContain('No profile tweets captured yet');
        });
    });

    describe('x_action_like', () => {
        it('returns success envelope when proxy succeeds', async () => {
            vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'https://x.com/home' }] as any);
            vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb: any) => {
                if (msg.type === 'EXEC_PROXY_ACTION') cb({ ok: true, status: 'success' });
            });

            const response = await tools.x_action_like({ tweet_id: '123' });
            expect(response.ok).toBe(true);
            expect(response.data?.result_status).toBe('success');
        });
    });
});
