import Foundation

enum ProviderID: String, Sendable {
    case http
    case codexCLI
    case geminiCLI
}

enum AIStreamEvent: Sendable {
    case start(messageID: UUID)
    case delta(messageID: UUID, text: String)
    case finish(messageID: UUID)
    case log(String)
}

struct AIRequest: Sendable {
    let conversationID: UUID
    let userText: String
    let systemPrompt: String?
    
    init(conversationID: UUID, userText: String, systemPrompt: String? = nil) {
        self.conversationID = conversationID
        self.userText = userText
        self.systemPrompt = systemPrompt
    }
}

enum AIProviderError: Error, Sendable {
    case authRequired(details: String)
    case rateLimited(details: String)
    case transport(details: String)
    case cancelled
    case other(details: String)
}

protocol AIProviderProtocol: Sendable {
    var id: ProviderID { get }
    var displayName: String { get }
    func stream(request: AIRequest) -> AsyncThrowingStream<AIStreamEvent, Error>
}
