import { describe, expect, it } from 'vitest'
import { PathIdentityStrategy } from './identity'
import { isPathInside } from './pathSafety'

const facts = (canonicalPath: string) => ({ canonicalPath, sizeBytes: 1, mtimeMs: 1 })

describe('PathIdentityStrategy', () => {
  it('is stable for the same path and differs between paths', () => {
    const s = new PathIdentityStrategy(false)
    expect(s.identify(facts('/a/movie.mp4'))).toEqual(s.identify(facts('/a/movie.mp4')))
    expect(s.identify(facts('/a/movie.mp4')).key).not.toBe(s.identify(facts('/b/movie.mp4')).key)
  })

  it('does not treat the file name alone as identity', () => {
    const s = new PathIdentityStrategy(false)
    expect(s.identify(facts('/x/clip.mp4')).key).not.toBe(s.identify(facts('/y/clip.mp4')).key)
  })

  it('names its scheme and can fold case for Windows', () => {
    const s = new PathIdentityStrategy(true)
    expect(s.scheme).toBe('path-v1')
    expect(s.identify(facts('C:\\Media\\A.mp4')).key).toBe(
      s.identify(facts('c:\\media\\a.mp4')).key
    )
  })
})

describe('isPathInside', () => {
  it('accepts descendants only', () => {
    expect(isPathInside('/lib', '/lib/a/b.mp4')).toBe(true)
    expect(isPathInside('/lib', '/lib')).toBe(false)
    expect(isPathInside('/lib', '/lib2/a.mp4')).toBe(false)
    expect(isPathInside('/lib', '/lib/../etc/passwd')).toBe(false)
    expect(isPathInside('/lib', '/other')).toBe(false)
  })
})
