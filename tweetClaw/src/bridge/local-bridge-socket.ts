import { BaseMessage, ClientHelloPayload, MESSAGE_TYPES, PROTOCOL_NAME, PROTOCOL_VERSION, ServerHelloAckPayload } from './ws-protocol';
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
  'sw_boot',
  'runtime_startup',
  'runtime_installed',
  'runtime_suspend',
  'window_created',
  'window_removed',
  'manual_reconnect',
  'desired_inactive',
  'inactive',
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
  'bg_alarm_reconnect',
  'alarm_reconnect',
  'alarm_reconnect_skipped',
  'socket_event_ignored'
]);

export class LocalBridgeSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private heartbeatInterval: any = null;
  private serverInfo: ServerHelloAckPayload | null = null;
  private lastPongTimestamp = 0;
  private lastServerMessageTimestamp = 0;
  private instanceId: string = '';
  private instanceName: string = '';
  private desiredActive = false;
  private connectionGeneration = 0;
  private static readonly RECONNECT_ALARM_NAME = 'tweetclaw-reconnect';
  private static readonly LIFECYCLE_TRAIL_KEY = 'bridge.lifecycleTrail';
  private static readonly LIFECYCLE_PREVIOUS_TRAIL_KEY = 'bridge.lifecycleTrail.previous';
  private static readonly LIFECYCLE_MAX_ENTRIES = 50;
  private lifecycleBootstrapped = false;
  private lifecycleBootstrapPromise: Promise<void> | null = null;

  private identityLabel(): string {
    const id = this.instanceId || 'unknown-instance';
    const name = this.instanceName || 'unknown-name';
    return `instanceId=${id} instanceName=${name}`;
  }

  public queryXTabsHandler: (() => Promise<any>) | null = null;
  public queryXBasicInfoHandler: (() => Promise<any>) | null = null;
  public queryXhsAccountInfoHandler: (() => Promise<any>) | null = null;
  public queryXhsHomefeedHandler: ((payload: any) => Promise<any>) | null = null;
  public queryXhsFeedHandler: ((payload: any) => Promise<any>) | null = null;
  public openTabHandler: ((payload: any) => Promise<any>) | null = null;
  public closeTabHandler: ((payload: any) => Promise<any>) | null = null;
  public navigateTabHandler: ((payload: any) => Promise<any>) | null = null;
  public execActionHandler: ((payload: any) => Promise<any>) | null = null;
  public queryHomeTimelineHandler: ((payload: any) => Promise<any>) | null = null;
  public queryTweetRepliesHandler: ((payload: any) => Promise<any>) | null = null;
  public queryTweetDetailHandler: ((payload: any) => Promise<any>) | null = null;
  public queryUserProfileHandler: ((payload: any) => Promise<any>) | null = null;
  public querySearchTimelineHandler: ((payload: any) => Promise<any>) | null = null;
  public queryUserTweetsHandler: ((payload: any) => Promise<any>) | null = null;
  public startTaskHandler: ((payload: any) => Promise<any>) | null = null;
  public cancelTaskHandler: ((payload: any) => Promise<any>) | null = null;
  
  private WS_URL = 'ws://127.0.0.1:10086/ws'; // Default
  
  constructor() {
    void this.bootstrapLifecycleTrail();
  }

  private async ensureIdentityLoaded() {
    if (!this.instanceId) {
      this.instanceId = await getOrCreateInstanceId();
    }
    if (!this.instanceName) {
      this.instanceName = await getOrCreateInstanceName();
    }
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
          LocalBridgeSocket.LIFECYCLE_TRAIL_KEY,
          LocalBridgeSocket.LIFECYCLE_PREVIOUS_TRAIL_KEY
        ]);

        const currentTrailRaw = res[LocalBridgeSocket.LIFECYCLE_TRAIL_KEY];
        const previousTrailRaw = res[LocalBridgeSocket.LIFECYCLE_PREVIOUS_TRAIL_KEY];
        const currentTrail: LifecycleTrailEntry[] = Array.isArray(currentTrailRaw)
          ? (currentTrailRaw as LifecycleTrailEntry[])
          : [];
        const previousTrail: LifecycleTrailEntry[] = Array.isArray(previousTrailRaw)
          ? (previousTrailRaw as LifecycleTrailEntry[])
          : [];

        const trailToReplay = currentTrail.length > 0 ? currentTrail : previousTrail;
        if (trailToReplay.length > 0) {
          console.log(`[tweetClaw] previous lifecycle trail begin, ${this.identityLabel()} entries=${trailToReplay.length}`);
          for (const rawEntry of trailToReplay) {
            console.log(`[tweetClaw] previous lifecycle trail entry ${JSON.stringify(rawEntry)}`);
          }
          console.log(`[tweetClaw] previous lifecycle trail end, ${this.identityLabel()}`);
        } else {
          console.log(`[tweetClaw] previous lifecycle trail empty, ${this.identityLabel()}`);
        }

        await chrome.storage.local.set({
          [LocalBridgeSocket.LIFECYCLE_PREVIOUS_TRAIL_KEY]: trailToReplay,
          [LocalBridgeSocket.LIFECYCLE_TRAIL_KEY]: []
        });
      } catch (e) {
        console.warn('[tweetClaw] failed to bootstrap lifecycle trail', e);
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
      console.log(`[tweetClaw] lifecycle event ${JSON.stringify(entry)}`);
    }

    try {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        return;
      }

      const res = await chrome.storage.local.get(LocalBridgeSocket.LIFECYCLE_TRAIL_KEY);
      const currentTrailRaw = res[LocalBridgeSocket.LIFECYCLE_TRAIL_KEY];
      const currentTrail: LifecycleTrailEntry[] = Array.isArray(currentTrailRaw)
        ? (currentTrailRaw as LifecycleTrailEntry[])
        : [];
      const nextTrail = [...currentTrail, entry].slice(-LocalBridgeSocket.LIFECYCLE_MAX_ENTRIES);

      await chrome.storage.local.set({
        [LocalBridgeSocket.LIFECYCLE_TRAIL_KEY]: nextTrail,
        [LocalBridgeSocket.LIFECYCLE_PREVIOUS_TRAIL_KEY]: nextTrail
      });
    } catch (e) {
      console.warn('[tweetClaw] failed to persist lifecycle event', e);
    }
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

  public getDebugIdentityLabel(): string {
    return this.identityLabel();
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

  public async setDesiredActive(active: boolean, reason: string, extra?: Record<string, unknown>) {
    this.desiredActive = active;
    await this.recordLifecycleEvent(active ? 'desired_active' : 'desired_inactive', reason, {
      ...this.getConnectionDebugState(),
      ...(extra || {})
    });
  }

  public async recordActivityState(event: 'active' | 'inactive', reason: string, extra?: Record<string, unknown>) {
    await this.recordLifecycleEvent(event, reason, {
      ...this.getConnectionDebugState(),
      ...(extra || {})
    });
  }

  public async ensureConnected(reason: string) {
    await this.connect(reason);
  }

  public ensureDisconnected(reason: string) {
    this.disconnect(reason);
  }

  public async handleReconnectAlarm(windowCount?: number) {
    if (!this.desiredActive) {
      void this.recordLifecycleEvent('alarm_reconnect_skipped', 'desiredActive=false', {
        windowCount: windowCount ?? null,
        ...this.getConnectionDebugState()
      });
      console.log(`[tweetClaw] reconnect alarm skipped: desiredActive=false, ${this.identityLabel()}`);
      this.clearReconnectAlarm();
      return;
    }

    if (typeof windowCount === 'number' && windowCount <= 0) {
      void this.recordLifecycleEvent('alarm_reconnect_skipped', 'windowCount=0', {
        windowCount,
        ...this.getConnectionDebugState()
      });
      console.log(`[tweetClaw] reconnect alarm skipped: windowCount=0, ${this.identityLabel()}`);
      this.clearReconnectAlarm();
      return;
    }

    void this.recordLifecycleEvent('alarm_reconnect', 'chrome alarm fired', {
      windowCount: windowCount ?? null,
      ...this.getConnectionDebugState()
    });
    console.log(`[tweetClaw] Reconnect alarm triggered, ${this.identityLabel()} nextAttempt=${this.reconnectAttempts + 1} windowCount=${windowCount ?? 'unknown'}`);
    this.reconnectAttempts++;
    void this.connect('alarm reconnect fired');
  }

  public disconnect(reason: string) {
    const hadSocket = !!this.ws;
    const readyState = this.ws?.readyState ?? null;
    this.desiredActive = false;
    this.connectionGeneration += 1;
    const generation = this.connectionGeneration;

    void this.recordLifecycleEvent('disconnect_called', reason, {
      generation,
      hadSocket,
      readyState,
      ...this.getConnectionDebugState()
    });
    console.log(`[tweetClaw] disconnecting websocket: ${reason}, ${this.identityLabel()} generation=${generation}`);
    this.clearReconnectAlarm();
    this.stopHeartbeat();
    this.serverInfo = null;
    this.isConnecting = false;
    this.reconnectAttempts = 0;

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
      return;
    }

    console.log(`[tweetClaw] ensureDisconnected skipped: already disconnected, ${this.identityLabel()} generation=${generation}`);
  }
  
  public reconnect(host: string, port: number) {
    void this.recordLifecycleEvent('manual_reconnect', 'update ws config', { host, port });
    console.log(`[tweetClaw] reconnecting to ${host}:${port}`);
    this.WS_URL = `ws://${host}:${port}/ws`;
    this.isConnecting = false;
    this.clearReconnectAlarm();
    this.desiredActive = true;
    if (this.ws) {
      this.ws.onclose = null; // prevent standard reconnect loop
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
    void this.connect('manual reconnect');
  }

  private isConnecting = false;

  public async connect(reason: string = 'connect called') {
    await this.bootstrapLifecycleTrail();
    await this.ensureIdentityLoaded();

    if (!this.desiredActive) {
      void this.recordLifecycleEvent('connect_skipped', 'desiredActive=false', {
        reason,
        ...this.getConnectionDebugState()
      });
      console.log(`[tweetClaw] ensureConnected skipped: desiredActive=false, ${this.identityLabel()} reason=${reason}`);
      return;
    }

    if (this.isConnecting) {
      void this.recordLifecycleEvent('connect_skipped', 'already connecting', {
        reason,
        ...this.getConnectionDebugState()
      });
      console.log(`[tweetClaw] ensureConnected skipped: already connecting, ${this.identityLabel()} reason=${reason}`);
      return;
    }
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      this.clearReconnectAlarm();
      void this.recordLifecycleEvent('connect_skipped', 'already open or connecting socket', {
        reason,
        ...this.getConnectionDebugState()
      });
      console.log(`[tweetClaw] ensureConnected skipped: socket already active, ${this.identityLabel()} reason=${reason} readyState=${this.ws.readyState}`);
      return;
    }

    this.isConnecting = true;

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

    if (!this.desiredActive) {
      this.isConnecting = false;
      void this.recordLifecycleEvent('connect_skipped', 'desiredActive=false after config load', {
        reason,
        ...this.getConnectionDebugState()
      });
      console.log(`[tweetClaw] ensureConnected skipped after config load: desiredActive=false, ${this.identityLabel()} reason=${reason}`);
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      this.isConnecting = false;
      this.clearReconnectAlarm();
      void this.recordLifecycleEvent('connect_skipped', 'socket became active during config load', {
        reason,
        ...this.getConnectionDebugState()
      });
      console.log(`[tweetClaw] ensureConnected skipped after config load: socket already active, ${this.identityLabel()} reason=${reason} readyState=${this.ws.readyState}`);
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
    console.log(`[tweetClaw] websocket connecting to ${this.WS_URL}, ${this.identityLabel()} reconnectAttempts=${this.reconnectAttempts} generation=${generation} reason=${reason}`);

    try {
      const socket = new WebSocket(this.WS_URL);
      this.ws = socket;

      socket.onopen = async () => {
        if (generation !== this.connectionGeneration || this.ws !== socket) {
          void this.recordLifecycleEvent('socket_event_ignored', 'stale onopen generation', {
            generation,
            currentGeneration: this.connectionGeneration
          });
          console.log(`[tweetClaw] socket event ignored: stale generation onopen, ${this.identityLabel()} generation=${generation} current=${this.connectionGeneration}`);
          socket.close();
          return;
        }

        void this.recordLifecycleEvent('ws_open', undefined, { generation });
        console.log(`[tweetClaw] websocket open, ${this.identityLabel()} generation=${generation}`);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.lastPongTimestamp = Date.now();
        this.lastServerMessageTimestamp = Date.now();
        if (!this.instanceId) {
            this.instanceId = await getOrCreateInstanceId();
        }
        this.instanceName = await getOrCreateInstanceName();
        void this.recordLifecycleEvent('identity_ready', undefined, { generation });
        console.log(`[tweetClaw] websocket identity ready, ${this.identityLabel()} generation=${generation}`);
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
          console.log(`[tweetClaw] socket event ignored: stale generation onclose, ${this.identityLabel()} generation=${generation} current=${this.connectionGeneration}`);
          return;
        }

        void this.recordLifecycleEvent('ws_close', 'websocket onclose', {
          generation,
          code: event.code,
          reason: event.reason || '',
          wasClean: event.wasClean,
          desiredActive: this.desiredActive
        });
        console.log(`[tweetClaw] websocket closed, ${this.identityLabel()} generation=${generation} code=${event.code} reason=${event.reason || 'n/a'} wasClean=${event.wasClean} desiredActive=${this.desiredActive}`);
        this.isConnecting = false;
        this.serverInfo = null;
        this.stopHeartbeat();
        if (this.ws === socket) {
          this.ws = null;
        }
        if (!this.desiredActive) {
          console.log(`[tweetClaw] reconnect skipped after close: desiredActive=false, ${this.identityLabel()} generation=${generation}`);
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
          console.log(`[tweetClaw] socket event ignored: stale generation onerror, ${this.identityLabel()} generation=${generation} current=${this.connectionGeneration}`);
          return;
        }

        void this.recordLifecycleEvent('ws_error', 'websocket onerror', {
          generation,
          eventType: event.type,
          desiredActive: this.desiredActive
        });
        console.log(`[tweetClaw] connection notice: server offline, ${this.identityLabel()} url=${this.WS_URL} generation=${generation}`);
        this.isConnecting = false;
      };

      socket.onmessage = (event) => {
        if (generation !== this.connectionGeneration || this.ws !== socket) {
          return;
        }
        this.handleMessage(event.data);
      };
    } catch (e) {
      void this.recordLifecycleEvent('connect_exception', 'websocket constructor threw', {
        generation,
        error: e instanceof Error ? e.message : String(e)
      });
      console.log('[tweetClaw] initialization notice:', e);
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
      console.log(`[tweetClaw] reconnect skipped: desiredActive=false, ${this.identityLabel()}`);
      this.clearReconnectAlarm();
      return;
    }

    const delayInMinutes = this.getReconnectDelayInMinutes();
    void this.recordLifecycleEvent('reconnect_scheduled', 'schedule reconnect', {
      delayInMinutes,
      nextAttempt: this.reconnectAttempts + 1,
      desiredActive: this.desiredActive
    });
    console.log(`[tweetClaw] websocket reconnect scheduled in ${delayInMinutes} minute(s) (attempt ${this.reconnectAttempts + 1}), ${this.identityLabel()} desiredActive=${this.desiredActive}`);

    if (typeof chrome !== 'undefined' && chrome.alarms) {
      chrome.alarms.clear(LocalBridgeSocket.RECONNECT_ALARM_NAME, () => {
        chrome.alarms.create(LocalBridgeSocket.RECONNECT_ALARM_NAME, {
          delayInMinutes: delayInMinutes
        });
      });
    }
  }

  private clearReconnectAlarm() {
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      chrome.alarms.clear(LocalBridgeSocket.RECONNECT_ALARM_NAME);
    }
  }
  
  private getReconnectDelayInMinutes(): number {
    // Chrome Alarms API minimum is 0.5 minutes (30 seconds)
    // Using 1 minute for all reconnection attempts
    return 1;
  }
  
  private sendHello() {
    void this.recordLifecycleEvent('hello_send');
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
        clientVersion: __EXTENSION_VERSION__,
        browser: 'chrome',
        capabilities: ['query_x_tabs_status', 'query_x_basic_info', 'query_xhs_account_info', 'query_xhs_homefeed'],
        instanceId: this.instanceId || undefined,
        instanceName: this.instanceName || undefined,
        incognito: chrome.extension.inIncognitoContext
      }
    };
    console.log(`[tweetClaw] sending hello, ${this.identityLabel()} clientVersion=${hello.payload.clientVersion}`);
    this.send(hello);
  }
  
  private handleMessage(data: string) {
    try {
      const msg = JSON.parse(data) as BaseMessage;
      this.lastServerMessageTimestamp = Date.now();
      if (msg.type !== MESSAGE_TYPES.PONG && msg.type !== MESSAGE_TYPES.PING && msg.type !== MESSAGE_TYPES.SERVER_HELLO_ACK) {
        console.log(`[tweetClaw] received message: ${msg.type}, ${this.identityLabel()}`);
      }
      
      switch (msg.type) {
        case MESSAGE_TYPES.SERVER_HELLO_ACK:
          this.handleHelloAck(msg as BaseMessage<ServerHelloAckPayload>);
          break;
        case MESSAGE_TYPES.PONG:
          console.log(`[tweetClaw] received pong: id=${msg.id}, ${this.identityLabel()}`);
          this.lastPongTimestamp = Date.now();
          break;
        case MESSAGE_TYPES.REQUEST_QUERY_X_TABS_STATUS:
          this.handleQueryXTabsStatus(msg);
          break;
        case MESSAGE_TYPES.REQUEST_QUERY_X_BASIC_INFO:
          this.handleQueryXBasicInfo(msg);
          break;
        case MESSAGE_TYPES.COMMAND_QUERY_XHS_ACCOUNT_INFO:
          this.handleQueryXhsAccountInfo(msg);
          break;
        case MESSAGE_TYPES.COMMAND_QUERY_XHS_HOMEFEED:
          this.handleQueryXhsHomefeed(msg);
          break;
        case MESSAGE_TYPES.COMMAND_QUERY_XHS_FEED:
          this.handleQueryXhsFeed(msg);
          break;
        case MESSAGE_TYPES.COMMAND_QUERY_X_BASIC_INFO:
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
        case MESSAGE_TYPES.REQUEST_QUERY_TWEET_REPLIES:
          this.handleGenericQuery(msg, this.queryTweetRepliesHandler, MESSAGE_TYPES.RESPONSE_QUERY_TWEET_REPLIES);
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
        case MESSAGE_TYPES.REQUEST_QUERY_USER_TWEETS:
          this.handleGenericQuery(msg, this.queryUserTweetsHandler, MESSAGE_TYPES.RESPONSE_QUERY_USER_TWEETS);
          break;
        case MESSAGE_TYPES.REQUEST_START_TASK:
          if (this.startTaskHandler) this.startTaskHandler(msg.payload);
          break;
        case MESSAGE_TYPES.REQUEST_CANCEL_TASK:
          if (this.cancelTaskHandler) this.cancelTaskHandler(msg.payload);
          break;
        default:
          console.warn(`[tweetClaw] unknown message type: ${msg.type}`);
      }
    } catch (e) {
      console.error('[tweetClaw] failed to parse message:', e);
    }
  }
  
  private handleHelloAck(msg: BaseMessage<ServerHelloAckPayload>) {
    void this.recordLifecycleEvent('hello_ack', undefined, {
      heartbeatIntervalMs: msg.payload.heartbeatIntervalMs || 20000,
      desiredActive: this.desiredActive,
      generation: this.connectionGeneration
    });
    console.log(`[tweetClaw] received server.hello_ack, ${this.identityLabel()}`);
    console.log(`[tweetClaw] received endpoint info from server, ${this.identityLabel()}: ${JSON.stringify(msg.payload)}`);
    this.clearReconnectAlarm();
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

  private async handleQueryXhsHomefeed(req: BaseMessage) {
    console.log('[tweetClaw] handling command.query_xhs_homefeed');
    if (!this.queryXhsHomefeedHandler) {
        console.error('[tweetClaw] no handler for query_xhs_homefeed');
        return;
    }

    try {
        const result = await this.queryXhsHomefeedHandler(req.payload);
        const resp: BaseMessage = {
            id: req.id,
            type: MESSAGE_TYPES.RESPONSE_QUERY_XHS_HOMEFEED,
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

  private async handleQueryXhsFeed(req: BaseMessage) {
    console.log('[tweetClaw] handling command.query_xhs_feed');
    if (!this.queryXhsFeedHandler) {
        console.error('[tweetClaw] no handler for query_xhs_feed');
        return;
    }

    try {
        const result = await this.queryXhsFeedHandler(req.payload);
        const resp: BaseMessage = {
            id: req.id,
            type: MESSAGE_TYPES.RESPONSE_QUERY_XHS_FEED,
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

  private async handleQueryXhsAccountInfo(req: BaseMessage) {
    console.log('[tweetClaw] handling command.query_xhs_account_info');
    if (!this.queryXhsAccountInfoHandler) {
        console.error('[tweetClaw] no handler for query_xhs_account_info');
        return;
    }

    try {
        const result = await this.queryXhsAccountInfoHandler();
        const resp: BaseMessage = {
            id: req.id,
            type: MESSAGE_TYPES.RESPONSE_QUERY_XHS_ACCOUNT_INFO,
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
    this.heartbeatInterval = setInterval(() => {
      // Check for timeout (60 seconds)
      const now = Date.now();
      const sinceLastPong = this.lastPongTimestamp > 0 ? now - this.lastPongTimestamp : Number.POSITIVE_INFINITY;
      const sinceLastServerMessage = this.lastServerMessageTimestamp > 0 ? now - this.lastServerMessageTimestamp : Number.POSITIVE_INFINITY;
      if (Math.min(sinceLastPong, sinceLastServerMessage) > 60000) {
        console.error(`[tweetClaw] pong timeout, closing socket, ${this.identityLabel()} (sinceLastPongMs=${sinceLastPong}, sinceLastServerMessageMs=${sinceLastServerMessage})`);
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
    console.log(`[tweetClaw] sending ping: id=${ping.id}, ${this.identityLabel()}`);
    this.send(ping);
  }
  
  public send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      if (msg.type !== MESSAGE_TYPES.PING && msg.type !== MESSAGE_TYPES.PONG) {
        console.log(`[tweetClaw] sent message: ${msg.type}`);
      }
    } else {
      console.warn(`[tweetClaw] cannot send message, socket status: ${this.ws?.readyState}`);
    }
  }
}
