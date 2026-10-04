import type { SourceStatus } from '@shared/domain'
import { Icon, type IconName } from './Icon'
import { Spinner } from './Spinner'
import './StatusIndicator.css'

const STATUS_LABEL: Record<SourceStatus, string> = {
  connected: 'Connected',
  scanning: 'Scanning',
  offline: 'Offline',
  'needs-attention': 'Needs Attention'
}

const STATUS_ICON: Record<Exclude<SourceStatus, 'scanning'>, IconName> = {
  connected: 'check',
  offline: 'offline',
  'needs-attention': 'warning'
}

export interface StatusIndicatorProps {
  status: SourceStatus
  /** Extra explanation exposed to assistive tech and as a tooltip. */
  detail?: string
}

/** Color is never the only signal: every status has an icon and a text label. */
export function StatusIndicator({ status, detail }: StatusIndicatorProps) {
  return (
    <span
      className={`rm-status rm-status--${status}`}
      title={detail}
      role="status"
      aria-label={detail ? `${STATUS_LABEL[status]}. ${detail}` : STATUS_LABEL[status]}
    >
      <span className="rm-status__icon" aria-hidden="true">
        {status === 'scanning' ? (
          <Spinner size="1em" label={null} />
        ) : (
          <Icon name={STATUS_ICON[status]} size="1em" />
        )}
      </span>
      <span className="rm-status__label" aria-hidden="true">
        {STATUS_LABEL[status]}
      </span>
    </span>
  )
}
