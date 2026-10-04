import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { MIGRATIONS, type Migration } from './migrations'

export type SqlValue = string | number | bigint | null
export type SqlParams = SqlValue[] | Record<string, SqlValue>

/**
 * A deliberately small synchronous SQL surface. The rest of the app depends on this, not on
 * `node:sqlite`, so the driver (currently Node's built-in, still-experimental SQLite) can be
 * swapped without touching the stores.
 */
export interface Db {
  exec(sql: string): void
  run(sql: string, params?: SqlParams): { changes: number }
  get<T>(sql: string, params?: SqlParams): T | undefined
  all<T>(sql: string, params?: SqlParams): T[]
  transaction<T>(fn: () => T): T
  close(): void
}

class SqliteDb implements Db {
  constructor(private readonly db: DatabaseSync) {}

  exec(sql: string): void {
    this.db.exec(sql)
  }

  run(sql: string, params: SqlParams = []): { changes: number } {
    const stmt = this.db.prepare(sql)
    const result = Array.isArray(params) ? stmt.run(...params) : stmt.run(params)
    return { changes: Number(result.changes) }
  }

  get<T>(sql: string, params: SqlParams = []): T | undefined {
    const stmt = this.db.prepare(sql)
    return (Array.isArray(params) ? stmt.get(...params) : stmt.get(params)) as T | undefined
  }

  all<T>(sql: string, params: SqlParams = []): T[] {
    const stmt = this.db.prepare(sql)
    return (Array.isArray(params) ? stmt.all(...params) : stmt.all(params)) as T[]
  }

  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const result = fn()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  close(): void {
    this.db.close()
  }
}

export function openDatabase(path: string, migrations: readonly Migration[] = MIGRATIONS): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new SqliteDb(new DatabaseSync(path))
  db.exec('PRAGMA foreign_keys = ON')
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL')
  migrate(db, migrations)
  return db
}

export function migrate(db: Db, migrations: readonly Migration[]): void {
  const current = db.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0
  const latest = migrations.reduce((max, m) => Math.max(max, m.version), 0)
  if (current > latest) {
    throw new Error(
      `Database schema v${current} is newer than this version of Rummage understands (v${latest}).`
    )
  }
  for (const migration of [...migrations].sort((a, b) => a.version - b.version)) {
    if (migration.version <= current) continue
    db.transaction(() => {
      db.exec(migration.sql)
      db.exec(`PRAGMA user_version = ${Math.trunc(migration.version)}`)
    })
  }
}
