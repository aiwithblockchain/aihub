import { SessionStatus, RouteKind, AccountSummary } from '../types/session';
import { parseRouteKind } from '../utils/route-parser';

/**
 * SessionManager handles the Session Bridge layer (Layer 1).
 * Communicates with the background TabDataStore.
 */
export class SessionManager {

    async getSessionStatus(targetTabId?: number): Promise<SessionStatus> {
        let tabId = targetTabId;
        if (tabId === undefined) {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            tabId = tabs[0]?.id;
        }

        if (tabId === undefined || tabId === null) {
            return {
                connected: true,
                platform: 'x-web',
                profileMode: 'chrome',
                tabBound: false,
                sessionValid: false,
                routeKind: 'none',
                account: null,
            };
        }

        const tab = await chrome.tabs.get(tabId).catch(() => null);
        const url = tab?.url || '';
        const routeKind = parseRouteKind(url);

        // Fetch captured data from background state
        const state: any = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'GET_SESSION_STATUS', tabId }, (resp) => {
                if (chrome.runtime.lastError) resolve(null);
                else resolve(resp);
            });
        });

        return {
            connected: true,
            platform: 'x-web',
            profileMode: 'chrome',
            tabBound: !!tab,
            sessionValid: !!state?.account,
            routeKind,
            account: state?.account || null,
        };
    }

    /**
     * Finds active X tabs
     */
    async getActiveXTab(targetTabId?: number): Promise<chrome.tabs.Tab | null> {
        if (targetTabId !== undefined) return chrome.tabs.get(targetTabId).catch(() => null);
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        return (tab?.url?.includes('x.com') || tab?.url?.includes('twitter.com')) ? tab : null;
    }
}
