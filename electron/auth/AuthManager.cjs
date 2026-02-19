const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { safeStorage } = require('electron');
const { Microsoft } = require('minecraft-java-core');

class AuthManagerError extends Error {
    constructor(code, message, details = null) {
        super(message);
        this.name = 'AuthManagerError';
        this.code = code;
        this.details = details;
    }
}

class AuthManager {
    constructor(options = {}) {
        this.storageDir = options.storageDir;
        this.filePath = options.filePath || path.join(this.storageDir, 'account.json');
        this.microsoftClientId = options.microsoftClientId;
        this.microsoftRedirectUri = options.microsoftRedirectUri;
        this.expirySkewMs = Number.isFinite(options.expirySkewMs) ? options.expirySkewMs : 120000;

        if (!this.storageDir) {
            throw new Error('AuthManager requires a storageDir');
        }
    }

    createMicrosoftClient() {
        return new Microsoft(this.microsoftClientId, this.microsoftRedirectUri);
    }

    emptyStore() {
        return {
            version: 2,
            updated_at: Date.now(),
            active_uuid: null,
            accounts: []
        };
    }

    normalizeStore(rawStore) {
        const store = this.emptyStore();
        if (!rawStore || typeof rawStore !== 'object') {
            return store;
        }

        // Migration depuis ancien format (single account)
        if (rawStore.account) {
            const single = this.normalizeAuthenticator(rawStore.account);
            return {
                version: 2,
                updated_at: Date.now(),
                active_uuid: single.uuid,
                accounts: [single]
            };
        }

        if (rawStore.version !== 2 || !Array.isArray(rawStore.accounts)) {
            return store;
        }

        const accounts = [];
        for (const entry of rawStore.accounts) {
            try {
                accounts.push(this.normalizeAuthenticator(entry));
            } catch (_) {
                // ignore invalid account
            }
        }

        const activeUuid = typeof rawStore.active_uuid === 'string' ? rawStore.active_uuid : null;
        const hasActive = activeUuid && accounts.some(acc => acc.uuid === activeUuid);

        return {
            version: 2,
            updated_at: Date.now(),
            active_uuid: hasActive ? activeUuid : (accounts[0]?.uuid || null),
            accounts
        };
    }

    async loadStore() {
        if (!fs.existsSync(this.filePath)) {
            return this.emptyStore();
        }

        let raw;
        try {
            raw = await fsp.readFile(this.filePath, 'utf8');
        } catch (error) {
            throw new AuthManagerError('STORAGE_READ_FAILED', `Impossible de lire la session locale: ${error.message}`);
        }

        try {
            const parsed = this.deserializePayload(raw);
            return this.normalizeStore(parsed);
        } catch (_) {
            await this.clearAllAccounts();
            return this.emptyStore();
        }
    }

    async saveStore(store) {
        const normalizedStore = this.normalizeStore(store);
        normalizedStore.updated_at = Date.now();

        const data = this.serializePayload(normalizedStore);
        await fsp.mkdir(path.dirname(this.filePath), { recursive: true });

        const tmpPath = `${this.filePath}.${crypto.randomUUID()}.tmp`;
        await fsp.writeFile(tmpPath, data, { encoding: 'utf8', mode: 0o600 });
        await fsp.rename(tmpPath, this.filePath);

        return normalizedStore;
    }

    async login(options = {}) {
        const { persist = true } = options;
        const ms = this.createMicrosoftClient();
        let result;

        try {
            result = await ms.getAuth();
        } catch (error) {
            throw new AuthManagerError('NETWORK_ERROR', `Connexion Microsoft impossible: ${error.message}`);
        }

        if (result === false) {
            throw new AuthManagerError('AUTH_CANCELLED', 'Connexion annulée par l utilisateur.');
        }

        if (this.isErrorPayload(result)) {
            throw this.toAuthError(result, 'Échec de la connexion Microsoft.');
        }

        const normalized = this.normalizeAuthenticator(result);
        if (persist) {
            await this.saveAccount(normalized, { setActive: true });
        }
        return normalized;
    }

