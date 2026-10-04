export type Direction = 'left' | 'right' | 'up' | 'down'

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

export interface Candidate<T> {
  target: T
  box: Box
}

const center = (b: Box) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 })

/**
 * Picks the next focus target in a direction using element geometry, the same model a TV
 * remote or game controller needs. Candidates must lie in the requested direction; the best is
 * the one reachable with the least travel, weighting off-axis drift more heavily.
 */
export function findNextTarget<T>(
  from: Box,
  candidates: readonly Candidate<T>[],
  direction: Direction
): T | undefined {
  const origin = center(from)
  let best: { target: T; score: number } | undefined

  for (const candidate of candidates) {
    const c = center(candidate.box)
    const dx = c.x - origin.x
    const dy = c.y - origin.y
    const horizontal = direction === 'left' || direction === 'right'
    const forward = horizontal
      ? direction === 'right'
        ? dx
        : -dx
      : direction === 'down'
        ? dy
        : -dy
    if (forward <= 1) continue
    const drift = Math.abs(horizontal ? dy : dx)
    const score = forward + drift * 2.5
    if (!best || score < best.score) best = { target: candidate.target, score }
  }
  return best?.target
}

const KEY_TO_DIRECTION: Readonly<Record<string, Direction>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down'
}

export function directionForKey(key: string): Direction | undefined {
  return KEY_TO_DIRECTION[key]
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

function isTextEntry(el: Element | null): boolean {
  if (!(el instanceof HTMLInputElement)) return false
  return !['button', 'checkbox', 'radio', 'submit'].includes(el.type)
}

/**
 * Document-level arrow-key navigation between focusable controls. Leaves text entry,
 * the video player and open dialogs alone (dialogs use plain Tab order).
 */
export function handleArrowNavigation(event: KeyboardEvent, root: ParentNode = document): boolean {
  const direction = directionForKey(event.key)
  if (!direction || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey)
    return false

  const active = document.activeElement
  if (!(active instanceof HTMLElement) || active === document.body) return false
  if (active.closest('video, [aria-modal="true"]')) return false
  if (isTextEntry(active) && (direction === 'left' || direction === 'right')) return false

  const candidates: Candidate<HTMLElement>[] = []
  for (const el of root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
    if (el === active || el.closest('video') || el.hasAttribute('hidden')) continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    candidates.push({ target: el, box: rect })
  }
  const next = findNextTarget(active.getBoundingClientRect(), candidates, direction)
  if (!next) return false
  event.preventDefault()
  next.focus()
  next.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  return true
}
