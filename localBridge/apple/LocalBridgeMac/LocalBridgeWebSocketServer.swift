import Foundation
import Network

class LocalBridgeWebSocketServer {
    private var listener: NWListener?
    private var httpListener: NWListener?
    private var connectedClient: NWConnection?
    
    // HTTP handling
    private var pendingHttpCallbacks: [String: (Data) -> Void] = [:]
    private var pendingUiRequests: Set<String> = []
    
    // Heartbeat monitoring
    private var lastPingReceived: Date?
    private var heartbeatTimer: Timer?
    
    // Server status
    var isRunning: Bool = false
    private var connectedClientName: String = "tweetClaw" // Defaults to tweetClaw
    
    func start() {
        let port: NWEndpoint.Port = 8765
        
        // Documented restriction: Use 127.0.0.1 for local development security.
        // We set requiredLocalEndpoint to bind to loopback if needed, 
        // but for now we prioritize loopback by checking interface if possible.
        
        do {
            let parameters = NWParameters.tcp
            let webSocketOptions = NWProtocolWebSocket.Options()
            webSocketOptions.autoReplyPing = true // Framework handles raw ping, but we use app-level ping
            
            parameters.defaultProtocolStack.applicationProtocols.insert(webSocketOptions, at: 0)
            
            // Simplified listener setup: bind to port directly.
            // Mac will default to 127.0.0.1 and other interfaces unless restricted.
            listener = try NWListener(using: parameters, on: port)
            
            listener?.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    print("[LocalBridgeMac] server started on port \(port)")
                    self.isRunning = true
                case .failed(let error):
                    print("[LocalBridgeMac] server failed with error: \(error)")
                    self.isRunning = false
                default:
                    break
                }
            }
            
            listener?.newConnectionHandler = { connection in
                self.handleNewConnection(connection)
            }
            
            // Start heartbeat timeout checker
            self.startHeartbeatTimer()
            
            listener?.start(queue: .main)
            
