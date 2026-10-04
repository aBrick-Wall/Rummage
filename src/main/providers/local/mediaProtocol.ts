import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'

export const MEDIA_SCHEME = 'rummage-media'
export const MEDIA_HOST = 'stream'

export interface StreamableFile {
  path: string
  size: number
  mimeType: string
}

export type StreamResolver = (sourceId: string) => Promise<StreamableFile | null>

export type ByteRange = { start: number; end: number }

/**
 * Parses a single-range `Range: bytes=...` header.
 * Returns `null` when no usable range was requested (serve the whole file) and
 * `'unsatisfiable'` when the range lies outside the file.
 */
export function parseRangeHeader(
  header: string | null,
  size: number
): ByteRange | 'unsatisfiable' | null {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null
  const [, rawStart = '', rawEnd = ''] = match
  if (rawStart === '' && rawEnd === '') return null

  if (rawStart === '') {
    const suffix = Number(rawEnd)
    if (suffix === 0) return 'unsatisfiable'
    return size === 0 ? 'unsatisfiable' : { start: Math.max(size - suffix, 0), end: size - 1 }
  }
  const start = Number(rawStart)
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1)
  if (!Number.isSafeInteger(start) || start >= size || end < start) return 'unsatisfiable'
  return { start, end }
}

const SOURCE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Extracts the source id from `rummage-media://stream/<id>`; anything else is rejected. */
export function parseMediaUrl(rawUrl: string): string | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.protocol !== `${MEDIA_SCHEME}:` || url.hostname !== MEDIA_HOST) return null
  if (url.username || url.password || url.search || url.hash) return null
  const id = url.pathname.replace(/^\//, '')
  return SOURCE_ID_PATTERN.test(id) ? id : null
}

function plain(status: number, extra: Record<string, string> = {}): Response {
  return new Response(null, { status, headers: { 'Cache-Control': 'no-store', ...extra } })
}

/**
 * Builds the request handler for the `rummage-media:` scheme. The handler is pure
 * Request -> Response so it can be tested without Electron. It never accepts a path from the
 * URL: the id is resolved to a vetted file by the provider.
 */
export function createMediaRequestHandler(resolve: StreamResolver) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET' && request.method !== 'HEAD')
      return plain(405, { Allow: 'GET, HEAD' })

    const sourceId = parseMediaUrl(request.url)
    if (!sourceId) return plain(400)

    const file = await resolve(sourceId).catch(() => null)
    if (!file) return plain(404)

    const baseHeaders: Record<string, string> = {
      'Content-Type': file.mimeType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }

    const range = parseRangeHeader(request.headers.get('range'), file.size)
    if (range === 'unsatisfiable') return plain(416, { 'Content-Range': `bytes */${file.size}` })

    const start = range?.start ?? 0
    const end = range?.end ?? file.size - 1
    const length = file.size === 0 ? 0 : end - start + 1
    const headers: Record<string, string> = { ...baseHeaders, 'Content-Length': String(length) }
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${file.size}`
    const status = range ? 206 : 200

    if (request.method === 'HEAD' || length === 0) return new Response(null, { status, headers })

    const stream = Readable.toWeb(createReadStream(file.path, { start, end })) as ReadableStream
    return new Response(stream, { status, headers })
  }
}
