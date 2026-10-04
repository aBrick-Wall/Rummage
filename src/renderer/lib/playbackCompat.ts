import type { PlaybackSource } from '@shared/domain'

export type CanPlayType = (type: string) => CanPlayTypeResult

export type PlaybackVerdict =
  | { verdict: 'playable' }
  /** Video should play, but part of the file (usually audio) cannot be decoded. */
  | { verdict: 'partial'; notice: string }
  | { verdict: 'unsupported'; reason: string }

/**
 * How to ask Chromium about a single codec. Decoder support does not depend on the file's
 * container, so each codec is probed through the container Chromium knows it best in
 * (RFC 6381 codec strings).
 */
const CODEC_PROBES: Readonly<Record<string, { type: string; codec: string }>> = {
  h264: { type: 'video/mp4', codec: 'avc1.640028' },
  hevc: { type: 'video/mp4', codec: 'hvc1.1.6.L120.90' },
  av1: { type: 'video/mp4', codec: 'av01.0.05M.08' },
  vp8: { type: 'video/webm', codec: 'vp8' },
  vp9: { type: 'video/webm', codec: 'vp09.00.10.08' },
  theora: { type: 'video/ogg', codec: 'theora' },
  aac: { type: 'video/mp4', codec: 'mp4a.40.2' },
  mp3: { type: 'video/mp4', codec: 'mp3' },
  flac: { type: 'video/mp4', codec: 'flac' },
  ac3: { type: 'video/mp4', codec: 'ac-3' },
  eac3: { type: 'video/mp4', codec: 'ec-3' },
  opus: { type: 'video/webm', codec: 'opus' },
  vorbis: { type: 'video/webm', codec: 'vorbis' }
}

function canDecode(codec: string, canPlayType: CanPlayType): boolean | undefined {
  const probe = CODEC_PROBES[codec]
  if (!probe) return undefined
  return canPlayType(`${probe.type}; codecs="${probe.codec}"`) !== ''
}

/** Codecs Chromium never decodes, so there is nothing to ask. */
const NEVER_PLAYABLE = new Set([
  'mpeg4',
  'msmpeg4v1',
  'msmpeg4v2',
  'msmpeg4v3',
  'wmv1',
  'wmv2',
  'wmv3',
  'vc1',
  'mpeg1video',
  'mpeg2video',
  'rv10',
  'rv20',
  'rv30',
  'rv40',
  'dts',
  'truehd',
  'wmav1',
  'wmav2',
  'wmapro',
  'mp2'
])

/** Containers are matched by what Chromium can demux, which differs from the MIME type. */
const CONTAINER_PROBE_TYPES: Readonly<Record<string, readonly string[]>> = {
  mp4: ['video/mp4'],
  mov: ['video/mp4'],
  webm: ['video/webm'],
  matroska: ['video/x-matroska', 'video/webm'],
  ogg: ['video/ogg']
}

const CONTAINER_NAMES: Readonly<Record<string, string>> = {
  mp4: 'MP4',
  mov: 'QuickTime (MOV)',
  webm: 'WebM',
  matroska: 'Matroska (MKV)',
  avi: 'AVI',
  asf: 'Windows Media (WMV)',
  mpeg: 'MPEG',
  ogg: 'Ogg'
}

export function describeCodec(codec: string | undefined): string {
  return codec ? codec.toUpperCase() : 'unknown'
}

export function describeContainer(container: string | undefined): string {
  return (container && CONTAINER_NAMES[container]) || container?.toUpperCase() || 'this format'
}

/**
 * Decides, before touching the player, whether Chromium can plausibly play this source.
 * It is a best-effort pre-check; the video element's own error event remains the final word.
 */
export function assessPlayback(
  source: Pick<PlaybackSource, 'mimeType' | 'container' | 'videoCodec' | 'audioCodec'>,
  canPlayType: CanPlayType
): PlaybackVerdict {
  const containerTypes = source.container
    ? (CONTAINER_PROBE_TYPES[source.container] ?? [source.mimeType])
    : [source.mimeType]
  if (!containerTypes.some((type) => canPlayType(type) !== '')) {
    return {
      verdict: 'unsupported',
      reason: `${describeContainer(source.container)} files can't be played directly yet.`
    }
  }

  const { videoCodec, audioCodec } = source
  if (
    videoCodec &&
    (NEVER_PLAYABLE.has(videoCodec) || canDecode(videoCodec, canPlayType) === false)
  ) {
    return {
      verdict: 'unsupported',
      reason: `This device can't play ${describeCodec(videoCodec)} video directly yet.`
    }
  }
  if (
    audioCodec &&
    (NEVER_PLAYABLE.has(audioCodec) || canDecode(audioCodec, canPlayType) === false)
  ) {
    return {
      verdict: 'partial',
      notice: `The ${describeCodec(audioCodec)} audio track can't be decoded directly, so this may play without sound.`
    }
  }
  return { verdict: 'playable' }
}

/** Maps a media element error to a user-facing reason (or null for aborted loads). */
export function describeMediaError(error: Pick<MediaError, 'code'> | null): string | null {
  if (!error) return null
  // MediaError code values are fixed by the HTML spec.
  switch (error.code) {
    case 1: // MEDIA_ERR_ABORTED
      return null
    case 2: // MEDIA_ERR_NETWORK
      return "Rummage couldn't read this file. If it lives on network storage, check that it's online."
    case 3: // MEDIA_ERR_DECODE
      return "This file's video or audio couldn't be decoded."
    default:
      return "This file's format can't be played directly yet."
  }
}
