import { SessionManager } from '../session/session-manager';
import { ToolResponse } from '../types/common';
import { SessionStatus, AccountSummary } from '../types/session';
import { extractTweetsFromTimeline } from '../capture/timeline-extractor';

/**
 * SessionTools - Core API Access & Actions
 * Aligned with 'Background Capture + Content Execution' architecture.
 */
export class SessionTools {
    private sessionManager: SessionManager;

    constructor(sessionManager: SessionManager) {
        this.sessionManager = sessionManager;
    }

    /**
     * Tool: x_session_status
     */
    async x_session_status(args?: { tabId?: number }): Promise<ToolResponse<SessionStatus>> {
        try {
            const status = await this.sessionManager.getSessionStatus(args?.tabId);
            return { ok: true, data: status };
        } catch (e: any) {
            return { ok: false, error: { code: 'RESOURCE_UNAVAILABLE', message: e.message } };
        }
    }

    /**
     * Tool: x_get_active_account
     */
    async x_get_active_account(args?: { tabId?: number }): Promise<ToolResponse<{ account: AccountSummary }>> {
        try {
            const status = await this.sessionManager.getSessionStatus(args?.tabId);
            if (!status.account) return { ok: false, error: { code: 'ACCOUNT_UNRESOLVED', message: 'No account context captured.' } };
            return { ok: true, data: { account: status.account } };
        } catch (e: any) {
            return { ok: false, error: { code: 'SESSION_INVALID', message: e.message } };
        }
    }

    /**
     * Tool: x_get_page_context
     * Return structured scene and entity information for the current tab.
     */
    async x_get_page_context(args?: { tabId?: number }): Promise<ToolResponse<any>> {
        try {
            const tab = await this.sessionManager.getActiveXTab(args?.tabId);
            if (!tab?.id) return { ok: false, error: { code: 'NO_BOUND_TAB', message: 'No active X tab found.' } };
            
            const context = await new Promise(r => chrome.runtime.sendMessage({ 
                type: 'GET_PAGE_CONTEXT', 
                tabId: tab.id 
            }, r));
            
            return { ok: true, data: context };
        } catch (e: any) {
            return { ok: false, error: { code: 'INTERNAL_ERROR', message: e.message } };
        }
    }

    /**
     * Tool: x_read_home_timeline
     * Checks both HomeTimeline and HomeLatestTimeline from background cache.
     */
    async x_read_home_timeline(args?: { tabId?: number }): Promise<ToolResponse<{ tweets: any[] }>> {
        const tab = await this.sessionManager.getActiveXTab(args?.tabId);
        if (!tab?.id) return { ok: false, error: { code: 'SESSION_INVALID', message: 'No active X tab.' } };

        const fullData: any = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_TAB_DATA', tabId: tab.id }, r));
        
        // Check for both types of timelines
        const rawHome = fullData?.data?.HomeTimeline || fullData?.data?.HomeLatestTimeline;
        
        if (!rawHome) return { ok: false, error: { code: 'RESOURCE_UNAVAILABLE', message: 'Home timeline data not yet captured. Please scroll the page.' } };
        
        const tweets = extractTweetsFromTimeline(rawHome);
        return { ok: true, data: { tweets } };
    }

    /**
     * Tool: x_search_tweets
     */
    async x_search_tweets(args?: { tabId?: number }): Promise<ToolResponse<{ tweets: any[] }>> {
        const tab = await this.sessionManager.getActiveXTab(args?.tabId);
        if (!tab?.id) return { ok: false, error: { code: 'SESSION_INVALID', message: 'No active X tab.' } };

        const fullData: any = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_TAB_DATA', tabId: tab.id }, r));
        const rawSearch = fullData?.data?.SearchTimeline;
        
        if (!rawSearch) return { ok: false, error: { code: 'RESOURCE_UNAVAILABLE', message: 'Search results not yet captured.' } };
        
        const tweets = extractTweetsFromTimeline(rawSearch);
        return { ok: true, data: { tweets } };
    }

