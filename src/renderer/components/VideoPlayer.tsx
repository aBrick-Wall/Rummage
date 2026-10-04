import { useMemo, useState } from 'react'
import type { MediaItem, PlaybackSource } from '@shared/domain'
import {
  assessPlayback,
  describeContainer,
  describeMediaError,
  type CanPlayType
} from '../lib/playbackCompat'
import { Button } from './Button'
import { Icon } from './Icon'
import './VideoPlayer.css'

export interface VideoPlayerProps {
  item: MediaItem
  playback: PlaybackSource
  onBack(): void
  /** Overridable for tests; defaults to asking the real <video> element capabilities. */
  canPlayType?: CanPlayType
}

function browserCanPlayType(type: string): CanPlayTypeResult {
  return document.createElement('video').canPlayType(type)
}

/**
 * Plays a PlaybackSource that a provider resolved. The player never builds URLs: it only
 * uses the opaque `playback.url`. Unsupported media gets a clear explanation instead of a
 * broken player.
 */
export function VideoPlayer({
  item,
  playback,
  onBack,
  canPlayType = browserCanPlayType
}: VideoPlayerProps) {
  const verdict = useMemo(() => assessPlayback(playback, canPlayType), [playback, canPlayType])
  const [forced, setForced] = useState(false)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)

  const reason =
    runtimeError ?? (verdict.verdict === 'unsupported' && !forced ? verdict.reason : null)

  if (reason) {
    return (
      <div className="rm-player rm-player--unsupported" role="alert">
        <Icon name="film" size="3.5rem" />
        <h2 className="rm-player__title">This one won’t play here — yet.</h2>
        <p className="rm-player__reason">{reason}</p>
        <p className="rm-player__hint">
          {describeContainer(playback.container)}
          {playback.videoCodec ? ` · ${playback.videoCodec.toUpperCase()} video` : ''}
          {playback.audioCodec ? ` · ${playback.audioCodec.toUpperCase()} audio` : ''}. Rummage
          can’t convert media yet, so this file stays in your stash for later.
        </p>
        <div className="rm-player__actions">
          <Button variant="primary" icon="back" onClick={onBack}>
            Back
          </Button>
          {verdict.verdict === 'unsupported' && !forced && !runtimeError ? (
            <Button variant="ghost" onClick={() => setForced(true)}>
              Try playing anyway
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="rm-player">
      {verdict.verdict === 'partial' ? (
        <p className="rm-player__notice" role="status">
          <Icon name="info" /> {verdict.notice}
        </p>
      ) : null}
      {/* Captions/subtitles are intentionally deferred (see README). */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        key={playback.url}
        className="rm-player__video"
        src={playback.url}
        controls
        autoPlay
        preload="metadata"
        controlsList="nodownload"
        aria-label={`Playing ${item.title}`}
        onError={(event) => setRuntimeError(describeMediaError(event.currentTarget.error))}
      />
    </div>
  )
}