    async refreshIfNeeded(options = {}) {
        const { account: providedAccount = null, persist = true } = options;
        const account = providedAccount || await this.loadAccount();
        if (!account) {
            throw new AuthManagerError('AUTH_REQUIRED', 'Aucun compte Microsoft connecté.');
        }

        const now = Date.now();
        if (!Number.isFinite(account.expires_at) || now >= (account.expires_at - this.expirySkewMs)) {
            return this.refreshToken(account, { persist });
        }

        return this.toAuthenticator(account);
    }

    async refreshToken(existingAccount = null, options = {}) {
        const { persist = true } = options;
        const account = existingAccount || await this.loadAccount();
        if (!account) {
            throw new AuthManagerError('AUTH_REQUIRED', 'Aucun compte Microsoft connecté.');
        }

        const ms = this.createMicrosoftClient();
        let refreshed;

        try {
            refreshed = await ms.refresh(this.toAuthenticator(account));
        } catch (error) {
            throw new AuthManagerError('NETWORK_ERROR', `Impossible de rafraîchir la session: ${error.message}`);
        }

        if (this.isErrorPayload(refreshed)) {
            const isLikelyNetwork = refreshed.errorType === 'network';
            if (isLikelyNetwork) {
                throw new AuthManagerError('NETWORK_ERROR', 'Réseau indisponible pendant le refresh du token.', refreshed);
            }

            if (persist) {
                await this.clearAccount(account.uuid);
            }
            throw new AuthManagerError(
                'AUTH_RELOGIN_REQUIRED',
                'Session Microsoft expirée ou invalide. Reconnexion requise.',
                refreshed
            );
        }

        const normalized = this.normalizeAuthenticator(refreshed);
        if (persist) {
            await this.saveAccount(normalized, { setActive: true });
        }
        return this.toAuthenticator(normalized);
    }

    async saveAccount(account, options = {}) {
        const { setActive = true } = options;
        const normalized = this.normalizeAuthenticator(account);
        const store = await this.loadStore();

        const existingIndex = store.accounts.findIndex(acc => acc.uuid === normalized.uuid);
        if (existingIndex >= 0) {
            store.accounts[existingIndex] = normalized;
        } else {
            store.accounts.push(normalized);
        }

        if (setActive || !store.active_uuid) {
            store.active_uuid = normalized.uuid;
        }

        await this.saveStore(store);
        return normalized;
    }

    async loadAccount() {
        const store = await this.loadStore();
        if (!store.accounts.length) {
            return null;
        }

        const active = store.accounts.find(acc => acc.uuid === store.active_uuid);
        return active || store.accounts[0];
    }

    async listAccounts() {
        const store = await this.loadStore();
        return store.accounts.map(acc => this.getPublicAccount(acc));
    }

    async selectAccount(uuid) {
        if (!uuid) {
            throw new AuthManagerError('INVALID_ACCOUNT_DATA', 'UUID de compte manquant.');
        }

        const store = await this.loadStore();
        const account = store.accounts.find(acc => acc.uuid === uuid);
        if (!account) {
            throw new AuthManagerError('ACCOUNT_NOT_FOUND', 'Compte introuvable.');
        }

        store.active_uuid = account.uuid;
        await this.saveStore(store);
        return account;
    }

    async clearAccount(uuid = null) {
        const store = await this.loadStore();
        if (!store.accounts.length) {
            return;
        }

        let targetUuid = uuid;
        if (!targetUuid) {
            targetUuid = store.active_uuid || null;
        }

        if (!targetUuid) {
            await this.clearAllAccounts();
            return;
        }

        const filtered = store.accounts.filter(acc => acc.uuid !== targetUuid);
        if (filtered.length === 0) {
            await this.clearAllAccounts();
            return;
        }

        store.accounts = filtered;
        if (store.active_uuid === targetUuid) {
            store.active_uuid = filtered[0].uuid;
        }

        await this.saveStore(store);
    }

