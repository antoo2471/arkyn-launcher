import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus, faSquare, faTimes, faTerminal } from '@fortawesome/free-solid-svg-icons';
import '@fortawesome/fontawesome-free/css/all.min.css';

const ipcRenderer = window.electron?.ipcRenderer;

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Always setup listeners if we're in a log window (check window title or other indicator)
    const isLogWindow = window.location.hash === '#logs' || document.title === 'Minecraft Logs';
    
    if (isLogWindow) {
        console.log('[Logs] Component mounted, setting up listeners');
        setIsConnected(true);

      // Listen for log data from main process
      const dataHandler = (event, data) => {
        console.log('[Logs] Received data:', data);
        // Safely convert data to string, handle undefined/null cases
        const line = data != null ? String(data) : '';
        if (line.trim()) { // Only add non-empty lines
          setLogs(prev => {
            const newLogs = [...prev.slice(-500), { text: line, type: getLogType(line) }];
            console.log('[Logs] Updated logs, count:', newLogs.length);
            return newLogs;
          }); // Keep last 500 lines
        }
      };

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

      const closeHandler = () => {
        console.log('[Logs] Game closed');
        setIsConnected(false);
        // Window will be closed by main process
      };

      console.log('[Logs] Setting up IPC listeners');
      ipcRenderer?.on('launcher-data', dataHandler);
      ipcRenderer?.on('launcher-close', closeHandler);

      return () => {
        console.log('[Logs] Cleaning up IPC listeners');
        ipcRenderer?.removeListener('launcher-data', dataHandler);
        ipcRenderer?.removeListener('launcher-close', closeHandler);
      };
    } else {
        console.log('[Logs] Not in log window, skipping setup');
    }
  }, []);

  if (!isConnected) {
    return (
      <div className="app-shell logs-page">
        <div className="custom-titlebar">
          <div className="titlebar-drag-region">
            <div className="window-title">
              <span className="title-brand">Minecraft Logs</span>
            </div>
          </div>
          <div className="window-controls">
            <button className="control-btn minimize" onClick={() => ipcRenderer?.send('window-minimize')}>
              <FontAwesomeIcon icon={faMinus} />
            </button>
            <button className="control-btn maximize" onClick={() => ipcRenderer?.send('window-maximize')}>
              <FontAwesomeIcon icon={faSquare} />
            </button>
            <button className="control-btn close" onClick={() => ipcRenderer?.send('close-log-window')}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        </div>
        <div className="logs-container">
          <div className="logs-loading">
            <div className="loading-icon">
              <FontAwesomeIcon icon={faTerminal} />
            </div>
            <p>En attente des logs...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell logs-page">
      <div className="custom-titlebar">
        <div className="titlebar-drag-region">
          <div className="window-title">
            <span className="title-brand">Minecraft Logs</span>
          </div>
        </div>
        <div className="window-controls">
          <button className="control-btn minimize" onClick={() => ipcRenderer?.send('window-minimize')}>
            <FontAwesomeIcon icon={faMinus} />
          </button>
          <button className="control-btn maximize" onClick={() => ipcRenderer?.send('window-maximize')}>
            <FontAwesomeIcon icon={faSquare} />
          </button>
          <button className="control-btn close" onClick={() => ipcRenderer?.send('close-log-window')}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      </div>
      <div className="logs-container">
        <div className="logs-header">
          <h3>Console Minecraft</h3>
          <span className="log-count">{logs.length} messages</span>
        </div>
        <div className="logs-content">
          {logs.map((log, index) => (
            <div key={index} className={`log-line log-${log.type}`}>
              <span className="log-text">{log.text}</span>
            </div>
          ))}
          <div ref={(el) => el?.scrollIntoView({ behavior: "smooth" })} />
        </div>
      </div>
    </div>
  );
}
