export function formatDuration(ms: number | undefined): string | undefined {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return undefined
  const totalSeconds = Math.round(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

export function formatResolution(width?: number, height?: number): string | undefined {
  if (!width || !height) return undefined
  const long = Math.max(width, height)
  const short = Math.min(width, height)
  if (long >= 7680) return '8K'
  if (long >= 3840) return '4K'
  if (short >= 1440 || long >= 2560) return '1440p'
  if (long >= 1900 || short >= 1000) return '1080p'
  if (long >= 1280) return '720p'
  if (short >= 480) return '480p'
  return `${width}×${height}`
}

export function formatBytes(bytes: number | undefined): string | undefined {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return undefined
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

export function formatFrameRate(fps: number | undefined): string | undefined {
  if (fps === undefined) return undefined
  return `${Number.isInteger(fps) ? fps : fps.toFixed(2).replace(/\.?0+$/, '')} fps`
}

export function formatDate(epochMs: number | undefined): string | undefined {
  if (epochMs === undefined) return undefined
  return new Date(epochMs).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** Stable small integer in [0, modulo) derived from a string (for placeholder artwork). */
export function hashToIndex(value: string, modulo: number): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % modulo
}

export function titleGlyph(title: string): string {
  const letters = title.match(/[\p{L}\p{N}]/gu) ?? []
  return (letters[0] ?? '▶').toUpperCase()
}
