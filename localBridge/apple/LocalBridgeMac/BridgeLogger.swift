import Foundation

/// 文件主存储的日志管理器
/// 写入走后台串行队列，UI 仅消费最近缓存和磁盘真相源
final class BridgeLogger {
    static let shared = BridgeLogger()

    /// 日志更新通知名，UI 监听此通知刷新显示
    static let didUpdateNotification = Notification.Name("BridgeLoggerDidUpdate")

    private static let debugMaxActiveLogBytes = 32 * 1024
    private static let releaseMaxActiveLogBytes = 1 * 1024 * 1024
    static let maintenanceInterval: TimeInterval = 60 * 60
    private static let maxArchiveDirectoryBytes: UInt64 = 500 * 1024 * 1024

    private let displayMaxLines = 1000
    private let maxReadBytes = 512 * 1024
    private let maxActiveLogBytes: Int
    private let logRetentionDays = 3
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
    private let rotationModeLabel: String

    private struct ArchiveFile {
        let url: URL
        let modifiedAt: Date
        let sizeBytes: UInt64
    }

    private struct PruneResult {
        let deletedCount: Int
        let reclaimedBytes: UInt64
    }

    private init() {
        let appSupportDirectory = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? fileManager.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support", isDirectory: true)
        let logsDirectory = appSupportDirectory
            .appendingPathComponent("LocalBridgeMac", isDirectory: true)
            .appendingPathComponent("Logs", isDirectory: true)
        self.logsDirectoryURL = logsDirectory
        self.archiveDirectoryURL = logsDirectory.appendingPathComponent("archive", isDirectory: true)
        self.logFileURL = logsDirectory.appendingPathComponent("bridge.log", isDirectory: false)
        let buildProductsPath = Bundle.main.bundlePath
        let isDebugBuild = buildProductsPath.contains("/Build/Products/Debug/")
        self.maxActiveLogBytes = isDebugBuild ? Self.debugMaxActiveLogBytes : Self.releaseMaxActiveLogBytes
        self.rotationModeLabel = isDebugBuild ? "DEBUG" : "RELEASE"

        try? fileManager.createDirectory(at: logsDirectoryURL, withIntermediateDirectories: true)
        try? fileManager.createDirectory(at: archiveDirectoryURL, withIntermediateDirectories: true)
        if !fileManager.fileExists(atPath: logFileURL.path) {
            fileManager.createFile(atPath: logFileURL.path, contents: nil)
        }
        self.recentLines = Self.readTailLines(from: logFileURL, maxBytes: maxReadBytes, maxLines: displayMaxLines)
        queue.async { [weak self] in
            guard let self = self else { return }
            self.recordInternalLog("[BridgeLogger] initialized in \(self.rotationModeLabel) mode, rotation threshold=\(self.maxActiveLogBytes) bytes, retentionDays=\(self.logRetentionDays), archiveLimit=\(Self.maxArchiveDirectoryBytes) bytes, bundle=\(buildProductsPath), file=\(self.logFileURL.path)")
        }
    }

    var fileURL: URL {
        logFileURL
    }

    var logsDirectoryURLForReveal: URL {
        logsDirectoryURL
    }

    func runMaintenance(reason: String = "manual") {
        queue.async { [weak self] in
            self?.runMaintenanceOnQueue(reason: reason)
        }
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

    private func recordInternalLog(_ message: String) {
        let line = "[\(formatter.string(from: Date()))] \(message)"
        appendToFile(line + "\n")
        appendToRecentLines([line])
        hasPendingChanges = true
        scheduleNotificationIfNeeded()
    }

    private func runMaintenanceOnQueue(reason: String) {
        let activeBytesBefore = currentActiveLogBytes()
        let archivesBefore = listArchiveFiles()
        let archiveBytesBefore = archivesBefore.reduce(UInt64(0)) { $0 + $1.sizeBytes }
        recordInternalLog("[Log] maintenance started reason=\(reason) mode=\(rotationModeLabel) activeBytes=\(activeBytesBefore) archiveFiles=\(archivesBefore.count) archiveBytes=\(archiveBytesBefore) threshold=\(maxActiveLogBytes) archiveLimit=\(Self.maxArchiveDirectoryBytes)")

        rotateIfNeeded(forAdditionalBytes: 0)
        let expiredPruneResult = pruneExpiredArchives()
        let sizePruneResult = pruneArchivesIfNeededBySize()

        let activeBytesAfter = currentActiveLogBytes()
        let archivesAfter = listArchiveFiles()
        let archiveBytesAfter = archivesAfter.reduce(UInt64(0)) { $0 + $1.sizeBytes }
        recordInternalLog("[Log] maintenance finished reason=\(reason) activeBytes=\(activeBytesAfter) archiveFiles=\(archivesAfter.count) archiveBytes=\(archiveBytesAfter) expiredDeleted=\(expiredPruneResult.deletedCount) expiredReclaimed=\(expiredPruneResult.reclaimedBytes) sizeDeleted=\(sizePruneResult.deletedCount) sizeReclaimed=\(sizePruneResult.reclaimedBytes)")
    }

    private func currentActiveLogBytes() -> Int {
        (try? fileManager.attributesOfItem(atPath: logFileURL.path)[.size] as? NSNumber)?.intValue ?? 0
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
            self.recordInternalLog("[Log] cleared active log file, recent display cache reset")
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
        let currentSize = currentActiveLogBytes()
        let projectedSize = currentSize + additionalBytes

        if currentSize == 0 || currentSize >= (maxActiveLogBytes / 2) {
            recordInternalLog("[Log] rotate check mode=\(rotationModeLabel) current=\(currentSize) additional=\(additionalBytes) projected=\(projectedSize) threshold=\(maxActiveLogBytes) file=\(logFileURL.lastPathComponent)")
        }

        if projectedSize <= maxActiveLogBytes {
            return
        }
        recordInternalLog("[Log] rotating active log at \(currentSize) bytes with threshold \(maxActiveLogBytes) bytes")
        archiveCurrentLog()
        let expiredPruneResult = pruneExpiredArchives()
        if expiredPruneResult.deletedCount > 0 {
            recordInternalLog("[Log] post-rotate expired prune deleted=\(expiredPruneResult.deletedCount) reclaimed=\(expiredPruneResult.reclaimedBytes) bytes")
        }
        let sizePruneResult = pruneArchivesIfNeededBySize()
        if sizePruneResult.deletedCount > 0 {
            recordInternalLog("[Log] post-rotate size prune deleted=\(sizePruneResult.deletedCount) reclaimed=\(sizePruneResult.reclaimedBytes) bytes")
        }
    }

    private func archiveCurrentLog() {
        guard fileManager.fileExists(atPath: logFileURL.path) else {
            fileManager.createFile(atPath: logFileURL.path, contents: nil)
            recordInternalLog("[Log] archive skipped because active log file was missing, recreated empty active file")
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
                recordInternalLog("[Log] archive skipped because active log file was empty")
                return
            }
            let archivedBytes = fileData.count
            try fileManager.moveItem(at: logFileURL, to: archiveURL)
            fileManager.createFile(atPath: logFileURL.path, contents: nil)
            recordInternalLog("[Log] rotated active log into archive=\(archiveURL.lastPathComponent) bytes=\(archivedBytes)")
        } catch {
            if !fileManager.fileExists(atPath: logFileURL.path) {
                fileManager.createFile(atPath: logFileURL.path, contents: nil)
            }
            recordInternalLog("[Log] archive move failed, recreated active log if needed")
        }
    }

