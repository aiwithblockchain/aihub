import Foundation

final class AnthropicHTTPProvider: AIProviderProtocol, Sendable {
    let id: ProviderID = .http
    let displayName: String = "Anthropic API"

    private let config: ProviderConfig
    private let sseClient: SSEClient

    /// 使用 ProviderConfig 初始化
    init(
        config: ProviderConfig,
        sseClient: SSEClient = SSEClient()
    ) {
        self.config = config
        self.sseClient = sseClient
    }

    /// 便捷初始化方法（向后兼容，已废弃）
    @available(*, deprecated, message: "Use init(config:) instead")
    convenience init(
        model: String = "claude-sonnet-4-20250514",
        keychain: KeychainTokenStore = KeychainTokenStore(),
        sseClient: SSEClient = SSEClient()
    ) {
        // 尝试从 Keychain 加载配置，如果失败则使用默认配置
        let config: ProviderConfig
        if let loadedConfig = try? keychain.getDefaultProviderConfig(),
           loadedConfig.providerType == .anthropic {
            config = loadedConfig
        } else {
            // 创建一个临时配置（需要用户后续配置 API Key）
            config = ProviderConfig(
                name: "Anthropic (临时)",
                baseURL: ProviderType.anthropic.defaultBaseURL,
                apiKey: "",
                model: model,
                providerType: .anthropic
            )
        }
        self.init(config: config, sseClient: sseClient)
    }

    func stream(request: AIRequest) -> AsyncThrowingStream<AIStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    // 1. 验证配置
                    guard !config.apiKey.isEmpty else {
                        continuation.finish(throwing: AIProviderError.authRequired(details: "API Key 未设置，请在设置中配置"))
                        return
                    }

                    // 2. 构建请求 URL（使用配置的 base_url）
                    let endpoint = config.endpoint(path: "/messages")
                    guard let url = URL(string: endpoint) else {
                        continuation.finish(throwing: AIProviderError.transport(details: "无效的 API 端点: \(endpoint)"))
                        return
                    }

                    var urlRequest = URLRequest(url: url)
                    urlRequest.httpMethod = "POST"
                    urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    urlRequest.setValue(config.apiKey, forHTTPHeaderField: "x-api-key")
                    urlRequest.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

                    // 3. 构建请求体（Anthropic Messages API 格式）
                    let modelToUse = config.model ?? "claude-sonnet-4-20250514"
                    var bodyDict: [String: Any] = [
                        "model": modelToUse,
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
                    print("✅ [Provider] 开始流式请求，Message ID: \(messageID)")
                    continuation.yield(.start(messageID: messageID))

                    for try await event in sseClient.stream(request: urlRequest) {
                        try Task.checkCancellation()

                        guard case .message(let data, let eventType, _) = event else {
                            print("⚠️ [Provider] 收到非消息事件: \(event)")
                            continue
                        }

                        print("📨 [Provider] 收到 SSE 事件: \(eventType ?? "无类型")")
                        print("   数据: \(data.prefix(200))...")

                        // Anthropic SSE 的事件类型为 content_block_delta，delta 里有 text
                        // 事件类型通过 "event: content_block_delta" 字段传递
                        // SSEParser 已经将其解析为 event 参数
                        if eventType == "content_block_delta" {
                            guard let jsonData = data.data(using: .utf8),
                                  let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
                                  let delta = json["delta"] as? [String: Any],
                                  let text = delta["text"] as? String else {
                                print("⚠️ [Provider] 无法解析 delta 数据")
                                continue
                            }
                            print("✅ [Provider] 收到文本片段: \(text.prefix(50))...")
                            continuation.yield(.delta(messageID: messageID, text: text))
                        }
                        // message_stop 事件表示结束
                        else if eventType == "message_stop" {
                            print("✅ [Provider] 收到结束事件")
                            break
                        }
                    }

                    continuation.yield(.finish(messageID: messageID))
                    continuation.finish()

                } catch is CancellationError {
                    print("⚠️ [Provider] 请求被取消")
                    continuation.finish(throwing: AIProviderError.cancelled)
                } catch let error as SSEError {
                    print("❌ [Provider] SSE 错误: \(error)")
                    switch error {
                    case .badStatus(401), .badStatus(403):
                        print("   认证失败，请检查 API Key")
                        continuation.finish(throwing: AIProviderError.authRequired(details: "API Key 无效或无权限"))
                    case .badStatus(429):
                        print("   请求频率限制")
                        continuation.finish(throwing: AIProviderError.rateLimited(details: "请求过于频繁，请稍后再试"))
                    case .badStatus(let code):
                        print("   HTTP 状态码: \(code)")
                        continuation.finish(throwing: AIProviderError.transport(details: "HTTP \(code)"))
                    case .unexpectedResponse:
                        print("   响应格式异常")
                        continuation.finish(throwing: AIProviderError.transport(details: "响应格式异常"))
                    }
                } catch {
                    print("❌ [Provider] 未知错误: \(error)")
                    continuation.finish(throwing: AIProviderError.transport(details: error.localizedDescription))
                }
            }
            continuation.onTermination = { @Sendable _ in task.cancel() }
        }
    }
}
