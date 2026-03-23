import Foundation
import LocalBridge

final class LocalBridgeGoManager {
    struct InstanceSnapshot: Decodable {
        let clientName: String
        let instanceId: String
        let instanceName: String?
        let clientVersion: String
        let capabilities: [String]
        let connectedAt: Date
        let lastSeenAt: Date
        let xScreenName: String?
        let isTemporary: Bool
    }

    private static let defaultExecuteTaskTimeoutMs = 210_000
    private let session = URLSession(configuration: .default)
    private var logPollTimer: Timer?
    private var lastLogCount: Int = 0

    func start() {
        // 加载配置并保存到 Go 的配置文件
        let config = BridgeConfig.load()
        saveConfigToGoConfigFile(config)

        // 启动服务（端口参数已不再使用，从配置文件读取）
        let code = LocalBridgeStart(0, 0)
        if code != 0 {
            BridgeLogger.shared.log("[LocalBridgeMac] LocalBridgeStart failed with code \(code)")
        }

        startLogPolling()
    }

    private func saveConfigToGoConfigFile(_ config: BridgeConfig) {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

        guard let jsonData = try? encoder.encode(config),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            BridgeLogger.shared.log("[LocalBridgeMac] Failed to encode config")
            return
        }

        let homeDir = FileManager.default.homeDirectoryForCurrentUser
        let configDir = homeDir.appendingPathComponent(".config/localbridge")
        let configFile = configDir.appendingPathComponent("config.json")

