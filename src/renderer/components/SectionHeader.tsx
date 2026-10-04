import type { ReactNode } from 'react'
import './SectionHeader.css'

export interface SectionHeaderProps {
  title: string
  subtitle?: string
  /** Heading level for the title; page titles use 1, shelves use 2. */
  level?: 1 | 2
  id?: string
  action?: ReactNode
}

export function SectionHeader({ title, subtitle, level = 2, id, action }: SectionHeaderProps) {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <div className={`rm-section-header rm-section-header--l${level}`}>
      <div className="rm-section-header__text">
        <Heading id={id} className="rm-section-header__title">
          {title}
        </Heading>
        {subtitle ? <p className="rm-section-header__subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div className="rm-section-header__action">{action}</div> : null}
    </div>
  )
}
