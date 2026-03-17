import Foundation

public final class AnthropicHTTPProvider: AIProviderProtocol, Sendable {
    public let id: ProviderID = .http
    public let displayName: String = "Anthropic API"

    private let model: String
    private let keychain: KeychainTokenStore
    private let sseClient: SSEClient

    public init(
        model: String = "claude-sonnet-4-20250514",
        keychain: KeychainTokenStore = KeychainTokenStore(),
        sseClient: SSEClient = SSEClient()
    ) {
        self.model = model
        self.keychain = keychain
        self.sseClient = sseClient
    }

    public func stream(request: AIRequest) -> AsyncThrowingStream<AIStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    // 1. 从 Keychain 读取 API Key
                    let apiKey: String
                    do {
                        apiKey = try keychain.load(key: KeychainTokenStore.anthropicAPIKey)
                    } catch {
                        continuation.finish(throwing: AIProviderError.authRequired(details: "Anthropic API Key 未设置，请在设置中填写"))
                        return
                    }

                    // 2. 构建请求
                    let url = URL(string: "https://api.anthropic.com/v1/messages")!
                    var urlRequest = URLRequest(url: url)
                    urlRequest.httpMethod = "POST"
                    urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    urlRequest.setValue(apiKey, forHTTPHeaderField: "x-api-key")
                    urlRequest.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

                    // 3. 构建请求体（Anthropic Messages API 格式）
                    var bodyDict: [String: Any] = [
                        "model": model,
                        "max_tokens": 4096,
                        "stream": true,
                        "messages": [
                            ["role": "user", "content": request.userText]
                        ]
                    ]
                    if let systemPrompt = request.systemPrompt, !systemPrompt.isEmpty {
                        bodyDict["system"] = systemPrompt
                    }
                    urlRequest.httpBody = try JSONSerialization.data(withJSONObject: bodyDict)

                    // 4. 开始流式请求
                    let messageID = UUID()
                    continuation.yield(.start(messageID: messageID))

                    for try await event in sseClient.stream(request: urlRequest) {
                        try Task.checkCancellation()

                        guard case .message(let data, let eventType, _) = event else { continue }

                        // Anthropic SSE 的事件类型为 content_block_delta，delta 里有 text
                        // 事件类型通过 "event: content_block_delta" 字段传递
                        // SSEParser 已经将其解析为 event 参数
                        if eventType == "content_block_delta" {
                            guard let jsonData = data.data(using: .utf8),
                                  let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
                                  let delta = json["delta"] as? [String: Any],
                                  let text = delta["text"] as? String else { continue }
                            continuation.yield(.delta(messageID: messageID, text: text))
                        }
                        // message_stop 事件表示结束
                        else if eventType == "message_stop" {
                            break
                        }
                    }

                    continuation.yield(.finish(messageID: messageID))
                    continuation.finish()

                } catch is CancellationError {
                    continuation.finish(throwing: AIProviderError.cancelled)
                } catch let error as SSEError {
                    switch error {
                    case .badStatus(401), .badStatus(403):
                        continuation.finish(throwing: AIProviderError.authRequired(details: "API Key 无效或无权限"))
                    case .badStatus(429):
                        continuation.finish(throwing: AIProviderError.rateLimited(details: "请求过于频繁，请稍后再试"))
                    case .badStatus(let code):
                        continuation.finish(throwing: AIProviderError.transport(details: "HTTP \(code)"))
                    case .unexpectedResponse:
                        continuation.finish(throwing: AIProviderError.transport(details: "响应格式异常"))
                    }
                } catch {
                    continuation.finish(throwing: AIProviderError.transport(details: error.localizedDescription))
                }
            }
            continuation.onTermination = { @Sendable _ in task.cancel() }
        }
    }
}
