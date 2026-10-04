import { extname } from 'node:path'

/**
 * The only file types the scanner will ever look at. Everything else on disk is ignored.
 * Listing a type here means "index it", not "Chromium can play it" - unsupported playback is
 * handled gracefully in the player.
 */
const VIDEO_TYPES: Readonly<Record<string, { mimeType: string; container: string }>> = {
  '.mp4': { mimeType: 'video/mp4', container: 'mp4' },
  '.m4v': { mimeType: 'video/mp4', container: 'mp4' },
  '.mov': { mimeType: 'video/quicktime', container: 'mov' },
  '.webm': { mimeType: 'video/webm', container: 'webm' },
  '.mkv': { mimeType: 'video/x-matroska', container: 'matroska' },
  '.avi': { mimeType: 'video/x-msvideo', container: 'avi' },
  '.wmv': { mimeType: 'video/x-ms-wmv', container: 'asf' },
  '.mpg': { mimeType: 'video/mpeg', container: 'mpeg' },
  '.mpeg': { mimeType: 'video/mpeg', container: 'mpeg' },
  '.ogv': { mimeType: 'video/ogg', container: 'ogg' }
}

export const SUPPORTED_VIDEO_EXTENSIONS: readonly string[] = Object.keys(VIDEO_TYPES)

export function videoExtensionOf(fileName: string): string | undefined {
  const ext = extname(fileName).toLowerCase()
  return Object.hasOwn(VIDEO_TYPES, ext) ? ext : undefined
}

export function isSupportedVideoFile(fileName: string): boolean {
  return videoExtensionOf(fileName) !== undefined
}

export function mimeTypeForExtension(ext: string): string {
  return VIDEO_TYPES[ext.toLowerCase()]?.mimeType ?? 'application/octet-stream'
}

export function containerForExtension(ext: string): string | undefined {
  return VIDEO_TYPES[ext.toLowerCase()]?.container
}
