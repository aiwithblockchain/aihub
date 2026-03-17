import Foundation
import AppKit

@MainActor
public final class ConsoleChatViewModel {
    public private(set) var messages: [AIMessage] = []
    public var onMessagesUpdated: (() -> Void)?
    public var onStreamingStateChanged: ((Bool) -> Void)?
    
    private var streamingTask: Task<Void, Never>?
    private var pendingDeltaBuffer: String = ""
    private var lastFlushTime: ContinuousClock.Instant = .now
    private let flushInterval: Duration = .milliseconds(40)
    private let clock = ContinuousClock()
    
    public private(set) var isStreaming: Bool = false {
        didSet { onStreamingStateChanged?(isStreaming) }
    }
    
    public init(initialMessages: [AIMessage] = []) {
        self.messages = initialMessages
    }
    
    public func sendMessage(_ text: String, provider: AIProviderProtocol, agent: AIAgent) {
        let humanMessage = AIMessage(sender: .human, content: text, timestamp: Date(), role: nil)
        messages.append(humanMessage)
        onMessagesUpdated?()
        
        streamingTask?.cancel()
        isStreaming = true
        
        streamingTask = Task {
            let request = AIRequest(conversationID: UUID(), userText: text)
            
            defer { isStreaming = false }
            
            do {
                let stream = provider.stream(request: request)
                
                for try await event in stream {
                    if Task.isCancelled { break }
                    
                    switch event {
                    case .start:
                        let aiMessage = AIMessage(sender: .ai, content: "", timestamp: Date(), role: agent.role)
                        messages.append(aiMessage)
                        onMessagesUpdated?()
                        lastFlushTime = clock.now
                        
                    case .delta(_, let text):
                        pendingDeltaBuffer += text
                        if clock.now - lastFlushTime >= flushInterval {
                            flushBuffer()
                        }
                        
                    case .finish:
                        flushBuffer()
                        onMessagesUpdated?()
                        
                    case .log(let msg):
                        print("AI Log: \(msg)")
                    }
                }
            } catch is CancellationError {
                // Ignore
            } catch {
                let errorMsg = (error as? AIProviderError)?.localizedDescription ?? error.localizedDescription
                let errAIMessage = AIMessage(sender: .ai, content: "Error: \(errorMsg)", timestamp: Date(), role: agent.role)
                messages.append(errAIMessage)
                onMessagesUpdated?()
            }
        }
    }
    
    private func flushBuffer() {
        guard !pendingDeltaBuffer.isEmpty else { return }
        guard let lastIndex = messages.lastIndex(where: { $0.sender == .ai }) else { return }
        
        let oldMessage = messages[lastIndex]
        let newMessage = AIMessage(sender: .ai, content: oldMessage.content + pendingDeltaBuffer, timestamp: oldMessage.timestamp, role: oldMessage.role)
        messages[lastIndex] = newMessage
        pendingDeltaBuffer = ""
        lastFlushTime = clock.now
        onMessagesUpdated?()
    }
    
    public func cancelStreaming() {
        streamingTask?.cancel()
        streamingTask = nil
        isStreaming = false
    }
}

extension AIProviderError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .authRequired(let details):
            return "需要身份验证: \(details)"
        case .rateLimited(let details):
            return "请求过于频繁: \(details)"
        case .transport(let details):
            return "网络传输错误: \(details)"
        case .cancelled:
            return "请求已取消"
        case .other(let details):
            return "其他错误: \(details)"
        }
    }
}
