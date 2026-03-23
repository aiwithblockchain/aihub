import {
    BasePlatformAdapter,
    Credentials,
    PlatformType,
    SendMessageRequest,
    SendMessageResponse,
} from './base-adapter';

export class GrokAdapter extends BasePlatformAdapter {
    readonly platform: PlatformType = 'grok';

    public isTargetApiUrl(url: string): boolean {
        return false;
    }

    public extractCredentials(): Partial<Credentials> {
        return {};
    }

    public async createNewConversation(
        request: Pick<SendMessageRequest, 'model'>
    ): Promise<SendMessageResponse> {
        const t = (msg: string) => console.log(`[aiClaw Grok] ${msg}`);
        const previousUrl = window.location.href;

        try {
            t('New conversation: 检查当前是否已经是空白会话...');
            if (this.isOnNewConversationPage()) {
                const input = await this.waitForElement<HTMLElement>(
                    'div.tiptap.ProseMirror, textarea[placeholder*="Ask Grok"]',
                    3_000
                );
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
                    error: '未找到 New chat 按钮，请确认 Grok 侧边栏已展开',
                };
            }

            this.clickElement(trigger);
            t('New conversation: 已点击 New chat');

            const ready = await this.waitForNewConversationReady(previousUrl, 15_000);
            if (!ready) {
                return {
                    success: false,
                    content: '',
                    error: '新建对话后页面未就绪，请确认 Grok 页面可正常切换到新会话',
                };
            }

            await this.sleep(300);
            t('New conversation: 页面已就绪');

            if (request.model) {
                t(`New conversation: 当前忽略 model=${request.model}，后续可再补模型切换`);
            }

            return {
                success: true,
                content: '',
                conversationId: undefined,
            };
        } catch (error: any) {
            console.error('[aiClaw Grok] createNewConversation 出错:', error);
            return {
                success: false,
                content: '',
                error: error.message || String(error),
            };
        }
    }

    // ── 私有辅助方法 ────────────────────────────────────────────────────────

    private isOnNewConversationPage(): boolean {
        // Grok 新会话页面通常是根路径 /
        return window.location.pathname === '/' || window.location.pathname === '/grok';
    }

    private findNewConversationTrigger(): HTMLElement | null {
        const selectors = [
            'a[href="/"]',
            'button[aria-label*="New chat" i]',
            'a[aria-label*="New" i]',
            'button[aria-label*="新聊天" i]',
            'a[aria-label*="新对话" i]',
        ];

        for (const selector of selectors) {
            const element = document.querySelector<HTMLElement>(selector);
            if (this.isUsableElement(element)) {
                return element;
            }
        }

        // 回退：查找包含特定文本的按钮或链接
        const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, a, [role="button"]'));
        const patterns = ['new chat', '新聊天', '新对话', 'new conversation'];

        for (const candidate of candidates) {
            if (!this.isUsableElement(candidate)) continue;
            const text = (candidate.innerText || candidate.textContent || '').trim().toLowerCase();
            if (patterns.some(pattern => text.includes(pattern))) {
                return candidate;
            }
        }

        return null;
    }

    private isUsableElement(element: HTMLElement | null): element is HTMLElement {
        if (!element) return false;
        if ((element as HTMLButtonElement).disabled) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    private clickElement(element: HTMLElement) {
        element.scrollIntoView({ block: 'center', inline: 'center' });
        element.click();
    }

    private async waitForNewConversationReady(previousUrl: string, timeout: number): Promise<boolean> {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeout) {
            const currentUrl = window.location.href;
            const urlChanged = currentUrl !== previousUrl;

            if (urlChanged) {
                // 等待输入框出现
                const input = document.querySelector<HTMLElement>(
                    'div.tiptap.ProseMirror, textarea[placeholder*="Ask Grok"]'
                );

                // 确保没有停止按钮（表示没有正在进行的生成）
                const stopBtn = document.querySelector('button[aria-label*="Stop model response" i], button[aria-label*="Stop" i]');

                if (input && !stopBtn) {
                    return true;
                }
            }

            await this.sleep(200);
        }

        return false;
    }

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

    public async sendMessage(
        request: SendMessageRequest,
        _credentials: Credentials
    ): Promise<SendMessageResponse> {
        return new Promise(async (resolve) => {
            try {
                // 1. Find input: Grok uses tiptap ProseMirror div
                let input = document.querySelector<HTMLElement>('div.tiptap.ProseMirror, textarea[placeholder*="Ask Grok"], textarea');
                if (!input) {
                    resolve({ success: false, error: 'Cannot find Grok input box (tiptap.ProseMirror)', content: '' });
                    return;
                }
                
                input.focus();
                
                // If it's contenteditable (ProseMirror):
                if (input.getAttribute('contenteditable') === 'true' || input.tagName === 'DIV') {
                    document.execCommand('selectAll', false);
                    document.execCommand('delete', false);
                    document.execCommand('insertText', false, request.prompt);
                } else {
                    // Fallback to older textarea
                    const textarea = input as HTMLTextAreaElement;
                    textarea.value = request.prompt;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                }
                
                await new Promise(r => setTimeout(r, 500));
                
                // 2. Count messages before send
                const msgsBefore = document.querySelectorAll('.message-bubble').length;
                
                // 3. Find send button: Grok uses button[aria-label="Submit"]
                let sendBtn = document.querySelector<HTMLElement>('button[aria-label="Submit" i], button[aria-label*="Grok something" i], button[aria-label*="send" i]');
                if (!sendBtn || (sendBtn as HTMLButtonElement).disabled) {
                    // Try Enter key
                    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
                } else {
                    sendBtn.click();
                }
                
                // 4. Wait for generation to start and finish
                let waitTime = 0;
                let lastContent = '';
                while (waitTime < 120000) {
                    await new Promise(r => setTimeout(r, 1000));
                    waitTime += 1000;
                    
                    // Stop btn: button[aria-label="Stop model response"]
                    let stopBtn = document.querySelector('button[aria-label*="Stop model response" i], button[aria-label*="Stop" i]');
                    if (stopBtn) {
                        // Keep lastContent synced during generation
                        let msgsForUpdate = document.querySelectorAll('.message-bubble');
                        if (msgsForUpdate.length > msgsBefore) {
                            lastContent = msgsForUpdate[msgsForUpdate.length - 1].textContent || '';
                        }
                        continue;
                    }
                    
                    let msgsAfter = document.querySelectorAll('.message-bubble');
                    if (msgsAfter.length > msgsBefore) {
                        const lastMsg = msgsAfter[msgsAfter.length - 1];
                        const currentContent = lastMsg.textContent || '';
                        
                        // Ignore empty text
                        if (currentContent.trim() === '') {
                            continue;
                        }
                        
                        // Wait until content stops changing for 2 cycles
                        if (currentContent !== lastContent) {
                            lastContent = currentContent;
                            continue;
                        }
                        
                        // Ignore if it's identical to prompt (user message caught in race condition)
                        if (currentContent.trim() === request.prompt.trim()) {
                            continue;
                        }
                        
                        resolve({
                            success: true,
                            content: currentContent.trim(),
                            conversationId: undefined
                        });
                        return;
                    }
                }
                
                resolve({ success: false, error: 'Timeout waiting for Grok response', content: '' });
            } catch (e: any) {
                resolve({ success: false, error: e.message || String(e), content: '' });
            }
        });
    }
}
