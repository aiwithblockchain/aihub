import Foundation

/// 轻量级内存环形缓冲日志管理器
/// 最多保留 maxLines 条日志，超过后自动丢弃最旧的
final class BridgeLogger {
    static let shared = BridgeLogger()

    /// 日志更新通知名，UI 监听此通知刷新显示
    static let didUpdateNotification = Notification.Name("BridgeLoggerDidUpdate")

    private let maxLines = 2000
    private var lines: [String] = []
    private let queue = DispatchQueue(label: "com.localbridgemac.logger", qos: .utility)
    private let formatter: DateFormatter = {
        let df = DateFormatter()
        df.dateFormat = "HH:mm:ss.SSS"
        return df
    }()
    private var notificationScheduled = false
    private var hasPendingChanges = false

    private init() {}

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
            self.lines.append(contentsOf: newLines)
            if self.lines.count > self.maxLines {
                self.lines.removeFirst(self.lines.count - self.maxLines)
            }
            self.hasPendingChanges = true
            self.scheduleNotificationIfNeeded()
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

    /// 返回当前所有日志行的快照（主线程调用）
    func snapshot() -> [String] {
        queue.sync { lines }
    }

    /// 清空所有日志
    func clear() {
        queue.async { [weak self] in
            guard let self = self else { return }
            self.lines.removeAll()
            self.hasPendingChanges = true
            self.scheduleNotificationIfNeeded()
        }
    }
}
