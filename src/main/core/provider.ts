import type {
  AddSourceResult,
  CatalogPage,
  CatalogRequest,
  MediaItem,
  PlaybackSource,
  ProviderManifest,
  ScanProgress,
  SearchRequest,
  SourceConnection
} from '@shared/domain'

export interface ResolvePlaybackOptions {
  /** Prefer a specific MediaSource of the item. */
  sourceId?: string
}

/**
 * Optional capability: the provider owns user-managed source connections
 * (a folder today; an SMB share or media-server login later).
 */
export interface SourceManagement {
  listConnections(): Promise<SourceConnection[]>
  /** `selection` comes from a main-process-owned UI (e.g. the native folder picker). */
  addConnection(selection: unknown): Promise<AddSourceResult>
  removeConnection(connectionId: string): Promise<void>
  refreshConnection(connectionId: string): Promise<void>
  onProgress(listener: (progress: ScanProgress) => void): () => void
}

/**
 * The contract between Rummage's core and any source of media.
 *
 * Providers return normalized domain objects only. Everything a provider knows about its
 * own world (file paths, server tokens, Kodi add-on internals) stays behind this interface.
 * Anything a provider returns is untrusted data and is treated as such by the core.
 */
export interface RummageProvider {
  readonly manifest: ProviderManifest

  getCatalog(request: CatalogRequest): Promise<CatalogPage>
  search(request: SearchRequest): Promise<CatalogPage>
  getItem(id: string): Promise<MediaItem | null>
  resolvePlayback(id: string, options?: ResolvePlaybackOptions): Promise<PlaybackSource | null>

  /** Present only when `manifest.capabilities.manageSources` is true. */
  readonly sources?: SourceManagement

  dispose?(): void
}
