import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../shared/ipc/contract'

const invoke = vi.fn(async () => undefined)
const on = vi.fn()
const removeListener = vi.fn()
const exposeInMainWorld = vi.fn()

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke, on, removeListener }
}))

async function loadApi(): Promise<Record<string, Record<string, (...args: unknown[]) => unknown>>> {
  vi.resetModules()
  await import('./index')
  const call = exposeInMainWorld.mock.calls[0] as unknown as [string, never]
  expect(call[0]).toBe('rummage')
  return call[1]
}

beforeEach(() => {
  exposeInMainWorld.mockClear()
  invoke.mockClear()
  on.mockClear()
  removeListener.mockClear()
})

describe('preload bridge', () => {
  it('exposes one namespace with a fixed set of methods and no raw Electron objects', async () => {
    const api = await loadApi()
    expect(exposeInMainWorld).toHaveBeenCalledTimes(1)
    expect(Object.keys(api).sort()).toEqual(['app', 'catalog', 'playback', 'sources'])
    const flat = Object.values(api).flatMap((group) => Object.entries(group))
    for (const [name, value] of flat) {
      expect(typeof value, name).toBe('function')
    }
    expect(JSON.stringify(Object.keys(api))).not.toMatch(/ipc|electron|send|invoke/i)
  })

  it('maps every method onto a known channel only', async () => {
    const api = await loadApi()
    const known = new Set<string>(Object.values(CHANNELS))
    await api['app']!['getInfo']!()
    await api['catalog']!['getHome']!()
    await api['catalog']!['browse']!({ sort: 'title' })
    await api['catalog']!['search']!({ query: 'x' })
    await api['catalog']!['getItem']!({ providerId: 'p', itemId: 'i' })
    await api['playback']!['resolve']!({ providerId: 'p', itemId: 'i' }, 's')
    await api['sources']!['list']!()
    await api['sources']!['add']!()
    await api['sources']!['rescan']!('c')
    await api['sources']!['remove']!('c')
    const channels = invoke.mock.calls.map((c) => (c as unknown as [string])[0])
    expect(channels).toHaveLength(10)
    for (const channel of channels) expect(known.has(channel), channel).toBe(true)
  })

  it('never lets the renderer supply a path when adding a stash', async () => {
    const api = await loadApi()
    await api['sources']!['add']!('/etc')
    expect(invoke).toHaveBeenCalledWith(CHANNELS.sourcesAdd)
  })

  it('subscribes to scan progress without leaking the IPC event object', async () => {
    const api = await loadApi()
    const listener = vi.fn()
    const unsubscribe = api['sources']!['onScanProgress']!(listener) as () => void
    const wrapped = on.mock.calls[0]![1] as (event: unknown, progress: unknown) => void
    wrapped({ sender: 'secret' }, { phase: 'done' })
    expect(listener).toHaveBeenCalledWith({ phase: 'done' })
    unsubscribe()
    expect(removeListener).toHaveBeenCalledWith(CHANNELS.scanProgress, wrapped)
  })
})
