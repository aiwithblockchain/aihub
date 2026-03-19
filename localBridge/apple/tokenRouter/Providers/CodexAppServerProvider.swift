import Foundation

final class CodexAppServerProvider: AIProviderProtocol, Sendable {
    let id: ProviderID = .codexCLI
    let displayName: String = "Codex App Server"

    private let executablePath: String

    init(executablePath: String? = nil) {
        if let path = executablePath {
            self.executablePath = path
        } else {
            let commonPaths = ["/opt/homebrew/bin/codex", "/usr/local/bin/codex"]
            self.executablePath = commonPaths.first {
                FileManager.default.isExecutableFile(atPath: $0)
            } ?? "codex"
        }
    }

    func stream(request: AIRequest) -> AsyncThrowingStream<AIStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            let process = Process()
            let stdinPipe = Pipe()
            let stdoutPipe = Pipe()
            let stderrPipe = Pipe()

            process.executableURL = URL(fileURLWithPath: self.executablePath)
            process.arguments = ["app-server"]

            // 注入 API Key
            var env = ProcessInfo.processInfo.environment
            // 尝试从 ProviderConfig 加载 API Key，如果失败则回退到旧版 Keychain 加载（使用字面量避开废弃告警）
            let keychain = KeychainTokenStore()
            let apiKey = (try? keychain.loadAllProviderConfigs().first(where: { $0.providerType == .openai && $0.isEnabled })?.apiKey)
                         ?? (try? keychain.load(key: "openai_api_key"))
            
            if let key = apiKey {
                env["OPENAI_API_KEY"] = key
            }
            process.environment = env
            process.standardInput  = stdinPipe
            process.standardOutput = stdoutPipe
            process.standardError  = stderrPipe

            // 取消时终止进程
            continuation.onTermination = { @Sendable _ in
                stdoutPipe.fileHandleForReading.readabilityHandler = nil
                stderrPipe.fileHandleForReading.readabilityHandler = nil
                if process.isRunning { process.terminate() }
            }

            guard FileManager.default.isExecutableFile(atPath: self.executablePath) else {
                continuation.finish(throwing: AIProviderError.transport(details: "找不到 codex 可执行文件：\(self.executablePath)"))
                return
            }

            do {
                try process.run()
            } catch {
                continuation.finish(throwing: AIProviderError.transport(details: "启动 codex 失败：\(error.localizedDescription)"))
                return
            }

            let messageID = UUID()
            var stdoutBuffer = Data()
            var initialized = false

            // 异步读取 stdout（非阻塞）
            stdoutPipe.fileHandleForReading.readabilityHandler = { handle in
                let chunk = handle.availableData
                if chunk.isEmpty {
                    // EOF：进程结束
                    continuation.yield(.finish(messageID: messageID))
                    continuation.finish()
                    handle.readabilityHandler = nil
                    return
                }
                stdoutBuffer.append(chunk)

                // 按行解析 JSONL
                while let lineRange = stdoutBuffer.range(of: Data("\n".utf8)) {
                    let lineData = stdoutBuffer.subdata(in: 0..<lineRange.lowerBound)
                    stdoutBuffer.removeSubrange(0..<lineRange.upperBound)

                    guard !lineData.isEmpty,
                          let json = try? JSONSerialization.jsonObject(with: lineData) as? [String: Any] else {
                        continue
                    }

                    // 收到 initialize 响应后，发送 initialized 通知，再发起对话
                    if !initialized, let id = json["id"] as? Int, id == 1, json["result"] != nil {
                        initialized = true

                        // 发送 initialized 通知（JSON-RPC 规范要求）
                        Self.sendJSON([
                            "jsonrpc": "2.0",
                            "method": "initialized",
                            "params": [:]
                        ], to: stdinPipe)

                        // 发起对话
                        Self.sendJSON([
                            "jsonrpc": "2.0",
                            "method": "thread/start",
                            "params": [
                                "userPrompt": request.userText,
                                "systemPrompt": request.systemPrompt ?? ""
                            ]
                        ], to: stdinPipe)

                        continuation.yield(.start(messageID: messageID))
                        continue
                    }

                    // 处理通知事件
                    if let method = json["method"] as? String {
                        switch method {
                        case "delta":
                            if let params = json["params"] as? [String: Any],
                               let text = params["text"] as? String {
                                continuation.yield(.delta(messageID: messageID, text: text))
                            }
                        case "turn/finish":
                            continuation.yield(.finish(messageID: messageID))
                            continuation.finish()
                        default:
                            break
                        }
                    }
                }
            }

            // 必须持续排空 stderr，否则缓冲区满后子进程阻塞
            stderrPipe.fileHandleForReading.readabilityHandler = { handle in
                _ = handle.availableData // 丢弃，仅防止阻塞
            }

            // 发送 initialize 请求
            Self.sendJSON([
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": ["capabilities": [:]]
            ], to: stdinPipe)
        }
    }

    private static func sendJSON(_ dict: [String: Any], to pipe: Pipe) {
        guard var data = try? JSONSerialization.data(withJSONObject: dict) else { return }
        data.append(Data("\n".utf8))
        try? pipe.fileHandleForWriting.write(contentsOf: data)
    }
}
