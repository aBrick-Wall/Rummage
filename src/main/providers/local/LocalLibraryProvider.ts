import { realpath, stat } from 'node:fs/promises'
import { basename, isAbsolute, relative } from 'node:path'
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
import type { RummageProvider, ResolvePlaybackOptions, SourceManagement } from '../../core/provider'
import { PathIdentityStrategy, type IdentityStrategy } from './identity'
import type { MediaProber } from './ffprobe'
import type { LocalStore } from './localStore'
import { type LibraryRow, type ScannedFileInput } from './localStore'
import { MEDIA_HOST, MEDIA_SCHEME, type StreamableFile } from './mediaProtocol'
import { isPathInside } from './pathSafety'
import { discoverVideoFiles } from './scanner'
import { deriveTitle } from './titles'
import { containerForExtension, mimeTypeForExtension, videoExtensionOf } from './videoFiles'

export const LOCAL_PROVIDER_ID = 'dumpsterlight.local-library'

const DEFAULT_PAGE_SIZE = 48
const MAX_PAGE_SIZE = 500
const WRITE_BATCH_SIZE = 50
const REACHABILITY_TIMEOUT_MS = 3_000

export interface LocalLibraryProviderOptions {
  store: LocalStore
  prober: MediaProber
  identity?: IdentityStrategy
  now?: () => number
  /** Number of files probed in parallel. */
  probeConcurrency?: number
}

function sameOrNested(a: string, b: string): 'same' | 'inside' | 'contains' | null {
  if (relative(a, b) === '') return 'same'
  if (isPathInside(a, b)) return 'inside'
  if (isPathInside(b, a)) return 'contains'
  return null
}

async function mapWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++] as T
      await fn(item)
    }
  })
  await Promise.all(workers)
}

function parseCursor(cursor: string | undefined): number {
  const n = cursor === undefined ? 0 : Number.parseInt(cursor, 10)
  return Number.isSafeInteger(n) && n >= 0 ? n : 0
}

function pageSize(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE)
}

/** Indexes video files from folders the user chose (including mapped network drives). */
export class LocalLibraryProvider implements RummageProvider {
  readonly manifest: ProviderManifest = {
    id: LOCAL_PROVIDER_ID,
    displayName: 'Your Stash (local folders)',
    version: '0.1.0',
    kind: 'local-library',
    trust: 'built-in',
    description:
      'Video files in folders on this PC or on network storage mapped into the filesystem.',
    capabilities: { search: true, manageSources: true, playback: true }
  }

  readonly sources: SourceManagement

  private readonly store: LocalStore
  private readonly prober: MediaProber
  private readonly identity: IdentityStrategy
  private readonly now: () => number
  private readonly probeConcurrency: number
  private readonly listeners = new Set<(progress: ScanProgress) => void>()
  private readonly activeScans = new Map<
    string,
    { promise: Promise<void>; abort: AbortController }
  >()
  private lastProgressAt = 0

  constructor(options: LocalLibraryProviderOptions) {
    this.store = options.store
    this.prober = options.prober
    this.identity = options.identity ?? new PathIdentityStrategy()
    this.now = options.now ?? Date.now
    this.probeConcurrency = options.probeConcurrency ?? 4
    this.sources = {
      listConnections: () => this.listConnections(),
      addConnection: (selection) => this.addConnection(selection),
      removeConnection: (id) => this.removeConnection(id),
      refreshConnection: (id) => this.refreshConnection(id),
      onProgress: (listener) => {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
      }
    }
  }

  /** Resumes any first-time scan that was interrupted by the app closing. */
  initialize(): void {
    for (const library of this.store.listLibraries()) {
      if (library.lastScanStatus === 'never') void this.startScan(library)
    }
  }

  dispose(): void {
    for (const scan of this.activeScans.values()) scan.abort.abort()
    this.listeners.clear()
  }

  /** Resolves once any scan currently running for the connection has finished. */
  async whenIdle(connectionId?: string): Promise<void> {
    const scans = connectionId
      ? [this.activeScans.get(connectionId)]
      : [...this.activeScans.values()]
    await Promise.all(scans.map((s) => s?.promise))
  }

  // ---- RummageProvider ---------------------------------------------------------------------

  async getCatalog(request: CatalogRequest): Promise<CatalogPage> {
    const limit = pageSize(request.limit)
    const offset = parseCursor(request.cursor)
    const items = this.store.queryItems({ sort: request.sort ?? 'title', limit, offset })
    return this.page(items, this.store.countItems(), offset)
  }