        do {
            try FileManager.default.createDirectory(at: configDir, withIntermediateDirectories: true)
            try jsonString.write(to: configFile, atomically: true, encoding: .utf8)
            BridgeLogger.shared.log("[LocalBridgeMac] Config saved to \(configFile.path)")
        } catch {
            BridgeLogger.shared.log("[LocalBridgeMac] Failed to save config: \(error)")
        }
    }

    func stop(completion: (() -> Void)? = nil) {
        stopLogPolling()
        LocalBridgeStop()
        DispatchQueue.main.async {
            completion?()
        }
    }

    func getConnectedInstances() -> [InstanceSnapshot] {
        guard let rawPointer = LocalBridgeGetInstancesJSON() else {
            return []
        }

        defer {
            LocalBridgeFreeString(rawPointer)
        }

        let data = Data(bytes: rawPointer, count: Int(strlen(rawPointer)))
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            try Self.decodeGoDate(from: decoder)
        }

        do {
            return try decoder.decode([InstanceSnapshot].self, from: data)
        } catch {
            BridgeLogger.shared.log("[LocalBridgeMac] Failed to decode instances JSON: \(error.localizedDescription)")
            return []
        }
    }

    // MARK: - Go Log Polling

    func startLogPolling() {
        logPollTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.pollGoLogs()
        }
    }

    func stopLogPolling() {
        logPollTimer?.invalidate()
        logPollTimer = nil
    }

    private func pollGoLogs() {
        guard let ptr = LocalBridgeGetLogsJSON() else { return }
        defer { LocalBridgeFreeString(ptr) }

        let data = Data(bytes: ptr, count: Int(strlen(ptr)))
        guard let lines = try? JSONDecoder().decode([String].self, from: data) else { return }

        // 增量处理：只把新增的行写入 BridgeLogger
        guard lines.count > lastLogCount else { return }
        let newLines = Array(lines.dropFirst(lastLogCount))
        lastLogCount = lines.count

        for line in newLines {
            BridgeLogger.shared.log("[Go] \(line)")
        }
    }

    func sendQueryXTabsStatus(instanceId: String? = nil) {
        invokePlugin(
            clientName: "tweetClaw",
            messageType: "request.query_x_tabs_status",
            instanceId: instanceId,
            payload: EmptyPayload(),
            timeoutMs: 5_000,
            notificationName: "QueryXTabsStatusReceived",
            format: .prettyJSON
        )
    }

    func sendQueryXBasicInfo(instanceId: String? = nil) {
        invokePlugin(
            clientName: "tweetClaw",
            messageType: "request.query_x_basic_info",
            instanceId: instanceId,
            payload: EmptyPayload(),
            timeoutMs: 5_000,
            notificationName: "QueryXBasicInfoReceived",
            format: .rawJSON
        )
    }

    func sendOpenTab(path: String, instanceId: String? = nil) {
        invokePlugin(
            clientName: "tweetClaw",
            messageType: "request.open_tab",
            instanceId: instanceId,
            payload: OpenTabPayload(path: path),
            timeoutMs: 5_000,
            notificationName: "OpenTabReceived",
            format: .prettyJSON
        )
    }

    func sendCloseTab(tabId: Int, instanceId: String? = nil) {
        invokePlugin(
            clientName: "tweetClaw",
            messageType: "request.close_tab",
            instanceId: instanceId,
            payload: CloseTabPayload(tabId: tabId),
            timeoutMs: 5_000,
            notificationName: "CloseTabReceived",
            format: .prettyJSON
        )
    }

    func sendNavigateTab(tabId: Int?, path: String, instanceId: String? = nil) {
        invokePlugin(
            clientName: "tweetClaw",
            messageType: "request.navigate_tab",
            instanceId: instanceId,
            payload: NavigateTabPayload(tabId: tabId, path: path),
            timeoutMs: 5_000,
            notificationName: "NavigateTabReceived",
            format: .prettyJSON
        )
    }

    func sendExecAction(
        action: String,
        tweetId: String?,
        userId: String?,
        tabId: Int?,
        text: String? = nil,
        instanceId: String? = nil
    ) {
        // Standardize action names based on Go server expectations
        let standardizedAction: String
        switch action {
        case "createTweet": standardizedAction = "post_tweet"
        case "createReply": standardizedAction = "reply_tweet"
        case "deleteTweet": standardizedAction = "delete_tweet"
        default: standardizedAction = action
        }

        invokePlugin(
            clientName: "tweetClaw",
            messageType: "request.exec_action",
            instanceId: instanceId,
            payload: ExecActionPayload(action: standardizedAction, tweetId: tweetId, userId: userId, tabId: tabId, text: text),
            timeoutMs: 15_000,
            notificationName: "ExecActionReceived",
            format: .prettyJSON
        )
    }

    func sendQueryHomeTimeline(tabId: Int? = nil, instanceId: String? = nil) {
        invokePlugin(
            clientName: "tweetClaw",
            messageType: "request.query_home_timeline",
            instanceId: instanceId,
            payload: QueryTimelinePayload(tabId: tabId),
            timeoutMs: 8_000,
            notificationName: "ExecActionReceived",
            format: .prettyJSON
        )
    }

    func sendQueryTweetDetail(tweetId: String, tabId: Int? = nil, instanceId: String? = nil) {
        invokePlugin(
            clientName: "tweetClaw",
            messageType: "request.query_tweet_detail",
            instanceId: instanceId,
            payload: QueryTweetDetailPayload(tweetId: tweetId, tabId: tabId),
            timeoutMs: 8_000,
            notificationName: "ExecActionReceived",
            format: .prettyJSON
        )
    }

    func sendQueryUserProfile(screenName: String, tabId: Int? = nil, instanceId: String? = nil) {
        invokePlugin(
            clientName: "tweetClaw",
            messageType: "request.query_user_profile",
            instanceId: instanceId,
            payload: QueryUserProfilePayload(screenName: screenName, tabId: tabId),
            timeoutMs: 8_000,
            notificationName: "ExecActionReceived",
            format: .prettyJSON
        )
    }

    func sendQuerySearchTimeline(tabId: Int? = nil, instanceId: String? = nil) {
        invokePlugin(
            clientName: "tweetClaw",
            messageType: "request.query_search_timeline",
            instanceId: instanceId,
            payload: QueryTimelinePayload(tabId: tabId),
            timeoutMs: 8_000,
            notificationName: "ExecActionReceived",
            format: .prettyJSON
        )
    }

    func sendQueryAITabsStatus(instanceId: String? = nil) {
        invokePlugin(
            clientName: "aiClaw",
            messageType: "request.query_ai_tabs_status",
            instanceId: instanceId,
            payload: EmptyPayload(),
            timeoutMs: 5_000,
            notificationName: "QueryAITabsStatusReceived",
            format: .prettyJSON
        )
    }

    func sendSendMessage(platform: String, prompt: String, instanceId: String? = nil) {
        let payload = ExecuteTaskPayload(
            taskId: "task_\(Int(Date().timeIntervalSince1970))",
            platform: platform,
            action: "send_message",
            payload: SendMessagePromptPayload(prompt: prompt, conversationId: nil, model: nil),
            timeout: Self.defaultExecuteTaskTimeoutMs
        )

        invokePlugin(
            clientName: "aiClaw",
            messageType: "request.execute_task",
            instanceId: instanceId,
            payload: payload,
            timeoutMs: Self.defaultExecuteTaskTimeoutMs,
            notificationName: "SendMessageReceived",
            format: .prettyJSON,
            extraUserInfo: ["resultTitle": "Send Message Result"]
        )
    }

    func sendNewConversation(platform: String, instanceId: String? = nil) {
        let payload = ExecuteTaskPayload(
            taskId: "task_new_conv_\(Int(Date().timeIntervalSince1970))",
            platform: platform,
            action: "new_conversation",
            payload: SendMessagePromptPayload(prompt: nil, conversationId: nil, model: nil),
            timeout: 30_000
        )

        invokePlugin(
            clientName: "aiClaw",
            messageType: "request.execute_task",
            instanceId: instanceId,
            payload: payload,
            timeoutMs: 30_000,
            notificationName: "SendMessageReceived",
            format: .prettyJSON,
            extraUserInfo: ["resultTitle": "New Conversation Result"]
        )
    }

    func sendNavigateToPlatform(platform: String, instanceId: String? = nil) {
        invokePlugin(
            clientName: "aiClaw",
            messageType: "request.navigate_to_platform",
            instanceId: instanceId,
            payload: NavigateToPlatformPayload(platform: platform),
            timeoutMs: 5_000,
            notificationName: "NavigateToPlatformReceived",
            format: .prettyJSON
        )
    }

    func sendRESTRequest(method: String, path: String, notificationName: String) {
        let urlString = "http://127.0.0.1:\(restPort)\(path)"
        guard let url = URL(string: urlString) else {
            postNotification(name: notificationName, dataString: "Error: Invalid REST URL: \(urlString)", extraUserInfo: [:])
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.uppercased()
        
        BridgeLogger.shared.log("[LocalBridgeMac] REST Request: \(method) \(path)")

        session.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }

            if let error = error {
                self.postNotification(name: notificationName, dataString: "Error: \(error.localizedDescription)", extraUserInfo: [:])
                return
            }

            guard let httpResponse = response as? HTTPURLResponse else {
                self.postNotification(name: notificationName, dataString: "Error: Invalid HTTP response", extraUserInfo: [:])
                return
            }

            let responseData = data ?? Data()
            let dataString = self.formattedResponseString(from: responseData, format: .prettyJSON)
            
            if !(200...299).contains(httpResponse.statusCode) {
                let msg = self.errorMessage(from: responseData) ?? "HTTP \(httpResponse.statusCode)"
                self.postNotification(name: notificationName, dataString: "Error: \(msg)\n\n\(dataString)", extraUserInfo: [:])
            } else {
                self.postNotification(name: notificationName, dataString: dataString, extraUserInfo: [:])
            }
        }.resume()
    }
}

