import type {
  AddSourceResult,
  CatalogPage,
  CatalogRequest,
  MediaItem,
  MediaRef,
  PlaybackSource,
  ScanProgress,
  SearchRequest,
  SourceConnection
} from '@shared/domain'
import type { HomeShelves } from '@shared/ipc/contract'
import type { ProviderRegistry } from './providerRegistry'

const HOME_SHELF_SIZE = 24

/**
 * The application-facing facade over all registered providers. The IPC layer talks only to
 * this class, so UI code never learns which provider produced an item.
 */
export class MediaService {
  constructor(private readonly registry: ProviderRegistry) {}

  async getHome(): Promise<HomeShelves> {
    const [recent, stash] = await Promise.all([
      this.browse({ sort: 'recently-added', limit: HOME_SHELF_SIZE }),
      this.browse({ sort: 'title', limit: HOME_SHELF_SIZE })
    ])
    return { recentlyAdded: recent.items, yourStash: stash.items, totalItems: stash.total }
  }

  /** Phase 1 has one catalog provider; the merge point for multiple providers lives here. */
  async browse(request: CatalogRequest = {}): Promise<CatalogPage> {
    return mergePages(
      await Promise.all(this.registry.list().map((provider) => provider.getCatalog(request)))
    )
  }

  async search(request: SearchRequest): Promise<CatalogPage> {
    const searchable = this.registry.list().filter((p) => p.manifest.capabilities.search)
    return mergePages(await Promise.all(searchable.map((provider) => provider.search(request))))
  }

  async getItem(ref: MediaRef): Promise<MediaItem | null> {
    return (await this.registry.get(ref.providerId)?.getItem(ref.itemId)) ?? null
  }

  async resolvePlayback(ref: MediaRef, sourceId?: string): Promise<PlaybackSource | null> {
    const provider = this.registry.get(ref.providerId)
    if (!provider?.manifest.capabilities.playback) return null
    return provider.resolvePlayback(ref.itemId, { sourceId })
  }

  async listConnections(): Promise<SourceConnection[]> {
    const lists = await Promise.all(this.managers().map(([, m]) => m.listConnections()))
    return lists.flat()
  }

  /** Phase 1: sources are added through the one provider that manages them. */
  async addConnection(selection: unknown): Promise<AddSourceResult> {
    const [, manager] = this.managers()[0] ?? []
    if (!manager) return { outcome: 'error', message: 'No provider can accept new sources.' }
    return manager.addConnection(selection)
  }

  async refreshConnection(connectionId: string): Promise<void> {
    const owner = await this.findOwner(connectionId)
    await owner?.refreshConnection(connectionId)
  }

  async removeConnection(connectionId: string): Promise<void> {
    const owner = await this.findOwner(connectionId)
    await owner?.removeConnection(connectionId)
  }

  onScanProgress(listener: (progress: ScanProgress) => void): () => void {
    const unsubscribers = this.managers().map(([, m]) => m.onProgress(listener))
    return () => unsubscribers.forEach((off) => off())
  }

  private managers() {
    return this.registry.list().flatMap((p) => (p.sources ? ([[p, p.sources]] as const) : []))
  }

  private async findOwner(connectionId: string) {
    for (const [, manager] of this.managers()) {
      const connections = await manager.listConnections()
      if (connections.some((c) => c.id === connectionId)) return manager
    }
    return undefined
  }
}

function mergePages(pages: CatalogPage[]): CatalogPage {
  const only = pages.length === 1 ? pages[0] : undefined
  if (only) return only
  return { items: pages.flatMap((p) => p.items), total: pages.reduce((n, p) => n + p.total, 0) }
}
