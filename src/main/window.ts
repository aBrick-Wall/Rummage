import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow, Menu, session, shell, type WebContents } from 'electron'
import { is } from './env'

/** URL the renderer is served from; anything else is untrusted. */
export function rendererEntryUrl(): string {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devUrl) return devUrl
  return pathToFileURL(join(__dirname, '../renderer/index.html')).href
}

export function isTrustedRendererUrl(url: string): boolean {
  const entry = rendererEntryUrl()
  if (url === entry) return true
  try {
    return new URL(url).origin === new URL(entry).origin && new URL(entry).protocol !== 'file:'
  } catch {
    return false
  }
}

const ALLOWED_PERMISSIONS = new Set(['fullscreen'])

/** Deny-by-default hardening applied to every webContents the app ever creates. */
export function hardenWebContents(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    // Only plain web links may leave the app, and only in the user's own browser.
    if (/^https:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault()
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())
}

export function hardenSession(): void {
  const ses = session.defaultSession
  ses.setPermissionRequestHandler((_wc, permission, callback) =>
    callback(ALLOWED_PERMISSIONS.has(permission))
  )
  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission))
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#1E1E1E',
    title: 'Rummage',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false
    }
  })

  if (!is.dev) Menu.setApplicationMenu(null)
  window.once('ready-to-show', () => window.show())
  void window.loadURL(rendererEntryUrl())
  return window
}
