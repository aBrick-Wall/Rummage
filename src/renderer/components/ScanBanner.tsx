import type { ScanProgress, SourceConnection } from '@shared/domain'
import { Spinner } from './Spinner'
import './ScanBanner.css'

function describe(progress: ScanProgress): string {
  switch (progress.phase) {
    case 'discovering':
      return progress.filesFound > 0
        ? `Looking around… ${progress.filesFound} videos found so far`
        : 'Looking around…'
    case 'reading':
      return `Reading ${progress.filesProcessed} of ${progress.filesFound} videos`
    case 'finishing':
      return 'Tidying up…'
    default:
      return 'Rummaging…'
  }
}

export interface ScanBannerProps {
  progress: Readonly<Record<string, ScanProgress>>
  connections: SourceConnection[]
}

/** Shown while any stash is being scanned; announces progress politely to screen readers. */
export function ScanBanner({ progress, connections }: ScanBannerProps) {
  const active = Object.values(progress)
  const first = active[0]
  if (!first) return null
  const name = connections.find((c) => c.id === first.connectionId)?.name
  return (
    <div className="rm-scan-banner" role="status" aria-live="polite">
      <Spinner size="1.25rem" label={null} />
      <span>
        {name ? <strong>{name}: </strong> : null}
        {describe(first)}
        {active.length > 1 ? ` (+${active.length - 1} more)` : ''}
      </span>
    </div>
  )
}
