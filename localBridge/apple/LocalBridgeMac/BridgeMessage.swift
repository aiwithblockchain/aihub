import Foundation

let protocolName = "aihub-localbridge"
let protocolVersion = "v1"

enum MessageType: String, Codable {
    case clientHello = "client.hello"
    case serverHelloAck = "server.hello_ack"
    case ping = "ping"
    case pong = "pong"
    case requestQueryXTabsStatus = "request.query_x_tabs_status"
    case responseQueryXTabsStatus = "response.query_x_tabs_status"
    case requestQueryXBasicInfo = "request.query_x_basic_info"
    case responseQueryXBasicInfo = "response.query_x_basic_info"
    case requestQueryAITabsStatus = "request.query_ai_tabs_status"
    case responseQueryAITabsStatus = "response.query_ai_tabs_status"
    case requestExecuteTask = "request.execute_task"
    case responseExecuteTaskResult = "response.execute_task_result"
    case requestOpenTab = "request.open_tab"
    case responseOpenTab = "response.open_tab"
    case requestCloseTab = "request.close_tab"
    case responseCloseTab = "response.close_tab"
    case requestNavigateTab = "request.navigate_tab"
    case responseNavigateTab = "response.navigate_tab"
    case requestExecAction = "request.exec_action"
    case responseExecAction = "response.exec_action"
    case requestQueryHomeTimeline = "request.query_home_timeline"
    case responseQueryHomeTimeline = "response.query_home_timeline"
    case requestQueryTweet = "request.query_tweet"
    case responseQueryTweet = "response.query_tweet"
    case requestQueryTweetReplies = "request.query_tweet_replies"
    case responseQueryTweetReplies = "response.query_tweet_replies"
    case requestQueryTweetDetail = "request.query_tweet_detail"
    case responseQueryTweetDetail = "response.query_tweet_detail"
    case requestQueryUserProfile = "request.query_user_profile"
    case responseQueryUserProfile = "response.query_user_profile"
    case requestQuerySearchTimeline = "request.query_search_timeline"
    case responseQuerySearchTimeline = "response.query_search_timeline"
    case responseError = "response.error"
}

struct XTabInfo: Codable {
    let tabId: Int
    let url: String
    let active: Bool
}

struct BaseMessage<T: Codable>: Codable {
    let id: String
    let type: MessageType
    let source: String
    let target: String
    let timestamp: Int64
    let payload: T
}

struct PeekMessage: Codable {
    let id: String
    let type: MessageType
}

// Separate struct for decoding when type is known but payload varies
struct GenericMessage: Codable {
    let id: String
    let type: MessageType
    let source: String
    let target: String
    let timestamp: Int64
    let payload: AnyCodable
    
    // We'll need a way to handle dynamic payload or use specific structs
}

// Specific Payload Structs

struct ClientHelloPayload: Codable {
    let protocolName: String
    let protocolVersion: String
    let clientName: String
    let clientVersion: String
    let browser: String
    let capabilities: [String]
    // 新增（可选）：
    let instanceId: String?   // 扩展侧生成的稳定 UUID，区分不同 Profile
    let instanceName: String? // 用户自定义的显示名称
    let incognito: Bool?      // 是否是无痕模式
}


struct ServerHelloAckPayload: Codable {
    let protocolName: String
    let protocolVersion: String
    let serverName: String
    let serverVersion: String
    let heartbeatIntervalMs: Int
}

struct PingPayload: Codable {
    let heartbeatIntervalMs: Int
}

struct EmptyPayload: Codable {
    var _unused: Bool? = nil
}

struct QueryXTabsStatusResponsePayload: Codable {
    let hasXTabs: Bool
    let isLoggedIn: Bool
    let activeXTabId: Int?
    let activeXUrl: String?
    let tabs: [XTabInfo]
}

struct AITabInfo: Codable {
    let tabId: Int
    let url: String
    let platform: String
    let active: Bool
}

struct PlatformStatus: Codable {
    let hasTab: Bool
    let isLoggedIn: Bool
}

struct AIPlatformsInfo: Codable {
    let chatgpt: PlatformStatus
    let gemini: PlatformStatus
    let grok: PlatformStatus
}

struct QueryAITabsStatusResponsePayload: Codable {
    let hasAITabs: Bool
    let platforms: AIPlatformsInfo
    let activeAITabId: Int?
    let activeAIUrl: String?
    let tabs: [AITabInfo]
}

