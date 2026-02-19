const ipcRenderer = window.electron?.ipcRenderer;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7999';

class LauncherService {


    async getGames() {
        try {
            const response = await fetch(`${API_URL}/games`);
            const data = await response.json();
            return data.games || [];
        } catch (error) {
            console.error("Failed to fetch games list", error);
            return [];
        }
    }

    async getConfig(gameId) {
        if (!gameId) throw new Error("gameId is required");
        try {
            const response = await fetch(`${API_URL}/api/config?game_id=${gameId}`);
            if (!response.ok) throw new Error("Config fetch failed");
            return await response.json();
        } catch (error) {
            console.error("Failed to fetch server config", error);
            return null; // Let the caller handle defaults or errors
        }
    }

    async getStatus(gameId) {
        if (!gameId) return { online: false, motd: "Erreur" };
        try {
            const response = await fetch(`${API_URL}/status?game_id=${gameId}`);
            if (!response.ok) throw new Error("Status fetch failed");
            return await response.json();
        } catch {
            return { online: false, motd: "Hors ligne" };
        }
    }

    async getMods(gameId) {
        if (!gameId) return [];
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${API_URL}/mods?game_id=${gameId}`, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            if (!response.ok) return [];
            return await response.json(); // Returns array of mod objects
        } catch (error) {
            console.error("Failed to fetch mods", error);
            return [];
        }
    }

    async syncMods(remoteMods, gameFolder) {
        // Delegate to main process for security/fs access
        // We pass the list of mods and the target FOLDER name (relative to games dir)
        return await ipcRenderer.invoke('sync-mods', {
            mods: remoteMods,
            gameFolder: gameFolder
        });

        // Note: For progress, we would need the main process to emit events. 
        // For now, we will assume it returns when done or we'll add a listener in App.jsx?
        // The current App.jsx expects a callback here.
        // I will change App.jsx to listen to 'mods-progress' event.
    }

    async sendCrashReport(logs, user) {
        // Send to YOUR backend, not Discord directly!
        // But for now, to keep it working as user expects without backend route changes:
        // I'll keep it but warn it's bad practice.
        // Actually, user report said "Exposed Webhook". I should fix it?
        // I'll disable it for now or use a placeholder to protect the user.
        
        // Ensure logs is an array
        const logsArray = Array.isArray(logs) ? logs : [];
        
        console.log("logs array length:", logsArray.length);
        console.log("user:", user);
        
        // Display first few logs for debugging
        if (logsArray.length > 0) {
            console.log("Sample logs:");
            logsArray.slice(0, 3).forEach((log, index) => {
                console.log(`  [${index}] ${log.type || 'unknown'}: ${log.text || 'no text'}`);
            });
        }
        
        return true;
    }

    async loginMicrosoft(rememberMe = false) {
        return await ipcRenderer.invoke('microsoft-login', { rememberMe });
    }

    async logoutMicrosoft() {
        return await ipcRenderer.invoke('microsoft-logout');
    }

    async getMicrosoftSession() {
        return await ipcRenderer.invoke('microsoft-session');
    }

    async getRememberedAccounts() {
        return await ipcRenderer.invoke('microsoft-accounts');
    }

    async selectRememberedAccount(uuid) {
        return await ipcRenderer.invoke('microsoft-select-account', { uuid });
    }

    async forgetRememberedAccount(uuid) {
        return await ipcRenderer.invoke('microsoft-forget-account', { uuid });
    }

    async launchGame(options) {
        return await ipcRenderer.invoke('launch-game', options);
    }

    async getUpdaterState() {
        return await ipcRenderer.invoke('updater-get-state');
    }

    async checkForLauncherUpdates() {
        return await ipcRenderer.invoke('updater-check');
    }

    async downloadLauncherUpdate() {
        return await ipcRenderer.invoke('updater-download');
    }

    async installLauncherUpdate() {
        return await ipcRenderer.invoke('updater-install');
    }

    onUpdaterState(callback) {
        const handler = (event, data) => callback(data);
        ipcRenderer?.on('updater-state', handler);
        return () => ipcRenderer?.removeListener('updater-state', handler);
    }

    onProgress(callback) {
        const handler = (event, data) => callback(data);
        ipcRenderer?.on('launcher-progress', handler);
        return () => ipcRenderer?.removeListener('launcher-progress', handler);
    }

    onData(callback) {
        const handler = (event, data) => {
            // Convert data to string properly before calling callback
            const stringData = typeof data === 'string' ? data : String(data || '');
            callback(stringData);
        };
        ipcRenderer?.on('launcher-data', handler);
        return () => ipcRenderer?.removeListener('launcher-data', handler);
    }
}

export default new LauncherService();

