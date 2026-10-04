import type { MediaItem } from '@shared/domain'
import { formatDuration, formatResolution, hashToIndex, titleGlyph } from '../lib/format'
import { Badge } from './Badge'
import { Card } from './Card'
import './MediaCard.css'

export interface MediaCardProps {
  item: MediaItem
  onSelect(item: MediaItem): void
  /** Fixed width for shelf layouts; grids let the card fill its cell. */
  variant?: 'shelf' | 'grid'
}

const PALETTES = 5

function pickArtwork(item: MediaItem) {
  return (
    item.artwork.find((a) => a.kind === 'backdrop') ??
    item.artwork.find((a) => a.kind === 'thumbnail') ??
    item.artwork.find((a) => a.kind === 'poster')
  )
}

export function MediaCard({ item, onSelect, variant = 'grid' }: MediaCardProps) {
  const artwork = pickArtwork(item)
  const technical = item.sources[0]?.technical
  const resolution = formatResolution(technical?.width, technical?.height)
  const duration = formatDuration(item.durationMs)
  const palette = hashToIndex(`${item.providerId}:${item.id}`, PALETTES) + 1
  const label = duration ? `${item.title}, ${duration}` : item.title

  return (
    <Card
      as="button"
      interactive
      className={`rm-media-card rm-media-card--${variant}`}
      onClick={() => onSelect(item)}
      aria-label={label}
      title={item.title}
    >
      <span className="rm-media-card__art" data-palette={palette}>
        {artwork ? (
          <img src={artwork.url} alt="" loading="lazy" draggable={false} />
        ) : (
          <span className="rm-media-card__glyph" aria-hidden="true">
            {titleGlyph(item.title)}
          </span>
        )}
        <span className="rm-media-card__badges">
          {resolution ? <Badge tone="accent">{resolution}</Badge> : null}
          {duration ? <Badge tone="overlay">{duration}</Badge> : null}
        </span>
      </span>
      <span className="rm-media-card__meta">
        <span className="rm-media-card__title">{item.title}</span>
        <span className="rm-media-card__sub">{item.sources[0]?.connectionName}</span>
      </span>
    </Card>
  )
}
