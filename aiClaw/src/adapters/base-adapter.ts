// src/adapters/base-adapter.ts

export type PlatformType = 'chatgpt' | 'gemini' | 'grok';

export interface Credentials {
    bearerToken?: string;       // Authorization header value
    cookies?: string;           // 由浏览器自动携带，通常不需手动管理
    apiEndpoint?: string;       // 已捕获的 API 端点 URL
    extraHeaders?: Record<string, string>;  // 平台特定的额外请求头
}

export interface SendMessageRequest {
    prompt: string;             // 用户 prompt 文本
    conversationId?: string;    // 续对话时传入
    parentMessageId?: string;   // ChatGPT 专用：续对话链
    model?: string;             // 指定模型（可选）
}

export interface SendMessageResponse {
    success: boolean;
    content: string;            // AI 回复的完整文本
    conversationId?: string;    // 对话 ID（用于续对话）
    messageId?: string;         // 消息 ID（用于建立父子关系）
    error?: string;             // 错误信息（如有）
    rawResponse?: any;          // 原始响应数据（调试用）
}

export abstract class BasePlatformAdapter {
    abstract readonly platform: PlatformType;

    /** 使用已捕获的凭证发送消息到 AI 平台 */
    abstract sendMessage(
        request: SendMessageRequest,
        credentials: Credentials
    ): Promise<SendMessageResponse>;

    /** 判断一个 URL 是否属于本平台需要拦截的 API */
    abstract isTargetApiUrl(url: string): boolean;

    /** 从拦截到的请求/响应中提取凭证 */
    abstract extractCredentials(
        url:string,
        requestHeaders: Record<string, string>,
        responseBody: any
    ): Partial<Credentials>;

    /** 创建新对话。默认不支持，子类按需覆盖。 */
    createNewConversation(_request: Pick<SendMessageRequest, 'model'>): Promise<SendMessageResponse> {
        return Promise.resolve({
            success: false,
            content: '',
            error: `Platform ${this.platform} does not support creating a new conversation`,
        });
    }
}