  async search(request: SearchRequest): Promise<CatalogPage> {
    const query = request.query.trim()
    if (query === '') return { items: [], total: 0 }
    const limit = pageSize(request.limit)
    const offset = parseCursor(request.cursor)
    const items = this.store.queryItems({ sort: 'title', limit, offset, search: query })
    return this.page(items, this.store.countItems(query), offset)
  }

  async getItem(id: string): Promise<MediaItem | null> {
    return this.store.getItem(id)
  }

  async resolvePlayback(
    id: string,
    options: ResolvePlaybackOptions = {}
  ): Promise<PlaybackSource | null> {
    const item = this.store.getItem(id)
    const source =
      item?.sources.find((s) => s.id === options.sourceId) ??
      (options.sourceId ? undefined : item?.sources[0])
    if (!item || !source) return null

    const target = await this.resolveStream(source.id)
    if (!target) return null

    const extension = videoExtensionOf(target.path) ?? ''
    return {
      providerId: LOCAL_PROVIDER_ID,
      itemId: item.id,
      sourceId: source.id,
      transport: 'progressive',
      url: `${MEDIA_SCHEME}://${MEDIA_HOST}/${source.id}`,
      mimeType: target.mimeType,
      container: source.technical.container ?? containerForExtension(extension),
      videoCodec: source.technical.videoCodec,
      audioCodec: source.technical.audioCodec
    }
  }

  /**
   * Used by the `rummage-media:` protocol handler. Re-validates on every request that the
   * file still lives inside its library and is an allow-listed video type.
   */
  async resolveStream(sourceId: string): Promise<StreamableFile | null> {
    const target = this.store.getStreamTarget(sourceId)
    if (!target || !videoExtensionOf(target.path)) return null
    try {
      const real = await realpath(target.path)
      if (!isPathInside(target.canonicalRoot, real)) return null
      if (videoExtensionOf(real) === undefined) return null
      const info = await stat(real)
      if (!info.isFile()) return null
      return { path: real, size: info.size, mimeType: mimeTypeForExtension(target.extension) }
    } catch {
      return null
    }
  }

  // ---- source management -------------------------------------------------------------------

  private async listConnections(): Promise<SourceConnection[]> {
    return Promise.all(this.store.listLibraries().map((library) => this.toConnection(library)))
  }

  private async addConnection(selection: unknown): Promise<AddSourceResult> {
    if (typeof selection !== 'string' || !isAbsolute(selection)) {
      return { outcome: 'error', message: 'Please choose a folder.' }
    }
    let canonical: string
    try {
      canonical = await realpath(selection)
      if (!(await stat(canonical)).isDirectory()) throw new Error('not a directory')
    } catch {
      return { outcome: 'error', message: 'That folder could not be opened.' }
    }

    for (const existing of this.store.listLibraries()) {
      const relation = sameOrNested(existing.canonicalRoot, canonical)
      if (relation === 'same') {
        return { outcome: 'duplicate', connection: await this.toConnection(existing) }
      }
      if (relation) {
        return {
          outcome: 'error',
          message: `That folder overlaps with "${existing.name}", which is already in Your Stash.`
        }
      }
    }

    const library = this.store.addLibrary({
      providerId: LOCAL_PROVIDER_ID,
      name: basename(canonical) || canonical,
      rootPath: selection,
      canonicalRoot: canonical,
      now: this.now()
    })
    void this.startScan(library)
    return { outcome: 'added', connection: await this.toConnection(library) }
  }

  private async removeConnection(connectionId: string): Promise<void> {
    const active = this.activeScans.get(connectionId)
    active?.abort.abort()
    await active?.promise
    this.store.removeLibrary(connectionId)
  }

  private async refreshConnection(connectionId: string): Promise<void> {
    const library = this.store.getLibrary(connectionId)
    if (library) void this.startScan(library)
  }

  private async toConnection(library: LibraryRow): Promise<SourceConnection> {
    const base = {
      id: library.id,
      providerId: library.providerId,
      name: library.name,
      location: library.rootPath,
      itemCount: library.itemCount,
      lastScannedAt: library.lastScanCompletedAt
    }
    if (this.activeScans.has(library.id)) return { ...base, status: 'scanning' }
    if (!(await this.isReachable(library.canonicalRoot))) {
      return {
        ...base,
        status: 'offline',
        statusDetail: 'This location is not reachable right now.'
      }
    }
    if (library.lastScanStatus === 'failed') {
      return {
        ...base,
        status: 'needs-attention',
        statusDetail: library.lastScanError ?? 'The last scan failed.'
      }
    }
    if (library.lastScanStatus === 'partial') {
      return {
        ...base,
        status: 'needs-attention',
        statusDetail: 'Some folders could not be read during the last scan.'
      }
    }
    return { ...base, status: 'connected' }
  }

