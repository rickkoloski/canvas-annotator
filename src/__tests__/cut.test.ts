import { describe, it, expect } from 'vitest'
import { clipOut, totalOut, toSource, toOutput, splitAt } from '../CutView'

const clips = [{ source_in: 0, source_out: 4.2, speed: 1 }, { source_in: 9.8, source_out: 19.64, speed: 3 }]
describe('cut list maths (OTIO: source_range + time_scalar)', () => {
  it('durations', () => { expect(clipOut(clips[1])).toBeCloseTo(3.28, 2); expect(totalOut(clips)).toBeCloseTo(7.48, 2) })
  it('output ↔ source time hops over removed parts and scales by speed', () => {
    expect(toSource(clips, 2)).toEqual({ i: 0, s: 2 })
    const r = toSource(clips, 5); expect(r.i).toBe(1); expect(r.s).toBeCloseTo(9.8 + 0.8 * 3, 3)
    expect(toOutput(clips, 1, 12.8)).toBeCloseTo(5.2, 3)
  })
  it('splitAt divides the clip under the playhead and ignores edges', () => {
    const s = splitAt(clips, 2); expect(s).toHaveLength(3); expect(s[0].source_out).toBe(2); expect(s[1].source_in).toBe(2); expect(s[1].source_out).toBe(4.2)
    expect(splitAt(clips, 0.01)).toBe(clips)
  })
})
