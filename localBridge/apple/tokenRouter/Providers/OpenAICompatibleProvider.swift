import Foundation

/// OpenAI 兼容的 Provider
/// 支持 OpenAI、DeepSeek、阿里通义千问等使用 OpenAI Chat Completions API 格式的服务
final class OpenAICompatibleProvider: AIProviderProtocol, Sendable {
    let id: ProviderID = .http
    let displayName: String = "OpenAI Compatible API"

    private let config: ProviderConfig
    private let sseClient: SSEClient

    init(
        config: ProviderConfig,
        sseClient: SSEClient = SSEClient()
    ) {
        self.config = config
        self.sseClient = sseClient
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

                    // 2. 构建请求 URL（OpenAI 兼容端点）
                    let endpoint = config.endpoint(path: "/chat/completions")
                    guard let url = URL(string: endpoint) else {
                        continuation.finish(throwing: AIProviderError.transport(details: "无效的 API 端点: \(endpoint)"))
                        return
                    }

                    var urlRequest = URLRequest(url: url)
                    urlRequest.httpMethod = "POST"
                    urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    urlRequest.setValue("Bearer \(config.apiKey)", forHTTPHeaderField: "Authorization")

                    // 3. 构建请求体（OpenAI Chat Completions API 格式）
                    let modelToUse = config.model ?? "gpt-3.5-turbo"
                    var messages: [[String: String]] = []

                    if let systemPrompt = request.systemPrompt, !systemPrompt.isEmpty {
                        messages.append(["role": "system", "content": systemPrompt])
                    }
                    messages.append(["role": "user", "content": request.userText])

                    let bodyDict: [String: Any] = [
                        "model": modelToUse,
                        "messages": messages,
                        "stream": true
                    ]
                    urlRequest.httpBody = try JSONSerialization.data(withJSONObject: bodyDict)

                    // 4. 开始流式请求
                    let messageID = UUID()
                    print("✅ [OpenAI Provider] 开始流式请求，Message ID: \(messageID)")
                    print("   端点: \(endpoint)")
                    print("   模型: \(modelToUse)")
                    continuation.yield(.start(messageID: messageID))

                    var eventCount = 0
                    for try await event in sseClient.stream(request: urlRequest) {
                        try Task.checkCancellation()
                        eventCount += 1

                        print("📬 [OpenAI Provider] 收到事件 #\(eventCount): \(event)")

                        guard case .message(let data, _, _) = event else {
                            print("⚠️ [OpenAI Provider] 收到非消息事件，跳过")
                            continue
                        }

                        // 检查是否是结束标记
                        if data == "[DONE]" {
                            print("✅ [OpenAI Provider] 收到 [DONE] 标记")
                            break
                        }

                        print("📨 [OpenAI Provider] 收到数据: \(data)")

                        // OpenAI SSE 格式：data: {"choices":[{"delta":{"content":"text"}}]}
                        guard let jsonData = data.data(using: .utf8) else {
                            print("⚠️ [OpenAI Provider] 无法转换为 UTF8")
                            continue
                        }

                        guard let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else {
                            print("⚠️ [OpenAI Provider] 无法解析 JSON: \(data)")
                            continue
                        }

                        print("   JSON 结构: \(json.keys.joined(separator: ", "))")

                        guard let choices = json["choices"] as? [[String: Any]] else {
                            print("⚠️ [OpenAI Provider] 没有 choices 字段")
                            continue
                        }

                        guard let firstChoice = choices.first else {
                            print("⚠️ [OpenAI Provider] choices 数组为空")
                            continue
                        }

                        print("   Choice 结构: \(firstChoice.keys.joined(separator: ", "))")

                        guard let delta = firstChoice["delta"] as? [String: Any] else {
                            print("⚠️ [OpenAI Provider] 没有 delta 字段")
                            continue
                        }

                        print("   Delta 结构: \(delta.keys.joined(separator: ", "))")

                        // content 可能为 nil（在某些事件中）
                        if let content = delta["content"] as? String, !content.isEmpty {
                            print("✅ [OpenAI Provider] 收到文本片段: \(content.prefix(50))...")
                            continuation.yield(.delta(messageID: messageID, text: content))
                        } else {
                            print("⚠️ [OpenAI Provider] delta 中没有 content 或 content 为空")
                        }
                    }

                    print("✅ [OpenAI Provider] 流式请求完成")
                    continuation.yield(.finish(messageID: messageID))
                    continuation.finish()

                } catch is CancellationError {
                    print("⚠️ [OpenAI Provider] 请求被取消")
                    continuation.finish(throwing: AIProviderError.cancelled)
                } catch let error as SSEError {
                    print("❌ [OpenAI Provider] SSE 错误: \(error)")
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
                    print("❌ [OpenAI Provider] 未知错误: \(error)")
                    continuation.finish(throwing: AIProviderError.transport(details: error.localizedDescription))
                }
            }
            continuation.onTermination = { @Sendable _ in task.cancel() }
        }
    }
}
