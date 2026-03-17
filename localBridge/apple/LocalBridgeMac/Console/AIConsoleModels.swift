import AppKit
import Foundation

// MARK: - Core Models
enum AIRole: CaseIterable {
    case pm, developer, qa
    var label: String {
        switch self {
        case .pm: return "项目经理"; case .developer: return "开发"; case .qa: return "验收"
        }
    }
    var emoji: String {
        switch self {
        case .pm: return "👔"; case .developer: return "💻"; case .qa: return "🧪"
        }
    }
    var color: NSColor {
        switch self {
        case .pm: return .consolePM; case .developer: return .consoleDev; case .qa: return .consoleQA
        }
    }
}

enum AIType: CaseIterable {
    case web, api, cli
    var label: String {
        switch self {
        case .web: return "Web"; case .api: return "API"; case .cli: return "CLI"
        }
    }
    var icon: String {
        switch self {
        case .web: return "globe"; case .api: return "bolt"; case .cli: return "terminal"
        }
    }
    var color: NSColor {
        switch self {
        case .web: return .consoleBlue; case .api: return .consoleYellow; case .cli: return .consoleGreen
        }
    }
}

enum AIAgentStatus {
    case idle, working, paused, error
    var label: String {
        switch self {
        case .idle: return "闲置"; case .working: return "工作中"; case .paused: return "暂停"; case .error: return "错误"
        }
    }
    var color: NSColor {
        switch self {
        case .idle: return .consoleText3; case .working: return .consoleGreen; case .paused: return .consoleYellow; case .error: return .consoleRed
        }
    }
    var hasPulse: Bool { self == .working }
}

struct AIMessage {
    enum Sender { case ai, human }
    let sender: Sender
    let content: String
    let timestamp: Date
    let role: AIRole?
}

struct AIAgent {
    let id: String; let name: String; let role: AIRole; let type: AIType
    var status: AIAgentStatus; var messages: [AIMessage]; var url: String?
    var apiEndpoint: String?; var model: String?; var command: String?
}

struct AITask {
    enum Status { case pending, inProgress, review, done }
    enum Priority { case low, medium, high }
    let id: String
    let title: String
    let description: String
    var assignedTo: String?
    var status: Status
    var priority: Priority
    var progress: Double
}

