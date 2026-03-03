import React from 'react';

export default function Legal({ onBack }) {
    const dependencies = [
        {
            name: 'minecraft-java-core',
            author: 'Luuxis',
            url: 'https://github.com/luuxis/minecraft-java-core'
        },
        {
            name: 'electron',
            author: 'OpenJS Foundation',
            url: 'https://www.electronjs.org'
        },
        {
            name: 'react',
            author: 'Meta (Meta Platforms, Inc.)',
            url: 'https://react.dev'
        },
        {
            name: 'react-dom',
            author: 'Meta (Meta Platforms, Inc.)',
            url: 'https://react.dev'
        },
        {
            name: 'vite',
            author: 'Evan You & Vite Team',
            url: 'https://vitejs.dev'
        },
        {
            name: '@fortawesome/fontawesome-free',
            author: 'Fonticons, Inc.',
            url: 'https://fontawesome.com'
        },
        {
            name: '@fortawesome/free-brands-svg-icons',
            author: 'Fonticons, Inc.',
            url: 'https://fontawesome.com'
        },
        {
            name: '@fortawesome/free-solid-svg-icons',
            author: 'Fonticons, Inc.',
            url: 'https://fontawesome.com'
        },
        {
            name: '@fortawesome/react-fontawesome',
            author: 'Fonticons, Inc.',
            url: 'https://fontawesome.com'
        },
        {
            name: 'discord-rich-presence',
            author: 'devsnek',
            url: 'https://github.com/devsnek/discord-rich-presence'
        },
        {
            name: 'electron-squirrel-startup',
            author: 'mongodb-js',
            url: 'https://github.com/mongodb-js/electron-squirrel-startup'
        },
        {
            name: 'electron-builder',
            author: 'Electron Userland',
            url: 'https://www.electron.build'
        }
    ];



    return (
        <div className="settings-layout modern-settings">
            <div className="settings-header-nav">
                <button className="back-btn" onClick={onBack}>
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    Retour à l'accueil
                </button>
            </div>

            <div className="settings-header">
                <h2>Mentions Légales</h2>
                <p>Crédits et licences des technologies utilisées.</p>
            </div>

            <div className="legal-content">
                <div className="legal-section">
                    <h3>Dépendances Open Source</h3>
                    <div className="dependencies-grid">
                        {dependencies.map((dep, index) => (
                            <a key={index} href={dep.url} target="_blank" rel="noreferrer" className="dependency-card">
                                <div className="dep-header">
                                    <span className="dep-name">{dep.name}</span>
                                    <span className="dep-author">   |    {dep.author}</span>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>

                <div className="legal-footer">
                    <p>Arkyn Launcher n'est pas affilié à Mojang Studios ou Microsoft.</p>
                </div>
            </div>
        </div>
    );
}
