const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const os = require('os');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'electron', {
    ipcRenderer: {
        send: (channel, data) => {
            // whitelist channels
            let validChannels = ['window-minimize', 'window-maximize', 'window-close', 'open-log-window', 'close-log-window'];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        invoke: (channel, data) => {
            let validChannels = ['launch-game', 'microsoft-login', 'microsoft-logout', 'microsoft-session', 'microsoft-accounts', 'microsoft-select-account', 'microsoft-forget-account', 'sync-mods', 'get-games-path', 'updater-get-state', 'updater-check', 'updater-download', 'updater-install'];
            if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, data);
            }
        },
        on: (channel, func) => {
            let validChannels = ['launcher-data', 'launcher-progress', 'launcher-close', 'mods-progress', 'updater-state'];
            if (validChannels.includes(channel)) {
                // Properly forward event and args to maintain the expected signature
                ipcRenderer.on(channel, (event, ...args) => func(event, ...args));
            }
        },
        removeListener: (channel, func) => {
            ipcRenderer.removeListener(channel, func);
        }
    },
    path: {
        join: (...args) => path.join(...args),
    },
    os: {
        homedir: () => os.homedir()
    }
}
);
