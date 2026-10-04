import './BrandMark.css'

/** The raccoon-mask mark. Square, lime, readable at favicon size. */
export function BrandMark({ size = '2.5rem' }: { size?: string }) {
  return (
    <svg
      className="rm-brand-mark"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="48" height="48" rx="11" className="rm-brand-mark__tile" />
      <path
        d="M5 20Q24 10 43 20Q41 36 29 35Q24 31 19 35Q7 36 5 20Z"
        className="rm-brand-mark__mask"
      />
      <circle cx="16.5" cy="24" r="4.4" className="rm-brand-mark__eye" />
      <circle cx="31.5" cy="24" r="4.4" className="rm-brand-mark__eye" />
      <circle cx="17.7" cy="24.4" r="1.9" className="rm-brand-mark__pupil" />
      <circle cx="32.7" cy="24.4" r="1.9" className="rm-brand-mark__pupil" />
    </svg>
  )
}
