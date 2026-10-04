import { z } from 'zod'

/** Runtime validation of every payload the renderer can send to the main process. */

const id = z.string().min(1).max(200)

export const mediaRefSchema = z.strictObject({ providerId: id, itemId: id })

export const catalogRequestSchema = z
  .strictObject({
    sort: z.enum(['title', 'recently-added']).optional(),
    limit: z.number().int().min(1).max(500).optional(),
    cursor: z.string().max(100).optional()
  })
  .optional()

export const searchRequestSchema = z.strictObject({
  query: z.string().max(200),
  limit: z.number().int().min(1).max(500).optional(),
  cursor: z.string().max(100).optional()
})

export const playbackArgsSchema = z.tuple([mediaRefSchema, id.optional()])

export const connectionIdSchema = id
