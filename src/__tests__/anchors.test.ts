import { describe, it, expect } from 'vitest'
import { buildAnchorsDoc, overlayFor, type Manifest } from '../anchors'
import type { CanvasShape } from '../lib/canvas-annotator'

const manifest: Manifest = { version: 1, shot: 's', source: '/x.mov', fps: 25, frames_total: 100, canvas: { kind: 'video', width: 1920, height: 1080 }, frames: [] }
const poly = (id: string, frame: number, x = 0): CanvasShape => ({ kind: 'polygon', id, label: id, frame, points: [{ x, y: 0 }, { x: x + 1, y: 0 }, { x: x + 1, y: 1 }, { x, y: 1 }] })

describe('buildAnchorsDoc', () => {
  it('carries canvas facts and strips UI-only fields', () => {
    const doc = buildAnchorsDoc(manifest, [{ ...poly('m', 0), color: '#fff', wip: true }])
    expect(doc.version).toBe(1)
    expect(doc.canvas).toMatchObject({ kind: 'video', width: 1920, height: 1080, fps: 25, shot: 's' })
    expect(doc.shapes[0]).not.toHaveProperty('color'); expect(doc.shapes[0]).not.toHaveProperty('wip')
    expect(doc.shapes[0].frame).toBe(0)
  })
})

describe('overlayFor', () => {
  it('shows this frame solid and the nearest other frame of a missing id as a ghost', () => {
    const saved = [poly('m', 0, 0), poly('m', 100, 100), poly('c', 50, 50)]
    const { here, ghosts } = overlayFor(saved, 90)
    expect(here).toHaveLength(0)
    expect(ghosts.map((g) => `${g.id}@${g.frame}`).sort()).toEqual(['c@50', 'm@100'])
    expect(ghosts.find((g) => g.id === 'm')).toMatchObject({ open: true, label: 'm @100' })
  })
  it('does not ghost an id already present on the frame', () => {
    const saved = [poly('m', 0), poly('m', 100)]
    const { here, ghosts } = overlayFor(saved, 100)
    expect(here).toHaveLength(1); expect(ghosts).toHaveLength(0)
  })
  it('ignores timeless shapes for ghosting', () => {
    const saved: CanvasShape[] = [{ kind: 'circle', id: 'static', label: 'static', x: 1, y: 1, r: 1 }]
    expect(overlayFor(saved, 5).ghosts).toHaveLength(0)
  })
})
