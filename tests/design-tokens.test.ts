import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..', 'src', 'renderer')
const tokens = readFileSync(join(root, 'design', 'tokens.css'), 'utf8')

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return cssFiles(path)
    return path.endsWith('.css') ? [path] : []
  })
}

describe('Dumpsterlight design tokens', () => {
  it('defines the brand palette exactly once, as primitives', () => {
    for (const [name, hex] of [
      ['--dl-charcoal', '#1e1e1e'],
      ['--dl-lime', '#d4ff00'],
      ['--dl-orange', '#ff7a00'],
      ['--dl-green', '#00c853'],
      ['--dl-offwhite', '#f2f2f2']
    ]) {
      expect(tokens).toContain(`${name}: ${hex};`)
    }
  })

  it('exposes the semantic tokens components rely on', () => {
    for (const name of [
      '--background-primary',
      '--background-elevated',
      '--surface-card',
      '--text-primary',
      '--text-muted',
      '--accent-primary',
      '--accent-secondary',
      '--status-connected',
      '--border-subtle',
      '--focus-ring'
    ]) {
      expect(tokens).toMatch(new RegExp(`${name}:`))
    }
  })

  it('keeps raw colors out of every other stylesheet', () => {
    const offenders = cssFiles(root)
      .filter((file) => !file.endsWith('tokens.css'))
      .filter((file) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
