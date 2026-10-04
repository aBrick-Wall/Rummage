import { describe, expect, it } from 'vitest'
import { FfprobeProber, parseFfprobeOutput, resolveFfprobeCommand } from './ffprobe'

const sample = {
  format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '12.5', bit_rate: '800000' },
  streams: [
    { codec_type: 'video', codec_name: 'mjpeg', disposition: { attached_pic: 1 } },
    {
      codec_type: 'video',
      codec_name: 'h264',
      width: 1920,
      height: 1080,
      avg_frame_rate: '30000/1001'
    },
    { codec_type: 'audio', codec_name: 'aac' }
  ]
}

describe('parseFfprobeOutput', () => {
  it('extracts normalized technical info', () => {
    expect(parseFfprobeOutput(sample, '.mp4')).toEqual({
      container: 'mp4',
      videoCodec: 'h264',
      audioCodec: 'aac',
      width: 1920,
      height: 1080,
      frameRate: 29.97,
      durationMs: 12500,
      bitRate: 800000
    })
  })

  it('distinguishes mov, webm and matroska by extension', () => {
    expect(parseFfprobeOutput(sample, '.mov')?.container).toBe('mov')
    expect(
      parseFfprobeOutput({ format: { format_name: 'matroska,webm' } }, '.webm')?.container
    ).toBe('webm')
    expect(
      parseFfprobeOutput({ format: { format_name: 'matroska,webm' } }, '.mkv')?.container
    ).toBe('matroska')
  })

  it('tolerates missing and hostile values', () => {
    const info = parseFfprobeOutput(
      {
        format: { duration: 'abc' },
        streams: [{ codec_type: 'video', avg_frame_rate: '0/0', r_frame_rate: '1/0' }]
      },
      '.mp4'
    )
    expect(info?.durationMs).toBeUndefined()
    expect(info?.frameRate).toBeUndefined()
    expect(parseFfprobeOutput('nope', '.mp4')).toBeNull()
    expect(parseFfprobeOutput({ streams: 'x' }, '.mp4')).toBeNull()
  })
})

describe('resolveFfprobeCommand', () => {
  it('prefers explicit configuration, then a bundled binary, then PATH', () => {
    expect(resolveFfprobeCommand({ env: { RUMMAGE_FFPROBE_PATH: '/opt/ffprobe' } })).toBe(
      '/opt/ffprobe'
    )
    expect(
      resolveFfprobeCommand({
        env: {},
        resourcesPath: '/res',
        platform: 'linux',
        exists: () => true
      })
    ).toMatch(/res.bin.ffprobe$/)
    expect(resolveFfprobeCommand({ env: {}, resourcesPath: '/res', exists: () => false })).toBe(
      'ffprobe'
    )
  })
})

describe('FfprobeProber', () => {
  it('reports unavailable when the binary is missing, without throwing', async () => {
    const prober = new FfprobeProber('/definitely/not/ffprobe')
    expect((await prober.getStatus()).available).toBe(false)
    expect(await prober.probe('/tmp/x.mp4')).toEqual({ status: 'unavailable', info: {} })
  })

  it('refuses relative paths', async () => {
    await expect(new FfprobeProber('ffprobe').probe('relative.mp4')).rejects.toThrow()
  })
})
