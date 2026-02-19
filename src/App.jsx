import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import Login from './components/Login';
import Home from './components/Home';
import Settings from './components/Settings';
import Logs from './components/Logs';
import Legal from './components/Legal';
import LauncherService from './services/LauncherService';
import './App.css';

// Get games path from main process
const ipcRenderer = window.electron?.ipcRenderer;
const path = window.electron?.path;
const os = window.electron?.os;

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login');
  const [config, setConfig] = useState({ memoryMin: '2G', memoryMax: '4G' });
  const [isLaunching, setIsLaunching] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 100 });
  const [logs, setLogs] = useState([]);
  const [gamesPath, setGamesPath] = useState(null); // Will be fetched from main process
  const [showToast, setShowToast] = useState(false);
  const [isToastHiding, setIsToastHiding] = useState(false);

  // Check if we're in logs view
  const isLogsView = window.location.hash === '#logs';

  if (isLogsView) {
    return <Logs />;
  }

  // Refs for event listeners
  const userRef = React.useRef(user);
  const logsRef = React.useRef("");

  // Helper function to determine log type
  const getLogType = (logLine) => {
    const upperLine = logLine.toUpperCase();
    if (upperLine.includes('ERROR')) {
      return 'error';
    } else if (upperLine.includes('WARN')) {
      return 'warning';
    } else if (upperLine.includes('INFO')) {
      return 'info';
    } else if (upperLine.includes('DEBUG') || upperLine.includes('DEBUG:')) {
      return 'debug';
    } else if (upperLine.includes('[TRACE]') || upperLine.includes('TRACE:')) {
      return 'trace';
    } else {
      return 'default';
    }
  };

  // Function to generate crash report on desktop
  const generateCrashReport = (logs, username, exitCode) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `arkyn-crash-${timestamp}.txt`;
    
    // Get desktop path based on OS
    const getDesktopPath = () => {
      const os = window.electron?.os;
      if (!os) return '/tmp/';
      
      const homedir = os.homedir();
      if (process.platform === 'win32') {
        return path.join(homedir, 'Desktop');
      } else {
        return path.join(homedir, 'Desktop');
      }
    };
    
    const reportContent = `=== ARKYN LAUNCHER CRASH REPORT ===
Generated: ${new Date().toLocaleString()}
User: ${username}
Exit Code: ${exitCode || 'Unknown'}

=== LOGS ===
${logs}

=== END OF REPORT ===
`;
    
    console.log('[App] Generating crash report with filename:', filename);
    console.log('[App] Report content length:', reportContent.length);
    
    // Create and download the file
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    const onUnhandledRejection = (event) => {
      console.error('[App] Unhandled promise rejection:', event.reason);
    };
    const onWindowError = (event) => {
      console.error('[App] Uncaught error:', event.error || event.message);
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onWindowError);

    // 0. Fetch Games Path
    if (ipcRenderer?.invoke) {
      const promise = ipcRenderer.invoke('get-games-path');
      if (promise) {
        promise.then(path => {
          console.log("Games path received:", path);
          setGamesPath(path);
        }).catch(err => console.error("Failed to get games path:", err));
      } else {
        console.error("IPC invoke returned undefined for 'get-games-path'. Check whitelist.");
      }
    }

    // 1. Setup Listeners
    // ... rest of listeners ...
    const cleanProgress = LauncherService.onProgress((data) => {
      // Determines current phase based on data source?
      // Actually `launcher-progress` is for Minecraft assets (After mods).
      // So we map this to 30-90% range.
      // But `launcher-progress` returns {progress, size}.
      // Usually progress is bytes or count.
      // data.progress typically is "current bytes" and data.size is "total bytes".
      if (data.size > 0) {
        const percent = (data.progress / data.size) * 100;
        const mapped = 30 + (percent * 0.6); // 30% to 90%
        setProgress({ current: mapped, total: 100 });
      }
    });

    // Setup explicit listener for MODS progress
    const modsHandler = (data) => {
      // data: { current, total }
      // Map to 10-30%
      if (data && data.total > 0) {
        const percent = (data.current / data.total) * 100;
        const mapped = 10 + (percent * 0.2); // 10% to 30%
        setProgress({ current: mapped, total: 100 });
      }
    };
    ipcRenderer?.on('mods-progress', modsHandler);

    const cleanData = LauncherService.onData((data) => {
      // Ensure data is properly converted to string
      const line = typeof data === 'string' ? data : String(data);
      logsRef.current = (logsRef.current + line + '\n').slice(-50000); // larger buffer with newlines
      setLogs(prev => [...prev.slice(-100), line]); // Keep last 100 lines for UI
    });

    const closeHandler = (code) => {
      console.log('[App] Game closed with code:', code);
      setIsLaunching(false);
      // Close log window when game closes
      ipcRenderer.send('close-log-window');

      const isCleanStop = logsRef.current.includes("Stopping!") || code === 0 || code === '0' || code === null;
      console.log('[App] Is clean stop:', isCleanStop);
      console.log('[App] LogsRef length:', logsRef.current.length);

      if (!isCleanStop) {
        console.log('[App] Should show crash dialog');
        if (window.confirm(`Le jeu a crashé. Voulez-vous générer un rapport ?`)) {
          console.log('[App] User confirmed crash report');
          generateCrashReport(logsRef.current, userRef.current?.name || 'Unknown', code);
          alert("Rapport généré !");
        } else {
          console.log('[App] User cancelled crash report');
        }
      } else {
        console.log('[App] Clean stop, no crash dialog');
      }
    };
    ipcRenderer?.on('launcher-close', closeHandler);

    // 2. Load Config from Server (Default/Global)
    // We don't really need to load this on mount if we load it on launch, 
    // BUT we might want to pre-fill settings.
    LauncherService.getConfig("crazytown-fa").then(serverConfig => {
      if (serverConfig) {
        setConfig(prev => ({
          ...prev,
          memoryMin: serverConfig.min_ram,
          memoryMax: serverConfig.max_ram,
          serverConfig // Store whole object for logic
        }));
      }
    });

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onWindowError);
      cleanProgress(); // Removes launcher-progress
      ipcRenderer?.removeListener('mods-progress', modsHandler);
      cleanData();
      ipcRenderer?.removeListener('launcher-close', closeHandler);
    };
  }, []);

  const handleLaunch = async (selectedGame) => {
    setIsLaunching(true);
    setProgress({ current: 0, total: 100 });
    setLogs([]);

    console.log('=== LAUNCH STARTED ===');
    console.log('Selected game:', selectedGame.name);
    console.log('User:', user.name);

    // Check First Launch
    const firstLaunchKey = `has_launched_${selectedGame.id}`;
    if (!localStorage.getItem(firstLaunchKey)) {
      setShowToast(true);
      setIsToastHiding(false);
      localStorage.setItem(firstLaunchKey, 'true');

      // Hide after 8 seconds
      setTimeout(() => {
        setIsToastHiding(true);
        setTimeout(() => setShowToast(false), 400); // Wait for animation
      }, 8000);
    }

    // Open logs window
    ipcRenderer.send('open-log-window');

    try {
      // 0-10%: Configuration & Auth
      setProgress({ current: 5, total: 100 });

      // FETCH CONFIG SPECIFIC TO THE SELECTED GAME
      const globalConfig = await LauncherService.getConfig(selectedGame.id);

      if (!globalConfig) throw new Error("Impossible de récupérer la configuration du serveur.");
      if (globalConfig.maintenance) {
        throw new Error("Le serveur est en maintenance.");
      }

      setProgress({ current: 10, total: 100 });

      // 2. Fetch Mods & Sync (10-30%)
      let mods;
      try {
        mods = await LauncherService.getMods(selectedGame.id);
      } catch (error) {
        mods = [];
      }

      // 3. Sync mods
      // We pass the FOLDER name now, not the full path, as updated in LauncherService logic
      // Wait, `syncMods` in Service expects `gameFolder`? 
      // Yes, I updated `LauncherService` to delegate to `sync-mods` IPC which takes `gameFolder`.
      // So I pass `selectedGame.folder`.
      try {
        console.log('Starting mods sync...');
        await LauncherService.syncMods(mods, selectedGame.folder);
        console.log('Mods sync completed');
      } catch (error) {
        console.error('Error syncing mods:', error);
      }

      // Set progress to 30% after mods
      setProgress({ current: 30, total: 100 });
      console.log('Progress set to 30% - starting Minecraft download');

      // 4. Download Minecraft assets/libraries (30-90%)
      const launchOptions = {
        path: path.join(gamesPath, selectedGame.folder),
        version: globalConfig.game_version,
        authenticator: user,
        memory: { min: config.memoryMin, max: config.memoryMax },
        loader: {
          type: globalConfig.loader_type,
          build: globalConfig.loader_build,
          enable: globalConfig.loader_type !== 'vanilla'
        },
        quickPlay: {
          type: "multiplayer",
          identifier: globalConfig.server_ip
        },
        expectedMods: (Array.isArray(mods) ? mods : []).map(mod => ({
          name: mod?.name,
          sha1: mod?.sha1
        })),
        JVM_ARGS: []
      };

      console.log('Preparing to launch Minecraft...');

      // 5. Launch game (30-90% -> 100%)
      console.log('Launching game with options...');

      // Check for first launch and show toast
      const firstLaunchKey = `has_launched_${selectedGame.id}`;
      if (!localStorage.getItem(firstLaunchKey)) {
        localStorage.setItem(firstLaunchKey, 'true');
        setShowToast(true);
        setIsToastHiding(false); // Ensure it's not hiding when shown
        setTimeout(() => {
          setIsToastHiding(true);
          setTimeout(() => {
            setShowToast(false);
            setIsToastHiding(false); // Reset for next time
          }, 500); // Duration of the hiding animation
        }, 5000); // Show for 5 seconds
      }

      const launchResult = await LauncherService.launchGame(launchOptions);
      if (!launchResult?.success) {
        if (launchResult?.code === 'AUTH_REQUIRED') {
          setUser(null);
        }
        throw new Error(launchResult?.error || 'Le lancement du jeu a échoué.');
      }

      // We rely on 'launcher-progress' events to move from 30 to 90
      // When 'launcher-close' fires with 0 (or close success), we are done?
      // Actually `launchGame` returns ONLY when the game CLOSES?
      // No, `launchGame` IPC calls `launcher.Launch`.
      // `minecraft-java-core` Launch() usually returns the PROCESS.
      // My IPC wrapper returns `{success: true}` immediately after Launch returns process.
      // So this await returns "immediately" (after checks).
      // Real game play happens now.

      // Set progress to 90% (launched)
      setProgress({ current: 100, total: 100 });
      console.log('=== LAUNCH SEQUENCE COMPLETED ===');

    } catch (error) {
      console.error('Launch error:', error);
      alert(error.message);
      setIsLaunching(false);
      ipcRenderer.send('close-log-window');
    }
  };

  if (!user) {
    return (
      <div className="app-window">
        <Login onLogin={(u) => { setUser(u); setView('home'); }} />
      </div>
    );
  }

  return (
    <div className="app-window shell">
      {showToast && (
        <div className={`toast-notification ${isToastHiding ? 'hiding' : ''}`}>
          <div className="toast-icon">
            <FontAwesomeIcon icon={faInfoCircle} />
          </div>
          <div className="toast-content">
            <h4>Premier Lancement</h4>
            <p>L'installation initiale peut prendre plusieurs minutes. Patience !</p>
          </div>
        </div>
      )}
      <main className="content">
        {view === 'home' && (
          <Home
            user={user}
            onLaunch={handleLaunch}
            isLaunching={isLaunching}
            progress={progress}
            onSettings={() => setView('settings')}
            onLegal={() => setView('legal')}
            onSelectUser={() => {
              setUser(null);
            }}
          />
        )}
        {view === 'settings' && (
          <Settings
            config={config}
            onConfigChange={setConfig}
            onBack={() => setView('home')}
          />
        )}
        {view === 'legal' && (
          <Legal onBack={() => setView('home')} />
        )}
        {view === 'legal' && (
          <Legal onBack={() => setView('home')} />
        )}
      </main>
    </div>
  );
}

export default App;
