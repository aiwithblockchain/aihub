document.addEventListener('DOMContentLoaded', () => {
    const portInput = document.getElementById('portInput') as HTMLInputElement;
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    const statusMsg = document.getElementById('statusMsg') as HTMLDivElement;
    
    // Load config
    chrome.storage.local.get('wsPort').then((res: any) => {
        if (res.wsPort) {
            portInput.value = String(res.wsPort);
        } else {
            portInput.value = '8766'; // default for aiClaw
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
});
