import { randomUUID } from 'node:crypto'
import type { CatalogSort, MediaItem, MediaSource } from '@shared/domain'
import type { Db } from '../../db/database'
import type { MediaIdentity } from './identity'
import type { ProbeResult } from './ffprobe'
import { sortTitleOf } from './titles'

export type ScanStatus = 'never' | 'ok' | 'partial' | 'failed'

export interface LibraryRow {
  id: string
  providerId: string
  name: string
  rootPath: string
  canonicalRoot: string
  createdAt: number
  lastScanStartedAt?: number
  lastScanCompletedAt?: number
  lastScanStatus: ScanStatus
  lastScanError?: string
  itemCount: number
}

export interface ExistingSource {
  id: string
  identityKey: string
  sizeBytes: number
  mtimeMs: number
  probeStatus?: ProbeResult['status']
}

export interface ScannedFileInput {
  libraryId: string
  providerId: string
  identity: MediaIdentity
  path: string
  relPath: string
  extension: string
  sizeBytes: number
  mtimeMs: number
  fileId?: string
  title: string
  /** Absent when the file was unchanged and its existing metadata should be kept. */
  probe?: ProbeResult
  now: number
}

export interface StreamTarget {
  sourceId: string
  path: string
  extension: string
  canonicalRoot: string
}

export interface ItemQuery {
  sort: CatalogSort
  limit: number
  offset: number
  /** Whitespace-separated terms; every term must match the title or relative path. */
  search?: string
}

interface LibraryDbRow {
  id: string
  provider_id: string
  name: string
  root_path: string
  canonical_root: string
  created_at: number
  last_scan_started_at: number | null
  last_scan_completed_at: number | null
  last_scan_status: ScanStatus
  last_scan_error: string | null
  item_count: number
}

interface ItemDbRow {
  id: string
  provider_id: string
  kind: string
  title: string
  added_at: number
}

interface SourceDbRow {
  id: string
  item_id: string
  provider_id: string
  library_name: string
  path: string
  size_bytes: number
  mtime_ms: number
  last_scanned_at: number
  probe_status: ProbeResult['status'] | null
  container: string | null
  duration_ms: number | null
  video_codec: string | null
  audio_codec: string | null
  width: number | null
  height: number | null
  frame_rate: number | null
  bit_rate: number | null
}

