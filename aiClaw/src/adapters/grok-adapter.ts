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
        // TODO: Implement this based on packet sniffing
        return false;
    }

    public extractCredentials(
        url: string,
        requestHeaders: Record<string, string>,
        responseBody: any
    ): Partial<Credentials> {
        // TODO: Implement this based on packet sniffing
        return {};
    }

    public async createNewConversation(
        request: Pick<SendMessageRequest, 'model'>
    ): Promise<SendMessageResponse> {
        try {
            const newChatBtn = document.querySelector<HTMLElement>('a[href="/"], button[aria-label="New chat"]');
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
                // 1. Find input
                let input = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="Ask Grok"], textarea');
                if (!input) {
                    resolve({ success: false, error: 'Cannot find Grok input box', content: '' });
                    return;
                }
                
                input.focus();
                input.value = request.prompt;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                
                await new Promise(r => setTimeout(r, 500));
                
                // 2. Find send button
                let sendBtn = document.querySelector<HTMLElement>('button[aria-label*="Grok"], button[aria-label*="send"], button svg path[d*="M2.01 21L23 12 2.01 3"]');
                let actualBtn = sendBtn?.closest('button') || sendBtn;
                if (!actualBtn || (actualBtn as HTMLButtonElement).disabled) {
                    // Try pressing Enter instead
                    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
                } else {
                    actualBtn.click();
                }
                
                const msgsBefore = document.querySelectorAll('.message-content, [class*="message"]').length;
                
                // 3. Wait for generation to start and finish
                let waitTime = 0;
                while (waitTime < 120000) {
                    await new Promise(r => setTimeout(r, 1000));
                    waitTime += 1000;
                    
                    let stopBtn = document.querySelector('button[aria-label*="Stop"]');
                    if (stopBtn) continue;
                    
                    let msgsAfter = document.querySelectorAll('.message-content, [class*="message"]');
                    if (msgsAfter.length > msgsBefore) {
                        const lastMsg = msgsAfter[msgsAfter.length - 1];
                        resolve({
                            success: true,
                            content: lastMsg.textContent || '',
                            conversationId: undefined
                        });
                        return;
                    }
                    
                    // Also check if Send button is re-enabled
                    let currentBtn = document.querySelector<HTMLElement>('button[aria-label*="Grok"], button[aria-label*="send"]');
                    if (currentBtn && !(currentBtn as HTMLButtonElement).disabled && msgsAfter.length > 0) {
                       const lastMsg = msgsAfter[msgsAfter.length - 1];
                       resolve({
                            success: true,
                            content: lastMsg.textContent || '',
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
