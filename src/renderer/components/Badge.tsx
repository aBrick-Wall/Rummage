import type { ReactNode } from 'react'
import './Badge.css'

export interface BadgeProps {
  tone?: 'neutral' | 'accent' | 'warning' | 'success' | 'overlay'
  children: ReactNode
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={`rm-badge rm-badge--${tone}`}>{children}</span>
}
