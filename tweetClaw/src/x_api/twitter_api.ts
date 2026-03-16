import { __DBK_query_id_map, __DBK_bearer_token, watchedOps } from '../capture/consts';
import { buildFeatures, extractMissingFeature } from './feature_manager';
import { getTransactionIdFor } from './txid';

/**
 * Twitter API Client
 * Designed to run in Content Script (for cookies) and Background (for harvesting).
 */

async function getAuthHeader(): Promise<string> {
    const res = await chrome.storage.local.get(__DBK_bearer_token);
    return (res[__DBK_bearer_token] as string) || "";
}

async function getCsrfToken(): Promise<string> {
    // Content script: read from document.cookie
    // Background: read from chrome.cookies
    if (typeof document !== 'undefined' && document.cookie) {
        const match = document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/);
        if (match) return match[1];
    }
    
    return new Promise((resolve) => {
        chrome.cookies.get({ url: 'https://x.com', name: 'ct0' }, (cookie) => {
            resolve(cookie ? cookie.value : "");
        });
    });
}

async function getUrlWithQueryId(op: string): Promise<{ url: string, path: string } | null> {
    const res = await chrome.storage.local.get(__DBK_query_id_map);
    const map = (res[__DBK_query_id_map] || {}) as Record<string, string>;
    const queryId = map[op];
    if (!queryId) return null;
    const url = `https://x.com/i/api/graphql/${queryId}/${op}`;
    const path = `/i/api/graphql/${queryId}/${op}`;
    return { url, path };
}

export async function performMutation(op: string, variables: any) {
    const target = await getUrlWithQueryId(op);
    if (!target) throw new Error(`Missing harvested queryId for operation: ${op}`);

    const bearer = await getAuthHeader();
    const csrf = await getCsrfToken();
    const features = await buildFeatures();
    
    // TweetCat txid logic
    const txid = await getTransactionIdFor('POST', target.path);

    const headers: Record<string, string> = {
        'authorization': bearer,
        'x-csrf-token': csrf as string,
        'x-client-transaction-id': txid,
        'content-type': 'application/json',
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
        'referer': 'https://x.com/',
        'accept': '*/*'
    };

    const payload = {
        variables,
        features,
        queryId: target.url.split('/')[5]
    };

    const response = await fetch(target.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        credentials: 'include' // Crucial for cookies in Content Script
    });

    if (!response.ok) {
        const text = await response.text();
        await extractMissingFeature(text);
        throw new Error(`X API Error ${response.status} for ${op}: ${text}`);
    }

    return await response.json();
}

/**
 * 专门处理推特老旧的 1.1 REST API（如 friendships/create.json）
 * 这些接口不使用 GraphQL，也不需要 queryId。
 */
export async function performLegacyREST(path: string, params: Record<string, string>) {
    const bearer = await getAuthHeader();
    const csrf = await getCsrfToken();
    const txid = await getTransactionIdFor('POST', path);

    const headers: Record<string, string> = {
        'authorization': bearer,
        'x-csrf-token': csrf as string,
        'x-client-transaction-id': txid,
        'content-type': 'application/x-www-form-urlencoded',
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
        'referer': 'https://x.com/',
        'accept': '*/*'
    };

    const url = `https://x.com${path}`;
    const body = new URLSearchParams(params).toString();

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        credentials: 'include'
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`X Legacy API Error ${response.status} for ${path}: ${text}`);
    }

    return await response.json();
}

export async function performQuery(op: string, variables: any) {
    const target = await getUrlWithQueryId(op);
    if (!target) throw new Error(`Missing harvested queryId for operation: ${op}`);

    const bearer = await getAuthHeader();
    const csrf = await getCsrfToken();
    const features = await buildFeatures();
    
    const params = new URLSearchParams();
    params.append('variables', JSON.stringify(variables));
    params.append('features', JSON.stringify(features));
    
    const url = `${target.url}?${params.toString()}`;

    const headers: Record<string, string> = {
        'authorization': bearer,
        'x-csrf-token': csrf as string,
        'content-type': 'application/json',
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
        'referer': 'https://x.com/',
        'accept': '*/*'
    };

    const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include'
    });

    if (!response.ok) {
        const text = await response.text();
        await extractMissingFeature(text);
        throw new Error(`X API Error ${response.status} for ${op}: ${text}`);
    }

    const result = await response.json();
    console.log(`[TwitterAPI] GraphQL ${op} Response:`, result);
    return result;
}

/**
 * 根据用户名获取完整的用户 Profile 信息
 */
export async function fetchUserByUsername(username: string) {
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    const data = await performQuery('UserByScreenName', {
        screen_name: cleanUsername,
        withSafetyModeUserFields: true
    });
    
    // 从复杂的 GraphQL 响应中提取用户对象
    const userResult = data?.data?.user?.result;
    if (!userResult || userResult.__typename === 'UserUnavailable') {
        return null;
    }
    
    return userResult;
}
