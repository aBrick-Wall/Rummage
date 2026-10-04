import { describe, expect, it } from 'vitest'
import {
  catalogRequestSchema,
  mediaRefSchema,
  playbackArgsSchema,
  searchRequestSchema
} from './validation'

describe('IPC validation', () => {
  it('accepts well-formed payloads', () => {
    expect(mediaRefSchema.safeParse({ providerId: 'p', itemId: 'i' }).success).toBe(true)
    expect(searchRequestSchema.safeParse({ query: 'hello', limit: 10 }).success).toBe(true)
    expect(catalogRequestSchema.safeParse(undefined).success).toBe(true)
    expect(catalogRequestSchema.safeParse({ sort: 'title', limit: 5 }).success).toBe(true)
    expect(playbackArgsSchema.safeParse([{ providerId: 'p', itemId: 'i' }]).success).toBe(true)
  })

  it('rejects unknown keys, wrong types and oversized values', () => {
    expect(
      mediaRefSchema.safeParse({ providerId: 'p', itemId: 'i', path: '/etc/passwd' }).success
    ).toBe(false)
    expect(mediaRefSchema.safeParse({ providerId: 1, itemId: 'i' }).success).toBe(false)
    expect(mediaRefSchema.safeParse({ providerId: '', itemId: 'i' }).success).toBe(false)
    expect(searchRequestSchema.safeParse({ query: 'x'.repeat(201) }).success).toBe(false)
    expect(searchRequestSchema.safeParse({ query: 'x', limit: 100000 }).success).toBe(false)
    expect(catalogRequestSchema.safeParse({ sort: 'random' }).success).toBe(false)
    expect(playbackArgsSchema.safeParse([{ providerId: 'p', itemId: 'i' }, 5]).success).toBe(false)
  })
})
