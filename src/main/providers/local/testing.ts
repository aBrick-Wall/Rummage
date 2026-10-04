import type { ToolStatus } from '@shared/domain'
import type { MediaProber, ProbeResult } from './ffprobe'

/** Test double: records probe calls and returns canned metadata. */
export class FakeProber implements MediaProber {
  readonly probed: string[] = []
  available = true

  constructor(
    private readonly result: ProbeResult = {
      status: 'ok',
      info: {
        container: 'mp4',
        videoCodec: 'h264',
        audioCodec: 'aac',
        width: 1280,
        height: 720,
        frameRate: 24,
        durationMs: 5000
      }
    }
  ) {}

  async getStatus(): Promise<ToolStatus> {
    return { name: 'ffprobe', available: this.available }
  }

  async probe(path: string): Promise<ProbeResult> {
    this.probed.push(path)
    return this.available ? this.result : { status: 'unavailable', info: {} }
  }
}
