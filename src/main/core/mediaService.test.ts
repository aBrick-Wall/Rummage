import { describe, expect, it, vi } from 'vitest'
import type { CatalogPage, ProviderManifest } from '@shared/domain'
import { MediaService } from './mediaService'
import type { RummageProvider } from './provider'
import { ProviderRegistry } from './providerRegistry'

const emptyPage: CatalogPage = { items: [], total: 0 }

function fakeProvider(id: string, overrides: Partial<RummageProvider> = {}): RummageProvider {
  const manifest: ProviderManifest = {
    id,
    displayName: id,
    version: '1',
    kind: 'plugin',
    trust: 'third-party',
    capabilities: { search: true, manageSources: false, playback: true }
  }
  return {
    manifest,
    getCatalog: vi.fn(async () => emptyPage),
    search: vi.fn(async () => emptyPage),
    getItem: vi.fn(async () => null),
    resolvePlayback: vi.fn(async () => null),
    ...overrides
  }
}

describe('ProviderRegistry', () => {
  it('rejects duplicate provider ids', () => {
    const registry = new ProviderRegistry()
    registry.register(fakeProvider('a'))
    expect(() => registry.register(fakeProvider('a'))).toThrow(/already registered/)
  })
})

describe('MediaService', () => {
  it('routes item and playback requests to the owning provider only', async () => {
    const a = fakeProvider('a')
    const b = fakeProvider('b')
    const registry = new ProviderRegistry()
    registry.register(a)
    registry.register(b)
    const service = new MediaService(registry)

    await service.getItem({ providerId: 'b', itemId: '1' })
    await service.resolvePlayback({ providerId: 'b', itemId: '1' }, 's')
    expect(b.getItem).toHaveBeenCalledWith('1')
    expect(b.resolvePlayback).toHaveBeenCalledWith('1', { sourceId: 's' })
    expect(a.getItem).not.toHaveBeenCalled()
    expect(await service.getItem({ providerId: 'missing', itemId: '1' })).toBeNull()
    expect(await service.resolvePlayback({ providerId: 'missing', itemId: '1' })).toBeNull()
  })

  it('does not resolve playback for providers without the playback capability', async () => {
    const p = fakeProvider('a')
    p.manifest.capabilities.playback = false
    const registry = new ProviderRegistry()
    registry.register(p)
    expect(
      await new MediaService(registry).resolvePlayback({ providerId: 'a', itemId: '1' })
    ).toBeNull()
    expect(p.resolvePlayback).not.toHaveBeenCalled()
  })

  it('only searches providers that declare search support', async () => {
    const searchable = fakeProvider('a')
    const other = fakeProvider('b')
    other.manifest.capabilities.search = false
    const registry = new ProviderRegistry()
    registry.register(searchable)
    registry.register(other)
    await new MediaService(registry).search({ query: 'x' })
    expect(searchable.search).toHaveBeenCalled()
    expect(other.search).not.toHaveBeenCalled()
  })
})
