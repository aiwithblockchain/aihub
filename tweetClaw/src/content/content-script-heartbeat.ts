const TAG = '[TweetClaw-HB]';

let platform = 'unknown';

const HEARTBEAT_INTERVAL_MS = 20_000;
const HEARTBEAT_TIMEOUT_MS  = 5_000;
const RECONNECT_TIMEOUT_MS  = 3_000;

let port: chrome.runtime.Port | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let pongTimer: ReturnType<typeof setTimeout> | null = null;

function clearHeartbeat() {
    if (heartbeatTimer !== null) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
    if (pongTimer !== null) {
        clearTimeout(pongTimer);
        pongTimer = null;
    }
}

function attachPort(p: chrome.runtime.Port) {
    port = p;

    p.onMessage.addListener((msg) => {
        if (msg.type === 'HEARTBEAT_PONG') {
            if (pongTimer !== null) {
                clearTimeout(pongTimer);
                pongTimer = null;
            }
        }
    });

    p.onDisconnect.addListener(() => {
        const err = chrome.runtime.lastError?.message || 'unknown';
        console.warn(`${TAG} Port disconnected (reason: ${err}), attempting reconnect...`);
        clearHeartbeat();
        port = null;
        attemptReconnect();
    });

    startHeartbeat();
    console.log(`${TAG} Port attached, heartbeat started`);
}

function startHeartbeat() {
    heartbeatTimer = setInterval(() => {
        if (!port) {
            clearHeartbeat();
            return;
        }

        if (pongTimer !== null) {
            clearTimeout(pongTimer);
        }

        try {
            port.postMessage({ type: 'HEARTBEAT_PING', platform });
        } catch (e) {
            console.warn(`${TAG} Failed to send PING:`, e);
            return;
        }

        pongTimer = setTimeout(() => {
            pongTimer = null;
            console.warn(`${TAG} PONG timeout after ${HEARTBEAT_TIMEOUT_MS}ms, disconnecting...`);
            port?.disconnect();
            // onDisconnect will trigger attemptReconnect
        }, HEARTBEAT_TIMEOUT_MS);
    }, HEARTBEAT_INTERVAL_MS);
}

function attemptReconnect() {
    console.log(`${TAG} Attempting reconnect (timeout in ${RECONNECT_TIMEOUT_MS}ms)...`);

    const reloadTimer = setTimeout(() => {
        console.warn(`${TAG} Reconnect timed out, reloading page...`);
        location.reload();
    }, RECONNECT_TIMEOUT_MS);

    try {
        const newPort = chrome.runtime.connect({ name: 'heartbeat' });

        newPort.onMessage.addListener((msg) => {
            if (msg.type === 'HEARTBEAT_PONG') {
                clearTimeout(reloadTimer);
                console.log(`${TAG} Reconnect successful`);
                // Attach with full lifecycle management for the new port
                attachPort(newPort);
            }
        });

        newPort.onDisconnect.addListener(() => {
            // newPort disconnected before we got a PONG — reloadTimer will fire
            const err = chrome.runtime.lastError?.message || 'unknown';
            console.warn(`${TAG} Reconnect port disconnected before PONG (reason: ${err}), waiting for reload timer...`);
        });

        newPort.postMessage({ type: 'HEARTBEAT_PING', platform });
        console.log(`${TAG} Reconnect PING sent`);
    } catch (e) {
        console.error(`${TAG} Reconnect connect() threw immediately:`, e);
        // reloadTimer will still fire
    }
}

export function connect(p: string) {
    platform = p;
    console.log(`${TAG} Initializing heartbeat... platform=${platform}`);
    try {
        const initialPort = chrome.runtime.connect({ name: 'heartbeat' });
        attachPort(initialPort);
    } catch (e) {
        console.error(`${TAG} Initial connect() failed:`, e);
    }
}