    async clearAllAccounts() {
        try {
            await fsp.unlink(this.filePath);
        } catch (error) {
            if (error && error.code !== 'ENOENT') {
                throw new AuthManagerError('STORAGE_DELETE_FAILED', `Impossible de supprimer la session locale: ${error.message}`);
            }
        }
    }

    getPublicAccount(account) {
        const normalized = this.normalizeAuthenticator(account);
        return {
            uuid: normalized.uuid,
            name: normalized.username,
            expires_at: normalized.expires_at
        };
    }

    toAuthenticator(account) {
        const normalized = this.normalizeAuthenticator(account);
        return {
            access_token: normalized.access_token,
            client_token: normalized.client_token,
            uuid: normalized.uuid,
            name: normalized.username,
            refresh_token: normalized.refresh_token,
            user_properties: normalized.user_properties,
            meta: {
                type: 'Xbox',
                access_token_expires_in: normalized.expires_at,
                demo: false
            },
            xboxAccount: normalized.xboxAccount || {
                xuid: '',
                gamertag: '',
                ageGroup: ''
            },
            profile: normalized.profile || {
                skins: [],
                capes: []
            }
        };
    }

    normalizeAuthenticator(account) {
        const source = account || {};
        const uuid = source.uuid;
        const username = source.username || source.name;
        const accessToken = source.access_token;
        const refreshToken = source.refresh_token;
        const expiresAt = source.expires_at || source?.meta?.access_token_expires_in;

        if (!uuid || !username || !accessToken || !refreshToken || !Number.isFinite(Number(expiresAt))) {
            throw new AuthManagerError('INVALID_ACCOUNT_DATA', 'Données de session Microsoft invalides ou incomplètes.');
        }

        return {
            uuid: String(uuid),
            username: String(username),
            access_token: String(accessToken),
            refresh_token: String(refreshToken),
            expires_at: Number(expiresAt),
            client_token: source.client_token ? String(source.client_token) : crypto.randomUUID(),
            user_properties: source.user_properties ? String(source.user_properties) : '{}',
            xboxAccount: source.xboxAccount || {
                xuid: '',
                gamertag: '',
                ageGroup: ''
            },
            profile: source.profile || {
                skins: [],
                capes: []
            }
        };
    }

    isErrorPayload(value) {
        return !!(value && typeof value === 'object' && typeof value.error === 'string');
    }

    toAuthError(payload, fallbackMessage) {
        const baseMessage = payload.errorMessage || payload.error_description || payload.error || fallbackMessage;
        const message = String(baseMessage || fallbackMessage);

        if (payload.errorType === 'network') {
            return new AuthManagerError('NETWORK_ERROR', message, payload);
        }

        return new AuthManagerError('TOKEN_REFRESH_FAILED', message, payload);
    }

    serializePayload(payload) {
        const plain = JSON.stringify(payload);
        if (safeStorage.isEncryptionAvailable()) {
            const encrypted = safeStorage.encryptString(plain).toString('base64');
            return JSON.stringify({
                version: 1,
                encrypted: true,
                algorithm: 'electron.safeStorage',
                data: encrypted
            });
        }

        return JSON.stringify({
            version: 1,
            encrypted: false,
            data: payload
        });
    }

    deserializePayload(serialized) {
        const wrapper = JSON.parse(serialized);

        if (wrapper && wrapper.encrypted && typeof wrapper.data === 'string') {
            if (!safeStorage.isEncryptionAvailable()) {
                throw new Error('Encryption unavailable');
            }
            const decrypted = safeStorage.decryptString(Buffer.from(wrapper.data, 'base64'));
            return JSON.parse(decrypted);
        }

        if (wrapper && wrapper.encrypted === false && wrapper.data) {
            return wrapper.data;
        }

        // Backward compatibility: plain payload directly in file.
        return wrapper;
    }
}

module.exports = {
    AuthManager,
    AuthManagerError
};