            // Start REST API server on 8769
            self.startHttpServer()
            
        } catch {
            print("[LocalBridgeMac] failed to start listener: \(error)")
        }
    }
    
    private func handleNewConnection(_ connection: NWConnection) {
        print("[LocalBridgeMac] client connecting...")
        
        // In Step 2, we just accept one connection
        if let oldConnection = connectedClient {
            print("[LocalBridgeMac] replacing old connection")
            oldConnection.cancel()
        }
        
        connectedClient = connection
        connection.stateUpdateHandler = { state in
            switch state {
            case .ready:
                print("[LocalBridgeMac] client connected")
                self.lastPingReceived = Date() // Initialize on connect
                self.receiveMessage(from: connection)
            case .failed(let error):
                print("[LocalBridgeMac] connection failed: \(error)")
                self.connectedClient = nil
            case .cancelled:
                print("[LocalBridgeMac] client disconnected")
                self.connectedClient = nil
            default:
                break
            }
        }
        connection.start(queue: .main)
    }
    
    private func receiveMessage(from connection: NWConnection) {
        connection.receiveMessage { (content, context, isComplete, error) in
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
                    self.connectedClientName = helloMsg.payload.clientName
                    print("[LocalBridgeMac] client identified as: \(self.connectedClientName)")
                }
                // Parse specifically if needed, but for now we just ack
                self.sendHelloAck(replyToId: peekMsg.id)
                
            case .ping:
                print("[LocalBridgeMac] received ping")
                self.sendPong(replyToId: peekMsg.id)
                self.lastPingReceived = Date()
                
            case .responseQueryXTabsStatus:
                print("[LocalBridgeMac] received response.query_x_tabs_status")
                self.handleQueryXTabsResponse(data: data)
                // Check if there is a pending HTTP caller for this request ID
                if let callback = self.pendingHttpCallbacks[peekMsg.id] {
                    callback(data)
                    self.pendingHttpCallbacks.removeValue(forKey: peekMsg.id)
                }
                self.pendingUiRequests.remove(peekMsg.id)

            case .responseQueryAITabsStatus:
                print("[LocalBridgeMac] received response.query_ai_tabs_status")
                self.handleQueryAITabsResponse(data: data)
                // Check if there is a pending HTTP caller for this request ID
                if let callback = self.pendingHttpCallbacks[peekMsg.id] {
                    callback(data)
                    self.pendingHttpCallbacks.removeValue(forKey: peekMsg.id)
                }
                self.pendingUiRequests.remove(peekMsg.id)

            case .responseQueryXBasicInfo:
                print("[LocalBridgeMac] received response.query_x_basic_info")
                self.handleQueryXBasicInfoResponse(data: data)
                // Check if there is a pending HTTP caller for this request ID
                if let callback = self.pendingHttpCallbacks[peekMsg.id] {
                    callback(data)
                    self.pendingHttpCallbacks.removeValue(forKey: peekMsg.id)
                }
                self.pendingUiRequests.remove(peekMsg.id)
                
            case .responseError:
                print("[LocalBridgeMac] received response.error")
                // Log error details if needed
                if self.pendingUiRequests.contains(peekMsg.id) {
                    self.pendingUiRequests.remove(peekMsg.id)
                    let errorMsg = "Error: Received response.error from extension"
                    NotificationCenter.default.post(name: NSNotification.Name("QueryXTabsStatusReceived"), object: nil, userInfo: ["dataString": errorMsg])
                    NotificationCenter.default.post(name: NSNotification.Name("QueryXBasicInfoReceived"), object: nil, userInfo: ["dataString": errorMsg])
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
    
    private func sendHelloAck(replyToId: String) {
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
            target: "tweetClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: payload
        )
        
        if let data = try? JSONEncoder().encode(ack),
           let jsonString = String(data: data, encoding: .utf8) {
            print("[LocalBridgeMac] sent server.hello_ack")
            self.sendMessage(jsonString)
        }
    }
    
    private func sendPong(replyToId: String) {
        let ack = BaseMessage(
            id: replyToId,
            type: .pong,
            source: "LocalBridgeMac",
            target: "tweetClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: EmptyPayload()
        )
        
        if let data = try? JSONEncoder().encode(ack),
           let jsonString = String(data: data, encoding: .utf8) {
            print("[LocalBridgeMac] sent pong")
            self.sendMessage(jsonString)
        }
    }
    
    func sendQueryXTabsStatus() {
        guard let connection = connectedClient, connection.state == .ready else {
            NotificationCenter.default.post(name: NSNotification.Name("QueryXTabsStatusReceived"), object: nil, userInfo: ["dataString": "Error: WebSocket is not connected"])
            return
        }

        let reqId = "req_\(Int(Date().timeIntervalSince1970))"
        let isAI = (self.connectedClientName == "aiClaw")
        
        let req = BaseMessage(
            id: reqId,
            type: isAI ? .requestQueryAITabsStatus : .requestQueryXTabsStatus,
            source: "LocalBridgeMac",
            target: isAI ? "aiClaw" : "tweetClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: EmptyPayload()
        )
        
        self.pendingUiRequests.insert(reqId)
        
        do {
            let data = try JSONEncoder().encode(req)
            if let jsonString = String(data: data, encoding: .utf8) {
                let reqName = isAI ? "request.query_ai_tabs_status" : "request.query_x_tabs_status"
                print("[LocalBridgeMac] sending \(reqName), id: \(reqId)")
                self.sendMessage(jsonString)
                
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
                NotificationCenter.default.post(name: NSNotification.Name("QueryXTabsStatusReceived"), object: nil, userInfo: ["dataString": formattedString])
            }
            
        } catch {
            print("[LocalBridgeMac] failed to decode AI response: \(error)")
            NotificationCenter.default.post(name: NSNotification.Name("QueryXTabsStatusReceived"), object: nil, userInfo: ["dataString": "Error decoding response:\n\(error.localizedDescription)"])
        }
    }
    
    func sendQueryXBasicInfo() {
        guard let connection = connectedClient, connection.state == .ready else {
            NotificationCenter.default.post(name: NSNotification.Name("QueryXBasicInfoReceived"), object: nil, userInfo: ["dataString": "Error: WebSocket is not connected"])
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
                self.sendMessage(jsonString)
                
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
            if let formattedData = try? encoder.encode(p),
               let formattedString = String(data: formattedData, encoding: .utf8) {
                NotificationCenter.default.post(name: NSNotification.Name("QueryXBasicInfoReceived"), object: nil, userInfo: ["dataString": formattedString])
            }
        } catch {
            print("[LocalBridgeMac] failed to decode response: \(error)")
            NotificationCenter.default.post(name: NSNotification.Name("QueryXBasicInfoReceived"), object: nil, userInfo: ["dataString": "Error decoding response:\n\(error.localizedDescription)"])
        }
    }
    
    // Heartbeat timeout logic
    private func startHeartbeatTimer() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { [weak self] _ in
            guard let self = self, let lastPing = self.lastPingReceived else { return }
            
            let now = Date()
            if now.timeIntervalSince(lastPing) > 60.0 {
                print("[LocalBridgeMac] heartbeat timeout, client considered offline")
                self.connectedClient?.cancel()
                self.connectedClient = nil
                self.lastPingReceived = nil
            }
        }
    }
    
    // Placeholder for sending messages
    func sendMessage(_ message: String) {
        guard let connection = connectedClient, connection.state == .ready else {
            print("[LocalBridgeMac] no active connection to send message")
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
                } else {
                    self.sendHttpResponse(connection, status: "404 Not Found", body: "{\"error\":\"not_found\"}")
                }
            } else {
                connection.cancel()
            }
        }
    }
    
    private func handleXStatusHttpRequest(_ connection: NWConnection) {
        guard let wsClient = connectedClient, wsClient.state == .ready else {
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"websocket_offline\"}")
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
            self.sendMessage(jsonString)
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
        guard let wsClient = connectedClient, wsClient.state == .ready else {
            sendHttpResponse(connection, status: "503 Service Unavailable", body: "{\"error\":\"websocket_offline\"}")
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
            self.sendMessage(jsonString)
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
}