const MAX_SEARCH_TERMS = 8

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`)
}

function opt<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined
}

/** All SQL for the local library provider lives here. */
export class LocalStore {
  constructor(private readonly db: Db) {}

  // ---- libraries -------------------------------------------------------------------------

  listLibraries(): LibraryRow[] {
    return this.db
      .all<LibraryDbRow>(this.librarySelect('ORDER BY l.created_at, l.id'))
      .map(toLibrary)
  }

  getLibrary(id: string): LibraryRow | undefined {
    const row = this.db.get<LibraryDbRow>(this.librarySelect('WHERE l.id = ?'), [id])
    return row ? toLibrary(row) : undefined
  }

  addLibrary(input: {
    providerId: string
    name: string
    rootPath: string
    canonicalRoot: string
    now: number
  }): LibraryRow {
    const id = randomUUID()
    this.db.run(
      `INSERT INTO libraries (id, provider_id, name, root_path, canonical_root, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.providerId, input.name, input.rootPath, input.canonicalRoot, input.now]
    )
    const library = this.getLibrary(id)
    if (!library) throw new Error('Failed to read back new library')
    return library
  }

  removeLibrary(id: string): void {
    this.db.transaction(() => {
      this.db.run('DELETE FROM libraries WHERE id = ?', [id])
      this.deleteOrphanItems()
    })
  }

  markScanStarted(id: string, now: number): void {
    this.db.run(
      'UPDATE libraries SET last_scan_started_at = ?, last_scan_error = NULL WHERE id = ?',
      [now, id]
    )
  }

  markScanFinished(id: string, status: ScanStatus, now: number, error?: string): void {
    this.db.run(
      `UPDATE libraries
         SET last_scan_status = ?, last_scan_completed_at = ?, last_scan_error = ?
       WHERE id = ?`,
      [status, now, error ?? null, id]
    )
  }

  // ---- scanning --------------------------------------------------------------------------

  existingSources(libraryId: string): Map<string, ExistingSource> {
    const rows = this.db.all<{
      id: string
      identity_key: string
      size_bytes: number
      mtime_ms: number
      probe_status: ProbeResult['status'] | null
    }>(
      `SELECT s.id, s.identity_key, s.size_bytes, s.mtime_ms, m.probe_status
         FROM media_sources s LEFT JOIN media_metadata m ON m.source_id = s.id
        WHERE s.library_id = ?`,
      [libraryId]
    )
    return new Map(
      rows.map((r) => [
        r.identity_key,
        {
          id: r.id,
          identityKey: r.identity_key,
          sizeBytes: r.size_bytes,
          mtimeMs: r.mtime_ms,
          probeStatus: opt(r.probe_status)
        }
      ])
    )
  }

  /** Writes a batch of scan results atomically. */
  upsertScannedFiles(inputs: ScannedFileInput[]): void {
    this.db.transaction(() => {
      for (const input of inputs) this.upsertScannedFile(input)
    })
  }

  /** Removes sources of a library that were not seen in the latest complete scan. */
  pruneUnseen(libraryId: string, seenKeys: ReadonlySet<string>): number {
    const stale = this.db
      .all<{ id: string; identity_key: string }>(
        'SELECT id, identity_key FROM media_sources WHERE library_id = ?',
        [libraryId]
      )
      .filter((row) => !seenKeys.has(row.identity_key))
    this.db.transaction(() => {
      for (const row of stale) this.db.run('DELETE FROM media_sources WHERE id = ?', [row.id])
      this.deleteOrphanItems()
    })
    return stale.length
  }

  // ---- reading ---------------------------------------------------------------------------

  countItems(search?: string): number {
    const { where, params } = this.searchClause(search)
    return (
      this.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM media_items i ${where}`, params)?.n ?? 0
    )
  }

  queryItems(query: ItemQuery): MediaItem[] {
    const { where, params } = this.searchClause(query.search)
    const order =
      query.sort === 'recently-added'
        ? 'i.added_at DESC, i.sort_title COLLATE NOCASE, i.id'
        : 'i.sort_title COLLATE NOCASE, i.id'
    const rows = this.db.all<ItemDbRow>(
      `SELECT i.id, i.provider_id, i.kind, i.title, i.added_at
         FROM media_items i ${where}
        ORDER BY ${order} LIMIT ? OFFSET ?`,
      [...params, query.limit, query.offset]
    )
    return this.assemble(rows)
  }

  getItem(id: string): MediaItem | null {
    const row = this.db.get<ItemDbRow>(
      'SELECT id, provider_id, kind, title, added_at FROM media_items WHERE id = ?',
      [id]
    )
    return row ? (this.assemble([row])[0] ?? null) : null
  }

  getStreamTarget(sourceId: string): StreamTarget | undefined {
    const row = this.db.get<{
      id: string
      path: string
      extension: string
      canonical_root: string
    }>(
      `SELECT s.id, s.path, s.extension, l.canonical_root
         FROM media_sources s JOIN libraries l ON l.id = s.library_id
        WHERE s.id = ?`,
      [sourceId]
    )
    return row
      ? {
          sourceId: row.id,
          path: row.path,
          extension: row.extension,
          canonicalRoot: row.canonical_root
        }
      : undefined
  }

  // ---- internals -------------------------------------------------------------------------

  private librarySelect(suffix: string): string {
    return `SELECT l.*, (SELECT COUNT(*) FROM media_sources s WHERE s.library_id = l.id) AS item_count
              FROM libraries l ${suffix}`
  }

  private searchClause(search?: string): { where: string; params: string[] } {
    const terms = (search ?? '').trim().split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_TERMS)
    if (terms.length === 0) return { where: '', params: [] }
    const params: string[] = []
    const clauses = terms.map((term) => {
      const pattern = `%${escapeLike(term)}%`
      params.push(pattern, pattern)
      return `(i.title LIKE ? ESCAPE '\\' OR EXISTS (
                SELECT 1 FROM media_sources s WHERE s.item_id = i.id AND s.rel_path LIKE ? ESCAPE '\\'))`
    })
    return { where: `WHERE ${clauses.join(' AND ')}`, params }
  }

  private assemble(items: ItemDbRow[]): MediaItem[] {
    if (items.length === 0) return []
    const placeholders = items.map(() => '?').join(',')
    const sourceRows = this.db.all<SourceDbRow>(
      `SELECT s.id, s.item_id, l.provider_id, l.name AS library_name, s.path, s.size_bytes,
              s.mtime_ms, s.last_scanned_at, m.probe_status, m.container, m.duration_ms,
              m.video_codec, m.audio_codec, m.width, m.height, m.frame_rate, m.bit_rate
         FROM media_sources s
         JOIN libraries l ON l.id = s.library_id
         LEFT JOIN media_metadata m ON m.source_id = s.id
        WHERE s.item_id IN (${placeholders})
        ORDER BY s.first_seen_at, s.id`,
      items.map((i) => i.id)
    )
    const byItem = new Map<string, MediaSource[]>()
    for (const row of sourceRows) {
      const list = byItem.get(row.item_id) ?? []
      list.push(toMediaSource(row))
      byItem.set(row.item_id, list)
    }
    return items.map((item) => {
      const sources = byItem.get(item.id) ?? []
      return {
        id: item.id,
        providerId: item.provider_id,
        kind: 'video',
        title: item.title,
        addedAt: item.added_at,
        durationMs: sources.find((s) => s.technical.durationMs !== undefined)?.technical.durationMs,
        artwork: [],
        sources
      }
    })
  }

  private upsertScannedFile(input: ScannedFileInput): void {
    const existing = this.db.get<{ id: string; item_id: string }>(
      'SELECT id, item_id FROM media_sources WHERE identity_scheme = ? AND identity_key = ?',
      [input.identity.scheme, input.identity.key]
    )
    let sourceId: string
    if (existing) {
      sourceId = existing.id
      this.db.run(
        `UPDATE media_sources
            SET path = ?, rel_path = ?, extension = ?, size_bytes = ?, mtime_ms = ?, file_id = ?,
                last_scanned_at = ?
          WHERE id = ?`,
        [
          input.path,
          input.relPath,
          input.extension,
          input.sizeBytes,
          input.mtimeMs,
          input.fileId ?? null,
          input.now,
          sourceId
        ]
      )
    } else {
      const itemId = randomUUID()
      sourceId = randomUUID()
      this.db.run(
        `INSERT INTO media_items (id, provider_id, kind, title, sort_title, added_at, updated_at)
         VALUES (?, ?, 'video', ?, ?, ?, ?)`,
        [itemId, input.providerId, input.title, sortTitleOf(input.title), input.now, input.now]
      )
      this.db.run(
        `INSERT INTO media_sources
           (id, item_id, library_id, identity_scheme, identity_key, path, rel_path, extension,
            size_bytes, mtime_ms, file_id, first_seen_at, last_scanned_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sourceId,
          itemId,
          input.libraryId,
          input.identity.scheme,
          input.identity.key,
          input.path,
          input.relPath,
          input.extension,
          input.sizeBytes,
          input.mtimeMs,
          input.fileId ?? null,
          input.now,
          input.now
        ]
      )
    }
    if (input.probe) {
      const { status, info } = input.probe
      this.db.run(
        `INSERT INTO media_metadata
           (source_id, probe_status, container, duration_ms, video_codec, audio_codec, width,
            height, frame_rate, bit_rate, probed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (source_id) DO UPDATE SET
           probe_status = excluded.probe_status, container = excluded.container,
           duration_ms = excluded.duration_ms, video_codec = excluded.video_codec,
           audio_codec = excluded.audio_codec, width = excluded.width, height = excluded.height,
           frame_rate = excluded.frame_rate, bit_rate = excluded.bit_rate,
           probed_at = excluded.probed_at`,
        [
          sourceId,
          status,
          info.container ?? null,
          info.durationMs ?? null,
          info.videoCodec ?? null,
          info.audioCodec ?? null,
          info.width ?? null,
          info.height ?? null,
          info.frameRate ?? null,
          info.bitRate ?? null,
          input.now
        ]
      )
    }
  }

  private deleteOrphanItems(): void {
    this.db.run(
      'DELETE FROM media_items WHERE NOT EXISTS (SELECT 1 FROM media_sources s WHERE s.item_id = media_items.id)'
    )
  }
}

