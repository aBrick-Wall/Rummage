import { useCallback, useEffect, useState } from 'react'
import type { MediaItem } from '@shared/domain'
import { AddStashControl } from '../components/AddStashControl'
import { Button } from '../components/Button'
import { EmptyStash } from '../components/EmptyStash'
import { MediaGrid } from '../components/MediaGrid'
import { ScanBanner } from '../components/ScanBanner'
import { SectionHeader } from '../components/SectionHeader'
import { Spinner } from '../components/Spinner'
import { useApi, useStash } from '../lib/StashContext'

const PAGE_SIZE = 60

export function StashScreen({ onOpenItem }: { onOpenItem(item: MediaItem): void }) {
  const api = useApi()
  const { ready, connections, progress, catalogVersion } = useStash()
  const [items, setItems] = useState<MediaItem[]>([])
  const [total, setTotal] = useState(0)
  const [cursor, setCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void api.catalog.browse({ sort: 'title', limit: PAGE_SIZE }).then((page) => {
      if (cancelled) return
      setItems(page.items)
      setTotal(page.total)
      setCursor(page.nextCursor)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [api, catalogVersion])

  const loadMore = useCallback(async () => {
    const page = await api.catalog.browse({ sort: 'title', limit: PAGE_SIZE, cursor })
    setItems((current) => [...current, ...page.items])
    setCursor(page.nextCursor)
  }, [api, cursor])

  if (!ready || loading) {
    return (
      <div className="rm-screen-loading">
        <Spinner size="2rem" label="Loading your stash" />
      </div>
    )
  }

  return (
    <>
      <SectionHeader
        level={1}
        title="Your Stash"
        subtitle="Connect a folder, media PC, or network storage containing media you own or have permission to access."
        action={connections.length > 0 ? <AddStashControl /> : undefined}
      />
      <ScanBanner progress={progress} connections={connections} />
      {connections.length === 0 ? (
        <EmptyStash />
      ) : items.length === 0 ? (
        Object.keys(progress).length === 0 && (
          <p className="rm-muted">No supported videos found in your connected folders yet.</p>
        )
      ) : (
        <>
          <p className="rm-muted rm-count">
            {total} {total === 1 ? 'video' : 'videos'}
          </p>
          <MediaGrid items={items} onSelect={onOpenItem} label="Your Stash" />
          {cursor ? (
            <div className="rm-load-more">
              <Button onClick={() => void loadMore()}>Show more</Button>
            </div>
          ) : null}
        </>
      )}
    </>
  )
}
