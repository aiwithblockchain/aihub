import Foundation
import Network

class LocalBridgeWebSocketServer {
    private static let defaultExecuteTaskTimeoutMs = 210_000

    private var listeners: [NWListener] = []
    private var httpListener: NWListener?
    
    // Manage multiple connections
    private var anonymousClients: [ObjectIdentifier: NWConnection] = [:]
    private var activeClients: [String: NWConnection] = [:]
    private var connectionNames: [ObjectIdentifier: String] = [:]
    private var lastPingReceived: [String: Date] = [:]
    
    // HTTP handling
    private var pendingHttpCallbacks: [String: (Data) -> Void] = [:]
    private var pendingUiRequests: Set<String> = []
    private var pendingUiRequestTitles: [String: String] = [:]
    
    // Heartbeat monitoring
    private var heartbeatTimer: Timer?
    
    // Server status
    var isRunning: Bool = false
    
    func start() {
        let defaults = UserDefaults.standard
        let ttPortInt = defaults.integer(forKey: "tweetClawPort")
        let tcpPortTT = ttPortInt > 0 ? UInt16(ttPortInt) : 8765
        
        let aiPortInt = defaults.integer(forKey: "aiClawPort")
        let tcpPortAI = aiPortInt > 0 ? UInt16(aiPortInt) : 8766
        
        let portsToListen: [(String, NWEndpoint.Port)] = [
            ("tweetClaw", NWEndpoint.Port(rawValue: tcpPortTT)!),
            ("aiClaw", NWEndpoint.Port(rawValue: tcpPortAI)!)
        ]
        
        for (appName, port) in portsToListen {
            do {
                let parameters = NWParameters.tcp
                let webSocketOptions = NWProtocolWebSocket.Options()
                webSocketOptions.autoReplyPing = true
                
                parameters.defaultProtocolStack.applicationProtocols.insert(webSocketOptions, at: 0)
                
                let listener = try NWListener(using: parameters, on: port)
                
                listener.stateUpdateHandler = { state in
                    switch state {
                    case .ready:
                        print("[LocalBridgeMac] \(appName) listener started on port \(port)")
                        self.isRunning = true
                    case .failed(let error):
                        print("[LocalBridgeMac] \(appName) listener failed with error: \(error)")
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
                print("[LocalBridgeMac] failed to start \(appName) listener on \(port): \(error)")
            }
        }
        
        // Start heartbeat timeout checker
        self.startHeartbeatTimer()
        
        // Start REST API server on 8769
        self.startHttpServer()
    }
    
    func stop(completion: (() -> Void)? = nil) {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        
        for (_, conn) in activeClients {
            conn.cancel()
        }
        for (_, conn) in anonymousClients {
            conn.cancel()
        }
        
        activeClients.removeAll()
        anonymousClients.removeAll()
        connectionNames.removeAll()
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
            print("[LocalBridgeMac] Server stopped and cleaned up.")
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
                            print("[LocalBridgeMac] Server stopped and cleaned up.")
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
        print("[LocalBridgeMac] client connecting... [connId: \(connId)]")
        
        anonymousClients[connId] = connection
        
        connection.stateUpdateHandler = { state in
            switch state {
            case .ready:
                print("[LocalBridgeMac] client connected [connId: \(connId)]")
                self.receiveMessage(from: connection)
            case .failed(let error):
                print("[LocalBridgeMac] connection failed: \(error) [connId: \(connId)]")
                self.removeConnection(connection)
            case .cancelled:
                print("[LocalBridgeMac] client disconnected [connId: \(connId)]")
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
        
        if let name = connectionNames[connId] {
            activeClients.removeValue(forKey: name)
            connectionNames.removeValue(forKey: connId)
            lastPingReceived.removeValue(forKey: name)
            print("[LocalBridgeMac] removed registered client: \(name) [connId: \(connId)]")
        }
    }
    
    private func receiveMessage(from connection: NWConnection) {
        connection.receiveMessage { [weak self] (content, context, isComplete, error) in
            guard let self = self else { return }
            
            if let error = error {
                print("[LocalBridgeMac] receive error: \(error)")
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
                print("[LocalBridgeMac] received client.hello")
                if let helloMsg = try? decoder.decode(BaseMessage<ClientHelloPayload>.self, from: data) {
                    let clientName = helloMsg.payload.clientName
                    print("[LocalBridgeMac] client identified as: \(clientName)")
                    
                    let connId = ObjectIdentifier(connection)
                    
                    if let oldConnection = self.activeClients[clientName] {
                        print("[LocalBridgeMac] replacing old connection for \(clientName)")
                        oldConnection.cancel()
                    }
                    
                    self.activeClients[clientName] = connection
                    self.connectionNames[connId] = clientName
                    self.anonymousClients.removeValue(forKey: connId)
                    self.lastPingReceived[clientName] = Date()
                    
                    self.sendHelloAck(connection, replyToId: peekMsg.id, target: clientName)
                }
                
            case .ping:
                print("[LocalBridgeMac] received ping")
                let connId = ObjectIdentifier(connection)
                if let clientName = self.connectionNames[connId] {
                    self.lastPingReceived[clientName] = Date()
                    self.sendPong(connection, replyToId: peekMsg.id, target: clientName)
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
                self.pendingUiRequests.remove(peekMsg.id)
                
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
            print("[LocalBridgeMac] sent server.hello_ack to \(target)")
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
            print("[LocalBridgeMac] sent pong to \(target)")
            self.sendMessage(connection, jsonString)
        }
    }
    
    func sendQueryXTabsStatus() {
        guard let connection = activeClients["tweetClaw"], connection.state == .ready else {
            NotificationCenter.default.post(name: NSNotification.Name("QueryXTabsStatusReceived"), object: nil, userInfo: ["dataString": "Error: tweetClaw extension is not connected or installed"])
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
                print("[LocalBridgeMac] sending request.query_x_tabs_status, id: \(reqId)")
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
    
    
    func sendQueryAITabsStatus() {
        guard let connection = activeClients["aiClaw"], connection.state == .ready else {
            NotificationCenter.default.post(name: NSNotification.Name("QueryAITabsStatusReceived"), object: nil, userInfo: ["dataString": "Error: aiClaw extension is not connected or installed"])
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
                print("[LocalBridgeMac] sending request.query_ai_tabs_status, id: \(reqId)")
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
    
    func sendSendMessage(platform: String, prompt: String) {
        guard let connection = activeClients["aiClaw"], connection.state == .ready else {
            NotificationCenter.default.post(name: NSNotification.Name("SendMessageReceived"), object: nil, userInfo: [
                "dataString": "Error: aiClaw extension is not connected or installed",
                "resultTitle": "Send Message Result"
            ])
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
                print("[LocalBridgeMac] sending request.execute_task, id: \(reqId), taskId: \(taskId), timeoutMs: \(timeoutMs)")
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

    func sendNewConversation(platform: String) {
        guard platform == "chatgpt" else {
            NotificationCenter.default.post(name: NSNotification.Name("SendMessageReceived"), object: nil, userInfo: [
                "dataString": "Error: New conversation is currently supported only for chatgpt",
                "resultTitle": "New Conversation Result"
            ])
            return
        }

        guard let connection = activeClients["aiClaw"], connection.state == .ready else {
            NotificationCenter.default.post(name: NSNotification.Name("SendMessageReceived"), object: nil, userInfo: [
                "dataString": "Error: aiClaw extension is not connected or installed",
                "resultTitle": "New Conversation Result"
            ])
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
                print("[LocalBridgeMac] sending request.execute_task(new_conversation), id: \(reqId), taskId: \(taskId), timeoutMs: \(timeoutMs)")
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
    
    func sendQueryXBasicInfo() {
        guard let connection = activeClients["tweetClaw"], connection.state == .ready else {
            NotificationCenter.default.post(name: NSNotification.Name("QueryXBasicInfoReceived"), object: nil, userInfo: ["dataString": "Error: tweetClaw extension is not connected or installed"])
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
    
    func sendOpenTab(path: String) {
        guard let connection = activeClients["tweetClaw"], connection.state == .ready else {
            NotificationCenter.default.post(name: NSNotification.Name("OpenTabReceived"), object: nil, userInfo: ["dataString": "Error: tweetClaw extension is not connected"])
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

    func sendCloseTab(tabId: Int) {
        guard let connection = activeClients["tweetClaw"], connection.state == .ready else {
            NotificationCenter.default.post(name: NSNotification.Name("CloseTabReceived"), object: nil, userInfo: ["dataString": "Error: tweetClaw extension is not connected"])
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
    
    func sendNavigateTab(tabId: Int?, path: String) {
        guard let connection = activeClients["tweetClaw"], connection.state == .ready else {
            NotificationCenter.default.post(name: NSNotification.Name("NavigateTabReceived"), object: nil, userInfo: ["dataString": "Error: tweetClaw extension is not connected"])
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
            for (name, connection) in self.activeClients {
                if let lastPing = self.lastPingReceived[name] {
                    if now.timeIntervalSince(lastPing) > 60.0 {
                        print("[LocalBridgeMac] heartbeat timeout for \(name), client considered offline")
                        connection.cancel()
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
        let port: NWEndpoint.Port = 8769
        do {
            let parameters = NWParameters.tcp
            httpListener = try NWListener(using: parameters, on: port)
            httpListener?.newConnectionHandler = { connection in
                self.handleHttpConnection(connection)
            }
            httpListener?.start(queue: .main)
            print("[LocalBridgeMac] HTTP REST server started on port \(port)")
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
        connection.receive(minimumIncompleteLength: 1, maximumLength: 1024) { data, context, isComplete, error in
            if let data = data, let request = String(data: data, encoding: .utf8) {
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
                } else {
                    self.sendHttpResponse(connection, status: "404 Not Found", body: "{\"error\":\"not_found\"}")
                }
            } else {
                connection.cancel()
            }
        }
    }
    
    private func handleXStatusHttpRequest(_ connection: NWConnection) {
        guard let wsClient = activeClients["tweetClaw"], wsClient.state == .ready else {
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"tweetclaw_offline\"}")
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
        guard let wsClient = activeClients["tweetClaw"], wsClient.state == .ready else {
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"tweetclaw_offline\"}")
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
        let response = "HTTP/1.1 \(status)\r\nContent-Type: application/json\r\nConnection: close\r\nContent-Length: \(body.count)\r\n\r\n\(body)"
        connection.send(content: response.data(using: .utf8), completion: .contentProcessed({ _ in
            connection.cancel()
        }))
    }
    
    private func handleAIStatusHttpRequest(_ connection: NWConnection) {
        guard let wsClient = activeClients["aiClaw"], wsClient.state == .ready else {
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"aiclaw_offline\"}")
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
        guard let wsClient = activeClients["aiClaw"], wsClient.state == .ready else {
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"aiclaw_offline\"}")
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
                print("[LocalBridgeMac] sending request.execute_task via REST, id: \(reqId), taskId: \(taskId), timeoutMs: \(timeoutMs)")
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
        guard let wsClient = activeClients["aiClaw"], wsClient.state == .ready else {
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"aiclaw_offline\"}")
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
            guard req.platform == "chatgpt" else {
                sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":\"unsupported_platform\",\"details\":\"new_conversation currently supports only chatgpt\"}")
                return
            }
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
                print("[LocalBridgeMac] sending request.execute_task(new_conversation) via REST, id: \(reqId), taskId: \(taskId), timeoutMs: \(timeoutMs)")
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
        guard let wsClient = activeClients["tweetClaw"], wsClient.state == .ready else {
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"tweetclaw_offline\"}")
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
        guard let wsClient = activeClients["tweetClaw"], wsClient.state == .ready else {
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"tweetclaw_offline\"}")
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
        guard let wsClient = activeClients["tweetClaw"], wsClient.state == .ready else {
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"tweetclaw_offline\"}")
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
        guard let wsClient = activeClients["tweetClaw"], wsClient.state == .ready else {
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"tweetclaw_offline\"}")
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
            struct ActionRequest: Codable {
                let tweetId: String?
                let userId: String?
                let tabId: Int?
            }
            
            let actionReq = try JSONDecoder().decode(ActionRequest.self, from: bodyData)
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
                tweetId: actionReq.tweetId,
                userId: actionReq.userId,
                tabId: actionReq.tabId
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
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) {
                if self.pendingHttpCallbacks[reqId] != nil {
                    self.pendingHttpCallbacks.removeValue(forKey: reqId)
                    self.sendHttpResponse(connection, status: "504 Gateway Timeout", body: "{\"error\":\"timeout\"}")
                }
            }
        } catch {
            sendHttpResponse(connection, status: "400 Bad Request", body: "{\"error\":\"invalid_json\", \"details\": \"\(error.localizedDescription)\"}")
        }
    }
}
