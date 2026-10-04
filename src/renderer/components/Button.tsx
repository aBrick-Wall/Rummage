import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { Icon, type IconName } from './Icon'
import './Button.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'lg'
  icon?: IconName
  children?: ReactNode
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className,
  type = 'button',
  ref,
  ...rest
}: ButtonProps) {
  const classes = ['rm-button', `rm-button--${variant}`, `rm-button--${size}`, className]
    .filter(Boolean)
    .join(' ')
  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children ? <span>{children}</span> : null}
    </button>
  )
}
