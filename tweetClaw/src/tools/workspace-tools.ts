import { WorkspaceManager } from '../session/workspace-manager';
import { ToolResponse } from '../types/common';
import { WorkspaceTab } from '../types/session';
import { validateTweetDetailParams, formatTweetDetailUrl } from '../utils/x-url-utils';

/**
 * WorkspaceTools - Tools for managing browser tabs and X workspace.
 */
export class WorkspaceTools {
    private workspaceManager: WorkspaceManager;

    constructor(workspaceManager: WorkspaceManager) {
        this.workspaceManager = workspaceManager;
    }

    /**
     * Tool: browser_create_x_tab
     */
    async browser_create_x_tab(args?: { url?: string }): Promise<ToolResponse<WorkspaceTab>> {
        try {
            const tab = await this.workspaceManager.createXTab(args?.url);
            return { ok: true, data: tab };
        } catch (e: any) {
            return { ok: false, error: { code: 'INTERNAL_ERROR', message: e.message } };
        }
    }

    /**
     * Tool: browser_list_x_tabs
     */
    async browser_list_x_tabs(): Promise<ToolResponse<{ tabs: WorkspaceTab[] }>> {
        try {
            const tabs = await this.workspaceManager.listXTabs();
            return { ok: true, data: { tabs } };
        } catch (e: any) {
            return { ok: false, error: { code: 'RESOURCE_UNAVAILABLE', message: e.message } };
        }
    }

    /**
     * Tool: browser_focus_tab
     */
    async browser_focus_tab(args: { tabId: number }): Promise<ToolResponse<{ tabId: number, active: boolean }>> {
        if (args.tabId === undefined) return { ok: false, error: { code: 'INVALID_PARAMETERS', message: 'Missing tabId' } };
        
        try {
            const success = await this.workspaceManager.focusTab(args.tabId);
            if (!success) return { ok: false, error: { code: 'NO_BOUND_TAB', message: `Tab ${args.tabId} not found.` } };
            return { ok: true, data: { tabId: args.tabId, active: true } };
        } catch (e: any) {
            return { ok: false, error: { code: 'INTERNAL_ERROR', message: e.message } };
        }
    }

    /**
     * Tool: browser_close_tab
     */
    async browser_close_tab(args: { tabId: number }): Promise<ToolResponse<{ closed: boolean, tabId: number }>> {
        if (args.tabId === undefined) return { ok: false, error: { code: 'INVALID_PARAMETERS', message: 'Missing tabId' } };

        try {
            await this.workspaceManager.closeTab(args.tabId);
            return { ok: true, data: { closed: true, tabId: args.tabId } };
        } catch (e: any) {
            return { ok: false, error: { code: 'INTERNAL_ERROR', message: e.message } };
        }
    }

    /**
     * Tool: browser_navigate_tab
     */
    async browser_navigate_tab(args: { tabId: number, url: string }): Promise<ToolResponse<{ tabId: number, url: string }>> {
        if (args.tabId === undefined) return { ok: false, error: { code: 'INVALID_PARAMETERS', message: 'Missing tabId' } };
        if (!args.url) return { ok: false, error: { code: 'INVALID_PARAMETERS', message: 'Missing url' } };

        // URL Constraint
        const isX = args.url.includes('x.com') || args.url.includes('twitter.com');
        if (!isX) {
            return { ok: false, error: { code: 'POLICY_DENIED', message: 'Only X (x.com or twitter.com) URLs are allowed.' } };
        }

        try {
            const result = await this.workspaceManager.navigateTab(args.tabId, args.url);
            if (!result.ok) {
                const code = result.error?.includes('No tab with id') ? 'NO_BOUND_TAB' : 'INTERNAL_ERROR';
                return { ok: false, error: { code, message: result.error || 'Navigation failed' } };
            }
            return { ok: true, data: { tabId: args.tabId, url: args.url } };
        } catch (e: any) {
            return { ok: false, error: { code: 'INTERNAL_ERROR', message: e.message } };
        }
    }
    /**
     * Tool: x_open_tweet_detail
     * Semantic wrapper for browser_navigate_tab to open a specific tweet detail page.
     */
    async x_open_tweet_detail(args: { tabId: number, screenName: string, tweetId: string }): Promise<ToolResponse<{ tabId: number, url: string }>> {
        if (args.tabId === undefined) return { ok: false, error: { code: 'INVALID_PARAMETERS', message: 'Missing tabId' } };
        
        const valid = validateTweetDetailParams(args.screenName, args.tweetId);
        if (!valid.ok) {
            return { ok: false, error: { code: 'INVALID_PARAMETERS', message: valid.error } };
        }

        const url = formatTweetDetailUrl(args.screenName, args.tweetId);
        return this.browser_navigate_tab({ tabId: args.tabId, url });
    }
}
