import Foundation

public enum SSEEvent: Sendable {
    case message(data: String, event: String?, id: String?)
    case retry(milliseconds: Int)
}

public enum SSEError: Error {
    case badStatus(Int)
    case unexpectedResponse
}

public struct SSEClient: Sendable {
    public init() {}

    public func stream(request: URLRequest, session: URLSession = .shared) -> AsyncThrowingStream<SSEEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let (bytes, response) = try await session.bytes(for: request)
                    
                    guard let httpResponse = response as? HTTPURLResponse else {
                        continuation.finish(throwing: SSEError.unexpectedResponse)
                        return
                    }
                    
                    guard (200...299).contains(httpResponse.statusCode) else {
                        continuation.finish(throwing: SSEError.badStatus(httpResponse.statusCode))
                        return
                    }
                    
                    var currentData = ""
                    var currentEvent: String?
                    var currentId: String?
                    
                    for try await line in bytes.lines {
                        if line.isEmpty {
                            // Flush current event
                            if !currentData.isEmpty {
                                if currentData == "[DONE]" {
                                    continuation.finish()
                                    return
                                }
                                continuation.yield(.message(data: currentData.trimmingCharacters(in: .newlines), event: currentEvent, id: currentId))
                            }
                            currentData = ""
                            currentEvent = nil
                            currentId = nil
                            continue
                        }
                        
                        if line.hasPrefix(":") {
                            continue
                        }
                        
                        let parts = line.split(separator: ":", maxSplits: 1)
                        let field = parts[0]
                        var value = parts.count > 1 ? String(parts[1]) : ""
                        
                        // Remove leading space if present
                        if value.hasPrefix(" ") {
                            value.removeFirst()
                        }
                        
                        switch field {
                        case "data":
                            if !currentData.isEmpty {
                                currentData += "\n"
                            }
                            currentData += value
                        case "event":
                            currentEvent = value
                        case "id":
                            currentId = value
                        case "retry":
                            if let ms = Int(value) {
                                continuation.yield(.retry(milliseconds: ms))
                            }
                        default:
                            break
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            
            continuation.onTermination = { @Sendable _ in
                task.cancel()
            }
        }
    }
}
