document.addEventListener('DOMContentLoaded', () => {
    const portInput = document.getElementById('portInput') as HTMLInputElement;
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    const statusDot = document.getElementById('statusDot') as HTMLElement;
    const statusText = document.getElementById('statusText') as HTMLElement;
    const statusUrl = document.getElementById('statusUrl') as HTMLElement;
    const statusMsg = document.getElementById('statusMsg') as HTMLDivElement;

    // ── Load saved port ──────────────────────────────────────────
    chrome.storage.local.get('wsPort').then(res => {
        portInput.value = String(res.wsPort || 10086);
    });

    // ── Query live connection status from background ─────────────
    function refreshStatus() {
        chrome.runtime.sendMessage({ type: 'GET_BRIDGE_STATUS' }).then((res: any) => {
            if (!res) return;
            if (res.connected) {
                statusDot.className = 'dot connected';
                statusText.textContent = 'Connected to LocalBridgeMac';
                const version = res.serverInfo?.serverVersion ? ` v${res.serverInfo.serverVersion}` : '';
                statusUrl.textContent = res.wsUrl + version;
            } else {
                statusDot.className = 'dot disconnected';
                statusText.textContent = 'Waiting for LocalBridgeMac…';
                statusUrl.textContent = res.wsUrl || '';
            }
        }).catch(() => {
            statusDot.className = 'dot disconnected';
            statusText.textContent = 'Unable to reach background';
            statusUrl.textContent = '';
        });
    }

    refreshStatus();
    // Poll every 2 seconds while popup is open
    const pollInterval = setInterval(refreshStatus, 2000);
    window.addEventListener('unload', () => clearInterval(pollInterval));

    // ── Save port & reconnect ────────────────────────────────────
    saveBtn.addEventListener('click', () => {
        const p = parseInt(portInput.value.trim());
        if (!p || p < 1024 || p > 65535) {
            alert('Invalid port number (must be 1024 – 65535)');
            return;
        }
        chrome.storage.local.set({ wsPort: p }).then(() => {
            statusMsg.textContent = 'Saved! Reconnecting…';
            chrome.runtime.sendMessage({ type: 'WS_PORT_CHANGED', port: p })
                .catch(() => {})
                .finally(() => {
                    setTimeout(() => {
                        statusMsg.textContent = '';
                        refreshStatus();
                    }, 1500);
                });
        });
    });

    // ── Debug link ───────────────────────────────────────────────
    const debugLink = document.getElementById('debugLink') as HTMLAnchorElement;
    if (debugLink) {
        debugLink.addEventListener('click', (e) => {
            e.preventDefault();
            const debugUrl = chrome.runtime.getURL('debug.html');
            chrome.tabs.query({ url: debugUrl }).then(existing => {
                if (existing.length > 0 && existing[0].id) {
                    chrome.tabs.update(existing[0].id, { active: true });
                    if (existing[0].windowId) {
                        chrome.windows.update(existing[0].windowId, { focused: true }).catch(() => {});
                    }
                } else {
                    chrome.tabs.create({ url: debugUrl });
                }
            });
            window.close();
        });
    }
});
