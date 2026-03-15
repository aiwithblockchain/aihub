import { BaseMessage, ClientHelloPayload, MESSAGE_TYPES, PROTOCOL_NAME, PROTOCOL_VERSION, ServerHelloAckPayload } from './ws-protocol';

export class LocalBridgeSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private heartbeatInterval: any = null;
  private serverInfo: ServerHelloAckPayload | null = null;
  private lastPongTimestamp = 0;
  
  public queryXTabsHandler: (() => Promise<any>) | null = null;
  public queryXBasicInfoHandler: (() => Promise<any>) | null = null;
  
  private readonly WS_URL = 'ws://127.0.0.1:8765/ws';
  
  constructor() {
    this.connect();
  }
  
  private isConnecting = false;
  
  public connect() {
    if (this.isConnecting) return;
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }
    
    this.isConnecting = true;
    console.log('[tweetClaw] websocket connecting...');
    
    try {
      this.ws = new WebSocket(this.WS_URL);
      
      this.ws.onopen = () => {
        console.log('[tweetClaw] websocket open');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.lastPongTimestamp = Date.now();
        this.sendHello();
      };
      
      this.ws.onclose = () => {
        console.log('[tweetClaw] websocket closed');
        this.isConnecting = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
      };
      
      this.ws.onerror = () => {
        // Use regular log to stay silent in Chrome extension error list
        console.log('[tweetClaw] connection notice: server offline');
        this.isConnecting = false;
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } catch (e) {
      console.log('[tweetClaw] initialization notice:', e);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }
  
  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    
    const delay = this.getReconnectDelay();
    console.log(`[tweetClaw] websocket reconnect scheduled in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
  
  private getReconnectDelay(): number {
    switch (this.reconnectAttempts) {
      case 0: return 1000;
      case 1: return 2000;
      case 2: return 5000;
      default: return 10000;
    }
  }
  
  private sendHello() {
    const hello: BaseMessage<ClientHelloPayload> = {
      id: `hello_${Date.now()}`,
      type: MESSAGE_TYPES.CLIENT_HELLO,
      source: 'tweetClaw',
      target: 'LocalBridgeMac',
      timestamp: Date.now(),
      payload: {
        protocolName: PROTOCOL_NAME,
        protocolVersion: PROTOCOL_VERSION,
        clientName: 'tweetClaw',
        clientVersion: '0.3.17',
        browser: 'chrome',
        capabilities: ['query_x_tabs_status', 'query_x_basic_info']
      }
    };
    this.send(hello);
  }
  
  private handleMessage(data: string) {
    try {
      const msg = JSON.parse(data) as BaseMessage;
      console.log(`[tweetClaw] received message: ${msg.type}`);
      
      switch (msg.type) {
        case MESSAGE_TYPES.SERVER_HELLO_ACK:
          this.handleHelloAck(msg as BaseMessage<ServerHelloAckPayload>);
          break;
        case MESSAGE_TYPES.PONG:
          console.log('[tweetClaw] received pong');
          this.lastPongTimestamp = Date.now();
          break;
        case MESSAGE_TYPES.REQUEST_QUERY_X_TABS_STATUS:
          this.handleQueryXTabsStatus(msg);
          break;
        case MESSAGE_TYPES.REQUEST_QUERY_X_BASIC_INFO:
          this.handleQueryXBasicInfo(msg);
          break;
        default:
          console.warn(`[tweetClaw] unknown message type: ${msg.type}`);
      }
    } catch (e) {
      console.error('[tweetClaw] failed to parse message:', e);
    }
  }
  
  private handleHelloAck(msg: BaseMessage<ServerHelloAckPayload>) {
    console.log('[tweetClaw] received server.hello_ack');
    this.serverInfo = msg.payload;
    this.startHeartbeat(msg.payload.heartbeatIntervalMs || 20000);
  }

  private async handleQueryXTabsStatus(req: BaseMessage) {
    console.log('[tweetClaw] handling request.query_x_tabs_status');
    if (!this.queryXTabsHandler) {
        console.error('[tweetClaw] no handler for query_x_tabs_status');
        return;
    }

    try {
        const result = await this.queryXTabsHandler();
        const resp: BaseMessage = {
            id: req.id,
            type: MESSAGE_TYPES.RESPONSE_QUERY_X_TABS_STATUS,
            source: 'tweetClaw',
            target: 'LocalBridgeMac',
            timestamp: Date.now(),
            payload: result
        };
        this.send(resp);
    } catch (e) {
        // Send an error response
        const errResp: BaseMessage = {
            id: req.id,
            type: MESSAGE_TYPES.RESPONSE_ERROR,
            source: 'tweetClaw',
            target: 'LocalBridgeMac',
            timestamp: Date.now(),
            payload: {
                code: 'INTERNAL_ERROR',
                message: e instanceof Error ? e.message : String(e),
                details: null
            }
        };
        this.send(errResp);
    }
  }

  private async handleQueryXBasicInfo(req: BaseMessage) {
    console.log('[tweetClaw] handling request.query_x_basic_info');
    if (!this.queryXBasicInfoHandler) {
        console.error('[tweetClaw] no handler for query_x_basic_info');
        return;
    }

    try {
        const result = await this.queryXBasicInfoHandler();
        const resp: BaseMessage = {
            id: req.id,
            type: MESSAGE_TYPES.RESPONSE_QUERY_X_BASIC_INFO,
            source: 'tweetClaw',
            target: 'LocalBridgeMac',
            timestamp: Date.now(),
            payload: result
        };
        this.send(resp);
    } catch (e) {
        // Send an error response
        const errResp: BaseMessage = {
            id: req.id,
            type: MESSAGE_TYPES.RESPONSE_ERROR,
            source: 'tweetClaw',
            target: 'LocalBridgeMac',
            timestamp: Date.now(),
            payload: {
                code: 'INTERNAL_ERROR',
                message: e instanceof Error ? e.message : String(e),
                details: null
            }
        };
        this.send(errResp);
    }
  }
  
  private startHeartbeat(interval: number) {
    this.stopHeartbeat();
    console.log(`[tweetClaw] starting heartbeat every ${interval}ms`);
    this.heartbeatInterval = setInterval(() => {
      // Check for timeout (60 seconds)
      const now = Date.now();
      if (this.lastPongTimestamp > 0 && now - this.lastPongTimestamp > 60000) {
        console.error('[tweetClaw] pong timeout, closing socket');
        this.ws?.close();
        return;
      }
      this.sendPing();
    }, interval);
  }
  
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  private sendPing() {
    const ping: BaseMessage = {
      id: `ping_${Date.now()}`,
      type: MESSAGE_TYPES.PING,
      source: 'tweetClaw',
      target: 'LocalBridgeMac',
      timestamp: Date.now(),
      payload: {
        heartbeatIntervalMs: 20000
      }
    };
    this.send(ping);
  }
  
  public send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      console.log(`[tweetClaw] sent message: ${msg.type}`);
    } else {
      console.warn(`[tweetClaw] cannot send message, socket status: ${this.ws?.readyState}`);
    }
  }
}