    /**
     * Tool: x_get_tweet_details
     */
    async x_get_tweet_details(args?: { tabId?: number }): Promise<ToolResponse<{ tweets: any[] }>> {
        const tab = await this.sessionManager.getActiveXTab(args?.tabId);
        if (!tab?.id) return { ok: false, error: { code: 'SESSION_INVALID', message: 'No active X tab.' } };

        const fullData: any = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_TAB_DATA', tabId: tab.id }, r));
        const rawDetail = fullData?.data?.TweetDetail;
        
        if (!rawDetail) return { ok: false, error: { code: 'RESOURCE_UNAVAILABLE', message: 'Tweet details not yet captured.' } };
        
        const tweets = extractTweetsFromTimeline(rawDetail);
        return { ok: true, data: { tweets } };
    }

    /**
     * Tool: x_list_profile_tweets
     * List tweets authored by the profile in the current tab.
     */
    async x_list_profile_tweets(args?: { tabId?: number }): Promise<ToolResponse<{ tweets: any[] }>> {
        const contextResp = await this.x_get_page_context(args);
        if (!contextResp.ok) return contextResp;

        const context = contextResp.data;
        if (context.scene !== 'profile') {
            return { 
                ok: false, 
                error: { 
                    code: 'RESOURCE_UNAVAILABLE', 
                    message: `Tool only available in 'profile' scene. Current scene: ${context.scene}` 
                } 
            };
        }

        const snapshots = context.profileTweetsSnapshot || [];
        if (snapshots.length === 0) {
            return {
                ok: false,
                error: {
                    code: 'RESOURCE_UNAVAILABLE',
                    message: 'No profile tweets captured yet. Please scroll the profile timeline.'
                }
            };
        }

        // Return minimal structure as requested
        const tweets = snapshots.map((t: any) => ({
            tweetId: t.tweetId,
            authorHandle: t.authorHandle,
            authorName: t.authorName,
            text: t.text,
            createdAt: t.createdAt,
            likeCount: t.likeCount,
            replyCount: t.replyCount,
            repostCount: t.repostCount,
            isOwnedByActiveAccount: t.isOwnedByActiveAccount
        }));

        return { ok: true, data: { tweets } };
    }

    /**
     * ToolExecution (Mutation)
     */
    async x_action_like(args: { tweet_id: string, tabId?: number }): Promise<ToolResponse<any>> {
        if (!args.tweet_id) return { ok: false, error: { code: 'INVALID_PARAMETERS', message: 'Missing tweet_id' } };
        return this.x_execute_proxy_action('like', args);
    }

    async x_action_retweet(args: { tweet_id: string, tabId?: number }): Promise<ToolResponse<any>> {
        if (!args.tweet_id) return { ok: false, error: { code: 'INVALID_PARAMETERS', message: 'Missing tweet_id' } };
        return this.x_execute_proxy_action('retweet', args);
    }

    async x_action_bookmark(args: { tweet_id: string, tabId?: number }): Promise<ToolResponse<any>> {
        if (!args.tweet_id) return { ok: false, error: { code: 'INVALID_PARAMETERS', message: 'Missing tweet_id' } };
        return this.x_execute_proxy_action('bookmark', args);
    }

    async x_action_follow(args: { user_id: string, tabId?: number }): Promise<ToolResponse<any>> {
        if (!args.user_id) return { ok: false, error: { code: 'INVALID_PARAMETERS', message: 'Missing user_id' } };
        return this.x_execute_proxy_action('follow', { target_id: args.user_id, ...args });
    }

    private async x_execute_proxy_action(action: string, args: any): Promise<ToolResponse<any>> {
        const tab = await this.sessionManager.getActiveXTab(args.tabId);
        if (!tab?.id) return { ok: false, error: { code: 'SESSION_INVALID', message: 'No target tab.' } };

        try {
            const resp: any = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    type: 'EXEC_PROXY_ACTION',
                    tabId: tab.id,
                    action,
                    tweetId: args.tweet_id || args.target_id,
                    userId: args.user_id || args.target_id
                }, (resp) => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else resolve(resp);
                });
            });

            if (resp && resp.ok) return { ok: true, data: { action, result_status: 'success' } };
            return { ok: false, error: { code: 'EXECUTION_FAILED', message: resp?.error || 'Action failed.' } };
        } catch (e: any) {
            return { ok: false, error: { code: 'INTERNAL_ERROR', message: e.message } };
        }
    }
}
