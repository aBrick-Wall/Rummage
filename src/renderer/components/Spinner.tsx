import './Spinner.css'

export interface SpinnerProps {
  size?: string
  /** Accessible name. Pass null when the surrounding UI already announces the state. */
  label?: string | null
}

export function Spinner({ size = '1.5rem', label = 'Loading' }: SpinnerProps) {
  return (
    <span
      className="rm-spinner"
      style={{ width: size, height: size }}
      role={label ? 'status' : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
    />
  )
}
