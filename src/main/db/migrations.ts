export interface Migration {
  version: number
  sql: string
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    sql: `
      -- A configured place media lives (Phase 1: a folder, possibly on a mapped network drive).
      CREATE TABLE libraries (
        id                       TEXT PRIMARY KEY,
        provider_id              TEXT NOT NULL,
        name                     TEXT NOT NULL,
        root_path                TEXT NOT NULL,
        canonical_root           TEXT NOT NULL UNIQUE,
        created_at               INTEGER NOT NULL,
        last_scan_started_at     INTEGER,
        last_scan_completed_at   INTEGER,
        last_scan_status         TEXT NOT NULL DEFAULT 'never'
                                 CHECK (last_scan_status IN ('never','ok','partial','failed')),
        last_scan_error          TEXT
      );

      -- A piece of media as the user thinks of it. May own several sources.
      CREATE TABLE media_items (
        id          TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        kind        TEXT NOT NULL,
        title       TEXT NOT NULL,
        sort_title  TEXT NOT NULL,
        added_at    INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );
      CREATE INDEX media_items_sort_title ON media_items (sort_title COLLATE NOCASE);
      CREATE INDEX media_items_added_at ON media_items (added_at DESC);

      -- One scanned file. (identity_scheme, identity_key) is the replaceable identity design.
      CREATE TABLE media_sources (
        id              TEXT PRIMARY KEY,
        item_id         TEXT NOT NULL REFERENCES media_items (id) ON DELETE CASCADE,
        library_id      TEXT NOT NULL REFERENCES libraries (id) ON DELETE CASCADE,
        identity_scheme TEXT NOT NULL,
        identity_key    TEXT NOT NULL,
        path            TEXT NOT NULL,
        rel_path        TEXT NOT NULL,
        extension       TEXT NOT NULL,
        size_bytes      INTEGER NOT NULL,
        mtime_ms        INTEGER NOT NULL,
        file_id         TEXT,
        first_seen_at   INTEGER NOT NULL,
        last_scanned_at INTEGER NOT NULL,
        UNIQUE (identity_scheme, identity_key)
      );
      CREATE INDEX media_sources_item ON media_sources (item_id);
      CREATE INDEX media_sources_library ON media_sources (library_id);

      -- Technical metadata for a source (ffprobe output, normalized).
      CREATE TABLE media_metadata (
        source_id    TEXT PRIMARY KEY REFERENCES media_sources (id) ON DELETE CASCADE,
        probe_status TEXT NOT NULL CHECK (probe_status IN ('ok','failed','unavailable')),
        container    TEXT,
        duration_ms  INTEGER,
        video_codec  TEXT,
        audio_codec  TEXT,
        width        INTEGER,
        height       INTEGER,
        frame_rate   REAL,
        bit_rate     INTEGER,
        probed_at    INTEGER NOT NULL
      );
    `
  }
]
