import { useCallback, useEffect, useRef, useState } from 'react'
import type { MediaItem } from '@shared/domain'
import type { RummageApi } from '@shared/ipc/contract'
import { AddStashControl } from './components/AddStashControl'
import { BrandMark } from './components/BrandMark'
import type { IconName } from './components/Icon'
import { NavigationItem } from './components/NavigationItem'
import { SearchField } from './components/SearchField'
import { useDebounced } from './lib/useDebounced'
import { SECTION_LABELS, type Route, type SectionId } from './lib/routes'
import { handleArrowNavigation } from './lib/spatialNav'
import { StashProvider, useStash } from './lib/StashContext'
import { ComingSoonScreen } from './screens/ComingSoonScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ItemScreen } from './screens/ItemScreen'
import { SearchResults } from './screens/SearchResults'
import { SettingsScreen } from './screens/SettingsScreen'
import { SourcesScreen } from './screens/SourcesScreen'
import { StashScreen } from './screens/StashScreen'
import './App.css'

const NAV: { id: SectionId; icon: IconName }[] = [
  { id: 'home', icon: 'home' },
  { id: 'stash', icon: 'stash' },
  { id: 'free-finds', icon: 'finds' },
  { id: 'sources', icon: 'sources' },
  { id: 'watch-pile', icon: 'pile' },
  { id: 'settings', icon: 'settings' }
]

function sectionOf(route: Route): SectionId {
  return route.name === 'item' ? sectionOf(route.from) : route.name
}

function Shell() {
  const { connections } = useStash()
  const [route, setRoute] = useState<Route>({ name: 'home' })
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  const trimmed = query.trim()
  const debounced = useDebounced(trimmed, 200)
  const effectiveQuery = debounced !== '' ? debounced : trimmed

  const navigate = useCallback((section: SectionId) => {
    setQuery('')
    setRoute({ name: section })
  }, [])

  const openItem = useCallback((item: MediaItem) => {
    setRoute((current) => ({
      name: 'item',
      item,
      from: current.name === 'item' ? current.from : current
    }))
  }, [])

  const closeItem = useCallback(() => {
    setRoute((current) => (current.name === 'item' ? current.from : current))
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
      const wantsSearch = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
      if (wantsSearch || (event.key === '/' && !typing)) {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
      handleArrowNavigation(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const itemId = route.name === 'item' ? route.item.id : ''
  const viewKey = itemId ? `item:${itemId}` : route.name
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    mainRef.current?.focus({ preventScroll: true })
    mainRef.current?.scrollTo({ top: 0 })
  }, [viewKey])

  const activeSection = sectionOf(route)

  let content
  if (route.name === 'item') {
    content = (
      <ItemScreen
        key={`${route.item.providerId}:${route.item.id}`}
        item={route.item}
        onBack={closeItem}
      />
    )
  } else if (trimmed !== '') {
    content = <SearchResults query={effectiveQuery} onOpenItem={openItem} />
  } else if (route.name === 'home') {
    content = <HomeScreen onOpenItem={openItem} onNavigate={navigate} />
  } else if (route.name === 'stash') {
    content = <StashScreen onOpenItem={openItem} />
  } else if (route.name === 'sources') {
    content = <SourcesScreen />
  } else if (route.name === 'settings') {
    content = <SettingsScreen />
  } else {
    content = <ComingSoonScreen section={route.name} />
  }

  return (
    <div className="rm-app">
      <aside className="rm-sidebar">
        <div className="rm-brand">
          <BrandMark size="3rem" />
          <div>
            <p className="rm-brand__name">Rummage</p>
            <p className="rm-brand__byline">by Dumpsterlight Digital</p>
          </div>
        </div>
        <nav aria-label="Main">
          <ul className="rm-sidebar__nav">
            {NAV.map(({ id, icon }) => (
              <li key={id}>
                <NavigationItem
                  label={SECTION_LABELS[id]}
                  icon={icon}
                  active={activeSection === id && trimmed === ''}
                  onSelect={() => navigate(id)}
                />
              </li>
            ))}
          </ul>
        </nav>
        <p className="rm-sidebar__footer">Raccoonware</p>
      </aside>

      <div className="rm-main">
        <header className="rm-topbar">
          <SearchField ref={searchRef} value={query} onChange={setQuery} />
          {connections.length > 0 ? <AddStashControl /> : null}
        </header>
        <main ref={mainRef} className="rm-content" tabIndex={-1} data-view={viewKey}>
          {content}
        </main>
      </div>
    </div>
  )
}

export function App({ api }: { api: RummageApi }) {
  return (
    <StashProvider api={api}>
      <Shell />
    </StashProvider>
  )
}
