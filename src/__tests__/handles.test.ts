import { describe, it, expect } from 'vitest'
import { hitVertex, moveHandle, moveVertex, toggleHandles, buildAnchorsDoc } from '../anchors'
import { pathD } from '../lib/canvas-annotator/shapeMarkup'
import type { CanvasShape } from '../lib/canvas-annotator'

const quad = (): CanvasShape => ({ kind: 'polygon', id: 'm', label: 'm', frame: 0, points: [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 200 }, { x: 100, y: 200 }] })
const manifest = { version: 1, shot: 's', source: 'x', fps: 25, frames_total: 10, canvas: { kind: 'video', width: 1920, height: 1080 }, frames: [] }

describe('tranche 5: bezier handles (pen-tool rules)', () => {
  it('toggleHandles makes a smooth point along the neighbours, and back to a corner', () => {
    const s = toggleHandles(quad(), 1); const p = (s as { points: { in?: { x: number }; out?: { x: number; y: number } }[] }).points[1]
    expect(p.in && p.out).toBeTruthy(); expect(p.out!.y).toBeGreaterThan(100)        // TR's neighbours run TL→BR: the out handle heads down
    expect((toggleHandles(s, 1) as { points: { in?: unknown }[] }).points[1].in).toBeUndefined()
  })
  it('moveHandle mirrors the opposite handle unless broken', () => {
    const s = moveHandle(quad(), 0, 'out', 160, 60, false) as { points: { in?: { x: number; y: number }; out?: { x: number; y: number } }[] }
    expect(s.points[0].out).toEqual({ x: 160, y: 60 }); expect(s.points[0].in).toEqual({ x: 40, y: 140 })
    const b = moveHandle(s as CanvasShape, 0, 'out', 200, 80, true) as typeof s
    expect(b.points[0].out).toEqual({ x: 200, y: 80 }); expect(b.points[0].in).toEqual({ x: 40, y: 140 })
  })
  it('a handle dropped on its corner retracts', () => {
    const s = moveHandle(quad(), 0, 'out', 160, 60, false)
    const r = moveHandle(s, 0, 'in', 103, 102, true) as { points: { in?: unknown; out?: unknown }[] }
    expect(r.points[0].in).toBeUndefined(); expect(r.points[0].out).toEqual({ x: 160, y: 60 })
    expect((moveHandle(s, 0, 'out', 100, 100, false) as typeof r).points[0]).toEqual({ x: 100, y: 100 })
  })
  it('moveVertex carries the handles; hitVertex finds a handle', () => {
    const s = moveHandle(quad(), 0, 'out', 160, 60, false)
    const m = moveVertex(s, 0, 110, 120) as { points: { out?: { x: number; y: number } }[] }
    expect(m.points[0].out).toEqual({ x: 170, y: 80 })
    expect(hitVertex([s], 0, 161, 59, 5)).toEqual({ index: 0, point: 0, handle: 'out' })
    expect(hitVertex([s], 0, 100, 100, 5)).toEqual({ index: 0, point: 0 })
  })
  it('pathD uses C only on curved edges; the doc becomes version 2 with handles', () => {
    expect(pathD(quad().kind === 'polygon' ? (quad() as { points: { x: number; y: number }[] }).points : [], true)).toBe('M 100 100 L 300 100 L 300 200 L 100 200 Z')
    const s = moveHandle(quad(), 0, 'out', 160, 60, false)
    expect(pathD((s as { points: { x: number; y: number }[] }).points, true)).toMatch(/^M 100 100 C 160 60 300 100 300 100 L /)
    expect(buildAnchorsDoc(manifest, [quad()]).version).toBe(1); expect(buildAnchorsDoc(manifest, [s]).version).toBe(2)
  })
})
