import type { ReactNode } from 'react'
import './EmptyState.css'

export interface EmptyStateProps {
  title: string
  description?: ReactNode
  /** Typically the Mascot, or a small icon. */
  illustration?: ReactNode
  action?: ReactNode
  /** Secondary text under the action (e.g. supported formats). */
  footnote?: ReactNode
}

export function EmptyState({
  title,
  description,
  illustration,
  action,
  footnote
}: EmptyStateProps) {
  return (
    <section className="rm-empty" aria-label={title}>
      {illustration ? <div className="rm-empty__art">{illustration}</div> : null}
      <h2 className="rm-empty__title">{title}</h2>
      {description ? <p className="rm-empty__description">{description}</p> : null}
      {action ? <div className="rm-empty__action">{action}</div> : null}
      {footnote ? <p className="rm-empty__footnote">{footnote}</p> : null}
    </section>
  )
}
