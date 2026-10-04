import type { ComponentPropsWithoutRef, ElementType } from 'react'
import './Card.css'

type CardProps<T extends ElementType> = {
  as?: T
  /** Adds hover/focus affordances. Use with focusable elements (button/a). */
  interactive?: boolean
} & Omit<ComponentPropsWithoutRef<T>, 'as'>

/** The base Dumpsterlight surface: rounded, softly elevated, lime on focus. */
export function Card<T extends ElementType = 'div'>({
  as,
  interactive = false,
  className,
  ...rest
}: CardProps<T>) {
  const Component: ElementType = as ?? 'div'
  const classes = ['rm-card', interactive && 'rm-card--interactive', className]
    .filter(Boolean)
    .join(' ')
  return <Component className={classes} {...rest} />
}
