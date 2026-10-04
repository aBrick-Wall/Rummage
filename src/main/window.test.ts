import { beforeEach, describe, expect, it, vi } from 'vitest'

const constructed: { webPreferences: Record<string, unknown> }[] = []
const permissionHandlers: {
  request?: (...a: never[]) => void
  check?: (...a: never[]) => boolean
} = {}

vi.mock('electron', () => {
  class BrowserWindow {
    constructor(options: { webPreferences: Record<string, unknown> }) {
      constructed.push(options)
    }
    once() {}
    loadURL() {
      return Promise.resolve()
    }
  }
  return {
    BrowserWindow,
    Menu: { setApplicationMenu: vi.fn() },
    shell: { openExternal: vi.fn() },
    app: { isPackaged: true },
    session: {
      defaultSession: {
        setPermissionRequestHandler: (h: never) => (permissionHandlers.request = h),
        setPermissionCheckHandler: (h: never) => (permissionHandlers.check = h)
      }
    }
  }
})

beforeEach(() => {
  constructed.length = 0
})

describe('window security', () => {
  it('creates the window sandboxed, isolated and without Node integration', async () => {
    const { createMainWindow } = await import('./window')
    createMainWindow()
    const prefs = constructed[0]!.webPreferences
    expect(prefs).toMatchObject({
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false
    })
  })

  it('denies every permission except fullscreen', async () => {
    const { hardenSession } = await import('./window')
    hardenSession()
    const results: boolean[] = []
    for (const permission of ['media', 'geolocation', 'notifications', 'fullscreen']) {
      permissionHandlers.request!(
        null as never,
        permission as never,
        ((ok: boolean) => results.push(ok)) as never
      )
    }
    expect(results).toEqual([false, false, false, true])
    expect(permissionHandlers.check!(null as never, 'clipboard-read' as never)).toBe(false)
  })

  it('trusts only the bundled renderer entry', async () => {
    const { isTrustedRendererUrl, rendererEntryUrl } = await import('./window')
    expect(isTrustedRendererUrl(rendererEntryUrl())).toBe(true)
    expect(isTrustedRendererUrl('https://example.com/')).toBe(false)
    expect(isTrustedRendererUrl('file:///etc/passwd')).toBe(false)
    expect(isTrustedRendererUrl('rummage-media://stream/x')).toBe(false)
  })
})