function toLibrary(row: LibraryDbRow): LibraryRow {
  return {
    id: row.id,
    providerId: row.provider_id,
    name: row.name,
    rootPath: row.root_path,
    canonicalRoot: row.canonical_root,
    createdAt: row.created_at,
    lastScanStartedAt: opt(row.last_scan_started_at),
    lastScanCompletedAt: opt(row.last_scan_completed_at),
    lastScanStatus: row.last_scan_status,
    lastScanError: opt(row.last_scan_error),
    itemCount: row.item_count
  }
}

function toMediaSource(row: SourceDbRow): MediaSource {
  return {
    id: row.id,
    providerId: row.provider_id,
    kind: 'local-file',
    connectionName: row.library_name,
    location: row.path,
    sizeBytes: row.size_bytes,
    modifiedAt: row.mtime_ms,
    lastScannedAt: row.last_scanned_at,
    hasTechnicalInfo: row.probe_status === 'ok',
    technical: {
      container: opt(row.container),
      videoCodec: opt(row.video_codec),
      audioCodec: opt(row.audio_codec),
      width: opt(row.width),
      height: opt(row.height),
      frameRate: opt(row.frame_rate),
      durationMs: opt(row.duration_ms),
      bitRate: opt(row.bit_rate)
    }
  }
}
