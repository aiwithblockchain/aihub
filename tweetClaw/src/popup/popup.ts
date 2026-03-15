document.addEventListener('DOMContentLoaded', () => {
    const portInput = document.getElementById('portInput') as HTMLInputElement;
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    const debugBtn = document.getElementById('debugBtn') as HTMLButtonElement;
    const statusMsg = document.getElementById('statusMsg') as HTMLDivElement;
    
    // Load config
    chrome.storage.local.get('wsPort').then(res => {
        if (res.wsPort) {
            portInput.value = String(res.wsPort);
        } else {
            portInput.value = '8765'; // default for tweetClaw
        }
    });

    saveBtn.addEventListener('click', () => {
        const p = parseInt(portInput.value.trim());
        if (!p || p < 1024 || p > 65535) {
            alert('Invalid port');
            return;
        }
        chrome.storage.local.set({ wsPort: p }).then(() => {
            statusMsg.textContent = 'Saved! Reconnecting...';
            // notify background script
            chrome.runtime.sendMessage({ type: 'WS_PORT_CHANGED', port: p }).then(() => {
                setTimeout(() => window.close(), 1000);
            }).catch(() => {
                setTimeout(() => window.close(), 1000);
            });
        });
    });

    if (debugBtn) {
        debugBtn.addEventListener('click', () => {
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
        });
    }
});
