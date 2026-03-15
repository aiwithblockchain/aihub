/**
 * consts.ts - aiClaw 常量定义
 *
 * 定义存储键名、消息类型、平台相关常量。
 */

// ── chrome.storage.local 中使用的键名 ──
export const STORAGE_KEY_CREDENTIALS = 'ac_credentials';  // 存储各平台凭证

// ── 扩展内部消息类型 ──
export enum MsgType {
    PING = 'AC_PING',
    CAPTURED_CREDENTIALS = 'AC_CAPTURED_CREDENTIALS',
    EXECUTE_TASK = 'AC_EXECUTE_TASK',
    TASK_RESULT = 'AC_TASK_RESULT',
    AC_SEND_TEST_MESSAGE = 'AC_SEND_TEST_MESSAGE',
}

// ── 平台类型 ──
export type PlatformType = 'chatgpt' | 'gemini' | 'grok';

// ── injection → content 的 postMessage source 标识 ──
export const INJECTION_SOURCE = 'aiclaw-injection';

// ── 平台 URL 匹配规则 ──
// 用于 injection.ts 判断当前拦截到的 fetch 请求属于哪个平台的 API
export const PLATFORM_API_PATTERNS: Record<PlatformType, RegExp[]> = {
    chatgpt: [
        /chatgpt\.com\/backend-api\/(conversation|me|accounts\/check)/,
        /chat\.openai\.com\/backend-api\/(conversation|me|accounts\/check)/,
    ],
    gemini: [
        /gemini\.google\.com\/_\/BardChatUi\//,
        /gemini\.google\.com\/app\/_\/BardChatUi\//,
        /alkalimakersuite-pa\.clients6\.google\.com\//,
    ],
    grok: [
        /grok\.com\/rest\/app-chat\//,
        /grok\.com\/rest\/user-settings\//,
        /x\.com\/i\/api\/2\/grok\//,
    ],
};

/**
 * 检测一个请求 URL 是否是我们需要关注的 AI 平台 API 调用。
 * 如果匹配，返回平台名称；否则返回 null。
 */
export function detectPlatformFromUrl(url: string): PlatformType | null {
    for (const [platform, patterns] of Object.entries(PLATFORM_API_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(url)) {
                return platform as PlatformType;
            }
        }
    }
    return null;
}

/**
 * 根据 hostname 检测当前页面所在的平台。
 */
export function detectPlatformFromHostname(hostname: string): PlatformType | null {
    if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
        return 'chatgpt';
    }
    if (hostname.includes('gemini.google.com')) {
        return 'gemini';
    }
    if (hostname.includes('grok.com') || hostname.includes('x.com')) {
        return 'grok';
    }
    return null;
}
