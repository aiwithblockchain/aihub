document.addEventListener('DOMContentLoaded', () => {
    const hostInput = document.getElementById('hostInput') as HTMLInputElement;
    const portInput = document.getElementById('portInput') as HTMLInputElement;
    const nameInput = document.getElementById('nameInput') as HTMLInputElement;
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    const statusMsg = document.getElementById('statusMsg') as HTMLDivElement;
    
    // Load config
    chrome.storage.local.get(['wsHost', 'wsPort', 'bridge.instanceName']).then((res: any) => {
        if (res.wsHost) {
            hostInput.value = res.wsHost;
        } else {
            hostInput.value = '127.0.0.1'; // default for aiClaw
        }
        if (res.wsPort) {
            portInput.value = String(res.wsPort);
        } else {
            portInput.value = '10087'; // default for aiClaw
        }
        if (res['bridge.instanceName']) {
            nameInput.value = res['bridge.instanceName'];
        }
    });

    saveBtn.addEventListener('click', () => {
        const host = hostInput.value.trim() || '127.0.0.1';
        const p = parseInt(portInput.value.trim());
        const name = nameInput.value.trim();
        if (!p || p < 1024 || p > 65535) {
            alert('Invalid port');
            return;
        }
        chrome.storage.local.set({ wsHost: host, wsPort: p, 'bridge.instanceName': name }).then(() => {
            statusMsg.textContent = 'Saved! Reconnecting...';
            // notify background script
            chrome.runtime.sendMessage({ type: 'WS_PORT_CHANGED', host: host, port: p }).then(() => {
                setTimeout(() => window.close(), 1000);
            }).catch(() => {
                setTimeout(() => window.close(), 1000);
            });
        });
    });
});
