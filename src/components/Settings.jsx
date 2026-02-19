import React from 'react';

export default function Settings({ config, onConfigChange, onBack }) {

    const handleSave = () => {
        onBack();
    };

    return (
        <div className="settings-layout modern-settings">
            <div className="settings-header-nav">
                <button className="back-btn" onClick={onBack}>
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    Retour à l'accueil
                </button>
            </div>

            <div className="settings-header">
                <h2>Paramètres</h2>
                <p>Configurez vos préférences de jeu et de performance.</p>
            </div>

            <div className="setting-group">
                <div className="setting-item">
                    <div className="setting-text">
                        <h4>Mémoire RAM (Min)</h4>
                        <p>Mémoire allouée minimale pour le jeu.</p>
                    </div>
                    <div className="setting-control">
                        <select 
                            value={config.memoryMin} 
                            onChange={(e) => onConfigChange({ ...config, memoryMin: e.target.value })}
                        >
                            <option value="1G">1 GB</option>
                            <option value="2G">2 GB</option>
                            <option value="3G">3 GB</option>
                            <option value="4G">4 GB</option>
                            <option value="6G">6 GB</option>
                            <option value="8G">8 GB</option>
                        </select>
                    </div>
                </div>

                <div className="setting-item">
                    <div className="setting-text">
                        <h4>Mémoire RAM (Max)</h4>
                        <p>Mémoire allouée maximale pour le jeu.</p>
                    </div>
                    <div className="setting-control">
                        <select 
                            value={config.memoryMax} 
                            onChange={(e) => onConfigChange({ ...config, memoryMax: e.target.value })}
                        >
                            <option value="2G">2 GB</option>
                            <option value="4G">4 GB</option>
                            <option value="6G">6 GB</option>
                            <option value="8G">8 GB</option>
                            <option value="10G">10 GB</option>
                            <option value="12G">12 GB</option>
                            <option value="16G">16 GB</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="settings-footer">
                <button className="save-btn" onClick={handleSave}>ENREGISTRER</button>
            </div>
        </div>
    );
}
