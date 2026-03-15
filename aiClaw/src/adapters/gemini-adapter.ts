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

    public async sendMessage(
        request: SendMessageRequest,
        credentials: Credentials
    ): Promise<SendMessageResponse> {
        return {
            success: false,
            error: 'Not implemented',
            content: '',
        };
    }
}