private extension LocalBridgeGoManager {
    enum ResponseFormat {
        case prettyJSON
        case rawJSON
    }

    struct EmptyPayload: Encodable {}

    struct PluginInvokeRequest<Payload: Encodable>: Encodable {
        let messageType: String
        let instanceId: String?
        let payload: Payload
        let timeoutMs: Int
    }

    struct OpenTabPayload: Encodable {
        let path: String
    }

    struct CloseTabPayload: Encodable {
        let tabId: Int
    }

    struct NavigateTabPayload: Encodable {
        let tabId: Int?
        let path: String
    }

    struct ExecActionPayload: Encodable {
        let action: String
        let tweetId: String?
        let userId: String?
        let tabId: Int?
        let text: String?
    }

    struct QueryTimelinePayload: Encodable {
        let tabId: Int?
    }

    struct QueryTweetDetailPayload: Encodable {
        let tweetId: String
        let tabId: Int?
    }

    struct QueryUserProfilePayload: Encodable {
        let screenName: String
        let tabId: Int?
    }

    struct ExecuteTaskPayload: Encodable {
        let taskId: String
        let platform: String
        let action: String
        let payload: SendMessagePromptPayload
        let timeout: Int
    }

    struct SendMessagePromptPayload: Encodable {
        let prompt: String?
        let conversationId: String?
        let model: String?
    }

