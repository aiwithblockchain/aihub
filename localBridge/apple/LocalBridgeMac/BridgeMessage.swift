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
    let payload: [String: AnyCodable]
    
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

struct QueryXBasicInfoResponsePayload: Codable {
    let isLoggedIn: Bool
    let name: String?
    let screenName: String?
    let twitterId: String?
    let verified: Bool?
    let updatedAt: Int64?
}

struct ErrorPayload: Codable {
    let code: String
    let message: String
    let details: [String: AnyCodable]?
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
