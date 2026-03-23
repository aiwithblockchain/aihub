import {
    BasePlatformAdapter,
    Credentials,
    PlatformType,
    SendMessageRequest,
    SendMessageResponse,
} from './base-adapter';

export class GeminiAdapter extends BasePlatformAdapter {
    readonly platform: PlatformType = 'gemini';

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
            const newChatBtn = document.querySelector<HTMLElement>('a[aria-label*="New chat" i], a[aria-label*="新聊天" i], button[aria-label*="New chat"], a[href="/app"]');
            if (newChatBtn) {
                newChatBtn.click();
                await new Promise(r => setTimeout(r, 2000));
            } else {
                window.location.href = 'https://gemini.google.com/app';
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
                // 1. Find input
                let input = document.querySelector<HTMLElement>('rich-textarea div[contenteditable="true"], div.ql-editor[contenteditable="true"]');
                if (!input) {
                    resolve({ success: false, error: 'Cannot find Gemini input box (rich-textarea or ql-editor)', content: '' });
                    return;
                }
                
                input.focus();
                document.execCommand('selectAll', false);
                document.execCommand('delete', false);
                document.execCommand('insertText', false, request.prompt);
                
                // wait for internal state to update
                await new Promise(r => setTimeout(r, 500));
                
                // 2. Count messages before send
                const msgsBefore = document.querySelectorAll('message-content, response-message').length;
                
                // 3. Send using Enter key (as found in ACSpy logs)
                input.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                }));
                
                // 4. Wait for generation
                let waitTime = 0;
                let lastContent = '';
                while (waitTime < 120000) {
                    await new Promise(r => setTimeout(r, 1000));
                    waitTime += 1000;
                    
                    // IF stop button is present, we are still generating
                    let stopBtn = document.querySelector('button[aria-label*="Stop" i], button[aria-label*="停止" i]');
                    if (stopBtn) continue;
                    
                    // Get messages
                    let msgsAfter = document.querySelectorAll('message-content, response-message');
                    if (msgsAfter.length > msgsBefore) {
                        const lastMsg = msgsAfter[msgsAfter.length - 1];
                        const currentContent = lastMsg.textContent || '';
                        
                        // To ensure it's fully generated, wait until the text stops changing for 2 seconds
                        if (currentContent !== lastContent) {
                            lastContent = currentContent;
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
                
                resolve({ success: false, error: 'Timeout waiting for Gemini response', content: '' });
            } catch (e: any) {
                resolve({ success: false, error: e.message || String(e), content: '' });
            }
        });
    }
}
