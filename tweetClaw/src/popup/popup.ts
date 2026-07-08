import { initI18n, t } from '../utils/i18n';
import { DEFAULT_WS_PORT, DEFAULT_REST_PORT } from '../config';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize i18n
    initI18n();

    // ── View Elements ─────────────────────────────────────────────
    const mainView = document.getElementById('mainView') as HTMLDivElement;
    const globalSettingsView = document.getElementById('globalSettingsView') as HTMLDivElement;
    const xDetailsView = document.getElementById('xDetailsView') as HTMLDivElement;
    const xhsDetailsView = document.getElementById('xhsDetailsView') as HTMLDivElement;
    const igDetailsView = document.getElementById('igDetailsView') as HTMLDivElement;

    // ── Navigation Buttons ────────────────────────────────────────
    const btnSettings = document.getElementById('btnSettings') as HTMLButtonElement;
    const btnBackFromSettings = document.getElementById('btnBackFromSettings') as HTMLButtonElement;
    const btnBackFromX = document.getElementById('btnBackFromX') as HTMLButtonElement;
    const btnBackFromXHS = document.getElementById('btnBackFromXHS') as HTMLButtonElement;
    const btnBackFromIG = document.getElementById('btnBackFromIG') as HTMLButtonElement;
    const platformX = document.getElementById('platformX') as HTMLDivElement;
    const platformXHS = document.getElementById('platformXHS') as HTMLDivElement;
    const platformIG = document.getElementById('platformIG') as HTMLDivElement;

    // ── Main View Status Elements ─────────────────────────────────
    const mainStatusCard = document.getElementById('mainStatusCard') as HTMLDivElement;
    const mainStatusDot = document.getElementById('mainStatusDot') as HTMLSpanElement;
    const mainStatusLabel = document.getElementById('mainStatusLabel') as HTMLDivElement;
    const mainStatusUrl = document.getElementById('mainStatusUrl') as HTMLDivElement;
    const mainStatusVersion = document.getElementById('mainStatusVersion') as HTMLDivElement;
    const btnMainConnect = document.getElementById('btnMainConnect') as HTMLButtonElement;

    // ── Settings View Elements ────────────────────────────────────
    const settingsIp = document.getElementById('settingsIp') as HTMLInputElement;
    const settingsPort = document.getElementById('settingsPort') as HTMLInputElement;
    const settingsRestPort = document.getElementById('settingsRestPort') as HTMLInputElement;
    const settingsName = document.getElementById('settingsName') as HTMLInputElement;
    const btnReconnect = document.getElementById('btnReconnect') as HTMLButtonElement;
    const btnSaveReconnect = document.getElementById('btnSaveReconnect') as HTMLButtonElement;
    const btnSaveName = document.getElementById('btnSaveName') as HTMLButtonElement;
    const settingsStatusMsg = document.getElementById('settingsStatusMsg') as HTMLDivElement;

    // ── View Switching Helper ─────────────────────────────────────
    function showView(viewId: string) {
        [mainView, globalSettingsView, xDetailsView, xhsDetailsView, igDetailsView].forEach(v => v.classList.add('hidden'));
        const target = document.getElementById(viewId);
        if (target) target.classList.remove('hidden');
    }

    // ── Navigation Event Listeners ────────────────────────────────
    btnSettings.addEventListener('click', () => {
        showView('globalSettingsView');
        refreshSettingsStatus();
    });

    btnBackFromSettings.addEventListener('click', () => showView('mainView'));
    btnBackFromX.addEventListener('click', () => showView('mainView'));
    btnBackFromXHS.addEventListener('click', () => showView('mainView'));
    btnBackFromIG.addEventListener('click', () => showView('mainView'));

    platformX.addEventListener('click', () => showView('xDetailsView'));
    platformXHS.addEventListener('click', () => showView('xhsDetailsView'));
    platformIG.addEventListener('click', () => showView('igDetailsView'));

    // ── Load saved config ──────────────────────────────────────────
    chrome.storage.local.get(['wsHost', 'wsPort', 'restPort', 'bridge.instanceName']).then(res => {
        settingsIp.value = (res.wsHost as string) || '127.0.0.1';
        settingsPort.value = String((res.wsPort as number) || DEFAULT_WS_PORT);
        settingsRestPort.value = String((res.restPort as number) || DEFAULT_REST_PORT);
        settingsName.value = (res['bridge.instanceName'] as string) || '';
    });

    // ── Refresh Main View Status ───────────────────────────────────
    function refreshMainStatus() {
        if (mainView.classList.contains('hidden')) return;

        chrome.runtime.sendMessage({ type: 'GET_BRIDGE_STATUS' }).then((res: any) => {
            if (res) {
                const connected = res.connected;
                mainStatusCard.className = `status-card ${connected ? 'connected' : 'disconnected'}`;
                mainStatusDot.className = `status-dot ${connected ? 'connected' : 'disconnected'}`;
                mainStatusUrl.textContent = res.url || `ws://127.0.0.1:${DEFAULT_WS_PORT}/ws`;

                const statusKey = connected ? 'status.connected' : 'status.waiting';
                mainStatusLabel.textContent = t(statusKey);

                const version = res.serverInfo?.serverVersion ? `v${res.serverInfo.serverVersion}` : '';
                mainStatusVersion.textContent = version;

                // 仅在未连接时显示 Connect 按钮
                if (connected) {
                    btnMainConnect.classList.add('hidden');
                } else {
                    btnMainConnect.classList.remove('hidden');
                }
            }
        }).catch(() => {
            mainStatusCard.className = 'status-card disconnected';
            mainStatusDot.className = 'status-dot disconnected';
            mainStatusLabel.textContent = t('status.unreachable');
            mainStatusVersion.textContent = '';
            btnMainConnect.classList.remove('hidden');
        });
    }

    // ── Connect button (main view) ─────────────────────────────────
    btnMainConnect.addEventListener('click', () => {
        btnMainConnect.textContent = 'Connecting…';
        btnMainConnect.disabled = true;
        chrome.storage.local.get(['wsHost', 'wsPort', 'restPort']).then(res => {
            const host = (res.wsHost as string) || '127.0.0.1';
            const port = (res.wsPort as number) || DEFAULT_WS_PORT;
            const restPort = (res.restPort as number) || DEFAULT_REST_PORT;
            chrome.runtime.sendMessage({ type: 'UPDATE_WS_CONFIG', host, port, restPort }).then(() => {
                setTimeout(() => {
                    btnMainConnect.textContent = 'Connect';
                    btnMainConnect.disabled = false;
                    refreshMainStatus();
                }, 1500);
            }).catch(() => {
                btnMainConnect.textContent = 'Connect';
                btnMainConnect.disabled = false;
            });
        });
    });

    // ── Refresh Settings View Status ───────────────────────────────
    function refreshSettingsStatus() {
        if (globalSettingsView.classList.contains('hidden')) return;

        chrome.runtime.sendMessage({ type: 'GET_BRIDGE_STATUS' }).then((res: any) => {
            // Could add settings-specific status display here if needed
        });
    }

    // Initial status refresh
    refreshMainStatus();

    // Poll for status updates
    const pollInterval = setInterval(() => {
        refreshMainStatus();
        refreshSettingsStatus();
    }, 2000);
    window.addEventListener('unload', () => clearInterval(pollInterval));

    // ── Reconnect button ───────────────────────────────────────────
    btnReconnect.addEventListener('click', () => {
        chrome.storage.local.get(['wsHost', 'wsPort', 'restPort']).then(res => {
            const host = (res.wsHost as string) || '127.0.0.1';
            const port = (res.wsPort as number) || DEFAULT_WS_PORT;
            const restPort = (res.restPort as number) || DEFAULT_REST_PORT;

            chrome.runtime.sendMessage({ type: 'UPDATE_WS_CONFIG', host, port, restPort }).then(() => {
                settingsStatusMsg.textContent = t('form.reconnect.success') || 'Reconnecting...';
                setTimeout(() => {
                    settingsStatusMsg.textContent = '';
                    refreshMainStatus();
                }, 1500);
            });
        });
    });

    // ── Save config & reconnect ────────────────────────────────────
    btnSaveReconnect.addEventListener('click', () => {
        const host = settingsIp.value.trim();
        const port = parseInt(settingsPort.value.trim());
        const restPort = parseInt(settingsRestPort.value.trim());

        if (!host) {
            alert(t('alert.invalid_ip'));
            return;
        }

        if (!port || port < 1024 || port > 65535) {
            alert(t('alert.invalid_port'));
            return;
        }

        if (!restPort || restPort < 1024 || restPort > 65535) {
            alert(t('alert.invalid_port'));
            return;
        }

        // Simple IP format validation
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(host)) {
            alert(t('alert.invalid_ip_format'));
            return;
        }

        chrome.storage.local.set({ wsHost: host, wsPort: port, restPort }).then(() => {
            chrome.runtime.sendMessage({ type: 'UPDATE_WS_CONFIG', host, port, restPort }).then(() => {
                settingsStatusMsg.textContent = t('form.save.success') || 'Saved!';
                setTimeout(() => {
                    settingsStatusMsg.textContent = '';
                    refreshMainStatus();
                }, 1500);
            });
        });
    });

    // ── Save name & reconnect ──────────────────────────────────────
    btnSaveName.addEventListener('click', () => {
        const name = settingsName.value.trim();

        if (!name) {
            alert(t('alert.invalid_name'));
            return;
        }

        if (name.length > 20) {
            alert(t('alert.name_too_long'));
            return;
        }

        chrome.storage.local.set({ 'bridge.instanceName': name }).then(() => {
            chrome.runtime.sendMessage({ type: 'UPDATE_INSTANCE_NAME', name }).then(() => {
                settingsStatusMsg.textContent = t('name.save.success') || 'Saved!';
                setTimeout(() => {
                    settingsStatusMsg.textContent = '';
                }, 1500);
            });
        });
    });
});