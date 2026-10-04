import { useEffect, useState } from 'react'
import type { MediaItem, MediaSource, PlaybackSource } from '@shared/domain'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { Spinner } from '../components/Spinner'
import { VideoPlayer } from '../components/VideoPlayer'
import { describeContainer } from '../lib/playbackCompat'
import {
  formatBytes,
  formatDate,
  formatDuration,
  formatFrameRate,
  formatResolution
} from '../lib/format'
import { useApi } from '../lib/StashContext'
import './ItemScreen.css'

type PlaybackState =
  { status: 'loading' } | { status: 'ready'; playback: PlaybackSource } | { status: 'unavailable' }

function TechnicalBadges({ source, durationMs }: { source: MediaSource; durationMs?: number }) {
  const t = source.technical
  const entries = [
    formatResolution(t.width, t.height),
    formatDuration(durationMs),
    t.container ? describeContainer(t.container) : undefined,
    t.videoCodec?.toUpperCase(),
    t.audioCodec?.toUpperCase(),
    formatFrameRate(t.frameRate)
  ].filter((v): v is string => Boolean(v))
  if (entries.length === 0) return null
  return (
    <ul className="rm-item__badges" aria-label="Media details">
      {entries.map((entry, index) => (
        <li key={entry}>
          <Badge tone={index === 0 ? 'accent' : 'neutral'}>{entry}</Badge>
        </li>
      ))}
    </ul>
  )
}

export function ItemScreen({ item, onBack }: { item: MediaItem; onBack(): void }) {
  const api = useApi()
  const [state, setState] = useState<PlaybackState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    api.playback
      .resolve({ providerId: item.providerId, itemId: item.id })
      .then((playback) => {
        if (!cancelled)
          setState(playback ? { status: 'ready', playback } : { status: 'unavailable' })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'unavailable' })
      })
    return () => {
      cancelled = true
    }
  }, [api, item.providerId, item.id])

  const primary = item.sources[0]

  return (
    <article className="rm-item">
      <Button variant="ghost" icon="back" onClick={onBack} className="rm-item__back">
        Back
      </Button>

      {state.status === 'loading' ? (
        <div className="rm-item__stage rm-item__stage--loading">
          <Spinner size="2.25rem" label="Getting it ready" />
        </div>
      ) : state.status === 'ready' ? (
        <VideoPlayer item={item} playback={state.playback} onBack={onBack} />
      ) : (
        <EmptyState
          illustration={<Icon name="offline" size="3.5rem" />}
          title="Couldn’t get to that file."
          description="It may have been moved or deleted, or its source might be offline. Check Sources, then try again."
          action={<Button onClick={onBack}>Back</Button>}
        />
      )}

      <header className="rm-item__header">
        <h1 className="rm-item__title">{item.title}</h1>
        {primary ? <TechnicalBadges source={primary} durationMs={item.durationMs} /> : null}
      </header>

      {item.sources.map((source) => (
        <dl key={source.id} className="rm-item__facts">
          <div>
            <dt>File</dt>
            <dd>{source.location}</dd>
          </div>
          <div>
            <dt>Stash</dt>
            <dd>{source.connectionName}</dd>
          </div>
          {source.sizeBytes !== undefined ? (
            <div>
              <dt>Size</dt>
              <dd>{formatBytes(source.sizeBytes)}</dd>
            </div>
          ) : null}
          {source.modifiedAt !== undefined ? (
            <div>
              <dt>Modified</dt>
              <dd>{formatDate(source.modifiedAt)}</dd>
            </div>
          ) : null}
          {!source.hasTechnicalInfo ? (
            <div>
              <dt>Details</dt>
              <dd>Technical details aren’t available (ffprobe wasn’t able to read this file).</dd>
            </div>
          ) : null}
        </dl>
      ))}
    </article>
  )
}
