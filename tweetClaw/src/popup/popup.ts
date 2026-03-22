document.addEventListener('DOMContentLoaded', () => {
    const mainView = document.getElementById('mainView') as HTMLDivElement;
    const xSettingsView = document.getElementById('xSettingsView') as HTMLDivElement;
    const btnX = document.getElementById('btnX') as HTMLElement;
    const btnBack = document.getElementById('btnBack') as HTMLButtonElement;

    const hostInput = document.getElementById('hostInput') as HTMLInputElement;
    const portInput = document.getElementById('portInput') as HTMLInputElement;
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    const statusDot = document.getElementById('statusDot') as HTMLElement;
    const connectionUrl = document.getElementById('connectionUrl') as HTMLElement;
    const connectionVersion = document.getElementById('connectionVersion') as HTMLElement;

    const nameInput = document.getElementById('nameInput') as HTMLInputElement;
    const saveNameBtn = document.getElementById('saveNameBtn') as HTMLButtonElement;

    // ── View Switching ───────────────────────────────────────────
    btnX.addEventListener('click', () => {
        mainView.classList.add('hidden');
        xSettingsView.classList.remove('hidden');
        refreshStatus();
    });

    btnBack.addEventListener('click', () => {
        xSettingsView.classList.add('hidden');
        mainView.classList.remove('hidden');
    });

    // ── Load saved config ────────────────────────────────────────
    chrome.storage.local.get(['wsHost', 'wsPort', 'bridge.instanceName']).then(res => {
        hostInput.value = (res.wsHost as string) || '127.0.0.1';
        portInput.value = String((res.wsPort as number) || 10086);
        nameInput.value = (res['bridge.instanceName'] as string) || '';
    });

    // ── Query live connection status from background ─────────────
    function refreshStatus() {
        if (xSettingsView.classList.contains('hidden')) return;

        chrome.runtime.sendMessage({ type: 'GET_BRIDGE_STATUS' }).then((res: any) => {
            if (res) {
                statusDot.className = res.connected ? 'dot connected' : 'dot disconnected';
                connectionUrl.textContent = res.url;
                const statusText = res.connected ? 'Connected to LocalBridgeMac' : 'Waiting for LocalBridgeMac…';
                const version = res.serverInfo?.serverVersion ? ` v${res.serverInfo.serverVersion}` : '';
                connectionVersion.textContent = statusText + version;
            }
        }).catch(() => {
            statusDot.className = 'dot disconnected';
            connectionVersion.textContent = 'Unable to reach background';
        });
    }

    refreshStatus();
    const pollInterval = setInterval(refreshStatus, 2000);
    window.addEventListener('unload', () => clearInterval(pollInterval));

    // ── Save config & reconnect ──────────────────────────────────
    saveBtn.addEventListener('click', () => {
        const host = hostInput.value.trim();
        const port = parseInt(portInput.value.trim());

        if (!host) {
            alert('Please enter an IP address');
            return;
        }

        if (!port || port < 1024 || port > 65535) {
            alert('Invalid port number (must be 1024 – 65535)');
            return;
        }

        // Validate IP format (basic check)
        const ipPattern = /^[\w\.\-]+$/;
        if (!ipPattern.test(host)) {
            alert('Invalid IP address format');
            return;
        }

        chrome.storage.local.set({ wsHost: host, wsPort: port }).then(() => {
            chrome.runtime.sendMessage({ type: 'UPDATE_WS_CONFIG', host, port }).then(() => {
                // Show success feedback
                saveBtn.textContent = 'Saved!';
                saveBtn.style.background = '#22c55e';
                setTimeout(() => {
                    saveBtn.textContent = 'Save & Reconnect';
                    saveBtn.style.background = '#1d9bf0';
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

    // ── Save name & reconnect ────────────────────────────────────
    saveNameBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();

        if (!name) {
            alert('Please enter a name');
            return;
        }

        if (name.length > 20) {
            alert('Name must be 20 characters or less');
            return;
        }

        chrome.storage.local.set({ 'bridge.instanceName': name }).then(() => {
            chrome.runtime.sendMessage({ type: 'UPDATE_INSTANCE_NAME', name }).then(() => {
                // Show success feedback
                saveNameBtn.textContent = 'Saved!';
                saveNameBtn.style.background = '#22c55e';
                setTimeout(() => {
                    saveNameBtn.textContent = 'Save Name & Reconnect';
                    saveNameBtn.style.background = '#1d9bf0';
                    refreshStatus();
                }, 1500);
            });
        });
    });
});
