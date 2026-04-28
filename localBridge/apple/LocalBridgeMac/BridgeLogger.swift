import Foundation

/// 文件主存储的日志管理器
/// 写入走后台串行队列，UI 仅消费最近缓存和磁盘真相源
final class BridgeLogger {
    static let shared = BridgeLogger()

    /// 日志更新通知名，UI 监听此通知刷新显示
    static let didUpdateNotification = Notification.Name("BridgeLoggerDidUpdate")

    private static let debugMaxActiveLogBytes = 128 * 1024
    private static let releaseMaxActiveLogBytes = 5 * 1024 * 1024

    private let displayMaxLines = 1000
    private let maxReadBytes = 512 * 1024
    private let maxActiveLogBytes: Int
    private let logRetentionDays = 7
    private var recentLines: [String] = []
    private let queue = DispatchQueue(label: "com.localbridgemac.logger", qos: .utility)
    private let formatter: DateFormatter = {
        let df = DateFormatter()
        df.dateFormat = "HH:mm:ss.SSS"
        return df
    }()
    private let archiveFormatter: DateFormatter = {
        let df = DateFormatter()
        df.dateFormat = "yyyyMMdd-HHmmss"
        return df
    }()
    private var notificationScheduled = false
    private var hasPendingChanges = false
    private let fileManager = FileManager.default
    private let logFileURL: URL
    private let logsDirectoryURL: URL
    private let archiveDirectoryURL: URL

    private init() {
        let appSupportDirectory = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? fileManager.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support", isDirectory: true)
        let logsDirectory = appSupportDirectory
            .appendingPathComponent("LocalBridgeMac", isDirectory: true)
            .appendingPathComponent("Logs", isDirectory: true)
        self.logsDirectoryURL = logsDirectory
        self.archiveDirectoryURL = logsDirectory.appendingPathComponent("archive", isDirectory: true)
        self.logFileURL = logsDirectory.appendingPathComponent("bridge.log", isDirectory: false)
        #if DEBUG
        self.maxActiveLogBytes = Self.debugMaxActiveLogBytes
        #else
        self.maxActiveLogBytes = Self.releaseMaxActiveLogBytes
        #endif

        try? fileManager.createDirectory(at: logsDirectoryURL, withIntermediateDirectories: true)
        try? fileManager.createDirectory(at: archiveDirectoryURL, withIntermediateDirectories: true)
        if !fileManager.fileExists(atPath: logFileURL.path) {
            fileManager.createFile(atPath: logFileURL.path, contents: nil)
        }
        self.recentLines = Self.readTailLines(from: logFileURL, maxBytes: maxReadBytes, maxLines: displayMaxLines)
        queue.async { [weak self] in
            self?.pruneExpiredArchives()
        }
    }

    var fileURL: URL {
        logFileURL
    }

    var logsDirectoryURLForReveal: URL {
        logsDirectoryURL
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
            self.rotateIfNeeded(forAdditionalBytes: payload.lengthOfBytes(using: .utf8))
            self.appendToFile(payload)
            self.appendToRecentLines(newLines)
            self.hasPendingChanges = true
            self.scheduleNotificationIfNeeded()
        }
    }

    private func appendToRecentLines(_ newLines: [String]) {
        recentLines.append(contentsOf: newLines)
        if recentLines.count > displayMaxLines {
            recentLines.removeFirst(recentLines.count - displayMaxLines)
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

    /// 返回当前显示用日志行快照（最多最近 1000 条）
    func displaySnapshot() -> [String] {
        queue.sync {
            recentLines
        }
    }

    /// 返回当前所有日志行的快照
    func snapshot() -> [String] {
        displaySnapshot()
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

    private func rotateIfNeeded(forAdditionalBytes additionalBytes: Int) {
        let currentSize = (try? fileManager.attributesOfItem(atPath: logFileURL.path)[.size] as? NSNumber)?.intValue ?? 0
        guard currentSize + additionalBytes > maxActiveLogBytes else { return }
        archiveCurrentLog()
        pruneExpiredArchives()
    }

    private func archiveCurrentLog() {
        guard fileManager.fileExists(atPath: logFileURL.path) else {
            fileManager.createFile(atPath: logFileURL.path, contents: nil)
            return
        }

        let timestamp = archiveFormatter.string(from: Date())
        var archiveURL = archiveDirectoryURL.appendingPathComponent("bridge-\(timestamp).log", isDirectory: false)
        var suffix = 1
        while fileManager.fileExists(atPath: archiveURL.path) {
            archiveURL = archiveDirectoryURL.appendingPathComponent("bridge-\(timestamp)-\(suffix).log", isDirectory: false)
            suffix += 1
        }

        do {
            let fileData = (try? Data(contentsOf: logFileURL)) ?? Data()
            if fileData.isEmpty {
                try? Data().write(to: logFileURL, options: .atomic)
                return
            }
            try fileManager.moveItem(at: logFileURL, to: archiveURL)
            fileManager.createFile(atPath: logFileURL.path, contents: nil)
            let rotationLine = "[\(formatter.string(from: Date()))] [Log] rotated from previous active log\n"
            appendToFile(rotationLine)
            appendToRecentLines([rotationLine.trimmingCharacters(in: .newlines)])
        } catch {
            if !fileManager.fileExists(atPath: logFileURL.path) {
                fileManager.createFile(atPath: logFileURL.path, contents: nil)
            }
        }
    }

    private func pruneExpiredArchives() {
        guard let enumerator = fileManager.enumerator(at: archiveDirectoryURL, includingPropertiesForKeys: [.contentModificationDateKey], options: [.skipsHiddenFiles]) else {
            return
        }

        let expirationDate = Calendar.current.date(byAdding: .day, value: -logRetentionDays, to: Date()) ?? Date.distantPast

        for case let fileURL as URL in enumerator {
            guard fileURL.lastPathComponent.hasPrefix("bridge-"), fileURL.pathExtension == "log" else { continue }
            let resourceValues = try? fileURL.resourceValues(forKeys: [.contentModificationDateKey])
            let modifiedAt = resourceValues?.contentModificationDate ?? .distantPast
            if modifiedAt < expirationDate {
                try? fileManager.removeItem(at: fileURL)
            }
        }
    }

    private static func readText(from fileURL: URL, maxBytes: Int) -> String {
        guard let data = try? Data(contentsOf: fileURL) else { return "" }
        let slice = data.count > maxBytes ? data.suffix(maxBytes) : data[...]
        return String(data: Data(slice), encoding: .utf8) ?? ""
    }

    private static func readTailLines(from fileURL: URL, maxBytes: Int, maxLines: Int) -> [String] {
        let text = readText(from: fileURL, maxBytes: maxBytes)
        guard !text.isEmpty else { return [] }
        let lines = text.split(separator: "\n", omittingEmptySubsequences: true).map(String.init)
        return lines.count > maxLines ? Array(lines.suffix(maxLines)) : lines
    }
}
