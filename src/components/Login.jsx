import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus, faSquare, faTimes, faPlus, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import LauncherService from '../services/LauncherService';

const ipcRenderer = window.electron?.ipcRenderer;

export default function Login({ onLogin }) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [accounts, setAccounts] = useState([]);

    const loadRememberedAccounts = async () => {
        try {
            const result = await LauncherService.getRememberedAccounts();
            if (result?.success && Array.isArray(result.accounts)) {
                setAccounts(result.accounts);
            } else {
                setAccounts([]);
            }
        } catch (e) {
            console.error('[Login] Failed to load remembered accounts:', e);
            setAccounts([]);
        }
    };

    useEffect(() => {
        loadRememberedAccounts();
    }, []);

    const handleLogin = async (forceRemember = null) => {
        setIsLoading(true);
        setError('');
        try {
            const result = await LauncherService.loginMicrosoft(forceRemember);
            if (result.success) {
                await loadRememberedAccounts();
                onLogin(result.result);
            } else {
                setError(result.error || "Échec de l'authentification");
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectAccount = async (uuid) => {
        setIsLoading(true);
        setError('');
        try {
            const result = await LauncherService.selectRememberedAccount(uuid);
            if (result?.success) {
                onLogin(result.result);
            } else {
                setError(result?.error || 'Impossible de sélectionner ce compte.');
                await loadRememberedAccounts();
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgetAccount = async (event, uuid) => {
        event.stopPropagation();
        setIsLoading(true);
        setError('');
        try {
            const result = await LauncherService.forgetRememberedAccount(uuid);
            if (result?.success) {
                if (Array.isArray(result.accounts)) {
                    setAccounts(result.accounts);
                } else {
                    await loadRememberedAccounts();
                }
            } else {
                setError(result?.error || 'Impossible de supprimer ce compte.');
            }
        } catch (e) {
            setError(e.message || 'Impossible de supprimer ce compte.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="app-shell login-page">
            <div className="custom-titlebar">
                <div className="titlebar-drag-region">
                    <div className="window-title">
                        <span className="title-brand">Arkyn Studios - Connexion</span>
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

            <div className="login-main-content">
                <div className="login-brand">
                    <img src="https://static.neutroncore.fr/newarkyn_nobg.png" alt="Arkyn Logo" className="login-logo-img" />
                </div>

                <div className="login-header" style={{ marginBottom: '1em' }}>
                    <h3>Qui veut jouer ?</h3>
                </div>

                <div className="profiles-container">
                    {accounts.map((account) => (
                        <div key={account.uuid} className="profile-card">
                            <div className="profile-card-body" onClick={() => handleSelectAccount(account.uuid)}>
                                <img
                                    src={`https://minotar.net/avatar/${account.name}/150`}
                                    alt={account.name}
                                    className="profile-avatar"
                                />
                                <span className="profile-name">{account.name}</span>
                            </div>
                            <button className="profile-logout" onClick={(event) => handleForgetAccount(event, account.uuid)} title="Oublier ce compte" disabled={isLoading}>
                                <FontAwesomeIcon icon={faSignOutAlt} />
                            </button>
                        </div>
                    ))}

                    <div className="profile-card add-profile-card" onClick={() => !isLoading && handleLogin(true)}>
                         <div className="add-profile-icon">
                            <FontAwesomeIcon icon={faPlus} />
                        </div>
                        <span className="profile-name">Ajouter un profil</span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="login-error-toast" style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
                    <span>{error}</span>
                </div>
            )}

            <div className="login-footer" style={{ position: 'fixed', bottom: '20px', width: '100%' }}>
                <p>
                    Besoin d'aide ?{' '}
                    <a href="https://discord.gg/wbqkz69wuY" target="_blank" rel="noreferrer">
                        Rejoindre le Discord
                    </a>
                </p>
            </div>
        </div>
    );
}
