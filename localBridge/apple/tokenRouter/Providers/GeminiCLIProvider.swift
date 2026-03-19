import Foundation

final class GeminiCLIProvider: AIProviderProtocol, Sendable {
    let id: ProviderID = .geminiCLI
    let displayName: String = "Gemini CLI"

    private let executablePath: String

    init(executablePath: String? = nil) {
        if let path = executablePath {
            self.executablePath = path
        } else {
            let commonPaths = ["/opt/homebrew/bin/gemini", "/usr/local/bin/gemini"]
            self.executablePath = commonPaths.first {
                FileManager.default.isExecutableFile(atPath: $0)
            } ?? "gemini"
        }
    }

    func stream(request: AIRequest) -> AsyncThrowingStream<AIStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            let process = Process()
            let stdoutPipe = Pipe()
            let stderrPipe = Pipe()

            process.executableURL = URL(fileURLWithPath: self.executablePath)
            process.arguments = [request.userText, "--output-format", "stream-json"]

            var env = ProcessInfo.processInfo.environment
            // 尝试从 ProviderConfig 加载 API Key，如果失败则回退到旧版 Keychain 加载（使用字面量避开废弃告警）
            let keychain = KeychainTokenStore()
            let apiKey = (try? keychain.loadAllProviderConfigs().first(where: { $0.providerType == .gemini && $0.isEnabled })?.apiKey)
                         ?? (try? keychain.load(key: "gemini_api_key"))
            
            if let key = apiKey {
                env["GEMINI_API_KEY"] = key
            }
            process.environment = env
            process.standardOutput = stdoutPipe
            process.standardError  = stderrPipe

            continuation.onTermination = { @Sendable _ in
                stdoutPipe.fileHandleForReading.readabilityHandler = nil
                stderrPipe.fileHandleForReading.readabilityHandler = nil
                if process.isRunning { process.terminate() }
            }

            guard FileManager.default.isExecutableFile(atPath: self.executablePath) else {
                continuation.finish(throwing: AIProviderError.transport(details: "找不到 gemini 可执行文件：\(self.executablePath)"))
                return
            }

            do {
                try process.run()
            } catch {
                continuation.finish(throwing: AIProviderError.transport(details: "启动 gemini 失败：\(error.localizedDescription)"))
                return
            }

            let messageID = UUID()
            var stdoutBuffer = Data()
            var stderrBuffer = Data()

            continuation.yield(.start(messageID: messageID))

            // 异步读取 stdout（非阻塞）
            stdoutPipe.fileHandleForReading.readabilityHandler = { handle in
                let chunk = handle.availableData
                if chunk.isEmpty {
                    continuation.yield(.finish(messageID: messageID))
                    continuation.finish()
                    handle.readabilityHandler = nil
                    return
                }
                stdoutBuffer.append(chunk)

                while let lineRange = stdoutBuffer.range(of: Data("\n".utf8)) {
                    let lineData = stdoutBuffer.subdata(in: 0..<lineRange.lowerBound)
                    stdoutBuffer.removeSubrange(0..<lineRange.upperBound)

                    guard !lineData.isEmpty,
                          let json = try? JSONSerialization.jsonObject(with: lineData) as? [String: Any] else {
                        continue
                    }

                    // Gemini stream-json 格式：{ "type": "content", "text": "..." }
                    // 也可能是 { "type": "done" }，视实际 CLI 版本而定
                    if let text = json["text"] as? String {
                        continuation.yield(.delta(messageID: messageID, text: text))
                    } else if let type_ = json["type"] as? String, type_ == "done" {
                        continuation.yield(.finish(messageID: messageID))
                        continuation.finish()
                    }
                }
            }

            // 必须持续排空 stderr，否则缓冲区满后子进程阻塞
            stderrPipe.fileHandleForReading.readabilityHandler = { handle in
                let chunk = handle.availableData
                if !chunk.isEmpty {
                    stderrBuffer.append(chunk)
                }
            }
        }
    }
}
