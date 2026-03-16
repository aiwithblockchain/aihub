import {
    BasePlatformAdapter,
    Credentials,
    PlatformType,
    SendMessageRequest,
    SendMessageResponse,
} from './base-adapter';

/**
 * ChatGptAdapter - DOM 操作方案（基于真实日志分析）
 *
 * ━━ 日志揭示的关键事实 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 1. 输入框是 ProseMirror contenteditable div（不是 textarea）
 *    - 选择器: #prompt-textarea（div，不是 textarea）
 *    - 输入方式: focus() + document.execCommand('insertText', false, text)
 *    - 不需要 nativeInputValueSetter，ProseMirror 直接监听 DOM mutation
 *
 * 2. 发送/停止按钮是「同一个按钮」，通过属性切换角色
 *    - 空闲: button#composer-submit-button[data-testid="send-button"]
 *    - 生成中: button#composer-submit-button[data-testid="stop-button"]
 *    - 不是两个按钮出现/消失，而是 data-testid 属性切换
 *
 * 3. 发送时序（来自日志）
 *    t=0       : form.group/composer 已存在，data-expanded=""
 *    t=3070    : input.focus() → class 变为 "ProseMirror ProseMirror-focused"
 *    t=4096    : 第一个字符输入 → TEXT 变化
 *    t=4104    : <span>(voice按钮容器) 被移除
 *    t=4105    : button[data-testid="send-button"] 被插入（这才是首次出现！）
 *    t=4119    : INPUT 事件触发（比 TEXT 变化晚 ~23ms）
 *    t=4982    : 点击发送 → data-testid 从 send-button → stop-button（同一按钮！）
 *    t=5017    : input 被清空（placeholder 恢复）
 *    t=15334   : data-testid 从 stop-button → send-button → 生成完成！
 *
 * 4. 生成完成后提取回复
 *    - 等 data-testid="send-button" 再次出现（即按钮从 stop → send）
 *    - 查询 [data-message-author-role="assistant"] 取最后一条
 *    - 注意：msgs 从 1 变到 2 不代表完成，需要等按钮切回 send
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// 选择器常量（ChatGPT 更新 DOM 时只需修改这里）
const SEL = {
    INPUT:      '#prompt-textarea',                        // ProseMirror div（contenteditable）
    SEND_BTN:   '[data-testid="send-button"]',             // 发送按钮（空闲状态）
    STOP_BTN:   '[data-testid="stop-button"]',             // 停止按钮（生成中）
    SUBMIT_BTN: '#composer-submit-button',                 // 同一个按钮的稳定 ID 选择器
    MSG_ASST:   '[data-message-author-role="assistant"]',  // assistant 消息容器
} as const;

const NEW_CHAT_SELECTORS = [
    '[data-testid="create-new-chat-button"]',
    'button[aria-label="New chat"]',
    'button[aria-label*="New chat"]',
    'a[aria-label="New chat"]',
    'a[aria-label*="New chat"]',
    'button[title="New chat"]',
    'a[title="New chat"]',
] as const;

const NEW_CHAT_TEXT_PATTERNS = [
    'new chat',
    'new conversation',
    '新聊天',
    '新建聊天',
    '新对话',
] as const;

// 超时配置（ms）
const TIMEOUTS = {
    FIND_INPUT:     8_000,   // 等待输入框
    SEND_BTN_READY: 5_000,   // 输入内容后等待发送按钮出现
    WAIT_START:    15_000,   // 等待 AI 开始生成（stop-button 出现）
    WAIT_COMPLETE: 180_000,  // 等待 AI 生成完成（stop→send 切换）
} as const;

export class ChatGptAdapter extends BasePlatformAdapter {
    readonly platform: PlatformType = 'chatgpt';

    public async createNewConversation(
        request: Pick<SendMessageRequest, 'model'>
    ): Promise<SendMessageResponse> {
        const t = (msg: string) => console.log(`[aiClaw ChatGPT] ${msg}`);
        const previousConversationId = this.getCurrentConversationId();

        try {
            t('New conversation: 检查当前是否已经是空白会话...');
            if (!previousConversationId) {
                const input = await this.waitForElement<HTMLElement>(SEL.INPUT, 3_000);
                if (input) {
                    t('New conversation: 当前已在新会话页面');
                    return {
                        success: true,
                        content: '',
                        conversationId: undefined,
                    };
                }
            }

            t('New conversation: 查找 New chat 按钮...');
            const trigger = this.findNewConversationTrigger();
            if (!trigger) {
                return {
                    success: false,
                    content: '',
                    error: '未找到 New chat 按钮，请确认 ChatGPT 侧边栏已展开',
                };
            }

            this.clickElement(trigger);
            t('New conversation: 已点击 New chat');

            const ready = await this.waitForNewConversationReady(previousConversationId, 15_000);
            if (!ready) {
                return {
                    success: false,
                    content: '',
                    error: '新建对话后页面未就绪，请确认 ChatGPT 页面可正常切换到新会话',
                };
            }

            await this.sleep(300);
            const conversationId = this.getCurrentConversationId() || undefined;
            t(`New conversation: 页面已就绪 (conversationId=${conversationId ?? 'none'})`);

            if (request.model) {
                t(`New conversation: 当前忽略 model=${request.model}，后续可再补模型切换`);
            }

            return {
                success: true,
                content: '',
                conversationId,
            };
        } catch (error: any) {
            console.error('[aiClaw ChatGPT] createNewConversation 出错:', error);
            return {
                success: false,
                content: '',
                error: error.message || String(error),
            };
        }
    }

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
        const t = (msg: string) => console.log(`[aiClaw ChatGPT] ${msg}`);

        try {
            // ── Step 1: 找到 ProseMirror 输入框 ──────────────────────────────
            t('Step 1: 等待输入框...');
            const input = await this.waitForElement<HTMLElement>(SEL.INPUT, TIMEOUTS.FIND_INPUT);
            if (!input) {
                return { success: false, error: '未找到输入框，请确认 chatgpt.com 页面已加载', content: '' };
            }
            t(`Step 1 OK: 找到输入框 (contenteditable=${input.getAttribute('contenteditable')})`);

            // ── Step 2: 聚焦并用 execCommand 填入内容 ────────────────────────
            // ProseMirror 直接监听 DOM mutation，不走 React 合成事件
            // 日志显示：TEXT 变化 (t=4096) → send-button 出现 (t=4105) → INPUT 事件 (t=4119)
            // 所以只需 focus + execCommand，无需 nativeInputValueSetter
            t('Step 2: 填入内容...');
            input.focus();
            await this.sleep(100); // 等待 focus 事件处理

            // 清空现有内容（如有残留）
            const existing = input.textContent?.trim();
            if (existing) {
                document.execCommand('selectAll', false);
                document.execCommand('delete', false);
                await this.sleep(50);
            }

            // 插入文本（ProseMirror 会监听这个 mutation）
            document.execCommand('insertText', false, request.prompt);
            t(`Step 2 OK: 已插入文本 "${request.prompt.slice(0, 30)}..."`);

            // ── Step 3: 等待发送按钮出现（输入内容后按钮才出现） ──────────────
            // 日志：输入第一个字符约 9ms 后 send-button 出现
            // 加冗余等待到 5s，应对网络慢的情况
            t('Step 3: 等待 send-button 出现...');
            const sendBtn = await this.waitForSendButton(TIMEOUTS.SEND_BTN_READY);
            if (!sendBtn) {
                t('Step 3 FAIL: send-button 未出现，清空输入并退出');
                input.focus();
                document.execCommand('selectAll', false);
                document.execCommand('delete', false);
                return { success: false, error: '发送按钮未出现（输入可能未被识别）', content: '' };
            }
            t('Step 3 OK: send-button 已出现且可点击');

            // ── Step 4: 记录发送前的消息数量，用于后续定位新回复 ─────────────
            const msgCountBefore = document.querySelectorAll(SEL.MSG_ASST).length;
            const conversationIdBefore = this.getCurrentConversationId();

            // ── Step 5: 点击发送按钮 ──────────────────────────────────────────
            // 日志：点击后 data-testid 从 send-button 变为 stop-button（同一个按钮！）
            t('Step 5: 点击发送按钮...');
            sendBtn.click();
            t('Step 5 OK: 已点击发送');

            // ── Step 6: 等待 AI 开始生成（按钮切换到 stop-button）────────────
            t('Step 6: 等待 AI 开始生成（stop-button 出现）...');
            const started = await this.waitForStopButton(TIMEOUTS.WAIT_START);
            if (!started) {
                t('Step 6 WARN: AI 可能没有开始生成（15s 内未看到 stop-button）');
                // 不直接退出，继续尝试等待完成
            } else {
                t('Step 6 OK: AI 已开始生成');
            }

            // ── Step 7: 等待 AI 生成完成 ─────────────────────────────────────
            // 新版 ChatGPT 生成结束后不一定回到 send-button，也可能直接收起提交按钮，
            // 回到 voice/空白 composer 状态，所以这里不能只盯 send-button。
            t('Step 7: 等待 AI 生成完成...');
            const completed = await this.waitForGenerationComplete(TIMEOUTS.WAIT_COMPLETE, started);
            if (!completed) {
                return { success: false, error: `等待 AI 回复超时（${TIMEOUTS.WAIT_COMPLETE / 1000}s）`, content: '' };
            }
            t('Step 7 OK: AI 生成完成');

            // ── Step 8: 额外等待确保 DOM 稳定 ────────────────────────────────
            await this.sleep(300);

            // ── Step 9: 提取回复文本 ──────────────────────────────────────────
            t('Step 9: 提取回复...');
            const content = this.extractLatestAssistantMessage(msgCountBefore);
            if (!content) {
                return { success: false, error: '未能从 DOM 中提取到 AI 回复', content: '' };
            }
            t(`Step 9 OK: 提取到回复（${content.length} 字符）`);

            const conversationId = this.getCurrentConversationId() || conversationIdBefore || undefined;

            return { success: true, content, conversationId };

        } catch (error: any) {
            console.error('[aiClaw ChatGPT] sendMessage 出错:', error);
            return { success: false, error: error.message || String(error), content: '' };
        }
    }

    // ── 私有方法 ────────────────────────────────────────────────────────────

    /**
     * 等待发送按钮出现并可用。
     *
     * 关键发现（来自日志）：
     * - 空白状态下没有 send-button，只有 voice 按钮（包在 <span> 里）
     * - 输入第一个字符后：<span>(voice) 被移除，send-button 被插入
     * - 这个 send-button 出现时就是 disabled=false（直接可点击）
     */
    private waitForSendButton(timeout: number): Promise<HTMLButtonElement | null> {
        return new Promise((resolve) => {
            // 先检查是否已存在
            const existing = document.querySelector<HTMLButtonElement>(SEL.SEND_BTN);
            if (existing && !existing.disabled) {
                resolve(existing);
                return;
            }

            const timer = setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);

            const observer = new MutationObserver(() => {
                const btn = document.querySelector<HTMLButtonElement>(SEL.SEND_BTN);
                if (btn && !btn.disabled) {
                    clearTimeout(timer);
                    observer.disconnect();
                    resolve(btn);
                }
            });

            observer.observe(document.body, {
                childList: true, subtree: true,
                attributes: true, attributeFilter: ['data-testid', 'disabled'],
            });
        });
    }

    /**
     * 等待停止按钮出现（AI 开始生成的信号）。
     *
     * 关键发现：同一个 button#composer-submit-button 会把 data-testid
     * 从 "send-button" 改为 "stop-button"，不是新元素插入。
     * 所以 waitForElement 可以直接等 [data-testid="stop-button"]。
     */
    private waitForStopButton(timeout: number): Promise<boolean> {
        return new Promise((resolve) => {
            if (document.querySelector(SEL.STOP_BTN)) {
                resolve(true);
                return;
            }

            const timer = setTimeout(() => {
                observer.disconnect();
                resolve(false);
            }, timeout);

            const observer = new MutationObserver(() => {
                if (document.querySelector(SEL.STOP_BTN)) {
                    clearTimeout(timer);
                    observer.disconnect();
                    resolve(true);
                }
            });

            observer.observe(document.body, {
                childList: true, subtree: true,
                attributes: true, attributeFilter: ['data-testid'],
            });
        });
    }

    /**
     * 等待生成完成。
     *
     * 兼容两种完成形态：
     * 1. stop-button -> send-button
     * 2. stop-button 消失，composer 回到空白/voice 状态
     */
    private waitForGenerationComplete(timeout: number, started: boolean): Promise<boolean> {
        return new Promise((resolve) => {
            if (this.hasGenerationCompleted(started)) {
                resolve(true);
                return;
            }

            const timer = setTimeout(() => {
                observer.disconnect();
                resolve(false);
            }, timeout);

            const observer = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.type !== 'attributes' && m.type !== 'childList') {
                        continue;
                    }
                    if (this.hasGenerationCompleted(started)) {
                        clearTimeout(timer);
                        observer.disconnect();
                        resolve(true);
                        return;
                    }
                }
            });

            observer.observe(document.body, {
                childList: true, subtree: true,
                attributes: true, attributeFilter: ['data-testid'],
            });
        });
    }

    private hasGenerationCompleted(started: boolean): boolean {
        const stopBtn = document.querySelector(SEL.STOP_BTN);
        if (stopBtn) {
            return false;
        }

        const sendBtn = document.querySelector(SEL.SEND_BTN);
        if (sendBtn) {
            return true;
        }

        if (!started) {
            return false;
        }

        const submitBtn = document.querySelector(SEL.SUBMIT_BTN);
        if (!submitBtn) {
            return true;
        }

        const testId = submitBtn.getAttribute('data-testid');
        return testId === null || testId !== 'stop-button';
    }

    /**
     * 提取最新的 assistant 消息文本。
     *
     * 日志中观察到：
     * - 发送前有 N 条 assistant 消息
     * - 发送后新增一条（id 以 "request-placeholder-" 开头的临时消息，生成完成后换成真实 id）
     * - 取最后一条即为当前回复
     */
    private extractLatestAssistantMessage(msgCountBefore: number): string {
        const messages = document.querySelectorAll(SEL.MSG_ASST);
        if (messages.length === 0) {
            console.warn('[aiClaw ChatGPT] 没有找到 assistant 消息');
            return '';
        }

        const lastMessage = messages[messages.length - 1];
        const text = (lastMessage.textContent || '').trim();

        console.log(`[aiClaw ChatGPT] 提取回复（共 ${messages.length} 条 assistant 消息，发送前 ${msgCountBefore} 条）: "${text.slice(0, 50)}..."`);
        return text;
    }

    private findNewConversationTrigger(): HTMLElement | null {
        for (const selector of NEW_CHAT_SELECTORS) {
            const element = document.querySelector<HTMLElement>(selector);
            if (this.isUsableNewConversationTrigger(element)) {
                return element;
            }
        }

        const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, a, [role="button"]'));
        for (const candidate of candidates) {
            if (!this.isUsableNewConversationTrigger(candidate)) {
                continue;
            }
            const text = this.normalizedText(candidate);
            if (NEW_CHAT_TEXT_PATTERNS.some((pattern) => text.includes(pattern))) {
                return candidate;
            }
        }

        return null;
    }

    private isUsableNewConversationTrigger(element: HTMLElement | null): element is HTMLElement {
        if (!element) {
            return false;
        }
        if ((element as HTMLButtonElement).disabled) {
            return false;
        }
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    private normalizedText(element: HTMLElement): string {
        return (element.innerText || element.textContent || '').trim().toLowerCase();
    }

    private clickElement(element: HTMLElement) {
        element.scrollIntoView({ block: 'center', inline: 'center' });
        element.click();
    }

    private async waitForNewConversationReady(previousConversationId: string | null, timeout: number): Promise<boolean> {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeout) {
            const input = document.querySelector<HTMLElement>(SEL.INPUT);
            const stopBtn = document.querySelector(SEL.STOP_BTN);
            const currentConversationId = this.getCurrentConversationId();
            const routeChanged = previousConversationId == null
                ? currentConversationId == null
                : currentConversationId !== previousConversationId;

            if (routeChanged && input && !stopBtn) {
                return true;
            }

            await this.sleep(200);
        }

        return false;
    }

    /**
     * 从 URL 提取 conversation ID。
     * URL 格式: https://chatgpt.com/c/<uuid>
     */
    private getCurrentConversationId(): string | null {
        const match = window.location.pathname.match(/\/c\/([a-f0-9-]+)/i);
        return match ? match[1] : null;
    }

    /**
     * 等待某个 CSS 选择器的元素出现在 DOM 中。
     */
    private waitForElement<T extends Element>(selector: string, timeout: number): Promise<T | null> {
        return new Promise((resolve) => {
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

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
