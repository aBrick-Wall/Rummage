import { join } from 'node:path'
import { app, BrowserWindow, dialog, protocol } from 'electron'
import type { AppInfo } from '@shared/domain'
import { MediaService } from './core/mediaService'
import { ProviderRegistry } from './core/providerRegistry'
import { openDatabase, type Db } from './db/database'
import { registerIpc } from './ipc'
import { FfprobeProber, resolveFfprobeCommand } from './providers/local/ffprobe'
import { LocalLibraryProvider } from './providers/local/LocalLibraryProvider'
import { LocalStore } from './providers/local/localStore'
import { createMediaRequestHandler, MEDIA_SCHEME } from './providers/local/mediaProtocol'
import { createMainWindow, hardenSession, hardenWebContents, isTrustedRendererUrl } from './window'

const PUBLISHER = 'Dumpsterlight Digital'

// Must run before `ready`. Lets tests/automation point the app at a throwaway profile.
if (process.env['RUMMAGE_USER_DATA']) app.setPath('userData', process.env['RUMMAGE_USER_DATA'])

// The custom media scheme is the only way the renderer reaches local files.
protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

app.on('web-contents-created', (_event, contents) => hardenWebContents(contents))

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let db: Db | undefined
  const registry = new ProviderRegistry()
  let disposeIpc: (() => void) | undefined

  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows()
    if (window) {
      if (window.isMinimized()) window.restore()
      window.focus()
    }
  })

  void app.whenReady().then(async () => {
    app.setAppUserModelId('digital.dumpsterlight.rummage')
    hardenSession()

    db = openDatabase(join(app.getPath('userData'), 'rummage.db'))
    const prober = new FfprobeProber(
      resolveFfprobeCommand({ resourcesPath: process.resourcesPath })
    )
    const local = new LocalLibraryProvider({ store: new LocalStore(db), prober })
    registry.register(local)

    protocol.handle(
      MEDIA_SCHEME,
      createMediaRequestHandler((id) => local.resolveStream(id))
    )

    const service = new MediaService(registry)
    disposeIpc = registerIpc({
      service,
      isTrustedUrl: isTrustedRendererUrl,
      getAppInfo: async (): Promise<AppInfo> => ({
        name: 'Rummage',
        version: app.getVersion(),
        publisher: PUBLISHER,
        platform: process.platform,
        tools: [await prober.getStatus()]
      }),
      pickFolder: async () => {
        const parent = BrowserWindow.getFocusedWindow() ?? undefined
        const options = {
          title: 'Add Your Stash',
          buttonLabel: 'Add Your Stash',
          properties: ['openDirectory' as const]
        }
        const result = parent
          ? await dialog.showOpenDialog(parent, options)
          : await dialog.showOpenDialog(options)
        return result.canceled ? null : (result.filePaths[0] ?? null)
      }
    })

    createMainWindow()
    local.initialize()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('will-quit', () => {
    disposeIpc?.()
    registry.disposeAll()
    db?.close()
  })
}
