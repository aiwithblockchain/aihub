import {
    BasePlatformAdapter,
    Credentials,
    PlatformType,
    SendMessageRequest,
    SendMessageResponse,
} from './base-adapter';
import { SseParser } from '../utils/sse-parser';
import { clearPlatformCredentials } from '../storage/credentials-store';

export class ChatGptAdapter extends BasePlatformAdapter {
    readonly platform: PlatformType = 'chatgpt';

    public isTargetApiUrl(url: string): boolean {
        return url.includes('chatgpt.com/backend-api/conversation');
    }

    public extractCredentials(
        url: string,
        requestHeaders: Record<string, string>,
        responseBody: any
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
        credentials: Credentials
    ): Promise<SendMessageResponse> {
        if (!credentials.bearerToken) {
            return {
                success: false,
                error: 'Bearer token not found',
                content: '',
            };
        }

        if (!credentials.apiEndpoint) {
            return {
                success: false,
                error: 'API endpoint not found',
                content: '',
            };
        }

        const headers = {
            ...credentials.extraHeaders,
            'Content-Type': 'application/json',
            Authorization: credentials.bearerToken,
        };

        const body = {
            action: 'next',
            messages: [
                {
                    author: { role: 'user' },
                    content: { content_type: 'text', parts: [request.prompt] },
                },
            ],
            parent_message_id: request.parentMessageId || this.generateUuid(),
            model: request.model || 'text-davinci-002-render-sha',
            conversation_id: request.conversationId,
        };

        try {
            const response = await fetch(credentials.apiEndpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });

            if (response.status === 401) {
                await clearPlatformCredentials('chatgpt');
                return {
                    success: false,
                    error: 'API request failed with status 401: Unauthorized. Credentials have been cleared.',
                    content: '',
                };
            }

            if (!response.ok) {
                return {
                    success: false,
                    error: `API request failed with status ${response.status}`,
                    content: '',
                    rawResponse: await response.text(),
                };
            }

            const sseParser = new SseParser();
            let fullContent = '';
            let conversationId: string | undefined;
            let messageId: string | undefined;

            await sseParser.parse(response, (data) => {
                if (data.message?.content?.parts) {
                    fullContent = data.message.content.parts[0];
                }
                if (data.conversation_id) {
                    conversationId = data.conversation_id;
                }
                if (data.message?.id) {
                    messageId = data.message.id;
                }
            });

            return {
                success: true,
                content: fullContent,
                conversationId,
                messageId,
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                content: '',
            };
        }
    }

    private generateUuid(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }
}
