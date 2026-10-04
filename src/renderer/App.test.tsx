import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatalogPage, MediaItem, SourceConnection } from '@shared/domain'
import type { RummageApi } from '@shared/ipc/contract'
import { App } from './App'

function makeItem(id: string, title: string): MediaItem {
  return {
    id,
    providerId: 'test',
    kind: 'video',
    title,
    addedAt: 1,
    durationMs: 60_000,
    artwork: [],
    sources: [
      {
        id: `s-${id}`,
        providerId: 'test',
        kind: 'local-file',
        connectionName: 'Movies',
        location: `/movies/${title}.mp4`,
        hasTechnicalInfo: true,
        technical: {
          width: 1280,
          height: 720,
          container: 'mp4',
          videoCodec: 'h264',
          audioCodec: 'aac'
        }
      }
    ]
  }
}

const connection: SourceConnection = {
  id: 'c1',
  providerId: 'test',
  name: 'Movies',
  location: '/movies',
  status: 'connected',
  itemCount: 2
}

function makeApi(options: { items?: MediaItem[]; connections?: SourceConnection[] } = {}) {
  const items = options.items ?? []
  let connections = options.connections ?? []
  const page = (list: MediaItem[]): CatalogPage => ({ items: list, total: list.length })
  const api: RummageApi = {
    app: {
      getInfo: vi.fn(async () => ({
        name: 'Rummage',
        version: '0.1.0',
        publisher: 'Dumpsterlight Digital',
        platform: 'linux',
        tools: [{ name: 'ffprobe', available: true }]
      }))
    },
    catalog: {
      getHome: vi.fn(async () => ({
        recentlyAdded: items,
        yourStash: items,
        totalItems: items.length
      })),
      browse: vi.fn(async () => page(items)),
      search: vi.fn(async ({ query }) =>
        page(items.filter((i) => i.title.toLowerCase().includes(query.toLowerCase())))
      ),
      getItem: vi.fn(async () => null)
    },
    playback: {
      resolve: vi.fn(async (ref) => ({
        providerId: ref.providerId,
        itemId: ref.itemId,
        sourceId: `s-${ref.itemId}`,
        transport: 'progressive' as const,
        url: `rummage-media://stream/s-${ref.itemId}`,
        mimeType: 'video/mp4',
        container: 'mp4'
      }))
    },
    sources: {
      list: vi.fn(async () => connections),
      add: vi.fn(async () => {
        connections = [connection]
        return { outcome: 'added' as const, connection }
      }),
      rescan: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
      onScanProgress: vi.fn(() => () => undefined)
    }
  }
  return api
}

beforeEach(() => {
  HTMLElement.prototype.scrollTo = vi.fn()
  HTMLElement.prototype.scrollIntoView = vi.fn()
  // jsdom has no media stack; pretend the player can handle everything.
  HTMLMediaElement.prototype.canPlayType = vi.fn((): CanPlayTypeResult => 'probably')
})

describe('App', () => {
  it('shows Rummage branding, navigation and the first-run empty state', async () => {
    render(<App api={makeApi()} />)
    expect(screen.getByText('Rummage', { selector: '.rm-brand__name' })).toBeInTheDocument()
    expect(screen.getByText('by Dumpsterlight Digital')).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const label of ['Home', 'Your Stash', 'Free Finds', 'Sources', 'Watch Pile', 'Settings']) {
      expect(within(nav).getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(await screen.findByText('Your stash is looking suspiciously empty.')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Rummage' })).toBeInTheDocument()
  })

  it('adds a stash through the main process and never handles a path itself', async () => {
    const api = makeApi({ items: [makeItem('1', 'Alpha')] })
    render(<App api={api} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Add Your Stash' }))
    expect(api.sources.add).toHaveBeenCalledWith()
    expect(await screen.findByRole('heading', { name: 'Recently Added' })).toBeInTheDocument()
  })

  it('shows only real shelves and opens an item in the player', async () => {
    const api = makeApi({
      items: [makeItem('1', 'Alpha'), makeItem('2', 'Beta')],
      connections: [connection]
    })
    render(<App api={api} />)
    expect(await screen.findByRole('heading', { name: 'Recently Added' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your Stash' })).toBeInTheDocument()
    for (const missing of ['Continue Watching', 'Free Finds', 'Watch Pile']) {
      expect(screen.queryByRole('heading', { name: missing })).toBeNull()
    }

    const [alpha] = screen.getAllByRole('button', { name: /^Alpha/ })
    await userEvent.click(alpha as HTMLElement)
    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha' })).toBeInTheDocument()
    await waitFor(() =>
      expect(document.querySelector('video')).toHaveAttribute('src', 'rummage-media://stream/s-1')
    )
    expect(api.playback.resolve).toHaveBeenCalledWith({ providerId: 'test', itemId: '1' })

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('heading', { name: 'Recently Added' })).toBeInTheDocument()
  })

  it('rummages local items and shows the playful empty search state', async () => {
    const api = makeApi({
      items: [makeItem('1', 'Alpha'), makeItem('2', 'Beta')],
      connections: [connection]
    })
    render(<App api={api} />)
    const search = await screen.findByRole('searchbox', { name: 'Rummage' })
    await userEvent.type(search, 'bet')
    expect(search).toHaveValue('bet')
    expect(search).toHaveFocus()
    expect(await screen.findByRole('list', { name: 'Results for bet' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Beta/ })).toHaveLength(1)

    await userEvent.clear(search)
    await userEvent.type(search, 'zzz')
    expect(await screen.findByText('Nothing turned up in that rummage.')).toBeInTheDocument()
    expect(screen.getByText('Try another title or check your sources.')).toBeInTheDocument()
  })

  it('lists sources with a text status and confirms before removing', async () => {
    const api = makeApi({ items: [makeItem('1', 'Alpha')], connections: [connection] })
    render(<App api={api} />)
    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', {
        name: 'Sources'
      })
    )
    expect(await screen.findByRole('status', { name: 'Connected' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove Movies' }))
    const dialog = screen.getByRole('dialog', { name: 'Remove from Your Stash?' })
    expect(api.sources.remove).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(api.sources.remove).toHaveBeenCalledWith('c1')
  })

  it('keeps unbuilt sections honest', async () => {
    render(<App api={makeApi()} />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    await userEvent.click(within(nav).getByRole('button', { name: 'Free Finds' }))
    expect(await screen.findByText('Coming later')).toBeInTheDocument()
  })
})
