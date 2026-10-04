import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { videoExtensionOf } from './videoFiles'

export interface DiscoveredFile {
  /** Absolute path (root + relative path). */
  path: string
  /** Path relative to the library root, using the platform separator. */
  relPath: string
  name: string
  extension: string
  sizeBytes: number
  mtimeMs: number
  fileId?: string
}

export interface DiscoveryResult {
  files: DiscoveredFile[]
  /** Directories/files that could not be read. A non-zero count means the walk was incomplete. */
  errorCount: number
}

const MAX_DEPTH = 64

/** Directories NAS firmware and operating systems create that never contain the user's media. */
const IGNORED_DIRECTORIES = new Set([
  '@eadir',
  '#recycle',
  '$recycle.bin',
  'system volume information'
])

function shouldSkipDirectory(name: string): boolean {
  return name.startsWith('.') || IGNORED_DIRECTORIES.has(name.toLowerCase())
}

/**
 * Recursively finds supported video files under `root`.
 *
 * Symlinks and junctions are never followed (no escaping the library, no loops). Only files
 * with an allow-listed video extension are even stat'ed. The walk is cooperative: it yields to
 * the event loop between directories and honours the abort signal.
 */
export async function discoverVideoFiles(
  root: string,
  options: { signal?: AbortSignal; onFileFound?: (count: number) => void } = {}
): Promise<DiscoveryResult> {
  const files: DiscoveredFile[] = []
  let errorCount = 0

  async function walk(dir: string, relDir: string, depth: number): Promise<void> {
    if (options.signal?.aborted) return
    if (depth > MAX_DEPTH) {
      errorCount += 1
      return
    }
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      errorCount += 1
      return
    }
    for (const entry of entries) {
      if (options.signal?.aborted) return
      const relPath = relDir ? join(relDir, entry.name) : entry.name
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(entry.name)) await walk(join(dir, entry.name), relPath, depth + 1)
        continue
      }
      if (!entry.isFile() || entry.name.startsWith('._')) continue
      const extension = videoExtensionOf(entry.name)
      if (!extension) continue
      const path = join(dir, entry.name)
      try {
        const info = await stat(path, { bigint: true })
        if (!info.isFile()) continue
        files.push({
          path,
          relPath,
          name: entry.name,
          extension,
          sizeBytes: Number(info.size),
          mtimeMs: Math.floor(Number(info.mtimeMs)),
          fileId: info.ino > 0n ? info.ino.toString() : undefined
        })
        options.onFileFound?.(files.length)
      } catch {
        errorCount += 1
      }
    }
  }

  await walk(root, '', 0)
  return { files, errorCount }
}
