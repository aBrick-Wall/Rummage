import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'
import type { AddSourceResult, AppInfo, ScanProgress } from '@shared/domain'
import { CHANNELS, type InvokeChannel } from '@shared/ipc/contract'
import {
  catalogRequestSchema,
  connectionIdSchema,
  mediaRefSchema,
  playbackArgsSchema,
  searchRequestSchema
} from '@shared/ipc/validation'
import type { MediaService } from './core/mediaService'

export interface IpcDependencies {
  service: MediaService
  isTrustedUrl(url: string): boolean
  getAppInfo(): Promise<AppInfo>
  /** Shows the native folder picker. Returns the chosen path, or null when cancelled. */
  pickFolder(): Promise<string | null>
}

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>

/**
 * Registers every IPC endpoint. Each one: (1) checks the call comes from our own renderer
 * frame, (2) validates arguments with a strict schema, (3) delegates to the core service.
 */
export function registerIpc(deps: IpcDependencies): () => void {
  const { service } = deps
  const registered: InvokeChannel[] = []

  function handle<S extends z.ZodType>(
    channel: InvokeChannel,
    schema: S,
    fn: (args: z.output<S>) => Promise<unknown>
  ): void {
    const handler: Handler = async (event, ...args) => {
      const url = event.senderFrame?.url ?? ''
      if (!deps.isTrustedUrl(url)) throw new Error('Untrusted sender')
      const parsed = schema.safeParse(args)
      if (!parsed.success) throw new Error('Invalid request')
      return fn(parsed.data)
    }
    ipcMain.handle(channel, handler)
    registered.push(channel)
  }

  const none = z.tuple([])
  handle(CHANNELS.appGetInfo, none, () => deps.getAppInfo())
  handle(CHANNELS.catalogGetHome, none, () => service.getHome())
  handle(CHANNELS.catalogBrowse, z.tuple([catalogRequestSchema]), ([request]) =>
    service.browse(request)
  )
  handle(CHANNELS.catalogSearch, z.tuple([searchRequestSchema]), ([request]) =>
    service.search(request)
  )
  handle(CHANNELS.catalogGetItem, z.tuple([mediaRefSchema]), ([ref]) => service.getItem(ref))
  handle(CHANNELS.playbackResolve, playbackArgsSchema, ([ref, sourceId]) =>
    service.resolvePlayback(ref, sourceId)
  )
  handle(CHANNELS.sourcesList, none, () => service.listConnections())
  handle(CHANNELS.sourcesAdd, none, async (): Promise<AddSourceResult> => {
    const path = await deps.pickFolder()
    return path === null ? { outcome: 'cancelled' } : service.addConnection(path)
  })
  handle(CHANNELS.sourcesRescan, z.tuple([connectionIdSchema]), ([id]) =>
    service.refreshConnection(id)
  )
  handle(CHANNELS.sourcesRemove, z.tuple([connectionIdSchema]), ([id]) =>
    service.removeConnection(id)
  )

  const stopProgress = service.onScanProgress((progress: ScanProgress) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(CHANNELS.scanProgress, progress)
    }
  })

  return () => {
    stopProgress()
    for (const channel of registered) ipcMain.removeHandler(channel)
  }
}
