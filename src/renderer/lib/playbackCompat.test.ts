import { describe, expect, it } from 'vitest'
import { assessPlayback, type CanPlayType } from './playbackCompat'

/** Behaves like Chromium: MP4/WebM with common codecs, nothing else. */
const chromium: CanPlayType = (type) => {
  const [container = '', params = ''] = type.split(';').map((s) => s.trim())
  const supportedContainers = ['video/mp4', 'video/webm', 'video/ogg']
  if (!supportedContainers.includes(container)) return ''
  const codecs = /codecs="([^"]+)"/.exec(params)?.[1]
  if (!codecs) return 'maybe'
  const ok = ['avc1.640028', 'mp4a.40.2', 'vp8', 'vp09.00.10.08', 'opus', 'vorbis', 'mp3']
  return codecs.split(',').every((c) => ok.includes(c.trim())) ? 'probably' : ''
}

const base = { mimeType: 'video/mp4', container: 'mp4' }

describe('assessPlayback', () => {
  it('accepts H.264 + AAC in MP4', () => {
    expect(assessPlayback({ ...base, videoCodec: 'h264', audioCodec: 'aac' }, chromium)).toEqual({
      verdict: 'playable'
    })
  })

  it('accepts files with no probed codec info if the container is playable', () => {
    expect(assessPlayback(base, chromium).verdict).toBe('playable')
  })

  it('rejects containers Chromium cannot demux', () => {
    const result = assessPlayback({ mimeType: 'video/x-msvideo', container: 'avi' }, chromium)
    expect(result).toMatchObject({ verdict: 'unsupported' })
    expect(JSON.stringify(result)).toContain('AVI')
  })

  it('judges codecs independently of the container they are stored in', () => {
    // Real Chromium answers '' for "video/x-matroska; codecs=..." but plays H.264 in MKV.
    const mkv = {
      mimeType: 'video/x-matroska',
      container: 'matroska',
      videoCodec: 'h264',
      audioCodec: 'aac'
    }
    expect(assessPlayback(mkv, chromium)).toEqual({ verdict: 'playable' })
  })

  it('maps mov to the mp4 demuxer and mkv to webm/matroska', () => {
    expect(
      assessPlayback(
        { mimeType: 'video/quicktime', container: 'mov', videoCodec: 'h264' },
        chromium
      ).verdict
    ).toBe('playable')
    expect(
      assessPlayback(
        { mimeType: 'video/x-matroska', container: 'matroska', videoCodec: 'vp9' },
        chromium
      ).verdict
    ).toBe('playable')
  })

  it('rejects video codecs that are never playable or that Chromium declines', () => {
    expect(assessPlayback({ ...base, videoCodec: 'mpeg4' }, chromium).verdict).toBe('unsupported')
    expect(
      assessPlayback({ ...base, videoCodec: 'hevc', audioCodec: 'aac' }, chromium).verdict
    ).toBe('unsupported')
  })

  it('flags unplayable audio as partial rather than blocking playback', () => {
    expect(
      assessPlayback({ ...base, videoCodec: 'h264', audioCodec: 'dts' }, chromium).verdict
    ).toBe('partial')
    expect(
      assessPlayback({ ...base, videoCodec: 'h264', audioCodec: 'ac3' }, chromium).verdict
    ).toBe('partial')
  })

  it('does not reject unknown codec names it has no opinion on', () => {
    expect(assessPlayback({ ...base, videoCodec: 'exoticcodec' }, chromium).verdict).toBe(
      'playable'
    )
  })
})
