import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { discoverVideoFiles } from './scanner'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rummage-scan-'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const touch = (rel: string, content = 'x') => {
  const full = join(root, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
}

describe('discoverVideoFiles', () => {
  it('finds supported videos recursively and ignores other file types', async () => {
    touch('a.mp4')
    touch('sub/b.MKV')
    touch('sub/deep/c.webm')
    touch('notes.txt')
    touch('sub/photo.jpg')
    touch('sub/script.sh')
    const { files, errorCount } = await discoverVideoFiles(root)
    expect(files.map((f) => f.relPath).sort()).toEqual(
      ['a.mp4', join('sub', 'b.MKV'), join('sub', 'deep', 'c.webm')].sort()
    )
    expect(errorCount).toBe(0)
    expect(files.find((f) => f.name === 'a.mp4')).toMatchObject({ sizeBytes: 1, extension: '.mp4' })
  })

  it('skips hidden, NAS system and resource-fork entries', async () => {
    touch('.hidden/a.mp4')
    touch('@eaDir/b.mp4')
    touch('#recycle/c.mp4')
    touch('._d.mp4')
    touch('ok.mp4')
    const { files } = await discoverVideoFiles(root)
    expect(files.map((f) => f.name)).toEqual(['ok.mp4'])
  })

  it('does not follow symlinks', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'rummage-outside-'))
    try {
      writeFileSync(join(outside, 'secret.mp4'), 'x')
      symlinkSync(outside, join(root, 'link'))
      symlinkSync(join(outside, 'secret.mp4'), join(root, 'file-link.mp4'))
      const { files } = await discoverVideoFiles(root)
      expect(files).toEqual([])
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('reports an unreadable root as an error rather than throwing', async () => {
    const result = await discoverVideoFiles(join(root, 'missing'))
    expect(result.files).toEqual([])
    expect(result.errorCount).toBe(1)
  })

  it('stops when aborted', async () => {
    touch('a.mp4')
    const controller = new AbortController()
    controller.abort()
    expect((await discoverVideoFiles(root, { signal: controller.signal })).files).toEqual([])
  })
})
