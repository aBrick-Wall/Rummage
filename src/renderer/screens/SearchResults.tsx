import { useEffect, useState } from 'react'
import type { MediaItem } from '@shared/domain'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { MediaGrid } from '../components/MediaGrid'
import { SectionHeader } from '../components/SectionHeader'
import { Spinner } from '../components/Spinner'
import { useApi, useStash } from '../lib/StashContext'

export interface SearchResultsProps {
  query: string
  onOpenItem(item: MediaItem): void
}

export function SearchResults({ query, onOpenItem }: SearchResultsProps) {
  const api = useApi()
  const { catalogVersion } = useStash()
  const [state, setState] = useState<{ query: string; items: MediaItem[]; total: number } | null>(
    null
  )

  useEffect(() => {
    let cancelled = false
    void api.catalog.search({ query, limit: 120 }).then((page) => {
      if (!cancelled) setState({ query, items: page.items, total: page.total })
    })
    return () => {
      cancelled = true
    }
  }, [api, query, catalogVersion])

  if (!state || state.query !== query) {
    return (
      <div className="rm-screen-loading">
        <Spinner size="2rem" label="Rummaging" />
      </div>
    )
  }

  if (state.items.length === 0) {
    return (
      <EmptyState
        illustration={<Icon name="search" size="3rem" />}
        title="Nothing turned up in that rummage."
        description="Try another title or check your sources."
      />
    )
  }

  return (
    <>
      <SectionHeader
        level={1}
        title="Rummage results"
        subtitle={`${state.total} ${state.total === 1 ? 'match' : 'matches'} for “${query}”`}
      />
      <MediaGrid items={state.items} onSelect={onOpenItem} label={`Results for ${query}`} />
    </>
  )
}
