import Foundation
import Network


class LocalBridgeWebSocketServer {

    private static let defaultExecuteTaskTimeoutMs = 210_000

    private var listeners: [NWListener] = []
    private var httpListener: NWListener?
    
    // Manage multiple connections
    private var anonymousClients: [ObjectIdentifier: NWConnection] = [:]

    enum BridgeError: Error {
        case message(String)
        var messageText: String {
            switch self {
            case .message(let s): return s
            }
        }
    }
    
    // 单个客户端 Session 的元数据
    private struct ClientSession {
        let clientName: String
        let instanceId: String
        let instanceName: String?
        let connection: NWConnection
        let connectedAt: Date
        var lastSeenAt: Date
        var capabilities: [String]
        var clientVersion: String
        var xScreenName: String?   // 后续通过 query_x_basic_info 填充，暂时为 nil
    }

    /// 对外暴露的实例快照，不含内部 NWConnection 引用
    struct InstanceSnapshot {
        let clientName: String
        let instanceId: String
        let instanceName: String?
        let clientVersion: String
        let capabilities: [String]
        let connectedAt: Date
        let lastSeenAt: Date
        let xScreenName: String?
        let isTemporary: Bool   // instanceId 是否以 "tmp-" 开头（旧版扩展）
    }

    // 主索引：[clientName: [instanceId: ClientSession]]
    // 例如：["tweetClaw": ["uuid-aaa": session1, "uuid-bbb": session2]]
    private var sessions: [String: [String: ClientSession]] = [:]

    // 反向索引：连接对象 ID → (clientName, instanceId)，用于断线时快速清理
    private var connIdToKey: [ObjectIdentifier: (clientName: String, instanceId: String)] = [:]
    
    private var lastPingReceived: [String: Date] = [:]

    
    // HTTP handling
    private var pendingHttpCallbacks: [String: (Data) -> Void] = [:]
    private var pendingUiRequests: Set<String> = []
    private var pendingUiRequestTitles: [String: String] = [:]
    
    // Heartbeat monitoring
    private var heartbeatTimer: Timer?
    
    // Server status
    // Server status
    var isRunning: Bool = false
    
    /// 返回当前所有在线实例的快照列表，按 clientName + connectedAt 排序
    func getConnectedInstances() -> [InstanceSnapshot] {
        var result: [InstanceSnapshot] = []
        for (clientName, clientSessions) in sessions {
            for (instanceId, session) in clientSessions {
                result.append(InstanceSnapshot(
                    clientName: clientName,
                    instanceId: instanceId,
                    instanceName: session.instanceName,
                    clientVersion: session.clientVersion,
                    capabilities: session.capabilities,
                    connectedAt: session.connectedAt,
                    lastSeenAt: session.lastSeenAt,
                    xScreenName: session.xScreenName,
                    isTemporary: instanceId.hasPrefix("tmp-")
                ))
            }
        }
        return result.sorted {
            if $0.clientName != $1.clientName { return $0.clientName < $1.clientName }
            return $0.connectedAt < $1.connectedAt
        }
    }

    func start() {
        let defaults = UserDefaults.standard
        let ttPortInt = defaults.integer(forKey: "tweetClawPort")
        let tcpPortTT = ttPortInt > 0 ? UInt16(ttPortInt) : 10086
        
        let aiPortInt = defaults.integer(forKey: "aiClawPort")
        let tcpPortAI = aiPortInt > 0 ? UInt16(aiPortInt) : 10087
        
        var uniquePorts: Set<NWEndpoint.Port> = []
        if let ttP = NWEndpoint.Port(rawValue: tcpPortTT) { uniquePorts.insert(ttP) }
        if let aiP = NWEndpoint.Port(rawValue: tcpPortAI) { uniquePorts.insert(aiP) }

        for port in uniquePorts {
            do {
                let parameters = NWParameters.tcp
                let webSocketOptions = NWProtocolWebSocket.Options()
                webSocketOptions.autoReplyPing = true
                
                parameters.defaultProtocolStack.applicationProtocols.insert(webSocketOptions, at: 0)
                
                let listener = try NWListener(using: parameters, on: port)
                
                listener.stateUpdateHandler = { state in
                    switch state {
                    case .ready:
                        let msg = "[LocalBridgeMac] WebSocket listener started on port \(port)"
                        print(msg)
                        BridgeLogger.shared.log(msg)
                        self.isRunning = true
                    case .failed(let error):
                        print("[LocalBridgeMac] WebSocket listener failed with error: \(error)")
                    default:
                        break
                    }
                }
                
                listener.newConnectionHandler = { [weak self] connection in
                    self?.handleNewConnection(connection)
                }
                
                listener.start(queue: .main)
                self.listeners.append(listener)
            } catch {
                print("[LocalBridgeMac] failed to start WebSocket listener on \(port): \(error)")
            }
        }
        
        // Start heartbeat timeout checker
        self.startHeartbeatTimer()
        
        // Start REST API server on 10088
        self.startHttpServer()
    }
    
    func stop(completion: (() -> Void)? = nil) {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        
        for (_, clientSessions) in sessions {
            for (_, session) in clientSessions {
                session.connection.cancel()
            }
        }
        for (_, conn) in anonymousClients {
            conn.cancel()
        }
        
        sessions.removeAll()
        anonymousClients.removeAll()
        connIdToKey.removeAll()

        lastPingReceived.removeAll()
        pendingHttpCallbacks.removeAll()
        pendingUiRequests.removeAll()
        pendingUiRequestTitles.removeAll()
        
        isRunning = false
        
        // Count all listeners that need to cancel (ws listeners + http listener)
        var allListeners: [NWListener] = listeners
        if let http = httpListener {
            allListeners.append(http)
        }
        
        if allListeners.isEmpty {
            let msg = "[LocalBridgeMac] Server stopped and cleaned up."
            print(msg)
            BridgeLogger.shared.log(msg)
            completion?()
            return
        }
        
        var cancelledCount = 0
        let totalCount = allListeners.count
        
        for listener in allListeners {
            listener.stateUpdateHandler = { state in
                if case .cancelled = state {
                    cancelledCount += 1
                    if cancelledCount >= totalCount {
                        // Add a small safety delay for OS to fully release ports
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                            let msg = "[LocalBridgeMac] Server stopped and cleaned up."
                            print(msg)
                            BridgeLogger.shared.log(msg)
                            completion?()
                        }
                    }
                }
            }
            listener.cancel()
        }
        
        listeners.removeAll()
        httpListener = nil
        
