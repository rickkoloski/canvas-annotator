import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useShapePicker, type CanvasSpace } from '../lib/canvas-annotator'

const space: CanvasSpace = { getSvg: () => null, screenToCanvas: (x, y) => ({ x, y }), pxToCanvas: (px) => px, unit: () => 1, mountOverlay: () => null }
const click = (r: { current: ReturnType<typeof useShapePicker> }, x: number, y: number) => act(() => r.current.onCanvasClick({ clientX: x, clientY: y }))
const quad = async (r: { current: ReturnType<typeof useShapePicker> }, label: string) => {
  act(() => r.current.setShapeType('polygon'))
  click(r, 0, 0); click(r, 10, 0); click(r, 10, 10); click(r, 0, 10); click(r, 0, 0)   // close on the first point
  act(() => r.current.setName(label)); act(() => r.current.addToList())
}

describe('useShapePicker with frames', () => {
  it('tags shapes with the frame and keeps one per (id, frame)', async () => {
    const { result, rerender } = renderHook(({ frame }) => useShapePicker({ space, enabled: true, frame }), { initialProps: { frame: 0 } })
    await quad(result, 'monitor')
    rerender({ frame: 124 }); await quad(result, 'monitor')
    rerender({ frame: 124 }); await quad(result, 'monitor')      // same id, same frame → replaces
    expect(result.current.saved.map((s) => s.frame)).toEqual([0, 124])
  })
  it('edit re-opens a saved shape and delete removes it; undo restores', async () => {
    const { result } = renderHook(() => useShapePicker({ space, enabled: true, frame: 0 }))
    await quad(result, 'a'); act(() => result.current.setShapeType('polygon'))
    click(result, 50, 50); click(result, 60, 50); click(result, 60, 60); click(result, 50, 50)
    act(() => result.current.setName('b')); act(() => result.current.addToList())
    expect(result.current.saved.map((s) => s.id)).toEqual(['a', 'b'])
    act(() => result.current.editSaved(0))
    expect(result.current.saved.map((s) => s.id)).toEqual(['b']); expect(result.current.current?.id).toBe('a')
    act(() => result.current.deleteSaved(0))
    expect(result.current.saved).toHaveLength(0)
    act(() => result.current.undo()); expect(result.current.saved.map((s) => s.id)).toEqual(['b'])
    act(() => result.current.undo()); expect(result.current.saved.map((s) => s.id)).toEqual(['a', 'b'])
  })
  it('formatShape carries the frame', async () => {
    const { result } = renderHook(() => useShapePicker({ space, enabled: true, frame: 7 }))
    await quad(result, 'm')
    expect(result.current.formatShape(result.current.saved[0])).toContain('frame: 7')
  })
})
