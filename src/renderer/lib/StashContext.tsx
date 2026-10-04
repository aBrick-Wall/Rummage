import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type { AddSourceResult, ScanProgress, SourceConnection } from '@shared/domain'
import type { HomeShelves, RummageApi } from '@shared/ipc/contract'

export interface StashState {
  /** False until the first load completes, so screens can show a loading state. */
  ready: boolean
  loadError: string | null
  connections: SourceConnection[]
  home: HomeShelves
  progress: Readonly<Record<string, ScanProgress>>
  /** Bumps whenever the indexed catalog may have changed (screens refetch on it). */
  catalogVersion: number
  addStash(): Promise<AddSourceResult>
  rescan(connectionId: string): Promise<void>
  remove(connectionId: string): Promise<void>
  refresh(): Promise<void>
}

const EMPTY_HOME: HomeShelves = { recentlyAdded: [], yourStash: [], totalItems: 0 }
const LIVE_REFRESH_INTERVAL_MS = 2000

const StashContext = createContext<StashState | null>(null)
const ApiContext = createContext<RummageApi | null>(null)

export function StashProvider({ api, children }: { api: RummageApi; children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [connections, setConnections] = useState<SourceConnection[]>([])
  const [home, setHome] = useState<HomeShelves>(EMPTY_HOME)
  const [progress, setProgress] = useState<Record<string, ScanProgress>>({})
  const [catalogVersion, setCatalogVersion] = useState(0)
  const lastLiveRefresh = useRef(0)

  const refresh = useCallback(async () => {
    try {
      const [nextConnections, nextHome] = await Promise.all([
        api.sources.list(),
        api.catalog.getHome()
      ])
      setConnections(nextConnections)
      setHome(nextHome)
      setLoadError(null)
      setCatalogVersion((v) => v + 1)
    } catch {
      setLoadError("Rummage couldn't load your stash.")
    } finally {
      setReady(true)
    }
  }, [api])

  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0)
    const unsubscribe = api.sources.onScanProgress((update) => {
      setProgress((current) => {
        if (update.phase === 'done' || update.phase === 'failed') {
          const { [update.connectionId]: _finished, ...rest } = current
          return rest
        }
        return { ...current, [update.connectionId]: update }
      })
      const finished = update.phase === 'done' || update.phase === 'failed'
      const now = Date.now()
      if (
        finished ||
        (update.phase === 'reading' && now - lastLiveRefresh.current > LIVE_REFRESH_INTERVAL_MS)
      ) {
        lastLiveRefresh.current = now
        void refresh()
      }
    })
    return () => {
      clearTimeout(initial)
      unsubscribe()
    }
  }, [api, refresh])

  const value = useMemo<StashState>(
    () => ({
      ready,
      loadError,
      connections,
      home,
      progress,
      catalogVersion,
      refresh,
      addStash: async () => {
        const result = await api.sources.add()
        if (result.outcome === 'added') await refresh()
        return result
      },
      rescan: async (id) => {
        await api.sources.rescan(id)
        await refresh()
      },
      remove: async (id) => {
        await api.sources.remove(id)
        await refresh()
      }
    }),
    [api, ready, loadError, connections, home, progress, catalogVersion, refresh]
  )

  return (
    <ApiContext.Provider value={api}>
      <StashContext.Provider value={value}>{children}</StashContext.Provider>
    </ApiContext.Provider>
  )
}

export function useStash(): StashState {
  const value = useContext(StashContext)
  if (!value) throw new Error('useStash must be used inside <StashProvider>')
  return value
}

export function useApi(): RummageApi {
  const api = useContext(ApiContext)
  if (!api) throw new Error('useApi must be used inside <StashProvider>')
  return api
}
