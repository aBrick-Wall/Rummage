import type { ReactNode } from 'react'
import { useId } from 'react'
import type { MediaItem } from '@shared/domain'
import { MediaCard } from './MediaCard'
import { SectionHeader } from './SectionHeader'
import './MediaShelf.css'

export interface MediaShelfProps {
  title: string
  subtitle?: string
  items: MediaItem[]
  onSelect(item: MediaItem): void
  action?: ReactNode
}

/** A titled, horizontally scrolling row of media cards. */
export function MediaShelf({ title, subtitle, items, onSelect, action }: MediaShelfProps) {
  const headingId = useId()
  return (
    <section className="rm-shelf" aria-labelledby={headingId}>
      <SectionHeader id={headingId} title={title} subtitle={subtitle} action={action} />
      <ul className="rm-shelf__track">
        {items.map((item) => (
          <li key={`${item.providerId}:${item.id}`} className="rm-shelf__cell">
            <MediaCard item={item} variant="shelf" onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </section>
  )
}
