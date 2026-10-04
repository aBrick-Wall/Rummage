import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ScanProgress } from '@shared/domain'
import { openDatabase, type Db } from '../../db/database'
import { LocalLibraryProvider, LOCAL_PROVIDER_ID } from './LocalLibraryProvider'
import { LocalStore } from './localStore'
import { FakeProber } from './testing'

let root: string
let db: Db
let prober: FakeProber
let provider: LocalLibraryProvider

const touch = (rel: string, content = 'video-bytes') => {
  const full = join(root, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
  return full
}

function makeProvider(database: Db = db) {
  return new LocalLibraryProvider({ store: new LocalStore(database), prober })
}

async function addAndScan() {
  const result = await provider.sources.addConnection(root)
  if (result.outcome !== 'added') throw new Error(`unexpected outcome ${result.outcome}`)
  await provider.whenIdle()
  return result.connection
}

beforeEach(() => {
  // Windows temp dirs can be 8.3 short names (RUNNER~1); the provider stores canonical paths.
  root = realpathSync.native(mkdtempSync(join(tmpdir(), 'rummage-lib-')))
  db = openDatabase(':memory:')
  prober = new FakeProber()
  provider = makeProvider()
})
afterEach(() => {
  provider.dispose()
  rmSync(root, { recursive: true, force: true })
})

describe('LocalLibraryProvider', () => {
  it('describes itself with a manifest', () => {
    expect(provider.manifest).toMatchObject({
      id: LOCAL_PROVIDER_ID,
      kind: 'local-library',
      trust: 'built-in',
      capabilities: { search: true, manageSources: true, playback: true }
    })
  })

  it('scans a folder, stores metadata and exposes normalized items', async () => {
    touch('Holiday_Video.mp4')
    touch('shows/Episode.One.mkv')
    touch('readme.txt')
    await addAndScan()

    const page = await provider.getCatalog({ sort: 'title' })
    expect(page.total).toBe(2)
    const holiday = page.items.find((i) => i.title === 'Holiday Video')
    expect(holiday).toMatchObject({
      providerId: LOCAL_PROVIDER_ID,
      kind: 'video',
      durationMs: 5000,
      artwork: []
    })
    expect(holiday?.sources).toHaveLength(1)
    expect(holiday?.sources[0]).toMatchObject({
      kind: 'local-file',
      hasTechnicalInfo: true,
      technical: {
        container: 'mp4',
        videoCodec: 'h264',
        audioCodec: 'aac',
        width: 1280,
        height: 720,
        frameRate: 24
      }
    })
  })

  it('persists across restarts without rescanning', async () => {
    touch('a.mp4')
    await addAndScan()
    expect(prober.probed).toHaveLength(1)

    const reopened = makeProvider()
    expect((await reopened.getCatalog({})).total).toBe(1)
    expect(await reopened.sources.listConnections()).toHaveLength(1)
    reopened.initialize()
    await reopened.whenIdle()
    expect(prober.probed).toHaveLength(1)
  })

  it('searches titles and relative paths, escaping wildcard characters', async () => {
    touch('Road Trip 2020.mp4')
    touch('vacation/beach_day.mp4')
    touch('100%_real.mp4')
    touch('abc.mp4')
    await addAndScan()

    const titles = async (query: string) =>
      (await provider.search({ query })).items.map((i) => i.title)
    expect(await titles('road')).toEqual(['Road Trip 2020'])
    expect(await titles('trip 2020')).toEqual(['Road Trip 2020'])
    expect(await titles('vacation')).toEqual(['beach day'])
    expect(await titles('%')).toEqual(['100% real'])
    expect(await titles('a_c')).toEqual([])
    expect(await titles('a%c')).toEqual([])
    expect(await titles('zzz')).toEqual([])
    expect(await titles('   ')).toEqual([])
  })

  it('keeps same-named files in different folders as distinct items', async () => {
    touch('a/clip.mp4')
    touch('b/clip.mp4')
    await addAndScan()
    const { items } = await provider.getCatalog({})
    expect(items).toHaveLength(2)
    expect(new Set(items.map((i) => i.id)).size).toBe(2)
    expect(new Set(items.flatMap((i) => i.sources.map((s) => s.location))).size).toBe(2)
  })

  it('rescans incrementally: only changed files are re-probed and vanished files are pruned', async () => {
    const a = touch('a.mp4')
    touch('b.mp4')
    const connection = await addAndScan()
    const before = (await provider.getCatalog({})).items.find((i) => i.sources[0]?.location === a)
    expect(prober.probed).toHaveLength(2)

    rmSync(join(root, 'b.mp4'))
    touch('c.mp4')
    const future = new Date(Date.now() + 60_000)
    writeFileSync(a, 'changed contents')
    utimesSync(a, future, future)
    await provider.sources.refreshConnection(connection.id)
    await provider.whenIdle()

    expect(prober.probed.slice(2).sort()).toEqual([a, join(root, 'c.mp4')].sort())
    const after = await provider.getCatalog({})
    expect(after.items.map((i) => i.title).sort()).toEqual(['a', 'c'])
    expect(after.items.find((i) => i.sources[0]?.location === a)?.id).toBe(before?.id)
  })

  it('indexes files without metadata when ffprobe is unavailable, and fills it in later', async () => {
    prober.available = false
    touch('a.mp4')
    const connection = await addAndScan()
    let item = (await provider.getCatalog({})).items[0]
    expect(item?.sources[0]?.hasTechnicalInfo).toBe(false)

    prober.available = true
    await provider.sources.refreshConnection(connection.id)
    await provider.whenIdle()
    item = (await provider.getCatalog({})).items[0]
    expect(item?.sources[0]?.hasTechnicalInfo).toBe(true)
  })

  it('reports progress and connection status', async () => {
    touch('a.mp4')
    const phases: string[] = []
    provider.sources.onProgress((p: ScanProgress) => phases.push(p.phase))
    const connection = await addAndScan()
    expect(phases[0]).toBe('discovering')
    expect(phases.at(-1)).toBe('done')
    const [listed] = await provider.sources.listConnections()
    expect(listed).toMatchObject({ id: connection.id, status: 'connected', itemCount: 1 })
    expect(listed?.lastScannedAt).toBeTypeOf('number')
  })

  it('marks a missing location as offline and never deletes its index', async () => {
    touch('a.mp4')
    const connection = await addAndScan()
    rmSync(root, { recursive: true, force: true })

    const [listed] = await provider.sources.listConnections()
    expect(listed?.status).toBe('offline')
    await provider.sources.refreshConnection(connection.id)
    await provider.whenIdle()
    expect((await provider.getCatalog({})).total).toBe(1)
    expect((await provider.sources.listConnections())[0]?.status).toBe('offline')
  })

  it('rejects duplicate, overlapping, invalid and non-directory selections', async () => {
    touch('nested/a.mp4')
    const file = touch('file.mp4')
    await addAndScan()

    expect((await provider.sources.addConnection(root)).outcome).toBe('duplicate')
    expect((await provider.sources.addConnection(join(root, 'nested'))).outcome).toBe('error')
    expect((await provider.sources.addConnection(file)).outcome).toBe('error')
    expect((await provider.sources.addConnection('relative/path')).outcome).toBe('error')
    expect((await provider.sources.addConnection(42)).outcome).toBe('error')
    expect((await provider.sources.addConnection(join(root, 'missing'))).outcome).toBe('error')
  })

  it('removes a library together with its items', async () => {
    touch('a.mp4')
    const connection = await addAndScan()
    await provider.sources.removeConnection(connection.id)
    expect((await provider.getCatalog({})).total).toBe(0)
    expect(await provider.sources.listConnections()).toEqual([])
    expect(db.get<{ n: number }>('SELECT COUNT(*) n FROM media_sources')?.n).toBe(0)
  })

  it('paginates the catalog', async () => {
    for (const n of ['a', 'b', 'c']) touch(`${n}.mp4`)
    await addAndScan()
    const first = await provider.getCatalog({ limit: 2 })
    expect(first.items.map((i) => i.title)).toEqual(['a', 'b'])
    expect(first.nextCursor).toBe('2')
    const second = await provider.getCatalog({ limit: 2, cursor: first.nextCursor })
    expect(second.items.map((i) => i.title)).toEqual(['c'])
    expect(second.nextCursor).toBeUndefined()
  })
})

describe('LocalLibraryProvider playback', () => {
  it('resolves a PlaybackSource using the custom protocol, never a file path', async () => {
    touch('a.mp4')
    await addAndScan()
    const [item] = (await provider.getCatalog({})).items
    const playback = await provider.resolvePlayback(item!.id)
    expect(playback).toMatchObject({
      providerId: LOCAL_PROVIDER_ID,
      itemId: item!.id,
      sourceId: item!.sources[0]!.id,
      transport: 'progressive',
      mimeType: 'video/mp4',
      container: 'mp4',
      videoCodec: 'h264',
      audioCodec: 'aac'
    })
    expect(playback?.url).toBe(`rummage-media://stream/${item!.sources[0]!.id}`)
    expect(playback?.url).not.toContain(root)
  })

  it('returns null for unknown items, unknown sources and vanished files', async () => {
    const file = touch('a.mp4')
    await addAndScan()
    const [item] = (await provider.getCatalog({})).items
    expect(await provider.resolvePlayback('nope')).toBeNull()
    expect(await provider.resolvePlayback(item!.id, { sourceId: 'other' })).toBeNull()
    rmSync(file)
    expect(await provider.resolvePlayback(item!.id)).toBeNull()
  })

  it('streams only files that are inside the library and allow-listed', async () => {
    touch('a.mp4')
    const secret = realpathSync.native(mkdtempSync(join(tmpdir(), 'rummage-secret-')))
    try {
      writeFileSync(join(secret, 'secret.mp4'), 'secret')
      writeFileSync(join(secret, 'passwd'), 'secret')
      await addAndScan()
      const [item] = (await provider.getCatalog({})).items
      const sourceId = item!.sources[0]!.id
      expect(await provider.resolveStream(sourceId)).toMatchObject({
        mimeType: 'video/mp4',
        size: 11
      })

      // Tampered index pointing outside of the library
      db.run('UPDATE media_sources SET path = ? WHERE id = ?', [
        join(secret, 'secret.mp4'),
        sourceId
      ])
      expect(await provider.resolveStream(sourceId)).toBeNull()
      db.run('UPDATE media_sources SET path = ? WHERE id = ?', [
        join(root, '..', 'x', 'y.mp4'),
        sourceId
      ])
      expect(await provider.resolveStream(sourceId)).toBeNull()

      // A file swapped for a symlink that escapes the library
      const link = join(root, 'a.mp4')
      rmSync(link)
      symlinkSync(join(secret, 'secret.mp4'), link)
      db.run('UPDATE media_sources SET path = ? WHERE id = ?', [link, sourceId])
      expect(await provider.resolveStream(sourceId)).toBeNull()

      // Wrong file type
      db.run('UPDATE media_sources SET path = ?, extension = ? WHERE id = ?', [
        join(secret, 'passwd'),
        '.mp4',
        sourceId
      ])
      expect(await provider.resolveStream(sourceId)).toBeNull()
      expect(await provider.resolveStream('does-not-exist')).toBeNull()
    } finally {
      rmSync(secret, { recursive: true, force: true })
    }
  })
})
