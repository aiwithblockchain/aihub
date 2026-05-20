import {
  BaseMessage,
  ClientHelloPayload,
  MESSAGE_TYPES,
  PROTOCOL_NAME,
  PROTOCOL_VERSION,
  ServerHelloAckPayload,
} from './ws-protocol';
import { getOrCreateInstanceId, getOrCreateInstanceName } from './instance-id';

interface LifecycleTrailEntry {
  time: string;
  event: string;
  reason?: string;
  instanceId: string;
  instanceName: string;
  reconnectAttempts: number;
  wsUrl: string;
  extra?: Record<string, unknown>;
}

const CONSOLE_LIFECYCLE_EVENTS = new Set([
  'manual_reconnect',
  'disconnect_called',
  'connect_begin',
  'connect_skipped',
  'connect_exception',
  'ws_open',
  'ws_close',
  'ws_error',
  'hello_ack',
  'reconnect_scheduled',
  'reconnect_skipped',
  'alarm_reconnect',
  'alarm_reconnect_skipped',
  'socket_event_ignored'
]);

const RECONNECT_ALARM_NAME = 'aiclaw-ws-reconnect';
const LIFECYCLE_TRAIL_KEY = 'aiclaw.bridge.lifecycleTrail';
const LIFECYCLE_PREVIOUS_TRAIL_KEY = 'aiclaw.bridge.lifecycleTrail.previous';
const LIFECYCLE_MAX_ENTRIES = 50;

