import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import './NavigationItem.css'

export interface NavigationItemProps {
  label: string
  icon: IconName
  active?: boolean
  onSelect(): void
  /** Short trailing text such as a count. */
  trailing?: ReactNode
}

export function NavigationItem({
  label,
  icon,
  active = false,
  onSelect,
  trailing
}: NavigationItemProps) {
  return (
    <button
      type="button"
      className={`rm-nav-item${active ? ' rm-nav-item--active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onSelect}
    >
      <Icon name={icon} size="1.5rem" />
      <span className="rm-nav-item__label">{label}</span>
      {trailing ? <span className="rm-nav-item__trailing">{trailing}</span> : null}
    </button>
  )
}
