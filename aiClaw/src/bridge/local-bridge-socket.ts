import {
  BaseMessage,
  ClientHelloPayload,
  MESSAGE_TYPES,
  PROTOCOL_NAME,
  PROTOCOL_VERSION,
  ServerHelloAckPayload,
} from './ws-protocol';
import { getOrCreateInstanceId, getOrCreateInstanceName } from './instance-id';

export class LocalBridgeSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private heartbeatInterval: any = null;
  private serverInfo: ServerHelloAckPayload | null = null;
  private lastPongTimestamp = 0;
  private instanceId: string = '';
  private instanceName: string = '';

  public queryAITabsHandler: (() => Promise<any>) | null = null;
  public executeTaskHandler: ((task: any) => Promise<any>) | null = null;
  public navigateToPlatformHandler: ((payload: any) => Promise<any>) | null = null;

  private WS_URL = 'ws://127.0.0.1:10087/ws'; // Default

  constructor() {
    this.connect();
  }

  public reconnectWithNewPort(host: string, port: number) {
    console.log(`[aiClaw] reconnecting to new host: ${host}, port: ${port}`);
    this.WS_URL = `ws://${host}:${port}/ws`;
    this.isConnecting = false;
    this.cancelReconnectAlarm();
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
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.CONNECTING ||
        this.ws.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    // Check dynamic port
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const res = await chrome.storage.local.get(['wsHost', 'wsPort']);
        const host = res.wsHost || '127.0.0.1';
        if (res.wsPort) {
          this.WS_URL = `ws://${host}:${res.wsPort}/ws`;
        }
      }
    } catch (e) {
      console.warn('[aiClaw] failed to get dynamic port', e);
    }

    this.isConnecting = true;
    console.log(`[aiClaw] websocket connecting to ${this.WS_URL}...`);

    try {
      this.ws = new WebSocket(this.WS_URL);

      this.ws.onopen = async () => {
        console.log('[aiClaw] websocket open');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.lastPongTimestamp = Date.now();

        // 确保 instanceId 已加载，并且每次重连时获取最新的 instanceName
        if (!this.instanceId) {
          this.instanceId = await getOrCreateInstanceId();
        }
        this.instanceName = await getOrCreateInstanceName();
        this.sendHello();
      };

      this.ws.onclose = () => {
        console.log('[aiClaw] websocket closed');
        this.isConnecting = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Use regular log to stay silent in Chrome extension error list
        console.log('[aiClaw] connection notice: server offline');
        this.isConnecting = false;
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } catch (e) {
      console.log('[aiClaw] initialization notice:', e);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    console.log('[aiClaw] websocket reconnect scheduled in 1 minute via chrome.alarms');
    this.reconnectAttempts++;

    if (typeof chrome !== 'undefined' && chrome.alarms) {
      chrome.alarms.create('ws-reconnect', { delayInMinutes: 1 });
    }
  }

  private cancelReconnectAlarm() {
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      chrome.alarms.clear('ws-reconnect');
    }
  }

  public manualReconnect() {
    console.log('[aiClaw] manual reconnect triggered');
    this.cancelReconnectAlarm();
    this.reconnectAttempts = 0;
    this.connect();
  }

  private sendHello() {
    const hello: BaseMessage<ClientHelloPayload> = {
      id: `hello_${Date.now()}`,
      type: MESSAGE_TYPES.CLIENT_HELLO,
      source: 'aiClaw',
      target: 'LocalBridgeMac',
      timestamp: Date.now(),
      payload: {
        protocolName: PROTOCOL_NAME,
        protocolVersion: PROTOCOL_VERSION,
        clientName: 'aiClaw',
        clientVersion: '0.2.2',
        browser: 'chrome',
        capabilities: ['query_ai_tabs_status', 'execute_task'],
        instanceId: this.instanceId || undefined,           // 新增
        instanceName: this.instanceName || undefined,
        incognito: (typeof chrome !== 'undefined' && chrome.extension) ? chrome.extension.inIncognitoContext : false // 新增
      },
    };
    console.log(`[aiClaw] sending endpoint info to server: ${JSON.stringify(hello.payload)}`);
    this.send(hello);
  }

  private handleMessage(data: string) {
    try {
      const msg = JSON.parse(data) as BaseMessage;
      console.log(`[aiClaw] received message: ${msg.type}`);

      switch (msg.type) {
        case MESSAGE_TYPES.SERVER_HELLO_ACK:
          this.handleHelloAck(msg as BaseMessage<ServerHelloAckPayload>);
          break;
        case MESSAGE_TYPES.PONG:
          console.log('[aiClaw] received pong');
          this.lastPongTimestamp = Date.now();
          break;
        case MESSAGE_TYPES.REQUEST_QUERY_AI_TABS_STATUS:
          this.handleQueryAITabsStatus(msg);
          break;
        case MESSAGE_TYPES.REQUEST_EXECUTE_TASK:
          this.handleExecuteTask(msg);
          break;
        case MESSAGE_TYPES.REQUEST_NAVIGATE_TO_PLATFORM:
          this.handleNavigateToPlatform(msg);
          break;
        default:
          console.warn(`[aiClaw] unknown message type: ${msg.type}`);
      }
    } catch (e) {
      console.error('[aiClaw] failed to parse message:', e);
    }
  }

  private handleHelloAck(msg: BaseMessage<ServerHelloAckPayload>) {
    console.log('[aiClaw] received server.hello_ack');
    console.log(`[aiClaw] received endpoint info from server: ${JSON.stringify(msg.payload)}`);
    this.serverInfo = msg.payload;
    this.startHeartbeat(msg.payload.heartbeatIntervalMs || 20000);
  }

  private async handleQueryAITabsStatus(req: BaseMessage) {
    console.log('[aiClaw] handling request.query_ai_tabs_status');
    if (!this.queryAITabsHandler) {
      console.error('[aiClaw] no handler for query_ai_tabs_status');
      return;
    }

    try {
      const result = await this.queryAITabsHandler();
      const resp: BaseMessage = {
        id: req.id,
        type: MESSAGE_TYPES.RESPONSE_QUERY_AI_TABS_STATUS,
        source: 'aiClaw',
        target: 'LocalBridgeMac',
        timestamp: Date.now(),
        payload: result,
      };
      this.send(resp);
    } catch (e) {
      const errResp: BaseMessage = {
        id: req.id,
        type: MESSAGE_TYPES.RESPONSE_ERROR,
        source: 'aiClaw',
        target: 'LocalBridgeMac',
        timestamp: Date.now(),
        payload: {
          code: 'INTERNAL_ERROR',
          message: e instanceof Error ? e.message : String(e),
          details: null,
        },
      };
      this.send(errResp);
    }
  }
  private async handleExecuteTask(req: BaseMessage) {
    console.log('[aiClaw] handling request.execute_task, taskId:', req.payload?.taskId);
    if (!this.executeTaskHandler) {
      console.error('[aiClaw] no handler registered for execute_task');
      const errResp: BaseMessage = {
        id: req.id,
        type: MESSAGE_TYPES.RESPONSE_ERROR,
        source: 'aiClaw',
        target: 'LocalBridgeMac',
        timestamp: Date.now(),
        payload: {
          code: 'NOT_CONNECTED',
          message: 'executeTaskHandler is not registered',
          details: null,
        },
      };
      this.send(errResp);
      return;
    }

    try {
      const result = await this.executeTaskHandler(req.payload);
      const resp: BaseMessage = {
        id: req.id,
        type: MESSAGE_TYPES.RESPONSE_EXECUTE_TASK_RESULT,
        source: 'aiClaw',
        target: 'LocalBridgeMac',
        timestamp: Date.now(),
        payload: result,
      };
      this.send(resp);
    } catch (e) {
      const errResp: BaseMessage = {
        id: req.id,
        type: MESSAGE_TYPES.RESPONSE_ERROR,
        source: 'aiClaw',
        target: 'LocalBridgeMac',
        timestamp: Date.now(),
        payload: {
          code: 'INTERNAL_ERROR',
          message: e instanceof Error ? e.message : String(e),
          details: null,
        },
      };
      this.send(errResp);
    }
  }

  private async handleNavigateToPlatform(req: BaseMessage) {
    console.log('[aiClaw] handling request.navigate_to_platform, platform:', req.payload?.platform);
    if (!this.navigateToPlatformHandler) {
      console.error('[aiClaw] no handler registered for navigate_to_platform');
      const errResp: BaseMessage = {
        id: req.id,
        type: MESSAGE_TYPES.RESPONSE_ERROR,
        source: 'aiClaw',
        target: 'LocalBridgeMac',
        timestamp: Date.now(),
        payload: {
          code: 'NOT_CONNECTED',
          message: 'navigateToPlatformHandler is not registered',
          details: null,
        },
      };
      this.send(errResp);
      return;
    }

    try {
      const result = await this.navigateToPlatformHandler(req.payload);
      const resp: BaseMessage = {
        id: req.id,
        type: MESSAGE_TYPES.RESPONSE_NAVIGATE_RESULT,
        source: 'aiClaw',
        target: 'LocalBridgeMac',
        timestamp: Date.now(),
        payload: result,
      };
      this.send(resp);
    } catch (e) {
      const errResp: BaseMessage = {
        id: req.id,
        type: MESSAGE_TYPES.RESPONSE_ERROR,
        source: 'aiClaw',
        target: 'LocalBridgeMac',
        timestamp: Date.now(),
        payload: {
          code: 'INTERNAL_ERROR',
          message: e instanceof Error ? e.message : String(e),
          details: null,
        },
      };
      this.send(errResp);
    }
  }

  private startHeartbeat(interval: number) {
    this.stopHeartbeat();
    console.log(`[aiClaw] starting heartbeat every ${interval}ms`);
    this.heartbeatInterval = setInterval(() => {
      // Check for timeout (60 seconds)
      const now = Date.now();
      if (this.lastPongTimestamp > 0 && now - this.lastPongTimestamp > 60000) {
        console.error('[aiClaw] pong timeout, closing socket');
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
      source: 'aiClaw',
      target: 'LocalBridgeMac',
      timestamp: Date.now(),
      payload: {
        heartbeatIntervalMs: 20000,
      },
    };
    this.send(ping);
  }

  public send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      console.log(`[aiClaw] sent message: ${msg.type}`);
    } else {
      console.warn(
        `[aiClaw] cannot send message, socket status: ${this.ws?.readyState}`
      );
    }
  }
}