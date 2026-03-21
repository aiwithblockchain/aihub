document.addEventListener('DOMContentLoaded', () => {
    const mainView = document.getElementById('mainView') as HTMLDivElement;
    const xSettingsView = document.getElementById('xSettingsView') as HTMLDivElement;
    const btnX = document.getElementById('btnX') as HTMLElement;
    const btnBack = document.getElementById('btnBack') as HTMLButtonElement;

    const portInput = document.getElementById('portInput') as HTMLInputElement;
    const savePortBtn = document.getElementById('savePortBtn') as HTMLButtonElement;
    const primaryDot = document.getElementById('primaryDot') as HTMLElement;
    const primaryUrl = document.getElementById('primaryUrl') as HTMLElement;
    const primaryVersion = document.getElementById('primaryVersion') as HTMLElement;
    const additionalConnectionsList = document.getElementById('additionalConnectionsList') as HTMLDivElement;
    const ipInput = document.getElementById('ipInput') as HTMLInputElement;
    const portInputAdd = document.getElementById('portInputAdd') as HTMLInputElement;
    const addConnectionBtn = document.getElementById('addConnectionBtn') as HTMLButtonElement;
    const statusMsg = document.getElementById('statusMsg') as HTMLDivElement;

    // ── View Switching ───────────────────────────────────────────
    btnX.addEventListener('click', () => {
        mainView.classList.add('hidden');
        xSettingsView.classList.remove('hidden');
    });

    btnBack.addEventListener('click', () => {
        xSettingsView.classList.add('hidden');
        mainView.classList.remove('hidden');
    });

    // ── Load saved port ──────────────────────────────────────────
    chrome.storage.local.get('wsPort').then(res => {
        portInput.value = String(res.wsPort || 10086);
    });

    // ── Render additional connections ────────────────────────────
    function renderAdditionalConnections(connections: Array<{url: string, connected: boolean, serverInfo: any}>) {
        // Filter out the primary connection (127.0.0.1)
        const additional = connections.filter(c => !c.url.includes('127.0.0.1'));

        if (additional.length === 0) {
            additionalConnectionsList.innerHTML = '';
            return;
        }

        additionalConnectionsList.innerHTML = additional.map(conn => {
            const dotClass = conn.connected ? 'connected' : 'disconnected';
            const statusText = conn.connected ? 'Connected' : 'Disconnected';
            const version = conn.serverInfo?.serverVersion ? ` v${conn.serverInfo.serverVersion}` : '';

            return `
                <div class="connection-item">
                    <span class="dot ${dotClass}"></span>
                    <div style="flex: 1;">
                        <div class="connection-url">${conn.url}</div>
                        <div class="connection-version">${statusText}${version}</div>
                    </div>
                    <div class="connection-actions">
                        <button class="btn-remove" data-url="${conn.url}">Remove</button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach remove handlers
        additionalConnectionsList.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = (e.target as HTMLElement).getAttribute('data-url');
                if (url) removeConnection(url);
            });
        });
    }

    // ── Query live connection status from background ─────────────
    function refreshStatus() {
        if (xSettingsView.classList.contains('hidden')) return;

        chrome.runtime.sendMessage({ type: 'GET_BRIDGE_STATUS' }).then((res: any) => {
            if (res && res.connections) {
                // Update primary connection (127.0.0.1)
                const primary = res.connections.find((c: any) => c.url.includes('127.0.0.1'));
                if (primary) {
                    primaryDot.className = primary.connected ? 'dot connected' : 'dot disconnected';
                    primaryUrl.textContent = primary.url;
                    const statusText = primary.connected ? 'Connected to LocalBridgeMac' : 'Waiting for LocalBridgeMac…';
                    const version = primary.serverInfo?.serverVersion ? ` v${primary.serverInfo.serverVersion}` : '';
                    primaryVersion.textContent = statusText + version;
                } else {
                    primaryDot.className = 'dot disconnected';
                    primaryVersion.textContent = 'Not configured';
                }

                // Render additional connections
                renderAdditionalConnections(res.connections);
            }
        }).catch(() => {
            primaryDot.className = 'dot disconnected';
            primaryVersion.textContent = 'Unable to reach background';
        });
    }

    refreshStatus();
    const pollInterval = setInterval(refreshStatus, 2000);
    window.addEventListener('unload', () => clearInterval(pollInterval));

    // ── Save port & reconnect (primary connection) ───────────────
    savePortBtn.addEventListener('click', () => {
        const p = parseInt(portInput.value.trim());
        if (!p || p < 1024 || p > 65535) {
            alert('Invalid port number (must be 1024 – 65535)');
            return;
        }

        const url = `ws://127.0.0.1:${p}/ws`;

        chrome.storage.local.set({ wsPort: p }).then(() => {
            // Update the primary connection
            chrome.runtime.sendMessage({ type: 'UPDATE_PRIMARY_CONNECTION', url }).then(() => {
                statusMsg.textContent = 'Saved! Reconnecting…';
                statusMsg.style.color = '#22c55e';
                setTimeout(() => {
                    statusMsg.textContent = '';
                    refreshStatus();
                }, 1500);
            });
        });
    });

    // ── Add additional connection ────────────────────────────────
    addConnectionBtn.addEventListener('click', () => {
        const ip = ipInput.value.trim();
        const port = portInputAdd.value.trim();

        if (!ip) {
            statusMsg.textContent = 'Please enter an IP address';
            statusMsg.style.color = '#ef4444';
            return;
        }

        if (!port) {
            statusMsg.textContent = 'Please enter a port number';
            statusMsg.style.color = '#ef4444';
            return;
        }

        const portNum = parseInt(port);
        if (portNum < 1024 || portNum > 65535) {
            statusMsg.textContent = 'Port must be between 1024 and 65535';
            statusMsg.style.color = '#ef4444';
            return;
        }

        // Validate IP format (basic check)
        const ipPattern = /^[\w\.\-]+$/;
        if (!ipPattern.test(ip)) {
            statusMsg.textContent = 'Invalid IP address format';
            statusMsg.style.color = '#ef4444';
            return;
        }

        // Prevent adding 127.0.0.1
        if (ip === '127.0.0.1' || ip === 'localhost') {
            statusMsg.textContent = 'Cannot add 127.0.0.1 as additional connection';
            statusMsg.style.color = '#ef4444';
            return;
        }

        const url = `ws://${ip}:${port}/ws`;

        chrome.runtime.sendMessage({ type: 'ADD_WS_CONNECTION', url }).then(() => {
            statusMsg.textContent = 'Connection added!';
            statusMsg.style.color = '#22c55e';
            ipInput.value = '';
            portInputAdd.value = '';
            setTimeout(() => {
                statusMsg.textContent = '';
                refreshStatus();
            }, 1500);
        }).catch(() => {
            statusMsg.textContent = 'Failed to add connection';
            statusMsg.style.color = '#ef4444';
        });
    });

    // ── Remove connection ────────────────────────────────────────
    function removeConnection(url: string) {
        chrome.runtime.sendMessage({ type: 'REMOVE_WS_CONNECTION', url }).then(() => {
            refreshStatus();
        });
    }

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
