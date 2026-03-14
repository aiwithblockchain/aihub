import Foundation

struct Conversation: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String
    let preview: String
    let timestamp: String
}
