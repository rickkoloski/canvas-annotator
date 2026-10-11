import { describe, it, expect } from 'vitest'
import { moveBox, resizeBox } from '../lib/ui/handles'

describe('layers L1: handle maths', () => {
  it('moveBox adds the delta and clamps to the canvas', () => {
    expect(moveBox({ x: 0.5, y: 0.5, w: 0.3, h: 0.2 }, 0.1, -0.2)).toEqual({ x: 0.6, y: 0.3, w: 0.3, h: 0.2 })
    expect(moveBox({ x: 0.95, y: 0.02, w: 0.3, h: 0.2 }, 0.2, -0.1)).toEqual({ x: 1, y: 0, w: 0.3, h: 0.2 })
  })
  it('resizeBox follows the pointer from the centre, keeps the aspect, stays within bounds', () => {
    const b = resizeBox({ x: 0.5, y: 0.5, w: 0.3, h: 0.15 }, 0.75, 2)
    expect(b.w).toBe(0.5); expect(b.h).toBe(0.25)
    expect(resizeBox({ x: 0.5, y: 0.5, w: 0.3, h: 0.15 }, 0.5, 2).w).toBe(0.02)
    expect(resizeBox({ x: 0.5, y: 0.5, w: 0.3, h: 0.15 }, 1.4, 2).w).toBe(1)
  })
})
