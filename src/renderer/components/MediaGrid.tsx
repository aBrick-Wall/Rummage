import type { MediaItem } from '@shared/domain'
import { MediaCard } from './MediaCard'
import './MediaGrid.css'

export interface MediaGridProps {
  items: MediaItem[]
  onSelect(item: MediaItem): void
  label: string
}

export function MediaGrid({ items, onSelect, label }: MediaGridProps) {
  return (
    <ul className="rm-grid" aria-label={label}>
      {items.map((item) => (
        <li key={`${item.providerId}:${item.id}`} className="rm-grid__cell">
          <MediaCard item={item} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  )
}
