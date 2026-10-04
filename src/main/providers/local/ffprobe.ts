import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { z } from 'zod'
import type { MediaTechnicalInfo, ToolStatus } from '@shared/domain'
import { containerForExtension } from './videoFiles'

export type ProbeStatus = 'ok' | 'failed' | 'unavailable'

export interface ProbeResult {
  status: ProbeStatus
  info: MediaTechnicalInfo
}

export interface MediaProber {
  probe(absolutePath: string): Promise<ProbeResult>
  getStatus(): Promise<ToolStatus>
}

const PROBE_TIMEOUT_MS = 30_000
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024

/**
 * Where to look for ffprobe, most specific first:
 *   1. RUMMAGE_FFPROBE_PATH (explicit configuration)
 *   2. a binary shipped alongside the app (`<resources>/bin/ffprobe[.exe]`)
 *   3. `ffprobe` on PATH
 */
export function resolveFfprobeCommand(options: {
  env?: NodeJS.ProcessEnv
  resourcesPath?: string
  platform?: NodeJS.Platform
  exists?: (path: string) => boolean
}): string {
  const env = options.env ?? process.env
  const exists = options.exists ?? existsSync
  const configured = env.RUMMAGE_FFPROBE_PATH?.trim()
  if (configured) return configured
  if (options.resourcesPath) {
    const exe = (options.platform ?? process.platform) === 'win32' ? 'ffprobe.exe' : 'ffprobe'
    const bundled = join(options.resourcesPath, 'bin', exe)
    if (exists(bundled)) return bundled
  }
  return 'ffprobe'
}

// ffprobe output is untrusted input: validate leniently, never trust shapes or types.
const num = z.union([z.number(), z.string()]).optional()
const streamSchema = z.looseObject({
  codec_type: z.string().optional(),
  codec_name: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  avg_frame_rate: z.string().optional(),
  r_frame_rate: z.string().optional(),
  bit_rate: num,
  duration: num,
  disposition: z.looseObject({ attached_pic: z.number().optional() }).optional()
})
const probeSchema = z.looseObject({
  format: z
    .looseObject({ format_name: z.string().optional(), duration: num, bit_rate: num })
    .optional(),
  streams: z.array(streamSchema).optional()
})

function toNumber(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function parseFrameRate(value: string | undefined): number | undefined {
  if (!value) return undefined
  const [numerator, denominator] = value.split('/')
  const n = Number.parseFloat(numerator ?? '')
  const d = denominator === undefined ? 1 : Number.parseFloat(denominator)
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0 || n === 0) return undefined
  const fps = n / d
  return fps > 0 && fps < 1000 ? Math.round(fps * 1000) / 1000 : undefined
}

function normalizeContainer(formatName: string | undefined, extension: string): string | undefined {
  const names = (formatName ?? '').split(',').map((n) => n.trim())
  if (names.includes('matroska'))
    return names.includes('webm') && extension === '.webm' ? 'webm' : 'matroska'
  if (names.includes('webm')) return 'webm'
  if (names.includes('mov') || names.includes('mp4')) return extension === '.mov' ? 'mov' : 'mp4'
  if (names.includes('avi')) return 'avi'
  if (names.includes('asf')) return 'asf'
  if (names.includes('ogg')) return 'ogg'
  if (names.some((n) => n.startsWith('mpeg'))) return 'mpeg'
  return names[0] || containerForExtension(extension)
}

export function parseFfprobeOutput(json: unknown, extension: string): MediaTechnicalInfo | null {
  const parsed = probeSchema.safeParse(json)
  if (!parsed.success) return null
  const { format, streams = [] } = parsed.data
  const video = streams.find((s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1)
  const audio = streams.find((s) => s.codec_type === 'audio')
  const durationSeconds = toNumber(format?.duration) ?? toNumber(video?.duration)

  const info: MediaTechnicalInfo = {
    container: normalizeContainer(format?.format_name, extension),
    videoCodec: video?.codec_name,
    audioCodec: audio?.codec_name,
    width: video?.width,
    height: video?.height,
    frameRate: parseFrameRate(video?.avg_frame_rate) ?? parseFrameRate(video?.r_frame_rate),
    durationMs: durationSeconds === undefined ? undefined : Math.round(durationSeconds * 1000),
    bitRate: toNumber(format?.bit_rate) ?? toNumber(video?.bit_rate)
  }
  return info
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: PROBE_TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true, shell: false },
      (error, stdout) => (error ? reject(error) : resolve(stdout))
    )
  })
}

export class FfprobeProber implements MediaProber {
  private availability?: Promise<ToolStatus>

  constructor(private readonly command: string) {}

  getStatus(): Promise<ToolStatus> {
    this.availability ??= run(this.command, ['-version'])
      .then((out): ToolStatus => ({
        name: 'ffprobe',
        available: true,
        detail: out.split('\n')[0]?.trim()
      }))
      .catch((): ToolStatus => ({
        name: 'ffprobe',
        available: false,
        detail: 'ffprobe was not found. Files are still indexed, without technical details.'
      }))
    return this.availability
  }

  async probe(absolutePath: string): Promise<ProbeResult> {
    if (!isAbsolute(absolutePath)) throw new Error('probe requires an absolute path')
    if (!(await this.getStatus()).available) return { status: 'unavailable', info: {} }
    const extension = /\.[^.\\/]+$/.exec(absolutePath)?.[0]?.toLowerCase() ?? ''
    try {
      const stdout = await run(this.command, [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        absolutePath
      ])
      const info = parseFfprobeOutput(JSON.parse(stdout), extension)
      return info ? { status: 'ok', info } : { status: 'failed', info: {} }
    } catch {
      return { status: 'failed', info: {} }
    }
  }
}
