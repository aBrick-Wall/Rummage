import type {
  AddSourceResult,
  AppInfo,
  CatalogPage,
  CatalogRequest,
  MediaItem,
  MediaRef,
  PlaybackSource,
  ScanProgress,
  SearchRequest,
  SourceConnection
} from '../domain'

/**
 * The complete surface the renderer may call. The preload script maps each method onto
 * exactly one channel below; no generic send/invoke is ever exposed.
 */
export interface RummageApi {
  app: {
    getInfo(): Promise<AppInfo>
  }
  catalog: {
    getHome(): Promise<HomeShelves>
    browse(request?: CatalogRequest): Promise<CatalogPage>
    search(request: SearchRequest): Promise<CatalogPage>
    getItem(ref: MediaRef): Promise<MediaItem | null>
  }
  playback: {
    resolve(ref: MediaRef, sourceId?: string): Promise<PlaybackSource | null>
  }
  sources: {
    list(): Promise<SourceConnection[]>
    /** Opens a native folder picker in the main process; the renderer never supplies a path. */
    add(): Promise<AddSourceResult>
    rescan(connectionId: string): Promise<void>
    remove(connectionId: string): Promise<void>
    onScanProgress(listener: (progress: ScanProgress) => void): () => void
  }
}

export interface HomeShelves {
  recentlyAdded: MediaItem[]
  yourStash: MediaItem[]
  totalItems: number
}

export const CHANNELS = {
  appGetInfo: 'app:get-info',
  catalogGetHome: 'catalog:get-home',
  catalogBrowse: 'catalog:browse',
  catalogSearch: 'catalog:search',
  catalogGetItem: 'catalog:get-item',
  playbackResolve: 'playback:resolve',
  sourcesList: 'sources:list',
  sourcesAdd: 'sources:add',
  sourcesRescan: 'sources:rescan',
  sourcesRemove: 'sources:remove',
  /** main -> renderer only */
  scanProgress: 'sources:scan-progress'
} as const

export type InvokeChannel = Exclude<
  (typeof CHANNELS)[keyof typeof CHANNELS],
  'sources:scan-progress'
>
