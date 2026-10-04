/**
 * Normalized Rummage domain models.
 *
 * Everything the UI sees is expressed in these types. Providers (local library today;
 * media servers, online catalogs and plugins later) translate their own world into them.
 * All values crossing the IPC boundary are plain JSON-serializable data.
 */

export type ProviderKind =
  'local-library' | 'media-server' | 'online-catalog' | 'compatibility-adapter' | 'plugin'

/** Where a provider's code comes from. Phase 1 only ships built-in providers. */
export type ProviderTrust = 'built-in' | 'third-party'

export interface ProviderCapabilities {
  /** Provider can answer `search(query)`. */
  search: boolean
  /** Provider owns user-managed sources (folders, servers) that can be added/removed/rescanned. */
  manageSources: boolean
  /** Provider can turn items into something playable. */
  playback: boolean
}

export interface ProviderManifest {
  /** Stable, namespaced identifier, e.g. `dumpsterlight.local-library`. */
  id: string
  displayName: string
  version: string
  kind: ProviderKind
  trust: ProviderTrust
  description?: string
  capabilities: ProviderCapabilities
}

export type ArtworkKind = 'poster' | 'backdrop' | 'thumbnail' | 'logo'

export interface MediaArtwork {
  kind: ArtworkKind
  /** Loadable by the renderer under its CSP (e.g. `rummage-media:` or `data:`). */
  url: string
  width?: number
  height?: number
}

export type MediaKind = 'video'

export type MediaSourceKind = 'local-file'

/** Provider-agnostic technical facts about one concrete copy of a piece of media. */
export interface MediaTechnicalInfo {
  container?: string
  videoCodec?: string
  audioCodec?: string
  width?: number
  height?: number
  frameRate?: number
  durationMs?: number
  bitRate?: number
}

/**
 * One concrete, playable location for a MediaItem (a file on disk today; a server stream,
 * a catalog entry, ... later). A MediaItem may own several of these from several providers.
 */
export interface MediaSource {
  id: string
  providerId: string
  kind: MediaSourceKind
  /** The user-visible name of the source connection (library) this came from. */
  connectionName: string
  /** Display-only location, e.g. a file path. Never used by the UI to build URLs. */
  location: string
  sizeBytes?: number
  modifiedAt?: number
  lastScannedAt?: number
  /** True when technical metadata could be read (e.g. ffprobe succeeded). */
  hasTechnicalInfo: boolean
  technical: MediaTechnicalInfo
}

export interface MediaItem {
  /** Unique within `providerId`. */
  id: string
  providerId: string
  kind: MediaKind
  title: string
  description?: string
  year?: number
  durationMs?: number
  /** Epoch ms when Rummage first saw this item. */
  addedAt: number
  artwork: MediaArtwork[]
  sources: MediaSource[]
}

export type PlaybackTransport = 'progressive'

/**
 * Everything a player needs to start playback, resolved by a provider.
 * The URL is opaque to the UI; only providers know how to mint one.
 */
export interface PlaybackSource {
  providerId: string
  itemId: string
  sourceId: string
  transport: PlaybackTransport
  url: string
  mimeType: string
  container?: string
  videoCodec?: string
  audioCodec?: string
}

export interface MediaRef {
  providerId: string
  itemId: string
}

export type CatalogSort = 'title' | 'recently-added'

export interface CatalogRequest {
  sort?: CatalogSort
  limit?: number
  /** Opaque cursor returned by a previous page. */
  cursor?: string
}

export interface CatalogPage {
  items: MediaItem[]
  total: number
  nextCursor?: string
}

export interface SearchRequest {
  query: string
  limit?: number
  cursor?: string
}

export type SourceStatus = 'connected' | 'scanning' | 'offline' | 'needs-attention'

/** A user-configured connection to a place media lives (a folder, a NAS share, later a server). */
export interface SourceConnection {
  id: string
  providerId: string
  name: string
  /** Display-only location. */
  location: string
  status: SourceStatus
  statusDetail?: string
  itemCount: number
  lastScannedAt?: number
}

export type ScanPhase = 'discovering' | 'reading' | 'finishing' | 'done' | 'failed'

export interface ScanProgress {
  connectionId: string
  phase: ScanPhase
  filesFound: number
  filesProcessed: number
  message?: string
}

export interface ToolStatus {
  name: string
  available: boolean
  detail?: string
}

export interface AppInfo {
  name: string
  version: string
  publisher: string
  platform: string
  tools: ToolStatus[]
}

export type AddSourceResult =
  | { outcome: 'added'; connection: SourceConnection }
  | { outcome: 'cancelled' }
  | { outcome: 'duplicate'; connection: SourceConnection }
  | { outcome: 'error'; message: string }
