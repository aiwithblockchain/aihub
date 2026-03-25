import Foundation

enum ConversationType: String {
    case tweetclaw
    case aiclaw
    case logs
    case instances
}

struct Conversation: Identifiable {
    let id = UUID()
    let type: ConversationType
    let title: String
    let subtitle: String
    let preview: String
    let timestamp: String
}