  private async isReachable(path: string): Promise<boolean> {
    // A disconnected network path can block for a long time; never let that stall the UI.
    const check = stat(path).then(
      (s) => s.isDirectory(),
      () => false
    )
    const timeout = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), REACHABILITY_TIMEOUT_MS).unref()
    })
    return Promise.race([check, timeout])
  }

  // ---- scanning ----------------------------------------------------------------------------

  private startScan(library: LibraryRow): Promise<void> {
    const running = this.activeScans.get(library.id)
    if (running) return running.promise
    const abort = new AbortController()
    const promise = this.runScan(library, abort.signal).finally(() => {
      this.activeScans.delete(library.id)
    })
    this.activeScans.set(library.id, { promise, abort })
    return promise
  }

  private async runScan(library: LibraryRow, signal: AbortSignal): Promise<void> {
    const emit = (progress: Omit<ScanProgress, 'connectionId'>, force = true) => {
      const t = Date.now()
      if (!force && t - this.lastProgressAt < 100) return
      this.lastProgressAt = t
      for (const listener of this.listeners) listener({ connectionId: library.id, ...progress })
    }

    this.store.markScanStarted(library.id, this.now())
    emit({ phase: 'discovering', filesFound: 0, filesProcessed: 0 })
    try {
      if (!(await this.isReachable(library.canonicalRoot))) {
        throw new Error('This location is not reachable right now.')
      }
      const toolStatus = await this.prober.getStatus()
      const discovery = await discoverVideoFiles(library.canonicalRoot, {
        signal,
        onFileFound: (count) =>
          emit({ phase: 'discovering', filesFound: count, filesProcessed: 0 }, false)
      })
      if (signal.aborted) return

      const existing = this.store.existingSources(library.id)
      const seen = new Set<string>()
      let batch: ScannedFileInput[] = []
      let processed = 0
      const total = discovery.files.length
      const flush = () => {
        if (batch.length === 0) return
        this.store.upsertScannedFiles(batch)
        batch = []
      }

      await mapWithConcurrency(discovery.files, this.probeConcurrency, async (file) => {
        if (signal.aborted) return
        const identity = this.identity.identify({
          canonicalPath: file.path,
          sizeBytes: file.sizeBytes,
          mtimeMs: file.mtimeMs,
          fileId: file.fileId
        })
        seen.add(identity.key)
        const previous = existing.get(identity.key)
        const unchanged =
          previous !== undefined &&
          previous.sizeBytes === file.sizeBytes &&
          previous.mtimeMs === file.mtimeMs
        const needsProbe =
          !unchanged ||
          previous.probeStatus === undefined ||
          (previous.probeStatus === 'unavailable' && toolStatus.available)

        const probe = needsProbe ? await this.prober.probe(file.path) : undefined
        batch.push({
          libraryId: library.id,
          providerId: LOCAL_PROVIDER_ID,
          identity,
          path: file.path,
          relPath: file.relPath,
          extension: file.extension,
          sizeBytes: file.sizeBytes,
          mtimeMs: file.mtimeMs,
          fileId: file.fileId,
          title: deriveTitle(file.name),
          probe,
          now: this.now()
        })
        if (batch.length >= WRITE_BATCH_SIZE) flush()
        processed += 1
        emit({ phase: 'reading', filesFound: total, filesProcessed: processed }, false)
      })
      flush()
      if (signal.aborted) return

      emit({ phase: 'finishing', filesFound: total, filesProcessed: processed })
      // Only a fully readable tree may delete anything, so a flaky share can't wipe the index.
      if (discovery.errorCount === 0) this.store.pruneUnseen(library.id, seen)
      this.store.markScanFinished(
        library.id,
        discovery.errorCount === 0 ? 'ok' : 'partial',
        this.now()
      )
      emit({ phase: 'done', filesFound: total, filesProcessed: processed })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The scan failed.'
      this.store.markScanFinished(library.id, 'failed', this.now(), message)
      emit({ phase: 'failed', filesFound: 0, filesProcessed: 0, message })
    }
  }

  private page(items: MediaItem[], total: number, offset: number): CatalogPage {
    const next = offset + items.length
    return { items, total, nextCursor: next < total ? String(next) : undefined }
  }
}
