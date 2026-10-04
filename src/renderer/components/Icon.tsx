import type { ReactNode, SVGProps } from 'react'

const PATHS = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h4.5V14h4v5.5h4.5V10" />,
  stash: (
    <>
      <path d="M4 8h16l-1.4 11.2a1 1 0 0 1-1 .8H6.4a1 1 0 0 1-1-.8L4 8Z" />
      <path d="M3 8l1.2-3.2a1 1 0 0 1 .9-.6h13.8a1 1 0 0 1 .9.6L21 8M9.5 12.5h5" />
    </>
  ),
  finds: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m14.8 9.2-1.6 4-4 1.6 1.6-4 4-1.6Z" />
    </>
  ),
  sources: (
    <>
      <rect x="3.5" y="4" width="17" height="6.5" rx="1.5" />
      <rect x="3.5" y="13.5" width="17" height="6.5" rx="1.5" />
      <path d="M7 7.25h.01M7 16.75h.01" />
    </>
  ),
  pile: <path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5ZM4 12l8 3.5 8-3.5M4 16.5 12 20l8-3.5" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  back: <path d="m14 6-6 6 6 6M8.5 12H20" />,
  play: <path d="M8 5.5v13l11-6.5-11-6.5Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  warning: <path d="M12 4 2.8 19.5h18.4L12 4ZM12 10v4.5M12 17.2h.01" />,
  offline: (
    <path d="M4 4l16 16M8.5 8.8A9 9 0 0 0 3 12.5M12 17.5h.01M5.5 15a9 9 0 0 1 3-1.8M14 10.2a9 9 0 0 1 6.5 3.4" />
  ),
  refresh: (
    <path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.3L20 15.5M20 20v-4.5h-4.5" />
  ),
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7M10 11v5M14 11v5" />,
  film: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M8 4.5v15M16 4.5v15M3.5 9.5H8M3.5 14.5H8M16 9.5h4.5M16 14.5h4.5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>
  )
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof PATHS

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number | string
}

/** Decorative by default; pass `aria-label` (and `role="img"`) when an icon stands alone. */
export function Icon({ name, size = '1.25em', ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={rest['aria-label'] ? undefined : true}
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}