        // Fallback timeout: if listeners don't cancel within 3 seconds, proceed anyway
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            if cancelledCount < totalCount {
                print("[LocalBridgeMac] Server stop timed out, proceeding anyway.")
                completion?()
            }
        }
    }
    
    private func handleNewConnection(_ connection: NWConnection) {
        let connId = ObjectIdentifier(connection)
        let msg = "[LocalBridgeMac] client connecting... [connId: \(connId)]"
        print(msg)
        BridgeLogger.shared.log(msg)
        
        anonymousClients[connId] = connection
        
        connection.stateUpdateHandler = { state in
            switch state {
            case .ready:
                let msg = "[LocalBridgeMac] client connected [connId: \(connId)]"
                print(msg)
                BridgeLogger.shared.log(msg)
                self.receiveMessage(from: connection)
            case .failed(let error):
                let msg = "[LocalBridgeMac] connection failed: \(error) [connId: \(connId)]"
                print(msg)
                BridgeLogger.shared.log(msg)
                self.removeConnection(connection)
            case .cancelled:
                let msg = "[LocalBridgeMac] client disconnected [connId: \(connId)]"
                print(msg)
                BridgeLogger.shared.log(msg)
                self.removeConnection(connection)
            default:
                break
            }
        }
        connection.start(queue: .main)
    }
    
    private func removeConnection(_ connection: NWConnection) {
        let connId = ObjectIdentifier(connection)
        anonymousClients.removeValue(forKey: connId)

        if let key = connIdToKey[connId] {
            // 只清理这一个实例，不影响同 clientName 下的其他 Profile
            sessions[key.clientName]?.removeValue(forKey: key.instanceId)

            // 如果该 clientName 下已无任何实例，清空外层 key
            if sessions[key.clientName]?.isEmpty == true {
                sessions.removeValue(forKey: key.clientName)
            }

            connIdToKey.removeValue(forKey: connId)
            lastPingReceived.removeValue(forKey: "\(key.clientName)/\(key.instanceId)")

            let msg = "[LocalBridgeMac] removed instance: \(key.clientName)/\(key.instanceId)"
            print(msg)
            BridgeLogger.shared.log(msg)
        }
    }

    /// 根据 clientName（和可选的 instanceId）找到对应连接
    /// 返回 .success(connection) 或 .failure(BridgeError)
    private func resolveConnection(clientName: String, instanceId: String? = nil) -> Result<NWConnection, BridgeError> {
        guard let clientSessions = sessions[clientName], !clientSessions.isEmpty else {
            return .failure(.message("\(clientName) extension is not connected or installed"))
        }

        // 1. 如果指定了 instanceId，精确匹配
        if let iid = instanceId {
            if let session = clientSessions[iid], session.connection.state == .ready {
                return .success(session.connection)
            } else {
                return .failure(.message("\(clientName) instance \(iid) not found or not ready"))
            }
        }

        // 2. 只有一个实例，直接用（保持原有单 Profile 行为）
        if clientSessions.count == 1, let session = clientSessions.values.first, session.connection.state == .ready {
            return .success(session.connection)
        }

        // 3. 多个实例且没有指定 → 报错，让调用方知道需要指定 instanceId
        let ids = clientSessions.keys.joined(separator: ", ")
        return .failure(.message("ambiguous_target: multiple \(clientName) instances connected [\(ids)]. Specify instanceId."))
    }

    
    private func receiveMessage(from connection: NWConnection) {
        connection.receiveMessage { [weak self] (content, context, isComplete, error) in
            guard let self = self else { return }
            
            if let error = error {
                let msg = "[LocalBridgeMac] receive error: \(error)"
                print(msg)
                BridgeLogger.shared.log(msg)
                return
            }
            
            if let data = content, !data.isEmpty {
                self.handleIncomingMessage(data: data, from: connection)
            }
            
            if error == nil {
                self.receiveMessage(from: connection)
            }
        }
    }
    
    private func handleIncomingMessage(data: Data, from connection: NWConnection) {
        print("[LocalBridgeMac] handling incoming message, size: \(data.count)")
        let decoder = JSONDecoder()
        do {
            // Use a lightweight peek to check message type without full payload decoding
            let peekMsg = try decoder.decode(PeekMessage.self, from: data)
            
            switch peekMsg.type {
            case .clientHello:
                let msg = "[LocalBridgeMac] received client.hello"
                print(msg)
                BridgeLogger.shared.log(msg)
                if let helloMsg = try? decoder.decode(BaseMessage<ClientHelloPayload>.self, from: data) {
                    let clientName = helloMsg.payload.clientName

                    // 如果扩展没有传 instanceId（旧版），自动生成一个临时 ID
                    // 临时 ID 带 "tmp-" 前缀，便于日志识别
                    let instanceId = helloMsg.payload.instanceId ?? "tmp-\(UUID().uuidString)"
                    let instanceName = helloMsg.payload.instanceName

                    let msg = "[LocalBridgeMac] client identified: \(clientName), instanceId: \(instanceId), instanceName: \(instanceName ?? "nil")"
                    print(msg)
                    BridgeLogger.shared.log(msg)
                    
                    let endpointInfoMsg = "[LocalBridgeMac] received endpoint information: client=\(clientName), instanceId=\(instanceId), instanceName=\(instanceName ?? "nil"), version=\(helloMsg.payload.clientVersion), capabilities=\(helloMsg.payload.capabilities)"
                    print(endpointInfoMsg)
                    BridgeLogger.shared.log(endpointInfoMsg)

                    let connId = ObjectIdentifier(connection)

                    // 只替换「同一个实例」的旧连接（同 clientName + 同 instanceId）
                    // 不同 instanceId 的连接互不影响
                    if let oldSession = sessions[clientName]?[instanceId] {
                        let msg = "[LocalBridgeMac] same instance reconnected, replacing old connection: \(clientName)/\(instanceId)"
                        print(msg)
                        BridgeLogger.shared.log(msg)
                        oldSession.connection.cancel()
                    }

                    // 构建新 Session
                    let newSession = ClientSession(
                        clientName: clientName,
                        instanceId: instanceId,
                        instanceName: instanceName,
                        connection: connection,
                        connectedAt: Date(),
                        lastSeenAt: Date(),
                        capabilities: helloMsg.payload.capabilities,
                        clientVersion: helloMsg.payload.clientVersion
                    )

                    // 写入主索引
                    if sessions[clientName] == nil { sessions[clientName] = [:] }
                    sessions[clientName]![instanceId] = newSession

                    // 写入反向索引
                    connIdToKey[connId] = (clientName: clientName, instanceId: instanceId)

                    // 从匿名连接池移除
                    anonymousClients.removeValue(forKey: connId)

                    // 更新心跳时间（用复合 key）
                    lastPingReceived["\(clientName)/\(instanceId)"] = Date()

                    self.sendHelloAck(connection, replyToId: peekMsg.id, target: clientName)
                }

                
            case .ping:
                let connId = ObjectIdentifier(connection)
                if let key = connIdToKey[connId] {
                    let pingKey = "\(key.clientName)/\(key.instanceId)"
                    self.lastPingReceived[pingKey] = Date()
                    self.sendPong(connection, replyToId: peekMsg.id, target: key.clientName)
                }

                
            case .responseQueryXTabsStatus:
                print("[LocalBridgeMac] received response.query_x_tabs_status")
                self.handleQueryXTabsResponse(data: data)
                if let callback = self.pendingHttpCallbacks[peekMsg.id] {
                    callback(data)
                    self.pendingHttpCallbacks.removeValue(forKey: peekMsg.id)
                }
                self.pendingUiRequests.remove(peekMsg.id)

            case .responseQueryAITabsStatus:
                print("[LocalBridgeMac] received response.query_ai_tabs_status")
                self.handleQueryAITabsResponse(data: data)
                if let callback = self.pendingHttpCallbacks[peekMsg.id] {
                    callback(data)
                    self.pendingHttpCallbacks.removeValue(forKey: peekMsg.id)
                }
                self.pendingUiRequests.remove(peekMsg.id)
                
            case .responseExecuteTaskResult:
                print("[LocalBridgeMac] received response.execute_task_result")
                self.handleExecuteTaskResponse(data: data)
                if let callback = self.pendingHttpCallbacks[peekMsg.id] {
                    callback(data)
                    self.pendingHttpCallbacks.removeValue(forKey: peekMsg.id)
                }
                self.pendingUiRequests.remove(peekMsg.id)
                self.pendingUiRequestTitles.removeValue(forKey: peekMsg.id)

            case .responseQueryXBasicInfo:
                print("[LocalBridgeMac] received response.query_x_basic_info")
                self.handleQueryXBasicInfoResponse(data: data)
                if let callback = self.pendingHttpCallbacks[peekMsg.id] {
                    callback(data)
                    self.pendingHttpCallbacks.removeValue(forKey: peekMsg.id)
                }
                self.pendingUiRequests.remove(peekMsg.id)
                
            case .responseOpenTab:
                print("[LocalBridgeMac] received response.open_tab")
                self.handleOpenTabResponse(data: data)
                if let callback = self.pendingHttpCallbacks[peekMsg.id] {
                    callback(data)
                    self.pendingHttpCallbacks.removeValue(forKey: peekMsg.id)
                }
                self.pendingUiRequests.remove(peekMsg.id)

            case .responseCloseTab:
                print("[LocalBridgeMac] received response.close_tab")
                self.handleCloseTabResponse(data: data)
                if let callback = self.pendingHttpCallbacks[peekMsg.id] {
                    callback(data)
                    self.pendingHttpCallbacks.removeValue(forKey: peekMsg.id)
                }
                self.pendingUiRequests.remove(peekMsg.id)
                
            case .responseNavigateTab:
                print("[LocalBridgeMac] received response.navigate_tab")
                self.handleNavigateTabResponse(data: data)
                if let callback = self.pendingHttpCallbacks[peekMsg.id] {
                    callback(data)
                    self.pendingHttpCallbacks.removeValue(forKey: peekMsg.id)
                }
                self.pendingUiRequests.remove(peekMsg.id)
                
            case .responseExecAction:
                print("[LocalBridgeMac] received response.exec_action")
                if let callback = self.pendingHttpCallbacks[peekMsg.id] {
                    callback(data)
                    self.pendingHttpCallbacks.removeValue(forKey: peekMsg.id)
                }
                
                // New: Handle UI notification
                if self.pendingUiRequests.contains(peekMsg.id) {
                    self.pendingUiRequests.remove(peekMsg.id)
                    let encoder = JSONEncoder()
                    encoder.outputFormatting = .prettyPrinted
                    if let resp = try? JSONDecoder().decode(BaseMessage<ExecActionResponsePayload>.self, from: data),
                       let formattedData = try? encoder.encode(resp.payload),
                       let formattedString = String(data: formattedData, encoding: .utf8) {
                        NotificationCenter.default.post(
                            name: NSNotification.Name("ExecActionReceived"),
                            object: nil,
                            userInfo: ["dataString": formattedString]
                        )
                    }
                }

            case .responseQueryHomeTimeline, .responseQueryTweetDetail, .responseQueryUserProfile, .responseQuerySearchTimeline:
                print("[LocalBridgeMac] received generic query response: \(peekMsg.type)")
                if let callback = self.pendingHttpCallbacks[peekMsg.id] {
                    callback(data)
                    self.pendingHttpCallbacks.removeValue(forKey: peekMsg.id)
                }
                
            case .responseError:
                print("[LocalBridgeMac] received response.error")
                if self.pendingUiRequests.contains(peekMsg.id) {
                    self.pendingUiRequests.remove(peekMsg.id)
                    let errorMsg = "Error: Received response.error from extension"
                    if let resultTitle = self.pendingUiRequestTitles.removeValue(forKey: peekMsg.id) {
                        NotificationCenter.default.post(name: NSNotification.Name("SendMessageReceived"), object: nil, userInfo: [
                            "dataString": errorMsg,
                            "resultTitle": resultTitle
                        ])
                    } else {
                        NotificationCenter.default.post(name: NSNotification.Name("QueryXTabsStatusReceived"), object: nil, userInfo: ["dataString": errorMsg])
                        NotificationCenter.default.post(name: NSNotification.Name("QueryXBasicInfoReceived"), object: nil, userInfo: ["dataString": errorMsg])
                    }
                }
                if let callback = self.pendingHttpCallbacks[peekMsg.id] {
                    callback(data)
                    self.pendingHttpCallbacks.removeValue(forKey: peekMsg.id)
                }
                
            default:
                print("[LocalBridgeMac] unhandled message type: \(peekMsg.type)")
            }
        } catch {
            print("[LocalBridgeMac] failed to decode message: \(error)")
        }
    }
    
    private func sendHelloAck(_ connection: NWConnection, replyToId: String, target: String) {
        let payload = ServerHelloAckPayload(
            protocolName: protocolName,
            protocolVersion: protocolVersion,
            serverName: "LocalBridgeMac",
            serverVersion: "0.1.0",
            heartbeatIntervalMs: 20000
        )
        
        let ack = BaseMessage(
            id: replyToId,
            type: .serverHelloAck,
            source: "LocalBridgeMac",
            target: target,
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: payload
        )
        
        if let data = try? JSONEncoder().encode(ack),
           let jsonString = String(data: data, encoding: .utf8) {
            let msg = "[LocalBridgeMac] sent server.hello_ack to \(target)"
            print(msg)
            BridgeLogger.shared.log(msg)    
            self.sendMessage(connection, jsonString)
        }
    }
    
    private func sendPong(_ connection: NWConnection, replyToId: String, target: String) {
        let ack = BaseMessage(
            id: replyToId,
            type: .pong,
            source: "LocalBridgeMac",
            target: target,
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: EmptyPayload()
        )
        
        if let data = try? JSONEncoder().encode(ack),
           let jsonString = String(data: data, encoding: .utf8) {
            self.sendMessage(connection, jsonString)
        }
    }
    
    func sendQueryXTabsStatus(instanceId: String? = nil) {
        let resolveResult = resolveConnection(clientName: "tweetClaw", instanceId: instanceId)
        guard case .success(let connection) = resolveResult else {
            if case .failure(let err) = resolveResult {
                let errMsg = err.messageText
                NotificationCenter.default.post(name: NSNotification.Name("QueryXTabsStatusReceived"), object: nil, userInfo: ["dataString": "Error: \(errMsg)"])
            }
            return
        }

        let reqId = "req_\(Int(Date().timeIntervalSince1970))"
        let req = BaseMessage(
            id: reqId,
            type: .requestQueryXTabsStatus,
            source: "LocalBridgeMac",
            target: "tweetClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: EmptyPayload()
        )
        
        self.pendingUiRequests.insert(reqId)
        
        do {
            let data = try JSONEncoder().encode(req)
            if let jsonString = String(data: data, encoding: .utf8) {
                let msg = "[LocalBridgeMac] sending request.query_x_tabs_status, id: \(reqId)"
                print(msg)
                BridgeLogger.shared.log(msg)
                self.sendMessage(connection, jsonString)
                
                DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
                    if self.pendingUiRequests.contains(reqId) {
                        self.pendingUiRequests.remove(reqId)
                        NotificationCenter.default.post(name: NSNotification.Name("QueryXTabsStatusReceived"), object: nil, userInfo: ["dataString": "Error: Query timeout after 5 seconds"])
                    }
                }
            }
        } catch {
            self.pendingUiRequests.remove(reqId)
            print("[LocalBridgeMac] failed to encode query request: \(error)")
        }
    }
    
    private func handleQueryXTabsResponse(data: Data) {
        let decoder = JSONDecoder()
        do {
            let resp = try decoder.decode(BaseMessage<QueryXTabsStatusResponsePayload>.self, from: data)
            let p = resp.payload
            
            print("[LocalBridgeMac] query_x_tabs_status success")
            print("[LocalBridgeMac] hasXTabs=\(p.hasXTabs)")
            print("[LocalBridgeMac] isLoggedIn=\(p.isLoggedIn)")
            print("[LocalBridgeMac] activeXTabId=\(String(describing: p.activeXTabId))")
            print("[LocalBridgeMac] activeXUrl=\(p.activeXUrl ?? "null")")
            
            let tabsInfo = p.tabs.map { "{tabId:\($0.tabId),url:\($0.url),active:\($0.active)}" }.joined(separator: ",")
            print("[LocalBridgeMac] tabs=[\(tabsInfo)]")
            
            // Format nice JSON string for UI text view
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            if let formattedData = try? encoder.encode(p),
               let formattedString = String(data: formattedData, encoding: .utf8) {
                NotificationCenter.default.post(name: NSNotification.Name("QueryXTabsStatusReceived"), object: nil, userInfo: ["dataString": formattedString])
            }
            
        } catch {
            print("[LocalBridgeMac] failed to decode response: \(error)")
            NotificationCenter.default.post(name: NSNotification.Name("QueryXTabsStatusReceived"), object: nil, userInfo: ["dataString": "Error decoding response:\n\(error.localizedDescription)"])
        }
    }
    
    private func handleQueryAITabsResponse(data: Data) {
        let decoder = JSONDecoder()
        do {
            let resp = try decoder.decode(BaseMessage<QueryAITabsStatusResponsePayload>.self, from: data)
            let p = resp.payload
            
            print("[LocalBridgeMac] query_ai_tabs_status success")
            print("[LocalBridgeMac] hasAITabs=\(p.hasAITabs)")
            
            let tabsInfo = p.tabs.map { "{tabId:\($0.tabId),platform:\($0.platform),url:\($0.url),active:\($0.active)}" }.joined(separator: ",")
            print("[LocalBridgeMac] tabs=[\(tabsInfo)]")
            
            // Format nice JSON string for UI text view
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            if let formattedData = try? encoder.encode(p),
               let formattedString = String(data: formattedData, encoding: .utf8) {
                NotificationCenter.default.post(name: NSNotification.Name("QueryAITabsStatusReceived"), object: nil, userInfo: ["dataString": formattedString])
            }
            
        } catch {
            print("[LocalBridgeMac] failed to decode AI response: \(error)")
            NotificationCenter.default.post(name: NSNotification.Name("QueryAITabsStatusReceived"), object: nil, userInfo: ["dataString": "Error decoding response:\n\(error.localizedDescription)"])
        }
    }
    
    
    func sendQueryAITabsStatus(instanceId: String? = nil) {
        let resolveResult = resolveConnection(clientName: "aiClaw", instanceId: instanceId)
        guard case .success(let connection) = resolveResult else {
            if case .failure(let err) = resolveResult {
                let errMsg = err.messageText
                NotificationCenter.default.post(name: NSNotification.Name("QueryAITabsStatusReceived"), object: nil, userInfo: ["dataString": "Error: \(errMsg)"])
            }
            return
        }

        let reqId = "req_ai_\(Int(Date().timeIntervalSince1970))"
        let req = BaseMessage(
            id: reqId,
            type: .requestQueryAITabsStatus,
            source: "LocalBridgeMac",
            target: "aiClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: EmptyPayload()
        )
        
        self.pendingUiRequests.insert(reqId)
        
        do {
            let data = try JSONEncoder().encode(req)
            if let jsonString = String(data: data, encoding: .utf8) {
                let msg = "[LocalBridgeMac] sending request.query_ai_tabs_status, id: \(reqId)"
                print(msg)
                BridgeLogger.shared.log(msg)
                self.sendMessage(connection, jsonString)
                
                DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
                    if self.pendingUiRequests.contains(reqId) {
                        self.pendingUiRequests.remove(reqId)
                        NotificationCenter.default.post(name: NSNotification.Name("QueryAITabsStatusReceived"), object: nil, userInfo: ["dataString": "Error: Query timeout after 5 seconds"])
                    }
                }
            }
        } catch {
            self.pendingUiRequests.remove(reqId)
            print("[LocalBridgeMac] failed to encode AI query request: \(error)")
        }
    }
    
    func sendSendMessage(platform: String, prompt: String, instanceId: String? = nil) {
        let resolveResult = resolveConnection(clientName: "aiClaw", instanceId: instanceId)
        guard case .success(let connection) = resolveResult else {
            if case .failure(let err) = resolveResult {
                let errMsg = err.messageText
                NotificationCenter.default.post(name: NSNotification.Name("SendMessageReceived"), object: nil, userInfo: [
                    "dataString": "Error: \(errMsg)",
                    "resultTitle": "Send Message Result"
                ])
            }
            return
        }

        let reqId = "req_msg_\(Int(Date().timeIntervalSince1970))"
        let taskId = "task_\(Int(Date().timeIntervalSince1970))"
        let timeoutMs = Self.defaultExecuteTaskTimeoutMs
        let payload = ExecuteTaskRequestPayload(
            taskId: taskId,
            platform: platform,
            action: "send_message",
            payload: SendMessagePromptPayload(prompt: prompt, conversationId: nil, model: nil),
            timeout: timeoutMs
        )
        
        let req = BaseMessage(
            id: reqId,
            type: .requestExecuteTask,
            source: "LocalBridgeMac",
            target: "aiClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: payload
        )
        
        self.pendingUiRequests.insert(reqId)
        self.pendingUiRequestTitles[reqId] = "Send Message Result"
        
        do {
            let data = try JSONEncoder().encode(req)
            if let jsonString = String(data: data, encoding: .utf8) {
                let msg = "[LocalBridgeMac] sending request.execute_task, id: \(reqId), taskId: \(taskId), timeoutMs: \(timeoutMs)"
                print(msg)
                BridgeLogger.shared.log(msg)
                self.sendMessage(connection, jsonString)
                
                DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) {
                    if self.pendingUiRequests.contains(reqId) {
                        self.pendingUiRequests.remove(reqId)
                        self.pendingUiRequestTitles.removeValue(forKey: reqId)
                        let seconds = timeoutMs / 1000
                        NotificationCenter.default.post(name: NSNotification.Name("SendMessageReceived"), object: nil, userInfo: [
                            "dataString": "Error: Request timeout after \(seconds) seconds",
                            "resultTitle": "Send Message Result"
                        ])
                    }
                }
            }
        } catch {
            self.pendingUiRequests.remove(reqId)
            self.pendingUiRequestTitles.removeValue(forKey: reqId)
            print("[LocalBridgeMac] failed to encode SendMessage request: \(error)")
        }
    }

    func sendNewConversation(platform: String, instanceId: String? = nil) {
        let resolveResult = resolveConnection(clientName: "aiClaw", instanceId: instanceId)
        guard case .success(let connection) = resolveResult else {
            if case .failure(let err) = resolveResult {
                let errMsg = err.messageText
                NotificationCenter.default.post(name: NSNotification.Name("SendMessageReceived"), object: nil, userInfo: [
                    "dataString": "Error: \(errMsg)",
                    "resultTitle": "New Conversation Result"
                ])
            }
            return
        }

        let reqId = "req_new_conv_\(Int(Date().timeIntervalSince1970))"
        let taskId = "task_new_conv_\(Int(Date().timeIntervalSince1970))"
        let timeoutMs = 30_000
        let payload = ExecuteTaskRequestPayload(
            taskId: taskId,
            platform: platform,
            action: "new_conversation",
            payload: SendMessagePromptPayload(prompt: nil, conversationId: nil, model: nil),
            timeout: timeoutMs
        )

        let req = BaseMessage(
            id: reqId,
            type: .requestExecuteTask,
            source: "LocalBridgeMac",
            target: "aiClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: payload
        )

        self.pendingUiRequests.insert(reqId)
        self.pendingUiRequestTitles[reqId] = "New Conversation Result"

        do {
            let data = try JSONEncoder().encode(req)
            if let jsonString = String(data: data, encoding: .utf8) {
                let msg = "[LocalBridgeMac] sending request.execute_task(new_conversation), id: \(reqId), taskId: \(taskId), timeoutMs: \(timeoutMs)"
                print(msg)
                BridgeLogger.shared.log(msg)
                self.sendMessage(connection, jsonString)

                DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) {
                    if self.pendingUiRequests.contains(reqId) {
                        self.pendingUiRequests.remove(reqId)
                        self.pendingUiRequestTitles.removeValue(forKey: reqId)
                        let seconds = timeoutMs / 1000
                        NotificationCenter.default.post(name: NSNotification.Name("SendMessageReceived"), object: nil, userInfo: [
                            "dataString": "Error: Request timeout after \(seconds) seconds",
                            "resultTitle": "New Conversation Result"
                        ])
                    }
                }
            }
        } catch {
            self.pendingUiRequests.remove(reqId)
            self.pendingUiRequestTitles.removeValue(forKey: reqId)
            print("[LocalBridgeMac] failed to encode new conversation request: \(error)")
        }
    }
    
    private func handleExecuteTaskResponse(data: Data) {
        let decoder = JSONDecoder()
        do {
            let resp = try decoder.decode(BaseMessage<ExecuteTaskResultPayload>.self, from: data)
            let p = resp.payload
            let resultTitle = self.pendingUiRequestTitles.removeValue(forKey: resp.id) ?? "Execute Task Result"
            
            print("[LocalBridgeMac] execute_task response received: success=\(p.success), taskId=\(p.taskId)")
            
            // Format nice JSON string for UI text view
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            if let formattedData = try? encoder.encode(p),
               let formattedString = String(data: formattedData, encoding: .utf8) {
                NotificationCenter.default.post(name: NSNotification.Name("SendMessageReceived"), object: nil, userInfo: [
                    "dataString": formattedString,
                    "resultTitle": resultTitle
                ])
            }
            
        } catch {
            print("[LocalBridgeMac] failed to decode SendMessage response: \(error)")
            NotificationCenter.default.post(name: NSNotification.Name("SendMessageReceived"), object: nil, userInfo: [
                "dataString": "Error decoding response:\n\(error.localizedDescription)",
                "resultTitle": "Execute Task Result"
            ])
        }
    }
    
    func sendQueryXBasicInfo(instanceId: String? = nil) {
        let resolveResult = resolveConnection(clientName: "tweetClaw", instanceId: instanceId)
        guard case .success(let connection) = resolveResult else {
            if case .failure(let err) = resolveResult {
                let errMsg = err.messageText
                NotificationCenter.default.post(name: NSNotification.Name("QueryXBasicInfoReceived"), object: nil, userInfo: ["dataString": "Error: \(errMsg)"])
            }
            return
        }

        let reqId = "req_basic_\(Int(Date().timeIntervalSince1970))"
        let req = BaseMessage(
            id: reqId,
            type: .requestQueryXBasicInfo,
            source: "LocalBridgeMac",
            target: "tweetClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: EmptyPayload()
        )
        
        self.pendingUiRequests.insert(reqId)
        
        do {
            let data = try JSONEncoder().encode(req)
            if let jsonString = String(data: data, encoding: .utf8) {
                print("[LocalBridgeMac] sending request.query_x_basic_info, id: \(reqId)")
                self.sendMessage(connection, jsonString)
                
                DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
                    if self.pendingUiRequests.contains(reqId) {
                        self.pendingUiRequests.remove(reqId)
                        NotificationCenter.default.post(name: NSNotification.Name("QueryXBasicInfoReceived"), object: nil, userInfo: ["dataString": "Error: Query timeout after 5 seconds"])
                    }
                }
            }
        } catch {
            self.pendingUiRequests.remove(reqId)
            print("[LocalBridgeMac] failed to encode query request: \(error)")
        }
    }
    
    private func handleQueryXBasicInfoResponse(data: Data) {
        let decoder = JSONDecoder()
        do {
            let resp = try decoder.decode(BaseMessage<QueryXBasicInfoResponsePayload>.self, from: data)
            let p = resp.payload
            
            print("[LocalBridgeMac] query_x_basic_info success")
            print("[LocalBridgeMac] isLoggedIn=\(p.isLoggedIn)")
            if let name = p.name { print("[LocalBridgeMac] name=\(name)") }
            if let screenName = p.screenName { print("[LocalBridgeMac] screenName=\(screenName)") }
            
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            if let data = try? encoder.encode(p),
               let formattedString = String(data: data, encoding: .utf8) {
                print("[LocalBridgeMac] query_x_basic_info payload: \(formattedString)")
                NotificationCenter.default.post(name: NSNotification.Name("QueryXBasicInfoReceived"), object: nil, userInfo: ["dataString": formattedString])
            }
        } catch {
            print("[LocalBridgeMac] failed to decode response: \(error)")
            NotificationCenter.default.post(name: NSNotification.Name("QueryXBasicInfoReceived"), object: nil, userInfo: ["dataString": "Error decoding response:\n\(error.localizedDescription)"])
        }
    }
    
    func sendOpenTab(path: String, instanceId: String? = nil) {
        let resolveResult = resolveConnection(clientName: "tweetClaw", instanceId: instanceId)
        guard case .success(let connection) = resolveResult else {
            if case .failure(let err) = resolveResult {
                let errMsg = err.messageText
                NotificationCenter.default.post(name: NSNotification.Name("OpenTabReceived"), object: nil, userInfo: ["dataString": "Error: \(errMsg)"])
            }
            return
        }

        let reqId = "req_open_\(Int(Date().timeIntervalSince1970))"
        let payload = OpenTabRequestPayload(path: path)
        let req = BaseMessage(
            id: reqId,
            type: .requestOpenTab,
            source: "LocalBridgeMac",
            target: "tweetClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: payload
        )
        
        self.pendingUiRequests.insert(reqId)
        
        if let data = try? JSONEncoder().encode(req), let jsonString = String(data: data, encoding: .utf8) {
            print("[LocalBridgeMac] sending request.open_tab, path: \(path)")
            self.sendMessage(connection, jsonString)
        }
    }
    
    private func handleOpenTabResponse(data: Data) {
        let decoder = JSONDecoder()
        do {
            let resp = try decoder.decode(BaseMessage<OpenTabResponsePayload>.self, from: data)
            let p = resp.payload
            
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            if let formattedData = try? encoder.encode(p),
               let formattedString = String(data: formattedData, encoding: .utf8) {
                NotificationCenter.default.post(name: NSNotification.Name("OpenTabReceived"), object: nil, userInfo: ["dataString": formattedString])
            }
        } catch {
            print("[LocalBridgeMac] failed to decode open_tab response: \(error)")
        }
    }

    func sendCloseTab(tabId: Int, instanceId: String? = nil) {
        let resolveResult = resolveConnection(clientName: "tweetClaw", instanceId: instanceId)
        guard case .success(let connection) = resolveResult else {
            if case .failure(let err) = resolveResult {
                let errMsg = err.messageText
                NotificationCenter.default.post(name: NSNotification.Name("CloseTabReceived"), object: nil, userInfo: ["dataString": "Error: \(errMsg)"])
            }
            return
        }

        let reqId = "req_close_\(Int(Date().timeIntervalSince1970))"
        let payload = CloseTabRequestPayload(tabId: tabId)
        let req = BaseMessage(
            id: reqId,
            type: .requestCloseTab,
            source: "LocalBridgeMac",
            target: "tweetClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: payload
        )
        
        self.pendingUiRequests.insert(reqId)
        
        if let data = try? JSONEncoder().encode(req), let jsonString = String(data: data, encoding: .utf8) {
            print("[LocalBridgeMac] sending request.close_tab, tabId: \(tabId)")
            self.sendMessage(connection, jsonString)
        }
    }
    
    private func handleCloseTabResponse(data: Data) {
        let decoder = JSONDecoder()
        do {
            let resp = try decoder.decode(BaseMessage<CloseTabResponsePayload>.self, from: data)
            let p = resp.payload
            
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            if let formattedData = try? encoder.encode(p),
               let formattedString = String(data: formattedData, encoding: .utf8) {
                NotificationCenter.default.post(name: NSNotification.Name("CloseTabReceived"), object: nil, userInfo: ["dataString": formattedString])
            }
                } catch {
            print("[LocalBridgeMac] failed to decode close_tab response: \(error)")
        }
    }
    
    func sendNavigateTab(tabId: Int?, path: String, instanceId: String? = nil) {
        let resolveResult = resolveConnection(clientName: "tweetClaw", instanceId: instanceId)
        guard case .success(let connection) = resolveResult else {
            if case .failure(let err) = resolveResult {
                let errMsg = err.messageText
                NotificationCenter.default.post(name: NSNotification.Name("NavigateTabReceived"), object: nil, userInfo: ["dataString": "Error: \(errMsg)"])
            }
            return
        }

        let reqId = "req_nav_\(Int(Date().timeIntervalSince1970))"
        let payload = NavigateTabRequestPayload(tabId: tabId, path: path)
        let req = BaseMessage(
            id: reqId,
            type: .requestNavigateTab,
            source: "LocalBridgeMac",
            target: "tweetClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: payload
        )
        
        self.pendingUiRequests.insert(reqId)
        
        if let data = try? JSONEncoder().encode(req), let jsonString = String(data: data, encoding: .utf8) {
            print("[LocalBridgeMac] sending request.navigate_tab, tabId: \(String(describing: tabId)), path: \(path)")
            self.sendMessage(connection, jsonString)
        }
    }
    
    func sendExecAction(action: String, tweetId: String?, userId: String?, tabId: Int?, text: String? = nil, instanceId: String? = nil) {
        let resolveResult = resolveConnection(clientName: "tweetClaw", instanceId: instanceId)
        guard case .success(let connection) = resolveResult else {
            if case .failure(let err) = resolveResult {
                let errMsg = err.messageText
                NotificationCenter.default.post(name: NSNotification.Name("ExecActionReceived"), object: nil, userInfo: ["dataString": "Error: \(errMsg)"])
            }
            return
        }
        
        let reqId = "ui_req_exec_\(Int(Date().timeIntervalSince1970))"
        let payload = ExecActionRequestPayload(
            action: action,
            tweetId: tweetId,
            userId: userId,
            tabId: tabId,
            text: text
        )
        
        let req = BaseMessage(
            id: reqId,
            type: .requestExecAction,
            source: "LocalBridgeMac",
            target: "tweetClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: payload
        )
        
        self.pendingUiRequests.insert(reqId)
        
        if let data = try? JSONEncoder().encode(req), let jsonString = String(data: data, encoding: .utf8) {
            let msg = "[LocalBridgeMac] sending request.exec_action via UI, action: \(action), id: \(reqId)"
            print(msg)
            BridgeLogger.shared.log(msg)
            self.sendMessage(connection, jsonString)
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) {
            if self.pendingUiRequests.contains(reqId) {
                print("[LocalBridgeMac] exec_action timeout for \(reqId)")
                self.pendingUiRequests.remove(reqId)
                NotificationCenter.default.post(
                    name: NSNotification.Name("ExecActionReceived"),
                    object: nil,
                    userInfo: ["dataString": "{\"error\":\"timeout\"}"]
                )
            }
        }
    }
    
    private func handleNavigateTabResponse(data: Data) {
        let decoder = JSONDecoder()
        do {
            let resp = try decoder.decode(BaseMessage<NavigateTabResponsePayload>.self, from: data)
            let p = resp.payload
            
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            if let formattedData = try? encoder.encode(p),
               let formattedString = String(data: formattedData, encoding: .utf8) {
                NotificationCenter.default.post(name: NSNotification.Name("NavigateTabReceived"), object: nil, userInfo: ["dataString": formattedString])
            }
        } catch {
            print("[LocalBridgeMac] failed to decode navigate_tab response: \(error)")
        }
    }
    
    // Heartbeat timeout logic
    private func startHeartbeatTimer() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            let now = Date()

            // 遍历所有 clientName 下的所有实例
            for (clientName, clientSessions) in self.sessions {
                for (instanceId, session) in clientSessions {
                    let pingKey = "\(clientName)/\(instanceId)"
                    if let lastPing = self.lastPingReceived[pingKey] {
                        if now.timeIntervalSince(lastPing) > 60.0 {
                            let msg = "[LocalBridgeMac] heartbeat timeout: \(clientName)/\(instanceId), disconnecting"
                            print(msg)
                            BridgeLogger.shared.log(msg)
                            session.connection.cancel()
                        }
                    }
                }
            }
        }

    }
    
    // Core message sender
    func sendMessage(_ connection: NWConnection, _ message: String) {
        guard connection.state == .ready else {
            print("[LocalBridgeMac] connection not ready to send message")
            return
        }
        
        let metadata = NWProtocolWebSocket.Metadata(opcode: .text)
        let context = NWConnection.ContentContext(identifier: "text", metadata: [metadata])
        
        connection.send(content: message.data(using: .utf8), contentContext: context, isComplete: true, completion: .contentProcessed({ error in
            if let error = error {
                print("[LocalBridgeMac] send error: \(error)")
            } else {
                // print("[LocalBridgeMac] sent message: \(message)")
            }
        }))
    }
    
    // MARK: - HTTP Server (REST API)
    
    private func startHttpServer() {
        let defaults = UserDefaults.standard
        let restPortInt = defaults.integer(forKey: "restApiPort")
        let tcpPortRest = restPortInt > 0 ? UInt16(restPortInt) : 10088

        
        guard let port = NWEndpoint.Port(rawValue: tcpPortRest) else {
            print("[LocalBridgeMac] invalid REST API port: \(tcpPortRest)")
            return
        }
        
        do {
            let parameters = NWParameters.tcp
            httpListener = try NWListener(using: parameters, on: port)
            httpListener?.newConnectionHandler = { connection in
                self.handleHttpConnection(connection)
            }
            httpListener?.start(queue: .main)
            let msg = "[LocalBridgeMac] HTTP REST server started on port \(port)"
            print(msg)
            BridgeLogger.shared.log(msg)
        } catch {
            print("[LocalBridgeMac] failed to start HTTP listener: \(error)")
        }
    }
    
    private func handleHttpConnection(_ connection: NWConnection) {
        connection.stateUpdateHandler = { state in
            if case .ready = state {
                self.receiveHttpRequest(from: connection)
            }
        }
        connection.start(queue: .main)
    }
    
    private func receiveHttpRequest(from connection: NWConnection) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { data, context, isComplete, error in
            if let data = data, let request = String(data: data, encoding: .utf8) {
                let parsedRequest = self.parseHTTPRequestTarget(from: data)
                // Support CORS preflight
                if request.hasPrefix("OPTIONS ") {
                    self.sendHttpResponse(connection, status: "204 No Content", body: "")
                    return
                }
                
                if request.contains("GET /api/v1/x/status") {
                    self.handleXStatusHttpRequest(connection)
                } else if request.contains("GET /api/v1/x/basic_info") {
                    self.handleXBasicInfoHttpRequest(connection)
                } else if request.contains("GET /api/v1/ai/status") {
                    self.handleAIStatusHttpRequest(connection)
                } else if request.contains("POST /api/v1/ai/message") {
                    self.handleSendMessageHttpRequest(connection, requestData: data)
                } else if request.contains("POST /api/v1/ai/new_conversation") {
                    self.handleNewConversationHttpRequest(connection, requestData: data)
                } else if request.contains("POST /tweetclaw/open-tab") {
                    self.handleOpenTabHttpRequest(connection, requestData: data)
                } else if request.contains("POST /tweetclaw/close-tab") {
                    self.handleCloseTabHttpRequest(connection, requestData: data)
                } else if request.contains("POST /tweetclaw/navigate-tab") {
                    self.handleNavigateTabHttpRequest(connection, requestData: data)
                } else if request.contains("POST /api/v1/x/likes") {
                    self.handleExecActionHttpRequest(connection, requestData: data, action: "like")
                } else if request.contains("POST /api/v1/x/retweets") {
                    self.handleExecActionHttpRequest(connection, requestData: data, action: "retweet")
                } else if request.contains("POST /api/v1/x/bookmarks") {
                    self.handleExecActionHttpRequest(connection, requestData: data, action: "bookmark")
                } else if request.contains("POST /api/v1/x/follows") {
                    self.handleExecActionHttpRequest(connection, requestData: data, action: "follow")
                } else if request.contains("POST /api/v1/x/unfollows") {
                    self.handleExecActionHttpRequest(connection, requestData: data, action: "unfollow")
                } else if request.contains("POST /api/v1/x/tweets") {
                    self.handleExecActionHttpRequest(connection, requestData: data, action: "post_tweet")
                } else if request.contains("POST /api/v1/x/replies") {
                    self.handleExecActionHttpRequest(connection, requestData: data, action: "reply_tweet")
                } else if request.contains("POST /api/v1/x/unlikes") {
                    self.handleExecActionHttpRequest(connection, requestData: data, action: "unlike")
                } else if request.contains("POST /api/v1/x/unretweets") {
                    self.handleExecActionHttpRequest(connection, requestData: data, action: "unretweet")
                } else if request.contains("POST /api/v1/x/unbookmarks") {
                    self.handleExecActionHttpRequest(connection, requestData: data, action: "unbookmark")
                } else if request.contains("DELETE /api/v1/x/mytweets") {
                    self.handleExecActionHttpRequest(connection, requestData: data, action: "delete_tweet")
                } else if let parsedRequest,
                          parsedRequest.method == "GET",
                          let tweetResource = self.parseTweetResourcePath(parsedRequest.path) {
                    if tweetResource.isRepliesCollection {
                        self.handleGenericQueryHttpRequest(
                            connection,
                            requestData: data,
                            type: .requestQueryTweetReplies,
                            parsedRequest: parsedRequest,
                            pathTweetId: tweetResource.tweetId
                        )
                    } else {
                        self.handleGenericQueryHttpRequest(
                            connection,
                            requestData: data,
                            type: .requestQueryTweet,
                            parsedRequest: parsedRequest,
                            pathTweetId: tweetResource.tweetId
                        )
                    }
                } else if let parsedRequest,
                          parsedRequest.method == "GET",
                          parsedRequest.path.hasPrefix("/api/v1/x/tweets/") {
                    self.sendHttpResponse(connection, status: "404 Not Found", body: "{\"error\":\"not_found\"}")
                } else if request.contains("GET /api/v1/x/timeline") {
                    self.handleGenericQueryHttpRequest(connection, requestData: data, type: .requestQueryHomeTimeline, parsedRequest: parsedRequest)
                } else if parsedRequest?.method == "GET", parsedRequest?.path == "/api/v1/x/tweets" {
                    // /api/v1/x/tweets?tweetId=xxx
                    self.handleGenericQueryHttpRequest(connection, requestData: data, type: .requestQueryTweetDetail, parsedRequest: parsedRequest)
                } else if request.contains("GET /api/v1/x/users") {
                    // /api/v1/x/users?screenName=xxx
                    self.handleGenericQueryHttpRequest(connection, requestData: data, type: .requestQueryUserProfile, parsedRequest: parsedRequest)
                } else if request.contains("GET /api/v1/x/search") {
                    self.handleGenericQueryHttpRequest(connection, requestData: data, type: .requestQuerySearchTimeline, parsedRequest: parsedRequest)
                } else if request.contains("GET /api/v1/x/instances") {
                    self.handleInstancesHttpRequest(connection)
                } else if request.contains("GET /api/v1/x/docs") {
                    self.handleApiDocsHttpRequest(connection)
                } else {
                    self.sendHttpResponse(connection, status: "404 Not Found", body: "{\"error\":\"not_found\"}")
                }
            } else {
                connection.cancel()
            }
        }
    }
    
    private func handleXStatusHttpRequest(_ connection: NWConnection) {
        let resolveResult = resolveConnection(clientName: "tweetClaw")
        guard case .success(let wsClient) = resolveResult else {
            var errorDetail = "tweetclaw_offline"
            if case .failure(let err) = resolveResult { errorDetail = err.messageText }
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"\(errorDetail)\"}")
            return
        }

        
        let reqId = "http_req_\(Int(Date().timeIntervalSince1970))"
        
        // Wait for WebSocket response
        self.pendingHttpCallbacks[reqId] = { responseData in
            // Extract the payload only to return to HTTP caller
            let decoder = JSONDecoder()
            if let resp = try? decoder.decode(BaseMessage<QueryXTabsStatusResponsePayload>.self, from: responseData) {
                if let bodyData = try? JSONEncoder().encode(resp.payload),
                   let body = String(data: bodyData, encoding: .utf8) {
                    self.sendHttpResponse(connection, status: "200 OK", body: body)
                    return
                }
            }
            self.sendHttpResponse(connection, status: "500 Internal Server Error", body: "{\"error\":\"decode_failed\"}")
        }
        
        // Trigger the WebSocket request
        let req = BaseMessage(
            id: reqId,
            type: .requestQueryXTabsStatus,
            source: "LocalBridgeMac",
            target: "tweetClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: EmptyPayload()
        )
        
        if let data = try? JSONEncoder().encode(req), let jsonString = String(data: data, encoding: .utf8) {
            self.sendMessage(wsClient, jsonString)
        }
        
        // Timeout handling for HTTP request
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
            if self.pendingHttpCallbacks[reqId] != nil {
                self.pendingHttpCallbacks.removeValue(forKey: reqId)
                self.sendHttpResponse(connection, status: "504 Gateway Timeout", body: "{\"error\":\"timeout\"}")
            }
        }
    }
    
    private func handleXBasicInfoHttpRequest(_ connection: NWConnection) {
        let resolveResult = resolveConnection(clientName: "tweetClaw")
        guard case .success(let wsClient) = resolveResult else {
            var errorDetail = "tweetclaw_offline"
            if case .failure(let err) = resolveResult { errorDetail = err.messageText }
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"\(errorDetail)\"}")
            return
        }


        
        let reqId = "http_req_basic_\(Int(Date().timeIntervalSince1970))"
        
        // Wait for WebSocket response
        self.pendingHttpCallbacks[reqId] = { responseData in
            // Extract the payload only to return to HTTP caller
            let decoder = JSONDecoder()
            if let resp = try? decoder.decode(BaseMessage<QueryXBasicInfoResponsePayload>.self, from: responseData) {
                if let bodyData = try? JSONEncoder().encode(resp.payload),
                   let body = String(data: bodyData, encoding: .utf8) {
                    self.sendHttpResponse(connection, status: "200 OK", body: body)
                    return
                }
            }
            self.sendHttpResponse(connection, status: "500 Internal Server Error", body: "{\"error\":\"decode_failed\"}")
        }
        
        // Trigger the WebSocket request
        let req = BaseMessage(
            id: reqId,
            type: .requestQueryXBasicInfo,
            source: "LocalBridgeMac",
            target: "tweetClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: EmptyPayload()
        )
        
        if let data = try? JSONEncoder().encode(req), let jsonString = String(data: data, encoding: .utf8) {
            self.sendMessage(wsClient, jsonString)
        }
        
        // Timeout handling for HTTP request
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
            if self.pendingHttpCallbacks[reqId] != nil {
                self.pendingHttpCallbacks.removeValue(forKey: reqId)
                self.sendHttpResponse(connection, status: "504 Gateway Timeout", body: "{\"error\":\"timeout\"}")
            }
        }
    }
    
    private func sendHttpResponse(_ connection: NWConnection, status: String, body: String) {
        var response = "HTTP/1.1 \(status)\r\n"
        response += "Content-Type: application/json\r\n"
        response += "Access-Control-Allow-Origin: *\r\n"
        response += "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS\r\n"
        response += "Access-Control-Allow-Headers: Content-Type\r\n"
        response += "Connection: close\r\n"
        response += "Content-Length: \(body.utf8.count)\r\n\r\n"
        response += body
        
        connection.send(content: response.data(using: .utf8), completion: .contentProcessed({ _ in
            connection.cancel()
        }))
    }
    
    private func handleAIStatusHttpRequest(_ connection: NWConnection) {
        let resolveResult = resolveConnection(clientName: "aiClaw")
        guard case .success(let wsClient) = resolveResult else {
            var errorDetail = "aiclaw_offline"
            if case .failure(let err) = resolveResult { errorDetail = err.messageText }
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"\(errorDetail)\"}")
            return
        }

        
        let reqId = "http_req_ai_\(Int(Date().timeIntervalSince1970))"
        
        self.pendingHttpCallbacks[reqId] = { responseData in
            let decoder = JSONDecoder()
            if let resp = try? decoder.decode(BaseMessage<QueryAITabsStatusResponsePayload>.self, from: responseData) {
                if let bodyData = try? JSONEncoder().encode(resp.payload),
                   let body = String(data: bodyData, encoding: .utf8) {
                    self.sendHttpResponse(connection, status: "200 OK", body: body)
                    return
                }
            }
            self.sendHttpResponse(connection, status: "500 Internal Server Error", body: "{\"error\":\"decode_failed\"}")
        }
        
        let req = BaseMessage(
            id: reqId,
            type: .requestQueryAITabsStatus,
            source: "LocalBridgeMac",
            target: "aiClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: EmptyPayload()
        )
        
        if let data = try? JSONEncoder().encode(req), let jsonString = String(data: data, encoding: .utf8) {
            self.sendMessage(wsClient, jsonString)
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
            if self.pendingHttpCallbacks[reqId] != nil {
                self.pendingHttpCallbacks.removeValue(forKey: reqId)
                self.sendHttpResponse(connection, status: "504 Gateway Timeout", body: "{\"error\":\"timeout\"}")
            }
        }
    }
    
    private func handleSendMessageHttpRequest(_ connection: NWConnection, requestData: Data) {
        let resolveResult = resolveConnection(clientName: "aiClaw")
        guard case .success(let wsClient) = resolveResult else {
            var errorDetail = "aiclaw_offline"
            if case .failure(let err) = resolveResult { errorDetail = err.messageText }
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"\(errorDetail)\"}")
            return
        }

        
        // Basic body parsing: look for platform and prompt in the raw data
        // Since the current HTTP server is very minimal, we'll try to decode the whole request data as JSON if it's just the body,
        // but it's likely the raw HTTP request.
        
        let requestString = String(data: requestData, encoding: .utf8) ?? ""
        let parts = requestString.components(separatedBy: "\r\n\r\n")
        guard parts.count > 1 else {
            sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":\"missing_body\"}")
            return
        }
        
        let bodyString = parts[1]
        guard let bodyData = bodyString.data(using: .utf8) else {
            sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":\"invalid_body_encoding\"}")
            return
        }
        
        do {
            // The user expects something like { "platform": "chatgpt", "prompt": "..." } or the full structure
            // Let's support a simple { "platform": "...", "prompt": "..." } for convenience
            struct SimpleMessageRequest: Codable {
                let platform: String
                let prompt: String
                let conversationId: String?
                let model: String?
                let timeoutMs: Int?
            }
            
            let simpleReq = try JSONDecoder().decode(SimpleMessageRequest.self, from: bodyData)
            
            let reqId = "http_req_msg_\(Int(Date().timeIntervalSince1970))"
            let timeoutMs = max(simpleReq.timeoutMs ?? Self.defaultExecuteTaskTimeoutMs, 1_000)
            
            self.pendingHttpCallbacks[reqId] = { responseData in
                let decoder = JSONDecoder()
                if let resp = try? decoder.decode(BaseMessage<ExecuteTaskResultPayload>.self, from: responseData) {
                    if let resBodyData = try? JSONEncoder().encode(resp.payload),
                       let resBody = String(data: resBodyData, encoding: .utf8) {
                        self.sendHttpResponse(connection, status: "200 OK", body: resBody)
                        return
                    }
                }
                self.sendHttpResponse(connection, status: "500 Internal Server Error", body: "{\"error\":\"decode_failed\"}")
            }
            
            let taskId = "task_api_\(Int(Date().timeIntervalSince1970))"
            let payload = ExecuteTaskRequestPayload(
                taskId: taskId,
                platform: simpleReq.platform,
                action: "send_message",
                payload: SendMessagePromptPayload(
                    prompt: simpleReq.prompt,
                    conversationId: simpleReq.conversationId,
                    model: simpleReq.model
                ),
                timeout: timeoutMs
            )
            
            let req = BaseMessage(
                id: reqId,
                type: .requestExecuteTask,
                source: "LocalBridgeMac",
                target: "aiClaw",
                timestamp: Int64(Date().timeIntervalSince1970 * 1000),
                payload: payload
            )
            
            if let data = try? JSONEncoder().encode(req), let jsonString = String(data: data, encoding: .utf8) {
                let msg = "[LocalBridgeMac] sending request.execute_task via REST, id: \(reqId), taskId: \(taskId), timeoutMs: \(timeoutMs)"
                print(msg)
                BridgeLogger.shared.log(msg)
                self.sendMessage(wsClient, jsonString)
            }
            
            DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) {
                if self.pendingHttpCallbacks[reqId] != nil {
                    self.pendingHttpCallbacks.removeValue(forKey: reqId)
                    let seconds = timeoutMs / 1000
                    self.sendHttpResponse(connection, status: "504 Gateway Timeout", body: "{\"error\":\"timeout\",\"details\":\"Request timeout after \(seconds) seconds\"}")
                }
            }
            
        } catch {
            sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":\"invalid_json\", \"details\": \"\(error.localizedDescription)\"}")
        }
    }

    private func handleNewConversationHttpRequest(_ connection: NWConnection, requestData: Data) {
        let resolveResult = resolveConnection(clientName: "aiClaw")
        guard case .success(let wsClient) = resolveResult else {
            var errorDetail = "aiclaw_offline"
            if case .failure(let err) = resolveResult { errorDetail = err.messageText }
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"\(errorDetail)\"}")
            return
        }


        let requestString = String(data: requestData, encoding: .utf8) ?? ""
        let parts = requestString.components(separatedBy: "\r\n\r\n")
        guard parts.count > 1 else {
            sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":\"missing_body\"}")
            return
        }

        let bodyString = parts[1]
        guard let bodyData = bodyString.data(using: .utf8) else {
            sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":\"invalid_body_encoding\"}")
            return
        }

        do {
            struct NewConversationRequest: Codable {
                let platform: String
                let model: String?
                let timeoutMs: Int?
            }

            let req = try JSONDecoder().decode(NewConversationRequest.self, from: bodyData)
            let reqId = "http_req_new_conv_\(Int(Date().timeIntervalSince1970))"
            let timeoutMs = max(req.timeoutMs ?? 30_000, 1_000)

            self.pendingHttpCallbacks[reqId] = { responseData in
                let decoder = JSONDecoder()
                if let resp = try? decoder.decode(BaseMessage<ExecuteTaskResultPayload>.self, from: responseData),
                   let resBodyData = try? JSONEncoder().encode(resp.payload),
                   let resBody = String(data: resBodyData, encoding: .utf8) {
                    self.sendHttpResponse(connection, status: "200 OK", body: resBody)
                    return
                }

                self.sendHttpResponse(connection, status: "500 Internal Server Error", body: "{\"error\":\"decode_failed\"}")
            }

            let taskId = "task_api_new_conv_\(Int(Date().timeIntervalSince1970))"
            let payload = ExecuteTaskRequestPayload(
                taskId: taskId,
                platform: req.platform,
                action: "new_conversation",
                payload: SendMessagePromptPayload(prompt: nil, conversationId: nil, model: req.model),
                timeout: timeoutMs
            )

            let wsReq = BaseMessage(
                id: reqId,
                type: .requestExecuteTask,
                source: "LocalBridgeMac",
                target: "aiClaw",
                timestamp: Int64(Date().timeIntervalSince1970 * 1000),
                payload: payload
            )

            if let data = try? JSONEncoder().encode(wsReq), let jsonString = String(data: data, encoding: .utf8) {
                let msg = "[LocalBridgeMac] sending request.execute_task(new_conversation) via REST, id: \(reqId), taskId: \(taskId), timeoutMs: \(timeoutMs)"
                print(msg)
                BridgeLogger.shared.log(msg)
                self.sendMessage(wsClient, jsonString)
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) {
                if self.pendingHttpCallbacks[reqId] != nil {
                    self.pendingHttpCallbacks.removeValue(forKey: reqId)
                    let seconds = timeoutMs / 1000
                    self.sendHttpResponse(connection, status: "504 Gateway Timeout", body: "{\"error\":\"timeout\",\"details\":\"Request timeout after \(seconds) seconds\"}")
                }
            }
        } catch {
            sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":\"invalid_json\", \"details\": \"\(error.localizedDescription)\"}")
        }
    }

    private func handleOpenTabHttpRequest(_ connection: NWConnection, requestData: Data) {
        let resolveResult = resolveConnection(clientName: "tweetClaw")
        guard case .success(let wsClient) = resolveResult else {
            var errorDetail = "tweetclaw_offline"
            if case .failure(let err) = resolveResult { errorDetail = err.messageText }
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"\(errorDetail)\"}")
            return
        }

        
        let requestString = String(data: requestData, encoding: .utf8) ?? ""
        let parts = requestString.components(separatedBy: "\r\n\r\n")
        guard parts.count > 1 else {
            sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":\"missing_body\"}")
            return
        }
        
        let bodyString = parts[1]
        guard let bodyData = bodyString.data(using: .utf8) else {
            sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":\"invalid_body_encoding\"}")
            return
        }
        
        do {
            let openReq = try JSONDecoder().decode(OpenTabRequestPayload.self, from: bodyData)
            let reqId = "http_req_open_\(Int(Date().timeIntervalSince1970))"
            
            self.pendingHttpCallbacks[reqId] = { responseData in
                let decoder = JSONDecoder()
                if let resp = try? decoder.decode(BaseMessage<OpenTabResponsePayload>.self, from: responseData) {
                    if let resBodyData = try? JSONEncoder().encode(resp.payload),
                       let resBody = String(data: resBodyData, encoding: .utf8) {
                        self.sendHttpResponse(connection, status: "200 OK", body: resBody)
                        return
                    }
                }
                self.sendHttpResponse(connection, status: "500 Internal Server Error", body: "{\"error\":\"decode_failed\"}")
            }
            
            let req = BaseMessage(
                id: reqId,
                type: .requestOpenTab,
                source: "LocalBridgeMac",
                target: "tweetClaw",
                timestamp: Int64(Date().timeIntervalSince1970 * 1000),
                payload: openReq
            )
            
            if let data = try? JSONEncoder().encode(req), let jsonString = String(data: data, encoding: .utf8) {
                self.sendMessage(wsClient, jsonString)
            }
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
                if self.pendingHttpCallbacks[reqId] != nil {
                    self.pendingHttpCallbacks.removeValue(forKey: reqId)
                    self.sendHttpResponse(connection, status: "504 Gateway Timeout", body: "{\"error\":\"timeout\"}")
                }
            }
        } catch {
            sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":\"invalid_json\", \"details\": \"\(error.localizedDescription)\"}")
        }
    }

    private func handleCloseTabHttpRequest(_ connection: NWConnection, requestData: Data) {
        let resolveResult = resolveConnection(clientName: "tweetClaw")
        guard case .success(let wsClient) = resolveResult else {
            var errorDetail = "tweetclaw_offline"
            if case .failure(let err) = resolveResult { errorDetail = err.messageText }
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"\(errorDetail)\"}")
            return
        }

        
        let requestString = String(data: requestData, encoding: .utf8) ?? ""
        let parts = requestString.components(separatedBy: "\r\n\r\n")
        guard parts.count > 1 else {
            sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":\"missing_body\"}")
            return
        }
        
        let bodyString = parts[1]
        guard let bodyData = bodyString.data(using: .utf8) else {
            sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":\"invalid_body_encoding\"}")
            return
        }
        
        do {
            let closeReq = try JSONDecoder().decode(CloseTabRequestPayload.self, from: bodyData)
            let reqId = "http_req_close_\(Int(Date().timeIntervalSince1970))"
            
            self.pendingHttpCallbacks[reqId] = { responseData in
                let decoder = JSONDecoder()
                if let resp = try? decoder.decode(BaseMessage<CloseTabResponsePayload>.self, from: responseData) {
                    if let resBodyData = try? JSONEncoder().encode(resp.payload),
                       let resBody = String(data: resBodyData, encoding: .utf8) {
                        self.sendHttpResponse(connection, status: "200 OK", body: resBody)
                        return
                    }
                }
                self.sendHttpResponse(connection, status: "500 Internal Server Error", body: "{\"error\":\"decode_failed\"}")
            }
            
            let req = BaseMessage(
                id: reqId,
                type: .requestCloseTab,
                source: "LocalBridgeMac",
                target: "tweetClaw",
                timestamp: Int64(Date().timeIntervalSince1970 * 1000),
                payload: closeReq
            )
            
            if let data = try? JSONEncoder().encode(req), let jsonString = String(data: data, encoding: .utf8) {
                self.sendMessage(wsClient, jsonString)
            }
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
                if self.pendingHttpCallbacks[reqId] != nil {
                    self.pendingHttpCallbacks.removeValue(forKey: reqId)
                    self.sendHttpResponse(connection, status: "504 Gateway Timeout", body: "{\"error\":\"timeout\"}")
                }
            }
        } catch {
            sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":\"invalid_json\", \"details\": \"\(error.localizedDescription)\"}")
        }
    }
    
    private func handleNavigateTabHttpRequest(_ connection: NWConnection, requestData: Data) {
        let resolveResult = resolveConnection(clientName: "tweetClaw")
        guard case .success(let wsClient) = resolveResult else {
            var errorDetail = "tweetclaw_offline"
            if case .failure(let err) = resolveResult { errorDetail = err.messageText }
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"\(errorDetail)\"}")
            return
        }

        
        let requestString = String(data: requestData, encoding: .utf8) ?? ""
        let parts = requestString.components(separatedBy: "\r\n\r\n")
        guard parts.count > 1 else {
            sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":\"missing_body\"}")
            return
        }
        
        let bodyString = parts[1]
        guard let bodyData = bodyString.data(using: .utf8) else {
            sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":\"invalid_body_encoding\"}")
            return
        }
        
        do {
            let navReq = try JSONDecoder().decode(NavigateTabRequestPayload.self, from: bodyData)
            let reqId = "http_req_nav_\(Int(Date().timeIntervalSince1970))"
            
            self.pendingHttpCallbacks[reqId] = { responseData in
                let decoder = JSONDecoder()
                if let resp = try? decoder.decode(BaseMessage<NavigateTabResponsePayload>.self, from: responseData) {
                    if let resBodyData = try? JSONEncoder().encode(resp.payload),
                       let resBody = String(data: resBodyData, encoding: .utf8) {
                        self.sendHttpResponse(connection, status: "200 OK", body: resBody)
                        return
                    }
                }
                self.sendHttpResponse(connection, status: "500 Internal Server Error", body: "{\"error\":\"decode_failed\"}")
            }
            
            let req = BaseMessage(
                id: reqId,
                type: .requestNavigateTab,
                source: "LocalBridgeMac",
                target: "tweetClaw",
                timestamp: Int64(Date().timeIntervalSince1970 * 1000),
                payload: navReq
            )
            
            if let data = try? JSONEncoder().encode(req), let jsonString = String(data: data, encoding: .utf8) {
                self.sendMessage(wsClient, jsonString)
            }
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
                if self.pendingHttpCallbacks[reqId] != nil {
                    self.pendingHttpCallbacks.removeValue(forKey: reqId)
                    self.sendHttpResponse(connection, status: "504 Gateway Timeout", body: "{\"error\":\"timeout\"}")
                }
            }
        } catch {
            sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":\"invalid_json\", \"details\": \"\(error.localizedDescription)\"}")
        }
    }

    private func handleExecActionHttpRequest(_ connection: NWConnection, requestData: Data, action: String) {
        let resolveResult = resolveConnection(clientName: "tweetClaw")
        guard case .success(let wsClient) = resolveResult else {
            var errorDetail = "tweetclaw_offline"
            if case .failure(let err) = resolveResult { errorDetail = err.messageText }
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"\(errorDetail)\"}")
            return
        }

        let requestString = String(data: requestData, encoding: .utf8) ?? ""
        let parts = requestString.components(separatedBy: "\r\n\r\n")
        
        // 解析 body
        var tweetId: String? = nil
        var userId: String? = nil
        var tabId: Int? = nil
        var text: String? = nil
        
        if parts.count > 1, let bodyData = parts[1].data(using: .utf8) {
            struct ActionRequest: Codable {
                let tweetId: String?
                let userId: String?
                let tabId: Int?
                let text: String?
            }
            if let decoded = try? JSONDecoder().decode(ActionRequest.self, from: bodyData) {
                tweetId = decoded.tweetId
                userId = decoded.userId
                tabId = decoded.tabId
                text = decoded.text
            }
        }
        
        let reqId = "http_req_exec_\(Int(Date().timeIntervalSince1970))"
        self.pendingHttpCallbacks[reqId] = { responseData in
            let decoder = JSONDecoder()
            if let resp = try? decoder.decode(BaseMessage<ExecActionResponsePayload>.self, from: responseData) {
                if let resBodyData = try? JSONEncoder().encode(resp.payload),
                   let resBody = String(data: resBodyData, encoding: .utf8) {
                    self.sendHttpResponse(connection, status: "200 OK", body: resBody)
                    return
                }
            }
            self.sendHttpResponse(connection, status: "500 Internal Server Error", body: "{\"error\":\"decode_failed\"}")
        }
        
        let payload = ExecActionRequestPayload(
            action: action,
            tweetId: tweetId,
            userId: userId,
            tabId: tabId,
            text: text
        )
        
        let req = BaseMessage(
            id: reqId,
            type: .requestExecAction,
            source: "LocalBridgeMac",
            target: "tweetClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: payload
        )
        
        if let data = try? JSONEncoder().encode(req), let jsonString = String(data: data, encoding: .utf8) {
            print("[LocalBridgeMac] sending request.exec_action via REST, action: \(action), id: \(reqId)")
            self.sendMessage(wsClient, jsonString)
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 15.0) {
            if self.pendingHttpCallbacks[reqId] != nil {
                self.pendingHttpCallbacks.removeValue(forKey: reqId)
                self.sendHttpResponse(connection, status: "504 Gateway Timeout", body: "{\"error\":\"timeout\"}")
            }
        }
    }

    private struct ParsedHTTPRequestTarget {
        let method: String
        let path: String
        let queryItems: [String: String]
    }

    private func parseHTTPRequestTarget(from requestData: Data) -> ParsedHTTPRequestTarget? {
        let requestString = String(data: requestData, encoding: .utf8) ?? ""
        let firstLine = requestString.components(separatedBy: "\r\n").first ?? ""
        let components = firstLine.components(separatedBy: " ")
        guard components.count >= 2 else { return nil }

        let method = components[0]
        let target = components[1]
        guard let urlComponents = URLComponents(string: "http://localhost\(target)") else {
            return nil
        }

        var queryItems: [String: String] = [:]
        for item in urlComponents.queryItems ?? [] {
            queryItems[item.name] = item.value ?? ""
        }

        return ParsedHTTPRequestTarget(
            method: method,
            path: urlComponents.path,
            queryItems: queryItems
        )
    }

    private func parseTweetResourcePath(_ path: String) -> (tweetId: String, isRepliesCollection: Bool)? {
        let prefix = "/api/v1/x/tweets/"
        guard path.hasPrefix(prefix) else { return nil }

        let suffix = String(path.dropFirst(prefix.count))
        let components = suffix.split(separator: "/", omittingEmptySubsequences: true)
        guard let first = components.first, !first.isEmpty else { return nil }

        let tweetId = String(first)
        if components.count == 1 {
            return (tweetId, false)
        }
        if components.count == 2, components[1] == "replies" {
            return (tweetId, true)
        }
        return nil
    }

    private func handleGenericQueryHttpRequest(
        _ connection: NWConnection,
        requestData: Data,
        type: MessageType,
        parsedRequest: ParsedHTTPRequestTarget? = nil,
        pathTweetId: String? = nil
    ) {
        let resolveResult = resolveConnection(clientName: "tweetClaw")
        guard case .success(let wsClient) = resolveResult else {
            var errorDetail = "tweetclaw_offline"
            if case .failure(let err) = resolveResult { errorDetail = err.messageText }
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"\(errorDetail)\"}")
            return
        }

        let parsedRequest = parsedRequest ?? parseHTTPRequestTarget(from: requestData)

        var tweetId: String? = pathTweetId
        var screenName: String? = nil
        var tabId: Int? = nil
        var cursor: String? = nil

        if let parsedRequest {
            if tweetId == nil { tweetId = parsedRequest.queryItems["tweetId"] }
            screenName = parsedRequest.queryItems["screenName"]
            cursor = parsedRequest.queryItems["cursor"]
            if let tabIdValue = parsedRequest.queryItems["tabId"] {
                tabId = Int(tabIdValue)
            }
        }

        let reqId = "http_req_query_\(Int(Date().timeIntervalSince1970))"
        self.pendingHttpCallbacks[reqId] = { responseData in
            // For B-Class, we just return the payload as raw text, let the caller handle it
            let decoder = JSONDecoder()
            if let generic = try? decoder.decode(GenericMessage.self, from: responseData) {
                if let bodyData = try? JSONEncoder().encode(generic.payload),
                   let body = String(data: bodyData, encoding: .utf8) {
                    self.sendHttpResponse(connection, status: "200 OK", body: body)
                    return
                }
            }
            self.sendHttpResponse(connection, status: "500 Internal Server Error", body: "{\"error\":\"decode_failed\"}")
        }

        if type == .requestQueryTweet && tweetId == nil {
            self.pendingHttpCallbacks.removeValue(forKey: reqId)
            self.sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":{\"code\":\"INVALID_ARGUMENT\",\"message\":\"tweetId is required\",\"details\":null}}")
            return
        } else if type == .requestQueryTweetReplies && tweetId == nil {
            self.pendingHttpCallbacks.removeValue(forKey: reqId)
            self.sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":{\"code\":\"INVALID_ARGUMENT\",\"message\":\"tweetId is required\",\"details\":null}}")
            return
        } else if type == .requestQueryTweetDetail && tweetId == nil {
            self.pendingHttpCallbacks.removeValue(forKey: reqId)
            self.sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":{\"code\":\"INVALID_ARGUMENT\",\"message\":\"tweetId is required\",\"details\":null}}")
            return
        } else if type == .requestQueryUserProfile && screenName == nil {
            self.pendingHttpCallbacks.removeValue(forKey: reqId)
            self.sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":{\"code\":\"INVALID_ARGUMENT\",\"message\":\"screenName is required\",\"details\":null}}")
            return
        }

        if type == .requestQueryTweet, let tid = tweetId {
            self.sendBaseMessage(wsClient, id: reqId, type: type, payload: QueryTweetRequestPayload(tweetId: tid, tabId: tabId))
        } else if type == .requestQueryTweetReplies, let tid = tweetId {
            print("[LocalBridgeMac] REST query tweet replies tweetId=\(tid) cursor=\(cursor ?? "<nil>") tabId=\(tabId.map(String.init) ?? "<nil>")")
            self.sendBaseMessage(wsClient, id: reqId, type: type, payload: QueryTweetRepliesRequestPayload(tweetId: tid, tabId: tabId, cursor: cursor))
        } else if type == .requestQueryTweetDetail, let tid = tweetId {
            self.sendBaseMessage(wsClient, id: reqId, type: type, payload: QueryTweetDetailRequestPayload(tweetId: tid, tabId: tabId))
        } else if type == .requestQueryUserProfile, let sn = screenName {
            self.sendBaseMessage(wsClient, id: reqId, type: type, payload: QueryUserProfileRequestPayload(screenName: sn, tabId: tabId))
        } else if type == .requestQuerySearchTimeline || type == .requestQueryHomeTimeline {
            self.sendBaseMessage(wsClient, id: reqId, type: type, payload: QuerySearchTimelineRequestPayload(tabId: tabId))
        } else {
            self.sendBaseMessage(wsClient, id: reqId, type: type, payload: EmptyPayload())
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 8.0) {
            if self.pendingHttpCallbacks[reqId] != nil {
                self.pendingHttpCallbacks.removeValue(forKey: reqId)
                self.sendHttpResponse(connection, status: "504 Gateway Timeout", body: "{\"error\":\"timeout\"}")
            }
        }
    }

    private func sendBaseMessage<T: Codable>(_ wsClient: NWConnection, id: String, type: MessageType, payload: T) {
        let req = BaseMessage(
            id: id,
            type: type,
            source: "LocalBridgeMac",
            target: "tweetClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: payload
        )
        if let data = try? JSONEncoder().encode(req), let jsonString = String(data: data, encoding: .utf8) {
            print("[LocalBridgeMac] sending \(type.rawValue) via REST, id: \(id)")
            self.sendMessage(wsClient, jsonString)
        }
    }

    private func handleInstancesHttpRequest(_ connection: NWConnection) {
        var result: [[String: Any]] = []
        let formatter = ISO8601DateFormatter()

        for (clientName, clientSessions) in sessions {
            guard clientName == "tweetClaw" else { continue }
            for (instanceId, session) in clientSessions {
                var item: [String: Any] = [
                    "clientName": clientName,
                    "instanceId": instanceId,
                    "connectedAt": formatter.string(from: session.connectedAt),
                    "lastSeenAt": formatter.string(from: session.lastSeenAt),
                    "clientVersion": session.clientVersion,
                    "capabilities": session.capabilities
                ]
                if let instanceName = session.instanceName {
                    item["instanceName"] = instanceName
                }
                if let screenName = session.xScreenName {
                    item["xScreenName"] = screenName
                }
                item["isTemporary"] = instanceId.hasPrefix("tmp-")
                result.append(item)
            }
        }

        if let data = try? JSONSerialization.data(withJSONObject: result),
           let body = String(data: data, encoding: .utf8) {
            sendHttpResponse(connection, status: "200 OK", body: body)
        } else {
            sendHttpResponse(connection, status: "500 Internal Server Error", body: "{\"error\":\"encode_failed\"}")
        }
    }

    private func handleApiDocsHttpRequest(_ connection: NWConnection) {
        var jsonString: String? = nil

        for url in apiDocsCandidateURLs() {
            if let data = try? Data(contentsOf: url) {
                jsonString = String(data: data, encoding: .utf8)
                print("[LocalBridgeMac] Loaded api_docs.json from \(url.path)")
                break
            }
        }

        if let body = jsonString {
            sendHttpResponse(connection, status: "200 OK", body: body)
        } else {
            let msg = "[LocalBridgeMac] Error: api_docs.json not found in any candidate location"
            print(msg)
            BridgeLogger.shared.log(msg)
            sendHttpResponse(connection, status: "500 Internal Server Error", body: "{\"error\":\"api_docs.json not found\"}")
        }
    }

    private func apiDocsCandidateURLs() -> [URL] {
        let fileManager = FileManager.default
        let currentDirectory = URL(fileURLWithPath: fileManager.currentDirectoryPath, isDirectory: true)
        let repoRoot = fileManager.homeDirectoryForCurrentUser
            .appendingPathComponent("aiwithblockchain/aihub/localBridge/apple", isDirectory: true)

        return [
            Bundle.main.url(forResource: "api_docs", withExtension: "json"),
            currentDirectory.appendingPathComponent("api_docs.json"),
            currentDirectory.appendingPathComponent("LocalBridgeMac/api_docs.json"),
            repoRoot.appendingPathComponent("LocalBridgeMac/api_docs.json")
        ].compactMap { $0 }
    }
}
