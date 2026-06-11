/**
 * Chrome Extension 消息工具函数
 *
 * Manifest V3 兼容性工具集
 */

/**
 * 安全地向 content script 发送消息，带重试机制
 *
 * Manifest V3 兼容性修复：
 * - 检查 tab 是否有效且已加载
 * - 使用 PING 消息验证 content script 是否就绪
 * - 失败时自动重试（最多 3 次）
 * - 提供清晰的错误信息
 */
export async function sendMessageToTab<T = any>(
    tabId: number,
    message: any,
    options: { maxRetries?: number; retryDelay?: number; skipPing?: boolean } = {}
): Promise<T> {
    const { maxRetries = 3, retryDelay = 500, skipPing = false } = options;
    const messageType = message.type || 'UNKNOWN';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // 先检查 tab 是否还存在
            const tab = await chrome.tabs.get(tabId).catch(() => null);
            if (!tab) {
                // Tab 不存在不应该重试，直接失败
                throw new Error(`Tab ${tabId} no longer exists - cannot retry`);
            }

            // 验证 content script 是否就绪（除非是 PING 消息本身或显式跳过）
            if (!skipPing && message.type !== 'TC_PING') {
                try {
                    // PING 消息带简单重试（最多 2 次）
                    let pingSuccess = false;
                    for (let pingAttempt = 1; pingAttempt <= 2; pingAttempt++) {
                        try {
                            await chrome.tabs.sendMessage(tabId, { type: 'TC_PING' });
                            pingSuccess = true;
                            break;
                        } catch (pingError) {
                            if (pingAttempt === 2) throw pingError;
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                    }

                    if (!pingSuccess && attempt < maxRetries) {
                        console.warn(`[sendMessageToTab] Content script not ready on attempt ${attempt}, retrying...`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        continue;
                    }
                } catch (pingError) {
                    if (attempt < maxRetries) {
                        console.warn(`[sendMessageToTab] Ping failed on attempt ${attempt}, content script may not be ready`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        continue;
                    }
                    throw pingError;
                }
            }

            // 发送实际消息
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

            // 等待后重试
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    throw new Error('Unreachable');
}