export class LocalBridgeSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private heartbeatInterval: any = null;
  private serverInfo: ServerHelloAckPayload | null = null;
  private lastPongTimestamp = 0;
  private lastServerMessageTimestamp = 0;
  private instanceId: string = '';
  private instanceName: string = '';
  private desiredActive = true;
  private connectionGeneration = 0;
  private isConnecting = false;
  private lifecycleBootstrapped = false;
  private lifecycleBootstrapPromise: Promise<void> | null = null;

  public queryAITabsHandler: (() => Promise<any>) | null = null;
  public executeTaskHandler: ((task: any) => Promise<any>) | null = null;
  public navigateToPlatformHandler: ((payload: any) => Promise<any>) | null = null;

  private WS_URL = 'ws://127.0.0.1:10087/ws';

  constructor() {
    void this.bootstrapLifecycleTrail();
    void this.connect('constructor');
  }

  private identityLabel(): string {
    const id = this.instanceId || 'unknown-instance';
    const name = this.instanceName || 'unknown-name';
    return `instanceId=${id} instanceName=${name}`;
  }

  private async bootstrapLifecycleTrail() {
    if (this.lifecycleBootstrapped) {
      return;
    }
    if (this.lifecycleBootstrapPromise) {
      return this.lifecycleBootstrapPromise;
    }

    this.lifecycleBootstrapPromise = (async () => {
      await this.ensureIdentityLoaded();

      try {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
          this.lifecycleBootstrapped = true;
          return;
        }

        const res = await chrome.storage.local.get([
          LIFECYCLE_TRAIL_KEY,
          LIFECYCLE_PREVIOUS_TRAIL_KEY
        ]);

        const currentTrailRaw = res[LIFECYCLE_TRAIL_KEY];
        const previousTrailRaw = res[LIFECYCLE_PREVIOUS_TRAIL_KEY];
        const currentTrail: LifecycleTrailEntry[] = Array.isArray(currentTrailRaw)
          ? (currentTrailRaw as LifecycleTrailEntry[])
          : [];
        const previousTrail: LifecycleTrailEntry[] = Array.isArray(previousTrailRaw)
          ? (previousTrailRaw as LifecycleTrailEntry[])
          : [];

        const trailToReplay = currentTrail.length > 0 ? currentTrail : previousTrail;
        if (trailToReplay.length > 0) {
          console.log(`[aiClaw] previous lifecycle trail begin, ${this.identityLabel()} entries=${trailToReplay.length}`);
          for (const rawEntry of trailToReplay) {
            console.log(`[aiClaw] previous lifecycle trail entry ${JSON.stringify(rawEntry)}`);
          }
          console.log(`[aiClaw] previous lifecycle trail end, ${this.identityLabel()}`);
        } else {
          console.log(`[aiClaw] previous lifecycle trail empty, ${this.identityLabel()}`);
        }

        await chrome.storage.local.set({
          [LIFECYCLE_PREVIOUS_TRAIL_KEY]: trailToReplay,
          [LIFECYCLE_TRAIL_KEY]: []
        });
      } catch (e) {
        console.warn('[aiClaw] failed to bootstrap lifecycle trail', e);
      } finally {
        this.lifecycleBootstrapped = true;
      }
    })();

    return this.lifecycleBootstrapPromise;
  }

  public async recordLifecycleEvent(event: string, reason?: string, extra?: Record<string, unknown>) {
    await this.bootstrapLifecycleTrail();
    await this.ensureIdentityLoaded();

    const entry: LifecycleTrailEntry = {
      time: new Date().toISOString(),
      event,
      reason,
      instanceId: this.instanceId || 'unknown-instance',
      instanceName: this.instanceName || 'unknown-name',
      reconnectAttempts: this.reconnectAttempts,
      wsUrl: this.WS_URL,
      extra
    };

    if (CONSOLE_LIFECYCLE_EVENTS.has(event)) {
      console.log(`[aiClaw] lifecycle event ${JSON.stringify(entry)}`);
    }

    try {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        return;
      }

      const res = await chrome.storage.local.get(LIFECYCLE_TRAIL_KEY);
      const currentTrailRaw = res[LIFECYCLE_TRAIL_KEY];
      const currentTrail: LifecycleTrailEntry[] = Array.isArray(currentTrailRaw)
        ? (currentTrailRaw as LifecycleTrailEntry[])
        : [];
      const nextTrail = [...currentTrail, entry].slice(-LIFECYCLE_MAX_ENTRIES);

      await chrome.storage.local.set({
        [LIFECYCLE_TRAIL_KEY]: nextTrail,
        [LIFECYCLE_PREVIOUS_TRAIL_KEY]: nextTrail
      });
    } catch (e) {
      console.warn('[aiClaw] failed to persist lifecycle event', e);
    }
  }

  public getConnectionDebugState(): Record<string, unknown> {
    return {
      instanceId: this.instanceId || 'unknown-instance',
      instanceName: this.instanceName || 'unknown-name',
      hasSocket: !!this.ws,
      readyState: this.ws?.readyState ?? null,
      reconnectAttempts: this.reconnectAttempts,
      wsUrl: this.WS_URL,
      isConnecting: this.isConnecting,
      hasHeartbeatInterval: !!this.heartbeatInterval,
      hasServerInfo: !!this.serverInfo,
      lastPongTimestamp: this.lastPongTimestamp,
      lastServerMessageTimestamp: this.lastServerMessageTimestamp,
      desiredActive: this.desiredActive,
      connectionGeneration: this.connectionGeneration
    };
  }

  private async ensureIdentityLoaded() {
    if (!this.instanceId) {
      this.instanceId = await getOrCreateInstanceId();
    }
    this.instanceName = await getOrCreateInstanceName();
  }

  public reconnectWithNewPort(host: string, port: number) {
    void this.recordLifecycleEvent('manual_reconnect', 'update ws config', { host, port });
    console.log(`[aiClaw] reconnecting to new host: ${host}, port: ${port}`);
    this.WS_URL = `ws://${host}:${port}/ws`;
    this.reconnectAttempts = 0;
    this.reconnect('port changed');
  }

  public manualReconnect() {
    void this.recordLifecycleEvent('manual_reconnect', 'manual reconnect requested');
    console.log('[aiClaw] manual reconnect triggered');
    this.reconnectAttempts = 0;
    this.reconnect('manual reconnect');
  }

  public handleReconnectAlarm() {
    if (!this.desiredActive) {
      void this.recordLifecycleEvent('alarm_reconnect_skipped', 'desiredActive=false', {
        ...this.getConnectionDebugState()
      });
      console.log('[aiClaw] reconnect alarm skipped: desiredActive=false');
      this.cancelReconnectAlarm();
      return;
    }

    void this.recordLifecycleEvent('alarm_reconnect', 'chrome alarm fired', {
      ...this.getConnectionDebugState()
    });
    console.log(`[aiClaw] reconnect alarm triggered, nextAttempt=${this.reconnectAttempts + 1}`);
    this.reconnectAttempts++;
    void this.connect('alarm reconnect fired');
  }

  public disconnect(reason: string) {
    const hadSocket = !!this.ws;
    const readyState = this.ws?.readyState ?? null;
    console.log(`[aiClaw] disconnecting websocket: ${reason}`);
    this.desiredActive = false;
    this.connectionGeneration += 1;
    const generation = this.connectionGeneration;
    void this.recordLifecycleEvent('disconnect_called', reason, {
      generation,
      hadSocket,
      readyState,
      ...this.getConnectionDebugState()
    });
    this.cancelReconnectAlarm();
    this.stopHeartbeat();
    this.serverInfo = null;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.lastPongTimestamp = 0;
    this.lastServerMessageTimestamp = 0;

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private reconnect(reason: string) {
    this.desiredActive = true;
    this.connectionGeneration += 1;
    this.cancelReconnectAlarm();
    this.stopHeartbeat();
    this.serverInfo = null;
    this.isConnecting = false;
    this.lastPongTimestamp = 0;
    this.lastServerMessageTimestamp = 0;

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }

    void this.connect(reason);
  }

  public async connect(reason: string = 'connect called') {
    await this.bootstrapLifecycleTrail();
    await this.ensureIdentityLoaded();

    if (!this.desiredActive) {
      void this.recordLifecycleEvent('connect_skipped', 'desiredActive=false', {
        reason,
        ...this.getConnectionDebugState()
      });
      console.log(`[aiClaw] connect skipped: desiredActive=false, ${this.identityLabel()} reason=${reason}`);
      return;
    }

    if (this.isConnecting) {
      void this.recordLifecycleEvent('connect_skipped', 'already connecting', {
        reason,
        ...this.getConnectionDebugState()
      });
      console.log(`[aiClaw] connect skipped: already connecting, ${this.identityLabel()} reason=${reason}`);
      return;
    }

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)
    ) {
      this.cancelReconnectAlarm();
      void this.recordLifecycleEvent('connect_skipped', 'already open or connecting socket', {
        reason,
        ...this.getConnectionDebugState()
      });
      console.log(`[aiClaw] connect skipped: socket already active, ${this.identityLabel()} reason=${reason}, readyState=${this.ws.readyState}`);
      return;
    }

    this.isConnecting = true;

    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const res = await chrome.storage.local.get(['wsHost', 'wsPort']);
        const host = res.wsHost || '127.0.0.1';
        const port = res.wsPort || 10087;
        this.WS_URL = `ws://${host}:${port}/ws`;
      }
    } catch (e) {
      console.warn('[aiClaw] failed to get dynamic config', e);
    }

    if (!this.desiredActive) {
      this.isConnecting = false;
      void this.recordLifecycleEvent('connect_skipped', 'desiredActive=false after config load', {
        reason,
        ...this.getConnectionDebugState()
      });
      console.log(`[aiClaw] connect skipped after config load: desiredActive=false, ${this.identityLabel()} reason=${reason}`);
      return;
    }

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)
    ) {
      this.isConnecting = false;
      this.cancelReconnectAlarm();
      void this.recordLifecycleEvent('connect_skipped', 'socket became active during config load', {
        reason,
        ...this.getConnectionDebugState()
      });
      console.log(`[aiClaw] connect skipped after config load: socket already active, ${this.identityLabel()} reason=${reason}, readyState=${this.ws.readyState}`);
      return;
    }

    this.connectionGeneration += 1;
    const generation = this.connectionGeneration;
    void this.recordLifecycleEvent('connect_begin', reason, {
      generation,
      reconnectAttempts: this.reconnectAttempts,
      wsUrl: this.WS_URL,
      desiredActive: this.desiredActive
    });
    console.log(`[aiClaw] websocket connecting to ${this.WS_URL}, ${this.identityLabel()} reconnectAttempts=${this.reconnectAttempts}, generation=${generation}, reason=${reason}`);

    try {
      const socket = new WebSocket(this.WS_URL);
      this.ws = socket;

      socket.onopen = async () => {
        if (generation !== this.connectionGeneration || this.ws !== socket) {
          void this.recordLifecycleEvent('socket_event_ignored', 'stale onopen generation', {
            generation,
            currentGeneration: this.connectionGeneration
          });
          console.log(`[aiClaw] socket event ignored: stale onopen generation=${generation}, current=${this.connectionGeneration}`);
          socket.close();
          return;
        }

        void this.recordLifecycleEvent('ws_open', undefined, { generation });
        console.log(`[aiClaw] websocket open, ${this.identityLabel()} generation=${generation}`);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.lastPongTimestamp = Date.now();
        this.lastServerMessageTimestamp = Date.now();
        await this.ensureIdentityLoaded();
        this.sendHello();
      };

      socket.onclose = (event) => {
        if (generation !== this.connectionGeneration) {
          void this.recordLifecycleEvent('socket_event_ignored', 'stale onclose generation', {
            generation,
            currentGeneration: this.connectionGeneration,
            code: event.code,
            reason: event.reason || ''
          });
          console.log(`[aiClaw] socket event ignored: stale onclose generation=${generation}, current=${this.connectionGeneration}`);
          return;
        }

        void this.recordLifecycleEvent('ws_close', 'websocket onclose', {
          generation,
          code: event.code,
          reason: event.reason || '',
          wasClean: event.wasClean,
          desiredActive: this.desiredActive
        });
        console.log(`[aiClaw] websocket closed, ${this.identityLabel()} generation=${generation}, code=${event.code}, reason=${event.reason || 'n/a'}, wasClean=${event.wasClean}, desiredActive=${this.desiredActive}`);
        this.isConnecting = false;
        this.serverInfo = null;
        this.stopHeartbeat();
        if (this.ws === socket) {
          this.ws = null;
        }
        if (!this.desiredActive) {
          console.log('[aiClaw] reconnect skipped after close: desiredActive=false');
          return;
        }
        this.scheduleReconnect();
      };

      socket.onerror = (event) => {
        if (generation !== this.connectionGeneration) {
          void this.recordLifecycleEvent('socket_event_ignored', 'stale onerror generation', {
            generation,
            currentGeneration: this.connectionGeneration,
            eventType: event.type
          });
          console.log(`[aiClaw] socket event ignored: stale onerror generation=${generation}, current=${this.connectionGeneration}`);
          return;
        }

        void this.recordLifecycleEvent('ws_error', 'websocket onerror', {
          generation,
          eventType: event.type,
          desiredActive: this.desiredActive,
          ...this.getConnectionDebugState()
        });
        console.log(`[aiClaw] connection notice: server offline, url=${this.WS_URL}, generation=${generation}, eventType=${event.type}`);
        this.isConnecting = false;
      };

      socket.onmessage = (event) => {
        if (generation !== this.connectionGeneration || this.ws !== socket) {
          return;
        }
        this.handleMessage(event.data);
      };
    } catch (e) {
      void this.recordLifecycleEvent('connect_exception', 'websocket initialization failed', {
        reason,
        error: e instanceof Error ? e.message : String(e),
        ...this.getConnectionDebugState()
      });
      console.log('[aiClaw] initialization notice:', e);
      this.isConnecting = false;
      if (this.desiredActive) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect() {
    if (!this.desiredActive) {
      void this.recordLifecycleEvent('reconnect_skipped', 'desiredActive=false', {
        ...this.getConnectionDebugState()
      });
      console.log('[aiClaw] reconnect skipped: desiredActive=false');
      this.cancelReconnectAlarm();
      return;
    }

    void this.recordLifecycleEvent('reconnect_scheduled', 'websocket reconnect scheduled', {
      nextAttempt: this.reconnectAttempts + 1,
      delayMs: 60000,
      ...this.getConnectionDebugState()
    });
    console.log(`[aiClaw] websocket reconnect scheduled in 1 minute (attempt ${this.reconnectAttempts + 1})`);

    if (typeof chrome !== 'undefined' && chrome.alarms) {
      chrome.alarms.clear(RECONNECT_ALARM_NAME, () => {
        chrome.alarms.create(RECONNECT_ALARM_NAME, { delayInMinutes: 1 });
      });
    }
  }

  private cancelReconnectAlarm() {
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      chrome.alarms.clear(RECONNECT_ALARM_NAME);
    }
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
        instanceId: this.instanceId || undefined,
        instanceName: this.instanceName || undefined,
        incognito:
          typeof chrome !== 'undefined' && chrome.extension
            ? chrome.extension.inIncognitoContext
            : false,
      },
    };
    console.log(`[aiClaw] sending hello, clientVersion=${hello.payload.clientVersion}`);
    this.send(hello);
  }

  private handleMessage(data: string) {
    try {
      const msg = JSON.parse(data) as BaseMessage;
      this.lastServerMessageTimestamp = Date.now();
      if (
        msg.type !== MESSAGE_TYPES.PONG &&
        msg.type !== MESSAGE_TYPES.PING &&
        msg.type !== MESSAGE_TYPES.SERVER_HELLO_ACK
      ) {
        console.log(`[aiClaw] received message: ${msg.type}`);
      }

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
    this.cancelReconnectAlarm();
    this.serverInfo = msg.payload;
    this.startHeartbeat(msg.payload.heartbeatIntervalMs || 20000);
    void this.recordLifecycleEvent('hello_ack', 'received server.hello_ack', {
      heartbeatIntervalMs: msg.payload.heartbeatIntervalMs || 20000,
      serverName: msg.payload.serverName,
      serverVersion: msg.payload.serverVersion,
      protocolVersion: msg.payload.protocolVersion,
      ...this.getConnectionDebugState()
    });
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
      const now = Date.now();
      const sinceLastPong =
        this.lastPongTimestamp > 0 ? now - this.lastPongTimestamp : Number.POSITIVE_INFINITY;
      const sinceLastServerMessage =
        this.lastServerMessageTimestamp > 0
          ? now - this.lastServerMessageTimestamp
          : Number.POSITIVE_INFINITY;
      if (Math.min(sinceLastPong, sinceLastServerMessage) > 60000) {
        console.error(
          `[aiClaw] pong timeout, closing socket (sinceLastPongMs=${sinceLastPong}, sinceLastServerMessageMs=${sinceLastServerMessage})`
        );
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
      if (msg.type !== MESSAGE_TYPES.PING && msg.type !== MESSAGE_TYPES.PONG) {
        console.log(`[aiClaw] sent message: ${msg.type}`);
      }
    } else {
      console.warn(
        `[aiClaw] cannot send message, socket status: ${this.ws?.readyState}`
      );
    }
  }
}
