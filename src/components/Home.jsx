import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCog,
    faUsers,
    faCopy,
    faGamepad,
    faGlobe,
    faCity,
    faShieldHalved,
    faMinus,
    faSquare,
    faTimes,
    faGavel
} from '@fortawesome/free-solid-svg-icons';
import LauncherService from '../services/LauncherService';
import '@fortawesome/fontawesome-free/css/all.min.css';

const ipcRenderer = window.electron?.ipcRenderer;

const GAMES = [
    {
        id: 'arkyn-pvp',
        name: 'Arkyn',
        shortName: 'PvP',
        description: 'PvP Faction Moddé complet. Rejoignez l\'élite du combat et du farm.',
        folder: 'arkyn-pvp',
        image: 'https://preview.redd.it/f67g5xwdx1u71.jpg?width=1080&crop=smart&auto=webp&s=a2555349327827c41b2ed48cd22e96fa1f2875d3',
        icon: faShieldHalved
    },
    {
        id: 'crazytown-fa',
        name: 'Crazytown FA',
        shortName: 'FA',
        description: 'Serveur Semi-RP moddé avec une communauté folle. Rejoignez l\'aventure Crazytown.',
        folder: 'crazytown-fa',
        image: 'https://preview.redd.it/f67g5xwdx1u71.jpg?width=1080&crop=smart&auto=webp&s=a2555349327827c41b2ed48cd22e96fa1f2875d3',
        icon: faCity

    },
    {
        id: 'arkyn-nations',
        name: 'Arkyn Nations',
        shortName: 'Nations',
        description: 'Bâtissez votre empire et dominez le monde.',
        folder: 'arkyn-nations',
        image: 'https://preview.redd.it/f67g5xwdx1u71.jpg?width=1080&crop=smart&auto=webp&s=a2555349327827c41b2ed48cd22e96fa1f2875d3',
        icon: faGlobe
    },
    {
        id: 'arkyn-minigames',
        name: 'Arkyn Minigames',
        shortName: 'Mini',
        description: 'Variété de mini-jeux. Fun, PvP, classiques et anciens jeux iconiques.',
        folder: 'arkyn-minigames',
        image: 'https://preview.redd.it/f67g5xwdx1u71.jpg?width=1080&crop=smart&auto=webp&s=a2555349327827c41b2ed48cd22e96fa1f2875d3',
        icon: faGamepad
    }
];

