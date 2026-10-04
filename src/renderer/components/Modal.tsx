import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import './Modal.css'

export interface ModalProps {
  open: boolean
  title: string
  onClose(): void
  children: ReactNode
  /** Buttons rendered in the footer. */
  actions?: ReactNode
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/** Accessible modal dialog: traps focus, closes on Escape, restores focus on close. */
export function Modal({ open, title, onClose, children, actions }: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const previouslyFocused = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const first =
      dialog?.querySelector<HTMLElement>('[data-autofocus]') ??
      dialog?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? dialog)?.focus()
    return () => previouslyFocused?.focus?.()
  }, [open])

  if (!open) return null

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (focusable.length === 0) return
    const first = focusable[0] as HTMLElement
    const last = focusable[focusable.length - 1] as HTMLElement
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    // Backdrop click is a mouse convenience only; keyboard users close with Escape or the buttons.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="rm-modal__backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Key handling implements the dialog focus trap and Escape-to-close. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        className="rm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId} className="rm-modal__title">
          {title}
        </h2>
        <div className="rm-modal__body">{children}</div>
        <div className="rm-modal__actions">
          {actions ?? <Button onClick={onClose}>Close</Button>}
        </div>
      </div>
    </div>,
    document.body
  )
}
