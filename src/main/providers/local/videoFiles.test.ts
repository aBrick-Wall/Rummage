import { describe, expect, it } from 'vitest'
import { deriveTitle, sortTitleOf } from './titles'
import {
  containerForExtension,
  isSupportedVideoFile,
  mimeTypeForExtension,
  videoExtensionOf
} from './videoFiles'

describe('video file allow-list', () => {
  it('accepts known video extensions case-insensitively', () => {
    expect(isSupportedVideoFile('movie.MP4')).toBe(true)
    expect(isSupportedVideoFile('clip.webm')).toBe(true)
    expect(videoExtensionOf('a.b.MKV')).toBe('.mkv')
  })

  it('rejects everything else', () => {
    for (const name of [
      'notes.txt',
      'photo.jpg',
      'setup.exe',
      'movie',
      'x.mp4.exe',
      '.mp4',
      'a.ts'
    ]) {
      expect(isSupportedVideoFile(name), name).toBe(false)
    }
  })

  it('does not treat prototype keys as extensions', () => {
    expect(videoExtensionOf('file.constructor')).toBeUndefined()
    expect(videoExtensionOf('file.__proto__')).toBeUndefined()
  })

  it('maps extensions to mime types and containers', () => {
    expect(mimeTypeForExtension('.mp4')).toBe('video/mp4')
    expect(mimeTypeForExtension('.nope')).toBe('application/octet-stream')
    expect(containerForExtension('.mkv')).toBe('matroska')
  })
})

describe('deriveTitle', () => {
  it('cleans separators', () => {
    expect(deriveTitle('My_Home_Movie.mp4')).toBe('My Home Movie')
    expect(deriveTitle('Some.Movie.2019.mkv')).toBe('Some Movie 2019')
  })

  it('keeps dots when the name already has spaces', () => {
    expect(deriveTitle('Mr. Smith Goes.mp4')).toBe('Mr. Smith Goes')
  })

  it('falls back to the file name when nothing is left', () => {
    expect(deriveTitle('___.mp4')).toBe('___.mp4')
  })

  it('sorts without leading articles', () => {
    expect(sortTitleOf('The Big Trip')).toBe('big trip')
    expect(sortTitleOf('Theory')).toBe('theory')
  })
})
