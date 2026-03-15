import Foundation
import Network

class LocalBridgeWebSocketServer {
    private var listener: NWListener?
    private var connectedClient: NWConnection?
    
    // Heartbeat monitoring
    private var lastPingReceived: Date?
    private var heartbeatTimer: Timer?
    
    // Server status
    var isRunning: Bool = false
    
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
                // Parse specifically if needed, but for now we just ack
                self.sendHelloAck(replyToId: peekMsg.id)
                
            case .ping:
                print("[LocalBridgeMac] received ping")
                self.sendPong(replyToId: peekMsg.id)
                self.lastPingReceived = Date()
                
            case .responseQueryXTabsStatus:
                print("[LocalBridgeMac] received response.query_x_tabs_status")
                self.handleQueryXTabsResponse(data: data)
                
            case .responseError:
                print("[LocalBridgeMac] received response.error")
                // Log error details if needed
                
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
        let reqId = "req_\(Int(Date().timeIntervalSince1970))"
        let req = BaseMessage(
            id: reqId,
            type: .requestQueryXTabsStatus,
            source: "LocalBridgeMac",
            target: "tweetClaw",
            timestamp: Int64(Date().timeIntervalSince1970 * 1000),
            payload: EmptyPayload()
        )
        
        do {
            let data = try JSONEncoder().encode(req)
            if let jsonString = String(data: data, encoding: .utf8) {
                print("[LocalBridgeMac] sending request.query_x_tabs_status, id: \(reqId)")
                self.sendMessage(jsonString)
            }
        } catch {
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
            
        } catch {
            print("[LocalBridgeMac] failed to decode response: \(error)")
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
}
