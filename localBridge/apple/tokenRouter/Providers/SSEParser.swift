import Foundation

enum SSEEvent: Sendable {
    case message(data: String, event: String?, id: String?)
    case retry(milliseconds: Int)
}

enum SSEError: Error {
    case badStatus(Int)
    case unexpectedResponse
}

struct SSEClient: Sendable {
    init() {}

    func stream(request: URLRequest, session: URLSession = .shared) -> AsyncThrowingStream<SSEEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    print("🔌 [SSE] 开始连接...")
                    let (bytes, response) = try await session.bytes(for: request)

                    guard let httpResponse = response as? HTTPURLResponse else {
                        print("❌ [SSE] 响应不是 HTTP 响应")
                        continuation.finish(throwing: SSEError.unexpectedResponse)
                        return
                    }

                    print("✅ [SSE] HTTP 状态码: \(httpResponse.statusCode)")

                    guard (200...299).contains(httpResponse.statusCode) else {
                        print("❌ [SSE] HTTP 错误: \(httpResponse.statusCode)")
                        continuation.finish(throwing: SSEError.badStatus(httpResponse.statusCode))
                        return
                    }

                    print("📡 [SSE] 开始读取流式数据...")
                    var currentData = ""
                    var currentEvent: String?
                    var currentId: String?
                    var lineCount = 0

                    for try await line in bytes.lines {
                        lineCount += 1
                        if lineCount <= 10 {
                            print("📨 [SSE] 第 \(lineCount) 行: \(line.prefix(100))")
                        }

                        if line.isEmpty {
                            // Flush current event
                            print("📭 [SSE] 遇到空行，准备 flush 事件")
                            if !currentData.isEmpty {
                                print("✅ [SSE] Yield 事件，数据长度: \(currentData.count)")
                                if currentData == "[DONE]" {
                                    print("✅ [SSE] 收到 [DONE] 标记，结束流")
                                    continuation.finish()
                                    return
                                }
                                continuation.yield(.message(data: currentData.trimmingCharacters(in: .newlines), event: currentEvent, id: currentId))
                            } else {
                                print("⚠️ [SSE] 空行但 currentData 为空，跳过")
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
                            // OpenAI 兼容 API 每行都是一个完整的 JSON 事件
                            // 不需要等待空行，直接 yield
                            if value == "[DONE]" {
                                print("✅ [SSE] 收到 [DONE] 标记，结束流")
                                continuation.finish()
                                return
                            }
                            print("✅ [SSE] Yield 事件，数据: \(value.prefix(100))...")
                            continuation.yield(.message(data: value, event: currentEvent, id: currentId))
                            currentEvent = nil
                            currentId = nil
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
