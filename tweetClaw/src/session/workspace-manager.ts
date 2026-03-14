import { WorkspaceTab } from '../types/session';
import { parseRouteKind } from '../utils/route-parser';

/**
 * WorkspaceManager handles the Session Bridge layer (Layer 1) specifically for tab control.
 */
export class WorkspaceManager {
    
    /**
     * list all currently open X tabs
     */
    async listXTabs(): Promise<WorkspaceTab[]> {
        const result: any[] = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'LIST_ALL_X_TABS' }, (resp) => {
                if (chrome.runtime.lastError) resolve([]);
                else resolve(resp);
            });
        });

        return result.map(t => ({
            tabId: t.id,
            url: t.url || '',
            active: !!t.active,
            routeKind: parseRouteKind(t.url || ''),
            accountHandle: t.account?.handle || null
        }));
    }

    /**
     * create a new X tab
     */
    async createXTab(url: string = 'https://x.com/'): Promise<WorkspaceTab> {
        const resp: any = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'CREATE_X_TAB', url }, (r) => {
                if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
                else resolve(r || { ok: false });
            });
        });

        if (!resp.ok) throw new Error(resp.error || 'Failed to create tab');

        return {
            tabId: resp.tabId,
            url: url,
            active: true,
            routeKind: parseRouteKind(url),
            accountHandle: null
        };
    }

    /**
     * focus an existing X tab
     */
    async focusTab(tabId: number): Promise<boolean> {
        const resp: any = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'FOCUS_X_TAB', tabId }, (r) => {
                if (chrome.runtime.lastError) resolve({ ok: false });
                else resolve(r || { ok: false });
            });
        });
        return !!resp.ok;
    }

    /**
     * close an X tab
     */
    async closeTab(tabId: number): Promise<boolean> {
        const resp: any = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'CLOSE_X_TAB', tabId }, (r) => {
                if (chrome.runtime.lastError) resolve({ ok: false });
                else resolve(r || { ok: false });
            });
        });
        return !!resp.ok;
    }

    /**
     * navigate an existing X tab to a new URL
     */
    async navigateTab(tabId: number, url: string): Promise<{ ok: boolean, error?: string }> {
        const resp: any = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'NAVIGATE_X_TAB', tabId, url }, (r) => {
                if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
                else resolve(r || { ok: false });
            });
        });
        return resp;
    }
}
