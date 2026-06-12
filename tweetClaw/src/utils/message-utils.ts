/**
 * Chrome Extension 消息工具函数
 *
 * Manifest V3 兼容性工具集
 */

/**
 * 安全地向 content script 发送消息，带重试机制
 *
 * 重试逻辑直接覆盖 content script 未就绪的情况：
 * - 检查 tab 是否有效且已加载
 * - 失败时自动重试（最多 3 次）
 * - content script 未注入时，sendMessage 会抛错，进入外层重试
 * - 提供清晰的错误信息
 */
export async function sendMessageToTab<T = any>(
    tabId: number,
    message: any,
    options: { maxRetries?: number; retryDelay?: number } = {}
): Promise<T> {
    const { maxRetries = 3, retryDelay = 500 } = options;
    const messageType = message.type || 'UNKNOWN';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // 先检查 tab 是否还存在
            const tab = await chrome.tabs.get(tabId).catch(() => null);
            if (!tab) {
                // Tab 不存在不应该重试，直接失败
                throw new Error(`Tab ${tabId} no longer exists - cannot retry`);
            }

            // 直接发送消息；如果 content script 未就绪，会抛错进入外层重试
            const response = await chrome.tabs.sendMessage(tabId, message);
            return response as T;

        } catch (error: any) {
            const isLastAttempt = attempt === maxRetries;
            const errorMessage = error?.message || String(error);

            // Tab 不存在的错误不应该重试
            if (errorMessage.includes('no longer exists')) {
                throw new Error(`Tab ${tabId} closed - message type: ${messageType}`);
            }

            console.warn(
                `[sendMessageToTab] Message '${messageType}' failed (attempt ${attempt}/${maxRetries}): ${errorMessage}`
            );

            if (isLastAttempt) {
                throw new Error(
                    `Failed to send '${messageType}' to content script after ${maxRetries} attempts: ${errorMessage}`
                );
            }

            // 等待后重试（content script 可能正在注入或页面正在加载）
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    throw new Error('Unreachable');
}
