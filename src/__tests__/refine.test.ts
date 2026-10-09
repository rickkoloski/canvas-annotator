import { describe, it, expect } from 'vitest'
import { acceptRefined, hitVertex, moveVertex, refinedOverlay, type RefinedShape } from '../anchors'
import type { CanvasShape } from '../lib/canvas-annotator'

const poly = (id: string, frame: number, x = 0): CanvasShape => ({ kind: 'polygon', id, label: id, frame, points: [{ x, y: 0 }, { x: x + 10, y: 0 }, { x: x + 10, y: 10 }, { x, y: 10 }] })
const ref = (id: string, frame: number, x: number): RefinedShape => ({ ...poly(id, frame, x), moved_px: [1, 2, 3, 4] })

describe('acceptRefined', () => {
  it('replaces geometry for matching id+frame, one frame or all', () => {
    const saved = [poly('m', 0, 0), poly('m', 5, 0), poly('other', 0, 0)]
    const refined = [ref('m', 0, 100), ref('m', 5, 200)]
    const one = acceptRefined(saved, refined, 0)
    expect((one[0] as { points: { x: number }[] }).points[0].x).toBe(100); expect((one[1] as { points: { x: number }[] }).points[0].x).toBe(0)
    const all = acceptRefined(saved, refined)
    expect((all[1] as { points: { x: number }[] }).points[0].x).toBe(200); expect(all[2]).toEqual(saved[2])
  })
})

describe('refinedOverlay', () => {
  it('styles only this frame, green, distinct ids', () => {
    const o = refinedOverlay([ref('m', 0, 0), ref('m', 5, 0)], 5)
    expect(o).toHaveLength(1); expect(o[0].id).toBe('refined-m'); expect(o[0].color).toBe('#3DDC84')
  })
})

describe('hitVertex / moveVertex', () => {
  it('finds the nearest vertex within tolerance on the frame only', () => {
    const saved = [poly('m', 0, 0), poly('m', 5, 0)]
    expect(hitVertex(saved, 0, 11, 1, 3)).toEqual({ index: 0, point: 1 })
    expect(hitVertex(saved, 5, 11, 1, 3)).toEqual({ index: 1, point: 1 })
    expect(hitVertex(saved, 0, 50, 50, 3)).toBeNull()
  })
  it('moves one vertex, rounding', () => {
    const m = moveVertex(poly('m', 0), 2, 20.4, 30.6) as { points: { x: number; y: number }[] }
    expect(m.points[2]).toEqual({ x: 20, y: 31 }); expect(m.points[0]).toEqual({ x: 0, y: 0 })
  })
})
