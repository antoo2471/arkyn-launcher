/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const path = require('path')
const { app, BrowserWindow, session } = require('electron')
const DEBUG_AUTH_WINDOW = process.env.DEBUG_AUTH_WINDOW === 'true'
const DEFAULT_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'

const defaultProperties = {
    width: 1000,
    height: 650,
    resizable: false,
    center: true,
    icon: path.join(__dirname, '../../../assets/icons', `Microsoft.${(process.platform === 'win32') ? 'ico' : 'png'}`),
}

module.exports = async function (url: string, redirect_uri: string = "https://login.live.com/oauth20_desktop.srf") {
    await new Promise<void>((resolve) => {
        app.whenReady().then(async () => {
            try {
                const cookies = await session.defaultSession.cookies.get({ domain: 'live.com' });
                if (cookies) {
                    const promises = cookies.map((cookie: any) => {
                        let urlcookie = `http${cookie.secure ? "s" : ""}://${cookie.domain.replace(/^\./, "") + cookie.path}`;
                        return session.defaultSession.cookies.remove(urlcookie, cookie.name);
                    });
                    await Promise.all(promises);
                }
            } catch (e) {
                console.error("Error clearing cookies:", e);
            }
            resolve();
        });
    });

    return new Promise(resolve => {
        app.whenReady().then(() => {
            const mainWindow = new BrowserWindow(defaultProperties)
            mainWindow.webContents.setUserAgent(DEFAULT_USER_AGENT)
            if (DEBUG_AUTH_WINDOW) {
                mainWindow.webContents.openDevTools({ mode: 'detach' })
            }
            mainWindow.setMenu(null);
            mainWindow.loadURL(url);
            mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'allow' }))

            var loading = false;

            const checkUrl = (loc: string) => {
                try {
                    const urlObj = new URL(loc);
                    const redirectObj = new URL(redirect_uri);
                    
                    const urlPath = urlObj.pathname.replace(/\/$/, '');
                    const redirectPath = redirectObj.pathname.replace(/\/$/, '');

                    if (urlObj.hostname === redirectObj.hostname && urlPath === redirectPath) {
                        const code = urlObj.searchParams.get("code");
                        if (code) {
                            resolve(code);
                            loading = true;
                            mainWindow.close();
                        } else {
                            const error = urlObj.searchParams.get("error");
                            if (error) {
                                resolve("cancel");
                                loading = true;
                                mainWindow.close();
                            }
                        }
                    }
                } catch (e) {
                    // Invalid URL
                }
            };

            mainWindow.webContents.on('did-finish-load', () => {
                console.log('[Auth window] did-finish-load', mainWindow.webContents.getURL())
                checkUrl(mainWindow.webContents.getURL());
            })

            mainWindow.webContents.on('did-fail-load', (event: any, errorCode: number, errorDescription: string, validatedURL: string) => {
                console.error('Auth window failed load', { errorCode, errorDescription, validatedURL });
            });

            mainWindow.on("close", () => {
                if (!loading) resolve("cancel");
            })

            mainWindow.webContents.on("did-navigate", (event: any, url: string) => {
                checkUrl(url);
            });

            mainWindow.webContents.on("will-redirect", (event: any, url: string) => {
                checkUrl(url);
            });
        })
    })
}