    private func listArchiveFiles() -> [ArchiveFile] {
        guard let enumerator = fileManager.enumerator(
            at: archiveDirectoryURL,
            includingPropertiesForKeys: [.contentModificationDateKey, .fileSizeKey, .isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }

        var files: [ArchiveFile] = []

        for case let fileURL as URL in enumerator {
            guard fileURL.lastPathComponent.hasPrefix("bridge-"), fileURL.pathExtension == "log" else { continue }
            guard let resourceValues = try? fileURL.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey, .isRegularFileKey]),
                  resourceValues.isRegularFile == true else {
                continue
            }

            let modifiedAt = resourceValues.contentModificationDate ?? .distantPast
            let sizeBytes = UInt64(resourceValues.fileSize ?? 0)
            files.append(ArchiveFile(url: fileURL, modifiedAt: modifiedAt, sizeBytes: sizeBytes))
        }

        return files
    }

    private func pruneExpiredArchives() -> PruneResult {
        let expirationDate = Calendar.current.date(byAdding: .day, value: -logRetentionDays, to: Date()) ?? Date.distantPast
        var deletedCount = 0
        var reclaimedBytes: UInt64 = 0

        for archive in listArchiveFiles() {
            if archive.modifiedAt < expirationDate {
                do {
                    try fileManager.removeItem(at: archive.url)
                    deletedCount += 1
                    reclaimedBytes += archive.sizeBytes
                } catch {
                    continue
                }
            }
        }

        if deletedCount > 0 {
            recordInternalLog("[Log] pruned expired archives deleted=\(deletedCount) reclaimed=\(reclaimedBytes) bytes retentionDays=\(logRetentionDays)")
        }

        return PruneResult(deletedCount: deletedCount, reclaimedBytes: reclaimedBytes)
    }

    private func pruneArchivesIfNeededBySize() -> PruneResult {
        let archives = listArchiveFiles().sorted { $0.modifiedAt < $1.modifiedAt }
        let totalSize = archives.reduce(UInt64(0)) { $0 + $1.sizeBytes }
        guard !archives.isEmpty else {
            return PruneResult(deletedCount: 0, reclaimedBytes: 0)
        }

        guard totalSize > Self.maxArchiveDirectoryBytes else {
            recordInternalLog("[Log] archive size check passed usage=\(totalSize) bytes limit=\(Self.maxArchiveDirectoryBytes) bytes files=\(archives.count)")
            return PruneResult(deletedCount: 0, reclaimedBytes: 0)
        }

        let deleteCount = max(1, archives.count / 2)
        var deletedCount = 0
        var reclaimedBytes: UInt64 = 0

        for archive in archives.prefix(deleteCount) {
            do {
                try fileManager.removeItem(at: archive.url)
                deletedCount += 1
                reclaimedBytes += archive.sizeBytes
            } catch {
                continue
            }
        }

        if deletedCount > 0 {
            recordInternalLog("[Log] pruned archive files by size deleted=\(deletedCount) reclaimed=\(reclaimedBytes) bytes previousArchiveUsage=\(totalSize) bytes limit=\(Self.maxArchiveDirectoryBytes) bytes")
        }

        return PruneResult(deletedCount: deletedCount, reclaimedBytes: reclaimedBytes)
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
