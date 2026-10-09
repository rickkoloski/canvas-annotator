import { describe, it, expect } from 'vitest'
import { rowsWithDelta, swimlanes, markBeat, nextBeatName, resolveTime, emptyBeats, type Beats } from '../beats'

const b: Beats = {
  lanes: ['bubble', 'flyout'],
  rows: [{ n: '3', t: 13, lane: 'flyout', motion: '', target: 'monitor', meaning: '' }, { n: '1', t: 2, lane: 'bubble', motion: '', target: 'head', meaning: '' },
         { n: '2', t: 6, lane: 'bubble', motion: '', target: 'head', meaning: '' }, { n: '4', t: 15, lane: 'flyout', motion: '', target: 'monitor', meaning: '' }],
  held: [{ lane: 'bubble', from: '1', to: '2' }, { lane: 'flyout', from: '3', to: '4' }],
}

describe('beats helpers', () => {
  it('sorts rows and derives Δ', () => {
    const rows = rowsWithDelta(b)
    expect(rows.map((r) => r.n)).toEqual(['1', '2', '3', '4']); expect(rows.map((r) => r.delta)).toEqual([0, 4, 7, 2])
  })
  it('renders swimlanes with ● and │', () => {
    const { cells } = swimlanes({ ...b, rows: [...b.rows, { n: '1b', t: 4, lane: 'flyout', motion: '', target: '', meaning: '' }] })
    expect(cells[1]).toEqual(['│', '●'])
  })
  it('marks a beat with the next name and adds an unknown lane', () => {
    const { beats, name } = markBeat(b, 9.52, 'audio', 'head')
    expect(name).toBe('5'); expect(beats.lanes).toEqual(['bubble', 'flyout', 'audio']); expect(beats.rows.at(-1)).toMatchObject({ n: '5', t: 9.52, lane: 'audio', target: 'head' })
    expect(nextBeatName(emptyBeats())).toBe('1')
  })
  it('resolves the GSAP grammar like the engine', () => {
    expect(resolveTime('3', b)).toBe(13); expect(resolveTime('1+=0.3', b)).toBeCloseTo(2.3); expect(resolveTime('2-=0.5', b)).toBe(5.5)
    expect(resolveTime('>', b, [4, 9])).toBe(9); expect(resolveTime(2.5, b)).toBe(2.5)
    expect(resolveTime('9', b)).toBe(9); expect(() => resolveTime('nine', b)).toThrow(); expect(() => resolveTime('<', b)).toThrow()
  })
})
