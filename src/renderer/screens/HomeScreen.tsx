import type { MediaItem } from '@shared/domain'
import { Button } from '../components/Button'
import { EmptyStash } from '../components/EmptyStash'
import { EmptyState } from '../components/EmptyState'
import { MediaShelf } from '../components/MediaShelf'
import { ScanBanner } from '../components/ScanBanner'
import { Spinner } from '../components/Spinner'
import { useStash } from '../lib/StashContext'
import type { SectionId } from '../lib/routes'

export interface HomeScreenProps {
  onOpenItem(item: MediaItem): void
  onNavigate(section: SectionId): void
}

/** Home only shows shelves backed by real data; unbuilt features simply don't appear yet. */
export function HomeScreen({ onOpenItem, onNavigate }: HomeScreenProps) {
  const { ready, loadError, connections, home, progress } = useStash()

  if (!ready) {
    return (
      <div className="rm-screen-loading">
        <Spinner size="2rem" label="Loading your stash" />
      </div>
    )
  }

  if (loadError) {
    return <EmptyState title="Something went sideways." description={loadError} />
  }

  return (
    <>
      <h1 className="rm-visually-hidden">Home</h1>
      <ScanBanner progress={progress} connections={connections} />
      {connections.length === 0 ? (
        <EmptyStash />
      ) : home.totalItems === 0 ? (
        Object.keys(progress).length === 0 && (
          <EmptyState
            title="No videos turned up yet."
            description="Rummage didn't find any supported video files in the folders you added."
            action={<Button onClick={() => onNavigate('sources')}>Check Sources</Button>}
          />
        )
      ) : (
        <>
          <MediaShelf title="Recently Added" items={home.recentlyAdded} onSelect={onOpenItem} />
          <MediaShelf
            title="Your Stash"
            subtitle={`${home.totalItems} ${home.totalItems === 1 ? 'video' : 'videos'} in your stash`}
            items={home.yourStash}
            onSelect={onOpenItem}
            action={
              <Button variant="ghost" onClick={() => onNavigate('stash')}>
                See all
              </Button>
            }
          />
        </>
      )}
    </>
  )
}
