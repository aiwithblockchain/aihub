import Foundation

public enum ProviderID: String, Sendable {
    case http
    case codexCLI
    case geminiCLI
}

public enum AIStreamEvent: Sendable {
    case start(messageID: UUID)
    case delta(messageID: UUID, text: String)
    case finish(messageID: UUID)
    case log(String)
}

public struct AIRequest: Sendable {
    public let conversationID: UUID
    public let userText: String
    public let systemPrompt: String?
    
    public init(conversationID: UUID, userText: String, systemPrompt: String? = nil) {
        self.conversationID = conversationID
        self.userText = userText
        self.systemPrompt = systemPrompt
    }
}

public enum AIProviderError: Error, Sendable {
    case authRequired(details: String)
    case rateLimited(details: String)
    case transport(details: String)
    case cancelled
    case other(details: String)
}

public protocol AIProviderProtocol: Sendable {
    var id: ProviderID { get }
    var displayName: String { get }
    func stream(request: AIRequest) -> AsyncThrowingStream<AIStreamEvent, Error>
}
