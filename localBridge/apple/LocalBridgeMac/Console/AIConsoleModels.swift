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

// MARK: - AI Provider Protocol
public enum ProviderID: String, Sendable { case http, codexCLI, geminiCLI }

public enum AIStreamEvent: Sendable {
    case start(messageID: UUID)
    case delta(messageID: UUID, text: String)
    case finish(messageID: UUID)
    case log(String)
}

public struct AIRequest: Sendable {
    public let conversationID: UUID; public let userText: String; public let systemPrompt: String?
    public init(conversationID: UUID, userText: String, systemPrompt: String? = nil) {
        self.conversationID = conversationID; self.userText = userText; self.systemPrompt = systemPrompt
    }
}

public enum AIProviderError: Error, Sendable {
    case authRequired(details: String), rateLimited(details: String), transport(details: String), cancelled, other(details: String)
}

public protocol AIProviderProtocol: Sendable {
    var id: ProviderID { get }
    var displayName: String { get }
    func stream(request: AIRequest) -> AsyncThrowingStream<AIStreamEvent, Error>
}

// MARK: - Infrastructure (Keychain & SSE)

public struct KeychainTokenStore {
    public static let anthropicAPIKey = "com.aihub.localbridge.anthropic"
    public static let openAIAPIKey    = "com.aihub.localbridge.openai"
    public static let geminiAPIKey    = "com.aihub.localbridge.gemini"
    public init() {}
    public func save(key: String, value: String) throws {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key, kSecValueData as String: value.data(using: .utf8)!]
        SecItemDelete(query as CFDictionary); SecItemAdd(query as CFDictionary, nil)
    }
    public func load(key: String) throws -> String {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var res: AnyObject?; let status = SecItemCopyMatching(query as CFDictionary, &res)
        guard status == errSecSuccess, let d = res as? Data, let v = String(data: d, encoding: .utf8) else { throw AIProviderError.authRequired(details: key) }
        return v
    }
}

public enum SSEEvent { case message(data: String, event: String?, id: String?), retry(Int) }

public final class SSEClient: NSObject, URLSessionDataDelegate, Sendable {
    private let activeContinuation = ThreadSafeBox<AsyncThrowingStream<SSEEvent, Error>.Continuation?>(nil)
    private let buffer = ThreadSafeBox<Data>(Data())

    public override init() { super.init() }
    
    public func stream(request: URLRequest) -> AsyncThrowingStream<SSEEvent, Error> {
        AsyncThrowingStream { cont in
            activeContinuation.set(cont); buffer.set(Data())
            let task = URLSession(configuration: .default, delegate: self, delegateQueue: nil).dataTask(with: request)
            task.resume(); cont.onTermination = { _ in task.cancel() }
        }
    }

    public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        var d = buffer.get(); d.append(data)
        while let r = d.range(of: Data("\n\n".utf8)) {
            let block = String(data: d.subdata(in: 0..<r.lowerBound), encoding: .utf8) ?? ""
            d.removeSubrange(0..<r.upperBound); parse(block)
        }
        buffer.set(d)
    }

    private func parse(_ block: String) {
        var dataSegments = [String](), event: String?, id: String?
        for line in block.components(separatedBy: .newlines) {
            if line.hasPrefix("data: ") { dataSegments.append(String(line.dropFirst(6))) }
            else if line.hasPrefix("event: ") { event = String(line.dropFirst(7)) }
            else if line.hasPrefix("id: ") { id = String(line.dropFirst(4)) }
        }
        if !dataSegments.isEmpty {
            let combinedData = dataSegments.joined(separator: "\n")
            activeContinuation.get()?.yield(SSEEvent.message(data: combinedData, event: event, id: id))
        }
    }

    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let resp = task.response as? HTTPURLResponse, resp.statusCode >= 400 {
            activeContinuation.get()?.finish(throwing: AIProviderError.transport(details: "HTTP \(resp.statusCode)"))
        } else if let e = error { activeContinuation.get()?.finish(throwing: e) }
        else { activeContinuation.get()?.finish() }
    }
}

private final class ThreadSafeBox<T>: @unchecked Sendable {
    private var v: T; private let lock = NSLock(); init(_ v: T) { self.v = v }
    func get() -> T { lock.lock(); defer { lock.unlock() }; return v }
    func set(_ n: T) { lock.lock(); defer { lock.unlock() }; v = n }
}

// MARK: - Specific Providers

public final class AnthropicHTTPProvider: AIProviderProtocol, Sendable {
    public let id: ProviderID = .http; public let displayName = "Anthropic API"
    private let model: String; public init(model: String) { self.model = model }
    public func stream(request: AIRequest) -> AsyncThrowingStream<AIStreamEvent, Error> {
        AsyncThrowingStream { cont in
            let task = Task {
                do {
                    let key = try KeychainTokenStore().load(key: KeychainTokenStore.anthropicAPIKey)
                    var r = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
                    r.httpMethod = "POST"; r.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    r.setValue(key, forHTTPHeaderField: "x-api-key"); r.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
                    let body: [String: Any] = ["model": model, "max_tokens": 4096, "stream": true, "messages": [["role": "user", "content": request.userText]]]
                    r.httpBody = try JSONSerialization.data(withJSONObject: body)
                    let mid = UUID(); cont.yield(.start(messageID: mid))
                    for try await event in SSEClient().stream(request: r) {
                        guard case .message(let data, let type, _) = event else { continue }
                        if type == "content_block_delta", let d = data.data(using: .utf8), let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any], let delta = j["delta"] as? [String: Any], let t = delta["text"] as? String {
                            cont.yield(.delta(messageID: mid, text: t))
                        } else if type == "message_stop" { break }
                    }
                    cont.yield(.finish(messageID: mid)); cont.finish()
                } catch { cont.finish(throwing: error) }
            }
            cont.onTermination = { _ in task.cancel() }
        }
    }
}

public final class GeminiCLIProvider: AIProviderProtocol, Sendable {
    public let id: ProviderID = .geminiCLI; public let displayName = "Gemini CLI"; public init() {}
    public func stream(request: AIRequest) -> AsyncThrowingStream<AIStreamEvent, Error> {
        AsyncThrowingStream { cont in
            let mid = UUID(); cont.yield(.start(messageID: mid))
            let p = Process(); p.executableURL = URL(fileURLWithPath: "/usr/local/bin/gemini")
            p.arguments = [request.userText, "--output-format", "stream-json"]
            let out = Pipe(); p.standardOutput = out; p.standardError = Pipe()
            cont.onTermination = { _ in if p.isRunning { p.terminate() } }
            do {
                try p.run()
                let fileName = out.fileHandleForReading
                fileName.readabilityHandler = { h in
                    let d = h.availableData
                    if d.isEmpty { h.readabilityHandler = nil; cont.yield(.finish(messageID: mid)); cont.finish(); return }
                    if let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any], let t = j["text"] as? String {
                        cont.yield(.delta(messageID: mid, text: t))
                    }
                }
            } catch { cont.finish(throwing: error) }
        }
    }
}

public final class CodexAppServerProvider: AIProviderProtocol, Sendable {
    public let id: ProviderID = .codexCLI; public let displayName = "Codex"
    public init() {}
    public func stream(request: AIRequest) -> AsyncThrowingStream<AIStreamEvent, Error> {
        AsyncThrowingStream { cont in
            let mid = UUID(); cont.yield(.start(messageID: mid))
            // Simplified CLI Logic for consolidated file
            cont.yield(.delta(messageID: mid, text: "Codex logic active..."))
            cont.yield(.finish(messageID: mid)); cont.finish()
        }
    }
}