struct QueryXBasicInfoResponsePayload: Codable {
    let isLoggedIn: Bool
    let name: String?
    let screenName: String?
    let twitterId: String?
    let verified: Bool?
    let followersCount: Int?
    let friendsCount: Int?
    let statusesCount: Int?
    let avatar: String?
    let description: String?
    let createdAt: String?
    let raw: AnyCodable?
    let updatedAt: Int64?
}

struct ExecuteTaskRequestPayload: Codable {
    let taskId: String
    let platform: String
    let action: String
    let payload: SendMessagePromptPayload
    let timeout: Int?
}

struct SendMessagePromptPayload: Codable {
    let prompt: String?
    let conversationId: String?
    let model: String?
}

struct ExecuteTaskResultPayload: Codable {
    let taskId: String
    let success: Bool
    let platform: String
    let content: String?
    let conversationId: String?
    let error: String?
    let executedAt: String
    let durationMs: Int
}

struct ErrorPayload: Codable {
    let code: String
    let message: String
    let details: [String: AnyCodable]?
}

struct OpenTabRequestPayload: Codable {
    let path: String
}

struct OpenTabResponsePayload: Codable {
    let success: Bool
    let tabId: Int?
    let url: String?
    let error: String?
}

struct CloseTabRequestPayload: Codable {
    let tabId: Int
}

struct CloseTabResponsePayload: Codable {
    let success: Bool
    let reason: String // "success", "not_found", "failed"
    let error: String?
}

struct NavigateTabRequestPayload: Codable {
    let tabId: Int?
    let path: String
}

struct NavigateTabResponsePayload: Codable {
    let success: Bool
    let tabId: Int
    let url: String
    let error: String?
}

struct ExecActionRequestPayload: Codable {
    let action: String
    let tweetId: String?
    let userId: String?
    let tabId: Int?
    let text: String?  // 新增
}

struct QueryTweetDetailRequestPayload: Codable {
    let tweetId: String
    let tabId: Int?
}

struct QueryTweetRequestPayload: Codable {
    let tweetId: String
    let tabId: Int?
}

struct QueryTweetRepliesRequestPayload: Codable {
    let tweetId: String
    let tabId: Int?
    let cursor: String?
}

struct QueryUserProfileRequestPayload: Codable {
    let screenName: String
    let tabId: Int?
}

struct QuerySearchTimelineRequestPayload: Codable {
    let tabId: Int?
}

struct ExecActionResponsePayload: Codable {
    let ok: Bool
    let data: AnyCodable?
    let error: String?
}

// Helper for AnyCodable to handle dynamic JSON payload if needed
struct AnyCodable: Codable {
    let value: Any
    
    init(_ value: Any) {
        self.value = value
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { value = NSNull() }
        else if let x = try? container.decode(Bool.self) { value = x }
        else if let x = try? container.decode(Int.self) { value = x }
        else if let x = try? container.decode(Double.self) { value = x }
        else if let x = try? container.decode(String.self) { value = x }
        else if let x = try? container.decode([String: AnyCodable].self) { value = x.mapValues { $0.value } }
        else if let x = try? container.decode([AnyCodable].self) { value = x.map { $0.value } }
        else { throw DecodingError.dataCorruptedError(in: container, debugDescription: "AnyCodable value cannot be decoded") }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if value is NSNull { try container.encodeNil() }
        else if let x = value as? Bool { try container.encode(x) }
        else if let x = value as? Int { try container.encode(x) }
        else if let x = value as? Double { try container.encode(x) }
        else if let x = value as? String { try container.encode(x) }
        else if let x = value as? [String: Any] { try container.encode(x.mapValues { AnyCodable($0) }) }
        else if let x = value as? [Any] { try container.encode(x.map { AnyCodable($0) }) }
        else { try container.encodeNil() } // Fallback to nil
    }
}

enum ErrorCodes {
    static let invalidJson = "INVALID_JSON"
    static let invalidMessageShape = "INVALID_MESSAGE_SHAPE"
    static let unsupportedMessageType = "UNSUPPORTED_MESSAGE_TYPE"
    static let protocolVersionMismatch = "PROTOCOL_VERSION_MISMATCH"
    static let notConnected = "NOT_CONNECTED"
    static let requestTimeout = "REQUEST_TIMEOUT"
    static let internalError = "INTERNAL_ERROR"
}
