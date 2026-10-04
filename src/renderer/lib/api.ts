import type { RummageApi } from '@shared/ipc/contract'

declare global {
  interface Window {
    /** Injected by the preload script via contextBridge. */
    rummage: RummageApi
  }
}

/** The one place the renderer touches the preload bridge. */
export function getApi(): RummageApi {
  return window.rummage
}
