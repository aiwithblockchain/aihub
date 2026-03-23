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
        try {
            const newChatBtn = document.querySelector<HTMLElement>('a[href="/"], button[aria-label*="New chat"], a[aria-label*="New"]');
            if (newChatBtn) {
                newChatBtn.click();
                await new Promise(r => setTimeout(r, 2000));
            } else {
                window.location.href = 'https://grok.com/';
                await new Promise(r => setTimeout(r, 4000));
            }
            return { success: true, content: '', conversationId: undefined };
        } catch (e: any) {
            return { success: false, error: e.message, content: '' };
        }
    }

    public async sendMessage(
        request: SendMessageRequest,
        credentials: Credentials
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
