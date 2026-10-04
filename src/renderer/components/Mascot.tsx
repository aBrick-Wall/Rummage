import { useId } from 'react'
import './Mascot.css'

export interface MascotProps {
  /** CSS width of the illustration. Height follows the aspect ratio. */
  width?: string
  animated?: boolean
  /** Describes the illustration to assistive tech. Omit to mark it decorative. */
  label?: string
}

/**
 * The Dumpsterlight raccoon, settled in front of a glowing TV with a bucket of popcorn and
 * the remote within reach. Drawn entirely from design tokens (see Mascot.css).
 */
export function Mascot({ width = '16rem', animated = true, label }: MascotProps) {
  const uid = useId().replace(/:/g, '')
  const glowId = `glow-${uid}`
  const screenId = `screen-${uid}`

  return (
    <svg
      className={`rm-mascot${animated ? ' rm-mascot--animated' : ''}`}
      style={{ width }}
      viewBox="0 0 360 260"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" className="rm-mascot__glow-a" />
          <stop offset="100%" className="rm-mascot__glow-b" />
        </radialGradient>
        <linearGradient id={screenId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" className="rm-mascot__screen-a" />
          <stop offset="100%" className="rm-mascot__screen-b" />
        </linearGradient>
      </defs>

      <ellipse
        cx="235"
        cy="130"
        rx="150"
        ry="110"
        fill={`url(#${glowId})`}
        className="rm-mascot__glow"
      />
      <ellipse cx="185" cy="246" rx="165" ry="9" className="rm-mascot__floor" />

      {/* Television */}
      <g>
        <path d="M265 72 238 38M295 72 322 40" className="rm-mascot__antenna" />
        <circle cx="238" cy="38" r="4" className="rm-mascot__antenna-tip" />
        <circle cx="322" cy="40" r="4" className="rm-mascot__antenna-tip" />
        <rect x="196" y="70" width="150" height="124" rx="16" className="rm-mascot__tv" />
        <rect
          x="208"
          y="82"
          width="104"
          height="100"
          rx="10"
          fill={`url(#${screenId})`}
          className="rm-mascot__screen"
        />
        <path d="M242 112v40l32-20-32-20Z" className="rm-mascot__play" />
        <circle cx="329" cy="104" r="6" className="rm-mascot__knob" />
        <circle cx="329" cy="126" r="6" className="rm-mascot__knob" />
        <path d="M322 150h14M322 158h14M322 166h14" className="rm-mascot__vent" />
        <rect x="214" y="194" width="14" height="10" rx="2" className="rm-mascot__tv" />
        <rect x="314" y="194" width="14" height="10" rx="2" className="rm-mascot__tv" />
      </g>

      {/* Raccoon */}
      <g className="rm-mascot__raccoon">
        <path d="M70 218C10 222 -2 156 40 134" className="rm-mascot__tail" />
        <path d="M70 218C10 222 -2 156 40 134" className="rm-mascot__tail-rings" />
        <ellipse cx="105" cy="200" rx="54" ry="48" className="rm-mascot__fur" />
        <ellipse cx="124" cy="210" rx="30" ry="32" className="rm-mascot__belly" />
        <ellipse cx="84" cy="244" rx="18" ry="8" className="rm-mascot__dark" />
        <ellipse cx="140" cy="244" rx="18" ry="8" className="rm-mascot__dark" />

        <path d="M80 100 76 70 104 88Z" className="rm-mascot__fur" />
        <path d="M84 96 82 78 98 90Z" className="rm-mascot__dark" />
        <path d="M130 90 150 66 158 98Z" className="rm-mascot__fur" />
        <path d="M137 92 148 76 152 94Z" className="rm-mascot__dark" />
        <ellipse cx="116" cy="122" rx="46" ry="38" className="rm-mascot__fur" />
        <ellipse cx="140" cy="136" rx="25" ry="18" className="rm-mascot__muzzle" />
        <path
          d="M82 114Q114 98 152 112Q150 138 128 136Q96 138 82 114Z"
          className="rm-mascot__dark"
        />
        <circle cx="106" cy="118" r="7.5" className="rm-mascot__eye" />
        <circle cx="136" cy="118" r="7.5" className="rm-mascot__eye" />
        <circle cx="109" cy="119" r="3.4" className="rm-mascot__pupil" />
        <circle cx="139" cy="119" r="3.4" className="rm-mascot__pupil" />
        <ellipse cx="162" cy="132" rx="7" ry="5.5" className="rm-mascot__dark" />

        {/* Popcorn bucket and snacking paw */}
        <path d="M108 188h46l-6 44h-34l-6-44Z" className="rm-mascot__bucket" />
        <path d="M122 190l2 42M138 190l-2 42" className="rm-mascot__bucket-stripe" />
        <g className="rm-mascot__popcorn">
          <circle cx="116" cy="184" r="8" />
          <circle cx="130" cy="180" r="9" />
          <circle cx="145" cy="184" r="8" />
          <circle cx="124" cy="174" r="7" />
          <circle cx="138" cy="173" r="7" />
        </g>
        <ellipse cx="106" cy="204" rx="9" ry="7" className="rm-mascot__dark" />
        <path d="M156 196Q170 176 160 156" className="rm-mascot__arm" />
        <ellipse cx="160" cy="153" rx="8" ry="7" className="rm-mascot__dark" />
        <circle cx="166" cy="145" r="5" className="rm-mascot__kernel" />
      </g>

      <rect
        x="206"
        y="236"
        width="30"
        height="9"
        rx="3"
        transform="rotate(-6 221 240)"
        className="rm-mascot__remote"
      />
      <circle cx="214" cy="240" r="2" className="rm-mascot__remote-button" />
    </svg>
  )
}
