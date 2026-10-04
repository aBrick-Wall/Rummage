import { describe, expect, it } from 'vitest'
import { directionForKey, findNextTarget, type Box } from './spatialNav'

const box = (left: number, top: number, width = 100, height = 50): Box => ({
  left,
  top,
  width,
  height
})

describe('findNextTarget', () => {
  const from = box(200, 200)
  const candidates = [
    { target: 'left', box: box(50, 200) },
    { target: 'right', box: box(350, 200) },
    { target: 'up', box: box(200, 100) },
    { target: 'down', box: box(200, 300) },
    { target: 'far-right', box: box(600, 200) },
    { target: 'diagonal', box: box(330, 330) }
  ]

  it('moves in the requested direction to the nearest aligned target', () => {
    expect(findNextTarget(from, candidates, 'left')).toBe('left')
    expect(findNextTarget(from, candidates, 'right')).toBe('right')
    expect(findNextTarget(from, candidates, 'up')).toBe('up')
    expect(findNextTarget(from, candidates, 'down')).toBe('down')
  })

  it('prefers aligned targets over nearer diagonal ones', () => {
    const aligned = [
      { target: 'aligned', box: box(500, 200) },
      { target: 'diagonal', box: box(300, 320) }
    ]
    expect(findNextTarget(from, aligned, 'right')).toBe('aligned')
  })

  it('returns undefined when nothing lies in that direction', () => {
    expect(findNextTarget(from, [{ target: 'x', box: box(50, 200) }], 'right')).toBeUndefined()
  })

  it('maps arrow keys', () => {
    expect(directionForKey('ArrowUp')).toBe('up')
    expect(directionForKey('Enter')).toBeUndefined()
  })
})
