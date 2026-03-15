import {
    BasePlatformAdapter,
    Credentials,
    PlatformType,
    SendMessageRequest,
    SendMessageResponse,
} from './base-adapter';

/**
 * ChatGptAdapter - DOM 操作方案
 *
 * 背景：ChatGPT 的 API 接口有 proof-token / turnstile-token 等浏览器端运算生成的风控机制，
 * 无法通过直接调用 API 绕过。改用 DOM 操作：找到输入框填入内容，触发 React 感知，点击发送，
 * 然后用 MutationObserver 等待流式回复完成并提取文本。
 *
 * React 兼容处理：ChatGPT 用 React 控制输入框，直接 .value = x 不会触发 React 的状态更新，
 * 必须通过 nativeInputValueSetter 触发 React 的合成事件。
 */
export class ChatGptAdapter extends BasePlatformAdapter {
    readonly platform: PlatformType = 'chatgpt';

    public isTargetApiUrl(url: string): boolean {
        return url.includes('chatgpt.com/backend-api') && url.includes('conversation');
    }

    public extractCredentials(
        url: string,
        requestHeaders: Record<string, string>,
        _responseBody: any
    ): Partial<Credentials> {
        const credentials: Partial<Credentials> = {};
        if (requestHeaders['authorization']) {
            credentials.bearerToken = requestHeaders['authorization'];
        }
        credentials.apiEndpoint = url;
        return credentials;
    }

    public async sendMessage(
        request: SendMessageRequest,
        _credentials: Credentials
    ): Promise<SendMessageResponse> {
        try {
            // ── Step 1: 找到 ChatGPT 的输入框 ──
            const textarea = await this.waitForElement<HTMLTextAreaElement>(
                '#prompt-textarea',
                5000
            );
            if (!textarea) {
                return { success: false, error: 'ChatGPT input box not found. Make sure chatgpt.com is open.', content: '' };
            }

            // ── Step 2: 用 React 兼容方式填入内容 ──
            // 直接 .value = x 无法触发 React 状态更新，需要用 nativeInputValueSetter
            this.setReactInputValue(textarea, request.prompt);

            // 等待 React 处理输入（给 React 的 onChange 时间触发）
            await this.sleep(300);

            // ── Step 3: 找到发送按钮并点击 ──
            const sendButton = await this.waitForElement<HTMLButtonElement>(
                '[data-testid="send-button"]',
                3000
            );
            if (!sendButton) {
                // 清空输入框，避免残留
                this.setReactInputValue(textarea, '');
                return { success: false, error: 'Send button not found or disabled.', content: '' };
            }

            if (sendButton.disabled) {
                this.setReactInputValue(textarea, '');
                return { success: false, error: 'Send button is disabled. Input may be empty or ChatGPT is busy.' , content: '' };
            }

            // ── Step 4: 记录当前对话 ID（用于后续读取正确的回复）──
            const conversationIdBefore = this.getCurrentConversationId();

            sendButton.click();
            console.log('[aiClaw] 📤 Message sent via DOM click');

            // ── Step 5: 等待回复完成 ──
            // 等待"停止生成"按钮出现（表示 ChatGPT 开始回复），再等待它消失（表示完成）
            const content = await this.waitForResponse(10000, 120000);

            if (content === null) {
                return { success: false, error: 'Timeout waiting for ChatGPT response (120s).', content: '' };
            }

            // 获取当前 conversation ID（可能是新建的）
            const conversationId = this.getCurrentConversationId() || conversationIdBefore || undefined;

            return { success: true, content, conversationId };

        } catch (error: any) {
            console.error('[aiClaw] DOM sendMessage error:', error);
            return { success: false, error: error.message, content: '' };
        }
    }

    // ── 工具方法 ──

    /**
     * 用 React 兼容方式设置输入框的值。
     * React 会拦截 .value 的直接赋值，需要触发原生 input 事件。
     */
    private setReactInputValue(element: HTMLTextAreaElement | HTMLElement, value: string) {
        // 方法一：通过 React 内部的 nativeInputValueSetter（最可靠）
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
        )?.set;

        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(element, value);
        } else {
            (element as HTMLTextAreaElement).value = value;
        }

        // 触发 React 的合成事件链
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * 等待 ChatGPT 的流式回复完成，返回最终回复文本。
     *
     * 判断逻辑：
     *   1. 等待"停止生成"按钮出现（表示开始生成）
     *   2. 等待"停止生成"按钮消失（表示生成完成）
     *   3. 读取最后一条 assistant 消息的文本
     */
    private async waitForResponse(startTimeout: number, completeTimeout: number): Promise<string | null> {
        const stopButtonSelector = '[data-testid="stop-button"]';

        // 等待开始生成（stop button 出现）
        const started = await this.waitForElement(stopButtonSelector, startTimeout);
        if (!started) {
            console.warn('[aiClaw] Stop button never appeared, ChatGPT may not have started responding');
            // 即使没看到 stop button，也尝试读取最新消息（可能是极短的回复）
        }

        // 等待生成完成（stop button 消失）
        const completed = await this.waitForElementToDisappear(stopButtonSelector, completeTimeout);
        if (!completed) {
            console.warn('[aiClaw] Response timed out after', completeTimeout, 'ms');
            return null;
        }

        // 额外等待一小段时间，确保 DOM 完全更新
        await this.sleep(500);

        // 读取最后一条 assistant 消息
        return this.extractLastAssistantMessage();
    }

    /**
     * 提取最后一条 assistant 消息的文本内容。
     * ChatGPT 的消息结构：[data-message-author-role="assistant"]
     */
    private extractLastAssistantMessage(): string {
        // 找所有 assistant 消息，取最后一条
        const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
        if (messages.length === 0) {
            console.warn('[aiClaw] No assistant messages found in DOM');
            return '';
        }

        const lastMessage = messages[messages.length - 1];

        // 提取纯文本，保留换行
        const textContent = lastMessage.textContent || '';
        return textContent.trim();
    }

    /**
     * 从 URL 中提取当前的 conversation ID。
     * ChatGPT 的 URL 格式：https://chatgpt.com/c/<conversation_id>
     */
    private getCurrentConversationId(): string | null {
        const match = window.location.pathname.match(/\/c\/([a-f0-9-]+)/);
        return match ? match[1] : null;
    }

    /**
     * 等待某个 CSS 选择器的元素出现在 DOM 中。
     */
    private waitForElement<T extends Element>(selector: string, timeout: number): Promise<T | null> {
        return new Promise((resolve) => {
            // 先检查是否已经存在
            const existing = document.querySelector<T>(selector);
            if (existing) {
                resolve(existing);
                return;
            }

            const timer = setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);

            const observer = new MutationObserver(() => {
                const el = document.querySelector<T>(selector);
                if (el) {
                    clearTimeout(timer);
                    observer.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    /**
     * 等待某个 CSS 选择器的元素从 DOM 中消失。
     */
    private waitForElementToDisappear(selector: string, timeout: number): Promise<boolean> {
        return new Promise((resolve) => {
            // 先检查是否已经不存在
            if (!document.querySelector(selector)) {
                resolve(true);
                return;
            }

            const timer = setTimeout(() => {
                observer.disconnect();
                resolve(false); // 超时，元素仍然存在
            }, timeout);

            const observer = new MutationObserver(() => {
                if (!document.querySelector(selector)) {
                    clearTimeout(timer);
                    observer.disconnect();
                    resolve(true);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
