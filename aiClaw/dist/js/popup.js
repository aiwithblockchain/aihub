/******/ (() => { // webpackBootstrap
/*!****************************!*\
  !*** ./src/popup/popup.ts ***!
  \****************************/
document.addEventListener('DOMContentLoaded', () => {
    const portInput = document.getElementById('portInput');
    const saveBtn = document.getElementById('saveBtn');
    const statusMsg = document.getElementById('statusMsg');
    // Load config
    chrome.storage.local.get('wsPort').then((res) => {
        if (res.wsPort) {
            portInput.value = String(res.wsPort);
        }
        else {
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

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianMvcG9wdXAuanMiLCJtYXBwaW5ncyI6Ijs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esc0NBQXNDO0FBQ3RDO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG1DQUFtQyxXQUFXO0FBQzlDO0FBQ0E7QUFDQSx5Q0FBeUMsa0NBQWtDO0FBQzNFO0FBQ0EsYUFBYTtBQUNiO0FBQ0EsYUFBYTtBQUNiLFNBQVM7QUFDVCxLQUFLO0FBQ0wsQ0FBQyIsInNvdXJjZXMiOlsid2VicGFjazovL2FpQ2xhdy8uL3NyYy9wb3B1cC9wb3B1cC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgKCkgPT4ge1xuICAgIGNvbnN0IHBvcnRJbnB1dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwb3J0SW5wdXQnKTtcbiAgICBjb25zdCBzYXZlQnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NhdmVCdG4nKTtcbiAgICBjb25zdCBzdGF0dXNNc2cgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3RhdHVzTXNnJyk7XG4gICAgLy8gTG9hZCBjb25maWdcbiAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoJ3dzUG9ydCcpLnRoZW4oKHJlcykgPT4ge1xuICAgICAgICBpZiAocmVzLndzUG9ydCkge1xuICAgICAgICAgICAgcG9ydElucHV0LnZhbHVlID0gU3RyaW5nKHJlcy53c1BvcnQpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcG9ydElucHV0LnZhbHVlID0gJzg3NjYnOyAvLyBkZWZhdWx0IGZvciBhaUNsYXdcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHNhdmVCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHAgPSBwYXJzZUludChwb3J0SW5wdXQudmFsdWUudHJpbSgpKTtcbiAgICAgICAgaWYgKCFwIHx8IHAgPCAxMDI0IHx8IHAgPiA2NTUzNSkge1xuICAgICAgICAgICAgYWxlcnQoJ0ludmFsaWQgcG9ydCcpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7IHdzUG9ydDogcCB9KS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIHN0YXR1c01zZy50ZXh0Q29udGVudCA9ICdTYXZlZCEgUmVjb25uZWN0aW5nLi4uJztcbiAgICAgICAgICAgIC8vIG5vdGlmeSBiYWNrZ3JvdW5kIHNjcmlwdFxuICAgICAgICAgICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UoeyB0eXBlOiAnV1NfUE9SVF9DSEFOR0VEJywgcG9ydDogcCB9KS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHdpbmRvdy5jbG9zZSgpLCAxMDAwKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKCgpID0+IHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHdpbmRvdy5jbG9zZSgpLCAxMDAwKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn0pO1xuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9