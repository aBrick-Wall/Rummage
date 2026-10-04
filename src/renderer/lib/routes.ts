import type { MediaItem } from '@shared/domain'

export type SectionId = 'home' | 'stash' | 'free-finds' | 'sources' | 'watch-pile' | 'settings'

export type Route = { name: SectionId } | { name: 'item'; item: MediaItem; from: Route }

export const SECTION_LABELS: Record<SectionId, string> = {
  home: 'Home',
  stash: 'Your Stash',
  'free-finds': 'Free Finds',
  sources: 'Sources',
  'watch-pile': 'Watch Pile',
  settings: 'Settings'
}