    struct NavigateToPlatformPayload: Encodable {
        let platform: String
    }

    struct APIErrorResponse: Decodable {
        let error: String
    }

    func invokePlugin<Payload: Encodable>(
        clientName: String,
        messageType: String,
        instanceId: String?,
        payload: Payload,
        timeoutMs: Int,
        notificationName: String,
        format: ResponseFormat,
        extraUserInfo: [String: String] = [:]
    ) {
        let requestBody = PluginInvokeRequest(
            messageType: messageType,
            instanceId: instanceId,
            payload: payload,
            timeoutMs: timeoutMs
        )

        guard let url = URL(string: "http://127.0.0.1:\(restPort)/api/v1/plugins/\(clientName)/invoke") else {
            postNotification(
                name: notificationName,
                dataString: "Error: Invalid REST URL",
                extraUserInfo: extraUserInfo
            )
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        do {
            request.httpBody = try JSONEncoder().encode(requestBody)
        } catch {
            postNotification(
                name: notificationName,
                dataString: "Error: Failed to encode request: \(error.localizedDescription)",
                extraUserInfo: extraUserInfo
            )
            return
        }

        BridgeLogger.shared.log("[LocalBridgeMac] invoking \(messageType) via Go REST for \(clientName)")

        session.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }

            if let error = error {
                self.postNotification(
                    name: notificationName,
                    dataString: "Error: \(error.localizedDescription)",
                    extraUserInfo: extraUserInfo
                )
                return
            }

            guard let httpResponse = response as? HTTPURLResponse else {
                self.postNotification(
                    name: notificationName,
                    dataString: "Error: Invalid HTTP response",
                    extraUserInfo: extraUserInfo
                )
                return
            }

            let responseData = data ?? Data()
            guard (200...299).contains(httpResponse.statusCode) else {
                let message = self.errorMessage(from: responseData) ?? "HTTP \(httpResponse.statusCode)"
                self.postNotification(
                    name: notificationName,
                    dataString: "Error: \(message)",
                    extraUserInfo: extraUserInfo
                )
                return
            }

            let dataString = self.formattedResponseString(from: responseData, format: format)
            self.postNotification(
                name: notificationName,
                dataString: dataString,
                extraUserInfo: extraUserInfo
            )
        }.resume()
    }

    func formattedResponseString(from data: Data, format: ResponseFormat) -> String {
        guard !data.isEmpty else {
            return "{}"
        }

        switch format {
        case .rawJSON:
            return String(data: data, encoding: .utf8) ?? "{}"
        case .prettyJSON:
            guard
                let object = try? JSONSerialization.jsonObject(with: data),
                let formatted = try? JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted]),
                let string = String(data: formatted, encoding: .utf8)
            else {
                return String(data: data, encoding: .utf8) ?? "{}"
            }
            return string
        }
    }

    func errorMessage(from data: Data) -> String? {
        if let decoded = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
            return decoded.error
        }
        return String(data: data, encoding: .utf8)
    }

    func postNotification(name: String, dataString: String, extraUserInfo: [String: String]) {
        DispatchQueue.main.async {
            var userInfo: [String: String] = ["dataString": dataString]
            for (key, value) in extraUserInfo {
                userInfo[key] = value
            }

            NotificationCenter.default.post(
                name: NSNotification.Name(name),
                object: nil,
                userInfo: userInfo
            )
        }
    }

    static func decodeGoDate(from decoder: Decoder) throws -> Date {
        let container = try decoder.singleValueContainer()
        let value = try container.decode(String.self)

        if let date = goDateFormatterWithFractionalSeconds.date(from: value) {
            return date
        }
        if let date = goDateFormatter.date(from: value) {
            return date
        }

        throw DecodingError.dataCorruptedError(
            in: container,
            debugDescription: "Invalid Go date string: \(value)"
        )
    }

    static let goDateFormatterWithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let goDateFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    var restPort: Int {
        let configured = UserDefaults.standard.integer(forKey: "restApiPort")
        return configured == 0 ? 10088 : configured
    }
}
