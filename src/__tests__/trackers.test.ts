import { describe, it, expect } from 'vitest'
import { groupTrackers } from '../lib/canvas-annotator'
import type { CanvasShape } from '../lib/canvas-annotator'

const poly = (id: string, frame?: number): CanvasShape => ({ kind: 'polygon', id, label: id, frame, points: [] })
const circ = (id: string, frame?: number): CanvasShape => ({ kind: 'circle', id, label: id, frame, x: 0, y: 0, r: 1 })

describe('groupTrackers (P1)', () => {
  it('groups by id in first-seen order and sorts rows by frame', () => {
    const g = groupTrackers([poly('monitor', 124), circ('head', 62), poly('monitor', 0), circ('head', 0)])
    expect(g.map((x) => x.id)).toEqual(['monitor', 'head'])
    expect(g[0].kind).toBe('polygon'); expect(g[0].rows.map((r) => r.n.frame)).toEqual([0, 124])
    expect(g[1].rows.map((r) => r.i)).toEqual([3, 1])     // original indices survive for edit/delete
  })
  it('keeps timeless shapes as their own groups', () => {
    const g = groupTrackers([circ('static'), circ('static')])
    expect(g).toHaveLength(1); expect(g[0].rows).toHaveLength(2)
  })
})
