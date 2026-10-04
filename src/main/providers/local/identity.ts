import { createHash } from 'node:crypto'

export interface FileFacts {
  /** Absolute path inside the library's canonical root. */
  canonicalPath: string
  sizeBytes: number
  mtimeMs: number
  /** Filesystem file id (inode / NTFS file index) when the platform provides one. */
  fileId?: string
}

export interface MediaIdentity {
  /** Names the algorithm so keys from different schemes can coexist during a migration. */
  scheme: string
  key: string
}

/**
 * Decides when two scan results are "the same file". Phase 1 uses the canonical path, which
 * is deliberately isolated here: a content-fingerprint or server-assigned strategy can replace
 * it later (adding a new `scheme`) without touching the scanner, schema or UI.
 */
export interface IdentityStrategy {
  readonly scheme: string
  identify(facts: FileFacts): MediaIdentity
}

export class PathIdentityStrategy implements IdentityStrategy {
  readonly scheme = 'path-v1'

  constructor(private readonly caseInsensitive: boolean = process.platform === 'win32') {}

  identify(facts: FileFacts): MediaIdentity {
    const normalized = this.caseInsensitive
      ? facts.canonicalPath.toLowerCase()
      : facts.canonicalPath
    const key = createHash('sha256').update(normalized, 'utf8').digest('hex')
    return { scheme: this.scheme, key }
  }
}
