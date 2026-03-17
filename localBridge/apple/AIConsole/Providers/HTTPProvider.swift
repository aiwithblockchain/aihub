import Foundation

public final class HTTPProvider: AIProviderProtocol, Sendable {
    public let id: ProviderID = .http
    public let displayName: String
    private let baseURL: URL
    private let apiKeyKeychainKey: String
    private let model: String
    private let keychain: KeychainTokenStore
    private let sseClient: SSEClient
    
    public init(displayName: String, baseURL: URL, apiKeyKeychainKey: String, model: String, keychain: KeychainTokenStore = KeychainTokenStore(), sseClient: SSEClient = SSEClient()) {
        self.displayName = displayName
        self.baseURL = baseURL
        self.apiKeyKeychainKey = apiKeyKeychainKey
        self.model = model
        self.keychain = keychain
        self.sseClient = sseClient
    }
    
    public func stream(request: AIRequest) -> AsyncThrowingStream<AIStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    // Read API Key
                    let apiKey: String
                    do {
                        apiKey = try keychain.load(key: apiKeyKeychainKey)
                    } catch {
                        continuation.finish(throwing: AIProviderError.authRequired(details: "API Key not found in Keychain"))
                        return
                    }
                    
                    // Build Request
                    let url = baseURL.appendingPathComponent("/v1/chat/completions")
                    var urlRequest = URLRequest(url: url)
                    urlRequest.httpMethod = "POST"
                    urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    urlRequest.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
                    
                    let messages = [
                        ["role": "system", "content": request.systemPrompt ?? "You are a helpful AI assistant."],
                        ["role": "user", "content": request.userText]
                    ]
                    
                    let body: [String: Any] = [
                        "model": model,
                        "messages": messages,
                        "stream": true
                    ]
                    
                    urlRequest.httpBody = try JSONSerialization.data(withJSONObject: body)
                    
                    let messageID = request.conversationID // Use conversationID as messageID for now or generate new one
                    continuation.yield(.start(messageID: messageID))
                    
                    let stream = sseClient.stream(request: urlRequest)
                    
                    for try await event in stream {
                        try Task.checkCancellation()
                        
                        switch event {
                        case .message(let data, _, _):
                            if data == "[DONE]" { break }
                            
                            guard let jsonData = data.data(using: .utf8),
                                  let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
                                  let choices = json["choices"] as? [[String: Any]],
                                  let firstChoice = choices.first,
                                  let delta = firstChoice["delta"] as? [String: Any],
                                  let content = delta["content"] as? String else {
                                break
                            }
                            
                            continuation.yield(.delta(messageID: messageID, text: content))
                            
                        case .retry(let ms):
                            continuation.yield(.log("SSE Retry requested: \(ms)ms"))
                        }
                    }
                    
                    continuation.yield(.finish(messageID: messageID))
                    continuation.finish()
                    
                } catch is CancellationError {
                    continuation.finish(throwing: AIProviderError.cancelled)
                } catch let error as SSEError {
                    switch error {
                    case .badStatus(let code):
                        if code == 401 || code == 403 {
                            continuation.finish(throwing: AIProviderError.authRequired(details: "HTTP \(code)"))
                        } else if code == 429 {
                            continuation.finish(throwing: AIProviderError.rateLimited(details: "HTTP 429"))
                        } else {
                            continuation.finish(throwing: AIProviderError.transport(details: "HTTP status \(code)"))
                        }
                    case .unexpectedResponse:
                        continuation.finish(throwing: AIProviderError.transport(details: "Unexpected response format"))
                    }
                } catch {
                    continuation.finish(throwing: AIProviderError.transport(details: error.localizedDescription))
                }
            }
            
            continuation.onTermination = { @Sendable _ in
                task.cancel()
            }
        }
    }
}
