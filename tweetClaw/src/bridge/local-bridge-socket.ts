import { BaseMessage, ClientHelloPayload, MESSAGE_TYPES, PROTOCOL_NAME, PROTOCOL_VERSION, ServerHelloAckPayload } from './ws-protocol';
import { getOrCreateInstanceId } from './instance-id';

export class LocalBridgeSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private heartbeatInterval: any = null;
  private serverInfo: ServerHelloAckPayload | null = null;
  private lastPongTimestamp = 0;
  private instanceId: string = '';
  
  public queryXTabsHandler: (() => Promise<any>) | null = null;
  public queryXBasicInfoHandler: (() => Promise<any>) | null = null;
  public openTabHandler: ((payload: any) => Promise<any>) | null = null;
  public closeTabHandler: ((payload: any) => Promise<any>) | null = null;
  public navigateTabHandler: ((payload: any) => Promise<any>) | null = null;
  public execActionHandler: ((payload: any) => Promise<any>) | null = null;
  public queryHomeTimelineHandler: ((payload: any) => Promise<any>) | null = null;
  public queryTweetDetailHandler: ((payload: any) => Promise<any>) | null = null;
  public queryUserProfileHandler: ((payload: any) => Promise<any>) | null = null;
  public querySearchTimelineHandler: ((payload: any) => Promise<any>) | null = null;
  
  private WS_URL = 'ws://127.0.0.1:10086/ws'; // Default
  
  constructor() {
    this.connect();
  }

  // ── Public status accessors (used by popup) ──────────────────────
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public getServerInfo(): ServerHelloAckPayload | null {
    return this.serverInfo;
  }

  public getCurrentUrl(): string {
    return this.WS_URL;
  }
  
  public reconnect(host: string, port: number) {
    console.log(`[tweetClaw] reconnecting to ${host}:${port}`);
    this.WS_URL = `ws://${host}:${port}/ws`;
    this.isConnecting = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // prevent standard reconnect loop
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
    this.connect();
  }
  
  private isConnecting = false;
  
  public async connect() {
    if (this.isConnecting) return;
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }
    
    // Check dynamic host and port
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const res = await chrome.storage.local.get(['wsHost', 'wsPort']);
        const host = res.wsHost || '127.0.0.1';
        const port = res.wsPort || 10086;
        this.WS_URL = `ws://${host}:${port}/ws`;
      }
    } catch (e) {
      console.warn('[tweetClaw] failed to get dynamic config', e);
    }
    
    this.isConnecting = true;
    console.log(`[tweetClaw] websocket connecting to ${this.WS_URL}...`);
    
    try {
      this.ws = new WebSocket(this.WS_URL);
      
      this.ws.onopen = async () => {
        console.log('[tweetClaw] websocket open');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.lastPongTimestamp = Date.now();
        // 确保 instanceId 已加载（同一 Profile 内多次重连复用同一个值）
        if (!this.instanceId) {
            this.instanceId = await getOrCreateInstanceId();
        }
        this.sendHello();
      };
      
      this.ws.onclose = () => {
        console.log('[tweetClaw] websocket closed');
        this.isConnecting = false;
        this.serverInfo = null;
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
        capabilities: ['query_x_tabs_status', 'query_x_basic_info'],
        instanceId: this.instanceId || undefined,           // 新增
        incognito: chrome.extension.inIncognitoContext      // 新增
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
        case MESSAGE_TYPES.REQUEST_OPEN_TAB:
          this.handleOpenTab(msg);
          break;
        case MESSAGE_TYPES.REQUEST_CLOSE_TAB:
          this.handleCloseTab(msg);
          break;
        case MESSAGE_TYPES.REQUEST_NAVIGATE_TAB:
          this.handleNavigateTab(msg);
          break;
        case MESSAGE_TYPES.REQUEST_EXEC_ACTION:
          this.handleExecAction(msg);
          break;
        case MESSAGE_TYPES.REQUEST_QUERY_HOME_TIMELINE:
          this.handleGenericQuery(msg, this.queryHomeTimelineHandler, MESSAGE_TYPES.RESPONSE_QUERY_HOME_TIMELINE);
          break;
        case MESSAGE_TYPES.REQUEST_QUERY_TWEET_DETAIL:
          this.handleGenericQuery(msg, this.queryTweetDetailHandler, MESSAGE_TYPES.RESPONSE_QUERY_TWEET_DETAIL);
          break;
        case MESSAGE_TYPES.REQUEST_QUERY_USER_PROFILE:
          this.handleGenericQuery(msg, this.queryUserProfileHandler, MESSAGE_TYPES.RESPONSE_QUERY_USER_PROFILE);
          break;
        case MESSAGE_TYPES.REQUEST_QUERY_SEARCH_TIMELINE:
          this.handleGenericQuery(msg, this.querySearchTimelineHandler, MESSAGE_TYPES.RESPONSE_QUERY_SEARCH_TIMELINE);
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

  private async handleOpenTab(req: BaseMessage) {
    console.log('[tweetClaw] handling request.open_tab');
    if (!this.openTabHandler) {
      console.error('[tweetClaw] no handler for open_tab');
      return;
    }

    try {
      const result = await this.openTabHandler(req.payload);
      const resp: BaseMessage = {
        id: req.id,
        type: MESSAGE_TYPES.RESPONSE_OPEN_TAB,
        source: 'tweetClaw',
        target: 'LocalBridgeMac',
        timestamp: Date.now(),
        payload: result
      };
      this.send(resp);
    } catch (e) {
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

  private async handleCloseTab(req: BaseMessage) {
    console.log('[tweetClaw] handling request.close_tab');
    if (!this.closeTabHandler) {
      console.error('[tweetClaw] no handler for close_tab');
      return;
    }

    try {
      const result = await this.closeTabHandler(req.payload);
      const resp: BaseMessage = {
        id: req.id,
        type: MESSAGE_TYPES.RESPONSE_CLOSE_TAB,
        source: 'tweetClaw',
        target: 'LocalBridgeMac',
        timestamp: Date.now(),
        payload: result
      };
      this.send(resp);
    } catch (e) {
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

  private async handleNavigateTab(req: BaseMessage) {
    console.log('[tweetClaw] handling request.navigate_tab');
    if (!this.navigateTabHandler) {
      console.error('[tweetClaw] no handler for navigate_tab');
      return;
    }

    try {
      const result = await this.navigateTabHandler(req.payload);
      const resp: BaseMessage = {
        id: req.id,
        type: MESSAGE_TYPES.RESPONSE_NAVIGATE_TAB,
        source: 'tweetClaw',
        target: 'LocalBridgeMac',
        timestamp: Date.now(),
        payload: result
      };
      this.send(resp);
    } catch (e) {
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

  private async handleExecAction(req: BaseMessage) {
    console.log('[tweetClaw] handling request.exec_action');
    if (!this.execActionHandler) {
      console.error('[tweetClaw] no handler for exec_action');
      return;
    }

    try {
      const result = await this.execActionHandler(req.payload);
      const resp: BaseMessage = {
        id: req.id,
        type: MESSAGE_TYPES.RESPONSE_EXEC_ACTION,
        source: 'tweetClaw',
        target: 'LocalBridgeMac',
        timestamp: Date.now(),
        payload: result
      };
      this.send(resp);
    } catch (e) {
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

  private async handleGenericQuery(
      req: BaseMessage,
      handler: ((payload: any) => Promise<any>) | null,
      responseType: string
  ): Promise<void> {
      if (!handler) {
          console.error(`[tweetClaw] no handler for ${responseType}`);
          this.send({
              id: req.id,
              type: MESSAGE_TYPES.RESPONSE_ERROR,
              source: 'tweetClaw',
              target: 'LocalBridgeMac',
              timestamp: Date.now(),
              payload: { code: 'INTERNAL_ERROR', message: 'Handler not registered', details: null }
          });
          return;
      }
      try {
          const result = await handler(req.payload);
          this.send({
              id: req.id,
              type: responseType,
              source: 'tweetClaw',
              target: 'LocalBridgeMac',
              timestamp: Date.now(),
              payload: result
          });
      } catch (e: any) {
          this.send({
              id: req.id,
              type: MESSAGE_TYPES.RESPONSE_ERROR,
              source: 'tweetClaw',
              target: 'LocalBridgeMac',
              timestamp: Date.now(),
              payload: { code: 'INTERNAL_ERROR', message: e.message, details: null }
          });
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


