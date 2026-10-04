import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMediaRequestHandler, parseMediaUrl, parseRangeHeader } from './mediaProtocol'

const ID = '123e4567-e89b-42d3-a456-426614174000'

describe('parseRangeHeader', () => {
  it('handles explicit, open-ended and suffix ranges', () => {
    expect(parseRangeHeader('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 })
    expect(parseRangeHeader('bytes=900-', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseRangeHeader('bytes=-100', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseRangeHeader('bytes=0-5000', 1000)).toEqual({ start: 0, end: 999 })
  })

  it('flags unsatisfiable ranges and ignores unusable ones', () => {
    expect(parseRangeHeader('bytes=1000-', 1000)).toBe('unsatisfiable')
    expect(parseRangeHeader('bytes=50-10', 1000)).toBe('unsatisfiable')
    expect(parseRangeHeader('bytes=-0', 1000)).toBe('unsatisfiable')
    expect(parseRangeHeader(null, 1000)).toBeNull()
    expect(parseRangeHeader('bytes=0-1,5-6', 1000)).toBeNull()
    expect(parseRangeHeader('items=0-1', 1000)).toBeNull()
  })
})

describe('parseMediaUrl', () => {
  it('only accepts rummage-media://stream/<uuid>', () => {
    expect(parseMediaUrl(`rummage-media://stream/${ID}`)).toBe(ID)
    expect(parseMediaUrl(`rummage-media://other/${ID}`)).toBeNull()
    expect(parseMediaUrl(`https://stream/${ID}`)).toBeNull()
    expect(parseMediaUrl('rummage-media://stream/../../etc/passwd')).toBeNull()
    expect(parseMediaUrl('rummage-media://stream/C:/Windows/win.ini')).toBeNull()
    expect(parseMediaUrl(`rummage-media://stream/${ID}?x=1`)).toBeNull()
    expect(parseMediaUrl('not a url')).toBeNull()
  })
})

describe('media request handler', () => {
  let dir: string
  let file: string
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'rummage-proto-'))
    file = join(dir, 'a.mp4')
    writeFileSync(file, Buffer.from('0123456789'))
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  const handler = () =>
    createMediaRequestHandler(async (id) =>
      id === ID ? { path: file, size: 10, mimeType: 'video/mp4' } : null
    )
  const req = (url: string, init?: RequestInit) => new Request(url, init)

  it('serves a full file', async () => {
    const res = await handler()(req(`rummage-media://stream/${ID}`))
    expect(res.status).toBe(200)
    expect(res.headers.get('Accept-Ranges')).toBe('bytes')
    expect(res.headers.get('Content-Type')).toBe('video/mp4')
    expect(await res.text()).toBe('0123456789')
  })

  it('serves byte ranges with 206', async () => {
    const res = await handler()(
      req(`rummage-media://stream/${ID}`, { headers: { Range: 'bytes=2-4' } })
    )
    expect(res.status).toBe(206)
    expect(res.headers.get('Content-Range')).toBe('bytes 2-4/10')
    expect(await res.text()).toBe('234')
  })

  it('answers 416, 404, 400 and 405 appropriately', async () => {
    const h = handler()
    expect(
      (await h(req(`rummage-media://stream/${ID}`, { headers: { Range: 'bytes=50-' } }))).status
    ).toBe(416)
    expect(
      (await h(req('rummage-media://stream/123e4567-e89b-42d3-a456-426614174999'))).status
    ).toBe(404)
    expect((await h(req('rummage-media://stream/nope'))).status).toBe(400)
    expect(
      (await h(req(`rummage-media://stream/${ID}`, { method: 'POST', body: 'x' }))).status
    ).toBe(405)
  })

  it('answers HEAD without a body', async () => {
    const res = await handler()(req(`rummage-media://stream/${ID}`, { method: 'HEAD' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Length')).toBe('10')
    expect(await res.text()).toBe('')
  })
})
