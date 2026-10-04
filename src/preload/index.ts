import { contextBridge, ipcRenderer } from 'electron'
import type { ScanProgress } from '../shared/domain'
import { CHANNELS, type RummageApi } from '../shared/ipc/contract'

/**
 * The only thing the renderer can reach. Every method maps to exactly one fixed channel;
 * `ipcRenderer` itself, event objects and arbitrary channel names are never exposed.
 * Arguments are validated again, strictly, in the main process.
 */
const api: RummageApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(CHANNELS.appGetInfo)
  },
  catalog: {
    getHome: () => ipcRenderer.invoke(CHANNELS.catalogGetHome),
    browse: (request) => ipcRenderer.invoke(CHANNELS.catalogBrowse, request),
    search: (request) => ipcRenderer.invoke(CHANNELS.catalogSearch, request),
    getItem: (ref) => ipcRenderer.invoke(CHANNELS.catalogGetItem, ref)
  },
  playback: {
    resolve: (ref, sourceId) => ipcRenderer.invoke(CHANNELS.playbackResolve, ref, sourceId)
  },
  sources: {
    list: () => ipcRenderer.invoke(CHANNELS.sourcesList),
    add: () => ipcRenderer.invoke(CHANNELS.sourcesAdd),
    rescan: (connectionId) => ipcRenderer.invoke(CHANNELS.sourcesRescan, connectionId),
    remove: (connectionId) => ipcRenderer.invoke(CHANNELS.sourcesRemove, connectionId),
    onScanProgress: (listener) => {
      const wrapped = (_event: unknown, progress: ScanProgress) => listener(progress)
      ipcRenderer.on(CHANNELS.scanProgress, wrapped)
      return () => {
        ipcRenderer.removeListener(CHANNELS.scanProgress, wrapped)
      }
    }
  }
}

contextBridge.exposeInMainWorld('rummage', api)
