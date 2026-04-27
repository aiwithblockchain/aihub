import Foundation

/// 文件主存储的日志管理器
/// 写入走后台串行队列，UI 仅消费最近缓存和磁盘真相源
final class BridgeLogger {
    static let shared = BridgeLogger()

    /// 日志更新通知名，UI 监听此通知刷新显示
    static let didUpdateNotification = Notification.Name("BridgeLoggerDidUpdate")

    private let maxCachedLines = 2000
    private let maxReadBytes = 512 * 1024
    private var recentLines: [String] = []
    private let queue = DispatchQueue(label: "com.localbridgemac.logger", qos: .utility)
    private let formatter: DateFormatter = {
        let df = DateFormatter()
        df.dateFormat = "HH:mm:ss.SSS"
        return df
    }()
    private var notificationScheduled = false
    private var hasPendingChanges = false
    private let fileManager = FileManager.default
    private let logFileURL: URL

    private init() {
        let appSupportDirectory = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? fileManager.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support", isDirectory: true)
        let logsDirectory = appSupportDirectory
            .appendingPathComponent("LocalBridgeMac", isDirectory: true)
            .appendingPathComponent("Logs", isDirectory: true)
        self.logFileURL = logsDirectory.appendingPathComponent("bridge.log", isDirectory: false)

        try? fileManager.createDirectory(at: logsDirectory, withIntermediateDirectories: true)
        if !fileManager.fileExists(atPath: logFileURL.path) {
            fileManager.createFile(atPath: logFileURL.path, contents: nil)
        }
        self.recentLines = Self.readTailLines(from: logFileURL, maxBytes: maxReadBytes)
    }

    var fileURL: URL {
        logFileURL
    }

    /// 记录一条日志，线程安全，自动附加时间戳，并发送 UI 更新通知
    func log(_ message: String) {
        append([message])
    }

    func append(_ messages: [String]) {
        guard !messages.isEmpty else { return }

        queue.async { [weak self] in
            guard let self = self else { return }
            let timestamp = self.formatter.string(from: Date())
            let newLines = messages.map { "[\(timestamp)] \($0)" }
            let payload = newLines.joined(separator: "\n") + "\n"
            self.appendToFile(payload)
            self.recentLines.append(contentsOf: newLines)
            if self.recentLines.count > self.maxCachedLines {
                self.recentLines.removeFirst(self.recentLines.count - self.maxCachedLines)
            }
            self.hasPendingChanges = true
            self.scheduleNotificationIfNeeded()
        }
    }

    private func appendToFile(_ payload: String) {
        guard let data = payload.data(using: .utf8) else { return }
        do {
            if !fileManager.fileExists(atPath: logFileURL.path) {
                fileManager.createFile(atPath: logFileURL.path, contents: nil)
            }
            let handle = try FileHandle(forWritingTo: logFileURL)
            defer { try? handle.close() }
            try handle.seekToEnd()
            try handle.write(contentsOf: data)
        } catch {
            // Avoid recursive logging here
        }
    }

    private func scheduleNotificationIfNeeded() {
        guard !notificationScheduled else { return }
        notificationScheduled = true

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            NotificationCenter.default.post(name: BridgeLogger.didUpdateNotification, object: nil)
            self.queue.async {
                self.notificationScheduled = false
                if self.hasPendingChanges {
                    self.hasPendingChanges = false
                    self.scheduleNotificationIfNeeded()
                }
            }
        }
    }

    /// 返回当前日志的文本内容
    func currentLogText() -> String {
        queue.sync {
            Self.readText(from: logFileURL, maxBytes: maxReadBytes)
        }
    }

    /// 返回当前所有日志行的快照
    func snapshot() -> [String] {
        queue.sync {
            let text = Self.readText(from: logFileURL, maxBytes: maxReadBytes)
            return text.isEmpty ? [] : text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init).filter { !$0.isEmpty }
        }
    }

    /// 清空所有日志，并在完成后回调
    func clearLogs(completion: (() -> Void)? = nil) {
        queue.async { [weak self] in
            guard let self = self else { return }
            self.recentLines.removeAll()
            if self.fileManager.fileExists(atPath: self.logFileURL.path) {
                try? Data().write(to: self.logFileURL, options: .atomic)
            } else {
                self.fileManager.createFile(atPath: self.logFileURL.path, contents: nil)
            }
            self.hasPendingChanges = true
            self.scheduleNotificationIfNeeded()
            if let completion = completion {
                DispatchQueue.main.async {
                    completion()
                }
            }
        }
    }

    func clear() {
        clearLogs()
    }

    private static func readText(from fileURL: URL, maxBytes: Int) -> String {
        guard let data = try? Data(contentsOf: fileURL) else { return "" }
        let slice = data.count > maxBytes ? data.suffix(maxBytes) : data[...]
        return String(data: Data(slice), encoding: .utf8) ?? ""
    }

    private static func readTailLines(from fileURL: URL, maxBytes: Int) -> [String] {
        let text = readText(from: fileURL, maxBytes: maxBytes)
        guard !text.isEmpty else { return [] }
        return text.split(separator: "\n", omittingEmptySubsequences: true).map(String.init)
    }
}
