import { AddStashControl } from './AddStashControl'
import { EmptyState } from './EmptyState'
import { Mascot } from './Mascot'

/** The new-installation state shared by Home, Your Stash and Sources. */
export function EmptyStash() {
  return (
    <EmptyState
      illustration={<Mascot width="20rem" label="A raccoon watching TV with a bucket of popcorn" />}
      title="Your stash is looking suspiciously empty."
      description="Add a folder to start rummaging."
      action={<AddStashControl size="lg" />}
      footnote="Connect a folder, media PC, or network storage containing media you own or have permission to access."
    />
  )
}
