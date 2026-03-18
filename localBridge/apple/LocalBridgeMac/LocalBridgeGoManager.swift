import Foundation

/// 封装 Go Framework。外部接口与现有 LocalBridgeWebSocketServer 完全对齐，
/// AppDelegate 和 UI 层无需修改任何调用点。
final class LocalBridgeGoManager {

    // MARK: - 实例快照
    struct InstanceSnapshot {
        let clientName:    String
        let instanceId:    String
        let clientVersion: String
        let capabilities:  [String]
        let connectedAt:   Date
        let lastSeenAt:    Date
        let xScreenName:   String?
        let isTemporary:   Bool
    }

    // MARK: - 服务状态
    private(set) var isRunning: Bool = false

    // MARK: - 生命周期

    /// 启动 Go 服务（读取 ~/.config/localbridge/config.json 中的端口配置）
    func start() {
        let result = LocalBridgeStart(0, 0)  // 0 = 使用配置文件默认值
        if result == 0 {
            isRunning = true
            let msg = "[LocalBridgeGo] 服务已启动"
            print(msg)
            // 假设您有 BridgeLogger，如果没有，此处可注释
            // BridgeLogger.shared.log(msg)
        } else {
            print("[LocalBridgeGo] 启动失败，返回码: \(result)")
        }
    }

    /// 停止 Go 服务
    func stop(completion: (() -> Void)? = nil) {
        LocalBridgeStop()
        isRunning = false
        print("[LocalBridgeGo] 服务已停止")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            completion?()
        }
    }

    // MARK: - 实例查询

    /// 返回当前所有在线实例的快照列表
    func getConnectedInstances() -> [InstanceSnapshot] {
        guard let jsonPtr = LocalBridgeGetInstancesJSON() else { return [] }
        defer { LocalBridgeFreeString(jsonPtr) }  // 必须释放 Go 分配的 CString

        let jsonStr = String(cString: jsonPtr)
        guard let data = jsonStr.data(using: .utf8),
              let arr = try? JSONDecoder().decode([GoInstanceSnapshot].self, from: data)
        else { return [] }

        // 使用 ISO8601 解析 Go 返回的时间
        let isoSubseconds = ISO8601DateFormatter()
        isoSubseconds.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        let isoStandard = ISO8601DateFormatter()

        return arr.map { g in
            InstanceSnapshot(
                clientName:    g.clientName,
                instanceId:    g.instanceId,
                clientVersion: g.clientVersion,
                capabilities:  g.capabilities,
                connectedAt:   isoSubseconds.date(from: g.connectedAt) ?? isoStandard.date(from: g.connectedAt) ?? Date(),
                lastSeenAt:    isoSubseconds.date(from: g.lastSeenAt) ?? isoStandard.date(from: g.lastSeenAt) ?? Date(),
                xScreenName:   g.xScreenName.isEmpty ? nil : g.xScreenName,
                isTemporary:   g.isTemporary
            )
        }
    }

    // MARK: - 私有：映射 Go 的 JSON 结构
    private struct GoInstanceSnapshot: Decodable {
        let clientName:    String
        let instanceId:    String
        let clientVersion: String
        let capabilities:  [String]
        let connectedAt:   String
        let lastSeenAt:    String
        let xScreenName:   String
        let isTemporary:   Bool
    }
}
