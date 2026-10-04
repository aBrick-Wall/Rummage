import { describe, expect, it } from 'vitest'
import { migrate, openDatabase } from './database'
import { MIGRATIONS } from './migrations'

describe('database', () => {
  it('applies migrations and records the schema version', () => {
    const db = openDatabase(':memory:')
    const tables = db
      .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .map((t) => t.name)
    expect(tables).toEqual(
      expect.arrayContaining(['libraries', 'media_items', 'media_sources', 'media_metadata'])
    )
    expect(db.get<{ user_version: number }>('PRAGMA user_version')?.user_version).toBe(
      Math.max(...MIGRATIONS.map((m) => m.version))
    )
  })

  it('is idempotent when migrations are re-run', () => {
    const db = openDatabase(':memory:')
    expect(() => migrate(db, MIGRATIONS)).not.toThrow()
  })

  it('refuses a database from a newer version of the app', () => {
    const db = openDatabase(':memory:')
    db.exec('PRAGMA user_version = 999')
    expect(() => migrate(db, MIGRATIONS)).toThrow(/newer/)
  })

  it('rolls back failed transactions', () => {
    const db = openDatabase(':memory:')
    expect(() =>
      db.transaction(() => {
        db.run(
          "INSERT INTO libraries (id, provider_id, name, root_path, canonical_root, created_at) VALUES ('a','p','n','r','c',1)"
        )
        throw new Error('boom')
      })
    ).toThrow('boom')
    expect(db.get<{ n: number }>('SELECT COUNT(*) AS n FROM libraries')?.n).toBe(0)
  })
})