export default function Home({ user, onLaunch, progress, isLaunching, logs, onSettings, onLegal, onSelectUser }) {
    const [status, setStatus] = useState({ online: false, motd: "Chargement...", players: 0 });
    const [showLogs] = useState(false);
    const [selectedGame, setSelectedGame] = useState(GAMES[0]);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [updater, setUpdater] = useState({
        status: 'idle',
        message: 'Mise a jour en attente',
        progressPercent: 0,
        latestVersion: null
    });

    useEffect(() => {
        // Récupérer le status du jeu sélectionné
        LauncherService.getStatus(selectedGame.id).then(setStatus);
    }, [selectedGame]);

    useEffect(() => {
        LauncherService.getUpdaterState()
            .then((state) => state && setUpdater(state))
            .catch(() => { });

        const cleanup = LauncherService.onUpdaterState((state) => {
            if (state) setUpdater(state);
        });

        return cleanup;
    }, []);


    const handlePlay = () => {
        if (isLaunching) return;
        onLaunch(selectedGame);
    };

    const handleUpdateAction = async () => {
        if (updater.status === 'downloaded') {
            await LauncherService.installLauncherUpdate();
            return;
        }
        if (updater.status === 'available' || updater.status === 'downloading') {
            await LauncherService.downloadLauncherUpdate();
            return;
        }
        await LauncherService.checkForLauncherUpdates();
    };

    const updateButtonLabel = (() => {
        if (updater.status === 'downloaded') return 'Redemarrer pour installer';
        if (updater.status === 'available') return 'Telecharger la MAJ';
        if (updater.status === 'downloading') return 'Telechargement...';
        if (updater.status === 'checking') return 'Verification...';
        return 'Verifier les mises a jour';
    })();

    return (
        <div className="app-shell">
            {/* Titlebar personnalisé */}
            <div className="custom-titlebar">
                <div className="titlebar-drag-region">
                    <div className="window-title">
                        <span className="title-brand">Arkyn Studios</span>
                    </div>
                </div>
                <div className="window-controls">
                    <button className="control-btn minimize" onClick={() => ipcRenderer?.send('window-minimize')}>
                        <FontAwesomeIcon icon={faMinus} />
                    </button>
                    <button className="control-btn maximize" onClick={() => ipcRenderer?.send('window-maximize')}>
                        <FontAwesomeIcon icon={faSquare} />
                    </button>
                    <button className="control-btn close" onClick={() => ipcRenderer?.send('window-close')}>
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
            </div>

            <div className="home-container">
                {/* Barre latérale de sélection de serveurs (Style Discord) */}
                <div className="server-sidebar">
                    <div
                        className={`sidebar-logo user-avatar-btn ${showProfileMenu ? 'active' : ''}`}
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        title="Mon Compte"
                    >
                        <img src={`https://minotar.net/avatar/${user.name}/50`} alt="Profile" />
                    </div>

                    {showProfileMenu && (
                        <div className="profile-dropdown-menu">
                            <div className="profile-menu-header">
                                <div className="profile-info-large">
                                    <img src={`https://minotar.net/cube/${user.name}/100`} alt="Avatar" />
                                    <div className="profile-text-info">
                                        <span className="profile-username">{user.name}</span>
                                        <span className="profile-status">Connecté</span>
                                    </div>
                                </div>
                            </div>
                            <div className="profile-menu-divider"></div>
                            <div className="profile-menu-items">
                                <div className="profile-menu-item info">
                                    <span className="item-label">UUID</span>
                                    <button className="copyuuid-btn" onClick={() => { navigator.clipboard.writeText(user.uuid); alert("UUID copié !"); }}>
                                        <FontAwesomeIcon icon={faCopy} />
                                        Copier l'UUID
                                    </button>
                                </div>
                                <div className="profile-menu-item action logout-item" onClick={onSelectUser}>
                                    <FontAwesomeIcon icon={faUsers} className="item-icon-svg" />
                                    <span>Menu utilisateurs</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="sidebar-divider"></div>

                    <div className="server-list">
                        {GAMES.map((game) => (
                            <div
                                key={game.id}
                                className={`server-icon-wrapper ${selectedGame.id === game.id ? 'active' : ''}`}
                                onClick={() => setSelectedGame(game)}
                                title={game.name}
                            >
                                <div className="active-indicator"></div>
                                <div className="server-icon">
                                    <FontAwesomeIcon icon={game.icon} className="game-icon-svg" />
                                    {status.online && selectedGame.id === game.id && (
                                        <div className="status-indicator online"></div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="sidebar-divider"></div>

                    <div className="sidebar-footer-icons">
                        <div className="footer-icon-btn" title="Mentions Légales" onClick={onLegal}>
                            <FontAwesomeIcon icon={faGavel} className="legal-icon-svg" />
                        </div>
                        <div className="footer-icon-btn" title="Paramètres" onClick={onSettings}>
                            <FontAwesomeIcon icon={faCog} className="settings-icon-svg" />
                        </div>
                    </div>
                </div>

                <div className="home-main-content" style={{ backgroundImage: `url(${selectedGame.image})` }}>
                    <div className="home-overlay"></div>

                    <div className="content-inner">
                        {/* Status Pill */}
                        <div className="server-status-pill">
                            <div className={`status-dot ${status.online ? 'online' : 'offline'}`}></div>
                            <span>{status.online ? `EN LIGNE · ${status.players || 0} Joueurs` : "HORS LIGNE"}</span>
                        </div>
                        <div className={`updater-status-pill updater-${updater.status || 'idle'}`}>
                            <div className="updater-text">
                                <span className="updater-title">
                                    {updater.latestVersion ? `MAJ ${updater.latestVersion} disponible` : 'Launcher'}
                                </span>
                                <span className="updater-message">{updater.message}</span>
                            </div>
                            <button
                                className="updater-action-btn"
                                onClick={handleUpdateAction}
                                disabled={updater.status === 'disabled' || updater.status === 'checking' || updater.status === 'downloading'}
                            >
                                {updateButtonLabel}
                            </button>
                        </div>

                        {/* Hero Area */}
                        <div className="hero-section">
                            <div className="game-category">ARKYN STUDIOS PRESENTE</div>
                            <h1 className="hero-title">{selectedGame.name}</h1>
                            <p className="hero-description">{selectedGame.description}</p>

                            <div className="launch-controls">
                                {isLaunching ? (
                                    <div className="progress-wrapper">
                                        <div className="progress-text">
                                            <span>Initialisation de l'aventure...</span>
                                            <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                                        </div>
                                        <div className="progress-track">
                                            <div
                                                className="progress-fill"
                                                style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="button-group">
                                        <button className="play-action-btn" onClick={handlePlay} disabled={!status.online}>
                                            <span className="btn-icon">▶</span> JOUER MAINTENANT
                                        </button>
                                        <button className="secondary-action-btn" onClick={() => window.open('https://discord.gg/wbqkz69wuY', '_blank')}>
                                            DISCORD
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {showLogs && (
                            <div className="logs-panel">
                                {logs.map((log, i) => <div key={i}>{log}</div>)}
                                <div ref={(el) => el?.scrollIntoView({ behavior: "smooth" })} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
